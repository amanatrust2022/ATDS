'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiMailLine,
  RiMapPinLine,
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
  SkeletonRows,
  Table,
} from '@/components/ui';
import {
  ReferringFacility,
  addReferringFacility,
  deleteReferringFacility,
  fetchReferringFacilities,
  updateReferringFacility,
} from '@/lib/store';

import { ReferrerDialog } from '../ReferrerDialog';
import styles from '../referrers.module.css';

const EMPTY_FORM = {
  name: '',
  address: '',
  phone: '',
  email: '',
  commission_type: 'percentage' as 'percentage' | 'flat',
  commission_value: 0,
  is_active: true,
  organization_id: '',
};

type Form = typeof EMPTY_FORM;

function ReferringFacilitiesPage() {
  const { notify, ask } = useNotices();
  const { organization } = useAuth();

  const [facilities, setFacilities] = useState<ReferringFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReferringFacility | null>(null);
  const [form, setForm] = useState<Form>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setFacilities(await fetchReferringFacilities(organization.id));
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

  const openEdit = (f: ReferringFacility) => {
    setEditing(f);
    setForm({
      name: f.name,
      address: f.address || '',
      phone: f.phone || '',
      email: f.email || '',
      // Carried through untouched — see the note on the doctors screen.
      commission_type: f.commission_type,
      commission_value: f.commission_value,
      is_active: f.is_active,
      organization_id: f.organization_id,
    });
    setError('');
    setOpen(true);
  };

  useShellSlot(
    {
      subtitle: 'Hospitals, clinics and health centres that send you patients.',
      actions: (
        <Button intent="primary" icon={<RiAddLine size={15} />} onClick={openNew}>
          Add facility
        </Button>
      ),
    },
    [organization?.id],
  );

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Facility name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) await updateReferringFacility(editing.id, form);
      else await addReferringFacility(form, organization?.id || '');
      setOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not save that facility.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f: ReferringFacility) => {
    if (!(await ask(`Delete "${f.name}"? This cannot be undone.`))) return;
    try {
      await deleteReferringFacility(f.id);
      await load();
    } catch (e: any) {
      notify('Delete failed: ' + e.message, 'error');
    }
  };

  // Matches the address too. The doctors screen already searched more than the
  // name; this one only matched the name, for no reason but being a copy.
  const filtered = facilities.filter((f) => {
    const q = search.trim().toLowerCase();
    return !q || f.name.toLowerCase().includes(q) || (f.address || '').toLowerCase().includes(q);
  });

  const stats = [
    { label: 'Facilities', value: facilities.length },
    { label: 'Active', value: facilities.filter((f) => f.is_active).length },
    { label: 'With contact details', value: facilities.filter((f) => f.phone || f.email).length },
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
                placeholder="Search by name or address…"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody flush>
          {loading ? (
            <div className={styles['loading']}>
              <SkeletonRows rows={6} columns={[2, 3, 2, 1, 1]} />
            </div>
          ) : (
            <Table
              caption="Referring facilities"
              rows={filtered}
              rowKey={(f) => f.id}
              empty={
                <EmptyState title="No facilities here yet">
                  {search
                    ? 'Widen the search.'
                    : 'Add the hospitals and clinics that refer patients to you.'}
                </EmptyState>
              }
              columns={[
                {
                  key: 'name',
                  header: 'Facility',
                  render: (f: ReferringFacility) => <span className={styles['name']}>{f.name}</span>,
                },
                {
                  key: 'address',
                  header: 'Address',
                  render: (f: ReferringFacility) =>
                    f.address ? (
                      <span className={styles['contactLine']}>
                        <RiMapPinLine size={12} aria-hidden="true" />
                        {f.address}
                      </span>
                    ) : (
                      <span className={styles['muted']}>—</span>
                    ),
                },
                {
                  key: 'contact',
                  header: 'Contact',
                  render: (f: ReferringFacility) =>
                    f.phone || f.email ? (
                      <span className={styles['contact']}>
                        {f.phone && (
                          <span className={styles['contactLine']}>
                            <RiPhoneLine size={12} aria-hidden="true" />
                            {f.phone}
                          </span>
                        )}
                        {f.email && (
                          <span className={styles['contactLine']}>
                            <RiMailLine size={12} aria-hidden="true" />
                            {f.email}
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
                  render: (f: ReferringFacility) => (
                    <Badge tone={f.is_active ? 'success' : 'neutral'}>
                      {f.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  actions: true,
                  render: (f: ReferringFacility) => (
                    <span className={styles['rowActions']}>
                      <Button
                        size="sm"
                        aria-label={`Edit ${f.name}`}
                        icon={<RiEditLine size={15} />}
                        onClick={() => openEdit(f)}
                      />
                      <Button
                        size="sm"
                        intent="dangerQuiet"
                        aria-label={`Delete ${f.name}`}
                        icon={<RiDeleteBinLine size={15} />}
                        onClick={() => handleDelete(f)}
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
        title={editing ? 'Edit facility' : 'Add referring facility'}
        saving={saving}
        error={error}
        onSave={handleSave}
        saveLabel="Save facility"
        activeHint="Active facilities appear in the reception dropdown."
        isActive={form.is_active}
        onActiveChange={(next) => setForm({ ...form, is_active: next })}
      >
        <Field label="Facility name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. City General Hospital"
          />
        </Field>

        <Field label="Address" optional>
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="12 Clinic Road, Kano"
          />
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
            placeholder="info@example.com"
          />
        </Field>
      </ReferrerDialog>
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedReferringFacilitiesPage(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <ReferringFacilitiesPage {...props} />
    </RequireRole>
  );
}
