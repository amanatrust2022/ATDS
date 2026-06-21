import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/brevo';
import { getPatientByEmail } from '@/lib/portalDb';
import { signOtp, verifyOtp, signToken } from '@/lib/portalAuth';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Request OTP code
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if patient exists in SQLite or Supabase depending on mode
    const patient = await getPatientByEmail(normalizedEmail);

    if (!patient) {
      // For security, don't reveal if email exists — return success to prevent enumeration
      return NextResponse.json({ 
        success: true, 
        message: 'If this email is registered, an OTP has been sent.' 
      });
    }

    const otp = generateOtp();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Generate stateless verification state token containing signature hash
    const stateToken = signOtp(normalizedEmail, otp, expires);

    const patientName = `${patient.first_name || ''} ${patient.surname || ''}`.trim() || 'Patient';

    await sendEmail({
      to: normalizedEmail,
      subject: 'Your Amana Diagnostics Portal Verification Code',
      htmlContent: `
        <div style="font-family: 'Times New Roman', Times, serif; max-width: 520px; margin: 0 auto; color: #000000; line-height: 1.6;">
          <div style="background: #0563c1; padding: 28px 24px; text-align: center; border: 1px solid #0563c1;">
            <h1 style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">PATIENT PORTAL</h1>
            <p style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 6px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Amana Trust Diagnostics</p>
          </div>
          <div style="padding: 32px 24px; border: 1px solid #0563c1; border-top: none; background: #ffffff;">
            <p style="margin: 0 0 16px; font-size: 16px; color: #000000;">Dear <strong>${patientName}</strong>,</p>
            <p style="margin: 0 0 24px; font-size: 15px; color: #000000;">Your one-time verification code for the Amana Diagnostics Patient Portal is:</p>
            <div style="background: #f0f5ff; border: 2px solid #0563c1; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-family: 'Courier New', monospace; font-size: 42px; font-weight: bold; color: #0563c1; letter-spacing: 12px;">${otp}</span>
            </div>
            <p style="margin: 0 0 8px; font-size: 14px; color: #555;">This code expires in <strong>10 minutes</strong>.</p>
            <p style="margin: 0 0 20px; font-size: 14px; color: #555;">If you did not request this code, please ignore this email.</p>
            <p style="margin: 0; font-size: 15px; color: #000000;">Thank you for choosing <strong>Amana Trust Diagnostics</strong>.</p>
          </div>
          <div style="padding: 16px; text-align: center; font-size: 12px; color: #666; border: 1px solid #ddd; border-top: none;">
            &copy; ${new Date().getFullYear()} Amana Trust Diagnostics. All rights reserved.
          </div>
        </div>
      `,
    });

    return NextResponse.json({ 
      success: true, 
      state: stateToken, 
      message: 'OTP sent successfully.' 
    });
  } catch (error: any) {
    console.error('Portal OTP error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send OTP' }, { status: 500 });
  }
}

// Verify OTP
export async function PUT(request: Request) {
  try {
    const { email, otp, state } = await request.json();

    if (!email || !otp || !state) {
      return NextResponse.json({ error: 'Email, OTP, and verification state are required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify OTP using timing-safe signature comparison
    const isValid = verifyOtp(normalizedEmail, otp, state);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired code. Please try again.' }, { status: 400 });
    }

    // Generate signed session token (30 days validity)
    const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const sessionToken = signToken({ 
      email: normalizedEmail, 
      iat: Date.now(), 
      exp,
      v: 1 
    });

    return NextResponse.json({ 
      success: true, 
      token: sessionToken,
      email: normalizedEmail
    });
  } catch (error: any) {
    console.error('Portal OTP verify error:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
