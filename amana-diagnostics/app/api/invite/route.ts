import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/brevo';

export async function POST(request: Request) {
  try {
    const { email, role, organizationName, inviteLink } = await request.json();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .btn {
            display: inline-block;
            padding: 12px 24px;
            background-color: #4472c4;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-family: sans-serif;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f8fafc;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px;">
                    <div style="background-color: #4472c4; border-radius: 10px; width: 44px; height: 44px; margin-bottom: 24px; display: block;">
                      <img src="https://amanatrust.com/wp-content/uploads/2021/06/cropped-logo-amana-1.png" width="44" height="44" style="border-radius: 10px;" />
                    </div>
                    <h1 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">Join the team</h1>
                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                      Hello,<br/><br/>
                      You've been invited to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.
                      Click the button below to accept your invitation and set up your account.
                    </p>
                    <div style="margin-bottom: 32px;">
                      <a href="${inviteLink}" class="btn">Accept Invitation</a>
                    </div>
                    <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0;">
                      If the button doesn't work, copy and paste this link:<br/>
                      <span style="color: #4472c4;">${inviteLink}</span>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f1f5f9; padding: 24px; text-align: center;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                      &copy; 2026 Amana Trust Diagnostics & Clinical Services Ltd. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject: `Invitation to join ${organizationName}`,
      htmlContent
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Invite email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
