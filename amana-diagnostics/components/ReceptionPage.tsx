'use client';

import { useState, useEffect, useCallback } from 'react';

import { ErrorBoundary, Tabs } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import { useNotices } from '@/components/Notices';

import RegistrationTab from './features/registration/RegistrationTab';
import WalletTab from './features/wallet/WalletTab';
import SlipModal from './features/reception/SlipModal';
import ResultModal from './features/reception/ResultModal';
import { QueueTab } from './features/queue/QueueTab';
import { ResultsTab } from './features/queue/ResultsTab';
import { useResultAlerts } from './features/queue/useResultAlerts';

import { useWalletStore } from '@/lib/store/useWalletStore';
import {
  useQueueStore,
  selectPendingPatients,
  selectCompletedPatients,
  windowStartIso,
} from '@/lib/store/useQueueStore';
import {
  Patient,
  PatientProfile,
  ReferringDoctor,
  ReferringFacility,
  Test,
  TestPrice,
  BillingAccount,
  TEST_CATALOGUE,
  fetchPatients,
  fetchPatientProfiles,
  fetchReferringDoctors,
  fetchReferringFacilities,
  fetchTestPrices,
  fetchCustomTests,
  fetchBillingAccounts,
  fetchExternalCharges,
  setCustomCatalogueCache,
  subscribeToPatients,
} from '@/lib/store';

type Tab = 'register' | 'queue' | 'results' | 'wallet';

/**
 * The reception desk.
 *
 * This file was 2,282 lines. Most of that was a second, inline copy of the
 * billing wallet — its directory, its account form and its ledger — sitting
 * alongside components/features/wallet/, which had been extracted months
 * earlier, imported here, and then never rendered. Both copies were
 * maintained; only one ran.
 *
 * What is left is what this screen actually is: load the desk's data, and
 * choose which of four panels to show. Each panel owns its own behaviour, and
 * each sits in its own error boundary so a failure in one does not take the
 * queue down with it.
 */
export default function ReceptionPage() {
  const { profile, organization } = useAuth();
  const { notify } = useNotices();

  const [tab, setTab] = useState<Tab>('register');
  const [patients, setPatients] = useState<Patient[]>([]);
  /** False until the first read lands, so the backlog is not announced as news. */
  const [loaded, setLoaded] = useState(false);
  const [patientProfiles, setPatientProfiles] = useState<PatientProfile[]>([]);

  /**
   * Which document is open over the desk, if any. Registration opens the
   * pair the patient walks out with; the queue opens one at a time, for a
   * reprint.
   */
  const [showSlipModal, setShowSlipModal] = useState<{
    patient: Patient;
    purpose: 'register' | 'reprint';
  } | null>(null);
  const [showResultModal, setShowResultModal] = useState<Patient | null>(null);

  /** Reference data for the registration form. */
  const [doctors, setDoctors] = useState<ReferringDoctor[]>([]);
  const [facilities, setFacilities] = useState<ReferringFacility[]>([]);
  const [testPrices, setTestPrices] = useState<TestPrice[]>([]);
  const [catalogue, setCatalogue] = useState<Test[]>(TEST_CATALOGUE);
  const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([]);

  const dateFilter = useQueueStore((state) => state.dateFilter);

  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    try {
      // The queue wants the window the user has chosen. That filter used to run
      // in the browser, after downloading every patient the centre had ever
      // registered.
      const [data, profiles, accs, charges] = await Promise.all([
        fetchPatients(organization.id, { since: windowStartIso(dateFilter) }),
        fetchPatientProfiles(organization.id),
        fetchBillingAccounts(organization.id),
        fetchExternalCharges(organization.id),
      ]);

      // The wallet table shows one thing about a patient — the owner's name —
      // so it fetches the owners, not everybody ever charged to a wallet. That
      // set had no date bound, for a good reason: a family member seen six
      // months ago must still appear when their wallet is opened. But it grew
      // with every visit ever billed, and it was being loaded to print a column
      // of names. Membership itself loads per account, when one is opened.
      const ownerIds = Array.from(
        new Set(
          (accs || [])
            .map((a: any) => a.owner_patient_id)
            .filter((id: any) => id != null),
        ),
      );
      const owners = ownerIds.length
        ? await fetchPatients(organization.id, { ids: ownerIds })
        : [];

      setPatients(data);
      setPatientProfiles(profiles);
      setBillingAccounts(accs);
      setLoaded(true);

      // The wallet screens read from the wallet store rather than from props,
      // so this is where their data arrives. externalCharges had no setter at
      // all until this wiring, which is why the ledger's Charges tab could only
      // ever render empty.
      const wallet = useWalletStore.getState();
      wallet.setBillingAccounts(accs);
      wallet.setAccountOwners(owners);
      wallet.setExternalCharges(charges as any[]);
    } catch (e) {
      console.warn('Failed to load reception data:', e);
    }
  }, [organization?.id, dateFilter]);

  /** Reference data changes rarely, so it loads once per workspace. */
  useEffect(() => {
    if (!organization?.id) return;
    Promise.all([
      fetchReferringDoctors(organization.id),
      fetchReferringFacilities(organization.id),
      fetchTestPrices(organization.id),
      fetchCustomTests(organization.id),
    ]).then(([docs, facs, prices, customTests]) => {
      setDoctors(docs.filter((d) => d.is_active));
      setFacilities(facs.filter((f) => f.is_active));
      setTestPrices(prices);
      setCustomCatalogueCache(customTests);

      // A custom test replaces the built-in of the same id, unless it has been
      // deactivated — in which case the built-in stands.
      const merged = [...TEST_CATALOGUE];
      customTests.forEach((ct) => {
        const idx = merged.findIndex((t) => t.id === ct.id);
        if (idx !== -1) {
          if (ct.is_active !== false) merged[idx] = ct;
        } else if (ct.is_active !== false) {
          merged.push(ct);
        }
      });
      setCatalogue(merged);
    });
  }, [organization?.id]);

  useEffect(() => {
    if (!organization?.id) return;
    refresh();
    const unsubscribe = subscribeToPatients(organization.id, refresh);
    return () => {
      unsubscribe();
    };
  }, [organization?.id, refresh]);

  // A result arriving is said out loud — a chime, a notice, a desktop
  // notification — not only counted on a tab the receptionist may not be on.
  useResultAlerts(patients, !loaded, (message) => notify(message, 'success'));

  // The badge counts share the queue store's date window, so they cannot drift
  // from the lists the user is actually looking at.
  const pendingPatients = selectPendingPatients(patients, dateFilter);
  const resultsPatients = selectCompletedPatients(patients, dateFilter);
  const newResultsCount = resultsPatients.length;

  return (
    <>
      {/* Radix tabs: arrow keys move between them, only the selected tab is in
        * the tab order, and each tab is tied to the panel it controls. The strip
        * this replaces was four buttons with a borderBottom and no roles. */}
      <div style={{ padding: '0 var(--space-5)', background: 'var(--surface-raised)' }}>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          ariaLabel="Reception sections"
          items={[
            { value: 'register', label: 'Register patient' },
            { value: 'queue', label: 'Patient queue', count: pendingPatients.length },
            {
              value: 'results',
              label: 'Results ready',
              count: newResultsCount,
              alert: newResultsCount > 0,
            },
            { value: 'wallet', label: 'Patient wallet' },
          ]}
        >
          <span />
        </Tabs>
      </div>

      <div
        style={{
          flex: 1,
          padding: 'var(--space-6)',
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* One boundary per panel. A throw in the wallet ledger used to blank
          * the whole screen, including the queue being worked from. */}
        {tab === 'register' && (
          <ErrorBoundary area="registration form">
            <RegistrationTab
              patients={patients}
              patientProfiles={patientProfiles}
              doctors={doctors}
              setDoctors={setDoctors}
              facilities={facilities}
              setFacilities={setFacilities}
              testPrices={testPrices}
              catalogue={catalogue}
              billingAccounts={billingAccounts}
              organization={organization}
              setShowSlipModal={(p) => setShowSlipModal({ patient: p, purpose: 'register' })}
              onRegistered={(p) => setPatients((prev) => [p, ...prev])}
            />
          </ErrorBoundary>
        )}

        {tab === 'queue' && (
          <ErrorBoundary area="patient queue">
            <QueueTab
              patients={patients}
              onViewSlip={(p: any) => setShowSlipModal({ patient: p, purpose: 'reprint' })}
              onViewResult={(p: any) => setShowResultModal(p)}
            />
          </ErrorBoundary>
        )}

        {tab === 'results' && (
          <ErrorBoundary area="results list">
            <ResultsTab
              patients={patients}
              onViewSlip={(p: any) => setShowSlipModal({ patient: p, purpose: 'reprint' })}
              onViewResult={(p: any) => setShowResultModal(p)}
            />
          </ErrorBoundary>
        )}

        {tab === 'wallet' && (
          <ErrorBoundary area="patient wallet">
            <WalletTab
              organization={organization}
              patients={patients}
              profile={profile}
              refresh={refresh}
            />
          </ErrorBoundary>
        )}
      </div>

      {showSlipModal && (
        <SlipModal
          patient={showSlipModal.patient}
          purpose={showSlipModal.purpose}
          org={organization}
          onClose={() => {
            setShowSlipModal(null);
            setTab('queue');
          }}
        />
      )}

      {showResultModal && (
        <ResultModal
          patient={showResultModal}
          org={organization}
          onClose={() => setShowResultModal(null)}
        />
      )}
    </>
  );
}
