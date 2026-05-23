import { NextResponse } from 'next/server';
import { sendEmailWithAttachment } from '@/lib/brevo';
import { buildReportPdfDefinition } from '@/lib/pdf-report';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { patient, completedTests, org } = await request.json();

    if (!patient.email) {
      return NextResponse.json({ error: 'Patient email is missing' }, { status: 400 });
    }

    // ── PDF Generation ──
    // Use the high-level pdfmake instance (preferred for 0.3+)
    const pdfMake = require('pdfmake');
    
    // Resolve font paths
    const fontDir = path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto');
    const fonts = {
      Roboto: {
        normal: path.join(fontDir, 'Roboto-Regular.ttf'),
        bold: path.join(fontDir, 'Roboto-Medium.ttf'),
        italics: path.join(fontDir, 'Roboto-Italic.ttf'),
        bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf')
      }
    };

    pdfMake.setFonts(fonts);
    const docDef = buildReportPdfDefinition(patient, completedTests, org);
    
    // High-level API handles async creation and buffer collection
    const pdfDoc = pdfMake.createPdf(docDef);
    const pdfBase64 = await pdfDoc.getBase64();

    const fileName = `DiagnosticReport-${patient.slipNumber}-${patient.name.replace(/\s+/g, '_')}.pdf`;

    await sendEmailWithAttachment({
      to: patient.email,
      subject: `Diagnostic Report — ${patient.name} (${patient.slipNumber})`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="background: #4472c4; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px; letter-spacing: 0.5px;">Diagnostic Report</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0; font-size: 14px;">${org?.name || 'Amana Trust Diagnostics'}</p>
          </div>
          <div style="padding: 32px 24px; border: 1px solid #e1e4e8; border-top: none; border-radius: 0 0 8px 8px; background: white;">
            <p style="margin: 0 0 16px; font-size: 16px;">Dear <strong>${patient.name}</strong>,</p>
            <p style="margin: 0 0 20px;">Your diagnostic report for the tests conducted at our facility is now ready. Please find the official document attached to this email as a PDF.</p>
            
            <div style="background: #f8fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 4px 0; color: #718096; width: 35%;">Patient ID:</td><td style="padding: 4px 0; font-weight: 600; color: #2d3748;">${patient.slipNumber}</td></tr>
                <tr><td style="padding: 4px 0; color: #718096;">Date:</td><td style="padding: 4px 0; font-weight: 600; color: #2d3748;">${new Date().toLocaleDateString('en-NG')}</td></tr>
                <tr><td style="padding: 4px 0; vertical-align: top; color: #718096;">Tests:</td><td style="padding: 4px 0; font-weight: 600; color: #2d3748;">${completedTests.map((t: any) => t.testName).join(', ')}</td></tr>
              </table>
            </div>
            
            <p style="margin: 0 0 8px; font-size: 14px;">If you have any questions regarding your results, please do not hesitate to contact us.</p>
            <p style="margin: 0; font-size: 14px;">Thank you for choosing <strong>${org?.name || 'Amana Trust Diagnostics'}</strong>.</p>
          </div>
          <div style="padding: 16px; text-align: center; font-size: 12px; color: #a0aec0;">
            &copy; ${new Date().getFullYear()} ${org?.name || 'Amana Trust Diagnostics'}. All rights reserved.
          </div>
        </div>
      `,
      attachment: {
        name: fileName,
        content: pdfBase64,
        type: 'application/pdf',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Result email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
