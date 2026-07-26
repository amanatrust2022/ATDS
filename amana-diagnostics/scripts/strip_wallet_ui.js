const fs = require('fs');
const path = require('path');

const rcPath = path.join(__dirname, '../components/ReceptionPage.v2.tsx');
let rcContent = fs.readFileSync(rcPath, 'utf8');

// 1. Add WalletTab import
rcContent = rcContent.replace("import AnalyticsTab from './features/analytics/AnalyticsTab';", "import AnalyticsTab from './features/analytics/AnalyticsTab';\nimport WalletTab from './features/wallet/WalletTab';");

// 2. Remove WalletTab JSX block
const startJSX = rcContent.indexOf("{tab === 'wallet' && (");
if (startJSX !== -1) {
  const endJSX = rcContent.indexOf("{/* Modals for quick doctors/facilities */}", startJSX);
  if (endJSX !== -1) {
    const replacement = `{tab === 'wallet' && (
          <WalletTab 
            organization={organization}
            patients={patients}
            profile={profile}
            refresh={refresh}
          />
        )}
        
        `;
    rcContent = rcContent.substring(0, startJSX) + replacement + rcContent.substring(endJSX);
  }
}

fs.writeFileSync(rcPath, rcContent, 'utf8');
console.log("Refactored ReceptionPage.v2.tsx UI");
