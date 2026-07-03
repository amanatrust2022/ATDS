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
          body {
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
          }
        </style>
      </head>
      <body>
        <div style="font-family: 'Times New Roman', Times, serif; max-width: 600px; margin: 40px auto; color: #000000; line-height: 1.6; background-color: #ffffff; border: 1px solid #0563c1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background: #0563c1; padding: 28px 24px; text-align: center; border-bottom: 1px solid #0563c1;">
            <h1 style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;">STAFF INVITATION</h1>
            <p style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 8px 0 0; font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${organizationName}</p>
          </div>
          
          <div style="padding: 32px 24px;">
            <p style="font-family: 'Times New Roman', Times, serif; margin: 0 0 16px; font-size: 16px; color: #000000;">Dear Professional,</p>
            <p style="font-family: 'Times New Roman', Times, serif; margin: 0 0 20px; font-size: 15px; color: #000000; line-height: 1.6;">
              You have been invited to join the clinical team at <strong>${organizationName}</strong> as a <strong>${role}</strong>. Please find the details of your workspace invitation below.
            </p>
            
            <div style="background: #f8fafc; border: 1px solid #0563c1; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 15px; font-family: 'Times New Roman', Times, serif;">
                <tr>
                  <td style="padding: 6px 0; color: #000000; width: 35%; font-weight: bold;">Organization:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #0563c1;">${organizationName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #000000; font-weight: bold;">Access Role:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #000000; text-transform: uppercase;">${role}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #000000; font-weight: bold;">Invitation Date:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #000000;">${new Date().toLocaleDateString('en-NG')}</td>
                </tr>
              </table>
            </div>
            
            <p style="font-family: 'Times New Roman', Times, serif; margin: 0 0 20px; font-size: 15px; color: #000000;">
              Click the button below to accept your invitation and complete your staff account setup:
            </p>
            
            <div style="margin: 28px 0; text-align: center;">
              <a href="${inviteLink}" style="display: inline-block; padding: 12px 28px; background-color: #0563c1; color: #ffffff !important; text-decoration: none; font-weight: bold; font-family: 'Times New Roman', Times, serif; border: 1px solid #044e99; text-transform: uppercase; letter-spacing: 0.5px;">Accept Invitation & Join Team</a>
            </div>
            
            <p style="font-family: 'Times New Roman', Times, serif; margin: 0 0 12px; font-size: 14px; color: #64748b; line-height: 1.5;">
              If the button does not work, copy and paste this link into your browser:<br/>
              <a href="${inviteLink}" style="color: #0563c1; text-decoration: underline; word-break: break-all;">${inviteLink}</a>
            </p>
            
            <p style="font-family: 'Times New Roman', Times, serif; margin: 24px 0 0; font-size: 15px; color: #000000;">
              Thank you,<br/>
              <strong>${organizationName} Administration</strong>
            </p>
          </div>
          
          <div style="padding: 20px; text-align: center; font-size: 11px; color: #64748b; font-family: 'Times New Roman', Times, serif; border-top: 1px solid #e2e8f0; background-color: #f8fafc;">
            &copy; ${new Date().getFullYear()} ${organizationName}. All rights reserved.
          </div>
        </div>
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
