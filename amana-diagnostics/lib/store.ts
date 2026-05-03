// Amana Diagnostics - Central Data Store (localStorage-based for prototype)
export type Department = 'lab' | 'radiology';
export type TestStatus = 'pending' | 'in_progress' | 'completed';

export interface Test {
  id: string;
  name: string;
  department: Department;
  parameters: { name: string; unit: string; range: string }[];
}

export interface PatientTest {
  testId: string;
  testName: string;
  department: Department;
  status: TestStatus;
  specimen?: string;
  results?: { parameter: string; result: string; unit: string; range: string; flag?: string }[];
  completedBy?: string;
  completedAt?: string;
  notes?: string;
}

export interface Patient {
  id: string;
  slipNumber: string;
  registeredAt: string;
  name: string;
  age: string;
  sex: 'Male' | 'Female';
  phone: string;
  address: string;
  referredBy: string;
  tests: PatientTest[];
}

export interface Test {
  id: string;
  name: string;
  department: Department;
  category: 'Hematology' | 'Serology' | 'Chemical Pathology' | 'Microbiology' | 'Ultrasound' | 'Hormones' | 'Special Health Check Plans';
  parameters: { name: string; unit: string; range: string }[];
}

export const TEST_CATALOGUE: Test[] = [
  // --- HEMATOLOGY ---
  { id: 'fbc', name: 'Full Blood Count', department: 'lab', category: 'Hematology', parameters: [
    { name: 'WBC', unit: 'ul', range: '3.50-9.50' },
    { name: 'Lym%', unit: '%', range: '20.0-50.0' },
    { name: 'Gran%', unit: '%', range: '50.0-70.0' },
    { name: 'Mid%', unit: '%', range: '3.0-9.0' },
    { name: 'Lym#', unit: 'ul', range: '1.10-3.20' },
    { name: 'Gran#', unit: 'ul', range: '2.00-7.00' },
    { name: 'Mid#', unit: 'ul', range: '0.10-0.90' },
    { name: 'RBC', unit: 'ul', range: '3.00-5.80' },
    { name: 'HGB', unit: 'g/dl', range: '11.5-17.5' },
    { name: 'HCT', unit: '%', range: '35.0-50.0' },
    { name: 'MCV', unit: 'fl', range: '82.0-100.0' },
    { name: 'MCH', unit: 'pg', range: '27.0-34.0' },
    { name: 'MCHC', unit: 'g/dl', range: '31.6-35.4' },
    { name: 'RDW-CV', unit: '%', range: '11.5-14.5' },
    { name: 'RDW-SD', unit: 'fl', range: '35.0-56.0' },
    { name: 'PLT', unit: 'ul', range: '125-350' },
    { name: 'MPV', unit: 'fl', range: '7.0-11.0' },
    { name: 'PDW-SD', unit: 'fl', range: '9.0-17.0' },
    { name: 'PCT', unit: '%', range: '0.108-0.282' },
    { name: 'P-LCR', unit: '%', range: '11.0-45.0' },
    { name: 'P-LCC', unit: 'ul', range: '30-90' },
  ]},
  { id: 'esr', name: 'ESR', department: 'lab', category: 'Hematology', parameters: [
    { name: 'ESR', unit: 'mm/hr', range: 'M: <15 / F: <20' },
  ]},
  { id: 'pcv', name: 'PCV', department: 'lab', category: 'Hematology', parameters: [
    { name: 'PCV', unit: '%', range: '35-48' },
  ]},
  { id: 'genotype', name: 'Hb Genotype', department: 'lab', category: 'Hematology', parameters: [
    { name: 'HB Genotype', unit: '', range: '' },
  ]},
  { id: 'blood_group', name: 'Blood Grouping', department: 'lab', category: 'Hematology', parameters: [
    { name: 'Blood Group', unit: '', range: '' },
  ]},
  { id: 'rh_typing', name: 'Rh Typing', department: 'lab', category: 'Hematology', parameters: [
    { name: 'Rhesus Factor', unit: '', range: '' },
  ]},
  { id: 'mps_rdt', name: 'MPs (RDT)', department: 'lab', category: 'Hematology', parameters: [
    { name: 'Malaria Parasite (RDT)', unit: '', range: 'Negative' },
  ]},
  { id: 'mps_bf', name: 'MPs (Blood Film)', department: 'lab', category: 'Hematology', parameters: [
    { name: 'Malaria Parasite (Blood Film)', unit: '', range: 'Not Seen' },
  ]},
  { id: 'mp_widal', name: 'MP + WIDAL', department: 'lab', category: 'Hematology', parameters: [
    { name: 'MPs', unit: '', range: 'Not Seen' },
    { name: 'Widal Test', unit: '', range: '' },
  ]},

  // --- SEROLOGY ---
  { id: 'hbsag', name: 'HBsAg', department: 'lab', category: 'Serology', parameters: [
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'hcv', name: 'HCV Antibody', department: 'lab', category: 'Serology', parameters: [
    { name: 'HCV', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'hb_combo', name: 'HB Combo', department: 'lab', category: 'Serology', parameters: [
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
    { name: 'HBsAb', unit: '', range: 'Non-Reactive' },
    { name: 'HBeAg', unit: '', range: 'Non-Reactive' },
    { name: 'HBeAb', unit: '', range: 'Non-Reactive' },
    { name: 'HBcAb', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'vdrl', name: 'VDRL', department: 'lab', category: 'Serology', parameters: [
    { name: 'VDRL', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'rvs', name: 'RVS', department: 'lab', category: 'Serology', parameters: [
    { name: 'RVS', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'hcg', name: 'HCG', department: 'lab', category: 'Serology', parameters: [
    { name: 'Pregnancy Test (HCG)', unit: '', range: 'Negative' },
  ]},
  { id: 'h_pylori', name: 'H Pylori', department: 'lab', category: 'Serology', parameters: [
    { name: 'H. Pylori', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'widal', name: 'WIDAL', department: 'lab', category: 'Serology', parameters: [
    { name: 'S. Typhi O', unit: 'titre', range: '1/20 - 1/80' },
    { name: 'S. Typhi H', unit: 'titre', range: '1/20 - 1/80' },
  ]},
  { id: 'rheumatoid_factor', name: 'Rheumatoid Factor', department: 'lab', category: 'Serology', parameters: [
    { name: 'Rheumatoid Factor', unit: '', range: 'Negative' },
  ]},

  // --- CHEMICAL PATHOLOGY ---
  { id: 'kft', name: 'Kidney Function Test (E/U/Cr)', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'Urea', unit: 'mmol/L', range: '2.3-5.8' },
    { name: 'Creatinine', unit: 'umol/L', range: '53-124' },
    { name: 'Sodium Na+', unit: 'mmole/L', range: '135-145' },
    { name: 'Potassium K+', unit: 'mmole/L', range: '3.5-5.0' },
    { name: 'Chloride Cl-', unit: 'mmole/L', range: '98-106' },
    { name: 'Bicarbonate HCO3-', unit: 'mmole/L', range: '21-31' },
  ]},
  { id: 'lft', name: 'Liver Function Test (LFT)', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'AST (SGOT)', unit: 'U/L', range: '8-37' },
    { name: 'ALT (SGPT)', unit: 'U/L', range: '4-41' },
    { name: 'ALP', unit: 'U/L', range: '35-128' },
    { name: 'Total Bilirubin', unit: 'mg/dL', range: '0-2' },
    { name: 'Direct Bilirubin', unit: 'mg/dL', range: '0-0.2' },
    { name: 'Total Protein', unit: 'g/dL', range: '6.4-8.2' },
    { name: 'Albumin', unit: 'g/dL', range: '3.5-5.2' },
  ]},
  { id: 'lipid', name: 'Lipid Profile', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'Total Cholesterol', unit: 'mg/dL', range: '200-239' },
    { name: 'Triglycerides', unit: 'mg/dL', range: 'F:35-135 / M:40-160' },
    { name: 'HDL Cholesterol', unit: 'mg/dL', range: 'M:35-55 / F:45-65' },
    { name: 'LDL Cholesterol', unit: 'mg/dL', range: '<100' },
  ]},
  { id: 'urea', name: 'Urea', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'Urea', unit: 'mmol/L', range: '2.3-5.8' },
  ]},
  { id: 'creatinine', name: 'Creatinine', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'Creatinine', unit: 'umol/L', range: '53-124' },
  ]},
  { id: 'electrolytes', name: 'Electrolytes', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'Sodium Na+', unit: 'mmole/L', range: '135-145' },
    { name: 'Potassium K+', unit: 'mmole/L', range: '3.5-5.0' },
    { name: 'Chloride Cl-', unit: 'mmole/L', range: '98-106' },
    { name: 'Bicarbonate HCO3-', unit: 'mmole/L', range: '21-31' },
  ]},
  { id: 'uric_acid', name: 'Uric Acid', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'Uric Acid', unit: 'mg/dL', range: 'M:2.7-7.3 / F:3.5-6.4' },
  ]},
  { id: 'hba1c', name: 'HBA1C', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'HbA1c', unit: '%', range: '4.0-6.5' },
  ]},
  { id: 'phosphate', name: 'PO4^3-', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'Phosphate (Po42-)', unit: 'mg/dL', range: '2.5-4.4' },
  ]},
  { id: 'calcium', name: 'Ca^2+', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'Calcium (Ca2+)', unit: 'mg/dL', range: '8.5-10.5' },
  ]},
  { id: 'fbs', name: 'Fasting Blood Sugar (FBS)', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'FBS', unit: 'mmol/L', range: '3.4-5.6' },
  ]},
  { id: 'rbs', name: 'Random Blood Sugar (RBS)', department: 'lab', category: 'Chemical Pathology', parameters: [
    { name: 'RBS', unit: 'mmol/L', range: '4.0-7.8' },
  ]},

  // --- MICROBIOLOGY ---
  { id: 'urinalysis', name: 'Urinalysis', department: 'lab', category: 'Microbiology', parameters: [
    { name: 'Colour', unit: '', range: 'Amber' },
    { name: 'Appearance', unit: '', range: 'Clear' },
    { name: 'pH', unit: '', range: '5.0-8.5' },
    { name: 'Specific Gravity', unit: '', range: '1.001-1.030' },
    { name: 'Protein', unit: '', range: 'Negative' },
    { name: 'Glucose', unit: '', range: 'Negative' },
    { name: 'Nitrate', unit: '', range: 'Negative' },
    { name: 'Bilirubin', unit: '', range: 'Negative' },
    { name: 'Ketone', unit: '', range: 'Negative' },
    { name: 'Blood', unit: '', range: 'Negative' },
    { name: 'Leucocytes', unit: '', range: 'Negative' },
    { name: 'Urobilinogen', unit: '', range: 'Normal' },
  ]},
  { id: 'urine_microscopy', name: 'Urine Microscopy', department: 'lab', category: 'Microbiology', parameters: [
    { name: 'Microscopy (Pus Cells)', unit: '/hpf', range: '0-2' },
    { name: 'Microscopy (Epithelial)', unit: '/hpf', range: '' },
    { name: 'Crystals', unit: '', range: 'Not Seen' },
  ]},
  { id: 'urine_mcs', name: 'Urine MCS', department: 'lab', category: 'Microbiology', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},
  { id: 'stool_microscopy', name: 'Stool Microscopy', department: 'lab', category: 'Microbiology', parameters: [
    { name: 'Consistency', unit: '', range: '' },
    { name: 'Microscopy (Ova)', unit: '', range: 'Not Seen' },
    { name: 'Microscopy (Cysts)', unit: '', range: 'Not Seen' },
  ]},
  { id: 'stool_mcs', name: 'Stool MCS', department: 'lab', category: 'Microbiology', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},
  { id: 'hvs_mcs', name: 'HVS MCS', department: 'lab', category: 'Microbiology', parameters: [
    { name: 'Microscopy (Pus Cells)', unit: '/hpf', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},
  { id: 'throat_swab_mcs', name: 'Throat Swab MCS', department: 'lab', category: 'Microbiology', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},
  { id: 'sputum_mcs', name: 'Sputum MCS', department: 'lab', category: 'Microbiology', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},
  { id: 'sfa', name: 'SFA', department: 'lab', category: 'Microbiology', parameters: [
    { name: 'Volume', unit: 'ml', range: '>1.5' },
    { name: 'Count', unit: 'x10^6/ml', range: '>15' },
    { name: 'Motility', unit: '%', range: '' },
  ]},
  { id: 'sfmcs', name: 'SFMCS', department: 'lab', category: 'Microbiology', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
  ]},

  // --- ULTRASOUND ---
  { id: 'us_obs', name: 'Obstetric', department: 'radiology', category: 'Ultrasound', parameters: [
    { name: 'Presentation', unit: '', range: '' },
    { name: 'FHR', unit: 'bpm', range: '120-160' },
    { name: 'GA', unit: 'wks', range: '' },
    { name: 'Impression', unit: '', range: '' },
  ]},
  { id: 'us_pelvic', name: 'Pelvic', department: 'radiology', category: 'Ultrasound', parameters: [
    { name: 'Uterus', unit: '', range: '' },
    { name: 'Impression', unit: '', range: '' },
  ]},
  { id: 'us_abd_pelvis', name: 'Abdomino Pelvic', department: 'radiology', category: 'Ultrasound', parameters: [
    { name: 'Liver/Gallbladder', unit: '', range: '' },
    { name: 'Impression', unit: '', range: '' },
  ]},

  // --- HORMONES ---
  { id: 'psa', name: 'PSA', department: 'lab', category: 'Hormones', parameters: [
    { name: 'PSA', unit: 'ng/mL', range: '<4.0' },
  ]},
  { id: 'progesterone', name: 'Progesterone', department: 'lab', category: 'Hormones', parameters: [
    { name: 'Progesterone', unit: 'ng/mL', range: '' },
  ]},
  { id: 'testosterone', name: 'Testosterone', department: 'lab', category: 'Hormones', parameters: [
    { name: 'Testosterone', unit: 'ng/mL', range: '' },
  ]},
  { id: 'tft', name: 'Thyroid Function Test (TFT)', department: 'lab', category: 'Hormones', parameters: [
    { name: 'T3', unit: 'nmol/L', range: '1.3-3.1' },
    { name: 'T4', unit: 'nmol/L', range: '66-181' },
    { name: 'TSH', unit: 'uIU/mL', range: '0.4-4.0' },
  ]},

  // --- SPECIAL HEALTH CHECK PLANS ---
  { id: 'pkg_premarital', name: 'Premarital Screening', department: 'lab', category: 'Special Health Check Plans', parameters: [
    { name: 'RVS', unit: '', range: 'Non-Reactive' },
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
    { name: 'Hb Genotype', unit: '', range: '' },
  ]},
  { id: 'pkg_antenatal', name: 'Antenatal Screening', department: 'lab', category: 'Special Health Check Plans', parameters: [
    { name: 'Blood Group', unit: '', range: '' },
    { name: 'PCV', unit: '%', range: '' },
  ]},
  { id: 'pkg_basic', name: 'Basic', department: 'lab', category: 'Special Health Check Plans', parameters: [
    { name: 'Basic Profile', unit: '', range: '' },
  ]},
  { id: 'pkg_silver', name: 'Silver', department: 'lab', category: 'Special Health Check Plans', parameters: [
    { name: 'Silver Profile', unit: '', range: '' },
  ]},
  { id: 'pkg_gold', name: 'Gold', department: 'lab', category: 'Special Health Check Plans', parameters: [
    { name: 'Gold Profile', unit: '', range: '' },
  ]},
  { id: 'pkg_diamond', name: 'Diamond', department: 'lab', category: 'Special Health Check Plans', parameters: [
    { name: 'Diamond Profile', unit: '', range: '' },
  ]},
];

export const generateSlipNumber = (): string => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  const count = (getPatients().length + 1).toString().padStart(4, '0');
  return `ATD/${y}${m}${d}/${count}`;
};

export const getPatients = (): Patient[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem('amana_patients');
  return data ? JSON.parse(data) : [];
};

export const savePatients = (patients: Patient[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('amana_patients', JSON.stringify(patients));
  window.dispatchEvent(new Event('amana_update'));
};

export const addPatient = (patient: Patient): void => {
  const patients = getPatients();
  patients.unshift(patient);
  savePatients(patients);
};

export const updatePatient = (updated: Patient): void => {
  const patients = getPatients();
  const idx = patients.findIndex(p => p.id === updated.id);
  if (idx !== -1) {
    patients[idx] = updated;
    savePatients(patients);
  }
};

export const getTestById = (id: string): Test | undefined =>
  TEST_CATALOGUE.find(t => t.id === id);
