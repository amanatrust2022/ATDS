const fs = require('fs');
const path = require('path');

const recPath = path.join(__dirname, '../components/ReceptionPage.tsx');
let recContent = fs.readFileSync(recPath, 'utf8');

// 1. Add imports
if (!recContent.includes("import { QueueTab } from './features/queue/QueueTab';")) {
  recContent = recContent.replace(
    "import Header from '@/components/Header';",
    "import Header from '@/components/Header';\nimport { QueueTab } from './features/queue/QueueTab';\nimport { ResultsTab } from './features/queue/ResultsTab';"
  );
}

// 2. Fix the implicit any types
recContent = recContent.replace(
  "onViewSlip={(p) => setShowSlipModal(p)}",
  "onViewSlip={(p: any) => setShowSlipModal(p)}"
);
recContent = recContent.replace(
  "onViewResult={(p) => setShowResultModal(p)}",
  "onViewResult={(p: any) => setShowResultModal(p)}"
);
recContent = recContent.replace(
  "onViewSlip={(p) => setShowSlipModal(p)}",
  "onViewSlip={(p: any) => setShowSlipModal(p)}"
);
recContent = recContent.replace(
  "onViewResult={(p) => setShowResultModal(p)}",
  "onViewResult={(p: any) => setShowResultModal(p)}"
);

fs.writeFileSync(recPath, recContent, 'utf8');
console.log('Fixed ReceptionPage.tsx');
