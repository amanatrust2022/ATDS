/**
 * The fixed vocabulary of the investigation catalogue.
 *
 * Category lists and the standard panels a scientist can drop into a new test
 * rather than typing twenty reference ranges by hand. Lifted out of
 * TestManager, where 337 lines of clinical data sat above the component and
 * made the screen itself hard to find.
 *
 * This is clinical content: the ranges are what the lab reports against. Treat
 * a change here as a change to what gets printed on a result.
 */

export type Parameter = { name: string; unit: string; range: string };

export type ClinicalPreset = {
  name: string;
  specimen: string;
  category: string;
  parameters: Parameter[];
};

export const LAB_CATEGORIES = [
  'Hematology',
  'Serology',
  'Chemical Pathology',
  'Microbiology',
  'Hormones',
  'Special Health Check Plans'
];

export const RAD_CATEGORIES = [
  'Ultrasound',
  'X-Ray',
  'CT Scan',
  'MRI',
  'Mammography',
  'Electrocardiogram (ECG)'
];

export const CATEGORIES = [...LAB_CATEGORIES, ...RAD_CATEGORIES];

export const CLINICAL_PRESETS: ClinicalPreset[] = [
  {
    name: 'Full Blood Count (FBC)',
    specimen: 'Whole Blood',
    category: 'Hematology',
    parameters: [
      { name: 'WBC', unit: 'x10^9/L', range: '4.0-11.0' },
      { name: 'RBC', unit: 'x10^12/L', range: '4.5-5.9' },
      { name: 'HGB', unit: 'g/dL', range: '13.5-17.5' },
      { name: 'HCT', unit: '%', range: '41-50' },
      { name: 'MCV', unit: 'fL', range: '80-100' },
      { name: 'MCH', unit: 'pg', range: '27-33' },
      { name: 'MCHC', unit: 'g/dL', range: '32-36' },
      { name: 'Platelets', unit: 'x10^9/L', range: '150-400' },
      { name: 'Lymphocytes', unit: '%', range: '20-40' },
      { name: 'Granulocytes', unit: '%', range: '50-70' },
    ]
  },
  {
    name: 'Liver Function Tests (LFT)',
    specimen: 'Serum',
    category: 'Chemical Pathology',
    parameters: [
      { name: 'AST', unit: 'U/L', range: '8-37' },
      { name: 'ALT', unit: 'U/L', range: '4-41' },
      { name: 'ALP', unit: 'U/L', range: '35-128' },
      { name: 'TOTAL BILIRUBIN', unit: 'mg/dL', range: '0-2' },
      { name: 'DIRECT BILIRUBIN', unit: 'mg/dL', range: '0-0.2' },
      { name: 'TOTAL PROTEIN', unit: 'g/dL', range: '6.4-8.2' },
      { name: 'ALBUMIN', unit: 'g/dL', range: '3.5-5.2' },
    ]
  },
  {
    name: 'Electrolytes, Urea & Creatinine (E/U/Cr)',
    specimen: 'Serum',
    category: 'Chemical Pathology',
    parameters: [
      { name: 'Urea', unit: 'mmol/L', range: '2.3-5.8' },
      { name: 'Creatinine', unit: 'umol/L', range: '53-124' },
      { name: 'Sodium Na+', unit: 'mmole/L', range: '135-145' },
      { name: 'Potassium K+', unit: 'mmole/L', range: '3.5-5.0' },
      { name: 'Chloride Cl-', unit: 'mmole/L', range: '98-106' },
      { name: 'Bicarbonate HCO3-', unit: 'mmole/L', range: '21-31' },
    ]
  },
  {
    name: 'Lipid Profile',
    specimen: 'Serum',
    category: 'Chemical Pathology',
    parameters: [
      { name: 'Total Cholesterol (CHOL)', unit: 'mg/dL', range: '200-239' },
      { name: 'Triglycerides (TRIG)', unit: 'mg/dL', range: 'F: 35-135 / M: 40-160' },
      { name: 'HDL', unit: 'mg/dL', range: 'M: 35-55 / F: 45-65' },
      { name: 'LDL', unit: 'mg/dL', range: '<100' },
    ]
  },
  {
    name: 'Urinalysis Panel',
    specimen: 'Urine',
    category: 'Chemical Pathology',
    parameters: [
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
    ]
  },
  {
    name: 'Widal Reaction Titers Grid',
    specimen: 'Serum',
    category: 'Serology',
    parameters: [
      { name: 'Widal: S. Typhi O', unit: 'Titer', range: '<1:80' },
      { name: 'Widal: S. Typhi H', unit: 'Titer', range: '<1:80' },
      { name: 'Widal: S. Paratyphi A O', unit: 'Titer', range: '<1:80' },
      { name: 'Widal: S. Paratyphi A H', unit: 'Titer', range: '<1:80' },
      { name: 'Widal: S. Paratyphi B O', unit: 'Titer', range: '<1:80' },
      { name: 'Widal: S. Paratyphi B H', unit: 'Titer', range: '<1:80' },
      { name: 'Widal: S. Paratyphi C O', unit: 'Titer', range: '<1:80' },
      { name: 'Widal: S. Paratyphi C H', unit: 'Titer', range: '<1:80' },
    ]
  },
  {
    name: 'Malaria Parasite Film (MPs)',
    specimen: 'Whole Blood',
    category: 'Hematology',
    parameters: [
      { name: 'MPs: Parasites', unit: '', range: 'Not Seen' },
      { name: 'MPs: Density (Plus)', unit: '', range: 'Nil' },
      { name: 'MPs: Density (Count)', unit: 'p/µL', range: 'Nil' },
      { name: 'MPs: Species', unit: '', range: 'Nil' },
      { name: 'MPs: Stage', unit: '', range: 'Nil' },
      { name: 'MPs: Comment', unit: '', range: 'Nil' },
    ]
  },
  {
    name: 'MPs + Widal Panel',
    specimen: 'Whole Blood / Serum',
    category: 'Hematology',
    parameters: [
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
    ]
  },
  {
    name: 'Blood Group & Genotype',
    specimen: 'Whole Blood',
    category: 'Hematology',
    parameters: [
      { name: 'Blood Group', unit: '', range: '' },
      { name: 'Rhesus Factor', unit: '', range: '' },
      { name: 'Hb Genotype', unit: '', range: '' },
    ]
  },
  {
    name: 'Semen Fluid Analysis (SFA)',
    specimen: 'Semen',
    category: 'Chemical Pathology',
    parameters: [
      { name: 'Volume', unit: 'mL', range: '>=1.5' },
      { name: 'Color', unit: '', range: 'Grey-opaque' },
      { name: 'pH', unit: '', range: '7.2-8.0' },
      { name: 'Liquefaction Time', unit: 'mins', range: '<30' },
      { name: 'Total Sperm Concentration', unit: 'x10^6/mL', range: '>=15' },
      { name: 'Active Motility (Progressive)', unit: '%', range: '>=32' },
      { name: 'Sluggish Motility (Non-progressive)', unit: '%', range: '' },
      { name: 'Non-motile Sperm', unit: '%', range: '' },
      { name: 'Normal Morphology', unit: '%', range: '>=4' },
      { name: 'Pus Cells', unit: '/hpf', range: '0-5' },
    ]
  },
  {
    name: 'Antenatal Screening',
    specimen: 'Blood/Urine',
    category: 'Special Health Check Plans',
    parameters: [
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
    ]
  },
  {
    name: 'Oral Glucose Tolerance Test (OGTT)',
    specimen: 'Blood',
    category: 'Chemical Pathology',
    parameters: [
      { name: 'FBS', unit: 'mmol/L', range: '3.0-5.6' },
      { name: '30 min', unit: 'mmol/L', range: '' },
      { name: '1 hr', unit: 'mmol/L', range: '<11.1' },
      { name: '1 hr 30 min', unit: 'mmol/L', range: '<7.8' },
    ]
  },
  {
    name: 'Premarital Screening (Silver)',
    specimen: 'Blood',
    category: 'Special Health Check Plans',
    parameters: [
      { name: 'RVS', unit: '', range: 'Non-Reactive' },
      { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
      { name: 'Hb Genotype', unit: '', range: '' },
      { name: 'PT', unit: '', range: 'Negative' },
    ]
  },
  {
    name: 'Premarital Screening (Gold)',
    specimen: 'Blood',
    category: 'Special Health Check Plans',
    parameters: [
      { name: 'RVS', unit: '', range: 'Non-Reactive' },
      { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
      { name: 'Hb Genotype', unit: '', range: '' },
      { name: 'PT', unit: '', range: 'Negative' },
      { name: 'Blood Group', unit: '', range: '' },
      { name: 'Rhesus Factor', unit: '', range: '' },
    ]
  },
  {
    name: 'Premarital Screening (Diamond)',
    specimen: 'Blood',
    category: 'Special Health Check Plans',
    parameters: [
      { name: 'RVS', unit: '', range: 'Non-Reactive' },
      { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
      { name: 'HCV', unit: '', range: 'Non-Reactive' },
      { name: 'VDRL', unit: '', range: 'Non-Reactive' },
      { name: 'Hb Genotype', unit: '', range: '' },
      { name: 'Blood Group', unit: '', range: '' },
      { name: 'Rhesus Factor', unit: '', range: '' },
      { name: 'PT', unit: '', range: 'Negative' },
    ]
  },
  {
    name: 'Health Check Up',
    specimen: 'Blood/Urine',
    category: 'Special Health Check Plans',
    parameters: [
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
    ]
  },
  {
    name: 'Health Screening',
    specimen: 'Blood',
    category: 'Special Health Check Plans',
    parameters: [
      { name: 'Blood Group', unit: '', range: '' },
      { name: 'Rhesus Factor', unit: '', range: '' },
      { name: 'HBsAg', unit: '', range: 'Non-Reactive' },
      { name: 'HCV', unit: '', range: 'Non-Reactive' },
      { name: 'RVS', unit: '', range: 'Non-Reactive' },
      { name: 'MPs', unit: '', range: 'Not Seen' },
    ]
  },
  {
    name: 'Wound Swab MCS',
    specimen: 'Wound Swab',
    category: 'Microbiology',
    parameters: [
      { name: 'Microscopy', unit: '', range: '' },
      { name: 'Culture (Growth)', unit: '', range: '' },
      { name: 'Antibiotic Sensitivity', unit: '', range: '' },
    ]
  },
  {
    name: 'MPs + Widal + H.Pylori Panel',
    specimen: 'Whole Blood / Serum',
    category: 'Hematology',
    parameters: [
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
    ]
  },
  {
    name: 'MPs + Widal + HBsAg Panel',
    specimen: 'Whole Blood / Serum',
    category: 'Hematology',
    parameters: [
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
    ]
  }
];
