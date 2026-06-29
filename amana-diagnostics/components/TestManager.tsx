'use client';
import { useState, useEffect } from 'react';
import {
  RiCloseLine, RiSearchLine, RiAddLine, RiDeleteBin6Line, RiEdit2Line,
  RiCheckLine, RiFlaskLine, RiRadarLine, RiFileList2Line, RiRefreshLine
} from '@remixicon/react';
import {
  Test, TEST_CATALOGUE, fetchCustomTests, addCustomTest,
  updateCustomTest, deleteCustomTest, setCustomCatalogueCache,
  fetchTestPrices, upsertTestPrices, TestPrice
} from '@/lib/store';
import { useAuth } from '@/components/AuthProvider';

interface Props {
  organizationId: string;
  restrictDepartment?: 'lab' | 'radiology';
  onClose?: () => void;
}

const LAB_CATEGORIES = [
  'Hematology',
  'Serology',
  'Chemical Pathology',
  'Microbiology',
  'Hormones',
  'Special Health Check Plans'
];

const RAD_CATEGORIES = [
  'Ultrasound',
  'X-Ray',
  'CT Scan',
  'MRI',
  'Mammography',
  'Electrocardiogram (ECG)'
];

const CATEGORIES = [...LAB_CATEGORIES, ...RAD_CATEGORIES];

const CLINICAL_PRESETS = [
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

export default function TestManager({ organizationId, restrictDepartment, onClose }: Props) {
  const { profile } = useAuth();
  const [catalogue, setCatalogue] = useState<Test[]>([]);
  const [pendingTests, setPendingTests] = useState<Test[]>([]);
  const [customTests, setCustomTests] = useState<Test[]>([]);
  const [activeTab, setActiveTab] = useState<'catalogue' | 'pending'>('catalogue');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formName, setFormName] = useState('');
  const [formDept, setFormDept] = useState<'lab' | 'radiology'>('lab');
  const [formCategory, setFormCategory] = useState('Hematology');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formSpecimen, setFormSpecimen] = useState('');
  const [formParameters, setFormParameters] = useState<{ name: string; unit: string; range: string }[]>([]);
  const [formFormat, setFormFormat] = useState<'parameterized' | 'freetext'>('parameterized');

  // Pricing & Commission State
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formCommType, setFormCommType] = useState<'percentage' | 'flat' | 'none'>('percentage');
  const [formCommValue, setFormCommValue] = useState<number>(0);
  const [testPrices, setTestPrices] = useState<TestPrice[]>([]);

  const activeDeptCategories = formDept === 'radiology' ? RAD_CATEGORIES : LAB_CATEGORIES;

  const handleFormatChange = (format: 'parameterized' | 'freetext') => {
    setFormFormat(format);
    if (format === 'freetext') {
      setFormParameters([]);
    } else {
      if (formParameters.length === 0) {
        setFormParameters([{ name: '', unit: '', range: '' }]);
      }
    }
  };

  useEffect(() => {
    loadCatalogue();
  }, [organizationId]);

  const loadCatalogue = async () => {
    setLoading(true);
    setError('');
    try {
      const [dbCustom, priceData] = await Promise.all([
        fetchCustomTests(organizationId),
        fetchTestPrices(organizationId)
      ]);
      setCustomTests(dbCustom);
      setCustomCatalogueCache(dbCustom);
      setTestPrices(priceData);

      // Merge TEST_CATALOGUE with custom tests, separating active from pending pricing
      const mergedActive: Test[] = [...TEST_CATALOGUE];
      const pending: Test[] = [];

      dbCustom.forEach(ct => {
        const isDefault = TEST_CATALOGUE.some(t => t.id === ct.id);
        if (isDefault) {
          const idx = mergedActive.findIndex(t => t.id === ct.id);
          if (idx !== -1) {
            if (ct.is_active === false) {
              // Default test deactivated
              mergedActive.splice(idx, 1);
              pending.push(ct);
            } else {
              // Default test overridden
              mergedActive[idx] = ct;
            }
          }
        } else {
          // Custom test
          if (ct.is_active === false) {
            pending.push(ct);
          } else {
            mergedActive.push(ct);
          }
        }
      });

      // Filter by restricted department if applicable
      const filteredActive = restrictDepartment 
        ? mergedActive.filter(t => t.department === restrictDepartment)
        : mergedActive;

      const filteredPending = restrictDepartment
        ? pending.filter(t => t.department === restrictDepartment)
        : pending;

      setCatalogue(filteredActive);
      setPendingTests(filteredPending);
    } catch (err: any) {
      setError('Failed to load catalogue: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: 'catalogue' | 'pending') => {
    setActiveTab(tab);
    setSearchQuery('');
    setSelectedCategory('all');
    setEditingTest(null);
    setIsNew(false);
    setError('');
    setSuccessMsg('');
  };

  const handleSelectTest = (test: Test) => {
    setError('');
    setSuccessMsg('');
    setEditingTest(test);
    setIsNew(false);

    setFormName(test.name);
    setFormDept(test.department);
    
    if (CATEGORIES.includes(test.category)) {
      setFormCategory(test.category);
      setFormCustomCategory('');
    } else {
      setFormCategory('custom');
      setFormCustomCategory(test.category);
    }

    setFormSpecimen(test.specimen);
    setFormParameters(test.parameters || []);
    if (test.department === 'radiology' || !test.parameters || test.parameters.length === 0) {
      setFormFormat('freetext');
    } else {
      setFormFormat('parameterized');
    }

    const matchedPrice = testPrices.find(p => p.test_id === test.id);
    setFormPrice(matchedPrice?.price ?? 0);
    setFormCommType((matchedPrice?.commission_type as any) || 'percentage');
    setFormCommValue(matchedPrice?.commission_value ?? 0);
  };

  const handleStartNew = () => {
    setError('');
    setSuccessMsg('');
    setEditingTest(null);
    setIsNew(true);

    setFormName('');
    setFormDept(restrictDepartment || 'lab');
    setFormCategory(restrictDepartment === 'radiology' ? 'Ultrasound' : 'Hematology');
    setFormCustomCategory('');
    setFormSpecimen(restrictDepartment === 'radiology' ? 'Scan' : 'Whole Blood');
    setFormFormat(restrictDepartment === 'radiology' ? 'freetext' : 'parameterized');
    setFormParameters(restrictDepartment === 'radiology' ? [] : [{ name: '', unit: '', range: '' }]);

    setFormPrice(0);
    setFormCommType('percentage');
    setFormCommValue(0);
  };

  const handleAddParameter = () => {
    setFormParameters(prev => [...prev, { name: '', unit: '', range: '' }]);
  };

  const handleRemoveParameter = (index: number) => {
    setFormParameters(prev => prev.filter((_, i) => i !== index));
  };

  const handleParamChange = (index: number, field: 'name' | 'unit' | 'range', value: string) => {
    setFormParameters(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formName.trim()) {
      setError('Test name is required');
      return;
    }
    const finalCategory = formCategory === 'custom' ? formCustomCategory.trim() : formCategory;
    if (!finalCategory) {
      setError('Category is required');
      return;
    }
    const isFreeText = formFormat === 'freetext' || formDept === 'radiology';
    if (!isFreeText && !formSpecimen.trim()) {
      setError('Specimen is required');
      return;
    }
    if (!isFreeText && formParameters.some(p => !p.name.trim())) {
      setError('All parameters must have a name');
      return;
    }

    setSaving(true);
    try {
      const activeCategory = finalCategory;
      const testId = isNew ? `custom_${crypto.randomUUID().substring(0, 8)}` : editingTest!.id;

      const testPayload = {
        id: testId,
        name: formName.trim(),
        department: formDept,
        category: activeCategory as any,
        specimen: formDept === 'radiology' ? 'Scan' : formSpecimen.trim(),
        parameters: isFreeText ? [] : formParameters
      };

      const isAdmin = profile?.role === 'admin';

      if (isNew) {
        await addCustomTest({
          ...testPayload,
          is_active: isAdmin ? true : false
        }, organizationId);
        
        if (isAdmin) {
          // Admin sets pricing & commission directly
          await upsertTestPrices([{
            organization_id: organizationId,
            test_id: testId,
            test_name: formName.trim(),
            price: formPrice,
            commission_type: formCommType,
            commission_value: formCommValue
          }], organizationId);
          setSuccessMsg('New test and pricing settings saved successfully!');
        } else {
          // Scientist creates test, defaults financial details to 0/none
          await upsertTestPrices([{
            organization_id: organizationId,
            test_id: testId,
            test_name: formName.trim(),
            price: 0,
            commission_type: 'none',
            commission_value: 0
          }], organizationId);
          
          // Notify admin via API
          try {
            await fetch('/api/custom-tests', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'notifyAdmin',
                test: testPayload,
                organizationId,
                addedBy: { name: profile?.full_name, role: profile?.role }
              })
            });
          } catch (emailErr) {
            console.warn('Failed to send admin email alert:', emailErr);
          }

          setSuccessMsg('New test added successfully! The administrator has been notified by email to configure its price.');
        }
      } else {
        await updateCustomTest(testId, {
          ...testPayload,
          is_active: isAdmin ? true : editingTest!.is_active
        }, organizationId);
        
        if (isAdmin) {
          await upsertTestPrices([{
            organization_id: organizationId,
            test_id: testId,
            test_name: formName.trim(),
            price: formPrice,
            commission_type: formCommType,
            commission_value: formCommValue
          }], organizationId);

          // If this test was pending, switch to active catalogue tab on save
          if (activeTab === 'pending') {
            setActiveTab('catalogue');
          }
          setSuccessMsg('Test details and pricing updated successfully!');
        } else {
          setSuccessMsg('Test modified successfully!');
        }
      }

      await loadCatalogue();
      
      // If it was new, select the newly created one, else keep selection
      const updatedList = await fetchCustomTests(organizationId);
      const matched = updatedList.find(t => t.id === testId);
      if (matched) {
        handleSelectTest(matched);
      } else {
        const fallback = TEST_CATALOGUE.find(t => t.id === testId);
        if (fallback) handleSelectTest(fallback);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save test details');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTest) return;
    if (!confirm(`Are you sure you want to deactivate/delete "${editingTest.name}" from your catalogue?`)) return;

    setSaving(true);
    setError('');
    try {
      await deleteCustomTest(editingTest.id, organizationId);
      setSuccessMsg('Test deactivated/deleted from catalogue');
      setEditingTest(null);
      await loadCatalogue();
    } catch (err: any) {
      setError(err.message || 'Failed to delete test');
    } finally {
      setSaving(false);
    }
  };

  // Render list depending on tab selection
  const currentList = activeTab === 'pending' ? pendingTests : catalogue;

  // Get active unique categories present in the rendered list
  const activeCategories = Array.from(new Set(currentList.map(t => t.category)));

  // Filter list for display
  const filteredCatalogue = currentList.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.specimen.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {restrictDepartment === 'lab' ? (
            <RiFlaskLine size={20} color="var(--teal-600)" />
          ) : restrictDepartment === 'radiology' ? (
            <RiRadarLine size={20} color="#7c3aed" />
          ) : (
            <RiFileList2Line size={20} color="var(--teal-600)" />
          )}
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--gray-900)' }}>
            Configure &amp; Manage Investigation Catalogue
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={loadCatalogue} style={iconBtnStyle} title="Refresh List">
            <RiRefreshLine size={16} />
          </button>
          {onClose && (
            <button onClick={onClose} style={iconBtnStyle} title="Close Panel">
              <RiCloseLine size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Split Content */}
      <div style={splitStyle}>
        {/* Left Side: Test Selector */}
        <div style={leftPanelStyle}>
          {/* Main Tab bar (Admin only) */}
          {profile?.role === 'admin' && (
            <div style={mainTabContainerStyle}>
              <button
                type="button"
                onClick={() => handleTabChange('catalogue')}
                style={mainTabStyle(activeTab === 'catalogue')}
              >
                Active Catalogue
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('pending')}
                style={mainTabStyle(activeTab === 'pending')}
              >
                Pending Pricing
                {pendingTests.length > 0 && (
                  <span style={pendingBadgeStyle}>
                    {pendingTests.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <RiSearchLine size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input
              style={searchStyle}
              placeholder="Search investigations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Tabs */}
          <div style={categoryRowStyle}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={categoryTabStyle(selectedCategory === 'all')}
            >
              All Categories
            </button>
            {activeCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={categoryTabStyle(selectedCategory === cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* List of Tests */}
          <div style={listScrollStyle}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--gray-500)' }}>Loading investigations...</div>
            ) : filteredCatalogue.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--gray-400)' }}>No tests found.</div>
            ) : (
              filteredCatalogue.map(t => {
                const isSelected = editingTest?.id === t.id && !isNew;
                const isOverridden = customTests.some(ct => ct.id === t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTest(t)}
                    style={itemCardStyle(isSelected)}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: isSelected ? 'white' : 'var(--gray-900)' }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--gray-500)', marginTop: '0.15rem' }}>
                        {t.category} • {t.specimen}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {isOverridden && (
                        <span style={badgeStyle(isSelected)}>Customized</span>
                      )}
                      <RiEdit2Line size={13} style={{ color: isSelected ? 'white' : 'var(--gray-400)' }} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Create New Trigger */}
          <button onClick={handleStartNew} style={newBtnStyle}>
            <RiAddLine size={16} /> Add Custom Investigation
          </button>
        </div>

        {/* Right Side: Editor/Form */}
        <div style={rightPanelStyle}>
          {editingTest || isNew ? (
            <form onSubmit={handleSave} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={editorScrollStyle}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--gray-800)', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.4rem' }}>
                  {isNew ? 'Create New Custom Test' : `Modify Test: ${editingTest?.name}`}
                </h3>

                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '0.6rem 0.75rem', fontSize: '0.78rem', marginBottom: '1rem', borderRadius: 4 }}>
                    {error}
                  </div>
                )}

                {successMsg && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', color: '#15803d', padding: '0.6rem 0.75rem', fontSize: '0.78rem', marginBottom: '1rem', borderRadius: 4 }}>
                    {successMsg}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Investigation Name *</label>
                    <input
                      style={inputStyle}
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="e.g. Lipid Profile"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Specimen *</label>
                    {formDept === 'radiology' ? (
                      <div style={{ ...inputStyle, background: 'var(--gray-100)', color: 'var(--gray-600)', fontWeight: 600 }}>
                        Scan / Exam (Default)
                      </div>
                    ) : (
                      <input
                        style={inputStyle}
                        value={formSpecimen}
                        onChange={e => setFormSpecimen(e.target.value)}
                        placeholder="e.g. Serum, Whole Blood"
                      />
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Department *</label>
                    {restrictDepartment ? (
                      <div style={{ ...inputStyle, background: 'var(--gray-100)', color: 'var(--gray-600)', fontWeight: 600 }}>
                        {restrictDepartment === 'lab' ? 'Laboratory' : 'Radiology'}
                      </div>
                    ) : (
                      <select
                        style={inputStyle}
                        value={formDept}
                        onChange={e => {
                          const val = e.target.value as 'lab' | 'radiology';
                          setFormDept(val);
                          if (val === 'radiology') {
                            setFormCategory('Ultrasound');
                            setFormSpecimen('Scan');
                          } else {
                            setFormCategory('Hematology');
                            setFormSpecimen('Whole Blood');
                          }
                        }}
                      >
                        <option value="lab">Laboratory</option>
                        <option value="radiology">Radiology</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Category *</label>
                    <select
                      style={inputStyle}
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                    >
                      {activeDeptCategories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="custom">-- Custom Category... --</option>
                    </select>
                  </div>
                </div>

                {formCategory === 'custom' && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={labelStyle}>Enter Custom Category *</label>
                    <input
                      style={inputStyle}
                      value={formCustomCategory}
                      onChange={e => setFormCustomCategory(e.target.value)}
                      placeholder={formDept === 'radiology' ? "e.g. MRI, CT Scan" : "e.g. Immunology, PCR"}
                    />
                  </div>
                )}

                {profile?.role === 'admin' && (
                  <div style={{ background: 'var(--gray-50)', padding: '0.75rem', border: '1px solid var(--gray-200)', borderRadius: 4, marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--gray-800)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Financial &amp; Commission Settings
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.50rem' }}>
                      <div>
                        <label style={labelStyle}>Base Price (₦)</label>
                        <input
                          type="number"
                          min={0}
                          style={inputStyle}
                          value={formPrice || ''}
                          onChange={e => setFormPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Comm. Type</label>
                        <select
                          style={inputStyle}
                          value={formCommType}
                          onChange={e => {
                            const val = e.target.value as 'percentage' | 'flat' | 'none';
                            setFormCommType(val);
                            if (val === 'none') setFormCommValue(0);
                          }}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat">Flat Rate (₦)</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Comm. Value</label>
                        <input
                          type="number"
                          min={0}
                          disabled={formCommType === 'none'}
                          style={{ ...inputStyle, background: formCommType === 'none' ? 'var(--gray-100)' : 'white' }}
                          value={formCommType === 'none' ? 0 : (formCommValue || '')}
                          onChange={e => setFormCommValue(Math.max(0, parseFloat(e.target.value) || 0))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formDept === 'lab' && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={labelStyle}>Result Format *</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleFormatChange('parameterized')}
                        style={{
                          flex: 1, padding: '0.55rem', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700,
                          cursor: 'pointer', border: '1px solid',
                          borderColor: formFormat === 'parameterized' ? 'var(--teal-600)' : 'var(--gray-300)',
                          background: formFormat === 'parameterized' ? 'var(--teal-50)' : 'white',
                          color: formFormat === 'parameterized' ? 'var(--teal-800)' : 'var(--gray-600)',
                          transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
                        }}
                      >
                        📊 Parameterized Grid
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormatChange('freetext')}
                        style={{
                          flex: 1, padding: '0.55rem', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700,
                          cursor: 'pointer', border: '1px solid',
                          borderColor: formFormat === 'freetext' ? 'var(--teal-600)' : 'var(--gray-300)',
                          background: formFormat === 'freetext' ? 'var(--teal-50)' : 'white',
                          color: formFormat === 'freetext' ? 'var(--teal-800)' : 'var(--gray-600)',
                          transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
                        }}
                      >
                        📝 Free-text Narrative
                      </button>
                    </div>
                  </div>
                )}

                {/* Parameters & Reference Ranges (Only for Lab) */}
                {formFormat === 'freetext' || formDept === 'radiology' ? (
                  <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 4 }}>
                    <h4 style={{ margin: '0 0 0.4rem', color: '#7c3aed', fontSize: '0.85rem', fontWeight: 700 }}>
                      {formDept === 'radiology' ? 'Radiology Report Structure' : 'Free-text Lab Report Structure'}
                    </h4>
                    <p style={{ margin: 0, color: '#5b21b6', fontSize: '0.78rem', lineHeight: 1.45 }}>
                      {formDept === 'radiology' 
                        ? 'Radiology scans use free-text Findings, Impression/Conclusion, and attached imagery. No numeric parameters or reference ranges are required.'
                        : 'This laboratory test will use a narrative report format (free-text Findings and Impression/Conclusion) instead of a parameterized results grid.'
                      }
                    </p>
                  </div>
                ) : (
                  <div style={{ marginTop: '1.25rem' }}>
                    {/* Clinical component presets panel */}
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--teal-50)', border: '1px dashed var(--teal-300)', borderRadius: 4 }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--teal-800)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Assemble Clinical Components (Presets)
                      </h4>
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.7rem', color: 'var(--teal-700)', lineHeight: 1.35 }}>
                        Select a standard panel to instantly populate or append clinical parameters:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {CLINICAL_PRESETS.map(preset => (
                          <div key={preset.name} style={{ display: 'flex', border: '1px solid var(--teal-200)', borderRadius: 4, overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setFormParameters(preset.parameters);
                                setFormSpecimen(preset.specimen);
                                if (preset.category) {
                                  if (CATEGORIES.includes(preset.category)) {
                                    setFormCategory(preset.category);
                                    setFormCustomCategory('');
                                  } else {
                                    setFormCategory('custom');
                                    setFormCustomCategory(preset.category);
                                  }
                                }
                              }}
                              style={{
                                background: 'white', border: 'none', padding: '0.25rem 0.5rem', fontSize: '0.7rem',
                                color: 'var(--teal-800)', fontWeight: 600, cursor: 'pointer', outline: 'none'
                              }}
                              title="Replace all current parameters with this preset"
                            >
                              {preset.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormParameters(prev => {
                                  const existingNames = new Set(prev.map(p => p.name.trim().toLowerCase()));
                                  const toAdd = preset.parameters.filter(p => !existingNames.has(p.name.trim().toLowerCase()));
                                  if (prev.length === 1 && prev[0].name === '') {
                                    return preset.parameters;
                                  }
                                  return [...prev, ...toAdd];
                                });
                              }}
                              style={{
                                background: 'var(--teal-100)', border: 'none', borderLeft: '1px solid var(--teal-200)',
                                padding: '0.25rem 0.4rem', fontSize: '0.7rem', color: 'var(--teal-900)',
                                fontWeight: 700, cursor: 'pointer', outline: 'none'
                              }}
                              title="Append this preset's parameters to your list"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ ...labelStyle, margin: 0, fontWeight: 700 }}>Parameters &amp; Reference Ranges</label>
                      <button
                        type="button"
                        onClick={handleAddParameter}
                        style={{
                          background: 'none', border: 'none', color: 'var(--teal-600)',
                          fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '0.15rem'
                        }}
                      >
                        <RiAddLine size={13} /> Add Parameter
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {formParameters.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <input
                            style={{ ...inputStyle, flex: 1.5 }}
                            placeholder="Parameter Name (e.g. WBC)"
                            value={p.name}
                            onChange={e => handleParamChange(idx, 'name', e.target.value)}
                          />
                          <input
                            style={{ ...inputStyle, flex: 0.8 }}
                            placeholder="Unit (e.g. g/dl)"
                            value={p.unit}
                            onChange={e => handleParamChange(idx, 'unit', e.target.value)}
                          />
                          <input
                            style={{ ...inputStyle, flex: 1.5 }}
                            placeholder="Ref Range (e.g. 4.0-11.0)"
                            value={p.range}
                            onChange={e => handleParamChange(idx, 'range', e.target.value)}
                          />
                          {formParameters.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveParameter(idx)}
                              style={{
                                border: 'none', background: 'none', color: '#ef4444',
                                cursor: 'pointer', padding: '0.2rem'
                              }}
                            >
                              <RiDeleteBin6Line size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div style={editorFooterStyle}>
                {!isNew && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    style={{
                      background: 'none', border: '1px solid #fee2e2',
                      color: '#ef4444', padding: '0.5rem 1rem', borderRadius: 4,
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.25rem'
                    }}
                  >
                    <RiDeleteBin6Line size={14} /> Deactivate Test
                  </button>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => { setEditingTest(null); setIsNew(false); }}
                    style={{
                      background: 'none', border: '1px solid var(--gray-300)',
                      color: 'var(--gray-600)', padding: '0.5rem 1rem', borderRadius: 4,
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      background: restrictDepartment === 'radiology' ? '#7c3aed' : 'var(--teal-600)',
                      color: 'white', border: 'none',
                      padding: '0.5rem 1.25rem', borderRadius: 4,
                      fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    <RiCheckLine size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div style={emptyEditorStyle}>
              <RiFileList2Line size={48} color="var(--gray-300)" style={{ marginBottom: '0.75rem' }} />
              <div style={{ fontWeight: 600, color: 'var(--gray-700)', fontSize: '0.85rem' }}>
                No investigation selected
              </div>
              <div style={{ color: 'var(--gray-400)', fontSize: '0.75rem', marginTop: '0.25rem', textAlign: 'center', maxWidth: 280 }}>
                Select an investigation from the left sidebar to edit its reference ranges and categories, or create a brand new one.
              </div>
              <button onClick={handleStartNew} style={{ ...newBtnStyle, width: 'auto', marginTop: '1rem', padding: '0.5rem 1.25rem' }}>
                <RiAddLine size={16} /> Create Custom Test
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--gray-300)',
  display: 'flex',
  flexDirection: 'column',
  height: 600,
  maxHeight: '85vh',
  overflow: 'hidden',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
};

const headerStyle: React.CSSProperties = {
  background: 'var(--gray-50)',
  borderBottom: '1px solid var(--gray-200)',
  padding: '0.85rem 1.25rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0
};

const splitStyle: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '1.1fr 1.5fr',
  overflow: 'hidden'
};

const leftPanelStyle: React.CSSProperties = {
  borderRight: '1px solid var(--gray-200)',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  background: '#fafbfc',
  overflow: 'hidden'
};

const rightPanelStyle: React.CSSProperties = {
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: 'white'
};

const searchStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.65rem 0.45rem 2rem',
  border: '1px solid var(--gray-300)',
  borderRadius: 'var(--radius)',
  fontSize: '0.8rem',
  outline: 'none',
  fontFamily: 'var(--font-body)',
  background: 'white'
};

const categoryRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.3rem',
  overflowX: 'auto',
  paddingBottom: '0.5rem',
  marginBottom: '0.5rem',
  flexShrink: 0,
  borderBottom: '1px solid var(--gray-100)'
};

const categoryTabStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.25rem 0.6rem',
  borderRadius: 4,
  border: active ? '1px solid var(--teal-200)' : '1px solid var(--gray-200)',
  background: active ? 'var(--teal-50)' : 'white',
  color: active ? 'var(--teal-800)' : 'var(--gray-600)',
  fontSize: '0.72rem',
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.1s'
});

const listScrollStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  marginBottom: '0.75rem'
};

const itemCardStyle = (selected: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '0.6rem 0.8rem',
  borderRadius: 0,
  border: selected ? '1px solid var(--teal-600)' : '1px solid var(--gray-200)',
  background: selected ? 'var(--teal-700)' : 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  transition: 'all 0.1s',
  boxShadow: selected ? 'none' : '0 1px 2px rgba(0,0,0,0.02)'
});

const badgeStyle = (selected: boolean): React.CSSProperties => ({
  fontSize: '0.62rem',
  padding: '1px 5px',
  background: selected ? 'rgba(255,255,255,0.2)' : 'var(--teal-50)',
  color: selected ? 'white' : 'var(--teal-800)',
  border: `1px solid ${selected ? 'rgba(255,255,255,0.3)' : 'var(--teal-200)'}`,
  borderRadius: 4,
  fontWeight: 700
});

const newBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem',
  background: 'white',
  border: '1px dashed var(--teal-600)',
  color: 'var(--teal-800)',
  fontWeight: 700,
  fontSize: '0.8rem',
  borderRadius: 'var(--radius)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.25rem',
  flexShrink: 0,
  transition: 'all 0.15s'
};

const editorScrollStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  paddingRight: '0.25rem'
};

const editorFooterStyle: React.CSSProperties = {
  borderTop: '1px solid var(--gray-200)',
  paddingTop: '0.75rem',
  marginTop: '0.75rem',
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0
};

const emptyEditorStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem'
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: 'var(--gray-700)',
  marginBottom: '0.25rem',
  textTransform: 'uppercase'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  border: '1px solid var(--gray-300)',
  borderRadius: 'var(--radius)',
  fontSize: '0.8rem',
  color: 'var(--gray-900)',
  background: 'white',
  outline: 'none',
  fontFamily: 'var(--font-body)',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--gray-500)',
  cursor: 'pointer',
  borderRadius: 'var(--radius)',
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.1s'
};

const mainTabContainerStyle: React.CSSProperties = {
  display: 'flex',
  background: 'var(--gray-100)',
  padding: '3px',
  borderRadius: '6px',
  marginBottom: '0.75rem',
  border: '1px solid var(--gray-200)',
  flexShrink: 0
};

const mainTabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '0.45rem 0.5rem',
  borderRadius: '4px',
  border: 'none',
  background: active ? 'white' : 'transparent',
  color: active ? 'var(--gray-900)' : 'var(--gray-500)',
  fontSize: '0.72rem',
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.35rem',
  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
});

const pendingBadgeStyle: React.CSSProperties = {
  background: 'var(--red, #ef4444)',
  color: 'white',
  fontSize: '0.62rem',
  fontWeight: 700,
  padding: '1px 5px',
  borderRadius: '10px',
  lineHeight: 1
};
