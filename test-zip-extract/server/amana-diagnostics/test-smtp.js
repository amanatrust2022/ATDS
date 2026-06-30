const nodemailer = require('nodemailer');

async function testSMTP() {
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: 'amanatrust2022@gmail.com',
      pass: 'xsmtpsib-81f21e76060e1ad9b1fe900bd2934d18dc39b14c7b3c7ed9ad82cfd2a7a7dedd-deUyMAjCqrYPkEcX'
    }
  });

  try {
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP Connection successful! Credentials are correct and active.');
  } catch (error) {
    console.error('❌ SMTP Connection failed:');
    console.error(error);
  }
}

testSMTP();
