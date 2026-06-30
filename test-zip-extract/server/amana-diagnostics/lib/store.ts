import { createClient } from './supabase';

const IS_LOCAL_MODE = typeof window !== 'undefined'
  ? (localStorage.getItem('amana_local_mode') === null
      ? (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' || 
         window.location.hostname.startsWith('192.168.') || 
         window.location.hostname.startsWith('10.') || 
         window.location.hostname.startsWith('172.'))
      : localStorage.getItem('amana_local_mode') === 'true')
  : (process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true' || process.env.NODE_ENV === 'development');

export type Department = 'lab' | 'radiology';
export type TestStatus = 'pending' | 'in_progress' | 'completed';

export interface Test {
  id: string;
  name: string;
  department: Department;
  category: string;
  specimen: string;
  parameters: { name: string; unit: string; range: string }[];
  is_active?: boolean;
}

export interface PatientTest {
  id?: string;
  patient_id?: number;
  testId: string;
  testName: string;
  department: Department;
  status: TestStatus;
  specimen?: string;
  results?: { parameter: string; result: string; unit: string; range: string; flag?: string }[];
  completedBy?: string;
  completedBySignatureUrl?: string;
  completedByTitle?: string;
  completedAt?: string;
  notes?: string;
  price?: number;
  commissionType?: 'percentage' | 'flat' | 'none';
  commissionValue?: number;
  commissionAmount?: number;
}

export interface PatientProfile {
  id: number;
  organizationId: string;
  firstName: string;
  surname: string;
  middleName?: string;
  phone: string;
  email?: string;
  address: string;
  sex: 'Male' | 'Female';
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: number;
  patientProfileId?: number | null;
  slipNumber: string;
  registeredAt: string;
  name: string;
  firstName: string;
  surname: string;
  middleName?: string;
  age: string;
  sex: 'Male' | 'Female';
  phone: string;
  email?: string;
  address: string;
  referredBy: string;
  referringFacility?: string;
  referringDoctorId?: string;
  referringFacilityId?: string;
  // Per-visit commission snapshot
  commissionAssigned?: boolean;
  commissionType?: 'percentage' | 'flat' | 'none' | 'varies';
  commissionValue?: number;   // rate snapshot at registration time
  commissionAmount?: number;  // calculated amount at registration time
  commissionStatus?: 'pending' | 'paid';
  commissionPaidAt?: string;
  commissionPaidNotes?: string;
  // Billing details
  totalAmount?: number;
  discountType?: 'none' | 'flat' | 'percentage';
  discountValue?: number;
  discountAmount?: number;
  netAmount?: number;
  paidAmount?: number;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
  paymentMethod?: string;
  billingAccountId?: string;
  tests: PatientTest[];
}

export const TEST_CATALOGUE: Test[] = [
  // --- HEMATOLOGY ---
  { id: 'fbc', name: 'Full Blood Count', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
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
  { id: 'esr', name: 'ESR', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [{ name: 'ESR', unit: 'mm/hr', range: '<15' }]},
  { id: 'pcv', name: 'PCV', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [{ name: 'PCV', unit: '%', range: '35-48' }]},
  { id: 'genotype', name: 'Hb Genotype', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [{ name: 'HB Genotype', unit: '', range: '' }]},
  { id: 'blood_group', name: 'Blood Grouping', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [{ name: 'Blood Group', unit: '', range: '' }]},
  { id: 'rh_typing', name: 'Rh Typing', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [{ name: 'Rhesus Factor', unit: '', range: '' }]},
  { id: 'mps_rdt', name: 'MPs (RDT)', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [{ name: 'Malaria Parasite (RDT)', unit: '', range: 'Negative' }]},
  { id: 'mps_bf', name: 'MPs (Blood Film)', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'MPs: Parasites', unit: '', range: 'Not Seen' },
    { name: 'MPs: Density (Plus)', unit: '', range: 'Nil' },
    { name: 'MPs: Density (Count)', unit: 'p/µL', range: 'Nil' },
    { name: 'MPs: Species', unit: '', range: 'Nil' },
    { name: 'MPs: Stage', unit: '', range: 'Nil' },
    { name: 'MPs: Comment', unit: '', range: 'Nil' },
  ]},
  { id: 'mp_widal', name: 'MP + WIDAL', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'MPs: Parasites', unit: '', range: 'Not Seen' },
    { name: 'MPs: Density (Plus)', unit: '', range: 'Nil' },
    { name: 'MPs: Density (Count)', unit: 'p/µL', range: 'Nil' },
    { name: 'MPs: Species', unit: '', range: 'Nil' },
    { name: 'MPs: Stage', unit: '', range: 'Nil' },
    { name: 'MPs: Comment', unit: '', range: 'Nil' },
    { name: 'Widal: S. Typhi O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Typhi H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi A O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi A H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi B O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi B H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi C O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi C H', unit: 'Titer', range: '<1:80' },
  ]},
  { id: 'mp_widal_hpylori', name: 'MPs, Widal & H. Pylori', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'MPs: Parasites', unit: '', range: 'Not Seen' },
    { name: 'MPs: Density (Plus)', unit: '', range: 'Nil' },
    { name: 'MPs: Density (Count)', unit: 'p/µL', range: 'Nil' },
    { name: 'MPs: Species', unit: '', range: 'Nil' },
    { name: 'MPs: Stage', unit: '', range: 'Nil' },
    { name: 'MPs: Comment', unit: '', range: 'Nil' },
    { name: 'Widal: S. Typhi O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Typhi H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi A O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi A H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi B O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi B H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi C O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi C H', unit: 'Titer', range: '<1:80' },
    { name: 'H. Pylori', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'mp_widal_hbsag', name: 'MPs, Widal & HBsAg', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'MPs: Parasites', unit: '', range: 'Not Seen' },
    { name: 'MPs: Density (Plus)', unit: '', range: 'Nil' },
    { name: 'MPs: Density (Count)', unit: 'p/µL', range: 'Nil' },
    { name: 'MPs: Species', unit: '', range: 'Nil' },
    { name: 'MPs: Stage', unit: '', range: 'Nil' },
    { name: 'MPs: Comment', unit: '', range: 'Nil' },
    { name: 'Widal: S. Typhi O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Typhi H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi A O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi A H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi B O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi B H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi C O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi C H', unit: 'Titer', range: '<1:80' },
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
  ]},

  // --- SEROLOGY ---
  { id: 'hbsag', name: 'HBsAg', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [{ name: 'HBsAg', unit: '', range: 'Non-Reactive' }]},
  { id: 'hcv', name: 'HCV Antibody', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [{ name: 'HCV', unit: '', range: 'Non-Reactive' }]},
  { id: 'hb_combo', name: 'HB Combo', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
    { name: 'HBsAb', unit: '', range: 'Non-Reactive' },
    { name: 'HBeAg', unit: '', range: 'Non-Reactive' },
    { name: 'HBeAb', unit: '', range: 'Non-Reactive' },
    { name: 'HBcAb', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'vdrl', name: 'VDRL', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [{ name: 'VDRL', unit: '', range: 'Non-Reactive' }]},
  { id: 'rvs', name: 'RVS', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [{ name: 'RVS', unit: '', range: 'Non-Reactive' }]},
  { id: 'hcg', name: 'HCG', department: 'lab', category: 'Serology', specimen: 'Urine/Serum', parameters: [{ name: 'Pregnancy test', unit: '', range: 'Negative' }]},
  { id: 'h_pylori', name: 'H Pylori', department: 'lab', category: 'Serology', specimen: 'Serum/Stool', parameters: [{ name: 'H. Pylori', unit: '', range: 'Non-Reactive' }]},
  { id: 'widal', name: 'WIDAL', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'Widal: S. Typhi O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Typhi H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi A O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi A H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi B O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi B H', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi C O', unit: 'Titer', range: '<1:80' },
    { name: 'Widal: S. Paratyphi C H', unit: 'Titer', range: '<1:80' },
  ]},
  { id: 'rheumatoid_factor', name: 'Rheumatoid Factor', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [{ name: 'Rheumatoid Factor', unit: '', range: 'Negative' }]},
  { id: 'h_pylori_vdrl', name: 'H. Pylori & VDRL', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'H. Pylori', unit: '', range: 'Non-Reactive' },
    { name: 'VDRL', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'hbsag_h_pylori', name: 'HBsAg & H. Pylori', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'H. Pylori', unit: '', range: 'Non-Reactive' },
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'pregnancy_test', name: 'Pregnancy Test', department: 'lab', category: 'Serology', specimen: 'Urine/Serum', parameters: [
    { name: 'Pregnancy test', unit: '', range: 'Negative' },
  ]},

  // --- CHEMICAL PATHOLOGY ---
  { id: 'kft', name: 'Kidney Function Test (E/U/Cr)', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Urea', unit: 'mmol/L', range: '2.3-5.8' },
    { name: 'Creatinine', unit: 'umol/L', range: '53-124' },
    { name: 'Sodium Na+', unit: 'mmole/L', range: '135-145' },
    { name: 'Potassium K+', unit: 'mmole/L', range: '3.5-5.0' },
    { name: 'Chloride Cl-', unit: 'mmole/L', range: '98-106' },
    { name: 'Bicarbonate HCO3-', unit: 'mmole/L', range: '21-31' },
  ]},
  { id: 'lft', name: 'Liver Function Test (LFT)', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'AST', unit: 'U/L', range: '8-37' },
    { name: 'ALT', unit: 'U/L', range: '4-41' },
    { name: 'ALP', unit: 'U/L', range: '35-128' },
    { name: 'TOTAL BILIRUBIN', unit: 'mg/dL', range: '0-2' },
    { name: 'DIRECT BILIRUBIN', unit: 'mg/dL', range: '0-0.2' },
    { name: 'TOTAL PROTEIN', unit: 'g/dL', range: '6.4-8.2' },
    { name: 'ALBUMIN', unit: 'g/dL', range: '3.5-5.2' },
  ]},
  { id: 'lipid', name: 'Lipid Profile', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Total Cholesterol (CHOL)', unit: 'mg/dL', range: '200-239' },
    { name: 'Triglycerides (TRIG)', unit: 'mg/dL', range: 'F: 35-135 / M: 40-160' },
    { name: 'HDL', unit: 'mg/dL', range: 'M: 35-55 / F: 45-65' },
    { name: 'LDL', unit: 'mg/dL', range: '<100' },
  ]},
  { id: 'urea', name: 'Urea', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [{ name: 'Urea', unit: 'mmol/L', range: '2.3-5.8' }]},
  { id: 'creatinine', name: 'Creatinine', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [{ name: 'Creatinine', unit: 'umol/L', range: '53-124' }]},
  { id: 'electrolytes', name: 'Electrolytes', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Sodium Na+', unit: 'mmole/L', range: '135-145' },
    { name: 'Potassium K+', unit: 'mmole/L', range: '3.5-5.0' },
    { name: 'Chloride Cl-', unit: 'mmole/L', range: '98-106' },
    { name: 'Bicarbonate HCO3-', unit: 'mmole/L', range: '21-31' },
  ]},
  { id: 'uric_acid', name: 'Uric Acid', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [{ name: 'Uric Acid', unit: 'mg/dL', range: 'Female: 3.5-6.4 / Male: 2.7-7.3' }]},
  { id: 'hba1c', name: 'HBA1C', department: 'lab', category: 'Chemical Pathology', specimen: 'Whole Blood', parameters: [{ name: 'HbA1c', unit: '%', range: '4.0-6.5' }]},
  { id: 'phosphate', name: 'PO4^3-', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [{ name: 'Po42-', unit: 'mg/dL', range: '2.5-4.4' }]},
  { id: 'calcium', name: 'Ca^2+', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [{ name: 'Ca2+', unit: 'mg/dL', range: '8.5-10.5' }]},
  { id: 'fbs', name: 'Fasting Blood Sugar (FBS)', department: 'lab', category: 'Chemical Pathology', specimen: 'Fluoride Blood', parameters: [{ name: 'FBS', unit: 'mmol/L', range: '3.0-5.6' }]},
  { id: 'rbs', name: 'Random Blood Sugar (RBS)', department: 'lab', category: 'Chemical Pathology', specimen: 'Plasma/Serum', parameters: [{ name: 'RBS', unit: 'mmol/L', range: '4-7' }]},
  { id: 'e_u_cr', name: 'E U Cr', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Urea', unit: 'mmol/L', range: '2.3-5.8' },
    { name: 'Creatinine', unit: 'umol/L', range: '53-124' },
    { name: 'Sodium Na+', unit: 'mmole/L', range: '135-145' },
    { name: 'Potassium K+', unit: 'mmole/L', range: '3.5-5.0' },
    { name: 'Chloride Cl-', unit: 'mmole/L', range: '98-106' },
    { name: 'Bicarbonate HCO3-', unit: 'mmole/L', range: '21-31' },
  ]},
  { id: 'ca_po4_alb_uric', name: 'Ca2+, Po42-, Albumin, Uric Acid', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Ca2+', unit: 'mg/dL', range: '8.5-10.5' },
    { name: 'Po42-', unit: 'mg/dL', range: '2.5-4.4' },
    { name: 'Albumin', unit: 'g/dL', range: '3.5-5.2' },
    { name: 'Uric Acid', unit: 'mg/dL', range: 'Female: 3.5-6.4 / Male: 2.7-7.3' },
  ]},
  { id: 'ca_po4_alb', name: 'Ca2+, Po42-, Albumin', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Ca2+', unit: 'mg/dL', range: '2.2-2.6' },
    { name: 'Po42-', unit: 'mg/dL', range: '0.8-1.5' },
  ]},
  { id: 'calcium_uric_acid', name: 'Calcium & Uric Acid', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Ca2+', unit: 'mg/dL', range: '8.5-10.5' },
    { name: 'Uric Acid', unit: 'mg/dL', range: 'Female: 3.5-6.4 / Male: 2.7-7.3' },
  ]},
  { id: 'hba1c_ca_po4_mg', name: 'HbA1C, Ca2+, Po42-, Mg2+', department: 'lab', category: 'Chemical Pathology', specimen: 'Blood/Serum', parameters: [
    { name: 'HbA1c', unit: '%', range: '4.0-6.5' },
    { name: 'Ca2+', unit: 'mg/dL', range: '8.5-10.5' },
    { name: 'Po42-', unit: 'mg/dL', range: '2.5-4.4' },
    { name: 'Mg2+', unit: 'mg/dL', range: '1.6-2.6' },
  ]},
  { id: 'urea_cr_hpylori_pcv', name: 'Urea, Creatinine, H. Pylori & PCV', department: 'lab', category: 'Chemical Pathology', specimen: 'Blood', parameters: [
    { name: 'Urea', unit: 'mmol/L', range: '2.3-5.8' },
    { name: 'Creatinine', unit: 'umol/L', range: '53-124' },
    { name: 'H. Pylori', unit: '', range: 'Non-Reactive' },
    { name: 'PCV', unit: '%', range: '35-48' },
  ]},
  { id: 'uric_acid_mps_hpylori', name: 'Uric Acid, MPs & H. Pylori', department: 'lab', category: 'Chemical Pathology', specimen: 'Blood', parameters: [
    { name: 'Uric Acid', unit: 'mg/dL', range: 'Female: 3.5-6.4 / Male: 2.7-7.3' },
    { name: 'MPs', unit: '', range: 'Not Seen' },
    { name: 'H. Pylori', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'ogtt', name: 'Oral Glucose Tolerance Test (OGTT)', department: 'lab', category: 'Chemical Pathology', specimen: 'Blood', parameters: [
    { name: 'FBS', unit: 'mmol/L', range: '3.0-5.6' },
    { name: '30 min', unit: 'mmol/L', range: '' },
    { name: '1 hr', unit: 'mmol/L', range: '<11.1' },
    { name: '1 hr 30 min', unit: 'mmol/L', range: '<7.8' },
  ]},

  // --- MICROBIOLOGY ---
  { id: 'urinalysis', name: 'Urinalysis', department: 'lab', category: 'Microbiology', specimen: 'Urine', parameters: [
    { name: 'P.H', unit: '', range: '5.0-8.5' },
    { name: 'Specific Gravity', unit: '', range: '1.001-1.030' },
    { name: 'Urobilinogen', unit: '', range: 'Normal' },
    { name: 'Protein', unit: '', range: 'Negative' },
    { name: 'Nitrate', unit: '', range: 'Negative' },
    { name: 'Bilirubin', unit: '', range: 'Negative' },
    { name: 'Ascorbate', unit: '', range: 'Negative' },
    { name: 'Ketone', unit: '', range: 'Negative' },
    { name: 'Glucose', unit: '', range: 'Negative' },
    { name: 'Blood', unit: '', range: 'Negative' },
    { name: 'Leucocytes', unit: '', range: 'Negative' },
  ]},
  { id: 'urine_microscopy', name: 'Urine Microscopy', department: 'lab', category: 'Microbiology', specimen: 'Urine', parameters: [
    { name: 'RBS', unit: '', range: 'Nil' },
    { name: 'WBC', unit: '', range: 'Nil' },
    { name: 'Epithelial cell', unit: '', range: 'Nil' },
    { name: 'Pus cells', unit: '/hpf', range: '0-2' },
    { name: 'Casts', unit: '', range: 'Nil' },
    { name: 'Crystals', unit: '', range: 'Nil' },
    { name: 'Bacteria', unit: '', range: 'Nil' },
    { name: 'Yeast', unit: '', range: 'Nil' },
    { name: 'Parasites', unit: '', range: 'Nil' },
    { name: 'Others', unit: '', range: 'Nil' },
  ]},
  { id: 'urine_mcs', name: 'Urine MCS', department: 'lab', category: 'Microbiology', specimen: 'Urine', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},
  { id: 'stool_microscopy', name: 'Stool Microscopy', department: 'lab', category: 'Microbiology', specimen: 'Stool', parameters: [
    { name: 'Consistency', unit: '', range: '' },
    { name: 'Microscopy (Ova)', unit: '', range: 'Not Seen' },
    { name: 'Microscopy (Cysts)', unit: '', range: 'Not Seen' },
  ]},
  { id: 'stool_mcs', name: 'Stool MCS', department: 'lab', category: 'Microbiology', specimen: 'Stool', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},
  { id: 'hvs_mcs', name: 'HVS MCS', department: 'lab', category: 'Microbiology', specimen: 'HVS Swab', parameters: [
    { name: 'Microscopy (Pus Cells)', unit: '/hpf', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},
  { id: 'throat_swab_mcs', name: 'Throat Swab MCS', department: 'lab', category: 'Microbiology', specimen: 'Throat Swab', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},
  { id: 'sputum_mcs', name: 'Sputum MCS', department: 'lab', category: 'Microbiology', specimen: 'Sputum', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},
  { id: 'sfa', name: 'SFA', department: 'lab', category: 'Microbiology', specimen: 'Seminal Fluid', parameters: [
    { name: 'Volume', unit: 'ml', range: '>1.5' },
    { name: 'Count', unit: 'x10^6/ml', range: '>15' },
    { name: 'Motility', unit: '%', range: '' },
  ]},
  { id: 'sfmcs', name: 'SFMCS', department: 'lab', category: 'Microbiology', specimen: 'Seminal Fluid', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
  ]},
  { id: 'wound_swab_mcs', name: 'Wound Swab MCS', department: 'lab', category: 'Microbiology', specimen: 'Wound Swab', parameters: [
    { name: 'Microscopy', unit: '', range: '' },
    { name: 'Culture (Growth)', unit: '', range: '' },
    { name: 'Antibiotic Sensitivity', unit: '', range: '' },
  ]},

  // --- ULTRASOUND ---
  { id: 'us_obs', name: 'Obstetric', department: 'radiology', category: 'Ultrasound', specimen: 'Scan', parameters: [
    { name: 'Presentation', unit: '', range: '' },
    { name: 'FHR', unit: 'bpm', range: '120-160' },
    { name: 'GA', unit: 'wks', range: '' },
    { name: 'Impression', unit: '', range: '' },
  ]},
  { id: 'us_pelvic', name: 'Pelvic', department: 'radiology', category: 'Ultrasound', specimen: 'Scan', parameters: [
    { name: 'Uterus', unit: '', range: '' },
    { name: 'Impression', unit: '', range: '' },
  ]},
  { id: 'us_abd_pelvis', name: 'Abdomino Pelvic', department: 'radiology', category: 'Ultrasound', specimen: 'Scan', parameters: [
    { name: 'Liver/Gallbladder', unit: '', range: '' },
    { name: 'Impression', unit: '', range: '' },
  ]},

  // --- HORMONES ---
  { id: 'psa', name: 'PSA', department: 'lab', category: 'Hormones', specimen: 'Serum', parameters: [{ name: 'PSA', unit: 'ng/mL', range: '<4.0' }]},
  { id: 'progesterone', name: 'Progesterone', department: 'lab', category: 'Hormones', specimen: 'Serum', parameters: [{ name: 'Progesterone', unit: 'ng/mL', range: '' }]},
  { id: 'testosterone', name: 'Testosterone', department: 'lab', category: 'Hormones', specimen: 'Serum', parameters: [{ name: 'Testosterone', unit: 'ng/mL', range: '' }]},
  { id: 'tft', name: 'Thyroid Function Test (TFT)', department: 'lab', category: 'Hormones', specimen: 'Serum', parameters: [
    { name: 'T3', unit: 'nmol/L', range: '1.3-3.1' },
    { name: 'T4', unit: 'nmol/L', range: '66-181' },
    { name: 'TSH', unit: 'uIU/mL', range: '0.4-4.0' },
  ]},

  // --- SPECIAL HEALTH CHECK PLANS ---
  { id: 'pkg_premarital', name: 'Premarital Screening', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood', parameters: [
    { name: 'RVS', unit: '', range: 'Non-Reactive' },
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
    { name: 'Hb Genotype', unit: '', range: '' },
  ]},
  { id: 'pkg_premarital_silver', name: 'Premarital Screening (Silver)', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood', parameters: [
    { name: 'RVS', unit: '', range: 'Non-Reactive' },
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
    { name: 'Hb Genotype', unit: '', range: '' },
    { name: 'PT', unit: '', range: 'Negative' },
  ]},
  { id: 'pkg_premarital_gold', name: 'Premarital Screening (Gold)', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood', parameters: [
    { name: 'RVS', unit: '', range: 'Non-Reactive' },
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
    { name: 'Hb Genotype', unit: '', range: '' },
    { name: 'PT', unit: '', range: 'Negative' },
    { name: 'Blood Group', unit: '', range: '' },
    { name: 'Rhesus Factor', unit: '', range: '' },
  ]},
  { id: 'pkg_premarital_diamond', name: 'Premarital Screening (Diamond)', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood', parameters: [
    { name: 'RVS', unit: '', range: 'Non-Reactive' },
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
    { name: 'HCV', unit: '', range: 'Non-Reactive' },
    { name: 'VDRL', unit: '', range: 'Non-Reactive' },
    { name: 'Hb Genotype', unit: '', range: '' },
    { name: 'Blood Group', unit: '', range: '' },
    { name: 'Rhesus Factor', unit: '', range: '' },
    { name: 'PT', unit: '', range: 'Negative' },
  ]},
  { id: 'pkg_antenatal', name: 'Antenatal Screening', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood', parameters: [
    { name: 'Blood Group', unit: '', range: '' },
    { name: 'Rhesus Factor', unit: '', range: '' },
    { name: 'Hb Genotype', unit: '', range: '' },
    { name: 'RVS', unit: '', range: 'Non-Reactive' },
    { name: 'MPs', unit: '', range: 'Not Seen' },
    { name: 'PCV', unit: '%', range: '35-48' },
    { name: 'P.H', unit: '', range: '5.0-8.5' },
    { name: 'Specific Gravity', unit: '', range: '1.001-1.030' },
    { name: 'Urobilinogen', unit: '', range: 'Normal' },
    { name: 'Protein', unit: '', range: 'Negative' },
    { name: 'Nitrate', unit: '', range: 'Negative' },
    { name: 'Bilirubin', unit: '', range: 'Negative' },
    { name: 'Ascorbate', unit: '', range: 'Negative' },
    { name: 'Ketone', unit: '', range: 'Negative' },
    { name: 'Glucose', unit: '', range: 'Negative' },
    { name: 'Blood', unit: '', range: 'Negative' },
    { name: 'Leucocytes', unit: '', range: 'Negative' },
  ]},
  { id: 'pkg_health_checkup', name: 'Health Check Up', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood/Urine', parameters: [
    { name: 'Blood Group', unit: '', range: '' },
    { name: 'Rhesus Factor', unit: '', range: '' },
    { name: 'Hb Genotype', unit: '', range: '' },
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
    { name: 'HCV', unit: '', range: 'Non-Reactive' },
    { name: 'RVS', unit: '', range: 'Non-Reactive' },
    { name: 'VDRL', unit: '', range: 'Non-Reactive' },
    { name: 'P.H', unit: '', range: '5.0-8.5' },
    { name: 'Specific Gravity', unit: '', range: '1.001-1.030' },
    { name: 'Urobilinogen', unit: '', range: 'Normal' },
    { name: 'Protein', unit: '', range: 'Negative' },
    { name: 'Nitrate', unit: '', range: 'Negative' },
    { name: 'Bilirubin', unit: '', range: 'Negative' },
    { name: 'Ascorbate', unit: '', range: 'Negative' },
    { name: 'Ketone', unit: '', range: 'Negative' },
    { name: 'Glucose', unit: '', range: 'Negative' },
    { name: 'Blood', unit: '', range: 'Negative' },
    { name: 'Leucocytes', unit: '', range: 'Negative' },
  ]},
  { id: 'pkg_health_screening', name: 'Health Screening', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood', parameters: [
    { name: 'Blood Group', unit: '', range: '' },
    { name: 'Rhesus Factor', unit: '', range: '' },
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
    { name: 'HCV', unit: '', range: 'Non-Reactive' },
    { name: 'RVS', unit: '', range: 'Non-Reactive' },
    { name: 'MPs', unit: '', range: 'Not Seen' },
  ]},
  { id: 'pkg_basic', name: 'Basic', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood/Urine', parameters: [{ name: 'Basic Profile', unit: '', range: '' }]},
  { id: 'pkg_silver', name: 'Silver', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood/Urine', parameters: [{ name: 'Silver Profile', unit: '', range: '' }]},
  { id: 'pkg_gold', name: 'Gold', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood/Urine', parameters: [{ name: 'Gold Profile', unit: '', range: '' }]},
  { id: 'pkg_diamond', name: 'Diamond', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood/Urine', parameters: [{ name: 'Diamond Profile', unit: '', range: '' }]},
];

// ─── ORG-SCOPED DATA FUNCTIONS ────────────────────────────────────────────────

export const generateSlipNumber = async (organizationId: string): Promise<string> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/patients?organizationId=${organizationId}`);
    const patients = await res.json();
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;
    const todayPrefix = `ATD/${dateStr}/`;
    const todayPatients = patients.filter((p: any) => p.slipNumber && p.slipNumber.startsWith(todayPrefix));
    const num = todayPatients.length + 1;
    return `ATD/${dateStr}/${num.toString().padStart(4, '0')}`;
  }

  const supabase = createClient();
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  const { count } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('registered_at', new Date(y, date.getMonth(), date.getDate()).toISOString());
  const num = (count || 0) + 1;
  return `ATD/${dateStr}/${num.toString().padStart(4, '0')}`;
};

export const fetchPatients = async (organizationId: string): Promise<Patient[]> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/patients?organizationId=${organizationId}`);
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('patients')
    .select('*, tests:patient_tests(*)')
    .eq('organization_id', organizationId)
    .order('registered_at', { ascending: false });

  if (error) { console.error('Error fetching patients:', error); return []; }

  return (data || []).map((p: any) => ({
    ...p,
    slipNumber: p.slip_number,
    registeredAt: p.registered_at,
    firstName: p.first_name,
    surname: p.surname,
    middle_name: p.middle_name,
    referredBy: p.referred_by,
    referringFacility: p.referring_facility,
    referringDoctorId: p.referring_doctor_id,
    referringFacilityId: p.referring_facility_id,
    commissionAssigned: p.commission_assigned,
    commissionType: p.commission_type,
    commissionValue: p.commission_value,
    commissionAmount: p.commission_amount,
    commissionStatus: p.commission_status,
    commissionPaidAt: p.commission_paid_at,
    commissionPaidNotes: p.commission_paid_notes,
    totalAmount: p.total_amount,
    discountType: p.discount_type,
    discountValue: p.discount_value,
    discountAmount: p.discount_amount,
    netAmount: p.net_amount,
    paidAmount: p.paid_amount,
    paymentStatus: p.payment_status,
    paymentMethod: p.payment_method,
    billingAccountId: p.billing_account_id,
    patientProfileId: p.patient_profile_id,
    tests: (p.tests || []).map((t: any) => ({
      ...t,
      testId: t.test_id,
      testName: t.test_name,
      completedBy: t.completed_by,
      completedBySignatureUrl: t.completed_by_signature_url,
      completedByTitle: t.completed_by_title,
      completedAt: t.completed_at,
      price: t.price,
      commissionType: t.commission_type,
      commissionValue: t.commission_value,
      commissionAmount: t.commission_amount,
    }))
  }));
};

export const fetchPatientProfiles = async (organizationId: string): Promise<PatientProfile[]> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/patients?action=getPatientProfiles&organizationId=${organizationId}`);
    if (!res.ok) return [];
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('patient_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) { console.error('Error fetching patient profiles:', error); return []; }
  return (data || []).map((p: any) => ({
    id: p.id,
    organizationId: p.organization_id,
    firstName: p.first_name,
    surname: p.surname,
    middleName: p.middle_name,
    phone: p.phone,
    email: p.email,
    address: p.address,
    sex: p.sex,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
};

export const addPatient = async (
  patient: Omit<Patient, 'id' | 'tests'> & { id?: number },
  tests: Omit<PatientTest, 'id' | 'patient_id'>[],
  organizationId: string
): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addPatient', patient, tests, organizationId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add patient locally');
    }
    return;
  }

  const generatedPatientId = patient.id || Math.floor(10000000 + Math.random() * 90000000);
  let generatedProfileId = patient.patientProfileId;

  const supabase = createClient();

  // If new patient profile (not returning), we must insert a new profile in Supabase first
  if (!generatedProfileId) {
    generatedProfileId = Math.floor(10000000 + Math.random() * 90000000);
    const { error: profError } = await supabase
      .from('patient_profiles')
      .insert([{
        id: generatedProfileId,
        organization_id: organizationId,
        first_name: patient.firstName,
        surname: patient.surname,
        middle_name: patient.middleName || null,
        phone: patient.phone,
        email: patient.email || null,
        address: patient.address,
        sex: patient.sex,
      }]);
    if (profError) throw profError;
  }

  const { error: pError } = await supabase
    .from('patients')
    .insert([{
      id: generatedPatientId,
      patient_profile_id: generatedProfileId,
      slip_number: patient.slipNumber,
      first_name: patient.firstName,
      surname: patient.surname,
      middle_name: patient.middleName,
      age: patient.age,
      sex: patient.sex,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      referred_by: patient.referredBy,
      referring_facility: patient.referringFacility,
      referring_doctor_id: patient.referringDoctorId || null,
      referring_facility_id: patient.referringFacilityId || null,
      organization_id: organizationId,
      billing_account_id: patient.billingAccountId || null,
    }]);
  if (pError) throw pError;

  const testsToInsert = tests.map(t => ({
    patient_id: generatedPatientId,
    test_id: t.testId,
    test_name: t.testName,
    department: t.department,
    status: t.status,
    specimen: t.specimen,
    organization_id: organizationId,
  }));
  const { error: tError } = await supabase.from('patient_tests').insert(testsToInsert);
  if (tError) throw tError;
};

export const updateTestResult = async (testId: string, updates: Partial<PatientTest>): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateTestResult', testId, updates })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update test result locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('patient_tests')
    .update({
      status: updates.status,
      results: updates.results,
      completed_by: updates.completedBy,
      completed_by_signature_url: updates.completedBySignatureUrl,
      completed_by_title: updates.completedByTitle,
      completed_at: updates.completedAt,
      notes: updates.notes,
      specimen: updates.specimen,
    })
    .eq('id', testId);
  if (error) throw error;
};

export const subscribeToPatients = (organizationId: string, callback: () => void) => {
  if (IS_LOCAL_MODE) {
    // Poll the local API every 5 seconds to get updates in local LAN mode
    const interval = setInterval(callback, 5000);
    return () => clearInterval(interval);
  }

  const supabase = createClient();
  const channel = supabase.channel(`patients-org-${organizationId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'patients',
      filter: `organization_id=eq.${organizationId}`
    }, callback)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'patient_tests',
      filter: `organization_id=eq.${organizationId}`
    }, callback)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

let customCatalogueCache: Test[] = [];

export const setCustomCatalogueCache = (tests: Test[]) => {
  customCatalogueCache = tests;
};

export const getTestById = (id: string): Test | undefined => {
  const cached = customCatalogueCache.find(t => t.id === id);
  if (cached) return cached;
  return TEST_CATALOGUE.find(t => t.id === id);
};

// ─── REFERRING FACILITIES ─────────────────────────────────────────────────────

export interface ReferringFacility {
  id: string;
  organization_id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  commission_type: 'percentage' | 'flat';
  commission_value: number;
  is_active: boolean;
  created_at: string;
}

export const fetchReferringFacilities = async (organizationId: string): Promise<ReferringFacility[]> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/referrals?type=facilities&organizationId=${organizationId}`);
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('referring_facilities')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });
  if (error) { console.error('fetchReferringFacilities error:', error); return []; }
  return data || [];
};

export const addReferringFacility = async (facility: Omit<ReferringFacility, 'id' | 'created_at'>, organizationId: string): Promise<ReferringFacility> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'facility', action: 'add', facility, organizationId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add referring facility locally');
    }
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('referring_facilities')
    .insert([{ ...facility, organization_id: organizationId }])
    .select().single();
  if (error) throw error;
  return data;
};

export const updateReferringFacility = async (id: string, updates: Partial<ReferringFacility>): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'facility', action: 'update', id, updates })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update referring facility locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.from('referring_facilities').update(updates).eq('id', id);
  if (error) throw error;
};

export const deleteReferringFacility = async (id: string): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'facility', action: 'delete', id })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete referring facility locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.from('referring_facilities').delete().eq('id', id);
  if (error) throw error;
};

// ─── REFERRING DOCTORS ────────────────────────────────────────────────────────

export interface ReferringDoctor {
  id: string;
  organization_id: string;
  facility_id?: string;
  facility_name?: string; // joined
  name: string;
  phone?: string;
  email?: string;
  commission_type: 'percentage' | 'flat';
  commission_value: number;
  is_active: boolean;
  created_at: string;
}

export const fetchReferringDoctors = async (organizationId: string): Promise<ReferringDoctor[]> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/referrals?type=doctors&organizationId=${organizationId}`);
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('referring_doctors')
    .select('*, referring_facilities(name)')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });
  if (error) { console.error('fetchReferringDoctors error:', error); return []; }
  return (data || []).map((d: any) => ({ ...d, facility_name: d.referring_facilities?.name }));
};

export const addReferringDoctor = async (doctor: Omit<ReferringDoctor, 'id' | 'created_at' | 'facility_name'>, organizationId: string): Promise<ReferringDoctor> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'doctor', action: 'add', doctor, organizationId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add referring doctor locally');
    }
    return res.json();
  }

  const supabase = createClient();
  const { facility_name, ...rest } = doctor as any;
  const { data, error } = await supabase
    .from('referring_doctors')
    .insert([{ ...rest, organization_id: organizationId }])
    .select().single();
  if (error) throw error;
  return data;
};

export const updateReferringDoctor = async (id: string, updates: Partial<ReferringDoctor>): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'doctor', action: 'update', id, updates })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update referring doctor locally');
    }
    return;
  }

  const supabase = createClient();
  const { facility_name, ...rest } = updates as any;
  const { error } = await supabase.from('referring_doctors').update(rest).eq('id', id);
  if (error) throw error;
};

export const deleteReferringDoctor = async (id: string): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'doctor', action: 'delete', id })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete referring doctor locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.from('referring_doctors').delete().eq('id', id);
  if (error) throw error;
};

export interface TestPrice {
  id?: string;
  organization_id: string;
  test_id: string;
  test_name: string;
  price: number;
  commission_type?: 'percentage' | 'flat' | 'none';
  commission_value?: number;
}

export const fetchTestPrices = async (organizationId: string): Promise<TestPrice[]> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/test-prices?organizationId=${organizationId}`);
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('test_prices')
    .select('*')
    .eq('organization_id', organizationId);
  if (error) { console.error('fetchTestPrices error:', error); return []; }
  return data || [];
};

export const upsertTestPrices = async (prices: Omit<TestPrice, 'id'>[], organizationId: string): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/test-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prices, organizationId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to upsert test prices locally');
    }
    return;
  }

  const supabase = createClient();
  const rows = prices.map(p => ({
    organization_id: organizationId,
    test_id: p.test_id || (p as any).testId,
    test_name: p.test_name || (p as any).testName,
    price: p.price,
    commission_type: p.commission_type || 'percentage',
    commission_value: p.commission_value || 0,
  }));
  const { error } = await supabase
    .from('test_prices')
    .upsert(rows, { onConflict: 'organization_id,test_id' });
  if (error) throw error;
};

// ─── COMMISSION REPORT ────────────────────────────────────────────────────────

export interface CommissionEntry {
  patientId: string;
  patientName: string;
  slipNumber: string;
  registeredAt: string;
  referrerName: string;
  referrerType: 'doctor' | 'facility';
  commissionType: 'percentage' | 'flat' | 'none' | 'varies';
  commissionValue: number;
  tests: { testId: string; testName: string; price: number; commissionType?: string; commissionValue?: number; commissionAmount?: number }[];
  totalAmount: number;
  commissionAmount: number;
  commissionStatus: 'pending' | 'paid';
  commissionPaidAt?: string;
  commissionPaidNotes?: string;
}

export const fetchCommissionReport = async (organizationId: string, from?: string, to?: string): Promise<CommissionEntry[]> => {
  // Pull core arrays
  const [patients, prices, doctors, facilities] = await Promise.all([
    fetchPatients(organizationId),
    fetchTestPrices(organizationId),
    fetchReferringDoctors(organizationId),
    fetchReferringFacilities(organizationId),
  ]);

  // Filter patients with commission
  let filteredPatients = patients.filter(p => p.commissionAssigned);
  if (from) {
    filteredPatients = filteredPatients.filter(p => p.registeredAt >= from);
  }
  if (to) {
    filteredPatients = filteredPatients.filter(p => p.registeredAt <= to);
  }

  const priceMap = new Map(prices.map(p => [p.test_id || (p as any).testId, p.price]));
  const doctorMap = new Map(doctors.map(d => [d.id, d]));
  const facilityMap = new Map(facilities.map(f => [f.id, f]));

  return filteredPatients.map((p: any) => {
    const tests = (p.tests || []).map((t: any) => ({
      testId: t.testId,
      testName: t.testName,
      price: t.price || priceMap.get(t.testId) || 0,
      commissionType: t.commissionType || 'none',
      commissionValue: t.commissionValue || 0,
      commissionAmount: t.commissionAmount || 0,
    }));
    const totalAmount = tests.reduce((sum: number, t: any) => sum + t.price, 0);

    let referrerName = p.referredBy || '—';
    let referrerType: 'doctor' | 'facility' = 'doctor';

    if (p.referringDoctorId && doctorMap.has(p.referringDoctorId)) {
      referrerName = doctorMap.get(p.referringDoctorId)!.name;
      referrerType = 'doctor';
    } else if (p.referringFacilityId && facilityMap.has(p.referringFacilityId)) {
      referrerName = facilityMap.get(p.referringFacilityId)!.name;
      referrerType = 'facility';
    } else if (p.referringFacility) {
      referrerName = p.referringFacility;
      referrerType = 'facility';
    }

    return {
      patientId: p.id,
      patientName: `${p.firstName} ${p.surname}`,
      slipNumber: p.slipNumber,
      registeredAt: p.registeredAt,
      referrerName,
      referrerType,
      commissionType: 'varies',
      commissionValue: 0,
      tests,
      totalAmount,
      commissionAmount: p.commissionAmount || 0,
      commissionStatus: p.commissionStatus || 'pending',
      commissionPaidAt: p.commissionPaidAt,
      commissionPaidNotes: p.commissionPaidNotes,
    };
  });
};

// ─── PATIENT (updated) with referring_doctor_id support ───────────────────────

export const addPatientWithReferral = async (
  patient: Omit<Patient, 'id' | 'tests'> & { id?: number },
  tests: Omit<PatientTest, 'id' | 'patient_id'>[],
  organizationId: string
): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addPatient', patient, tests, organizationId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add patient referral locally');
    }
    return;
  }

  const generatedPatientId = patient.id || Math.floor(10000000 + Math.random() * 90000000);
  let generatedProfileId = patient.patientProfileId;

  const supabase = createClient();

  if (!generatedProfileId) {
    generatedProfileId = Math.floor(10000000 + Math.random() * 90000000);
    const { error: profError } = await supabase
      .from('patient_profiles')
      .insert([{
        id: generatedProfileId,
        organization_id: organizationId,
        first_name: patient.firstName,
        surname: patient.surname,
        middle_name: patient.middleName || null,
        phone: patient.phone,
        email: patient.email || null,
        address: patient.address,
        sex: patient.sex,
      }]);
    if (profError) throw profError;
  }

  const { error: pError } = await supabase
    .from('patients')
    .insert([{
      id: generatedPatientId,
      patient_profile_id: generatedProfileId,
      slip_number: patient.slipNumber,
      first_name: patient.firstName,
      surname: patient.surname,
      middle_name: patient.middleName,
      age: patient.age,
      sex: patient.sex,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      referred_by: patient.referredBy,
      referring_facility: patient.referringFacility,
      referring_doctor_id: patient.referringDoctorId || null,
      referring_facility_id: patient.referringFacilityId || null,
      commission_assigned: patient.commissionAssigned ?? false,
      commission_type: patient.commissionType || null,
      commission_value: patient.commissionValue ?? null,
      commission_amount: patient.commissionAmount ?? null,
      commission_status: patient.commissionAssigned ? 'pending' : null,
      total_amount: patient.totalAmount ?? 0,
      discount_type: patient.discountType || 'none',
      discount_value: patient.discountValue ?? 0,
      discount_amount: patient.discountAmount ?? 0,
      net_amount: patient.netAmount ?? 0,
      paid_amount: patient.paidAmount ?? 0,
      payment_status: patient.paymentStatus || 'paid',
      payment_method: patient.paymentMethod || 'cash',
      organization_id: organizationId,
      billing_account_id: patient.billingAccountId || null,
    }]);
  if (pError) throw pError;

  const testsToInsert = tests.map(t => ({
    patient_id: generatedPatientId,
    test_id: t.testId,
    test_name: t.testName,
    department: t.department,
    status: t.status,
    specimen: t.specimen,
    price: t.price ?? 0,
    commission_type: t.commissionType || 'none',
    commission_value: t.commissionValue ?? 0,
    commission_amount: t.commissionAmount ?? 0,
    organization_id: organizationId,
  }));
  const { error: tError } = await supabase.from('patient_tests').insert(testsToInsert);
  if (tError) throw tError;
};

export const updatePatient = async (id: number | string, updates: Partial<Patient>): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updatePatient', patientId: id, updates })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update patient locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.from('patients').update({
    first_name: updates.firstName,
    surname: updates.surname,
    middle_name: updates.middleName,
    age: updates.age,
    sex: updates.sex,
    phone: updates.phone,
    email: updates.email,
    address: updates.address,
    referred_by: updates.referredBy,
    referring_facility: updates.referringFacility,
    name: updates.name,
  }).eq('id', id);
  if (error) throw error;
};

export const markCommissionPaid = async (patientId: number | string, notes?: string): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markCommissionPaid', patientId, notes })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to mark commission paid locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.from('patients').update({
    commission_status: 'paid',
    commission_paid_at: new Date().toISOString(),
    commission_paid_notes: notes || null,
  }).eq('id', patientId);
  if (error) throw error;
};

export const markCommissionsUnpaid = async (patientIds: (number | string)[]): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markCommissionsUnpaid', patientIds })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to mark commissions unpaid locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.from('patients').update({
    commission_status: 'pending',
    commission_paid_at: null,
    commission_paid_notes: null,
  }).in('id', patientIds);
  if (error) throw error;
};

// ─── RADIOLOGY TEMPLATES ──────────────────────────────────────────────────────

export interface RadiologyTemplate {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  findings: string;
  impression: string;
  created_at?: string;
  created_by?: string;
}

export const fetchCustomTemplates = async (organizationId: string): Promise<RadiologyTemplate[]> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/radiology-templates?organizationId=${organizationId}`);
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('radiology_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });
  if (error) { console.error('fetchCustomTemplates error:', error); return []; }
  return data || [];
};

export const addCustomTemplate = async (
  template: Omit<RadiologyTemplate, 'id' | 'created_at'>,
  userId?: string
): Promise<RadiologyTemplate> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/radiology-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', template, userId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add template locally');
    }
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('radiology_templates')
    .insert([{ ...template, created_by: userId }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateCustomTemplate = async (id: string, updates: Partial<RadiologyTemplate>): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/radiology-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, updates })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update template locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('radiology_templates')
    .update({
      key: updates.key,
      name: updates.name,
      findings: updates.findings,
      impression: updates.impression,
    })
    .eq('id', id);
  if (error) throw error;
};

export const deleteCustomTemplate = async (id: string): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/radiology-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete template locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('radiology_templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// ─── DYNAMIC CUSTOM TESTS ─────────────────────────────────────────────────────

export const fetchCustomTests = async (organizationId: string): Promise<Test[]> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/custom-tests?organizationId=${organizationId}`);
    if (!res.ok) return [];
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('custom_tests')
    .select('*')
    .eq('organization_id', organizationId);
  if (error) {
    console.error('Error fetching custom tests:', error);
    return [];
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    department: t.department,
    category: t.category,
    specimen: t.specimen,
    parameters: typeof t.parameters === 'string' ? JSON.parse(t.parameters) : t.parameters,
    is_active: t.is_active
  }));
};

export const addCustomTest = async (test: Omit<Test, 'is_active'> & { is_active?: boolean }, organizationId: string): Promise<void> => {
  const payload = {
    id: test.id,
    organization_id: organizationId,
    name: test.name,
    department: test.department,
    category: test.category,
    specimen: test.specimen,
    parameters: JSON.stringify(test.parameters),
    is_active: test.is_active === false ? 0 : 1,
    updated_at: new Date().toISOString()
  };

  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/custom-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', test: payload, organizationId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add custom test locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('custom_tests')
    .insert([{
      ...payload,
      parameters: test.parameters,
      is_active: test.is_active !== false
    }]);
  if (error) throw error;
};

export const updateCustomTest = async (id: string, updates: Partial<Test>, organizationId: string): Promise<void> => {
  const payload: any = {
    updated_at: new Date().toISOString()
  };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.department !== undefined) payload.department = updates.department;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.specimen !== undefined) payload.specimen = updates.specimen;
  if (updates.parameters !== undefined) payload.parameters = JSON.stringify(updates.parameters);
  if (updates.is_active !== undefined) payload.is_active = updates.is_active ? 1 : 0;

  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/custom-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, updates: payload, organizationId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update custom test locally');
    }
    return;
  }

  const supabase = createClient();
  if ('is_active' in payload) {
    payload.is_active = payload.is_active === 1;
  }
  if (payload.parameters) {
    payload.parameters = JSON.parse(payload.parameters);
  }
  const { error } = await supabase
    .from('custom_tests')
    .update(payload)
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw error;
};

export const deleteCustomTest = async (id: string, organizationId: string): Promise<void> => {
  const isDefault = TEST_CATALOGUE.some(t => t.id === id);

  if (isDefault) {
    const defaultTest = TEST_CATALOGUE.find(t => t.id === id)!;
    await updateCustomTest(id, { ...defaultTest, is_active: false }, organizationId);
    return;
  }

  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/custom-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id, organizationId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete custom test locally');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('custom_tests')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw error;
};

// ─── BILLING AND WALLET SYSTEM ────────────────────────────────────────────────

export interface BillingAccount {
  id: string;
  organization_id: string;
  name: string;
  owner_patient_id: string | number;
  balance: number;
  credit_limit: number;
  type: 'individual' | 'family' | 'corporate';
  created_at: string;
  updated_at: string;
}

export interface BillingLedgerTransaction {
  id: string;
  organization_id: string;
  billing_account_id: string;
  patient_id?: string | number;
  type: 'deposit' | 'charge' | 'refund' | 'adjustment';
  amount: number; // positive for credit/deposit, negative for debit/charge
  description: string;
  reference_id?: string;
  payment_method?: string;
  created_by?: string;
  created_at: string;
}

export interface ExternalDepartmentCharge {
  id: string;
  organizationId: string;
  patientId: string;
  billingAccountId?: string;
  department: string;
  receiptNumber: string;
  amount: number;
  paymentMethod: string;
  status: 'paid' | 'pending';
  description?: string;
  createdBy?: string;
  createdAt: string;
  patientName?: string;
  patientSlip?: string;
}

export const fetchBillingAccounts = async (organizationId: string): Promise<BillingAccount[]> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/billing?type=accounts&organizationId=${organizationId}`);
    if (!res.ok) throw new Error('Failed to fetch billing accounts');
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('billing_accounts')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });
  if (error) { console.error('fetchBillingAccounts error:', error); return []; }
  return data || [];
};

export const fetchPatientWallet = async (patientId: number | string): Promise<BillingAccount | null> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/billing?type=patient_wallet&patientId=${patientId}`);
    if (!res.ok) return null;
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('patients')
    .select('billing_account_id, billing_accounts(*)')
    .eq('id', patientId)
    .maybeSingle();
  if (error || !data || !data.billing_accounts) return null;
  return data.billing_accounts as any;
};

export const createBillingAccount = async (
  account: Omit<BillingAccount, 'id' | 'balance' | 'created_at' | 'updated_at'>,
  initialDeposit: number,
  paymentMethod: string,
  linkedPatientIds: (string | number)[],
  createdBy: string
): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createAccount',
        account,
        initialDeposit,
        paymentMethod,
        linkedPatientIds,
        createdBy,
        organizationId: account.organization_id
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create billing account');
    }
    return;
  }

  const supabase = createClient();
  const accountId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error: accError } = await supabase.from('billing_accounts').insert([{
    id: accountId,
    organization_id: account.organization_id,
    name: account.name,
    owner_patient_id: account.owner_patient_id,
    balance: initialDeposit,
    credit_limit: account.credit_limit || 0,
    type: account.type,
    created_at: now,
    updated_at: now
  }]);
  if (accError) throw accError;

  const allPatientIds = Array.from(new Set([account.owner_patient_id, ...linkedPatientIds]));
  const { error: linkError } = await supabase
    .from('patients')
    .update({ billing_account_id: accountId })
    .in('id', allPatientIds);
  if (linkError) throw linkError;

  if (initialDeposit > 0) {
    const { error: ledError } = await supabase.from('billing_ledger_transactions').insert([{
      id: crypto.randomUUID(),
      organization_id: account.organization_id,
      billing_account_id: accountId,
      patient_id: account.owner_patient_id,
      type: 'deposit',
      amount: initialDeposit,
      description: 'Initial deposit upon account opening',
      payment_method: paymentMethod,
      created_by: createdBy,
      created_at: now
    }]);
    if (ledError) throw ledError;
  }
};

export const depositToBillingAccount = async (
  accountId: string,
  amount: number,
  description: string,
  paymentMethod: string,
  createdBy: string,
  organizationId: string,
  patientId?: number | string
): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deposit',
        accountId,
        amount,
        description,
        paymentMethod,
        createdBy,
        organizationId,
        patientId
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to process deposit');
    }
    return;
  }

  const supabase = createClient();
  const now = new Date().toISOString();

  const { data: acc, error: accErr } = await supabase
    .from('billing_accounts')
    .select('balance')
    .eq('id', accountId)
    .single();
  if (accErr) throw accErr;

  const newBalance = (acc.balance || 0) + amount;

  const { error: upErr } = await supabase
    .from('billing_accounts')
    .update({ balance: newBalance, updated_at: now })
    .eq('id', accountId);
  if (upErr) throw upErr;

  const { error: ledErr } = await supabase.from('billing_ledger_transactions').insert([{
    id: crypto.randomUUID(),
    organization_id: organizationId,
    billing_account_id: accountId,
    patient_id: patientId || null,
    type: 'deposit',
    amount,
    description,
    payment_method: paymentMethod,
    created_by: createdBy,
    created_at: now
  }]);
  if (ledErr) throw ledErr;
};

export const logExternalCharge = async (
  charge: Omit<ExternalDepartmentCharge, 'id' | 'createdAt'>
): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'logExternalCharge',
        charge
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to log external charge');
    }
    return;
  }

  const supabase = createClient();
  const chargeId = crypto.randomUUID();
  const now = new Date().toISOString();

  if (charge.paymentMethod === 'wallet' && charge.billingAccountId) {
    const { data: acc, error: accErr } = await supabase
      .from('billing_accounts')
      .select('balance, credit_limit')
      .eq('id', charge.billingAccountId)
      .single();
    if (accErr) throw accErr;

    const currentBalance = acc.balance || 0;
    const creditLimit = acc.credit_limit || 0;
    const chargeAmount = charge.amount;

    if (currentBalance + creditLimit < chargeAmount) {
      throw new Error(`Insufficient wallet balance. Available credit: ₦${(currentBalance + creditLimit).toLocaleString('en-NG')}`);
    }

    const newBalance = currentBalance - chargeAmount;

    const { error: upErr } = await supabase
      .from('billing_accounts')
      .update({ balance: newBalance, updated_at: now })
      .eq('id', charge.billingAccountId);
    if (upErr) throw upErr;

    const { error: ledErr } = await supabase.from('billing_ledger_transactions').insert([{
      id: crypto.randomUUID(),
      organization_id: charge.organizationId,
      billing_account_id: charge.billingAccountId,
      patient_id: charge.patientId,
      type: 'charge',
      amount: -chargeAmount,
      description: `${charge.department.toUpperCase()} Bill - Ref: ${charge.receiptNumber}`,
      reference_id: charge.receiptNumber,
      payment_method: 'wallet',
      created_by: charge.createdBy,
      created_at: now
    }]);
    if (ledErr) throw ledErr;
  }

  const { error: chErr } = await supabase.from('external_department_charges').insert([{
    id: chargeId,
    organization_id: charge.organizationId,
    patient_id: charge.patientId,
    billing_account_id: charge.paymentMethod === 'wallet' ? charge.billingAccountId : null,
    department: charge.department,
    receipt_number: charge.receiptNumber,
    amount: charge.amount,
    payment_method: charge.paymentMethod,
    status: charge.status || 'paid',
    description: charge.description || null,
    created_by: charge.createdBy,
    created_at: now
  }]);
  if (chErr) throw chErr;
};

export const fetchAccountLedger = async (accountId: string): Promise<BillingLedgerTransaction[]> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/billing?type=ledger&accountId=${accountId}`);
    if (!res.ok) throw new Error('Failed to fetch account ledger');
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('billing_ledger_transactions')
    .select('*')
    .eq('billing_account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchAccountLedger error:', error); return []; }
  return data || [];
};

export const fetchExternalCharges = async (organizationId: string): Promise<ExternalDepartmentCharge[]> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch(`/api/billing?type=external_charges&organizationId=${organizationId}`);
    if (!res.ok) throw new Error('Failed to fetch external charges');
    return res.json();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('external_department_charges')
    .select('*, patient:patients(first_name, surname, middle_name, slip_number)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchExternalCharges error:', error); return []; }
  
  return (data || []).map((c: any) => ({
    id: c.id,
    organizationId: c.organization_id,
    patientId: c.patient_id,
    billingAccountId: c.billing_account_id,
    department: c.department,
    receiptNumber: c.receipt_number,
    amount: c.amount,
    paymentMethod: c.payment_method,
    status: c.status,
    description: c.description,
    createdBy: c.created_by,
    createdAt: c.created_at,
    patientName: c.patient ? [c.patient.first_name, c.patient.middle_name, c.patient.surname].filter(Boolean).join(' ') : 'Unknown',
    patientSlip: c.patient ? c.patient.slip_number : ''
  }));
};

export const updatePatientBillingAccount = async (
  patientId: number | string,
  billingAccountId: string | null
): Promise<void> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'linkPatient',
        patientId,
        billingAccountId
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update patient billing account');
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('patients')
    .update({ billing_account_id: billingAccountId, updated_at: new Date().toISOString() })
    .eq('id', patientId);
  if (error) throw error;
};

export const registerPatientAndGetId = async (
  patient: Omit<Patient, 'id' | 'tests'>,
  organizationId: string
): Promise<number | string> => {
  if (IS_LOCAL_MODE) {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addPatient', patient, tests: [], organizationId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register patient locally');
    }
    const data = await res.json();
    return data.id;
  }

  const supabase = createClient();
  const { data: pData, error: pError } = await supabase
    .from('patients')
    .insert([{
      slip_number: patient.slipNumber,
      first_name: patient.firstName,
      surname: patient.surname,
      middle_name: patient.middleName || null,
      age: patient.age,
      sex: patient.sex,
      phone: patient.phone,
      email: patient.email || null,
      address: patient.address,
      referred_by: patient.referredBy || null,
      referring_facility: patient.referringFacility || null,
      referring_doctor_id: patient.referringDoctorId || null,
      referring_facility_id: patient.referringFacilityId || null,
      organization_id: organizationId,
      billing_account_id: patient.billingAccountId || null,
    }])
    .select()
    .single();
  if (pError) throw pError;
  return pData.id;
};


