const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../components/ReceptionPage.tsx');
let content = fs.readFileSync(srcPath, 'utf8');

const getBlock = (startString, endString) => {
  const start = content.indexOf(startString);
  if (start === -1) throw new Error("Could not find start: " + startString);
  const end = content.indexOf(endString, start);
  if (end === -1) throw new Error("Could not find end: " + endString);
  return content.substring(start, end);
};

// 1. Replace Registration Tab
const regStart = "{/* ===== REGISTER TAB ===== */}";
const regEnd = "{/* ===== QUEUE TAB ===== */}";
const regBlock = getBlock(regStart, regEnd);

const regReplacement = `{/* ===== REGISTER TAB ===== */}
        {tab === 'register' && (
          <RegistrationTab 
            patients={patients}
            patientProfiles={patientProfiles}
            doctors={doctors}
            setDoctors={setDoctors}
            facilities={facilities}
            setFacilities={setFacilities}
            testPrices={testPrices}
            catalogue={catalogue}
            billingAccounts={billingAccounts}
            organization={organization}
            setShowSlipModal={setShowSlipModal}
          />
        )}

        `;
content = content.replace(regBlock, regReplacement);

// 2. Replace Wallet Tab
const walletStart = "{/* ===== WALLET TAB ===== */}";
const walletEnd = "</div>\n    </div>\n  );\n}";
// Wait, the end of the wallet tab is the end of the file/component.
const walletBlock = content.substring(content.indexOf(walletStart));
// The end of the wallet tab is before `</div>\n    </div>\n  );\n}`.
// Let's just find the last `</div>\n    </div>\n  );\n}`
const lastDivIndex = content.lastIndexOf("</div>\n    </div>\n  );\n}");
let walletBlockExact = "";
if (lastDivIndex > content.indexOf(walletStart)) {
  walletBlockExact = content.substring(content.indexOf(walletStart), lastDivIndex);
} else {
  // Try alternative finding
  walletBlockExact = content.substring(content.indexOf(walletStart), content.lastIndexOf("  );\n}"));
}

const walletReplacement = `{/* ===== WALLET TAB ===== */}
        {tab === 'wallet' && (
          <WalletTab 
            organization={organization}
            patients={patients}
            profile={profile}
            refresh={refresh}
          />
        )}
      </div>
    </div>
  );
}
`;
if (walletBlockExact) {
  content = content.replace(walletBlockExact + "</div>\n    </div>\n  );\n}", walletReplacement);
}

// 3. Add imports
const imports = `import RegistrationTab from './features/registration/RegistrationTab';
import WalletTab from './features/wallet/WalletTab';
`;

if (!content.includes("import RegistrationTab")) {
  content = content.replace("import { QueueTab }", imports + "import { QueueTab }");
}

fs.writeFileSync(srcPath, content, 'utf8');
console.log("Successfully refactored ReceptionPage.tsx");
