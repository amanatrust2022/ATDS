const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../components/ReceptionPage.v2.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Rename default export
content = content.replace('export default function ReceptionPage() {', 'export default function ReceptionPageV2() {');

// 2. Add imports
const imports = `
import RegistrationForm from './features/registration/RegistrationForm';
import ReferralSelection from './features/registration/ReferralSelection';
import TestSelection from './features/registration/TestSelection';
import BillingSummary from './features/registration/BillingSummary';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
`;
content = content.replace("type Tab = 'register' | 'queue' | 'results' | 'wallet';", imports + "\ntype Tab = 'register' | 'queue' | 'results' | 'wallet';");

// 3. Find boundaries of the Register Tab
const startIdx = content.indexOf("{/* ===== REGISTER TAB ===== */}");
const endIdx = content.indexOf("{/* ===== QUEUE TAB ===== */}");

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find boundaries!");
  process.exit(1);
}

// 4. Create the new clean UI block
const newRegisterTab = `{/* ===== REGISTER TAB ===== */}
        {tab === 'register' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <RegistrationForm />
              <ReferralSelection />
            </div>
            <div>
              <TestSelection />
              <BillingSummary />
              <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleRegister}
                    disabled={saving}
                    className={\`px-4 py-2 rounded font-bold text-white \${saving ? 'bg-gray-400' : 'bg-teal-700 hover:bg-teal-800'}\`}
                  >
                    {saving ? 'Registering...' : 'Submit Registration'}
                  </button>
              </div>
            </div>
          </div>
        )}

        `;

// 5. Splice the content
const before = content.slice(0, startIdx);
const after = content.slice(endIdx);
let finalContent = before + newRegisterTab + after;

// 6. Update handleRegister to use Zustand for the basic form data
// This is a minimal update to prove it works. 
finalContent = finalContent.replace('const handleRegister = async () => {', 
  "const handleRegister = async () => {\n    const regStore = useRegistrationStore.getState();\n    const { form: regForm, selectedTests: regSelectedTests } = regStore;");

// Replace form.firstName -> regForm.firstName
finalContent = finalContent.replace(/form\.firstName/g, 'regForm.firstName');
finalContent = finalContent.replace(/form\.surname/g, 'regForm.surname');
finalContent = finalContent.replace(/form\.middleName/g, 'regForm.middleName');
finalContent = finalContent.replace(/form\.referredBy/g, 'regForm.referredBy');
finalContent = finalContent.replace(/form\.referringFacility/g, 'regForm.referringFacility');

fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("Successfully refactored ReceptionPage.v2.tsx");
