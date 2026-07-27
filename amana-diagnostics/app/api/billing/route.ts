import { NextResponse } from 'next/server';
import { getDb, queueSync } from '@/lib/localDb';

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

      // 1. Fetch current balance
      const currentStmt = db.prepare(`SELECT balance FROM billing_accounts WHERE id = ?`);
      const acc = currentStmt.get(accountId) as { balance: number } | undefined;
      if (!acc) return NextResponse.json({ error: 'Billing account not found' }, { status: 404 });

      const newBalance = (acc.balance || 0) + amount;

      // 2. Update balance
      const upStmt = db.prepare(`
        UPDATE billing_accounts 
        SET balance = ?, updated_at = ? 
        WHERE id = ?
      `);
      upStmt.run(newBalance, nowStr, accountId);

      // Queue sync for billing account update
      const fullAcc = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(accountId) as any;
      if (fullAcc) {
        queueSync(db, 'billing_accounts', 'UPDATE', accountId, {
          ...fullAcc,
          balance: newBalance,
          updated_at: nowStr
        });
      }

      // 3. Log transaction
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
        patientId || null,
        'deposit',
        amount,
        description || 'Top-up deposit',
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
        patient_id: patientId || null,
        type: 'deposit',
        amount,
        description: description || 'Top-up deposit',
        reference_id: null,
        payment_method: paymentMethod,
        created_by: createdBy || null,
        created_at: nowStr
      });

      return NextResponse.json({ success: true, newBalance });
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

      // If paid via wallet, check limit and deduct balance
      if (charge.paymentMethod === 'wallet' && charge.billingAccountId) {
        // Fetch current account
        const accStmt = db.prepare(`SELECT balance, credit_limit FROM billing_accounts WHERE id = ?`);
        const acc = accStmt.get(charge.billingAccountId) as { balance: number; credit_limit: number } | undefined;
        if (!acc) return NextResponse.json({ error: 'Billing account not found' }, { status: 404 });

        const currentBalance = acc.balance || 0;
        const creditLimit = acc.credit_limit || 0;
        const chargeAmount = charge.amount;

        if (currentBalance + creditLimit < chargeAmount) {
          return NextResponse.json({ 
            error: `Insufficient wallet balance. Total available credit: ₦${(currentBalance + creditLimit).toLocaleString('en-NG')}` 
          }, { status: 400 });
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
    console.error('API POST /api/billing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
