'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './Header';
import { Department, Patient, PatientTest, getTestById, fetchPatients, updateTestResult, subscribeToPatients, fetchCustomTemplates, RadiologyTemplate, fetchCustomTests, setCustomCatalogueCache } from '@/lib/store';
import { RiTestTubeLine, RiRadarLine, RiCheckLine, RiMoreLine, RiLogoutCircleLine, RiTimeLine, RiSettings3Line } from '@remixicon/react';
import { useAuth } from '@/components/AuthProvider';
import { RADIOLOGY_TEMPLATES, serializeRadiologyResults, deserializeRadiologyResults, RadiologyFormState, convertTextToFormattedHtml } from '@/lib/radiology-templates';
import TemplateManager from '@/components/TemplateManager';
import TestManager from '@/components/TestManager';
import WidalEntryForm from '@/components/features/department/WidalEntryForm';
import MpsEntryForm from '@/components/features/department/MpsEntryForm';
import McsEntryForm from '@/components/features/department/McsEntryForm';
import RadiologyEntryForm from '@/components/features/department/RadiologyEntryForm';
import {
  colourOptions, appearanceOptions, microscopyDefaults, growthOptions, degreeOptions, shapeOptions,
  GRAM_POSITIVE_ANTIBIOTICS, GRAM_NEGATIVE_ANTIBIOTICS,
  isMcsTest, isWidalTest, isMPsTest, isNoGrowth, stripMatrixRows,
  emptyMcsState, emptyWidalState, emptyMpsState,
  serializeMcsResults, deserializeMcsResults,
  serializeWidalResults, deserializeWidalResults,
  serializeMpsResults, deserializeMpsResults,
  type McsFormState, type WidalFormState, type MpsFormState,
} from '@/lib/store/labResults';

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


export default function DepartmentPage({ department }: Props) {
  const { profile, organization, signOut } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<{ patient: Patient; test: PatientTest } | null>(null);
  const [results, setResults] = useState<{ parameter: string; result: string; unit: string; range: string; flag: string }[]>([]);
  const [isMcs, setIsMcs] = useState(false);
  const [isWidal, setIsWidal] = useState(false);
  const [isMPs, setIsMPs] = useState(false);
  const [mcsState, setMcsState] = useState<McsFormState | null>(null);
  const [widalState, setWidalState] = useState<WidalFormState | null>(null);
  const [mpsState, setMpsState] = useState<MpsFormState | null>(null);
  const [radiologyState, setRadiologyState] = useState<RadiologyFormState | null>(null);
  const [professional, setProfessional] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [customTemplates, setCustomTemplates] = useState<RadiologyTemplate[]>([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showTestManager, setShowTestManager] = useState(false);

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
    try {
      const customTests = await fetchCustomTests(organization.id);
      setCustomCatalogueCache(customTests);
    } catch (e) {
      console.error('Failed to pre-cache custom tests:', e);
    }
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
    const widalCheck = isWidalTest(test.testId, test.testName);
    const mpsCheck = isMPsTest(test.testId, test.testName);

    setIsMcs(mcsCheck);
    setIsWidal(widalCheck);
    setIsMPs(mpsCheck);

    const isFreeText = !mcsCheck && !widalCheck && !mpsCheck && (department === 'radiology' || !testDef?.parameters || testDef.parameters.length === 0);

    if (mcsCheck) {
      const existingResults = test.results || [];
      setMcsState(existingResults.length > 0 ? deserializeMcsResults(existingResults) : emptyMcsState());
    } else {
      setMcsState(null);
    }

    if (widalCheck) {
      const existingResults = test.results || [];
      setWidalState(existingResults.length > 0 ? deserializeWidalResults(existingResults) : emptyWidalState());
    } else {
      setWidalState(null);
    }

    if (mpsCheck) {
      const existingResults = test.results || [];
      setMpsState(existingResults.length > 0 ? deserializeMpsResults(existingResults) : emptyMpsState());
    } else {
      setMpsState(null);
    }

    if (isFreeText) {
      const existingResults = test.results || [];
      const deserialized = deserializeRadiologyResults(existingResults);
      // Pre-fill default template based on test name if empty (only for radiology)
      if (department === 'radiology' && !deserialized.findings && !deserialized.impression) {
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
      setRadiologyState(null);
    }

    const extraParams = (testDef?.parameters || []).filter(p =>
      !p.name.startsWith('Widal:') && !p.name.startsWith('MPs:')
    );

    if ((widalCheck || mpsCheck) && extraParams.length > 0) {
      if (test.results && test.results.length > 0) {
        const extraResults = stripMatrixRows(test.results);
        if (extraResults.length > 0) {
          setResults(extraResults.map(r => ({ ...r, flag: r.flag || '' })));
        } else {
          setResults(extraParams.map(p => ({ parameter: p.name, result: '', unit: p.unit, range: p.range, flag: '' })));
        }
      } else {
        setResults(extraParams.map(p => ({ parameter: p.name, result: '', unit: p.unit, range: p.range, flag: '' })));
      }
    } else if (!mcsCheck && !widalCheck && !mpsCheck && !isFreeText) {
      if (test.results && test.results.length > 0) {
        setResults(test.results.map(r => ({ ...r, flag: r.flag || '' })));
      } else {
        setResults((testDef?.parameters || []).map(p => ({ parameter: p.name, result: '', unit: p.unit, range: p.range, flag: '' })));
      }
    } else {
      setResults([]);
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
    } else if (isWidal && widalState && isMPs && mpsState) {
      const extraResults = stripMatrixRows(results);
      finalResults = [...serializeMpsResults(mpsState), ...serializeWidalResults(widalState), ...extraResults] as any;
    } else if (isWidal && widalState) {
      const extraResults = stripMatrixRows(results);
      finalResults = [...serializeWidalResults(widalState), ...extraResults] as any;
    } else if (isMPs && mpsState) {
      const extraResults = stripMatrixRows(results);
      finalResults = [...serializeMpsResults(mpsState), ...extraResults] as any;
    } else if (radiologyState) {
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
      setResults([]);
      setIsMcs(false);
      setIsWidal(false);
      setIsMPs(false);
      setMcsState(null);
      setWidalState(null);
      setMpsState(null);
      setRadiologyState(null);
    } catch (err: any) {
      showToast('Failed to save result: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateResult = (i: number, field: string, value: string) =>
    setResults(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));


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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setShowTestManager(true)}
            style={{
              background: 'none', border: '1px solid var(--gray-300)',
              color: 'var(--gray-700)', padding: '0.4rem 0.8rem',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              borderRadius: 0, transition: 'all 0.15s'
            }}
          >
            <RiSettings3Line size={14} /> Manage Tests
          </button>

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
              {isWidal && widalState && isMPs && mpsState ? (
                <>
                  <MpsEntryForm value={mpsState} onChange={setMpsState} />
                  <div style={{ height: '1px', borderBottom: '1px dashed var(--gray-300)', margin: '1.5rem 0' }} />
                  <WidalEntryForm value={widalState} onChange={setWidalState} />
                </>
              ) : isWidal && widalState ? (
                <WidalEntryForm value={widalState} onChange={setWidalState} />
              ) : isMPs && mpsState ? (
                <MpsEntryForm value={mpsState} onChange={setMpsState} />
              ) : isMcs && mcsState ? (
                <McsEntryForm value={mcsState} onChange={setMcsState} />
              ) : radiologyState ? (
                <RadiologyEntryForm
                  value={radiologyState}
                  onChange={setRadiologyState}
                  department={department}
                  testId={selected.test.testId}
                  customTemplates={customTemplates}
                  onManageTemplates={() => setShowTemplateManager(true)}
                />
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
              {((isWidal && widalState) || (isMPs && mpsState)) && results.length > 0 && (
                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal-800)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                    Additional Parameters
                  </h3>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
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
      {showTestManager && organization?.id && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1.5rem'
        }}>
          <div style={{ width: '100%', maxWidth: 1000 }}>
            <TestManager
              organizationId={organization.id}
              restrictDepartment={department}
              onClose={() => {
                setShowTestManager(false);
                refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
