'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './Header';
import { Department, Patient, PatientTest, getTestById, fetchPatients, updateTestResult, subscribeToPatients, fetchCustomTemplates, RadiologyTemplate } from '@/lib/store';
import { RiTestTubeLine, RiRadarLine, RiCheckLine, RiMoreLine, RiLogoutCircleLine, RiTimeLine, RiSettings3Line } from '@remixicon/react';
import { useAuth } from '@/components/AuthProvider';
import { RADIOLOGY_TEMPLATES, serializeRadiologyResults, deserializeRadiologyResults, RadiologyFormState, convertTextToFormattedHtml } from '@/lib/radiology-templates';
import TemplateManager from '@/components/TemplateManager';
import RichTextEditor from '@/components/RichTextEditor';

interface Props { department: Department; }

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(start);
      osc.stop(start + duration);
    };
    
    const now = audioCtx.currentTime;
    // Dual tone chime: C5 (523.25 Hz) then E5 (659.25 Hz)
    playTone(523.25, now, 0.15);
    playTone(659.25, now + 0.12, 0.35);
  } catch (err) {
    console.error('AudioContext sound failed:', err);
  }
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

// --- MCS TYPES, CONSTANTS AND HELPERS ---
const colourOptions = ['Yellow', 'Amber', 'Pale Yellow', 'Straw', 'Colourless', 'Turbid Yellow', 'Bloody', 'Brown', 'Green'];
const appearanceOptions = ['Clear', 'Turbid', 'Slightly Turbid', 'Cloudy', 'Mucus-containing', 'Bloody'];
const microscopyDefaults = ['Pus Cells', 'Epithelial Cells', 'RBCs', 'Yeast Cells', 'Trichomonas vaginalis', 'Bacteria', 'Casts', 'Crystals', 'Ova', 'Trophozoites'];
const growthOptions = ['Growth', 'No Growth', 'Sterile', 'Scanty Growth', 'Moderate Growth', 'Heavy Growth'];
const degreeOptions = ['Heavy', 'Moderate', 'Scanty', 'Nil'];
const shapeOptions = ['Cocci', 'Bacilli', 'Coccobacilli', 'Yeast-like cells', 'Nil'];

const GRAM_POSITIVE_ANTIBIOTICS = [
  { antibiotic: 'Rocephin', code: 'R' },
  { antibiotic: 'Ciprofloxacin', code: 'CPX' },
  { antibiotic: 'Azithromycin', code: 'AZ' },
  { antibiotic: 'Levofloxacin', code: 'LEV' },
  { antibiotic: 'Erythromycin', code: 'E' },
  { antibiotic: 'Pefloxacin', code: 'PEF' },
  { antibiotic: 'Gentamycin', code: 'CN' },
  { antibiotic: 'Ampiclox', code: 'APX' },
  { antibiotic: 'Zinnacef', code: 'Z' },
  { antibiotic: 'Amoxacillin', code: 'AM' }
];

const GRAM_NEGATIVE_ANTIBIOTICS = [
  { antibiotic: 'Amoxicillin Clavulanate', code: 'AUG' },
  { antibiotic: 'Cefotaxime', code: 'CTX' },
  { antibiotic: 'Imipenem/Cilastatin', code: 'IMP' },
  { antibiotic: 'Nitrofurantoin', code: 'NF' },
  { antibiotic: 'Cefuroxime', code: 'CXM' },
  { antibiotic: 'Ceftriaxone Sulbactam', code: 'CRO' },
  { antibiotic: 'Ofloxacin', code: 'OFX' },
  { antibiotic: 'Gentamycin', code: 'GN' },
  { antibiotic: 'Nalidixic Acid', code: 'NA' },
  { antibiotic: 'Ampiclox', code: 'ACX' },
  { antibiotic: 'Cefexime', code: 'ZEM' },
  { antibiotic: 'Levofloxacin', code: 'LBC' }
];

export function isMcsTest(testId: string, testName: string) {
  const id = testId.toLowerCase();
  const name = testName.toLowerCase();
  return id.endsWith('_mcs') || id.includes('mcs') || id === 'sfmcs' || name.includes('mcs') || name.includes('culture & sensitivity') || name.includes('culture and sensitivity');
}

export interface McsFormState {
  macroscopy: {
    colour: string;
    appearance: string;
  };
  microscopy: { parameter: string; value: string }[];
  culture: {
    growth: string;
    organism: string;
    degree: string;
    gramReaction: string;
    shape: string;
    incubationPeriod: string;
    incubationTemperature: string;
  };
  sensitivity: { antibiotic: string; code: string; result: 'S' | 'I' | 'R' | '' }[];
}

export const serializeMcsResults = (mcsState: McsFormState) => {
  const resultsList: { parameter: string; result: string; unit: string; range: string; flag?: string }[] = [];
  
  resultsList.push({ parameter: 'Macroscopy: Colour', result: mcsState.macroscopy.colour, unit: '', range: '' });
  resultsList.push({ parameter: 'Macroscopy: Appearance', result: mcsState.macroscopy.appearance, unit: '', range: '' });
  
  mcsState.microscopy.forEach(m => {
    if (m.parameter.trim()) {
      resultsList.push({ parameter: `Microscopy: ${m.parameter}`, result: m.value, unit: '', range: '' });
    }
  });
  
  resultsList.push({ parameter: 'Culture: Growth', result: mcsState.culture.growth, unit: '', range: '' });
  const isNoGrowth = ['no growth', 'sterile', 'no-growth'].includes(mcsState.culture.growth.trim().toLowerCase());
  if (!isNoGrowth) {
    resultsList.push({ parameter: 'Culture: Organism', result: mcsState.culture.organism, unit: '', range: '' });
    resultsList.push({ parameter: 'Culture: Degree', result: mcsState.culture.degree, unit: '', range: '' });
    resultsList.push({ parameter: 'Culture: Gram Reaction', result: mcsState.culture.gramReaction, unit: '', range: '' });
    resultsList.push({ parameter: 'Culture: Shape', result: mcsState.culture.shape, unit: '', range: '' });
    resultsList.push({ parameter: 'Culture: Incubation Period', result: mcsState.culture.incubationPeriod, unit: '', range: '' });
    resultsList.push({ parameter: 'Culture: Incubation Temperature', result: mcsState.culture.incubationTemperature, unit: '', range: '' });
    
    mcsState.sensitivity.forEach(s => {
      if (s.result) {
        resultsList.push({
          parameter: `Sensitivity: ${s.antibiotic} (${s.code})`,
          result: s.result,
          unit: '',
          range: ''
        });
      }
    });
  }
  
  return resultsList;
};

export const deserializeMcsResults = (results: any[]): McsFormState => {
  const mcsState: McsFormState = {
    macroscopy: { colour: '', appearance: '' },
    microscopy: [],
    culture: {
      growth: '',
      organism: '',
      degree: '',
      gramReaction: '',
      shape: '',
      incubationPeriod: '24 hours',
      incubationTemperature: '37°C'
    },
    sensitivity: []
  };
  
  results.forEach(r => {
    const param = r.parameter;
    const val = r.result;
    
    if (param.startsWith('Macroscopy: ')) {
      const field = param.replace('Macroscopy: ', '');
      if (field === 'Colour') mcsState.macroscopy.colour = val;
      if (field === 'Appearance') mcsState.macroscopy.appearance = val;
    } else if (param.startsWith('Microscopy: ')) {
      const pName = param.replace('Microscopy: ', '');
      mcsState.microscopy.push({ parameter: pName, value: val });
    } else if (param.startsWith('Culture: ')) {
      const field = param.replace('Culture: ', '');
      if (field === 'Growth') mcsState.culture.growth = val;
      if (field === 'Organism') mcsState.culture.organism = val;
      if (field === 'Degree') mcsState.culture.degree = val;
      if (field === 'Gram Reaction') mcsState.culture.gramReaction = val;
      if (field === 'Shape') mcsState.culture.shape = val;
      if (field === 'Incubation Period') mcsState.culture.incubationPeriod = val;
      if (field === 'Incubation Temperature') mcsState.culture.incubationTemperature = val;
    } else if (param.startsWith('Sensitivity: ')) {
      const match = param.match(/Sensitivity:\s+(.+)\s+\((.+)\)/);
      if (match) {
        const antibiotic = match[1];
        const code = match[2];
        mcsState.sensitivity.push({ antibiotic, code, result: val });
      }
    }
  });
  
  if (mcsState.microscopy.length === 0) {
    mcsState.microscopy = [
      { parameter: 'Pus Cells', value: '' },
      { parameter: 'Epithelial Cells', value: '' },
      { parameter: 'RBCs', value: '' }
    ];
  }
  
  return mcsState;
};

export default function DepartmentPage({ department }: Props) {
  const { profile, organization, signOut } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<{ patient: Patient; test: PatientTest } | null>(null);
  const [results, setResults] = useState<{ parameter: string; result: string; unit: string; range: string; flag: string }[]>([]);
  const [isMcs, setIsMcs] = useState(false);
  const [mcsState, setMcsState] = useState<McsFormState | null>(null);
  const [radiologyState, setRadiologyState] = useState<RadiologyFormState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [professional, setProfessional] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [customTemplates, setCustomTemplates] = useState<RadiologyTemplate[]>([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  const loadCustomTemplates = useCallback(async () => {
    if (!organization?.id) return;
    try {
      const data = await fetchCustomTemplates(organization.id);
      setCustomTemplates(data);
    } catch (err) {
      console.error('Error fetching custom templates:', err);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (organization?.id && department === 'radiology') {
      loadCustomTemplates();
    }
  }, [organization?.id, department, loadCustomTemplates]);

  const isLab = department === 'lab';
  const accentColor = isLab ? 'var(--teal-600)' : '#7c3aed';
  const lightColor = isLab ? 'var(--teal-50)' : '#f5f3ff';
  const borderColor = isLab ? 'var(--teal-200)' : '#c4b5fd';
  const textColor = isLab ? 'var(--teal-800)' : '#5b21b6';

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    const data = await fetchPatients(organization.id);
    setPatients(data);
    setLoadingData(false);
  }, [organization?.id]);

  useEffect(() => {
    if (!organization?.id) return;
    refresh();
    const unsub = subscribeToPatients(organization.id, refresh);
    return unsub;
  }, [organization?.id, refresh]);

  // Request desktop notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  const knownPendingTestIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Monitor new patients/tests to trigger sound & notifications
  useEffect(() => {
    if (loadingData) return;

    // Filter pending tests for this department
    const currentPendingTests = patients.flatMap(p => 
      (p.tests || [])
        .filter(t => t.department === department && t.status === 'pending')
        .map(t => ({ patientName: p.name, testName: t.testName, id: t.id }))
    );

    const currentPendingIds = new Set(currentPendingTests.map(t => t.id).filter(Boolean) as string[]);

    if (isInitialLoad.current) {
      knownPendingTestIds.current = currentPendingIds;
      isInitialLoad.current = false;
      return;
    }

    let hasNew = false;
    let newTestDetails: { patientName: string; testName: string }[] = [];

    currentPendingTests.forEach(t => {
      if (t.id && !knownPendingTestIds.current.has(t.id)) {
        hasNew = true;
        newTestDetails.push({ patientName: t.patientName, testName: t.testName });
        knownPendingTestIds.current.add(t.id);
      }
    });

    // Remove any IDs that are no longer pending
    knownPendingTestIds.current.forEach(id => {
      if (!currentPendingIds.has(id)) {
        knownPendingTestIds.current.delete(id);
      }
    });

    if (hasNew) {
      playNotificationSound();
      newTestDetails.forEach(details => {
        showToast(`New patient registered: ${details.patientName} for ${details.testName}`);
        
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('New Patient Alert', {
              body: `${details.patientName} - ${details.testName}`,
            });
          } catch (e) {
            console.error('Desktop notification failed:', e);
          }
        }
      });
    }
  }, [patients, loadingData, department]);

  // Pre-fill professional from profile
  useEffect(() => {
    if (profile?.full_name && !professional) setProfessional(profile.full_name);
  }, [profile?.full_name]);

  const deptPatients = patients.filter(p =>
    p.tests.some(t => t.department === department && t.status !== 'completed')
  );
  const completedToday = patients.filter(p =>
    p.tests.some(t => t.department === department && t.status === 'completed' &&
      new Date(t.completedAt || '').toDateString() === new Date().toDateString())
  );
  const pendingCount = deptPatients.reduce((n, p) =>
    n + p.tests.filter(t => t.department === department && t.status === 'pending').length, 0
  );

  const openEntry = async (patient: Patient, test: PatientTest) => {
    const testDef = getTestById(test.testId);
    const mcsCheck = isMcsTest(test.testId, test.testName);
    setIsMcs(mcsCheck);

    if (mcsCheck) {
      const existingResults = test.results || [];
      if (existingResults.length > 0) {
        setMcsState(deserializeMcsResults(existingResults));
      } else {
        setMcsState({
          macroscopy: { colour: 'Yellow', appearance: 'Clear' },
          microscopy: [
            { parameter: 'Pus Cells', value: '' },
            { parameter: 'Epithelial Cells', value: '' },
            { parameter: 'RBCs', value: '' }
          ],
          culture: {
            growth: 'Growth',
            organism: '',
            degree: '',
            gramReaction: '',
            shape: '',
            incubationPeriod: '24 hours',
            incubationTemperature: '37°C'
          },
          sensitivity: []
        });
      }
    } else if (department === 'radiology') {
      const existingResults = test.results || [];
      const deserialized = deserializeRadiologyResults(existingResults);
      // Pre-fill default template based on test name if empty
      if (!deserialized.findings && !deserialized.impression) {
        let defaultTemplate = '';
        if (test.testId === 'us_obs') {
          defaultTemplate = 'bpd_3_hc_ac_fl_efw_(cephalic)';
        } else if (test.testId === 'us_pelvis' || test.testId === 'us_pelvic') {
          defaultTemplate = 'normal_pelvic';
        } else if (test.testId === 'us_abd_pelvis' || test.testId === 'us_abdomen') {
          defaultTemplate = 'normal_abdominopelvic';
        }
        
        if (defaultTemplate && RADIOLOGY_TEMPLATES[defaultTemplate]) {
          deserialized.findings = convertTextToFormattedHtml(RADIOLOGY_TEMPLATES[defaultTemplate].findings);
          deserialized.impression = convertTextToFormattedHtml(RADIOLOGY_TEMPLATES[defaultTemplate].impression);
        }
      }
      setRadiologyState(deserialized);
    } else {
      if (test.results && test.results.length > 0) {
        setResults(test.results.map(r => ({ ...r, flag: r.flag || '' })));
      } else {
        setResults((testDef?.parameters || []).map(p => ({ parameter: p.name, result: '', unit: p.unit, range: p.range, flag: '' })));
      }
    }

    setNotes(test.notes || '');
    setSelected({ patient, test });
    if (test.status === 'pending') {
      try { await updateTestResult(test.id!, { status: 'in_progress' }); } catch { /* non-critical */ }
    }
  };

  const handleSubmit = async () => {
    if (!selected) return;
    if (!professional.trim()) { showToast('Please enter your name or staff ID', 'error'); return; }
    setSaving(true);

    let finalResults = results;
    if (isMcs && mcsState) {
      finalResults = serializeMcsResults(mcsState) as any;
    } else if (department === 'radiology' && radiologyState) {
      finalResults = serializeRadiologyResults(radiologyState) as any;
    }

    try {
      await updateTestResult(selected.test.id!, {
        status: 'completed',
        results: finalResults,
        completedBy: professional,
        completedBySignatureUrl: profile?.signature_url || undefined,
        completedByTitle: profile?.title || undefined,
        completedAt: new Date().toISOString(),
        notes,
      });
      showToast(`"${selected.test.testName}" result sent to reception ✓`);
      setSelected(null);
      setIsMcs(false);
      setMcsState(null);
      setRadiologyState(null);
    } catch (err: any) {
      showToast('Failed to save result: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateResult = (i: number, field: string, value: string) =>
    setResults(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const renderRadiologyEntryForm = () => {
    if (!radiologyState) return null;
    const isObs = selected?.test.testId === 'us_obs';

    const combinedTemplates = [
      ...Object.entries(RADIOLOGY_TEMPLATES).map(([key, val]) => ({
        key,
        name: val.name,
        findings: val.findings,
        impression: val.impression,
        isSystem: true
      })),
      ...customTemplates.map(t => ({
        key: t.key,
        name: t.name,
        findings: t.findings,
        impression: t.impression,
        isSystem: false
      }))
    ];

    const filteredTemplates = combinedTemplates.filter(t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const picOptions = [
      { name: 'Normal Pelvic Scan', file: 'N SCAN PELVIC.jpeg' },
      { name: 'Obstetric (BPD)', file: 'BPD.jpg' },
      { name: 'Obstetric (CRL)', file: 'CRL.jpg' },
      { name: 'Uterine Fibroid', file: 'FIBROID.jpg' },
      { name: 'Pelvic Inflammatory Disease (PID)', file: 'PID.jpg' },
      { name: 'Retained Products (RPOC)', file: 'RPOC.jpg' },
      { name: 'Adenomyosis', file: 'ADENOMYOSIS.jpg' },
      { name: 'Simple Ovarian Cyst', file: 'SIMPLE OVA CYST.jpg' },
      { name: 'Hemorrhagic Ovarian Cyst', file: 'HAEM OV CYST.jpg' },
      { name: 'Twin Pregnancy (Cephalic/Breech)', file: 'TWIN CEPH AND BREECH.jpg' },
      { name: 'Twin Pregnancy (CRL)', file: 'TWIN CRL.jpg' },
      { name: 'Twin Pregnancy (GS)', file: 'TWIN GS.jpg' },
      { name: 'Bladder Stone', file: 'BLADDER STONE.jpg' },
      { name: 'Bladder Diverticulum', file: 'BLADDER DIVERTICULUM.jpg' },
      { name: 'Benign Prostatic Hyperplasia (BPH)', file: 'BPH.jpg' },
    ];

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

    const calculateOB = () => {
      const bpdVal = parseFloat(radiologyState.measurements.bpd || '');
      const flVal = parseFloat(radiologyState.measurements.fl || '');
      const crlVal = parseFloat(radiologyState.measurements.crl || '');
      
      let totalWeeks = 0;
      let count = 0;

      if (!isNaN(bpdVal) && bpdVal > 0) {
        totalWeeks += 0.0012 * (bpdVal * bpdVal) + 0.22 * bpdVal + 7.5;
        count++;
      }
      if (!isNaN(flVal) && flVal > 0) {
        totalWeeks += 0.0015 * (flVal * flVal) + 0.26 * flVal + 10.2;
        count++;
      }
      if (!isNaN(crlVal) && crlVal > 0) {
        totalWeeks += -0.0006 * (crlVal * crlVal) + 0.15 * crlVal + 5.8;
        count++;
      }

      if (count === 0) return null;

      const avgWeeks = totalWeeks / count;
      const weeksInt = Math.floor(avgWeeks);
      const daysInt = Math.floor((avgWeeks - weeksInt) * 7);

      const remainingDays = Math.round((40 - avgWeeks) * 7);
      const eddDate = new Date();
      eddDate.setDate(eddDate.getDate() + remainingDays);

      return {
        weeks: weeksInt,
        days: daysInt,
        edd: eddDate.toLocaleDateString('en-NG'),
      };
    };

    const obResult = calculateOB();

    const applyCalculations = () => {
      if (!obResult) return;
      
      const gaStr = `${obResult.weeks} weeks ${obResult.days} day(s)`;
      const eddStr = obResult.edd;

      setRadiologyState(prev => {
        if (!prev) return null;
        
        let newFindings = prev.findings;
        let newImpression = prev.impression;

        if (newFindings.includes('EGA:')) {
          newFindings = newFindings.replace(/EGA:[^\n]*/g, `EGA: ${gaStr}`);
        } else if (newFindings.includes('Gestation age based')) {
          newFindings = newFindings.replace(/Gestation age based[^\n]*/g, `Gestation age based on BPD, HC and FL is approximately (GA): ${gaStr}`);
        } else {
          newFindings += `\nEGA: ${gaStr}`;
        }

        if (newFindings.includes('EDD:')) {
          newFindings = newFindings.replace(/EDD:[^\n]*/g, `EDD: ${eddStr}`);
        } else if (newFindings.includes('Expected date of delivery')) {
          newFindings = newFindings.replace(/Expected date of delivery[^\n]*/g, `Expected date of delivery by USG DD): ${eddStr}`);
        } else {
          newFindings += `\nEDD: ${eddStr}`;
        }

        const bpd = prev.measurements.bpd;
        const fl = prev.measurements.fl;
        if (bpd && newFindings.includes('BPD:')) {
          newFindings = newFindings.replace(/BPD:[^\n]*/g, `BPD: ${bpd} mm`);
        }
        if (fl && newFindings.includes('FL:')) {
          newFindings = newFindings.replace(/FL:[^\n]*/g, `FL: ${fl} mm`);
        }

        const conclusionText = `Single live foetus at ${gaStr} GA.`;
        if (newImpression.includes('CONCLUSION:')) {
          newImpression = newImpression.replace(/CONCLUSION:[^\n]*/g, `CONCLUSION: ${conclusionText}`);
        } else if (newImpression.includes('IMPRESSION:')) {
          newImpression = newImpression.replace(/IMPRESSION:[^\n]*/g, `IMPRESSION: ${conclusionText}`);
        } else {
          newImpression = `IMPRESSION: ${conclusionText}\nEDD: ${eddStr}\n\n` + newImpression;
        }

        return {
          ...prev,
          findings: newFindings,
          impression: newImpression,
          measurements: {
            ...prev.measurements,
            ega: gaStr,
            edd: eddStr,
          }
        };
      });
    };

    const handleSelectTemplate = (tKey: string) => {
      const template = combinedTemplates.find(t => t.key === tKey);
      if (template) {
        setRadiologyState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            findings: convertTextToFormattedHtml(template.findings),
            impression: convertTextToFormattedHtml(template.impression),
            templateId: tKey
          };
        });
      }
      setSearchQuery('');
      setShowDropdown(false);
    };

    const toggleImage = (filename: string) => {
      setRadiologyState(prev => {
        if (!prev) return null;
        const isAttached = prev.images.includes(`/uss-pics/${filename}`);
        const newImages = isAttached 
          ? prev.images.filter(img => img !== `/uss-pics/${filename}`)
          : [...prev.images, `/uss-pics/${filename}`];
        return { ...prev, images: newImages };
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
        
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <label style={labelStyle}>Search & Select Report Template</label>
            <button
              onClick={() => setShowTemplateManager(true)}
              style={{
                background: 'none', border: 'none', color: '#7c3aed',
                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.2rem',
                textTransform: 'uppercase', padding: 0
              }}
            >
              <RiSettings3Line size={13} /> Manage Templates
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Type to search e.g. Appendicitis, Pelvic, Normal..."
              style={inputStyle}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowDropdown(false);
                }}
                style={{
                  background: '#f3f4f6', border: '1px solid #d1d5db',
                  padding: '0.45rem 0.75rem', borderRadius: 'var(--radius)',
                  cursor: 'pointer', fontSize: '0.8rem'
                }}
              >
                Clear
              </button>
            )}
          </div>

          {showDropdown && filteredTemplates.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'white', border: '1px solid #d1d5db',
              borderRadius: 'var(--radius)', marginTop: '0.25rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              zIndex: 50, maxHeight: '250px', overflowY: 'auto'
            }}>
              {filteredTemplates.map(t => (
                <div
                  key={t.key}
                  onClick={() => handleSelectTemplate(t.key)}
                  style={{
                    padding: '0.6rem 0.75rem', cursor: 'pointer',
                    fontSize: '0.8rem', borderBottom: '1px solid #f3f4f6',
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {t.name}
                    {!t.isSystem && (
                      <span style={{ fontSize: '0.65rem', padding: '1px 5px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: '4px', fontWeight: 700 }}>Custom</span>
                    )}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{t.key.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          )}
          {showDropdown && filteredTemplates.length === 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'white', border: '1px solid #d1d5db',
              borderRadius: 'var(--radius)', marginTop: '0.25rem',
              padding: '0.75rem', fontSize: '0.8rem', color: '#9ca3af',
              zIndex: 50, textAlign: 'center'
            }}>
              No matching templates found
            </div>
          )}
        </div>

        {isObs && (
          <div style={{
            background: '#faf5ff', border: '1px solid #e9d5ff',
            borderRadius: 'var(--radius-lg)', padding: '1rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              Obstetrics Calculator (Hadlock Fit)
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ ...labelStyle, color: '#6b21a8' }}>BPD (mm)</label>
                <input
                  type="number"
                  placeholder="e.g. 35"
                  value={radiologyState.measurements.bpd || ''}
                  onChange={e => setRadiologyState(prev => {
                    if (!prev) return null;
                    return { ...prev, measurements: { ...prev.measurements, bpd: e.target.value } };
                  })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, color: '#6b21a8' }}>FL (mm)</label>
                <input
                  type="number"
                  placeholder="e.g. 24"
                  value={radiologyState.measurements.fl || ''}
                  onChange={e => setRadiologyState(prev => {
                    if (!prev) return null;
                    return { ...prev, measurements: { ...prev.measurements, fl: e.target.value } };
                  })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, color: '#6b21a8' }}>CRL (mm)</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={radiologyState.measurements.crl || ''}
                  onChange={e => setRadiologyState(prev => {
                    if (!prev) return null;
                    return { ...prev, measurements: { ...prev.measurements, crl: e.target.value } };
                  })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ ...labelStyle, color: '#6b21a8' }}>FHR (bpm)</label>
                <input
                  type="number"
                  placeholder="e.g. 140"
                  value={radiologyState.measurements.fhr || ''}
                  onChange={e => setRadiologyState(prev => {
                    if (!prev) return null;
                    return { ...prev, measurements: { ...prev.measurements, fhr: e.target.value } };
                  })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, color: '#6b21a8' }}>Presentation</label>
                <select
                  value={radiologyState.measurements.presentation || ''}
                  onChange={e => setRadiologyState(prev => {
                    if (!prev) return null;
                    return { ...prev, measurements: { ...prev.measurements, presentation: e.target.value } };
                  })}
                  style={inputStyle}
                >
                  <option value="">-- Select --</option>
                  <option value="Cephalic">Cephalic</option>
                  <option value="Breech">Breech</option>
                  <option value="Transverse">Transverse</option>
                  <option value="Mobile">Mobile</option>
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, color: '#6b21a8' }}>Placenta</label>
                <select
                  value={radiologyState.measurements.placenta || ''}
                  onChange={e => setRadiologyState(prev => {
                    if (!prev) return null;
                    return { ...prev, measurements: { ...prev.measurements, placenta: e.target.value } };
                  })}
                  style={inputStyle}
                >
                  <option value="">-- Select --</option>
                  <option value="POSTERIOR">Posterior</option>
                  <option value="ANTERIOR">Anterior</option>
                  <option value="FUNDAL">Fundal</option>
                  <option value="LOW LYING">Low Lying</option>
                  <option value="PLACENTA PREVIA">Placenta Previa</option>
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, color: '#6b21a8' }}>Amniotic Fluid (AFI)</label>
                <select
                  value={radiologyState.measurements.afi || ''}
                  onChange={e => setRadiologyState(prev => {
                    if (!prev) return null;
                    return { ...prev, measurements: { ...prev.measurements, afi: e.target.value } };
                  })}
                  style={inputStyle}
                >
                  <option value="">-- Select --</option>
                  <option value="ADEQUATE">Adequate</option>
                  <option value="OLIGOHYDRAMNIOS">Oligohydramnios</option>
                  <option value="POLYHYDRAMNIOS">Polyhydramnios</option>
                </select>
              </div>
            </div>

            {obResult ? (
              <div style={{
                background: 'white', padding: '0.75rem',
                borderRadius: 'var(--radius)', border: '1px solid #d8b4fe',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#4b5563', fontWeight: 500 }}>GA Estimate: </span>
                  <span style={{ fontSize: '0.9rem', color: '#6b21a8', fontWeight: 700 }}>
                    {obResult.weeks} Weeks {obResult.days} Day(s)
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginLeft: '1rem' }}>|</span>
                  <span style={{ fontSize: '0.8rem', color: '#4b5563', fontWeight: 500, marginLeft: '1rem' }}>EDD: </span>
                  <span style={{ fontSize: '0.9rem', color: '#6b21a8', fontWeight: 700 }}>{obResult.edd}</span>
                </div>
                <button
                  onClick={applyCalculations}
                  style={{
                    background: '#7c3aed', color: 'white', border: 'none',
                    padding: '0.4rem 0.8rem', borderRadius: 'var(--radius)',
                    fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Apply & Insert into Report
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>
                Enter BPD, FL, or CRL to calculate gestational age and delivery date.
              </div>
            )}
          </div>
        )}

        <div>
          <label style={labelStyle}>Report Findings (Prose)</label>
          <RichTextEditor
            value={radiologyState.findings}
            onChange={val => setRadiologyState(prev => prev ? { ...prev, findings: val } : null)}
            placeholder="Describe the findings for each organ in detail..."
          />
        </div>

        <div>
          <label style={labelStyle}>Clinical Impression / Conclusion</label>
          <RichTextEditor
            value={radiologyState.impression}
            onChange={val => setRadiologyState(prev => prev ? { ...prev, impression: val } : null)}
            placeholder="Write clinical impression, summary, or suggestions here..."
            minHeight="120px"
          />
        </div>

        <div style={{
          border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-lg)',
          padding: '1rem', background: '#f9fafb'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', margin: 0 }}>
              Attach Key Scan Images (Optional)
            </h4>
            {radiologyState.images.length > 0 && (
              <span style={{ fontSize: '0.72rem', background: '#d1fae5', color: '#065f46', padding: '0.1rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>
                {radiologyState.images.length} Image(s) Attached
              </span>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
            {picOptions.map(pic => {
              const isAttached = radiologyState.images.includes(`/uss-pics/${pic.file}`);
              return (
                <div
                  key={pic.file}
                  onClick={() => toggleImage(pic.file)}
                  style={{
                    border: `2px solid ${isAttached ? '#7c3aed' : '#e5e7eb'}`,
                    borderRadius: 'var(--radius)', background: 'white',
                    padding: '0.4rem', cursor: 'pointer', position: 'relative',
                    textAlign: 'center', overflow: 'hidden', display: 'flex',
                    flexDirection: 'column', alignItems: 'center', gap: '0.25rem'
                  }}
                >
                  <img
                    src={`/uss-pics/${pic.file}`}
                    style={{ width: '100%', height: '50px', objectFit: 'cover', borderRadius: '2px' }}
                    alt={pic.name}
                  />
                  <span style={{ fontSize: '0.62rem', fontWeight: 600, display: 'block', height: '28px', overflow: 'hidden', color: '#374151' }}>
                    {pic.name}
                  </span>
                  {isAttached && (
                    <div style={{
                      position: 'absolute', top: 2, right: 2,
                      background: '#7c3aed', color: 'white', width: 14, height: 14,
                      borderRadius: '50%', fontSize: '9px', fontWeight: 'bold',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  };

  const updateMcsState = (section: 'macroscopy' | 'culture', field: string, value: string) => {
    setMcsState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      };
    });
  };

  const updateMicroscopyRow = (index: number, field: 'parameter' | 'value', value: string) => {
    setMcsState(prev => {
      if (!prev) return null;
      const newMicro = prev.microscopy.map((m, idx) => {
        if (idx === index) {
          return { ...m, [field]: value };
        }
        return m;
      });
      return { ...prev, microscopy: newMicro };
    });
  };

  const addMicroscopyRow = () => {
    setMcsState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        microscopy: [...prev.microscopy, { parameter: '', value: '' }]
      };
    });
  };

  const removeMicroscopyRow = (index: number) => {
    setMcsState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        microscopy: prev.microscopy.filter((_, idx) => idx !== index)
      };
    });
  };

  const updateSensitivityResult = (index: number, result: 'S' | 'I' | 'R' | '') => {
    setMcsState(prev => {
      if (!prev) return null;
      const newSens = prev.sensitivity.map((s, idx) => {
        if (idx === index) {
          return { ...s, result };
        }
        return s;
      });
      return { ...prev, sensitivity: newSens };
    });
  };

  const handleGramReactionChange = (newGram: string) => {
    setMcsState(prev => {
      if (!prev) return null;
      let targetList = prev.sensitivity;
      if (newGram === 'Gram Positive') {
        targetList = GRAM_POSITIVE_ANTIBIOTICS.map(g => {
          const existing = prev.sensitivity.find(s => s.code === g.code);
          return { ...g, result: existing ? existing.result : '' as any };
        });
      } else if (newGram === 'Gram Negative') {
        targetList = GRAM_NEGATIVE_ANTIBIOTICS.map(g => {
          const existing = prev.sensitivity.find(s => s.code === g.code);
          return { ...g, result: existing ? existing.result : '' as any };
        });
      } else {
        targetList = [];
      }
      return {
        ...prev,
        culture: { ...prev.culture, gramReaction: newGram },
        sensitivity: targetList
      };
    });
  };

  const handleSensitivityKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key.toUpperCase();
    if (key === 'S' || key === 'I' || key === 'R') {
      e.preventDefault();
      updateSensitivityResult(index, key as 'S' | 'I' | 'R');
      const nextInput = document.getElementById(`anti-input-${index + 1}`);
      if (nextInput) (nextInput as HTMLInputElement).focus();
    } else if (key === 'BACKSPACE' || key === 'DELETE') {
      e.preventDefault();
      updateSensitivityResult(index, '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.getElementById(`anti-input-${index + 1}`);
      if (nextInput) (nextInput as HTMLInputElement).focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.getElementById(`anti-input-${index - 1}`);
      if (prevInput) (prevInput as HTMLInputElement).focus();
    }
  };

  const renderMcsEntryForm = () => {
    if (!mcsState) return null;
    const isNoGrowth = ['no growth', 'sterile', 'no-growth'].includes(mcsState.culture.growth.trim().toLowerCase());

    const cardStyle: React.CSSProperties = {
      background: 'white',
      border: '1px solid var(--gray-300)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: 'var(--shadow-sm)'
    };

    const cardHeaderStyle: React.CSSProperties = {
      background: 'var(--teal-50)',
      color: 'var(--teal-800)',
      fontSize: '0.8rem',
      fontWeight: 700,
      padding: '0.6rem 1rem',
      borderBottom: '1px solid var(--teal-200)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    };

    const labelStyle: React.CSSProperties = {
      display: 'block',
      fontSize: '0.72rem',
      fontWeight: 700,
      color: 'var(--gray-700)',
      marginBottom: '0.25rem',
      textTransform: 'uppercase'
    };

    const tableHeaderStyle: React.CSSProperties = {
      padding: '0.5rem 0.5rem',
      textAlign: 'left',
      fontWeight: 700,
      color: 'var(--teal-800)',
      borderBottom: '2px solid var(--teal-200)',
      fontSize: '0.72rem'
    };

    const inputStyle = (hasError: boolean): React.CSSProperties => ({
      width: '100%',
      padding: '0.45rem 0.65rem',
      border: `1px solid ${hasError ? 'var(--red)' : 'var(--gray-300)'}`,
      borderRadius: 'var(--radius)',
      fontSize: '0.8rem',
      color: 'var(--gray-900)',
      background: 'white',
      outline: 'none',
      fontFamily: 'var(--font-body)',
    });

    const halfLength = Math.ceil(mcsState.sensitivity.length / 2);
    const leftHalf = mcsState.sensitivity.slice(0, halfLength);
    const rightHalf = mcsState.sensitivity.slice(halfLength);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* ROW 1: Macroscopy & Microscopy */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {/* ROW 1, COLUMN 1: Macroscopy */}
          <div style={cardStyle}>
            <h3 style={cardHeaderStyle}>Macroscopy</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem' }}>
              <div>
                <label style={labelStyle}>Colour</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <select
                    value={colourOptions.includes(mcsState.macroscopy.colour) ? mcsState.macroscopy.colour : 'Other...'}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'Other...') {
                        updateMcsState('macroscopy', 'colour', '');
                      } else {
                        updateMcsState('macroscopy', 'colour', val);
                      }
                    }}
                    style={inputStyle(false)}
                    tabIndex={1}
                  >
                    <option value="">-- Select Colour --</option>
                    {colourOptions.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                    <option value="Other...">Other (Type custom)...</option>
                  </select>
                  {(!colourOptions.includes(mcsState.macroscopy.colour) || mcsState.macroscopy.colour === '') && (
                    <input
                      value={mcsState.macroscopy.colour}
                      onChange={e => updateMcsState('macroscopy', 'colour', e.target.value)}
                      placeholder="Type custom colour..."
                      style={{ ...inputStyle(false), flex: 1.5 }}
                      tabIndex={2}
                    />
                  )}
                </div>
              </div>
              
              <div>
                <label style={labelStyle}>Appearance</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <select
                    value={appearanceOptions.includes(mcsState.macroscopy.appearance) ? mcsState.macroscopy.appearance : 'Other...'}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'Other...') {
                        updateMcsState('macroscopy', 'appearance', '');
                      } else {
                        updateMcsState('macroscopy', 'appearance', val);
                      }
                    }}
                    style={inputStyle(false)}
                    tabIndex={3}
                  >
                    <option value="">-- Select Appearance --</option>
                    {appearanceOptions.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                    <option value="Other...">Other (Type custom)...</option>
                  </select>
                  {(!appearanceOptions.includes(mcsState.macroscopy.appearance) || mcsState.macroscopy.appearance === '') && (
                    <input
                      value={mcsState.macroscopy.appearance}
                      onChange={e => updateMcsState('macroscopy', 'appearance', e.target.value)}
                      placeholder="Type custom appearance..."
                      style={{ ...inputStyle(false), flex: 1.5 }}
                      tabIndex={4}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* ROW 1, COLUMN 2: Microscopy */}
          <div style={cardStyle}>
            <h3 style={cardHeaderStyle}>Microscopy</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
              <div style={{ overflowY: 'auto', maxHeight: '185px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--teal-50)' }}>
                      <th style={{ ...tableHeaderStyle, width: '55%' }}>Parameter</th>
                      <th style={tableHeaderStyle}>Value</th>
                      <th style={{ ...tableHeaderStyle, width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mcsState.microscopy.map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                        <td style={{ padding: '0.25rem 0.4rem' }}>
                          <select
                            value={microscopyDefaults.includes(m.parameter) ? m.parameter : 'Other...'}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === 'Other...') {
                                updateMicroscopyRow(idx, 'parameter', '');
                              } else {
                                updateMicroscopyRow(idx, 'parameter', val);
                              }
                            }}
                            style={inputStyle(false)}
                            tabIndex={10 + idx * 2}
                          >
                            <option value="">-- Select Parameter --</option>
                            {microscopyDefaults.map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                            <option value="Other...">Other (Type)...</option>
                          </select>
                          {(!microscopyDefaults.includes(m.parameter) || m.parameter === '') && (
                            <input
                              value={m.parameter}
                              onChange={e => updateMicroscopyRow(idx, 'parameter', e.target.value)}
                              placeholder="Type parameter..."
                              style={{ ...inputStyle(false), marginTop: '0.2rem' }}
                            />
                          )}
                        </td>
                        <td style={{ padding: '0.25rem 0.4rem' }}>
                          <input
                            value={m.value}
                            onChange={e => updateMicroscopyRow(idx, 'value', e.target.value)}
                            placeholder="Value (e.g. 1-2/hpf)"
                            style={inputStyle(false)}
                            tabIndex={11 + idx * 2}
                          />
                        </td>
                        <td style={{ padding: '0.25rem 0.4rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => removeMicroscopyRow(idx)}
                            style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.1rem 0.3rem' }}
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addMicroscopyRow}
                style={{ ...btnStyle('outline'), alignSelf: 'flex-start', padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}
              >
                + Add Parameter
              </button>
            </div>
          </div>
        </div>
        
        {/* ROW 2: Culture */}
        <div style={cardStyle}>
          <h3 style={cardHeaderStyle}>Culture Findings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1rem' }}>
            <div>
              <label style={labelStyle}>Growth</label>
              <select
                value={growthOptions.includes(mcsState.culture.growth) ? mcsState.culture.growth : 'Other...'}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'Other...') {
                    updateMcsState('culture', 'growth', '');
                  } else {
                    updateMcsState('culture', 'growth', val);
                  }
                }}
                style={inputStyle(false)}
                tabIndex={50}
              >
                <option value="">-- Select Growth --</option>
                {growthOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
                <option value="Other...">Other (Type custom)...</option>
              </select>
              {(!growthOptions.includes(mcsState.culture.growth) || mcsState.culture.growth === '') && (
                <input
                  value={mcsState.culture.growth}
                  onChange={e => updateMcsState('culture', 'growth', e.target.value)}
                  placeholder="Type growth description..."
                  style={{ ...inputStyle(false), marginTop: '0.25rem' }}
                />
              )}
            </div>
            
            {!isNoGrowth && (
              <>
                <div>
                  <label style={labelStyle}>Organism Isolated</label>
                  <input
                    value={mcsState.culture.organism}
                    onChange={e => updateMcsState('culture', 'organism', e.target.value)}
                    placeholder="e.g. Staphylococcus aureus"
                    style={inputStyle(false)}
                    tabIndex={51}
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Degree</label>
                  <select
                    value={degreeOptions.includes(mcsState.culture.degree) ? mcsState.culture.degree : 'Other...'}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'Other...') {
                        updateMcsState('culture', 'degree', '');
                      } else {
                        updateMcsState('culture', 'degree', val);
                      }
                    }}
                    style={inputStyle(false)}
                    tabIndex={52}
                  >
                    <option value="">-- Select Degree --</option>
                    {degreeOptions.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                    <option value="Other...">Other (Type custom)...</option>
                  </select>
                  {(!degreeOptions.includes(mcsState.culture.degree) || mcsState.culture.degree === '') && (
                    <input
                      value={mcsState.culture.degree}
                      onChange={e => updateMcsState('culture', 'degree', e.target.value)}
                      placeholder="Type degree..."
                      style={{ ...inputStyle(false), marginTop: '0.25rem' }}
                    />
                  )}
                </div>
                
                <div>
                  <label style={labelStyle}>Gram Reaction</label>
                  <select
                    value={mcsState.culture.gramReaction}
                    onChange={e => handleGramReactionChange(e.target.value)}
                    style={inputStyle(false)}
                    tabIndex={53}
                  >
                    <option value="">-- Select Reaction --</option>
                    <option value="Gram Positive">Gram Positive</option>
                    <option value="Gram Negative">Gram Negative</option>
                    <option value="Gram Variable">Gram Variable</option>
                    <option value="Not Applicable">Not Applicable</option>
                    <option value="Nil">Nil</option>
                  </select>
                </div>
                
                <div>
                  <label style={labelStyle}>Shape</label>
                  <select
                    value={shapeOptions.includes(mcsState.culture.shape) ? mcsState.culture.shape : 'Other...'}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'Other...') {
                        updateMcsState('culture', 'shape', '');
                      } else {
                        updateMcsState('culture', 'shape', val);
                      }
                    }}
                    style={inputStyle(false)}
                    tabIndex={54}
                  >
                    <option value="">-- Select Shape --</option>
                    {shapeOptions.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                    <option value="Other...">Other (Type custom)...</option>
                  </select>
                  {(!shapeOptions.includes(mcsState.culture.shape) || mcsState.culture.shape === '') && (
                    <input
                      value={mcsState.culture.shape}
                      onChange={e => updateMcsState('culture', 'shape', e.target.value)}
                      placeholder="Type shape..."
                      style={{ ...inputStyle(false), marginTop: '0.25rem' }}
                    />
                  )}
                </div>
                
                <div>
                  <label style={labelStyle}>Incubation Period</label>
                  <input
                    value={mcsState.culture.incubationPeriod}
                    onChange={e => updateMcsState('culture', 'incubationPeriod', e.target.value)}
                    placeholder="e.g. 24 hours"
                    style={inputStyle(false)}
                    tabIndex={55}
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Incubation Temp</label>
                  <input
                    value={mcsState.culture.incubationTemperature}
                    onChange={e => updateMcsState('culture', 'incubationTemperature', e.target.value)}
                    placeholder="e.g. 37°C"
                    style={inputStyle(false)}
                    tabIndex={56}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* ROW 3: Sensitivity Table */}
        {!isNoGrowth && (
          <div style={cardStyle}>
            <h3 style={cardHeaderStyle}>Antibiotic Sensitivity Testing (AST)</h3>
            <div style={{ padding: '1rem' }}>
              {!mcsState.culture.gramReaction ? (
                <div style={{ color: 'var(--amber)', background: 'var(--amber-light)', padding: '0.75rem 1rem', border: '1px solid #ffeeba', fontSize: '0.8rem', fontWeight: 600 }}>
                  Please select Gram Reaction (Gram Positive or Gram Negative) in the Culture section above to load the matching antibiotics.
                </div>
              ) : mcsState.sensitivity.length === 0 ? (
                <div style={{ color: 'var(--gray-500)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  No antibiotics populated. Verify that Gram Reaction is Gram Positive or Gram Negative.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {/* Left Column Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--teal-50)' }}>
                        <th style={{ ...tableHeaderStyle, width: '45%' }}>Antibiotic Name</th>
                        <th style={tableHeaderStyle}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leftHalf.map((s, idx) => {
                        const rowColor = s.result === 'R' ? 'rgba(192, 57, 43, 0.08)' : s.result === 'S' ? 'rgba(30, 126, 90, 0.08)' : s.result === 'I' ? 'rgba(212, 133, 10, 0.08)' : 'white';
                        const textColor = s.result === 'R' ? 'var(--red)' : s.result === 'S' ? 'var(--green)' : s.result === 'I' ? 'var(--amber)' : 'var(--gray-900)';
                        
                        return (
                          <tr key={s.code} style={{ borderBottom: '1px solid var(--gray-100)', background: rowColor }}>
                            <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600, color: textColor }}>
                              {s.antibiotic} ({s.code})
                            </td>
                            <td style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input
                                id={`anti-input-${idx}`}
                                value={s.result}
                                onChange={e => {
                                  const val = e.target.value.toUpperCase();
                                  if (['S', 'I', 'R', ''].includes(val)) {
                                    updateSensitivityResult(idx, val as any);
                                  }
                                }}
                                onKeyDown={e => handleSensitivityKeyDown(idx, e)}
                                placeholder="-"
                                maxLength={1}
                                style={{
                                  width: '32px',
                                  padding: '0.2rem',
                                  border: '1px solid var(--gray-300)',
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  color: textColor,
                                  background: 'white'
                                }}
                                tabIndex={100 + idx}
                              />
                              <div style={{ display: 'flex', gap: '0.15rem' }}>
                                {(['S', 'I', 'R'] as const).map(res => (
                                  <button
                                    key={res}
                                    type="button"
                                    onClick={() => updateSensitivityResult(idx, res)}
                                    style={{
                                      border: '1px solid var(--gray-300)',
                                      background: s.result === res ? (res === 'R' ? 'var(--red)' : res === 'S' ? 'var(--green)' : 'var(--amber)') : 'white',
                                      color: s.result === res ? 'white' : 'var(--gray-600)',
                                      fontSize: '0.65rem',
                                      fontWeight: 'bold',
                                      padding: '0.1rem 0.3rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {res}
                                  </button>
                                ))}
                                {s.result && (
                                  <button
                                    type="button"
                                    onClick={() => updateSensitivityResult(idx, '')}
                                    style={{
                                      border: 'none',
                                      background: 'none',
                                      color: 'var(--gray-400)',
                                      fontSize: '0.65rem',
                                      padding: '0.1rem 0.2rem',
                                      cursor: 'pointer',
                                      textDecoration: 'underline'
                                    }}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {/* Right Column Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--teal-50)' }}>
                        <th style={{ ...tableHeaderStyle, width: '45%' }}>Antibiotic Name</th>
                        <th style={tableHeaderStyle}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rightHalf.map((s, idx) => {
                        const globalIdx = halfLength + idx;
                        const rowColor = s.result === 'R' ? 'rgba(192, 57, 43, 0.08)' : s.result === 'S' ? 'rgba(30, 126, 90, 0.08)' : s.result === 'I' ? 'rgba(212, 133, 10, 0.08)' : 'white';
                        const textColor = s.result === 'R' ? 'var(--red)' : s.result === 'S' ? 'var(--green)' : s.result === 'I' ? 'var(--amber)' : 'var(--gray-900)';
                        
                        return (
                          <tr key={s.code} style={{ borderBottom: '1px solid var(--gray-100)', background: rowColor }}>
                            <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600, color: textColor }}>
                              {s.antibiotic} ({s.code})
                            </td>
                            <td style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input
                                id={`anti-input-${globalIdx}`}
                                value={s.result}
                                onChange={e => {
                                  const val = e.target.value.toUpperCase();
                                  if (['S', 'I', 'R', ''].includes(val)) {
                                    updateSensitivityResult(globalIdx, val as any);
                                  }
                                }}
                                onKeyDown={e => handleSensitivityKeyDown(globalIdx, e)}
                                placeholder="-"
                                maxLength={1}
                                style={{
                                  width: '32px',
                                  padding: '0.2rem',
                                  border: '1px solid var(--gray-300)',
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  color: textColor,
                                  background: 'white'
                                }}
                                tabIndex={100 + globalIdx}
                              />
                              <div style={{ display: 'flex', gap: '0.15rem' }}>
                                {(['S', 'I', 'R'] as const).map(res => (
                                  <button
                                    key={res}
                                    type="button"
                                    onClick={() => updateSensitivityResult(globalIdx, res)}
                                    style={{
                                      border: '1px solid var(--gray-300)',
                                      background: s.result === res ? (res === 'R' ? 'var(--red)' : res === 'S' ? 'var(--green)' : 'var(--amber)') : 'white',
                                      color: s.result === res ? 'white' : 'var(--gray-600)',
                                      fontSize: '0.65rem',
                                      fontWeight: 'bold',
                                      padding: '0.1rem 0.3rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {res}
                                  </button>
                                ))}
                                {s.result && (
                                  <button
                                    type="button"
                                    onClick={() => updateSensitivityResult(globalIdx, '')}
                                    style={{
                                      border: 'none',
                                      background: 'none',
                                      color: 'var(--gray-400)',
                                      fontSize: '0.65rem',
                                      padding: '0.1rem 0.2rem',
                                      cursor: 'pointer',
                                      textDecoration: 'underline'
                                    }}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const btnStyle = (variant: 'primary' | 'outline'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: variant === 'primary' ? 'none' : '1px solid var(--gray-300)',
    background: variant === 'primary' ? 'var(--teal-700)' : 'white',
    color: variant === 'primary' ? 'white' : 'var(--gray-700)',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  });

  if (!organization) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)', display: 'flex', flexDirection: 'column' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999,
          background: toast.type === 'success' ? 'var(--green)' : 'var(--red)',
          color: 'white', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius)',
          fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.2s ease', maxWidth: 380, display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <RiCheckLine size={16} /> {toast.msg}
        </div>
      )}

      <Header
        title={isLab ? 'Laboratory' : 'Radiology'}
        subtitle={organization.name}
        icon={isLab ? <RiTestTubeLine size={24} color="white" /> : <RiRadarLine size={24} color="white" />}
        accentColor={accentColor}
        notifications={pendingCount}
      />

      {/* Toolbar */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-300)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: '1.5rem', padding: '0.75rem 0' }}>
          {[
            { label: 'Pending', val: pendingCount, color: 'var(--amber)' },
            { label: 'Done Today', val: completedToday.length, color: 'var(--green)' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: s.color }}>{s.val}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--gray-500)', fontWeight: 600 }}>{s.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {department === 'radiology' && (
            <button
              onClick={() => setShowTemplateManager(true)}
              style={{
                background: 'none', border: '1px solid var(--gray-300)',
                color: 'var(--gray-700)', padding: '0.4rem 0.8rem',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                borderRadius: 0, transition: 'all 0.15s'
              }}
            >
              <RiSettings3Line size={14} /> Manage Templates
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: '1.5rem', maxWidth: 960, margin: '0 auto', width: '100%' }}>

        {/* Result Entry Panel */}
        {selected && (
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: `1px solid ${borderColor}`, marginBottom: '1.5rem', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ background: accentColor, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
                  Entering Results: {selected.test.testName}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                  {selected.patient.name || [selected.patient.firstName, selected.patient.middleName, selected.patient.surname].filter(Boolean).join(' ')} &nbsp;•&nbsp; {selected.patient.slipNumber} &nbsp;•&nbsp; Specimen: <b>{selected.test.specimen || 'Not Specified'}</b>
                </p>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: 0, padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}>
                Cancel
              </button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Professional Name / Staff ID *
                  </label>
                  <input
                    value={professional}
                    onChange={e => setProfessional(e.target.value)}
                    placeholder={isLab ? 'e.g. MLS ABDULLAHI SHEHU' : 'e.g. Dr. Fatima Abdullahi'}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }}
                  />
                </div>
                <div style={{ width: 200 }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Specimen</label>
                  <div style={{ padding: '0.55rem 0.75rem', border: '1px solid var(--gray-200)', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--gray-600)', fontWeight: 600 }}>
                    {selected.test.specimen || '—'}
                  </div>
                </div>
              </div>
              {isMcs && mcsState ? (
                renderMcsEntryForm()
              ) : department === 'radiology' && radiologyState ? (
                renderRadiologyEntryForm()
              ) : (
                <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: lightColor }}>
                        {['Parameter', 'Result', 'Unit', 'Reference Range', 'Flag'].map(h => (
                          <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700, color: textColor, borderBottom: `1px solid ${borderColor}`, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                          <td style={{ padding: '0.45rem 0.75rem', fontWeight: 500 }}>{r.parameter}</td>
                          <td style={{ padding: '0.3rem 0.5rem' }}>
                            <input
                              value={r.result}
                              onChange={e => updateResult(i, 'result', e.target.value)}
                              placeholder="Enter result"
                              style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.8rem', width: '100%', minWidth: 120, background: r.flag === 'H' ? '#fdf2f2' : r.flag === 'L' ? '#eff6ff' : 'white', fontFamily: 'var(--font-body)' }}
                            />
                          </td>
                          <td style={{ padding: '0.45rem 0.75rem', color: 'var(--gray-500)' }}>{r.unit || '—'}</td>
                          <td style={{ padding: '0.45rem 0.75rem', color: 'var(--gray-500)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{r.range || '—'}</td>
                          <td style={{ padding: '0.3rem 0.5rem' }}>
                            <select value={r.flag} onChange={e => updateResult(i, 'flag', e.target.value)} style={{ padding: '0.35rem 0.5rem', borderRadius: 0, fontSize: '0.8rem', border: '1px solid var(--gray-300)', background: r.flag === 'H' ? '#fdf2f2' : r.flag === 'L' ? '#eff6ff' : 'white', color: r.flag === 'H' ? 'var(--red)' : r.flag === 'L' ? '#1a6aaf' : 'var(--gray-500)', fontWeight: r.flag ? 700 : 400, fontFamily: 'var(--font-body)' }}>
                              <option value="">Normal</option>
                              <option value="H">H (High)</option>
                              <option value="L">L (Low)</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Comments / Remarks (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional clinical comments or interpretation..." style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '0.82rem', resize: 'vertical', fontFamily: 'var(--font-body)' }} />
              </div>
              <button onClick={handleSubmit} disabled={saving} style={{ background: accentColor, color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '0.75rem 2rem', fontSize: '0.88rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'all 0.15s' }}>
                {saving ? 'Sending...' : <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiCheckLine size={16} /> Submit & Send to Reception</span>}
              </button>
            </div>
          </div>
        )}

        {/* Queue */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--gray-900)' }}>
            Pending {isLab ? 'Lab' : 'Radiology'} Requests
          </h2>
          <span style={{ background: lightColor, color: textColor, border: `1px solid ${borderColor}`, borderRadius: 0, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>
            {pendingCount} pending
          </span>
        </div>

        {loadingData ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)' }}>Loading queue...</div>
        ) : deptPatients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)' }}>
            <div style={{ marginBottom: '1rem', color: 'var(--gray-300)' }}>{isLab ? <RiTestTubeLine size={56} /> : <RiRadarLine size={56} />}</div>
            <p style={{ fontWeight: 600 }}>No pending requests</p>
            <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>New patient tests will appear here automatically.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {deptPatients.map(patient => (
              <div key={patient.id} style={{ background: 'white', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', animation: 'fadeIn 0.3s ease' }}>
                <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', background: lightColor, color: textColor, padding: '0.15rem 0.5rem', borderRadius: 0, fontWeight: 700 }}>{patient.slipNumber}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{patient.name || [patient.firstName, patient.middleName, patient.surname].filter(Boolean).join(' ')}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{patient.age} • {patient.sex}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <RiTimeLine size={12} /> {timeAgo(patient.registeredAt)}
                  </span>
                </div>
                <div style={{ padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {patient.tests.filter(t => t.department === department && t.status !== 'completed').map(test => (
                    <div key={test.testId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', background: test.status === 'in_progress' ? 'var(--amber-light)' : lightColor, border: `1px solid ${test.status === 'in_progress' ? '#f0c97a' : borderColor}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: test.status === 'in_progress' ? 'var(--amber)' : 'var(--gray-400)' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{test.testName}</span>
                        {test.status === 'in_progress' && <span style={{ fontSize: '0.68rem', background: 'var(--amber)', color: 'white', padding: '0.1rem 0.5rem', borderRadius: 0, fontWeight: 700 }}>In Progress</span>}
                      </div>
                      <button onClick={() => openEntry(patient, test)} style={{ background: accentColor, color: 'white', border: 'none', borderRadius: 0, padding: '0.35rem 0.9rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                        {test.status === 'in_progress' ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}><RiMoreLine size={12} /> Continue</span> : 'Enter Results →'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completed Today */}
        {completedToday.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Completed Today ({completedToday.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {completedToday.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', background: 'var(--green-light)', border: '1px solid #a7d7c5', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
                  <RiCheckLine size={14} color="var(--green)" />
                  <span style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{p.name || [p.firstName, p.middleName, p.surname].filter(Boolean).join(' ')}</span>
                  <span style={{ color: 'var(--gray-500)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{p.slipNumber}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--green)', fontWeight: 600 }}>
                    {p.tests.filter(t => t.department === department && t.status === 'completed').map(t => t.testName).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <TemplateManager
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        organizationId={organization?.id || ''}
        userId={profile?.id}
        onTemplateChange={loadCustomTemplates}
      />
    </div>
  );
}
