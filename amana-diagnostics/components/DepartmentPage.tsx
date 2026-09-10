'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AppShell } from '@/components/shell';
import { ErrorBoundary, LoadingPanel } from '@/components/ui';
import { Department, Patient, PatientTest, getTestById, fetchPatients, updateTestResult, subscribeToPatients, fetchCustomTemplates, RadiologyTemplate, fetchCustomTests, setCustomCatalogueCache } from '@/lib/store';
import { RiTestTubeLine, RiRadarLine, RiCheckLine, RiSettings3Line } from '@remixicon/react';
import { useAuth } from '@/components/AuthProvider';
import { RADIOLOGY_TEMPLATES, serializeRadiologyResults, deserializeRadiologyResults, RadiologyFormState, convertTextToFormattedHtml } from '@/lib/radiology-templates';
import { windowStartIso } from '@/lib/store/useQueueStore';
import DepartmentQueue from '@/components/features/department/DepartmentQueue';
import ParameterTable, { criticalRows } from '@/components/features/department/ParameterTable';
import { CriticalValueDialog } from '@/components/features/department/CriticalValueDialog';
import { departmentTheme } from '@/components/features/department/theme';
import { normaliseSex } from '@/lib/clinical/referenceRange';
import { useNewTestAlerts } from '@/components/features/department/useNewTestAlerts';
const TemplateManager = dynamic(() => import('@/components/TemplateManager'), {
  loading: () => <LoadingPanel label="Opening templates…" />,
});
const TestManager = dynamic(() => import('@/components/TestManager'), {
  loading: () => <LoadingPanel label="Opening the test catalogue…" />,
});
import WidalEntryForm from '@/components/features/department/WidalEntryForm';
import MpsEntryForm from '@/components/features/department/MpsEntryForm';
import McsEntryForm from '@/components/features/department/McsEntryForm';
import RadiologyEntryForm from '@/components/features/department/RadiologyEntryForm';
import {
  isMcsTest, isWidalTest, isMPsTest, stripMatrixRows,
  emptyMcsState, emptyWidalState, emptyMpsState,
  serializeMcsResults, deserializeMcsResults,
  serializeWidalResults, deserializeWidalResults,
  serializeMpsResults, deserializeMpsResults,
  type McsFormState, type WidalFormState, type MpsFormState,
} from '@/lib/store/labResults';

interface Props { department: Department; }


export default function DepartmentPage({ department }: Props) {
  const { profile, organization, signOut } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [completedPatients, setCompletedPatients] = useState<Patient[]>([]);
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
  /** Panic values on this test that nobody has acknowledged yet. Non-empty
   *  means the release is blocked. */
  const [pendingCritical, setPendingCritical] = useState<ReturnType<typeof criticalRows>>([]);
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
  const theme = departmentTheme(department);

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
    // The bench shows two things, so it asks two questions, and neither answer
    // grows with the clinic's history.
    //
    // Filtering by department alone still meant "every patient who has ever had
    // a test at this bench" — the whole archive, fetched to display a morning's
    // work. Outstanding work is small by its nature and must not be bounded by
    // date, or a specimen left waiting since last month would vanish from the
    // queue. Finished work is bounded by when it was finished, not by when the
    // patient was registered, because a result can be entered days after a
    // visit.
    const [waiting, finished] = await Promise.all([
      fetchPatients(organization.id, { department, unfinished: true }),
      fetchPatients(organization.id, { department, completedSince: windowStartIso('today') }),
    ]);
    setPatients(waiting);
    setCompletedPatients(finished);
    setLoadingData(false);
  }, [organization?.id, department]);

  useEffect(() => {
    if (!organization?.id) return;
    refresh();
    const unsub = subscribeToPatients(organization.id, refresh);
    return unsub;
  }, [organization?.id, refresh]);

  useNewTestAlerts(patients, department, loadingData, showToast);

  // The result is signed by whoever is logged in. This used to be pre-filled
  // and then left editable, while the signature image beside it still came from
  // the signed-in profile — so a report could carry one person's name over
  // another person's signature. On a clinical document that is a record, not a
  // label. It stays typeable only where the account has no name to use.
  const signedBy = profile?.full_name || '';
  const canEditProfessional = !signedBy;

  useEffect(() => {
    if (signedBy && professional !== signedBy) setProfessional(signedBy);
  }, [signedBy]);

  const deptPatients = patients.filter(p =>
    p.tests.some(t => t.department === department && t.status !== 'completed')
  );
  // Already narrowed to today by the query; this keeps the exact
  // same-calendar-day reading the screen has always had.
  const completedToday = completedPatients.filter(p =>
    p.tests.some(t => t.department === department && t.status === 'completed' &&
      new Date(t.completedAt || '').toDateString() === new Date().toDateString())
  );
  // Anything not finished, not just anything not yet opened. Opening a test
  // sets it to in_progress and closing the window leaves it there, so counting
  // only 'pending' quietly under-reported the bench's outstanding work by
  // however many results someone had started and not saved.
  const pendingCount = deptPatients.reduce((n, p) =>
    n + p.tests.filter(t => t.department === department && t.status !== 'completed').length, 0
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
      // Same reason as in handleSubmit: the "in progress" marker is what stops
      // two people typing the same result, so it has to show without a reload.
      try {
        await updateTestResult(test.id!, { status: 'in_progress' });
        await refresh();
      } catch { /* non-critical */ }
    }
  };

  /** `acknowledged` is passed by the critical-value dialog, and only by it. */
  const handleSubmit = async (acknowledged = false) => {
    if (!selected) return;
    if (!professional.trim()) { showToast('Please enter your name or staff ID', 'error'); return; }

    // A critical value is not released silently. Nothing about the old save
    // distinguished a potassium of 7.1 from a normal one: the flag was a
    // dropdown nobody had to touch, and the result went to reception either
    // way. The technologist has to see the value and say so.
    const critical = criticalRows(results, normaliseSex(selected.patient.sex));
    if (critical.length > 0 && !acknowledged) {
      setPendingCritical(critical);
      return;
    }

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
      // The acknowledgement goes with the result. Recording it only in the
      // browser would mean the one fact worth auditing later — that a human
      // saw the panic value and acted — vanished with the tab. It rides in the
      // notes rather than a new column so this needs no migration; a dedicated
      // column is the right home once one is being added anyway.
      const criticalNow = criticalRows(finalResults as any, normaliseSex(selected.patient.sex));
      const notesToSave = criticalNow.length > 0
        ? [
            notes.trim(),
            `[Critical value acknowledged by ${professional} at ${new Date().toISOString()}: ` +
              criticalNow.map(c => `${c.row.parameter} ${c.row.result}${c.row.unit ? " " + c.row.unit : ""} (${c.flag})`).join("; ") + ']',
          ].filter(Boolean).join(String.fromCharCode(10))
        : notes;

      await updateTestResult(selected.test.id!, {
        status: 'completed',
        results: finalResults,
        completedBy: professional,
        completedBySignatureUrl: profile?.signature_url || undefined,
        completedByTitle: profile?.title || undefined,
        completedAt: new Date().toISOString(),
        notes: notesToSave,
      });
      // Refresh here rather than waiting to be told. The realtime channel is
      // the only other thing that moves this test out of the bench's queue, and
      // a screen whose own work does not disappear from it until the operator
      // reloads is a screen nobody trusts. When the channel is working this is
      // a duplicate fetch a moment early; when it is not, it is the difference
      // between the queue being right and being wrong.
      await refresh();
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
      setPendingCritical([]);
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
    <AppShell
      title={isLab ? 'Laboratory' : 'Radiology'}
      subtitle={organization.name}
      flush
    >
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
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: `1px solid ${theme.border}`, marginBottom: '1.5rem', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ background: theme.accent, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                    {canEditProfessional ? 'Professional Name / Staff ID *' : 'Signed by'}
                  </label>
                  <input
                    value={professional}
                    onChange={e => canEditProfessional && setProfessional(e.target.value)}
                    readOnly={!canEditProfessional}
                    title={canEditProfessional ? undefined : 'Results are signed by the account entering them'}
                    placeholder={isLab ? 'e.g. MLS ABDULLAHI SHEHU' : 'e.g. Dr. Fatima Abdullahi'}
                    style={{
                      width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--gray-300)',
                      borderRadius: 'var(--radius)', fontSize: '0.82rem', fontFamily: 'var(--font-body)',
                      background: canEditProfessional ? undefined : 'var(--gray-50)',
                      color: canEditProfessional ? undefined : 'var(--gray-600)',
                      cursor: canEditProfessional ? undefined : 'not-allowed',
                    }}
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
                  <ParameterTable results={results} onUpdate={updateResult} sex={normaliseSex(selected.patient.sex)} />
                </div>
              )}
              {((isWidal && widalState) || (isMPs && mpsState)) && results.length > 0 && (
                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal-800)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                    Additional Parameters
                  </h3>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                    <ParameterTable results={results} onUpdate={updateResult} sex={normaliseSex(selected.patient.sex)} />
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Comments / Remarks (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional clinical comments or interpretation..." style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '0.82rem', resize: 'vertical', fontFamily: 'var(--font-body)' }} />
              </div>
              <button onClick={() => handleSubmit()} disabled={saving} style={{ background: theme.accent, color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '0.75rem 2rem', fontSize: '0.88rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'all 0.15s' }}>
                {saving ? 'Sending...' : <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiCheckLine size={16} /> Submit & Send to Reception</span>}
              </button>
            </div>
          </div>
        )}

        <DepartmentQueue
          department={department}
          pending={deptPatients}
          completedToday={completedToday}
          pendingCount={pendingCount}
          loading={loadingData}
          onOpenTest={openEntry}
          theme={theme}
        />
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

      {/* The release interlock. A panic value has to be seen and named before
        * it can leave the bench; the acknowledgement is recorded with the
        * result so it is answerable afterwards. */}
      <CriticalValueDialog
        rows={pendingCritical}
        professional={professional}
        onCancel={() => setPendingCritical([])}
        onAcknowledge={() => { setPendingCritical([]); void handleSubmit(true); }}
      />
    </AppShell>
  );
}
