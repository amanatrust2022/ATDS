/**
 * The transactional sender identity. This is the SaaS operator's verified
 * Brevo address, not any one clinic's — a clinic's own name goes in the body
 * of each message. It used to be a literal, which meant every tenant's mail
 * left under one particular clinic's name.
 */
const MAIL_SENDER = {
  name: process.env['MAIL_FROM_NAME'] || 'DiagnosticOS',
  email: process.env['MAIL_FROM_ADDRESS'] || 'no-reply@diagnosticos.app',
};

interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  attachment?: {
    name: string;
    content: string; // base64
    type: string;
  };
}

export async function sendEmail(opts: EmailOptions) {
  return sendEmailWithAttachment(opts);
}

export async function sendEmailWithAttachment({ to, subject, htmlContent, attachment }: EmailOptions) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');

  const body: Record<string, any> = {
    sender: MAIL_SENDER,
    to: [{ email: to }],
    subject,
    htmlContent,
  };

  if (attachment) {
    body.attachment = [
      {
        name: attachment.name,
        content: attachment.content, // Brevo expects base64
      }
    ];
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errMsg = 'Failed to send email';
    try {
      const error = await response.json();
      errMsg = error.message || error.message || errMsg;
    } catch (_) {
      try {
        errMsg = await response.text();
      } catch (_) {}
    }
    throw new Error(errMsg);
  }

  try {
    return await response.json();
  } catch (_) {
    return { success: true };
  }
}
