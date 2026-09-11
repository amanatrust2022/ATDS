'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiDownloadLine } from '@remixicon/react';

import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { useShellSlot } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  SegmentedControl,
  SkeletonRows,
  Table,
} from '@/components/ui';
import { downloadCsv, toCsv } from '@/lib/csv';
import { fetchPatients, Patient } from '@/lib/store';
import { patientDisplayName } from '@/lib/store/patientName';

import { EditPatientDialog } from './EditPatientDialog';
import { PatientDetail } from './PatientDetail';
import styles from './patients.module.css';

/** Thirty days ago, as the `yyyy-mm-dd` a date input wants. */
const defaultFrom = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
})();

type DeptFilter = 'all' | 'lab' | 'radiology';

function PatientDatabasePage() {
  const { organization } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<DeptFilter>('all');
  // Opens on the last thirty days rather than on everything.
  //
  // This screen used to fetch every patient the centre had ever registered and
  // then filter them in the browser — on the first day that is nothing, and in
  // year three it is the slowest page in the building. The window is a real
  // date in the box, not a hidden cap: widen it and the wider set is fetched,
  // so nothing is out of reach, it just has to be asked for.
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Patient | null>(null);
  const [editing, setEditing] = useState<Patient | null>(null);

  const loadPatients = useCallback(() => {
    if (!organization?.id) return;
    setLoading(true);
    // The date range and the department go to the database. Search stays in the
    // browser: it matches the slip number too, which the query does not.
    fetchPatients(organization.id, {
      since: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      until: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
      department: deptFilter === 'all' ? undefined : deptFilter,
    }).then((data) => {
      setPatients(data);
      setSelected((prev) => (prev ? data.find((p) => p.id === prev.id) || null : null));
      setLoading(false);
    });
  }, [organization?.id, dateFrom, dateTo, deptFilter]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        patientDisplayName(p).toLowerCase().includes(q) ||
        p.slipNumber.toLowerCase().includes(q) ||
        (p.phone || '').includes(q),
    );
  }, [patients, search]);

  useShellSlot(
    { subtitle: `${patients.length} on record in this period · ${filtered.length} shown` },
    [patients.length, filtered.length],
  );

  const exportCsv = () => {
    const rows = [
      ['Slip No', 'Name', 'Age', 'Sex', 'Phone', 'Referred By', 'Facility', 'Tests', 'Registered'],
      ...filtered.map((p) => [
        p.slipNumber,
        patientDisplayName(p),
        p.age,
        p.sex,
        p.phone,
        p.referredBy || '',
        p.referringFacility || '',
        p.tests.map((t) => t.testName).join('; '),
        new Date(p.registeredAt).toLocaleDateString('en-NG'),
      ]),
    ];
    // Escaped, formula-proofed and BOM-prefixed by lib/csv.ts. This used to be
    // `"${cell}"` with nothing escaped, so a name containing a quote shifted
    // every column after it, and one starting with = ran as a formula.
    downloadCsv('patients.csv', toCsv(rows));
  };

  const filtersActive = Boolean(search || dateTo || deptFilter !== 'all' || dateFrom !== defaultFrom);

  return (
    <div className={styles['screen']}>
      <Card>
        <CardBody>
          <div className={styles['filters']}>
            <Field label="Search" labelHidden className={styles['searchField']}>
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, slip number or phone…"
              />
            </Field>

            <SegmentedControl
              value={deptFilter}
              onValueChange={setDeptFilter}
              ariaLabel="Department"
              options={[
                { value: 'all', label: 'All' },
                { value: 'lab', label: 'Lab' },
                { value: 'radiology', label: 'Radiology' },
              ]}
            />

            <div className={styles['dates']}>
              <Field label="From" className={styles['dateField']}>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </Field>
              <Field label="To" className={styles['dateField']}>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </Field>
            </div>

            <div className={styles['filterActions']}>
              {filtersActive && (
                <Button
                  onClick={() => {
                    setSearch('');
                    setDateFrom(defaultFrom);
                    setDateTo('');
                    setDeptFilter('all');
                  }}
                >
                  Reset
                </Button>
              )}
              <Button icon={<RiDownloadLine size={15} />} onClick={exportCsv}>
                Export CSV
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className={selected ? styles['splitOpen'] : styles['split']}>
        <Card>
          <CardBody flush>
            {loading ? (
              <div className={styles['loading']}>
                <SkeletonRows rows={8} columns={[1, 3, 1, 2, 3, 1, 1]} />
              </div>
            ) : (
              <Table
                caption="Patients registered in this period"
                rows={filtered}
                rowKey={(p) => String(p.id)}
                onRowClick={(p) => setSelected((prev) => (prev?.id === p.id ? null : p))}
                isRowSelected={(p) => selected?.id === p.id}
                empty={
                  <EmptyState title="No patients match these filters">
                    Widen the dates, or clear the search.
                  </EmptyState>
                }
                columns={[
                  {
                    key: 'slip',
                    header: 'Slip no',
                    render: (p: Patient) => <span className={styles['mono']}>{p.slipNumber}</span>,
                  },
                  {
                    key: 'patient',
                    header: 'Patient',
                    render: (p: Patient) => (
                      <span className={styles['stack']}>
                        <span className={styles['strong']}>{patientDisplayName(p)}</span>
                        {p.referredBy && (
                          <span className={styles['muted']}>Referred by {p.referredBy}</span>
                        )}
                      </span>
                    ),
                  },
                  {
                    key: 'ageSex',
                    header: 'Age / sex',
                    render: (p: Patient) => `${p.age} / ${p.sex}`,
                  },
                  { key: 'phone', header: 'Phone', render: (p: Patient) => p.phone || '—' },
                  {
                    key: 'tests',
                    header: 'Tests',
                    render: (p: Patient) => (
                      <span className={styles['tests']}>
                        {p.tests.slice(0, 3).map((t) => (
                          <Badge key={t.testId} tone={t.department === 'lab' ? 'accent' : 'info'}>
                            {t.testName}
                          </Badge>
                        ))}
                        {p.tests.length > 3 && (
                          <span className={styles['muted']}>+{p.tests.length - 3}</span>
                        )}
                      </span>
                    ),
                  },
                  {
                    key: 'done',
                    header: 'Done',
                    numeric: true,
                    render: (p: Patient) => {
                      const done = p.tests.filter((t) => t.status === 'completed').length;
                      return (
                        <span className={done === p.tests.length ? styles['allDone'] : undefined}>
                          {done}/{p.tests.length}
                        </span>
                      );
                    },
                  },
                  {
                    key: 'registered',
                    header: 'Registered',
                    render: (p: Patient) => (
                      <span className={styles['nowrap']}>
                        {new Date(p.registeredAt).toLocaleDateString('en-NG')}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </CardBody>
        </Card>

        {selected && (
          <PatientDetail
            patient={selected}
            onClose={() => setSelected(null)}
            onEdit={() => setEditing(selected)}
          />
        )}
      </div>

      {editing && (
        <EditPatientDialog
          // Remounts on a different patient, so the form starts from that
          // patient's values rather than the previous one's.
          key={editing.id}
          patient={editing}
          organizationId={organization?.id || ''}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadPatients();
          }}
        />
      )}
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedPatientDatabasePage(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <PatientDatabasePage {...props} />
    </RequireRole>
  );
}
