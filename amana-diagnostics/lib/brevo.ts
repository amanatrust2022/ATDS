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
    sender: { name: 'Amana Trust Diagnostics', email: 'amanatrust2022@gmail.com' },
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
    const error = await response.json();
    throw new Error(error.message || 'Failed to send email');
  }

  return response.json();
}
