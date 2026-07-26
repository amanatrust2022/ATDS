const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../components/ReceptionPage.v2.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add QueueAndResultsTab import
const importStr = "import QueueAndResultsTab from './features/queue/QueueAndResultsTab';\n";
content = content.replace("import { useRegistrationStore } from '@/lib/store/useRegistrationStore';", "import { useRegistrationStore } from '@/lib/store/useRegistrationStore';\n" + importStr);

// 2. Remove old state hooks for queue (searchQ, deptFilter, dateFilter)
content = content.replace("const [searchQ, setSearchQ] = useState('');", "");
content = content.replace("const [deptFilter, setDeptFilter] = useState<'all' | 'lab' | 'radiology'>('all');", "");
content = content.replace("const [dateFilter, setDateFilter] = useState<'today' | 'seven_days' | 'thirty_days'>('today');", "");

// 3. Find the old helper functions and calculate counts directly
const helpersStart = content.indexOf("const filterByDate");
const helpersEnd = content.indexOf("const validate = () => {");
if (helpersStart !== -1 && helpersEnd !== -1) {
  const replacement = `
  const newResultsCount = patients.filter(p => p.tests.some(t => t.status === 'completed')).length;
  const pendingCount = patients.filter(p => p.tests.some(t => t.status !== 'completed')).length;

  `;
  content = content.substring(0, helpersStart) + replacement + content.substring(helpersEnd);
}

// 3.5 Remove the old filtered variable
const filteredStart = content.indexOf("const filtered = (tab === 'queue' ? pendingPatients : resultsPatients).filter(p => {");
const filteredEnd = content.indexOf("return (", filteredStart);
if (filteredStart !== -1 && filteredEnd !== -1) {
  content = content.substring(0, filteredStart) + content.substring(filteredEnd);
}

// 3.6 Replace pendingPatients.length with pendingCount
content = content.replace("pendingPatients.length", "pendingCount");

// 4. Find boundaries of the Queue and Results UI block
const queueTabStart = content.indexOf("{/* ===== QUEUE TAB ===== */}");
const walletTabStart = content.indexOf("{tab === 'wallet' && (");

if (queueTabStart !== -1 && walletTabStart !== -1) {
  const replacement = `{/* ===== QUEUE TAB ===== */}
        {(tab === 'queue' || tab === 'results') && (
          <QueueAndResultsTab 
            patients={patients} 
            mode={tab as 'queue' | 'results'} 
            onViewSlip={(p) => setShowSlipModal(p)} 
            onViewResult={(p) => setShowResultModal(p)} 
          />
        )}

        `;
  content = content.substring(0, queueTabStart) + replacement + content.substring(walletTabStart);
}

// 5. Remove old PatientCard component since we extracted it
const patientCardStart = content.indexOf("function PatientCard({ patient, mode, onViewSlip, onViewResult }: any) {");
const slipModalStart = content.indexOf("/* ---- Slip Modal ---- */");

if (patientCardStart !== -1 && slipModalStart !== -1) {
  content = content.substring(0, patientCardStart) + content.substring(slipModalStart);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully refactored Queue and Results tabs in ReceptionPage.v2.tsx");
