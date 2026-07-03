import { NextResponse } from 'next/server';
import { sendEmailWithAttachment } from '@/lib/brevo';
import { getResultTemplate } from '@/lib/templates';
import { verifyToken } from '@/lib/portalAuth';
import { getPatientByIdAndEmail, getCompletedTestsByPatientId, getOrganizationById } from '@/lib/portalDb';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execPromise = util.promisify(exec);

function mapDbPatientToStorePatient(p: any) {
  return {
    id: p.id,
    slipNumber: p.slip_number,
    registeredAt: p.registered_at,
    name: [p.first_name, p.middle_name, p.surname].filter(Boolean).join(' '),
    firstName: p.first_name,
    surname: p.surname,
    middleName: p.middle_name,
    age: p.age,
    sex: p.sex,
    phone: p.phone,
    email: p.email,
    address: p.address,
    referredBy: p.referred_by,
  };
}

function mapDbTestToStoreTest(t: any) {
  let results = t.results;
  if (typeof results === 'string') {
    try { results = JSON.parse(results); } catch { results = []; }
  }
  return {
    id: t.id,
    patient_id: t.patient_id,
    testId: t.test_id,
    testName: t.test_name,
    department: t.department,
    status: t.status,
    specimen: t.specimen,
    results: results || [],
    completedBy: t.completed_by,
    completedBySignatureUrl: t.completed_by_signature_url,
    completedByTitle: t.completed_by_title,
    completedAt: t.completed_at,
    notes: t.notes,
    price: t.price,
  };
}

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
  return 'chrome';
}

async function htmlToPdfBase64(htmlContent: string): Promise<string> {
  const chromePath = getChromePath();
  const tempDir = os.tmpdir();
  const uuid = Math.random().toString(36).substring(7);
  const tempHtmlPath = path.join(tempDir, `portal-${uuid}.html`);
  const tempPdfPath = path.join(tempDir, `portal-${uuid}.pdf`);

  await fs.promises.writeFile(tempHtmlPath, htmlContent, 'utf8');

  try {
    const cmd = `"${chromePath}" --headless=new --no-sandbox --no-pdf-header-footer --print-to-pdf="${tempPdfPath}" "file:///${tempHtmlPath.replace(/\\/g, '/')}"`;
    await execPromise(cmd);
    const pdfBuffer = await fs.promises.readFile(tempPdfPath);
    return pdfBuffer.toString('base64');
  } finally {
    try {
      if (fs.existsSync(tempHtmlPath)) await fs.promises.unlink(tempHtmlPath);
      if (fs.existsSync(tempPdfPath)) await fs.promises.unlink(tempPdfPath);
    } catch {}
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const { patientId } = await request.json();

    // Verify ownership using the hybrid DB helper
    const patient = await getPatientByIdAndEmail(patientId, session.email);

    if (!patient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const tests = await getCompletedTestsByPatientId(patientId);

    if (!tests || tests.length === 0) {
      return NextResponse.json({ error: 'No completed results to send' }, { status: 400 });
    }

    const org = patient.organization_id
      ? await getOrganizationById(patient.organization_id)
      : null;

    const storePatient = mapDbPatientToStorePatient(patient);
    const storeTests = tests.map(mapDbTestToStoreTest);

    const htmlContent = getResultTemplate(storePatient as any, storeTests as any, org as any);
    const pdfBase64 = await htmlToPdfBase64(htmlContent);

    const fileName = `DiagnosticReport-${patient.slip_number}-${storePatient.name.replace(/\s+/g, '_')}.pdf`;
    const orgName = org?.name || 'Amana Trust Diagnostics';

    await sendEmailWithAttachment({
      to: session.email,
      subject: `Your Diagnostic Report — ${storePatient.name} (${patient.slip_number})`,
      htmlContent: `
        <div style="font-family: 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto; color: #000000; line-height: 1.6;">
          <div style="background: #0563c1; padding: 28px 24px; text-align: center; border: 1px solid #0563c1;">
            <h1 style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">DIAGNOSTIC REPORT</h1>
            <p style="font-family: 'Times New Roman', Times, serif; color: #ffffff; margin: 6px 0 0; font-size: 14px; font-weight: bold; text-transform: uppercase;">${orgName}</p>
          </div>
          <div style="padding: 32px 24px; border: 1px solid #0563c1; border-top: none; background: #ffffff;">
            <p style="margin: 0 0 16px; font-size: 16px; color: #000000;">Dear <strong>${storePatient.name}</strong>,</p>
            <p style="margin: 0 0 20px; font-size: 15px; color: #000000; line-height: 1.6;">As requested via the Patient Portal, please find your diagnostic report attached as a PDF.</p>
            <div style="background: #f0f5ff; border: 1px solid #0563c1; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 15px; font-family: 'Times New Roman', Times, serif;">
                <tr><td style="padding: 6px 0; color: #000; font-weight: bold; width: 35%;">Patient ID:</td><td style="padding: 6px 0; font-weight: bold; color: #0563c1;">${patient.slip_number}</td></tr>
                <tr><td style="padding: 6px 0; color: #000; font-weight: bold;">Tests:</td><td style="padding: 6px 0; color: #0563c1;">${storeTests.map((t: any) => t.testName).join(', ')}</td></tr>
              </table>
            </div>
            <p style="margin: 0 0 12px; font-size: 15px; color: #000000;">If you have any questions, please contact us at the clinic.</p>
            <p style="margin: 0; font-size: 15px; color: #000000;">Thank you for choosing <strong>${orgName}</strong>.</p>
          </div>
          <div style="padding: 16px; text-align: center; font-size: 12px; color: #333; border: 1px solid #ddd; border-top: none;">
            &copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.
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
    console.error('Portal email result error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
