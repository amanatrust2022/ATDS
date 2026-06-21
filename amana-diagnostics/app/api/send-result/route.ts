import { NextResponse } from 'next/server';
import { sendEmailWithAttachment } from '@/lib/brevo';
import { buildReportPdfDefinition } from '@/lib/pdf-report';
import path from 'path';
import { getResultTemplate } from '@/lib/templates';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import os from 'os';

const execPromise = util.promisify(exec);

function getChromePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  if (process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  if (process.env.USERPROFILE) {
    paths.push(path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return 'chrome'; // Fallback to path
}

async function fetchImageAsBase64(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url; // Already base64
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error(`Failed to convert image to base64 for URL ${url}:`, e);
    return url; // Fallback to original URL
  }
}

async function convertHtmlToPdfUsingChrome(htmlContent: string): Promise<Buffer> {
  const chromePath = getChromePath();
  const tempDir = os.tmpdir();
  const uuid = Math.random().toString(36).substring(7);
  const tempHtmlPath = path.join(tempDir, `report-${uuid}.html`);
  const tempPdfPath = path.join(tempDir, `report-${uuid}.pdf`);

  // Write HTML file
  await fs.promises.writeFile(tempHtmlPath, htmlContent, 'utf8');

  try {
    // Run chrome to print to PDF
    const cmd = `"${chromePath}" --headless=new --no-sandbox --no-pdf-header-footer --print-to-pdf="${tempPdfPath}" "file:///${tempHtmlPath.replace(/\\/g, '/')}"`;
    await execPromise(cmd);

    // Read PDF file
    const pdfBuffer = await fs.promises.readFile(tempPdfPath);
    return pdfBuffer;
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(tempHtmlPath)) await fs.promises.unlink(tempHtmlPath);
      if (fs.existsSync(tempPdfPath)) await fs.promises.unlink(tempPdfPath);
    } catch (e) {
      console.error('Failed to clean up temp files:', e);
    }
  }
}

export async function POST(request: Request) {
  try {
    const { patient, completedTests, org, pdfBase64: clientPdfBase64 } = await request.json();

    if (!patient.email) {
      return NextResponse.json({ error: 'Patient email is missing' }, { status: 400 });
    }

    let pdfBase64 = clientPdfBase64;
    const fileName = `DiagnosticReport-${patient.slipNumber}-${patient.name.replace(/\s+/g, '_')}.pdf`;

    if (!pdfBase64) {
      try {
        // Convert all images (signature and radiology scans) to Base64 to ensure headless Chrome renders them instantly
        const processedTests = await Promise.all(
          completedTests.map(async (t: any) => {
            const updatedTest = { ...t };
            if (updatedTest.completedBySignatureUrl) {
              updatedTest.completedBySignatureUrl = await fetchImageAsBase64(updatedTest.completedBySignatureUrl);
            }
            if (updatedTest.department === 'radiology' && updatedTest.results) {
              const updatedResults = await Promise.all(
                updatedTest.results.map(async (r: any) => {
                  if (r.parameter === 'Radiology: Images') {
                    try {
                      const images: string[] = JSON.parse(r.result);
                      const base64Images = await Promise.all(images.map(img => fetchImageAsBase64(img)));
                      return { ...r, result: JSON.stringify(base64Images) };
                    } catch (e) {
                      // Fallback if not JSON
                      if (r.result) {
                        const images = r.result.split(',');
                        const base64Images = await Promise.all(images.map((img: string) => fetchImageAsBase64(img.trim())));
                        return { ...r, result: base64Images.join(',') };
                      }
                    }
                  }
                  return r;
                })
              );
              updatedTest.results = updatedResults;
            }
            return updatedTest;
          })
        );

        const htmlContent = getResultTemplate(patient, processedTests, org);
        const pdfBuffer = await convertHtmlToPdfUsingChrome(htmlContent);
        pdfBase64 = pdfBuffer.toString('base64');
      } catch (chromeError) {
        console.error('Chrome PDF generation failed, falling back to pdfmake:', chromeError);

        // ── PDF Generation Fallback ──
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
        pdfBase64 = await pdfDoc.getBase64();
      }
    }

    await sendEmailWithAttachment({
      to: patient.email,
      subject: `Diagnostic Report — ${patient.name} (${patient.slipNumber})`,
      htmlContent: `
        <div style="font-family: 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto; color: #000000; line-height: 1.6;">
          <div style="background: #0563c1; padding: 28px 24px; border-radius: 0px !important; text-align: center; border: 1px solid #0563c1;">
            <h1 style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">DIAGNOSTIC REPORT</h1>
            <p style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 8px 0 0; font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${org?.name || 'Amana Trust Diagnostics'}</p>
          </div>
          <div style="padding: 32px 24px; border: 1px solid #0563c1; border-top: none; border-radius: 0px !important; background: #ffffff;">
            <p style="font-family: 'Times New Roman', Times, serif; margin: 0 0 16px; font-size: 16px; color: #000000;">Dear <strong>${patient.name}</strong>,</p>
            <p style="font-family: 'Times New Roman', Times, serif; margin: 0 0 20px; font-size: 15px; color: #000000; line-height: 1.6;">Your diagnostic report for the tests conducted at our facility is now ready. Please find the official document attached to this email as a PDF.</p>
            
            <div style="background: #f8fafc; border: 1px solid #0563c1; border-radius: 0px !important; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 15px; font-family: 'Times New Roman', Times, serif;">
                <tr style="border-radius: 0px !important;"><td style="padding: 6px 0; color: #000000; width: 35%; font-weight: bold; font-family: 'Times New Roman', Times, serif; border-radius: 0px !important;">Patient ID:</td><td style="padding: 6px 0; font-weight: bold; color: #0563c1; font-family: 'Times New Roman', Times, serif; border-radius: 0px !important;">${patient.slipNumber}</td></tr>
                <tr style="border-radius: 0px !important;"><td style="padding: 6px 0; color: #000000; font-weight: bold; font-family: 'Times New Roman', Times, serif; border-radius: 0px !important;">Date:</td><td style="padding: 6px 0; font-weight: bold; color: #000000; font-family: 'Times New Roman', Times, serif; border-radius: 0px !important;">${new Date().toLocaleDateString('en-NG')}</td></tr>
                <tr style="border-radius: 0px !important;"><td style="padding: 6px 0; vertical-align: top; color: #000000; font-weight: bold; font-family: 'Times New Roman', Times, serif; border-radius: 0px !important;">Tests:</td><td style="padding: 6px 0; font-weight: bold; color: #0563c1; font-family: 'Times New Roman', Times, serif; border-radius: 0px !important;">${completedTests.map((t: any) => t.testName).join(', ')}</td></tr>
              </table>
            </div>
            
            <p style="font-family: 'Times New Roman', Times, serif; margin: 0 0 12px; font-size: 15px; color: #000000;">If you have any questions regarding your results, please do not hesitate to contact us.</p>
            <p style="font-family: 'Times New Roman', Times, serif; margin: 0; font-size: 15px; color: #000000;">Thank you for choosing <strong>${org?.name || 'Amana Trust Diagnostics'}</strong>.</p>
          </div>
          <div style="padding: 20px; text-align: center; font-size: 12px; color: #333333; font-family: 'Times New Roman', Times, serif;">
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
