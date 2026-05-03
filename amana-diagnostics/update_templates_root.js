const fs = require('fs');

const path = 'c:/Users/HP g8/ATDS/reception-page.tsx';
let content = fs.readFileSync(path, 'utf8');

const newSlipTemplate = `
      <!DOCTYPE html><html><head><title>Patient Slip - \${patient.slipNumber}</title>
      <style>
        body { font-family: Times New Roman, sans-serif; margin: 0; padding: 20px; font-size: 11pt; color: #000; min-width: 750px; }
        .header { text-align: center; border-bottom: 2px solid #4472c4; padding-bottom: 12px; margin-bottom: 16px; margin-left: 0; margin-right: 0; padding-left: 0; padding-right: 0; }
        .org-name-1 { font-size: 40pt; white-space: nowrap; color: #0563c1; margin: 0; padding: 0; line-height: 1; }
        .org-name-2 { font-size: 26pt; white-space: nowrap; color: #0563c1; margin: 0; padding: 0; line-height: 1; }
        .org-addr { font-size: 14pt; color: #222a35; margin: 0; padding: 0; line-height: 1; }
        .org-contact { font-size: 14pt; color: #c00000; margin: 0; padding: 0; line-height: 1; }
        .org-email { font-size: 14pt; margin: 0; padding: 0; line-height: 1; padding-bottom: 12px; }
        .slip-title { font-size: 14pt; font-weight: bold; text-align: center; margin: 12px 0 16px; text-decoration: underline; text-transform: uppercase; }
        .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; font-size: 12pt; border: 1px solid #4472c4; padding: 12px; }
        .pi-label { font-weight: bold; margin-right: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #4472c4; color: white; padding: 6px 8px; text-align: left; font-size: 11pt; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11pt; }
        .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 9pt; color: #888; text-align: center; border-color: #4472c4; }
      </style></head><body>
      <div class="header">
        <div class="org-name-1">AMANA TRUST DIAGNOSTICS</div>
        <div class="org-name-2">AND CLINICAL SERVICES LIMITED</div>
        <div class="org-addr">No 15, C Tudun Wada Bus Stop, Nasarawa LGA, Kano State.</div>
        <div class="org-contact"><b>Phone;</b> +2348033390574, +2347032663898</div>
        <div class="org-email"><b>Email;</b> <span style="color:#0563c1">amanatrust2022@gmail.com</span></div>
      </div>
      <div class="slip-title">PATIENT INVESTIGATION REQUEST SLIP</div>
      <div class="patient-info">
        <div><span class="pi-label">Patient Name;</span> \${patient.name}</div>
        <div><span class="pi-label">Patient ID;</span> \${patient.slipNumber}</div>
        <div><span class="pi-label">Age;</span> \${patient.age}</div>
        <div><span class="pi-label">Sex;</span> \${patient.sex}</div>
        <div><span class="pi-label">Requested Date;</span> \${regDate.toLocaleDateString('en-NG')}</div>
        <div><span class="pi-label">Reporting Date;</span> —</div>
      </div>
      <div class="patient-info" style="grid-template-columns: 1fr;">
        <div><span class="pi-label">Investigation(s);</span> \${patient.tests.length} tests</div>
        <div><span class="pi-label">Specimen;</span> —</div>
      </div>
      <table><thead><tr><th>Test Name</th><th>Department</th></tr></thead><tbody>\${testRows}</tbody></table>
      <div class="footer">Please proceed to the respective department with this slip &bull; Amana Trust Diagnostics &copy; \${new Date().getFullYear()}</div>
      </body></html>\`;

const newResultTemplate = `
      <!DOCTYPE html><html><head><title>Result - \${patient.slipNumber}</title>
      <style>
        body { font-family: Times New Roman, sans-serif; margin: 0; padding: 20px; font-size: 11pt; color: #000; min-width: 750px; }
        .header { text-align: center; border-bottom: 2px solid #4472c4; padding-bottom: 4px; margin-bottom: 8px; margin-left: 0; margin-right: 0; padding-left: 0; padding-right: 0; }
        .org-name-1 { font-size: 40pt; white-space: nowrap; color: #0563c1; margin: 0; padding: 0; line-height: 1; }
        .org-name-2 { font-size: 26pt; white-space: nowrap; color: #0563c1; margin: 0; padding: 0; line-height: 1; }
        .org-addr { font-size: 14pt; color: #222a35; margin: 0; padding: 0; line-height: 1; }
        .org-contact { font-size: 14pt; color: #c00000; margin: 0; padding: 0; line-height: 1; }
        .org-email { font-size: 14pt; margin: 0; padding: 0; line-height: 1; padding-bottom: 12px; }
        .report-title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 5px 0 10px; color: #4472c4; text-decoration: underline; }
        .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; font-size: 12pt; border: 1px solid #4472c4; padding: 12px; }
        .pi-label { font-weight: bold; margin-right: 8px; }
        .test-block { margin-bottom: 18px; border: 1px solid #ddd; }
        .test-header { background: #4472c4; color: white; padding: 7px 12px; font-size: 11pt; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #4472c4; color: white; padding: 6px 8px; text-align: left; font-size: 11pt; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11pt; }
        .notes { padding: 6px 12px; font-size: 10pt; background: #fffbe6; border-top: 1px solid #eee; font-style: italic; }
        .sig-section { margin-top: 24px; display: flex; justify-content: flex-end; }
        .sig-box { text-align: center; width: 200px; }
        .sig-line { border-top: 1px solid #333; padding-top: 4px; font-size: 10pt; color: #333; }
      </style></head><body>
      <div class="header">
        <div class="org-name-1">AMANA TRUST DIAGNOSTICS</div>
        <div class="org-name-2">AND CLINICAL SERVICES LIMITED</div>
        <div class="org-addr">No 15, C Tudun Wada Bus Stop, Nasarawa LGA, Kano State.</div>
        <div class="org-contact"><b>Phone;</b> +2348033390574, +2347032663898</div>
        <div class="org-email"><b>Email;</b> <span style="color:#0563c1">amanatrust2022@gmail.com</span></div>
      </div>
      <div class="report-title">
        \${completedTests.every(t => t.department === 'lab') ? 'LABORATORY RESULT REPORT' : 
          completedTests.every(t => t.department === 'radiology') ? 'RADIOLOGY RESULT REPORT' : 
          'LABORATORY / RADIOLOGY RESULT REPORT'}
      </div>
      <div class="patient-info">
        <div><span class="pi-label">Patient Name;</span> \${patient.name}</div>
        <div><span class="pi-label">Patient ID;</span> \${patient.slipNumber}</div>
        <div><span class="pi-label">Age;</span> \${patient.age}</div>
        <div><span class="pi-label">Sex;</span> \${patient.sex}</div>
        <div><span class="pi-label">Requested Date;</span> \${new Date(patient.registeredAt).toLocaleDateString('en-NG')}</div>
        <div><span class="pi-label">Reporting Date;</span> \${completedTests[0]?.completedAt ? new Date(completedTests[0].completedAt).toLocaleDateString('en-NG') : '—'}</div>
        <div><span class="pi-label">Investigation(s);</span> \${completedTests.map(t => t.testName).join(', ')}</div>
        <div><span class="pi-label">Specimen;</span> \${completedTests[0]?.specimen || '—'}</div>
      </div>
      \${testSections}
      <div class="sig-section">
        <div class="sig-box">
          <div style="height:60px;"></div>
          <div class="sig-line">\${completedTests[0]?.completedBy || 'Authorised Professional'}</div>
          <div style="font-size:9pt; color:#333; margin-top:2px; font-weight:bold;">Signature & Stamp</div>
        </div>
      </div>
      <div style="text-align:center; margin-top:20px; font-weight:bold; text-transform:uppercase; font-size:10pt; color:#000;">
        *** END OF REPORT ***
      </div>
      </body></html>\`;

// Simple replacement for slip
content = content.replace(/<!DOCTYPE html><html><head><title>Patient Slip.*?<\/body><\/html>/s, newSlipTemplate.trim());

// Simple replacement for result
content = content.replace(/<!DOCTYPE html><html><head><title>Result - \${patient\.slipNumber}.*?<\/body><\/html>/s, newResultTemplate.trim());

fs.writeFileSync(path, content);
console.log('done for', path);
