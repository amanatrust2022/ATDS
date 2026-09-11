'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiRadarLine, RiSaveLine, RiTestTubeLine } from '@remixicon/react';

import { useAuth } from '@/components/AuthProvider';
import RequireRole from '@/components/RequireRole';
import { useShellSlot } from '@/components/shell';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  SkeletonRows,
  Table,
} from '@/components/ui';
import {
  TEST_CATALOGUE,
  Test,
  fetchCustomTests,
  fetchTestPrices,
  upsertTestPrices,
} from '@/lib/store';

import styles from './pricing.module.css';

type CommissionType = 'percentage' | 'flat' | 'none';

/**
 * What one test costs, and what a referrer earns on it.
 *
 * Prices and commission values are held as the raw text of their boxes, not as
 * numbers. Parsing on every keystroke meant an emptied box became a 0, which
 * then showed as "0" rather than blank and — worse — wrote a key the saved copy
 * had never had, so the screen believed there were unsaved changes for the rest
 * of the session. The numbers are parsed once, at the two places that need
 * them: the dirty check and the save.
 */
type Draft = {
  price: string;
  commissionType: CommissionType;
  commissionValue: string;
};

const BLANK: Draft = { price: '', commissionType: 'percentage', commissionValue: '' };

const num = (raw: string) => {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
};

/** The three fields as the database will hold them, whatever was typed. */
const settled = (d: Draft) => ({
  price: num(d.price),
  commissionType: d.commissionType,
  commissionValue: d.commissionType === 'none' ? 0 : num(d.commissionValue),
});

function TestPricingPage() {
  const { organization } = useAuth();

  const [catalogue, setCatalogue] = useState<Test[]>([]);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [saved, setSaved] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<'all' | 'lab' | 'radiology'>('all');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (!organization?.id) return;
    let live = true;
    Promise.all([fetchTestPrices(organization.id), fetchCustomTests(organization.id)]).then(
      ([priceRows, customTests]) => {
        if (!live) return;

        const rows: Record<string, Draft> = {};
        priceRows.forEach((p) => {
          rows[p.test_id] = {
            price: p.price ? String(p.price) : '',
            commissionType: (p.commission_type as CommissionType) || 'percentage',
            commissionValue: p.commission_value ? String(p.commission_value) : '',
          };
        });
        setDraft(rows);
        setSaved(rows);

        // A custom test overrides the built-in of the same id, and one turned
        // off disappears from the list entirely.
        const merged = [...TEST_CATALOGUE];
        customTests.forEach((ct) => {
          const idx = merged.findIndex((t) => t.id === ct.id);
          if (idx !== -1) {
            if (ct.is_active === false) merged.splice(idx, 1);
            else merged[idx] = ct;
          } else if (ct.is_active !== false) {
            merged.push(ct);
          }
        });
        setCatalogue(merged);
        setLoading(false);
      },
    );
    return () => {
      live = false;
    };
  }, [organization?.id]);

  const edit = (id: string, patch: Partial<Draft>) => {
    setSuccess('');
    setDraft((prev) => ({ ...prev, [id]: { ...(prev[id] ?? BLANK), ...patch } }));
  };

  const changed = useCallback(
    (id: string) => {
      const a = settled(draft[id] ?? BLANK);
      const b = settled(saved[id] ?? BLANK);
      return (
        a.price !== b.price ||
        a.commissionType !== b.commissionType ||
        a.commissionValue !== b.commissionValue
      );
    },
    [draft, saved],
  );

  // Only tests actually in the catalogue count. Comparing the two maps whole
  // let a key for a test that no longer exists hold the screen dirty forever.
  const isDirty = useMemo(() => catalogue.some((t) => changed(t.id)), [catalogue, changed]);

  const categories = useMemo(
    () => Array.from(new Set(catalogue.map((t) => t.category))),
    [catalogue],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogue.filter(
      (t) =>
        (!category || t.category === category) &&
        (dept === 'all' || t.department === dept) &&
        (!q || t.name.toLowerCase().includes(q)),
    );
  }, [catalogue, category, dept, search]);

  const handleSave = useCallback(async () => {
    if (!organization?.id) return;
    setSaving(true);
    setError('');
    try {
      // The whole catalogue, not the filtered view. The filters hide rows; the
      // write must not, or narrowing to radiology before saving would wipe
      // every price in the lab.
      const rows = catalogue.map((t) => {
        const s = settled(draft[t.id] ?? BLANK);
        return {
          organization_id: organization.id,
          test_id: t.id,
          test_name: t.name,
          price: s.price,
          commission_type: s.commissionType,
          commission_value: s.commissionValue,
        };
      });
      await upsertTestPrices(rows, organization.id);
      setSaved(draft);
      setSuccess(`Saved ${rows.length} prices.`);
    } catch (e: any) {
      setError(e?.message || 'Could not save the price list.');
    } finally {
      setSaving(false);
    }
  }, [catalogue, draft, organization?.id]);

  useShellSlot(
    {
      subtitle: 'What each test costs, and what a referrer earns on it.',
      actions: (
        <div className={styles['unsaved']}>
          {isDirty && <span className={styles['unsavedNote']}>Unsaved changes</span>}
          <Button
            intent="primary"
            icon={<RiSaveLine size={15} />}
            loading={saving}
            disabled={!isDirty}
            onClick={handleSave}
          >
            {isDirty ? 'Save price list' : 'All saved'}
          </Button>
        </div>
      ),
    },
    [isDirty, saving, handleSave],
  );

  // A price list is dozens of small edits and one write. Closing the tab
  // halfway through lost the lot, silently.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const priced = catalogue.filter((t) => settled(draft[t.id] ?? BLANK).price > 0);
  const earning = catalogue.filter((t) => settled(draft[t.id] ?? BLANK).commissionValue > 0);
  const total = priced.reduce((sum, t) => sum + settled(draft[t.id] ?? BLANK).price, 0);

  const stats = [
    { label: 'Tests', value: String(catalogue.length) },
    { label: 'Priced', value: `${priced.length} of ${catalogue.length}` },
    { label: 'Earn commission', value: String(earning.length) },
    { label: 'List total', value: `₦${total.toLocaleString()}` },
  ];

  const columns = [
    {
      key: 'name',
      header: 'Test',
      render: (t: Test) => <span className={styles['name']}>{t.name}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      render: (t: Test) => (
        <span className={styles['dept']}>
          {t.department === 'lab' ? (
            <RiTestTubeLine size={13} aria-hidden="true" />
          ) : (
            <RiRadarLine size={13} aria-hidden="true" />
          )}
          {t.department === 'lab' ? 'Lab' : 'Radiology'}
        </span>
      ),
    },
    {
      key: 'specimen',
      header: 'Specimen',
      render: (t: Test) => <span className={styles['muted']}>{t.specimen || '—'}</span>,
    },
    {
      key: 'price',
      header: 'Price',
      numeric: true,
      render: (t: Test) => (
        <Input
          // Named after its own row. Three identical boxes a row and a dozen
          // rows on screen: without this every one of them was "edit text",
          // and nothing but counting told you which test you were pricing.
          aria-label={`Price for ${t.name}`}
          className={[styles['priceCell'], changed(t.id) ? styles['changed'] : '']
            .filter(Boolean)
            .join(' ')}
          type="number"
          min={0}
          step={100}
          numeric
          prefix="₦"
          placeholder="0"
          value={(draft[t.id] ?? BLANK).price}
          onChange={(e) => edit(t.id, { price: e.target.value })}
        />
      ),
    },
    {
      key: 'commissionType',
      header: 'Commission',
      render: (t: Test) => (
        <Select
          aria-label={`Commission type for ${t.name}`}
          className={styles['typeCell']}
          value={(draft[t.id] ?? BLANK).commissionType}
          onChange={(e) => edit(t.id, { commissionType: e.target.value as CommissionType })}
        >
          <option value="percentage">Percentage of the price</option>
          <option value="flat">Flat amount</option>
          <option value="none">No commission</option>
        </Select>
      ),
    },
    {
      key: 'commissionValue',
      header: 'Rate',
      numeric: true,
      render: (t: Test) => {
        const row = draft[t.id] ?? BLANK;
        const none = row.commissionType === 'none';
        return (
          <Input
            aria-label={`Commission value for ${t.name}`}
            className={[styles['priceCell'], changed(t.id) ? styles['changed'] : '']
              .filter(Boolean)
              .join(' ')}
            type="number"
            min={0}
            step={row.commissionType === 'flat' ? 100 : 1}
            numeric
            prefix={row.commissionType === 'flat' ? '₦' : '%'}
            placeholder="0"
            disabled={none}
            value={none ? '' : row.commissionValue}
            onChange={(e) => edit(t.id, { commissionValue: e.target.value })}
          />
        );
      },
    },
  ];

  return (
    <div className={styles['screen']}>
      {error && (
        <Alert tone="critical" live>
          {error}
        </Alert>
      )}
      {success && !isDirty && (
        <Alert tone="success" live>
          {success}
        </Alert>
      )}

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
                placeholder="Search tests…"
              />
            </Field>
            <Field label="Department">
              <Select value={dept} onChange={(e) => setDept(e.target.value as typeof dept)}>
                <option value="all">All departments</option>
                <option value="lab">Lab</option>
                <option value="radiology">Radiology</option>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <span className={styles['count']}>
              {filtered.length} of {catalogue.length} shown
            </span>
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <Card>
          <CardBody>
            <div className={styles['loading']}>
              <SkeletonRows rows={8} columns={[3, 1, 1, 1, 1, 1]} />
            </div>
          </CardBody>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title="No tests match those filters">
              Widen the search, or clear the department and category.
            </EmptyState>
          </CardBody>
        </Card>
      ) : (
        // Grouped by category, because that is how the desk reads a price list
        // — all of haematology at once, not alphabetically across the whole lab.
        categories
          .filter((c) => filtered.some((t) => t.category === c))
          .map((c) => (
            <Card key={c}>
              <CardHeader title={c} />
              <CardBody flush>
                <Table
                  caption={`${c} prices`}
                  rows={filtered.filter((t) => t.category === c)}
                  rowKey={(t: Test) => t.id}
                  columns={columns}
                />
              </CardBody>
            </Card>
          ))
      )}
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedTestPricingPage(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <TestPricingPage {...props} />
    </RequireRole>
  );
}
