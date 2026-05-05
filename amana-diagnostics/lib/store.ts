import { createClient } from './supabase';

export type Department = 'lab' | 'radiology';
export type TestStatus = 'pending' | 'in_progress' | 'completed';

export interface Test {
  id: string;
  name: string;
  department: Department;
  category: 'Hematology' | 'Serology' | 'Chemical Pathology' | 'Microbiology' | 'Ultrasound' | 'Hormones' | 'Special Health Check Plans';
  specimen: string;
  parameters: { name: string; unit: string; range: string }[];
}

export interface PatientTest {
  id?: string;
  patient_id?: string;
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
  firstName: string;
  surname: string;
  middleName?: string;
  age: string;
  sex: 'Male' | 'Female';
  phone: string;
  address: string;
  referredBy: string;
  referringFacility?: string;
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
  { id: 'esr', name: 'ESR', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'ESR', unit: 'mm/hr', range: 'M: <15 / F: <20' },
  ]},
  { id: 'pcv', name: 'PCV', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'PCV', unit: '%', range: '35-48' },
  ]},
  { id: 'genotype', name: 'Hb Genotype', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'HB Genotype', unit: '', range: '' },
  ]},
  { id: 'blood_group', name: 'Blood Grouping', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'Blood Group', unit: '', range: '' },
  ]},
  { id: 'rh_typing', name: 'Rh Typing', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'Rhesus Factor', unit: '', range: '' },
  ]},
  { id: 'mps_rdt', name: 'MPs (RDT)', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'Malaria Parasite (RDT)', unit: '', range: 'Negative' },
  ]},
  { id: 'mps_bf', name: 'MPs (Blood Film)', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'Malaria Parasite (Blood Film)', unit: '', range: 'Not Seen' },
  ]},
  { id: 'mp_widal', name: 'MP + WIDAL', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [
    { name: 'MPs', unit: '', range: 'Not Seen' },
    { name: 'Widal Test', unit: '', range: '' },
  ]},

  // --- SEROLOGY ---
  { id: 'hbsag', name: 'HBsAg', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'hcv', name: 'HCV Antibody', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'HCV', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'hb_combo', name: 'HB Combo', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
    { name: 'HBsAb', unit: '', range: 'Non-Reactive' },
    { name: 'HBeAg', unit: '', range: 'Non-Reactive' },
    { name: 'HBeAb', unit: '', range: 'Non-Reactive' },
    { name: 'HBcAb', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'vdrl', name: 'VDRL', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'VDRL', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'rvs', name: 'RVS', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'RVS', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'hcg', name: 'HCG', department: 'lab', category: 'Serology', specimen: 'Urine/Serum', parameters: [
    { name: 'Pregnancy Test (HCG)', unit: '', range: 'Negative' },
  ]},
  { id: 'h_pylori', name: 'H Pylori', department: 'lab', category: 'Serology', specimen: 'Serum/Stool', parameters: [
    { name: 'H. Pylori', unit: '', range: 'Non-Reactive' },
  ]},
  { id: 'widal', name: 'WIDAL', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'S. Typhi O', unit: 'titre', range: '1/20 - 1/80' },
    { name: 'S. Typhi H', unit: 'titre', range: '1/20 - 1/80' },
  ]},
  { id: 'rheumatoid_factor', name: 'Rheumatoid Factor', department: 'lab', category: 'Serology', specimen: 'Serum', parameters: [
    { name: 'Rheumatoid Factor', unit: '', range: 'Negative' },
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
    { name: 'AST (SGOT)', unit: 'U/L', range: '8-37' },
    { name: 'ALT (SGPT)', unit: 'U/L', range: '4-41' },
    { name: 'ALP', unit: 'U/L', range: '35-128' },
    { name: 'Total Bilirubin', unit: 'mg/dL', range: '0-2' },
    { name: 'Direct Bilirubin', unit: 'mg/dL', range: '0-0.2' },
    { name: 'Total Protein', unit: 'g/dL', range: '6.4-8.2' },
    { name: 'Albumin', unit: 'g/dL', range: '3.5-5.2' },
  ]},
  { id: 'lipid', name: 'Lipid Profile', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Total Cholesterol', unit: 'mg/dL', range: '200-239' },
    { name: 'Triglycerides', unit: 'mg/dL', range: 'F:35-135 / M:40-160' },
    { name: 'HDL Cholesterol', unit: 'mg/dL', range: 'M:35-55 / F:45-65' },
    { name: 'LDL Cholesterol', unit: 'mg/dL', range: '<100' },
  ]},
  { id: 'urea', name: 'Urea', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Urea', unit: 'mmol/L', range: '2.3-5.8' },
  ]},
  { id: 'creatinine', name: 'Creatinine', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Creatinine', unit: 'umol/L', range: '53-124' },
  ]},
  { id: 'electrolytes', name: 'Electrolytes', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Sodium Na+', unit: 'mmole/L', range: '135-145' },
    { name: 'Potassium K+', unit: 'mmole/L', range: '3.5-5.0' },
    { name: 'Chloride Cl-', unit: 'mmole/L', range: '98-106' },
    { name: 'Bicarbonate HCO3-', unit: 'mmole/L', range: '21-31' },
  ]},
  { id: 'uric_acid', name: 'Uric Acid', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Uric Acid', unit: 'mg/dL', range: 'M:2.7-7.3 / F:3.5-6.4' },
  ]},
  { id: 'hba1c', name: 'HBA1C', department: 'lab', category: 'Chemical Pathology', specimen: 'Whole Blood', parameters: [
    { name: 'HbA1c', unit: '%', range: '4.0-6.5' },
  ]},
  { id: 'phosphate', name: 'PO4^3-', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Phosphate (Po42-)', unit: 'mg/dL', range: '2.5-4.4' },
  ]},
  { id: 'calcium', name: 'Ca^2+', department: 'lab', category: 'Chemical Pathology', specimen: 'Serum', parameters: [
    { name: 'Calcium (Ca2+)', unit: 'mg/dL', range: '8.5-10.5' },
  ]},
  { id: 'fbs', name: 'Fasting Blood Sugar (FBS)', department: 'lab', category: 'Chemical Pathology', specimen: 'Fluoride Blood', parameters: [
    { name: 'FBS', unit: 'mmol/L', range: '3.4-5.6' },
  ]},
  { id: 'rbs', name: 'Random Blood Sugar (RBS)', department: 'lab', category: 'Chemical Pathology', specimen: 'Plasma/Serum', parameters: [
    { name: 'RBS', unit: 'mmol/L', range: '4.0-7.8' },
  ]},

  // --- MICROBIOLOGY ---
  { id: 'urinalysis', name: 'Urinalysis', department: 'lab', category: 'Microbiology', specimen: 'Urine', parameters: [
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
  { id: 'urine_microscopy', name: 'Urine Microscopy', department: 'lab', category: 'Microbiology', specimen: 'Urine', parameters: [
    { name: 'Microscopy (Pus Cells)', unit: '/hpf', range: '0-2' },
    { name: 'Microscopy (Epithelial)', unit: '/hpf', range: '' },
    { name: 'Crystals', unit: '', range: 'Not Seen' },
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
  { id: 'psa', name: 'PSA', department: 'lab', category: 'Hormones', specimen: 'Serum', parameters: [
    { name: 'PSA', unit: 'ng/mL', range: '<4.0' },
  ]},
  { id: 'progesterone', name: 'Progesterone', department: 'lab', category: 'Hormones', specimen: 'Serum', parameters: [
    { name: 'Progesterone', unit: 'ng/mL', range: '' },
  ]},
  { id: 'testosterone', name: 'Testosterone', department: 'lab', category: 'Hormones', specimen: 'Serum', parameters: [
    { name: 'Testosterone', unit: 'ng/mL', range: '' },
  ]},
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
  { id: 'pkg_antenatal', name: 'Antenatal Screening', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood', parameters: [
    { name: 'Blood Group', unit: '', range: '' },
    { name: 'PCV', unit: '%', range: '' },
  ]},
  { id: 'pkg_basic', name: 'Basic', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood/Urine', parameters: [
    { name: 'Basic Profile', unit: '', range: '' },
  ]},
  { id: 'pkg_silver', name: 'Silver', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood/Urine', parameters: [
    { name: 'Silver Profile', unit: '', range: '' },
  ]},
  { id: 'pkg_gold', name: 'Gold', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood/Urine', parameters: [
    { name: 'Gold Profile', unit: '', range: '' },
  ]},
  { id: 'pkg_diamond', name: 'Diamond', department: 'lab', category: 'Special Health Check Plans', specimen: 'Blood/Urine', parameters: [
    { name: 'Diamond Profile', unit: '', range: '' },
  ]},
];

export const generateSlipNumber = async (): Promise<string> => {
  const supabase = createClient();
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  
  const dateStr = `${y}${m}${d}`;
  const { count } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .gte('registered_at', new Date(y, date.getMonth(), date.getDate()).toISOString());

  const num = (count || 0) + 1;
  return `ATD/${dateStr}/${num.toString().padStart(4, '0')}`;
};

export const fetchPatients = async (): Promise<Patient[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('patients')
    .select('*, tests:patient_tests(*)')
    .order('registered_at', { ascending: false });

  if (error) {
    console.error('Error fetching patients:', error);
    return [];
  }

  return (data || []).map(p => ({
    ...p,
    slipNumber: p.slip_number,
    registeredAt: p.registered_at,
    firstName: p.first_name,
    surname: p.surname,
    middleName: p.middle_name,
    referredBy: p.referred_by,
    referringFacility: p.referring_facility,
    tests: p.tests.map((t: any) => ({
      ...t,
      testId: t.test_id,
      testName: t.test_name,
      completedBy: t.completed_by,
      completedAt: t.completed_at,
    }))
  }));
};

export const addPatient = async (patient: Omit<Patient, 'id' | 'tests'>, tests: Omit<PatientTest, 'id' | 'patient_id'>[], organizationId: string): Promise<void> => {
  const supabase = createClient();
  
  const { data: pData, error: pError } = await supabase
    .from('patients')
    .insert([{
      slip_number: patient.slipNumber,
      first_name: patient.firstName,
      surname: patient.surname,
      middle_name: patient.middleName,
      age: patient.age,
      sex: patient.sex,
      phone: patient.phone,
      address: patient.address,
      referred_by: patient.referredBy,
      referring_facility: patient.referringFacility,
      organization_id: organizationId,
    }])
    .select()
    .single();

  if (pError) throw pError;

  const testsToInsert = tests.map(t => ({
    patient_id: pData.id,
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
  const supabase = createClient();
  const { error } = await supabase
    .from('patient_tests')
    .update({
      status: updates.status,
      results: updates.results,
      completed_by: updates.completedBy,
      completed_at: updates.completedAt,
      notes: updates.notes,
      specimen: updates.specimen,
    })
    .eq('id', testId);

  if (error) throw error;
};

export const subscribeToPatients = (callback: () => void) => {
  const supabase = createClient();
  const patientsChannel = supabase.channel('patients-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_tests' }, callback)
    .subscribe();

  return () => {
    supabase.removeChannel(patientsChannel);
  };
};

export const getTestById = (id: string): Test | undefined =>
  TEST_CATALOGUE.find(t => t.id === id);

