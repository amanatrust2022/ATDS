import { NextResponse } from 'next/server';
import { getDb, queueSync, inTransaction, HttpError } from '@/lib/localDb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');
    const type = searchParams.get('type');
    const db = getDb();

    if (type === 'accounts') {
      if (!orgId) return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
      const stmt = db.prepare(`
        SELECT * FROM billing_accounts 
        WHERE organization_id = ? 
        ORDER BY name ASC
      `);
      const accounts = stmt.all(orgId) as any[];
      return NextResponse.json(accounts);
    }

    if (type === 'patient_wallet') {
      const patientId = searchParams.get('patientId');
      if (!patientId) return NextResponse.json({ error: 'Missing patientId' }, { status: 400 });

      // Find the billing account linked to this patient
      const patientStmt = db.prepare(`SELECT billing_account_id FROM patients WHERE id = ?`);
      const patient = patientStmt.get(patientId) as { billing_account_id: string } | undefined;

      if (!patient || !patient.billing_account_id) {
        return NextResponse.json(null);
      }

      const accStmt = db.prepare(`SELECT * FROM billing_accounts WHERE id = ?`);
      const account = accStmt.get(patient.billing_account_id);
      return NextResponse.json(account || null);
    }

    if (type === 'ledger') {
      const accountId = searchParams.get('accountId');
      if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });

      const stmt = db.prepare(`
        SELECT * FROM billing_ledger_transactions 
        WHERE billing_account_id = ? 
        ORDER BY created_at DESC
      `);
      const transactions = stmt.all(accountId) as any[];
      return NextResponse.json(transactions);
    }

    if (type === 'external_charges') {
      if (!orgId) return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
      const stmt = db.prepare(`
        SELECT ec.*, p.first_name, p.surname, p.middle_name, p.slip_number 
        FROM external_department_charges ec
        JOIN patients p ON ec.patient_id = p.id
        WHERE ec.organization_id = ? 
        ORDER BY ec.created_at DESC
      `);
      const charges = stmt.all(orgId) as any[];
      
      const formatted = charges.map(c => ({
        id: c.id,
        organizationId: c.organization_id,
        patientId: c.patient_id,
        billingAccountId: c.billing_account_id,
        department: c.department,
        receiptNumber: c.receipt_number,
        amount: c.amount,
        paymentMethod: c.payment_method,
        status: c.status,
        description: c.description,
        createdBy: c.created_by,
        createdAt: c.created_at,
        patientName: [c.first_name, c.middle_name, c.surname].filter(Boolean).join(' '),
        patientSlip: c.slip_number
      }));
      return NextResponse.json(formatted);
    }

    return NextResponse.json({ error: 'Unknown query type' }, { status: 400 });
  } catch (error: any) {
    console.error('API GET /api/billing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const db = getDb();
    const nowStr = new Date().toISOString();

    if (action === 'createAccount') {
      const { account, initialDeposit, paymentMethod, linkedPatientIds, createdBy, organizationId } = body;
      const accountId = crypto.randomUUID();

      // 1. Insert billing account
      const accStmt = db.prepare(`
        INSERT INTO billing_accounts (
          id, organization_id, name, owner_patient_id, balance, credit_limit, type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      accStmt.run(
        accountId,
        organizationId,
        account.name,
        account.owner_patient_id,
        initialDeposit || 0.0,
        account.credit_limit || 0.0,
        account.type,
        nowStr,
        nowStr
      );

      // Queue sync for billing account
      queueSync(db, 'billing_accounts', 'INSERT', accountId, {
        id: accountId,
        organization_id: organizationId,
        name: account.name,
        owner_patient_id: account.owner_patient_id,
        balance: initialDeposit || 0.0,
        credit_limit: account.credit_limit || 0.0,
        type: account.type,
        created_at: nowStr,
        updated_at: nowStr
      });

      // 2. Link owner and dependents to this billing account
      const allPatientIds = Array.from(new Set([account.owner_patient_id, ...linkedPatientIds])) as string[];
      const linkStmt = db.prepare(`
        UPDATE patients 
        SET billing_account_id = ?, updated_at = ? 
        WHERE id = ?
      `);

      for (const pId of allPatientIds) {
        linkStmt.run(accountId, nowStr, pId);

        // Fetch patient details to sync the update
        const pat = db.prepare('SELECT * FROM patients WHERE id = ?').get(pId) as any;
        if (pat) {
          queueSync(db, 'patients', 'UPDATE', pId, {
            ...pat,
            billing_account_id: accountId,
            updated_at: nowStr
          });
        }
      }

      // 3. Log initial deposit if > 0
      if (initialDeposit > 0) {
        const txId = crypto.randomUUID();
        const txStmt = db.prepare(`
          INSERT INTO billing_ledger_transactions (
            id, organization_id, billing_account_id, patient_id, type, amount, description, reference_id, payment_method, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        txStmt.run(
          txId,
          organizationId,
          accountId,
          account.owner_patient_id,
          'deposit',
          initialDeposit,
          'Initial deposit upon account opening',
          null,
          paymentMethod,
          createdBy || null,
          nowStr
        );

        // Queue sync for transaction
        queueSync(db, 'billing_ledger_transactions', 'INSERT', txId, {
          id: txId,
          organization_id: organizationId,
          billing_account_id: accountId,
          patient_id: account.owner_patient_id,
          type: 'deposit',
          amount: initialDeposit,
          description: 'Initial deposit upon account opening',
          reference_id: null,
          payment_method: paymentMethod,
          created_by: createdBy || null,
          created_at: nowStr
        });
      }

      return NextResponse.json({ success: true, id: accountId });
    }

    if (action === 'deposit') {
      const { accountId, amount, description, paymentMethod, createdBy, organizationId, patientId } = body;

      // The browser checks this too. The browser is not where money is decided:
      // this handler used to add whatever number it was given, including a
      // negative one, straight onto the balance.
      const depositAmount = Number(amount);
      if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
        return NextResponse.json({ error: 'Deposit amount must be a positive number' }, { status: 400 });
      }
      if (!organizationId) {
        return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
      }

      const txId = crypto.randomUUID();

      // Read, add, write and log inside one write lock. Without it two
      // receptionists taking money at the same moment both read the same
      // starting balance and one deposit vanishes; and a crash between the
      // balance and the ledger moved money with nothing to say why.
      let newBalance = 0;
      try {
        newBalance = inTransaction(db, () => {
          const acc = db
            .prepare('SELECT balance FROM billing_accounts WHERE id = ? AND organization_id = ?')
            .get(accountId, organizationId) as { balance: number } | undefined;
          if (!acc) throw new HttpError('Billing account not found', 404);

          const updated = (acc.balance || 0) + depositAmount;

          db.prepare('UPDATE billing_accounts SET balance = ?, updated_at = ? WHERE id = ?')
            .run(updated, nowStr, accountId);

          db.prepare(`
            INSERT INTO billing_ledger_transactions (
              id, organization_id, billing_account_id, patient_id, type, amount, description, reference_id, payment_method, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            txId, organizationId, accountId, patientId || null, 'deposit', depositAmount,
            description || 'Top-up deposit', null, paymentMethod, createdBy || null, nowStr,
          );

          const fullAcc = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(accountId) as any;
          if (fullAcc) {
            queueSync(db, 'billing_accounts', 'UPDATE', accountId, {
              ...fullAcc,
              balance: updated,
              updated_at: nowStr,
            });
          }

          queueSync(db, 'billing_ledger_transactions', 'INSERT', txId, {
            id: txId,
            organization_id: organizationId,
            billing_account_id: accountId,
            patient_id: patientId || null,
            type: 'deposit',
            amount: depositAmount,
            description: description || 'Top-up deposit',
            reference_id: null,
            payment_method: paymentMethod,
            created_by: createdBy || null,
            created_at: nowStr,
          });

          return updated;
        });
      } catch (err: any) {
        if (err instanceof HttpError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }

      return NextResponse.json({ success: true, newBalance });
    }

    if (action === 'reverseTransaction') {
      const { transactionId, reason, createdBy, organizationId } = body;
      if (!transactionId || !organizationId) {
        return NextResponse.json({ error: 'Missing transactionId or organizationId' }, { status: 400 });
      }

      const txId = crypto.randomUUID();

      try {
        inTransaction(db, () => {
          const original = db
            .prepare('SELECT * FROM billing_ledger_transactions WHERE id = ? AND organization_id = ?')
            .get(transactionId, organizationId) as any;
          if (!original) throw new HttpError('That transaction could not be found', 404);
          if (original.type === 'reversal') throw new HttpError('That entry is itself a reversal', 400);

          // One reversal per entry, or a charge could be handed back repeatedly.
          const seen = db
            .prepare("SELECT COUNT(*) as count FROM billing_ledger_transactions WHERE organization_id = ? AND type = 'reversal' AND reference_id = ?")
            .get(organizationId, transactionId) as { count: number };
          if (seen.count > 0) throw new HttpError('That transaction has already been reversed', 400);

          const restored = -Number(original.amount || 0);
          if (!Number.isFinite(restored) || restored === 0) {
            throw new HttpError('That transaction has no amount to reverse', 400);
          }

          const acc = db
            .prepare('SELECT balance FROM billing_accounts WHERE id = ? AND organization_id = ?')
            .get(original.billing_account_id, organizationId) as { balance: number } | undefined;
          if (!acc) throw new HttpError('Billing account not found', 404);

          const updated = (acc.balance || 0) + restored;

          db.prepare('UPDATE billing_accounts SET balance = ?, updated_at = ? WHERE id = ?')
            .run(updated, nowStr, original.billing_account_id);

          // The original entry is left exactly as it is. A statement records
          // what happened; a charge that quietly disappears does not.
          const description = `Reversal of "${original.description || 'transaction'}" — ${reason || 'no reason given'}`;

          db.prepare(`
            INSERT INTO billing_ledger_transactions (
              id, organization_id, billing_account_id, patient_id, type, amount, description, reference_id, payment_method, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            txId, organizationId, original.billing_account_id, original.patient_id || null,
            'reversal', restored, description, transactionId,
            original.payment_method || null, createdBy || null, nowStr,
          );

          const fullAcc = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(original.billing_account_id) as any;
          if (fullAcc) {
            queueSync(db, 'billing_accounts', 'UPDATE', original.billing_account_id, {
              ...fullAcc, balance: updated, updated_at: nowStr,
            });
          }

          queueSync(db, 'billing_ledger_transactions', 'INSERT', txId, {
            id: txId,
            organization_id: organizationId,
            billing_account_id: original.billing_account_id,
            patient_id: original.patient_id || null,
            type: 'reversal',
            amount: restored,
            description,
            reference_id: transactionId,
            payment_method: original.payment_method || null,
            created_by: createdBy || null,
            created_at: nowStr,
          });
        });
      } catch (err: any) {
        if (err instanceof HttpError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }

      return NextResponse.json({ success: true, id: txId });
    }

    if (action === 'updateLimit') {
      const { accountId, newLimit } = body;
      const upStmt = db.prepare('UPDATE billing_accounts SET credit_limit = ?, updated_at = ? WHERE id = ?');
      upStmt.run(newLimit, nowStr, accountId);
      
      const fullAcc = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(accountId) as any;
      if (fullAcc) {
        queueSync(db, 'billing_accounts', 'UPDATE', accountId, {
          ...fullAcc,
          credit_limit: newLimit,
          updated_at: nowStr
        });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'upgradeAccount') {
      const { accountId } = body;
      const upStmt = db.prepare("UPDATE billing_accounts SET type = 'family', updated_at = ? WHERE id = ?");
      upStmt.run(nowStr, accountId);
      
      const fullAcc = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(accountId) as any;
      if (fullAcc) {
        queueSync(db, 'billing_accounts', 'UPDATE', accountId, {
          ...fullAcc,
          type: 'family',
          updated_at: nowStr
        });
      }
      return NextResponse.json({ success: true });
    }
if (action === 'logExternalCharge') {
      const { charge } = body;
      const chargeId = crypto.randomUUID();

      // The debit, its ledger entry and the charge row must all land or none of
      // them: a failure part-way through would leave the wallet debited with
      // nothing recording why. Throw rather than return early inside here, or
      // the transaction is left open.
      inTransaction(db, () => {
      // If paid via wallet, check limit and deduct balance
      if (charge.paymentMethod === 'wallet' && charge.billingAccountId) {
        // Fetch current account
        const accStmt = db.prepare(`SELECT balance, credit_limit FROM billing_accounts WHERE id = ?`);
        const acc = accStmt.get(charge.billingAccountId) as { balance: number; credit_limit: number } | undefined;
        if (!acc) throw new HttpError('Billing account not found', 404);

        const currentBalance = acc.balance || 0;
        const creditLimit = acc.credit_limit || 0;
        const chargeAmount = charge.amount;

        if (currentBalance + creditLimit < chargeAmount) {
          throw new HttpError(
            `Insufficient wallet balance. Total available credit: ₦${(currentBalance + creditLimit).toLocaleString('en-NG')}`,
            400,
          );
        }

        const newBalance = currentBalance - chargeAmount;

        // Update balance
        const upStmt = db.prepare(`
          UPDATE billing_accounts 
          SET balance = ?, updated_at = ? 
          WHERE id = ?
        `);
        upStmt.run(newBalance, nowStr, charge.billingAccountId);

        // Queue sync account update
        const fullAcc = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(charge.billingAccountId) as any;
        if (fullAcc) {
          queueSync(db, 'billing_accounts', 'UPDATE', charge.billingAccountId, {
            ...fullAcc,
            balance: newBalance,
            updated_at: nowStr
          });
        }

        // Log transaction in ledger
        const txId = crypto.randomUUID();
        const txStmt = db.prepare(`
          INSERT INTO billing_ledger_transactions (
            id, organization_id, billing_account_id, patient_id, type, amount, description, reference_id, payment_method, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        txStmt.run(
          txId,
          charge.organizationId,
          charge.billingAccountId,
          charge.patientId,
          'charge',
          -chargeAmount,
          `${charge.department.toUpperCase()} Bill - Ref: ${charge.receiptNumber}`,
          charge.receiptNumber,
          'wallet',
          charge.createdBy || null,
          nowStr
        );

        // Queue sync transaction
        queueSync(db, 'billing_ledger_transactions', 'INSERT', txId, {
          id: txId,
          organization_id: charge.organizationId,
          billing_account_id: charge.billingAccountId,
          patient_id: charge.patientId,
          type: 'charge',
          amount: -chargeAmount,
          description: `${charge.department.toUpperCase()} Bill - Ref: ${charge.receiptNumber}`,
          reference_id: charge.receiptNumber,
          payment_method: 'wallet',
          created_by: charge.createdBy || null,
          created_at: nowStr
        });
      }

      // Log external charge record
      const chStmt = db.prepare(`
        INSERT INTO external_department_charges (
          id, organization_id, patient_id, billing_account_id, department, receipt_number, amount, payment_method, status, description, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      chStmt.run(
        chargeId,
        charge.organizationId,
        charge.patientId,
        charge.paymentMethod === 'wallet' ? charge.billingAccountId : null,
        charge.department,
        charge.receiptNumber,
        charge.amount,
        charge.paymentMethod,
        charge.status || 'paid',
        charge.description || null,
        charge.createdBy || null,
        nowStr
      );

      // Queue sync charge record
      queueSync(db, 'external_department_charges', 'INSERT', chargeId, {
        id: chargeId,
        organization_id: charge.organizationId,
        patient_id: charge.patientId,
        billing_account_id: charge.paymentMethod === 'wallet' ? charge.billingAccountId : null,
        department: charge.department,
        receipt_number: charge.receiptNumber,
        amount: charge.amount,
        payment_method: charge.paymentMethod,
        status: charge.status || 'paid',
        description: charge.description || null,
        created_by: charge.createdBy || null,
        created_at: nowStr
      });
      });

      return NextResponse.json({ success: true, id: chargeId });
    }

    if (action === 'linkPatient') {
      const { patientId, billingAccountId } = body;
      if (!patientId) return NextResponse.json({ error: 'Missing patientId' }, { status: 400 });

      const stmt = db.prepare(`UPDATE patients SET billing_account_id = ?, updated_at = ? WHERE id = ?`);
      stmt.run(billingAccountId || null, nowStr, patientId);

      const pat = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId) as any;
      if (pat) {
        queueSync(db, 'patients', 'UPDATE', patientId, {
          ...pat,
          billing_account_id: billingAccountId || null,
          updated_at: nowStr
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    // A rejected charge (insufficient funds, unknown account) is the caller's
    // problem, not a server fault — keep its status so the UI can tell them.
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('API POST /api/billing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
