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

let registrationTabUI = getBlock("{/* ===== REGISTER TAB ===== */}", "{/* ===== QUEUE TAB ===== */}").trim();

// Remove the condition wrapper
if (registrationTabUI.startsWith("{tab === 'register' && (")) {
  registrationTabUI = registrationTabUI.replace("{tab === 'register' && (", "").trim();
  if (registrationTabUI.endsWith(")}")) {
    registrationTabUI = registrationTabUI.slice(0, -2).trim();
  }
}

// Get handlers (from `const validate = () => {` down to `const filtered =`)
let registerHandlers = getBlock("const validate = () => {", "const filtered = (tab === 'queue' ? pendingPatients : resultsPatients)");

let fileContent = `import React, { useRef, useState, useEffect } from 'react';
import { 
  RiHospitalLine, RiAddLine, RiClipboardLine, RiCheckLine, RiErrorWarningLine,
  RiTestTubeLine, RiRadarLine, RiMailOpenLine, RiFolderOpenLine, RiPrinterLine,
  RiFileTextLine, RiMoreLine, RiCloseLine, RiArrowUpSLine, RiArrowDownSLine, RiMailLine,
  RiUserHeartLine, RiSearchLine, RiMoneyDollarCircleLine, RiWalletLine, RiFolderUserLine,
} from '@remixicon/react';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { Patient, PatientProfile, ReferringDoctor, ReferringFacility, TestPrice, Test, BillingAccount } from '@/lib/store';
import { generateSlipNumber, addPatientWithReferral, addReferringDoctor, addReferringFacility } from '@/lib/store';

const inputStyle = (error?: boolean) => ({
  width: '100%', padding: '0.65rem 1rem', borderRadius: 'var(--radius)',
  border: error ? '1px solid var(--red)' : '1px solid var(--gray-300)',
  fontSize: '0.82rem', fontFamily: 'var(--font-sans)', outline: 'none'
});

const closeBtn = { background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.4rem', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex' };
const dropItemStyle = { padding: '0.65rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', transition: 'background 0.15s' };

function Field({ label, children, error }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
      {error && <span style={{ color: 'var(--red)', fontSize: '0.7rem' }}>{error}</span>}
    </div>
  );
}

export default function RegistrationTab({ 
  patients, patientProfiles, doctors, setDoctors, facilities, setFacilities,
  testPrices, catalogue, billingAccounts, organization,
  setShowSlipModal
}: any) {
  // Local state that wasn't moved to store
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [showPatientSearchDrop, setShowPatientSearchDrop] = useState(false);
  const [loadedPatientName, setLoadedPatientName] = useState('');
  const [selectedPatientProfileId, setSelectedPatientProfileId] = useState<number | null>(null);
  
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [facilitySearch, setFacilitySearch] = useState('');
  const [showDoctorDrop, setShowDoctorDrop] = useState(false);
  const [showFacilityDrop, setShowFacilityDrop] = useState(false);
  const [testSearch, setTestSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [showQuickDoctor, setShowQuickDoctor] = useState(false);
  const [showQuickFacility, setShowQuickFacility] = useState(false);
  const [quickDoctorForm, setQuickDoctorForm] = useState({ name: '', phone: '', email: '', facility_id: '' });
  const [quickFacilityForm, setQuickFacilityForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [quickError, setQuickError] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  
  const [selectedPatientBillingAccountId, setSelectedPatientBillingAccountId] = useState<string | null>(null);
  const [checkoutBillingAccountId, setCheckoutBillingAccountId] = useState<string>('');
  const [linkedAccount, setLinkedAccount] = useState<BillingAccount | null>(null);
  
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const doctorRef = useRef<HTMLDivElement>(null);
  const facilityRef = useRef<HTMLDivElement>(null);

  const store = useRegistrationStore();
  const { form, setForm, selectedTests, addTest, removeTest, clearTests, discountType, setDiscount, discountValue, paymentMethod, setPaymentMethod, paidAmount, setPaidAmount } = store;

  // Filter logic
  const filteredTests = catalogue.filter((test: any) => {
    const q = testSearch.trim().toLowerCase();
    if (!q) return true;
    return [test.name, test.specimen, test.department, test.category].join(' ').toLowerCase().includes(q);
  });
  
  const toggleTest = (id: string) => {
    if (selectedTests.includes(id)) {
      removeTest(id);
    } else {
      addTest(id);
    }
  };

  ${registerHandlers}

  // Handle wallet default selection
  useEffect(() => {
    if (!selectedPatientBillingAccountId) {
      setLinkedAccount(null);
      setCheckoutBillingAccountId('');
      if (paymentMethod === 'wallet') {
        setPaymentMethod('cash');
      }
      return;
    }
    const acc = billingAccounts.find((a: any) => a.id === selectedPatientBillingAccountId);
    setLinkedAccount(acc || null);
    if (acc) {
      setCheckoutBillingAccountId(acc.id);
      setPaymentMethod('wallet'); 
    }
  }, [selectedPatientBillingAccountId, billingAccounts, paymentMethod, setPaymentMethod]);

  return (
    ${registrationTabUI}
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../components/features/registration/RegistrationTab.tsx'), fileContent, 'utf8');

// Now replace in ReceptionPage.tsx
let newRecContent = content.replace(getBlock("{/* ===== REGISTER TAB ===== */}", "{/* ===== QUEUE TAB ===== */}"), "{/* ===== REGISTER TAB ===== */}\\n        {tab === 'register' && (\\n          <RegistrationTab \\n            patients={patients}\\n            patientProfiles={patientProfiles}\\n            doctors={doctors}\\n            setDoctors={setDoctors}\\n            facilities={facilities}\\n            setFacilities={setFacilities}\\n            testPrices={testPrices}\\n            catalogue={catalogue}\\n            billingAccounts={billingAccounts}\\n            organization={organization}\\n            setShowSlipModal={setShowSlipModal}\\n          />\\n        )}\\n\\n        ");

// Also add import
if (!newRecContent.includes("import RegistrationTab from './features/registration/RegistrationTab';")) {
  newRecContent = newRecContent.replace("import { QueueTab }", "import RegistrationTab from './features/registration/RegistrationTab';\\nimport { QueueTab }");
}

fs.writeFileSync(srcPath, newRecContent, 'utf8');
console.log("Successfully extracted RegistrationTab.tsx");
