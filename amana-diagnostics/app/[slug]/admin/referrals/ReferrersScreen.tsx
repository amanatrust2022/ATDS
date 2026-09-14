'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  RiAddLine,
  RiEditLine,
  RiHospitalLine,
  RiMailLine,
  RiPauseCircleLine,
  RiPhoneLine,
  RiPlayCircleLine,
} from '@remixicon/react';

import { useAuth } from '@/components/AuthProvider';
import { useNotices } from '@/components/Notices';
import RequireRole from '@/components/RequireRole';
import { useShellSlot } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  EmptyState,
  Field,
  Input,
  SegmentedControl,
  SkeletonRows,
  Table,
} from '@/components/ui';
import { buildReferrers, filterReferrers, type Referrer, type ReferrerKind } from '@/lib/referrers';
import {
  ReferringDoctor,
  ReferringFacility,
  addReferringDoctor,
  addReferringFacility,
  fetchCommissionReport,
  fetchReferringDoctors,
  fetchReferringFacilities,
  recordAudit,
  updateReferringDoctor,
  updateReferringFacility,
} from '@/lib/store';

import { DoctorForm, type DoctorFormValue } from '@/components/features/referrers/DoctorForm';
import { FacilityForm, type FacilityFormValue } from '@/components/features/referrers/FacilityForm';
import { ReferrerDialog } from './ReferrerDialog';
import styles from './referrers.module.css';

const money = (n: number) => `₦${(n || 0).toLocaleString('en-NG')}`;

const EMPTY_DOCTOR: DoctorFormValue = { name: '', facilityId: '', phone: '', email: '' };
const EMPTY_FACILITY: FacilityFormValue = { name: '', address: '', phone: '', email: '' };

/**
 * Every doctor and every facility that sends this clinic patients, as one
 * table — the two screens this replaces were twins with a delete button
 * apiece, and neither delete was reversible. This one deactivates instead,
 * with an Undo, and writes an audit row either way.
 */
function ReferrersPage() {
  const { notify, ask } = useNotices();
  const { organization, profile } = useAuth();
  const params = useParams();
  const slug = (params?.slug as string) ?? organization?.slug ?? '';

  const [doctors, setDoctors] = useState<ReferringDoctor[]>([]);
  const [facilities, setFacilities] = useState<ReferringFacility[]>([]);
  const [owedByReferrer, setOwedByReferrer] = useState<Referrer[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<ReferrerKind | 'all'>('all');
  const [showInactive, setShowInactive] = useState(false);

  const [dialogKind, setDialogKind] = useState<ReferrerKind | null>(null);
  const [editing, setEditing] = useState<Referrer | null>(null);
  const [doctorForm, setDoctorForm] = useState<DoctorFormValue>(EMPTY_DOCTOR);
  const [facilityForm, setFacilityForm] = useState<FacilityFormValue>(EMPTY_FACILITY);
  const [dialogActive, setDialogActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const [docs, facs, entries] = await Promise.all([
      fetchReferringDoctors(organization.id),
      fetchReferringFacilities(organization.id),
      fetchCommissionReport(organization.id),
    ]);
    setDoctors(docs);
    setFacilities(facs);
    setOwedByReferrer(buildReferrers(docs, facs, entries, { period: '30days' }));
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => filterReferrers(owedByReferrer, { search, kind, showInactive }),
    [owedByReferrer, search, kind, showInactive],
  );

  const stats = [
    { label: 'Doctors', value: doctors.length },
    { label: 'Facilities', value: facilities.length },
    { label: 'Active', value: owedByReferrer.filter((r) => r.isActive).length },
    { label: 'Owed', value: money(owedByReferrer.reduce((s, r) => s + r.owed, 0)) },
  ];

  const openNewDoctor = () => {
    setDialogKind('doctor');
    setEditing(null);
    setDoctorForm(EMPTY_DOCTOR);
    setDialogActive(true);
    setError('');
  };
  const openNewFacility = () => {
    setDialogKind('facility');
    setEditing(null);
    setFacilityForm(EMPTY_FACILITY);
    setDialogActive(true);
    setError('');
  };

  const openEdit = (r: Referrer) => {
    setEditing(r);
    setDialogKind(r.kind);
    setDialogActive(r.isActive);
    setError('');
    if (r.kind === 'doctor') {
      setDoctorForm({ name: r.name, facilityId: r.facilityId ?? '', phone: r.phone ?? '', email: r.email ?? '' });
    } else {
      setFacilityForm({ name: r.name, address: r.address ?? '', phone: r.phone ?? '', email: r.email ?? '' });
    }
  };

  const closeDialog = () => setDialogKind(null);

  const handleSave = async () => {
    if (!organization?.id) return;
    const name = dialogKind === 'doctor' ? doctorForm.name : facilityForm.name;
    if (!name.trim()) {
      setError(dialogKind === 'doctor' ? 'Doctor name is required.' : 'Facility name is required.');
      return;
    }
    setSaving(true);
    let savedId: string | undefined;
    try {
      if (dialogKind === 'doctor') {
        const existing = editing ? doctors.find((d) => d.id === editing.id) : undefined;
        const payload = {
          name: doctorForm.name.trim(),
          facility_id: doctorForm.facilityId || undefined,
          phone: doctorForm.phone || undefined,
          email: doctorForm.email || undefined,
          // Nothing on this screen sets a rate — test_prices.commission_* is
          // what is actually used. Whatever is already here is carried
          // through untouched; a default would be silent data loss.
          commission_type: existing?.commission_type ?? 'percentage',
          commission_value: existing?.commission_value ?? 0,
          is_active: dialogActive,
          organization_id: organization.id,
        };
        if (editing) await updateReferringDoctor(editing.id, payload);
        else savedId = (await addReferringDoctor(payload, organization.id)).id;
      } else {
        const existing = editing ? facilities.find((f) => f.id === editing.id) : undefined;
        const payload = {
          name: facilityForm.name.trim(),
          address: facilityForm.address || undefined,
          phone: facilityForm.phone || undefined,
          email: facilityForm.email || undefined,
          commission_type: existing?.commission_type ?? 'percentage',
          commission_value: existing?.commission_value ?? 0,
          is_active: dialogActive,
          organization_id: organization.id,
        };
        if (editing) await updateReferringFacility(editing.id, payload);
        else savedId = (await addReferringFacility(payload, organization.id)).id;
      }
      await recordAudit({
        organization_id: organization.id,
        actor_id: profile?.id ?? null,
        actor_name: profile?.full_name ?? null,
        action: editing ? 'referrer.updated' : 'referrer.added',
        entity_type: dialogKind === 'doctor' ? 'referring_doctor' : 'referring_facility',
        entity_id: editing?.id ?? savedId ?? name.trim(),
        entity_label: name.trim(),
      }).catch((err) => console.warn('Failed to record a referrer audit entry:', err));
      closeDialog();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not save that referrer.');
    } finally {
      setSaving(false);
    }
  };

  const setReferrerActive = async (r: Referrer, active: boolean, reversesId?: string) => {
    if (!organization?.id) return;
    try {
      if (r.kind === 'doctor') {
        const full = doctors.find((d) => d.id === r.id);
        if (!full) return;
        await updateReferringDoctor(r.id, { ...full, is_active: active });
      } else {
        const full = facilities.find((f) => f.id === r.id);
        if (!full) return;
        await updateReferringFacility(r.id, { ...full, is_active: active });
      }
      const entry = await recordAudit({
        organization_id: organization.id,
        actor_id: profile?.id ?? null,
        actor_name: profile?.full_name ?? null,
        action: active ? 'referrer.reactivated' : 'referrer.deactivated',
        entity_type: r.kind === 'doctor' ? 'referring_doctor' : 'referring_facility',
        entity_id: r.id,
        entity_label: r.name,
        before: { is_active: !active },
        after: { is_active: active },
        reverses_id: reversesId ?? null,
      }).catch((err) => {
        console.warn('Failed to record a referrer audit entry:', err);
        return null;
      });
      if (active) {
        notify(`${r.name} is active again.`, 'success');
      } else {
        notify(`${r.name} is deactivated. They stop appearing when registering a patient.`, {
          tone: 'success',
          ...(entry ? { action: { label: 'Undo', run: () => setReferrerActive(r, true, entry.id) } } : {}),
        });
      }
      await load();
    } catch (e: any) {
      notify(`Could not ${active ? 'reactivate' : 'deactivate'} ${r.name}: ${e.message}`, 'error');
    }
  };

  useShellSlot(
    {
      subtitle: 'Every doctor and facility that sends you patients.',
      actions: (
        <>
          <Button intent="secondary" icon={<RiAddLine size={15} />} onClick={openNewFacility}>
            Add facility
          </Button>
          <Button intent="primary" icon={<RiAddLine size={15} />} onClick={openNewDoctor}>
            Add doctor
          </Button>
        </>
      ),
    },
    [organization?.id],
  );

  return (
    <div className={styles['screen']}>
      <div className={styles['stats']}>
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody>
              <div className={styles['stat']}>
                <span className={styles['statValue']}>{s.value}</span>
                <span className={styles['statLabel']}>{s.label}</span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <div className={styles['filters']}>
            <Field label="Search" labelHidden className={styles['searchField']}>
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, facility or address…"
              />
            </Field>
            <SegmentedControl
              value={kind}
              onValueChange={setKind}
              ariaLabel="Referrer type"
              options={[
                { value: 'all', label: 'Everyone' },
                { value: 'doctor', label: 'Doctors' },
                { value: 'facility', label: 'Facilities' },
              ]}
            />
            <Checkbox
              checked={showInactive}
              label="Show inactive"
              onChange={(e) => setShowInactive(e.target.checked)}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody flush>
          {loading ? (
            <div className={styles['loading']}>
              <SkeletonRows rows={6} columns={[2, 1, 2, 1, 1, 1, 1]} />
            </div>
          ) : (
            <Table
              caption="Referrers"
              rows={rows}
              rowKey={(r: Referrer) => r.id}
              empty={
                <EmptyState title="No referrers here yet">
                  {search || kind !== 'all'
                    ? 'Widen the search, or clear the type filter.'
                    : 'Add the doctors and facilities who refer patients to you.'}
                </EmptyState>
              }
              columns={[
                {
                  key: 'name',
                  header: 'Referrer',
                  render: (r: Referrer) => (
                    <span className={styles['name']}>{r.kind === 'doctor' ? `Dr. ${r.name}` : r.name}</span>
                  ),
                },
                {
                  key: 'type',
                  header: 'Type',
                  render: (r: Referrer) => (
                    <Badge tone={r.kind === 'doctor' ? 'accent' : 'info'}>
                      {r.kind === 'doctor' ? 'Doctor' : 'Facility'}
                    </Badge>
                  ),
                },
                {
                  key: 'facility',
                  header: 'Facility',
                  render: (r: Referrer) =>
                    r.kind === 'doctor' ? (
                      r.facilityName ? (
                        <span className={styles['facility']}>
                          <RiHospitalLine size={13} aria-hidden="true" />
                          {r.facilityName}
                        </span>
                      ) : (
                        <span className={styles['muted']}>Independent</span>
                      )
                    ) : (
                      <span className={styles['muted']}>—</span>
                    ),
                },
                {
                  key: 'contact',
                  header: 'Contact',
                  render: (r: Referrer) =>
                    r.phone || r.email ? (
                      <span className={styles['contact']}>
                        {r.phone && (
                          <span className={styles['contactLine']}>
                            <RiPhoneLine size={12} aria-hidden="true" />
                            {r.phone}
                          </span>
                        )}
                        {r.email && (
                          <span className={styles['contactLine']}>
                            <RiMailLine size={12} aria-hidden="true" />
                            {r.email}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className={styles['muted']}>—</span>
                    ),
                },
                {
                  key: 'referrals',
                  header: 'Referrals (30d)',
                  numeric: true,
                  render: (r: Referrer) => String(r.referralsInPeriod),
                },
                {
                  key: 'owed',
                  header: 'Owed',
                  numeric: true,
                  render: (r: Referrer) =>
                    r.owed > 0 ? (
                      <Link href={`/${slug}/admin/referrals/commissions?referrer=${r.id}`} className={styles['facility']}>
                        {money(r.owed)}
                      </Link>
                    ) : (
                      <span className={styles['muted']}>{money(0)}</span>
                    ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r: Referrer) => (
                    <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  actions: true,
                  render: (r: Referrer) => (
                    <span className={styles['rowActions']}>
                      <Button
                        size="sm"
                        aria-label={`Edit ${r.name}`}
                        icon={<RiEditLine size={15} />}
                        onClick={() => openEdit(r)}
                      />
                      {r.isActive ? (
                        <Button
                          size="sm"
                          intent="dangerQuiet"
                          aria-label={`Deactivate ${r.name}`}
                          icon={<RiPauseCircleLine size={15} />}
                          onClick={() => setReferrerActive(r, false)}
                        />
                      ) : (
                        <Button
                          size="sm"
                          aria-label={`Reactivate ${r.name}`}
                          icon={<RiPlayCircleLine size={15} />}
                          onClick={() => setReferrerActive(r, true)}
                        />
                      )}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <ReferrerDialog
        open={dialogKind !== null}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
        title={editing ? `Edit ${dialogKind === 'doctor' ? 'doctor' : 'facility'}` : `Add referring ${dialogKind === 'doctor' ? 'doctor' : 'facility'}`}
        saving={saving}
        error={error}
        onSave={handleSave}
        saveLabel={dialogKind === 'doctor' ? 'Save doctor' : 'Save facility'}
        activeHint={`Active ${dialogKind === 'doctor' ? 'doctors' : 'facilities'} appear in the reception dropdown.`}
        isActive={dialogActive}
        onActiveChange={setDialogActive}
      >
        {dialogKind === 'doctor' ? (
          <DoctorForm
            value={doctorForm}
            onChange={(patch) => setDoctorForm((prev) => ({ ...prev, ...patch }))}
            facilities={facilities}
          />
        ) : dialogKind === 'facility' ? (
          <FacilityForm value={facilityForm} onChange={(patch) => setFacilityForm((prev) => ({ ...prev, ...patch }))} />
        ) : null}
      </ReferrerDialog>
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedReferrersPage(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <ReferrersPage {...props} />
    </RequireRole>
  );
}
