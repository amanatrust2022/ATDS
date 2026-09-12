'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Alert, Button, Dialog, Field, Input, LoadingPanel, Textarea } from '@/components/ui';
import { useNotices } from '@/components/Notices';
import styles from './DepartmentPage.module.css';
import { Department, Patient, PatientTest, getTestById, fetchPatients, updateTestResult, subscribeToPatients, fetchCustomTemplates, RadiologyTemplate, fetchCustomTests, setCustomCatalogueCache } from '@/lib/store';
import { RiCheckLine, RiErrorWarningLine, RiSettings3Line } from '@remixicon/react';
import { useAuth } from '@/components/AuthProvider';
import { RADIOLOGY_TEMPLATES, serializeRadiologyResults, deserializeRadiologyResults, RadiologyFormState, convertTextToFormattedHtml } from '@/lib/radiology-templates';
import { windowStartIso } from '@/lib/store/useQueueStore';
import DepartmentQueue from '@/components/features/department/DepartmentQueue';
import ParameterTable, { criticalRows } from '@/components/features/department/ParameterTable';
import { CriticalValueDialog } from '@/components/features/department/CriticalValueDialog';
import { normaliseSex } from '@/lib/clinical/referenceRange';
import { useNewTestAlerts } from '@/components/features/department/useNewTestAlerts';
import { loadDraft, saveDraft, clearDraft, draftTestIds } from '@/lib/store/resultDrafts';
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
  const { profile, organization } = useAuth();
  const { ask } = useNotices();
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
  /** Tests with a half-typed result kept on this machine. Shown in the queue. */
  const [drafts, setDrafts] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (organization?.id) setDrafts(draftTestIds(organization.id));
  }, [organization?.id]);

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

  // One timer. Two toasts in quick succession used to leave the first
  // timer running, which cleared the second one early.
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

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

  /**
   * Fills the form for a test: from its saved result if it has one, from the
   * catalogue's parameters if not — and then from the draft kept on this
   * machine, which is newer than either. Returns whether a draft was used.
   */
  const loadForm = (test: PatientTest): boolean => {
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

    // Whatever was typed last time this test was open, on this machine, is
    // newer than anything above. See lib/store/resultDrafts.ts.
    const draft = organization?.id && test.id ? loadDraft(organization.id, test.id) : null;
    if (draft) {
      setResults(draft.results.map(r => ({ ...r, flag: r.flag || '' })));
      setNotes(draft.notes);
      if (mcsCheck && draft.mcsState) setMcsState(draft.mcsState);
      if (widalCheck && draft.widalState) setWidalState(draft.widalState);
      if (mpsCheck && draft.mpsState) setMpsState(draft.mpsState);
      if (isFreeText && draft.radiologyState) setRadiologyState(draft.radiologyState);
    }
    return draft !== null;
  };

  const openEntry = async (patient: Patient, test: PatientTest) => {
    restoredFromDraft.current = loadForm(test);
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
      if (organization?.id && selected.test.id) {
        const sentId = selected.test.id;
        clearDraft(organization.id, sentId);
        setDrafts(prev => { const next = new Set(prev); next.delete(sentId); return next; });
      }
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

  /**
   * What the form looked like when it opened, so a form nobody has typed in
   * is not written down as a draft.
   */
  const snapshot = () =>
    JSON.stringify({ results, notes, mcsState, widalState, mpsState, radiologyState });
  const openedAs = useRef('');
  /** Whether the form opened from a draft — then it is one, typed in or not. */
  const restoredFromDraft = useRef(false);
  useEffect(() => {
    if (selected) openedAs.current = snapshot();
    // Only when a test is opened; every setState in openEntry lands in the
    // same commit, so the snapshot sees all of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Every keystroke is kept. Closing the form — by choice, by Escape, by the
  // browser being shut — used to lose all of it, first silently and then
  // behind a question; now it loses nothing, and the same test opens where it
  // was left. The draft is deleted when the result is sent.
  const draftId = selected?.test.id;
  useEffect(() => {
    if (!selected || !organization?.id || !draftId) return;
    if (!restoredFromDraft.current && snapshot() === openedAs.current) return;
    const kept = saveDraft(organization.id, draftId, { results, notes, mcsState, widalState, mpsState, radiologyState });
    if (kept) setDrafts(prev => (prev.has(draftId) ? prev : new Set(prev).add(draftId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, notes, mcsState, widalState, mpsState, radiologyState, selected, organization?.id, draftId]);

  const hasDraftOpen = !!draftId && drafts.has(draftId);

  const closePanel = () => {
    setSelected(null);
  };

  const discardDraft = async () => {
    if (!selected || !organization?.id || !draftId) return;
    if (!(await ask('Discard this draft? What you have typed for this test will be gone.'))) return;
    clearDraft(organization.id, draftId);
    setDrafts(prev => { const next = new Set(prev); next.delete(draftId); return next; });
    restoredFromDraft.current = false;
    loadForm(selected.test);
  };

  const updateResult = (i: number, field: string, value: string) =>
    setResults(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  if (!organization) return null;

  const patientName =
    selected?.patient.name ||
    [selected?.patient.firstName, selected?.patient.middleName, selected?.patient.surname]
      .filter(Boolean)
      .join(' ');

  return (
    <>
      {/* Said out loud, not only painted. A result going to reception — or
        * failing to — is the one thing this screen must tell you. While the
        * entry dialog is open the message is shown inside it instead: a modal
        * hides the rest of the page from assistive technology, so a toast out
        * here would be painted but never announced. */}
      {toast && !selected && (
        <div
          className={`${styles['toast']} ${toast.type === 'success' ? styles['toastSuccess'] : styles['toastError']}`}
          role={toast.type === 'success' ? 'status' : 'alert'}
        >
          {toast.type === 'success'
            ? <RiCheckLine size={16} aria-hidden="true" />
            : <RiErrorWarningLine size={16} aria-hidden="true" />}
          {toast.msg}
        </div>
      )}

      <div className={styles['toolbar']}>
        <ul className={styles['stats']}>
          <li className={styles['stat']}>
            <span className={`${styles['statNum']} ${styles['statPending']}`}>{pendingCount}</span>
            <span className={styles['statLabel']}>Pending</span>
          </li>
          <li className={styles['stat']}>
            <span className={`${styles['statNum']} ${styles['statDone']}`}>{completedToday.length}</span>
            <span className={styles['statLabel']}>Done today</span>
          </li>
        </ul>
        <div className={styles['tools']}>
          <Button size="sm" icon={<RiSettings3Line size={14} />} onClick={() => setShowTestManager(true)}>
            Manage Tests
          </Button>
          {department === 'radiology' && (
            <Button size="sm" icon={<RiSettings3Line size={14} />} onClick={() => setShowTemplateManager(true)}>
              Manage Templates
            </Button>
          )}
        </div>
      </div>

      <div className={styles['main']}>
        <DepartmentQueue
          department={department}
          pending={deptPatients}
          completedToday={completedToday}
          pendingCount={pendingCount}
          loading={loadingData}
          onOpenTest={openEntry}
          draftTestIds={drafts}
        />
      </div>

      {/* The entry form is a dialog over the bench rather than a card pushed
        * in above the queue. As a card, a long form — a full blood count, a
        * radiology report — shoved the queue off the bottom of the screen,
        * and the queue kept taking clicks while a result was half-typed.
        * Here the work is held in one place and focus stays inside it.
        * Closing it, by any route, keeps what was typed as a draft. */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => { if (!open) closePanel(); }}
        title={selected ? `Entering Results: ${selected.test.testName}` : 'Entering Results'}
        description={selected ? (
          <>
            {patientName} &nbsp;•&nbsp; {selected.patient.slipNumber} &nbsp;•&nbsp; Specimen:{' '}
            <b>{selected.test.specimen || 'Not Specified'}</b>
          </>
        ) : undefined}
        size="xl"
        footerNote={hasDraftOpen ? 'Draft kept on this computer until the result is sent.' : undefined}
        footer={
          <>
            {hasDraftOpen && (
              <Button intent="ghost" onClick={() => void discardDraft()} disabled={saving}>Discard draft</Button>
            )}
            <Button intent="ghost" onClick={closePanel} disabled={saving} aria-label="Close and keep draft">Close</Button>
            <Button
              intent="primary"
              loading={saving}
              icon={<RiCheckLine size={16} />}
              onClick={() => handleSubmit()}
            >
              {saving ? 'Sending…' : 'Submit & Send to Reception'}
            </Button>
          </>
        }
      >
        {selected && (
          <div className={styles['entryBody']}>
            {toast && (
              <Alert tone={toast.type === 'error' ? 'critical' : 'success'} live>
                {toast.msg}
              </Alert>
            )}

            <div className={styles['signRow']}>
              <Field
                label={canEditProfessional ? 'Professional name / staff ID' : 'Signed by'}
                required={canEditProfessional}
                hint={canEditProfessional ? undefined : 'Results are signed by the account entering them.'}
              >
                <Input
                  value={professional}
                  onChange={(e) => canEditProfessional && setProfessional(e.target.value)}
                  readOnly={!canEditProfessional}
                  placeholder={isLab ? 'e.g. MLS ABDULLAHI SHEHU' : 'e.g. Dr. Fatima Abdullahi'}
                />
              </Field>
              <div className={styles['specimen']}>
                <span className="sr-only">Specimen: </span>
                {selected.test.specimen || '—'}
              </div>
            </div>

            {isWidal && widalState && isMPs && mpsState ? (
              <>
                <MpsEntryForm value={mpsState} onChange={setMpsState} />
                <hr className={styles['split']} />
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
              <div className={styles['scroll']}>
                <ParameterTable results={results} onUpdate={updateResult} sex={normaliseSex(selected.patient.sex)} />
              </div>
            )}

            {((isWidal && widalState) || (isMPs && mpsState)) && results.length > 0 && (
              <section className={styles['extra']} aria-labelledby="extra-title">
                <h3 id="extra-title" className={styles['extraTitle']}>Additional parameters</h3>
                <div className={styles['extraTable']}>
                  <ParameterTable results={results} onUpdate={updateResult} sex={normaliseSex(selected.patient.sex)} />
                </div>
              </section>
            )}

            <Field label="Comments / remarks" optional>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Additional clinical comments or interpretation..."
              />
            </Field>
          </div>
        )}
      </Dialog>


      <TemplateManager
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        organizationId={organization?.id || ''}
        userId={profile?.id}
        onTemplateChange={loadCustomTemplates}
      />

      {/* Was a fixed div: no dialog role, no focus trap, Escape did nothing,
        * and the bench behind it stayed in the tab order. */}
      <Dialog
        open={showTestManager && !!organization?.id}
        onOpenChange={(open) => { if (!open) { setShowTestManager(false); refresh(); } }}
        title="Manage tests"
        titleHidden
        size="xl"
        flush
      >
        {organization?.id && (
          <TestManager
            organizationId={organization.id}
            restrictDepartment={department}
            onClose={() => { setShowTestManager(false); refresh(); }}
          />
        )}
      </Dialog>

      {/* The release interlock. A panic value has to be seen and named before
        * it can leave the bench; the acknowledgement is recorded with the
        * result so it is answerable afterwards. */}
      <CriticalValueDialog
        rows={pendingCritical}
        professional={professional}
        onCancel={() => setPendingCritical([])}
        onAcknowledge={() => { setPendingCritical([]); void handleSubmit(true); }}
      />
    </>
  );
}
