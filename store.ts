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

export const TEST_CATALOGUE: Test[] = [
  { id: 'fbc', name: 'Full Blood Count (FBC)', department: 'lab', parameters: [
    { name: 'Haemoglobin', unit: 'g/dL', range: 'M: 13.5-17.5 / F: 12.0-16.0' },
    { name: 'PCV/Haematocrit', unit: '%', range: 'M: 41-53 / F: 36-46' },
    { name: 'RBC Count', unit: 'x10/uL', range: 'M: 4.5-5.5 / F: 4.0-5.0' },
    { name: 'WBC Count', unit: 'x10/uL', range: '4.0-11.0' },
    { name: 'Platelet Count', unit: 'x10/uL', range: '150-400' },
    { name: 'MCV', unit: 'fL', range: '80-100' },
    { name: 'MCH', unit: 'pg', range: '27-33' },
    { name: 'MCHC', unit: 'g/dL', range: '32-36' },
  ]},
  { id: 'esr', name: 'Erythrocyte Sedimentation Rate (ESR)', department: 'lab', parameters: [
    { name: 'ESR', unit: 'mm/hr', range: 'M: 0-15 / F: 0-20' },
  ]},
  { id: 'malaria_rdt', name: 'Malaria RDT', department: 'lab', parameters: [
    { name: 'Malaria Antigen (P. falciparum)', unit: '', range: 'Negative' },
  ]},
  { id: 'malaria_mp', name: 'Malaria Parasite (MP) Test', department: 'lab', parameters: [
    { name: 'Malaria Parasite', unit: '', range: 'Not Seen' },
    { name: 'Parasite Density', unit: 'parasites/uL', range: 'N/A if negative' },
  ]},
  { id: 'lipid', name: 'Lipid Profile', department: 'lab', parameters: [
    { name: 'Total Cholesterol', unit: 'mmol/L', range: '< 5.2' },
    { name: 'Triglycerides', unit: 'mmol/L', range: '< 1.7' },
    { name: 'HDL Cholesterol', unit: 'mmol/L', range: '> 1.0' },
    { name: 'LDL Cholesterol', unit: 'mmol/L', range: '< 3.4' },
    { name: 'VLDL Cholesterol', unit: 'mmol/L', range: '0.1-1.0' },
  ]},
  { id: 'rft', name: 'Renal Function Test (RFT)', department: 'lab', parameters: [
    { name: 'Urea', unit: 'mmol/L', range: '2.5-7.5' },
    { name: 'Creatinine', unit: 'umol/L', range: 'M: 62-115 / F: 53-97' },
    { name: 'Uric Acid', unit: 'mmol/L', range: 'M: 0.21-0.42 / F: 0.15-0.36' },
    { name: 'eGFR', unit: 'mL/min/1.73m2', range: '> 60' },
  ]},
  { id: 'lft', name: 'Liver Function Test (LFT)', department: 'lab', parameters: [
    { name: 'Total Bilirubin', unit: 'umol/L', range: '3.4-20.5' },
    { name: 'Direct Bilirubin', unit: 'umol/L', range: '0-5.1' },
    { name: 'AST (SGOT)', unit: 'U/L', range: 'M: 10-40 / F: 9-32' },
    { name: 'ALT (SGPT)', unit: 'U/L', range: 'M: 7-56 / F: 7-40' },
    { name: 'ALP', unit: 'U/L', range: '44-147' },
    { name: 'Total Protein', unit: 'g/L', range: '60-80' },
    { name: 'Albumin', unit: 'g/L', range: '35-50' },
  ]},
  { id: 'fbs', name: 'Fasting Blood Sugar (FBS)', department: 'lab', parameters: [
    { name: 'Fasting Blood Glucose', unit: 'mmol/L', range: '3.9-5.5' },
  ]},
  { id: 'rbs', name: 'Random Blood Sugar (RBS)', department: 'lab', parameters: [
    { name: 'Random Blood Glucose', unit: 'mmol/L', range: '< 11.1' },
  ]},
  { id: 'hba1c', name: 'HbA1c (Glycated Haemoglobin)', department: 'lab', parameters: [
    { name: 'HbA1c', unit: '%', range: '< 5.7' },
  ]},
  { id: 'electrolytes', name: 'Serum Electrolytes', department: 'lab', parameters: [
    { name: 'Sodium (Na+)', unit: 'mmol/L', range: '136-145' },
    { name: 'Potassium (K+)', unit: 'mmol/L', range: '3.5-5.0' },
    { name: 'Chloride (Cl-)', unit: 'mmol/L', range: '98-107' },
    { name: 'Bicarbonate (HCO3-)', unit: 'mmol/L', range: '22-29' },
  ]},
  { id: 'urinalysis', name: 'Urinalysis (U/R)', department: 'lab', parameters: [
    { name: 'Colour', unit: '', range: 'Yellow/Pale Yellow' },
    { name: 'Turbidity', unit: '', range: 'Clear' },
    { name: 'pH', unit: '', range: '4.5-8.0' },
    { name: 'Specific Gravity', unit: '', range: '1.005-1.030' },
    { name: 'Protein', unit: '', range: 'Negative' },
    { name: 'Glucose', unit: '', range: 'Negative' },
    { name: 'Ketones', unit: '', range: 'Negative' },
    { name: 'Blood', unit: '', range: 'Negative' },
    { name: 'Leucocytes', unit: '/hpf', range: '0-5' },
    { name: 'Nitrites', unit: '', range: 'Negative' },
  ]},
  { id: 'hiv_test', name: 'HIV Screen (1 & 2)', department: 'lab', parameters: [
    { name: 'HIV 1', unit: '', range: 'Non-Reactive' },
    { name: 'HIV 2', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'hbsag', name: 'Hepatitis B Surface Antigen (HBsAg)', department: 'lab', parameters: [
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'hcv', name: 'Hepatitis C Antibody (Anti-HCV)', department: 'lab', parameters: [
    { name: 'Anti-HCV', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'widal', name: 'Widal Test', department: 'lab', parameters: [
    { name: 'S. Typhi O', unit: 'titre', range: '< 1:80' },
    { name: 'S. Typhi H', unit: 'titre', range: '< 1:80' },
    { name: 'S. Paratyphi AO', unit: 'titre', range: '< 1:80' },
    { name: 'S. Paratyphi AH', unit: 'titre', range: '< 1:80' },
  ]},
  { id: 'crp', name: 'C-Reactive Protein (CRP)', department: 'lab', parameters: [
    { name: 'CRP', unit: 'mg/L', range: '< 10' },
  ]},
  { id: 'rhf', name: 'Rheumatoid Factor (RF)', department: 'lab', parameters: [
    { name: 'Rheumatoid Factor', unit: 'IU/mL', range: '< 14' },
  ]},
  { id: 'tsh', name: 'Thyroid Stimulating Hormone (TSH)', department: 'lab', parameters: [
    { name: 'TSH', unit: 'uIU/mL', range: '0.4-4.0' },
  ]},
  { id: 'xray_chest', name: 'Chest X-Ray (PA View)', department: 'radiology', parameters: [
    { name: 'Impression', unit: '', range: '' },
    { name: 'Heart', unit: '', range: '' },
    { name: 'Lungs', unit: '', range: '' },
    { name: 'Mediastinum', unit: '', range: '' },
    { name: 'Diaphragm', unit: '', range: '' },
    { name: 'Bony Structures', unit: '', range: '' },
  ]},
  { id: 'xray_abdomen', name: 'Abdominal X-Ray', department: 'radiology', parameters: [
    { name: 'Impression', unit: '', range: '' },
    { name: 'Bowel Pattern', unit: '', range: '' },
    { name: 'Solid Organs', unit: '', range: '' },
    { name: 'Bony Structures', unit: '', range: '' },
  ]},
  { id: 'xray_lsspine', name: 'X-Ray Lumbosacral Spine (AP & Lateral)', department: 'radiology', parameters: [
    { name: 'Impression', unit: '', range: '' },
    { name: 'Vertebral Alignment', unit: '', range: '' },
    { name: 'Disc Spaces', unit: '', range: '' },
    { name: 'Bony Structures', unit: '', range: '' },
  ]},
  { id: 'us_abdomen', name: 'Ultrasound Abdomen', department: 'radiology', parameters: [
    { name: 'Impression', unit: '', range: '' },
    { name: 'Liver', unit: '', range: '' },
    { name: 'Gallbladder', unit: '', range: '' },
    { name: 'Spleen', unit: '', range: '' },
    { name: 'Pancreas', unit: '', range: '' },
    { name: 'Kidneys', unit: '', range: '' },
    { name: 'Aorta', unit: '', range: '' },
    { name: 'Bladder', unit: '', range: '' },
  ]},
  { id: 'us_pelvis', name: 'Ultrasound Pelvis', department: 'radiology', parameters: [
    { name: 'Impression', unit: '', range: '' },
    { name: 'Uterus', unit: '', range: '' },
    { name: 'Ovaries', unit: '', range: '' },
    { name: 'Bladder', unit: '', range: '' },
    { name: 'Free Fluid', unit: '', range: '' },
  ]},
  { id: 'us_obs', name: 'Obstetric Ultrasound', department: 'radiology', parameters: [
    { name: 'Impression', unit: '', range: '' },
    { name: 'Gestational Age', unit: 'weeks', range: '' },
    { name: 'Foetal Presentation', unit: '', range: '' },
    { name: 'Foetal Heart Rate', unit: 'bpm', range: '120-160' },
    { name: 'Placenta', unit: '', range: '' },
    { name: 'Amniotic Fluid Index', unit: 'cm', range: '8-24' },
    { name: 'BPD', unit: 'cm', range: '' },
    { name: 'FL', unit: 'cm', range: '' },
    { name: 'AC', unit: 'cm', range: '' },
  ]},
  { id: 'us_kub', name: 'Ultrasound KUB', department: 'radiology', parameters: [
    { name: 'Impression', unit: '', range: '' },
    { name: 'Right Kidney', unit: '', range: '' },
    { name: 'Left Kidney', unit: '', range: '' },
    { name: 'Ureters', unit: '', range: '' },
    { name: 'Bladder', unit: '', range: '' },
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
