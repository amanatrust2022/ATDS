'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiHospitalLine,
  RiMailLine,
  RiPhoneLine,
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
  EmptyState,
  Field,
  Input,
  Select,
  SkeletonRows,
  Table,
} from '@/components/ui';
import {
  ReferringDoctor,
  ReferringFacility,
  addReferringDoctor,
  deleteReferringDoctor,
  fetchReferringDoctors,
  fetchReferringFacilities,
  updateReferringDoctor,
} from '@/lib/store';

import { ReferrerDialog } from '../ReferrerDialog';
import styles from '../referrers.module.css';

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  facility_id: '',
  commission_type: 'percentage' as 'percentage' | 'flat',
  commission_value: 0,
  is_active: true,
  organization_id: '',
};

type Form = typeof EMPTY_FORM;

function ReferringDoctorsPage() {
  const { notify, ask } = useNotices();
  const { organization } = useAuth();

  const [doctors, setDoctors] = useState<ReferringDoctor[]>([]);
  const [facilities, setFacilities] = useState<ReferringFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReferringDoctor | null>(null);
  const [form, setForm] = useState<Form>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!organization?.id) return;
    const [docs, facs] = await Promise.all([
      fetchReferringDoctors(organization.id),
      fetchReferringFacilities(organization.id),
    ]);
    setDoctors(docs);
    setFacilities(facs);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, organization_id: organization?.id || '' });
    setError('');
    setOpen(true);
  };

  const openEdit = (d: ReferringDoctor) => {
    setEditing(d);
    setForm({
      name: d.name,
      phone: d.phone || '',
      email: d.email || '',
      facility_id: d.facility_id || '',
      // Carried through untouched. Nothing on this screen can set a rate, so
      // whatever is here came from elsewhere — writing back a default would be
      // silent data loss on a field the desk cannot see.
      commission_type: d.commission_type,
      commission_value: d.commission_value,
      is_active: d.is_active,
      organization_id: d.organization_id,
    });
    setError('');
    setOpen(true);
  };

  useShellSlot(
    {
      subtitle: 'Individual doctors who send you patients.',
      actions: (
        <Button intent="primary" icon={<RiAddLine size={15} />} onClick={openNew}>
          Add doctor
        </Button>
      ),
    },
    [organization?.id],
  );

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Doctor name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, facility_id: form.facility_id || undefined };
      if (editing) await updateReferringDoctor(editing.id, payload);
      else await addReferringDoctor(payload, organization?.id || '');
      setOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not save that doctor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: ReferringDoctor) => {
    if (!(await ask(`Delete Dr. ${d.name}? This cannot be undone.`))) return;
    try {
      await deleteReferringDoctor(d.id);
      await load();
    } catch (e: any) {
      notify('Delete failed: ' + e.message, 'error');
    }
  };

  const filtered = doctors.filter((d) => {
    const q = search.trim().toLowerCase();
    const nameMatch =
      !q || d.name.toLowerCase().includes(q) || (d.facility_name || '').toLowerCase().includes(q);
    return nameMatch && (!facilityFilter || d.facility_id === facilityFilter);
  });

  const stats = [
    { label: 'Doctors', value: doctors.length },
    { label: 'Active', value: doctors.filter((d) => d.is_active).length },
    { label: 'Linked to a facility', value: doctors.filter((d) => d.facility_id).length },
  ];

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
                placeholder="Search by doctor or facility…"
              />
            </Field>
            <Field label="Facility">
              <Select value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}>
                <option value="">All facilities</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody flush>
          {loading ? (
            <div className={styles['loading']}>
              <SkeletonRows rows={6} columns={[2, 2, 2, 1, 1]} />
            </div>
          ) : (
            <Table
              caption="Referring doctors"
              rows={filtered}
              rowKey={(d) => d.id}
              empty={
                <EmptyState title="No doctors here yet">
                  {search || facilityFilter
                    ? 'Widen the search, or clear the facility filter.'
                    : 'Add the doctors who refer patients to you.'}
                </EmptyState>
              }
              columns={[
                {
                  key: 'name',
                  header: 'Doctor',
                  render: (d: ReferringDoctor) => <span className={styles['name']}>Dr. {d.name}</span>,
                },
                {
                  key: 'facility',
                  header: 'Facility',
                  render: (d: ReferringDoctor) =>
                    d.facility_name ? (
                      <span className={styles['facility']}>
                        <RiHospitalLine size={13} aria-hidden="true" />
                        {d.facility_name}
                      </span>
                    ) : (
                      <span className={styles['muted']}>Independent</span>
                    ),
                },
                {
                  key: 'contact',
                  header: 'Contact',
                  render: (d: ReferringDoctor) =>
                    d.phone || d.email ? (
                      <span className={styles['contact']}>
                        {d.phone && (
                          <span className={styles['contactLine']}>
                            <RiPhoneLine size={12} aria-hidden="true" />
                            {d.phone}
                          </span>
                        )}
                        {d.email && (
                          <span className={styles['contactLine']}>
                            <RiMailLine size={12} aria-hidden="true" />
                            {d.email}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className={styles['muted']}>—</span>
                    ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (d: ReferringDoctor) => (
                    <Badge tone={d.is_active ? 'success' : 'neutral'}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  actions: true,
                  render: (d: ReferringDoctor) => (
                    <span className={styles['rowActions']}>
                      {/* Named, not bare icons. These were two unlabelled
                       * buttons — one of which deletes. */}
                      <Button
                        size="sm"
                        aria-label={`Edit Dr. ${d.name}`}
                        icon={<RiEditLine size={15} />}
                        onClick={() => openEdit(d)}
                      />
                      <Button
                        size="sm"
                        intent="dangerQuiet"
                        aria-label={`Delete Dr. ${d.name}`}
                        icon={<RiDeleteBinLine size={15} />}
                        onClick={() => handleDelete(d)}
                      />
                    </span>
                  ),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <ReferrerDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit doctor' : 'Add referring doctor'}
        saving={saving}
        error={error}
        onSave={handleSave}
        saveLabel="Save doctor"
        activeHint="Active doctors appear in the reception dropdown."
        isActive={form.is_active}
        onActiveChange={(next) => setForm({ ...form, is_active: next })}
      >
        <Field label="Doctor name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Amina Bello"
          />
        </Field>

        <Field label="Linked facility" optional hint="Leave blank for an independent doctor.">
          <Select
            value={form.facility_id}
            onChange={(e) => setForm({ ...form, facility_id: e.target.value })}
          >
            <option value="">Independent — no facility</option>
            {facilities
              .filter((f) => f.is_active || f.id === form.facility_id)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </Select>
        </Field>

        <Field label="Phone" optional>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+234 …"
          />
        </Field>

        <Field label="Email" optional>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="doctor@example.com"
          />
        </Field>
      </ReferrerDialog>
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedReferringDoctorsPage(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <ReferringDoctorsPage {...props} />
    </RequireRole>
  );
}
