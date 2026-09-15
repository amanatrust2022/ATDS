/**
 * Server-side PDF generator for diagnostic reports using pdfmake.
 * This runs in a Node.js context (Next.js API route) only.
 */

import type { Patient, PatientTest } from './store';
import { flagColour, type OrgForTemplate } from './templates';
import { deserializeRadiologyResults, stripImpressionHeading } from './radiology-templates';
import { SUPPORT_EMAIL, FALLBACK_ORG_NAME } from '@/lib/branding';
import { letterheadFor } from './letterhead';
import { scriptsToPdfRuns, markScriptsInHtml } from './scriptNotation';
import { isFbcTest, normaliseLabRows, usesSimpleResultTable } from './store/labResults';

/** A pdfmake text value with "x10^9/L", "mm3", "CO2", "Ca2+" as real sub- and superscripts. */
const sci = (v: unknown) => scriptsToPdfRuns(v == null ? '' : String(v));
const PDF_BOTTOM_MARGIN = 5 * 72 / 25.4; // pdfmake uses points; this is exactly 5mm.

function parseHtmlToPdfmake(html: string): any[] {
  if (!html) return [];
  
  // Split into tokens: tags and plain text
  const tagRegex = /(<\/?[a-zA-Z0-9]+(?:\s+[^>]*)?>)/g;
  // Flat "CO2" and "x10^9" in the text become <sub>/<sup> first, so the
  // PDF shows what the paper does.
  const tokens = markScriptsInHtml(html).split(tagRegex);
  
  const paragraphs: any[] = [];
  let currentParagraph: any[] = [];
  
  let bold = false;
  let underline = false;
  let sup = false;
  let sub = false;
  
  for (const token of tokens) {
    if (!token) continue;
    
    if (token.startsWith('<')) {
      const lower = token.toLowerCase();
      if (lower.startsWith('<p') || lower.startsWith('</p>')) {
        if (currentParagraph.length > 0) {
          paragraphs.push({ text: currentParagraph, margin: [0, 2, 0, 4], leading: 1.4 });
          currentParagraph = [];
        }
      } else if (lower.startsWith('<br')) {
        currentParagraph.push({ text: '\n' });
      } else if (lower === '<b>' || lower === '<strong>') {
        bold = true;
      } else if (lower === '</b>' || lower === '</strong>') {
        bold = false;
      } else if (lower === '<u>') {
        underline = true;
      } else if (lower === '</u>') {
        underline = false;
      } else if (lower === '<sup>') {
        sup = true;
      } else if (lower === '</sup>') {
        sup = false;
      } else if (lower === '<sub>') {
        sub = true;
      } else if (lower === '</sub>') {
        sub = false;
      }
    } else {
      const text = token
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      
      const styles: any = { text };
      if (bold) styles.bold = true;
      if (underline) styles.decoration = 'underline';
      if (sup) styles.sup = true;
      if (sub) styles.sub = true;
      currentParagraph.push(styles);
    }
  }
  
  if (currentParagraph.length > 0) {
    paragraphs.push({ text: currentParagraph, margin: [0, 2, 0, 4], leading: 1.4 });
  }
  
  return paragraphs;
}

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

  // See lib/letterhead.ts: an unfilled field prints as nothing, never as
  // another clinic's address.
  const head = letterheadFor(org);
  const orgName = head.name.toUpperCase();
  const orgLine2 = head.line2.toUpperCase();
  const orgAddress = head.address;
  const orgPhone = head.phone;
  const orgEmail = head.email || SUPPORT_EMAIL;

  const signatureUrl = completedTests[0]?.completedBySignatureUrl || null;

  const blue = '#486b8f';
  const reportTitle = completedTests.every(t => t.department === 'lab')
    ? 'LABORATORY RESULT REPORT'
    : completedTests.every(t => t.department === 'radiology')
    ? 'RADIOLOGY RESULT REPORT'
    : 'LABORATORY / RADIOLOGY RESULT REPORT';

  // Build test section content
  const testContent: any[] = [];
  for (const t of completedTests) {
    const reportResults = normaliseLabRows(t.testId, t.testName, t.results || []);
    const simpleResults = usesSimpleResultTable(t.testId, t.testName, reportResults);
    const compactFbc = isFbcTest(t.testId, t.testName);
    testContent.push({
      table: {
        widths: ['*'],
        body: [
          [{ text: t.testName, style: compactFbc ? 'compactTestHeader' : 'testHeader', fillColor: blue, color: 'white', bold: true }],
        ]
      },
      layout: 'noBorders',
      margin: [0, compactFbc ? 4 : 8, 0, 0],
    });

    const isWidal = t.testId.toLowerCase() === 'widal' || t.testId.toLowerCase().includes('widal') || t.testName.toLowerCase().includes('widal');
    const isMps = t.testId.toLowerCase() === 'mps' || t.testId.toLowerCase() === 'mp' || t.testId.toLowerCase().includes('mps') || t.testId.toLowerCase().startsWith('mp_') || t.testId.toLowerCase().includes('_mp') || t.testName.toLowerCase().includes('mps') || t.testName.toLowerCase().includes('mp ') || t.testName.toLowerCase().includes('mp+') || t.testName.toLowerCase().includes('mp +') || t.testName.toLowerCase().includes('malaria parasite') || t.testName.toLowerCase().includes('malaria film') || t.testName.toLowerCase().includes('malaria');

    const isMcs = !isWidal && !isMps && (t.testId.toLowerCase().endsWith('_mcs') || t.testId.toLowerCase().includes('mcs') || t.testId.toLowerCase() === 'sfmcs' || t.testName.toLowerCase().includes('mcs') || t.testName.toLowerCase().includes('culture & sensitivity') || t.testName.toLowerCase().includes('culture and sensitivity'));

    const isFreeText = !isWidal && !isMps && (t.department === 'radiology' || (t.results || []).some(r => r.parameter === 'Radiology: Findings'));

    if (isWidal || isMps) {
      const stackElements: any[] = [];
      if (isMps) {
        let parasiteSeen = 'Not Seen';
        let densityPlus = 'Nil';
        let densityCount = 'Nil';
        let species = 'Nil';
        let stage = 'Nil';
        let comment = 'Nil';

        reportResults.forEach(r => {
          const param = r.parameter;
          const val = r.result;
          if (param === 'MPs: Parasites') parasiteSeen = val || 'Not Seen';
          if (param === 'MPs: Density (Plus)') densityPlus = val || 'Nil';
          if (param === 'MPs: Density (Count)') densityCount = val || 'Nil';
          if (param === 'MPs: Species') species = val || 'Nil';
          if (param === 'MPs: Stage') stage = val || 'Nil';
          if (param === 'MPs: Comment') comment = val || 'Nil';
        });

        const mpsTableBody: any[] = [
          [
            { text: 'Malaria Parasite:', bold: true, fontSize: 10 },
            { text: parasiteSeen.toUpperCase(), fontSize: 10, bold: parasiteSeen === 'Seen', color: parasiteSeen === 'Seen' ? '#c0392b' : '#000000' }
          ],
          [
            { text: 'Density (Plus System):', bold: true, fontSize: 10 },
            { text: densityPlus, fontSize: 10, bold: densityPlus !== 'Nil', color: densityPlus !== 'Nil' ? '#c0392b' : '#000000' }
          ],
          [
            { text: 'Quantitative Count:', bold: true, fontSize: 10 },
            { text: densityCount, fontSize: 10 }
          ]
        ];

        if (parasiteSeen === 'Seen') {
          mpsTableBody.push(
            [
              { text: 'Species Isolated:', bold: true, fontSize: 10 },
              { text: species, fontSize: 10, fontStyle: 'italic' }
            ],
            [
              { text: 'Parasite Stage:', bold: true, fontSize: 10 },
              { text: stage, fontSize: 10 }
            ]
          );
        }

        mpsTableBody.push([
          { text: 'Blood Film / Comments:', bold: true, fontSize: 10 },
          { text: comment, fontSize: 10 }
        ]);

        stackElements.push(
          { text: 'MALARIA PARASITE MICROSCOPY REPORT', bold: true, fontSize: 10, color: blue, margin: [0, 6, 0, 4] },
          {
            table: {
              widths: ['40%', '60%'],
              body: mpsTableBody
            },
            layout: {
              hLineColor: () => '#eeeeee',
              vLineColor: () => '#eeeeee',
              hLineWidth: () => 1,
              vLineWidth: () => 1
            },
            margin: [0, 0, 0, isWidal ? 12 : 0]
          }
        );
      }

      if (isWidal) {
        let typhiO = 'Negative';
        let typhiH = 'Negative';
        let paratyphiAO = 'Negative';
        let paratyphiAH = 'Negative';
        let paratyphiBO = 'Negative';
        let paratyphiBH = 'Negative';
        let paratyphiCO = 'Negative';
        let paratyphiCH = 'Negative';

        reportResults.forEach(r => {
          const param = r.parameter;
          const val = r.result;
          if (param === 'Widal: S. Typhi O') typhiO = val || 'Negative';
          if (param === 'Widal: S. Typhi H') typhiH = val || 'Negative';
          if (param === 'Widal: S. Paratyphi A O') paratyphiAO = val || 'Negative';
          if (param === 'Widal: S. Paratyphi A H') paratyphiAH = val || 'Negative';
          if (param === 'Widal: S. Paratyphi B O') paratyphiBO = val || 'Negative';
          if (param === 'Widal: S. Paratyphi B H') paratyphiBH = val || 'Negative';
          if (param === 'Widal: S. Paratyphi C O') paratyphiCO = val || 'Negative';
          if (param === 'Widal: S. Paratyphi C H') paratyphiCH = val || 'Negative';
        });

        const antigenRow = (antigenName: string, oVal: string, hVal: string) => {
          const isOAlt = oVal !== 'Negative' && oVal !== '1:20' && oVal !== '1:40';
          const isHAlt = hVal !== 'Negative' && hVal !== '1:20' && hVal !== '1:40';
          return [
            { text: antigenName, bold: true, fontSize: 10, margin: [0, 3, 0, 3] },
            {
              text: oVal,
              alignment: 'center',
              fontSize: 10,
              bold: isOAlt,
              color: isOAlt ? '#c0392b' : '#000000',
              margin: [0, 3, 0, 3]
            },
            {
              text: hVal,
              alignment: 'center',
              fontSize: 10,
              bold: isHAlt,
              color: isHAlt ? '#c0392b' : '#000000',
              margin: [0, 3, 0, 3]
            }
          ];
        };

        stackElements.push(
          { text: 'WIDAL AGGLUTINATION REACTION TITRES', bold: true, fontSize: 10, color: blue, margin: [0, 6, 0, 4] },
          {
            table: {
              widths: ['*', 160, 160],
              headerRows: 1,
              body: [
                [
                  { text: 'Antigen', bold: true, fontSize: 10, color: blue, fillColor: '#f2f2f2' },
                  { text: 'O Titre', bold: true, fontSize: 10, color: blue, alignment: 'center', fillColor: '#f2f2f2' },
                  { text: 'H Titre', bold: true, fontSize: 10, color: blue, alignment: 'center', fillColor: '#f2f2f2' }
                ],
                antigenRow('S. Typhi', typhiO, typhiH),
                antigenRow('S. Paratyphi A', paratyphiAO, paratyphiAH),
                antigenRow('S. Paratyphi B', paratyphiBO, paratyphiBH),
                antigenRow('S. Paratyphi C', paratyphiCO, paratyphiCH)
              ]
            },
            layout: {
              hLineColor: () => '#dddddd',
              vLineColor: () => '#dddddd',
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              hLineStyle: () => ({ dash: { length: 2, space: 2 } }),
              vLineStyle: () => ({ dash: { length: 2, space: 2 } })
            }
          }
        );
      }

      const extraResults = reportResults.filter(r =>
        !r.parameter.startsWith('Widal:') && !r.parameter.startsWith('MPs:')
      );
      if (extraResults.length > 0) {
        const extraSimple = usesSimpleResultTable(t.testId, t.testName, extraResults);
        stackElements.push(
          { text: 'ADDITIONAL PARAMETERS', bold: true, fontSize: 10, color: blue, margin: [0, 8, 0, 4] },
          {
            table: {
              widths: extraSimple ? ['*', 140] : ['*', 80, 60, 100],
              headerRows: 1,
              body: [
                [
                  { text: extraSimple ? 'Investigation' : 'Parameter', style: 'tableHeader', fillColor: blue, color: 'white' },
                  { text: 'Result', style: 'tableHeader', fillColor: blue, color: 'white' },
                  ...(!extraSimple ? [
                    { text: 'Unit', style: 'tableHeader', fillColor: blue, color: 'white' },
                    { text: 'Reference Range', style: 'tableHeader', fillColor: blue, color: 'white' },
                  ] : []),
                ],
                ...extraResults.map(r => [
                  { text: sci(r.parameter), style: 'tableCell' },
                  {
                    text: sci(`${r.result}${r.flag ? ` (${r.flag})` : ''}`),
                    style: 'tableCell',
                    bold: true,
                    color: flagColour(r.flag),
                  },
                  ...(!extraSimple ? [
                    { text: sci(r.unit || '—'), style: 'tableCell', color: '#555' },
                    { text: sci(r.range || '—'), style: 'tableCell', color: '#555' },
                  ] : []),
                ])
              ]
            },
            layout: {
              hLineColor: () => '#eeeeee',
              vLineColor: () => '#eeeeee',
            },
            margin: [0, 0, 0, 8]
          }
        );
      }

      if (t.notes) {
        stackElements.push({
          text: [
            { text: 'Comment: ', bold: true, fontSize: 9 },
            { text: sci(t.notes), fontSize: 9 }
          ],
          margin: [0, 6, 0, 0]
        });
      }

      testContent.push({
        unbreakable: true,
        stack: stackElements,
        margin: [0, 0, 0, 10]
      });
    } else if (isFreeText) {
      const radData = deserializeRadiologyResults(t.results || []);
      
      if (radData.findings) {
        testContent.push({
          stack: parseHtmlToPdfmake(radData.findings),
          margin: [0, 8, 0, 8]
        });
      }
      
      if (radData.impression) {
        testContent.push({
          margin: [0, 8, 0, 8],
          table: {
            widths: ['*'],
            body: [
              [{
                stack: [
                  { text: 'IMPRESSION / CONCLUSION:', bold: true, color: blue, fontSize: 10, margin: [0, 0, 0, 4] },
                  // The section already says the word; the stored text must not
                  // say it again directly underneath. See stripImpressionHeading.
                  ...parseHtmlToPdfmake(stripImpressionHeading(radData.impression))
                ],
                margin: [8, 8, 8, 8],
              }]
            ]
          },
          layout: {
            hLineColor: () => blue,
            vLineColor: () => blue,
            hLineWidth: (i: number) => 0,
            vLineWidth: (i: number) => i === 0 ? 3 : 0,
          }
        });
      }

      if (radData.images && radData.images.length > 0) {
        const imagesRow: any[] = [];
        for (const img of radData.images) {
          if (img.startsWith('data:image/') || img.startsWith('http')) {
            try {
              imagesRow.push({
                stack: [
                  { image: img, fit: [200, 150], alignment: 'center' },
                  { text: img.split('/').pop()?.replace(/_/g, ' ') || 'Scan Image', fontSize: 8, color: '#555', margin: [0, 4, 0, 0], alignment: 'center' }
                ],
                margin: [5, 5, 5, 5]
              });
            } catch (err) {
              console.error('Failed to include scan image in PDF:', err);
            }
          }
        }
        
        if (imagesRow.length > 0) {
          testContent.push({ text: 'ATTACHED IMAGERY', bold: true, fontSize: 10, color: blue, margin: [0, 12, 0, 6] });
          const columnsGroup: any[] = [];
          for (let i = 0; i < imagesRow.length; i += 2) {
            const cols = [imagesRow[i]];
            if (imagesRow[i + 1]) cols.push(imagesRow[i + 1]);
            columnsGroup.push({ columns: cols, columnGap: 10, margin: [0, 5, 0, 5] });
          }
          testContent.push(...columnsGroup);
        }
      }
    } else if (isMcs) {
      let colour = '—';
      let appearance = '—';
      const microscopyRows: any[] = [];
      let growth = '—';
      let organism = '—';
      let degree = '—';
      let gramReaction = '—';
      let shape = '—';
      let incubationPeriod = '—';
      let incubationTemperature = '—';

      const sensitiveList: string[] = [];
      const intermediateList: string[] = [];
      const resistantList: string[] = [];

      (t.results || []).forEach(r => {
        const param = r.parameter;
        const val = r.result;

        if (param.startsWith('Macroscopy: ')) {
          const field = param.replace('Macroscopy: ', '');
          if (field === 'Colour') colour = val || '—';
          if (field === 'Appearance') appearance = val || '—';
        } else if (param.startsWith('Microscopy: ')) {
          const pName = param.replace('Microscopy: ', '');
          microscopyRows.push([
            { text: `${pName}:`, bold: true, fontSize: 9 },
            { text: sci(val || 'Nil'), fontSize: 9 }
          ]);
        } else if (param.startsWith('Culture: ')) {
          const field = param.replace('Culture: ', '');
          if (field === 'Growth') growth = val || '—';
          if (field === 'Organism') organism = val || '—';
          if (field === 'Degree') degree = val || '—';
          if (field === 'Gram Reaction') gramReaction = val || '—';
          if (field === 'Shape') shape = val || '—';
          if (field === 'Incubation Period') incubationPeriod = val || '—';
          if (field === 'Incubation Temperature') incubationTemperature = val || '—';
        } else if (param.startsWith('Sensitivity: ')) {
          const match = param.match(/Sensitivity:\s+(.+)\s+\((.+)\)/);
          if (match) {
            const antibioticText = `${match[1]} (${match[2]})`;
            if (val === 'S') sensitiveList.push(antibioticText);
            else if (val === 'I') intermediateList.push(antibioticText);
            else if (val === 'R') resistantList.push(antibioticText);
          }
        }
      });

      const isNoGrowth = ['no growth', 'sterile', 'no-growth'].includes(growth.trim().toLowerCase());

      const maxRows = Math.max(sensitiveList.length, intermediateList.length, resistantList.length);
      const sensitivityBody: any[] = [
        [
          { text: 'SENSITIVE (S)', bold: true, color: '#1e7e5a', fontSize: 9, fillColor: '#f2f2f2' },
          { text: 'INTERMEDIATE (I)', bold: true, color: '#d4850a', fontSize: 9, fillColor: '#f2f2f2' },
          { text: 'RESISTANT (R)', bold: true, color: '#c0392b', fontSize: 9, fillColor: '#f2f2f2' }
        ]
      ];
      for (let i = 0; i < maxRows; i++) {
        sensitivityBody.push([
          { text: sensitiveList[i] || '', color: '#1e7e5a', fontSize: 9 },
          { text: intermediateList[i] || '', color: '#d4850a', fontSize: 9 },
          { text: resistantList[i] || '', color: '#c0392b', fontSize: 9, bold: true }
        ]);
      }

      testContent.push({
        unbreakable: true,
        stack: [
          // Macroscopy & Microscopy
          {
            margin: [0, 4, 0, 0],
            table: {
              widths: ['*', '*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'MACROSCOPY', bold: true, fontSize: 9, color: blue, margin: [0, 0, 0, 4] },
                      {
                        table: {
                          widths: ['*', '*'],
                          body: [
                            [{ text: 'Colour:', bold: true, fontSize: 9 }, { text: colour, fontSize: 9 }],
                            [{ text: 'Appearance:', bold: true, fontSize: 9 }, { text: appearance, fontSize: 9 }]
                          ]
                        },
                        layout: 'noBorders'
                      }
                    ],
                    margin: [4, 4, 4, 4]
                  },
                  {
                    stack: [
                      { text: 'MICROSCOPY', bold: true, fontSize: 9, color: blue, margin: [0, 0, 0, 4] },
                      {
                        table: {
                          widths: ['*', '*'],
                          body: microscopyRows.length > 0 ? microscopyRows : [[{ text: 'No microscopy recorded', italics: true, color: '#888', colSpan: 2 }, {}]]
                        },
                        layout: 'noBorders'
                      }
                    ],
                    margin: [4, 4, 4, 4]
                  }
                ]
              ]
            },
            layout: {
              hLineColor: () => '#dddddd',
              vLineColor: () => '#dddddd',
              hLineWidth: () => 1,
              vLineWidth: () => 1
            }
          },
          
          // Culture findings
          {
            margin: [0, 6, 0, 0],
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'CULTURE FINDINGS', bold: true, fontSize: 9, color: blue, margin: [0, 0, 0, 4] },
                      {
                        table: {
                          widths: ['15%', '25%', '15%', '25%', '10%', '10%'],
                          body: [
                            [
                              { text: 'Growth:', bold: true, fontSize: 9 },
                              { text: growth, fontSize: 9 },
                              { text: !isNoGrowth ? 'Organism:' : '', bold: true, fontSize: 9 },
                              { text: !isNoGrowth ? organism : '', fontStyle: 'italic', fontSize: 9 },
                              { text: !isNoGrowth ? 'Degree:' : '', bold: true, fontSize: 9 },
                              { text: !isNoGrowth ? degree : '', fontSize: 9 }
                            ],
                            ...(!isNoGrowth ? [[
                              { text: 'Reaction:', bold: true, fontSize: 9 },
                              { text: `${gramReaction} (${shape})`, fontSize: 9, colSpan: 2 },
                              {},
                              { text: 'Incubation:', bold: true, fontSize: 9 },
                              { text: `${incubationPeriod} @ ${incubationTemperature}`, fontSize: 9, colSpan: 2 },
                              {}
                            ]] : [])
                          ]
                        },
                        layout: 'noBorders'
                      }
                    ],
                    margin: [4, 4, 4, 4]
                  }
                ]
              ]
            },
            layout: {
              hLineColor: () => '#dddddd',
              vLineColor: () => '#dddddd',
              hLineWidth: () => 1,
              vLineWidth: () => 1
            }
          },

          // Sensitivity Profile (AST)
          ...(!isNoGrowth ? [{
            margin: [0, 6, 0, 0],
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: 'ANTIBIOTIC SENSITIVITY PROFILE', bold: true, fontSize: 9, color: blue, margin: [0, 0, 0, 4] },
                      {
                        table: {
                          widths: ['33.3%', '33.3%', '33.3%'],
                          headerRows: 1,
                          body: sensitivityBody
                        },
                        layout: {
                          hLineColor: () => '#dddddd',
                          vLineColor: () => '#dddddd',
                          hLineWidth: () => 1,
                          vLineWidth: () => 1
                        }
                      }
                    ],
                    margin: [4, 4, 4, 4]
                  }
                ]
              ]
            },
            layout: {
              hLineColor: () => '#dddddd',
              vLineColor: () => '#dddddd',
              hLineWidth: () => 1,
              vLineWidth: () => 1
            }
          }] : [])
        ]
      });
    } else {
      if (reportResults.length > 0) {
        testContent.push({
          margin: [0, 0, 0, 0],
          table: {
            widths: simpleResults ? ['*', 140] : ['*', 80, 60, 100],
            headerRows: 1,
            body: [
              [
                { text: simpleResults ? 'Investigation' : 'Parameter', style: compactFbc ? 'compactTableHeader' : 'tableHeader', fillColor: blue, color: 'white' },
                { text: 'Result', style: compactFbc ? 'compactTableHeader' : 'tableHeader', fillColor: blue, color: 'white' },
                ...(!simpleResults ? [
                  { text: 'Unit', style: compactFbc ? 'compactTableHeader' : 'tableHeader', fillColor: blue, color: 'white' },
                  { text: 'Reference Range', style: compactFbc ? 'compactTableHeader' : 'tableHeader', fillColor: blue, color: 'white' },
                ] : []),
              ],
              ...reportResults.map(r => [
                { text: sci(r.parameter), style: compactFbc ? 'compactTableCell' : 'tableCell' },
                {
                  text: sci(`${r.result}${r.flag ? ` (${r.flag})` : ''}`),
                  style: compactFbc ? 'compactTableCell' : 'tableCell',
                  bold: true,
                  color: flagColour(r.flag),
                },
                ...(!simpleResults ? [
                  { text: sci(r.unit || '—'), style: compactFbc ? 'compactTableCell' : 'tableCell', color: '#555' },
                  { text: sci(r.range || '—'), style: compactFbc ? 'compactTableCell' : 'tableCell', color: '#555' },
                ] : []),
              ])
            ]
          },
          layout: {
            hLineColor: () => '#eeeeee',
            vLineColor: () => '#eeeeee',
          },
        });
      }
    }

    if (t.notes) {
      testContent.push({
        text: [{ text: 'Comment: ', bold: true }, t.notes],
        italics: true, fontSize: 9, margin: [0, 3, 0, 0],
        color: '#333',
      });
    }

    testContent.push({ text: '', margin: [0, 4, 0, 0] });
  }

  const docDef: any = {
    pageSize: 'A4',
    pageMargins: [40, 12, 40, PDF_BOTTOM_MARGIN],
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
        margin: [0, 2, 0, 5],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: blue }], margin: [0, 0, 0, 0] },

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
              [{ text: [
                { text: 'Age; ', bold: true }, patient.age,
                { text: '      ' },
                { text: 'Requested Date; ', bold: true }, regDate
              ] }],
              [{ text: [
                { text: 'Sex; ', bold: true }, patient.sex,
                { text: '      ' },
                { text: 'Reporting Date; ', bold: true }, reportingDate
              ] }],
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
          hLineColor: () => blue,
          vLineColor: () => blue,
          paddingLeft: () => 12,
          paddingRight: () => 12,
          paddingTop: () => 6,
          paddingBottom: () => 6,
          // Hide internal lines to match the HTML container-only border look
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0,
          vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
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
      reportTitle: { fontSize: 14, bold: true, color: blue, decoration: 'underline', margin: [0, 2.5, 0, 8] },
      testHeader: { fontSize: 11, bold: true, padding: [7, 7, 7, 7] },
      compactTestHeader: { fontSize: 10, bold: true, padding: [4, 4, 4, 4] },
      tableHeader: { fontSize: 11, bold: true, padding: [5, 5, 5, 5] },
      tableCell: { fontSize: 11, margin: [0, 3, 0, 3] },
      compactTableHeader: { fontSize: 9, bold: true, padding: [2, 2, 2, 2] },
      compactTableCell: { fontSize: 9, margin: [0, 1, 0, 1] },
    },
    defaultStyle: { font: 'Roboto', fontSize: 11 },
  };

  return docDef;
}
