/**
 * Server-side PDF generator for diagnostic reports using pdfmake.
 * This runs in a Node.js context (Next.js API route) only.
 */

import type { Patient, PatientTest } from './store';
import type { OrgForTemplate } from './templates';

/** Build the pdfmake document definition for a result report */
export function buildReportPdfDefinition(
  patient: Patient,
  completedTests: PatientTest[],
  org?: OrgForTemplate
) {
  const regDate = new Date(patient.registeredAt).toLocaleDateString('en-NG');
  const reportingDate = completedTests[0]?.completedAt
    ? new Date(completedTests[0].completedAt).toLocaleDateString('en-NG')
    : '—';
  const specimens = Array.from(new Set(completedTests.map(t => t.specimen))).filter(Boolean).join(', ') || '—';
  const investigationList = completedTests.map(t => t.testName).join(', ');

  const orgName = (org?.name || 'AMANA TRUST DIAGNOSTICS').toUpperCase();
  const orgLine2 = org?.letterhead_line2 ? org.letterhead_line2.toUpperCase() : 'AND CLINICAL SERVICES LIMITED';
  const orgAddress = org?.address || 'No 15, C Tudun Wada Bus Stop, Nasarawa LGA, Kano State.';
  const orgPhone = org?.phone || '+2348033390574, +2347032663898';
  const orgEmail = org?.email || 'amanatrust2022@gmail.com';

  const signatureUrl = completedTests[0]?.completedBySignatureUrl || null;

  const blue = '#0563c1';
  const reportTitle = completedTests.every(t => t.department === 'lab')
    ? 'LABORATORY RESULT REPORT'
    : completedTests.every(t => t.department === 'radiology')
    ? 'RADIOLOGY RESULT REPORT'
    : 'LABORATORY / RADIOLOGY RESULT REPORT';

  // Build test section content
  const testContent: any[] = [];
  for (const t of completedTests) {
    testContent.push({
      table: {
        widths: ['*'],
        body: [
          [{ text: t.testName, style: 'testHeader', fillColor: '#4472c4', color: 'white', bold: true }],
        ]
      },
      layout: 'noBorders',
      margin: [0, 8, 0, 0],
    });

    if (t.results && t.results.length > 0) {
      testContent.push({
        margin: [0, 0, 0, 0],
        table: {
          widths: ['*', 80, 60, 100],
          headerRows: 1,
          body: [
            [
              { text: 'Parameter', style: 'tableHeader', fillColor: '#4472c4', color: 'white' },
              { text: 'Result', style: 'tableHeader', fillColor: '#4472c4', color: 'white' },
              { text: 'Unit', style: 'tableHeader', fillColor: '#4472c4', color: 'white' },
              { text: 'Reference Range', style: 'tableHeader', fillColor: '#4472c4', color: 'white' },
            ],
            ...t.results.map(r => [
              { text: r.parameter, style: 'tableCell' },
              {
                text: `${r.result}${r.flag ? ` (${r.flag})` : ''}`,
                style: 'tableCell',
                bold: true,
                color: r.flag === 'H' ? '#c0392b' : r.flag === 'L' ? '#1a6aaf' : '#000',
              },
              { text: r.unit || '—', style: 'tableCell', color: '#555' },
              { text: r.range || '—', style: 'tableCell', color: '#555' },
            ])
          ]
        },
        layout: {
          hLineColor: () => '#eeeeee',
          vLineColor: () => '#eeeeee',
        },
      });
    }

    if (t.notes) {
      testContent.push({
        text: [{ text: 'Comment: ', bold: true }, t.notes],
        italics: true, fontSize: 9, margin: [0, 3, 0, 0],
        background: '#fffbe6', color: '#333',
      });
    }

    testContent.push({ text: '', margin: [0, 4, 0, 0] });
  }

  const docDef: any = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    content: [
      // ── Letterhead ──
      { text: orgName, style: 'orgName1', alignment: 'center' },
      { text: orgLine2, style: 'orgName2', alignment: 'center' },
      { text: orgAddress, style: 'orgAddr', alignment: 'center' },
      {
        columns: [
          { text: [{ text: 'Phone; ', bold: true }, orgPhone], style: 'orgContact', alignment: 'center', color: '#c00000' },
          { text: [{ text: 'Email; ', bold: true, color: '#000' }, { text: orgEmail, color: blue }], style: 'orgContact', alignment: 'center' },
        ],
        columnGap: 10,
        margin: [0, 2, 0, 8],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#4472c4' }], margin: [0, 0, 0, 8] },

      // ── Report Title ──
      { text: reportTitle, style: 'reportTitle', alignment: 'center' },

      // ── Patient info grid ──
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              [{ text: [{ text: 'Patient Name; ', bold: true }, patient.name] }],
              [{ text: [{ text: 'Patient ID; ', bold: true }, patient.slipNumber] }],
            ],
            [
              [{ text: [{ text: 'Age; ', bold: true }, patient.age] }],
              [{ text: [{ text: 'Sex; ', bold: true }, patient.sex] }],
            ],
            [
              [{ text: [{ text: 'Requested Date; ', bold: true }, regDate] }],
              [{ text: [{ text: 'Reporting Date; ', bold: true }, reportingDate] }],
            ],
            [
              [{ text: [{ text: 'Investigation(s); ', bold: true }, investigationList], colSpan: 2 }],
              {},
            ],
            [
              [{ text: [{ text: 'Specimen(s); ', bold: true }, specimens], colSpan: 2 }],
              {},
            ],
          ]
        },
        layout: {
          hLineColor: () => '#4472c4',
          vLineColor: () => '#4472c4',
          paddingLeft: () => 12,
          paddingRight: () => 12,
          paddingTop: () => 6,
          paddingBottom: () => 6,
          // Hide internal lines to match the HTML container-only border look
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0,
          vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
        },
        margin: [0, 0, 0, 12],
      },

      // ── Test Results ──
      ...testContent,

      // ── END OF REPORT ──
      {
        text: '*** END OF REPORT ***',
        alignment: 'center', bold: true, fontSize: 10,
        margin: [0, 12, 0, 20],
      },

      // ── Signature (right-aligned) ──
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 180,
            stack: [
              signatureUrl ? {
                image: signatureUrl,
                width: 120,
                alignment: 'center',
                margin: [0, 0, 0, 4]
              } : { text: '', margin: [0, 40, 0, 0] },
              {
                text: completedTests[0]?.completedBy || 'Authorised Professional',
                fontSize: 10,
                bold: true,
                alignment: 'center',
                border: [false, true, false, false],
                margin: [0, 4, 0, 0],
              },
            ]
          },
        ]
      },
    ],

    styles: {
      orgName1: { fontSize: 38, bold: true, color: blue, lineHeight: 1 },
      orgName2: { fontSize: 24, bold: true, color: blue, lineHeight: 1, margin: [0, 2, 0, 2] },
      orgAddr: { fontSize: 13, color: '#222a35', margin: [0, 2, 0, 2] },
      orgContact: { fontSize: 13 },
      reportTitle: { fontSize: 14, bold: true, color: '#4472c4', decoration: 'underline', margin: [0, 4, 0, 8] },
      testHeader: { fontSize: 11, bold: true, padding: [7, 7, 7, 7] },
      tableHeader: { fontSize: 11, bold: true, padding: [5, 5, 5, 5] },
      tableCell: { fontSize: 11, margin: [0, 3, 0, 3] },
    },
    defaultStyle: { font: 'Roboto', fontSize: 11 },
  };

  return docDef;
}
