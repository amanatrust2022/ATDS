import { NextResponse } from 'next/server';
import { getDb, queueSync } from '@/lib/localDb';
import { sendEmail } from '@/lib/brevo';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');

    if (!orgId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM custom_tests 
      WHERE organization_id = ? 
      ORDER BY name ASC
    `);
    const rows = stmt.all(orgId) as any[];

    // Parse parameters from JSON strings
    const tests = rows.map((r: any) => ({
      id: r.id,
      organization_id: r.organization_id,
      name: r.name,
      department: r.department,
      category: r.category,
      specimen: r.specimen,
      parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters) : r.parameters,
      is_active: r.is_active !== 0,
      updated_at: r.updated_at
    }));

    return NextResponse.json(tests);
  } catch (error: any) {
    console.error('API GET /api/custom-tests error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, test, updates, organizationId } = body;
    const db = getDb();
    const nowStr = new Date().toISOString();

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    if (action === 'add') {
      const stmt = db.prepare(`
        INSERT INTO custom_tests (
          id, organization_id, name, department, category, specimen, parameters, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const isActiveValue = (test.is_active === 0 || test.is_active === false) ? 0 : 1;

      stmt.run(
        test.id,
        organizationId,
        test.name,
        test.department,
        test.category,
        test.specimen,
        test.parameters || '[]',
        isActiveValue,
        nowStr
      );

      // Log in outbox
      queueSync(db, 'custom_tests', 'INSERT', `${organizationId}:${test.id}`, {
        id: test.id,
        organization_id: organizationId,
        name: test.name,
        department: test.department,
        category: test.category,
        specimen: test.specimen,
        parameters: typeof test.parameters === 'string' ? JSON.parse(test.parameters) : test.parameters,
        is_active: isActiveValue === 1,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      const stmt = db.prepare(`
        INSERT INTO custom_tests (id, organization_id, name, department, category, specimen, parameters, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(organization_id, id) DO UPDATE SET
          name = COALESCE(excluded.name, custom_tests.name),
          department = COALESCE(excluded.department, custom_tests.department),
          category = COALESCE(excluded.category, custom_tests.category),
          specimen = COALESCE(excluded.specimen, custom_tests.specimen),
          parameters = COALESCE(excluded.parameters, custom_tests.parameters),
          is_active = COALESCE(excluded.is_active, custom_tests.is_active),
          updated_at = excluded.updated_at
      `);

      stmt.run(
        id,
        organizationId,
        updates.name !== undefined ? updates.name : null,
        updates.department !== undefined ? updates.department : null,
        updates.category !== undefined ? updates.category : null,
        updates.specimen !== undefined ? updates.specimen : null,
        updates.parameters !== undefined ? updates.parameters : null,
        updates.is_active !== undefined ? updates.is_active : null,
        nowStr
      );

      // Log in outbox
      // Fetch current state from DB to send correct full object for replication
      const getStmt = db.prepare(`SELECT * FROM custom_tests WHERE organization_id = ? AND id = ?`);
      const row = getStmt.get(organizationId, id) as any;

      queueSync(db, 'custom_tests', 'INSERT', `${organizationId}:${id}`, {
        id: row.id,
        organization_id: row.organization_id,
        name: row.name,
        department: row.department,
        category: row.category,
        specimen: row.specimen,
        parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
        is_active: row.is_active === 1,
        updated_at: nowStr
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const stmt = db.prepare(`
        DELETE FROM custom_tests 
        WHERE organization_id = ? AND id = ?
      `);
      stmt.run(organizationId, id);

      // Log in outbox
      queueSync(db, 'custom_tests', 'DELETE', `${organizationId}:${id}`, {});

      return NextResponse.json({ success: true });
    }

    if (action === 'notifyAdmin') {
      const { test, organizationId, addedBy } = body;

      // 1. Get organization name and email
      const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(organizationId) as any;
      const orgName = org?.name || 'Amana Trust Diagnostics';
      
      // 2. Fetch admin emails from local_auth/profiles
      let recipients: string[] = [];
      try {
        const admins = db.prepare(`
          SELECT local_auth.email FROM local_auth 
          JOIN profiles ON local_auth.user_id = profiles.id 
          WHERE profiles.role = 'admin' AND profiles.organization_id = ?
        `).all(organizationId) as { email: string }[];
        
        recipients = admins.map(a => a.email).filter(Boolean);
      } catch (err) {
        console.warn('Failed to query admin emails from database:', err);
      }
      
      // Add organization email to recipients as fallback
      if (org?.email) {
        recipients.push(org.email);
      }
      // Deduplicate
      recipients = Array.from(new Set(recipients));

      // If no admin emails found, use fallback
      if (recipients.length === 0) {
        recipients.push('amanatrust2022@gmail.com');
      }

      const staffName = addedBy?.name || 'Staff member';
      const staffRole = addedBy?.role === 'lab' ? 'Lab Scientist' : addedBy?.role === 'lab_tech' ? 'Lab Technician' : addedBy?.role === 'radiology' ? 'Radiologist' : addedBy?.role || 'Staff';
      
      const host = request.headers.get('host') || 'localhost:3000';
      const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
      const pricingLink = `${protocol}://${host}/${org?.slug || 'workspace'}/admin/referrals/pricing`;

      const emailSubject = `Action Required: New Investigation Added — ${test.name}`;
      const emailHtml = `
        <div style="font-family: 'Times New Roman', Times, serif; max-width: 520px; margin: 0 auto; color: #000000; line-height: 1.6;">
          <div style="background: #0563c1; padding: 28px 24px; text-align: center; border: 1px solid #0563c1;">
            <h1 style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">NEW INVESTIGATION ADDED</h1>
            <p style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 6px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${orgName}</p>
          </div>
          <div style="padding: 32px 24px; border: 1px solid #0563c1; border-top: none; background: #ffffff;">
            <p style="margin: 0 0 16px; font-size: 15px; color: #000000;">Dear Administrator,</p>
            <p style="margin: 0 0 16px; font-size: 15px; color: #000000;">A new investigation has been added to the test catalogue by a staff member:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; font-weight: bold; width: 35%; border-bottom: 1px solid #eee;">Test Name:</td>
                <td style="padding: 6px 0; border-bottom: 1px solid #eee; font-weight: bold;">${test.name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; border-bottom: 1px solid #eee;">Department:</td>
                <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-transform: uppercase;">${test.department}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; border-bottom: 1px solid #eee;">Category:</td>
                <td style="padding: 6px 0; border-bottom: 1px solid #eee;">${test.category}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; border-bottom: 1px solid #eee;">Specimen:</td>
                <td style="padding: 6px 0; border-bottom: 1px solid #eee;">${test.specimen}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; border-bottom: 1px solid #eee;">Added By:</td>
                <td style="padding: 6px 0; border-bottom: 1px solid #eee;">${staffName} (${staffRole})</td>
              </tr>
            </table>
            <p style="margin: 0 0 24px; font-size: 15px; color: #000000;">Please log into the admin dashboard to configure the **base price** and **referral commission** for this investigation so it can be billed correctly at reception.</p>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${pricingLink}" style="display: inline-block; padding: 12px 24px; background-color: #0563c1; color: #ffffff !important; text-decoration: none; font-weight: bold; font-size: 14px;">Configure Price & Commission →</a>
            </div>
            <p style="margin: 0; font-size: 15px; color: #000000; margin-top: 20px;">Thank you,</p>
            <p style="margin: 0; font-size: 15px; color: #000000;"><strong>DiagnosticOS Mailer</strong></p>
          </div>
          <div style="padding: 16px; text-align: center; font-size: 12px; color: #666; border: 1px solid #ddd; border-top: none;">
            &copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.
          </div>
        </div>
      `;

      for (const email of recipients) {
        try {
          await sendEmail({
            to: email,
            subject: emailSubject,
            htmlContent: emailHtml
          });
        } catch (mailErr: any) {
          console.warn(`Failed to send admin notification email to ${email}:`, mailErr.message);
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('API POST /api/custom-tests error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
