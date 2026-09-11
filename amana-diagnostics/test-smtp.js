/**
 * Checks that the Brevo SMTP relay accepts our credentials.
 *
 * This file used to carry the username and the API key inline, in plaintext,
 * committed. The key has been in the repository's history since 099e7da, so
 * removing it here does not make it secret again — it must be rotated in the
 * Brevo dashboard, and anything that used it updated to the new value.
 *
 * Run with the credentials in the environment instead:
 *   SMTP_USER=... SMTP_PASS=... node test-smtp.js
 */
require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

const user = process.env.SMTP_USER || process.env.BREVO_SMTP_USER;
const pass = process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY;

async function testSMTP() {
  if (!user || !pass) {
    console.error('Set SMTP_USER and SMTP_PASS (or BREVO_SMTP_USER / BREVO_SMTP_KEY) first.');
    process.exitCode = 1;
    return;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: { user, pass },
  });

  try {
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP Connection successful! Credentials are correct and active.');
  } catch (error) {
    console.error('❌ SMTP Connection failed:');
    console.error(error);
    process.exitCode = 1;
  }
}

testSMTP();
