'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  RiAddLine,
  RiCloseLine,
  RiDeleteBin6Line,
  RiEdit2Line,
  RiRefreshLine,
} from '@remixicon/react';

import { useAuth } from '@/components/AuthProvider';
import { useNotices } from '@/components/Notices';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  SegmentedControl,
  Select,
} from '@/components/ui';
import { diffOf } from '@/lib/audit';
import {
  Test,
  TEST_CATALOGUE,
  TestPrice,
  addCustomTest,
  deleteCustomTest,
  fetchCustomTests,
  fetchTestPrices,
  isInvestigationPackage,
  recordAudit,
  setCustomCatalogueCache,
  updateCustomTest,
  upsertTestPrices,
} from '@/lib/store';

import {
  CATEGORIES,
  CLINICAL_PRESETS,
  LAB_CATEGORIES,
  RAD_CATEGORIES,
  type Parameter,
} from './features/catalogue/presets';
import styles from './features/catalogue/testManager.module.css';

interface Props {
  organizationId: string;
  restrictDepartment?: 'lab' | 'radiology';
  onClose?: () => void;
  /**
   * Prices owned by a parent that also renders the price list, so the two
   * views of the same numbers never disagree. When omitted (a department
   * bench opening this to add one test) the component fetches its own copy,
   * as it always did.
   */
  prices?: TestPrice[];
  /** Called after a price write, so the parent can refetch and pass fresh rows back down. */
  onPricesChanged?: () => void;
  initialTab?: 'catalogue' | 'pending';
}

type Format = 'parameterized' | 'freetext';

const BLANK_PARAM: Parameter = { name: '', unit: '', range: '' };

export default function TestManager({
  organizationId,
  restrictDepartment,
  onClose,
  prices,
  onPricesChanged,
  initialTab,
}: Props) {
  const { ask } = useNotices();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const auditActor = {
    organization_id: organizationId,
    actor_id: profile?.id ?? null,
    actor_name: profile?.full_name ?? null,
  };

  const [catalogue, setCatalogue] = useState<Test[]>([]);
  const [pendingTests, setPendingTests] = useState<Test[]>([]);
  const [customTests, setCustomTests] = useState<Test[]>([]);
  const [ownPrices, setOwnPrices] = useState<TestPrice[]>([]);
  const testPrices = prices ?? ownPrices;

  const [activeTab, setActiveTab] = useState<'catalogue' | 'pending'>(initialTab ?? 'catalogue');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // A save that landed but could not be followed through — the test is in, the
  // admin was not told. Its own state because it is neither a failure nor the
  // clean success the old screen reported.
  const [warnMsg, setWarnMsg] = useState('');

  const [formName, setFormName] = useState('');
  const [formDept, setFormDept] = useState<'lab' | 'radiology'>('lab');
  const [formCategory, setFormCategory] = useState('Hematology');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formSpecimen, setFormSpecimen] = useState('');
  const [formParameters, setFormParameters] = useState<Parameter[]>([]);
  const [formFormat, setFormFormat] = useState<Format>('parameterized');
  const [formKind, setFormKind] = useState<'investigation' | 'package'>('investigation');
  const [formInvestigationIds, setFormInvestigationIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  const [formPrice, setFormPrice] = useState(0);
  const [formCommType, setFormCommType] = useState<'percentage' | 'flat' | 'none'>('percentage');
  const [formCommValue, setFormCommValue] = useState(0);

  const clearMessages = () => {
    setError('');
    setSuccessMsg('');
    setWarnMsg('');
  };

  const loadCatalogue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dbCustom] = await Promise.all([
        fetchCustomTests(organizationId),
        prices ? Promise.resolve() : fetchTestPrices(organizationId).then(setOwnPrices),
      ]);
      setCustomTests(dbCustom);
      setCustomCatalogueCache(dbCustom);

      // A custom row either overrides a built-in of the same id, replaces it,
      // or is a test of its own. Deactivated ones wait in Pending Pricing.
      const active: Test[] = [...TEST_CATALOGUE];
      const pending: Test[] = [];

      dbCustom.forEach((ct) => {
        const idx = active.findIndex((t) => t.id === ct.id);
        if (idx !== -1) {
          if (ct.is_active === false) {
            active.splice(idx, 1);
            pending.push(ct);
          } else {
            active[idx] = ct;
          }
        } else if (ct.is_active === false) {
          pending.push(ct);
        } else {
          active.push(ct);
        }
      });

      const byDept = (list: Test[]) =>
        restrictDepartment ? list.filter((t) => t.department === restrictDepartment) : list;

      setCatalogue(byDept(active));
      setPendingTests(byDept(pending));
    } catch (err: any) {
      setError('Could not load the catalogue: ' + (err?.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [organizationId, restrictDepartment]);

  useEffect(() => {
    loadCatalogue();
  }, [loadCatalogue]);

  const handleTabChange = (tab: 'catalogue' | 'pending') => {
    setActiveTab(tab);
    setSearchQuery('');
    setSelectedCategory('all');
    setEditingTest(null);
    setIsNew(false);
    clearMessages();
  };

  const handleSelectTest = useCallback(
    (test: Test) => {
      clearMessages();
      setEditingTest(test);
      setIsNew(false);

      setFormName(test.name);
      setFormKind(isInvestigationPackage(test) ? 'package' : 'investigation');
      setFormInvestigationIds(test.investigationIds || []);
      setMemberSearch('');
      setFormDept(test.department);

      if (CATEGORIES.includes(test.category)) {
        setFormCategory(test.category);
        setFormCustomCategory('');
      } else {
        setFormCategory('custom');
        setFormCustomCategory(test.category);
      }

      setFormSpecimen(test.specimen);
      setFormParameters(test.parameters || []);
      setFormFormat(
        test.department === 'radiology' || !test.parameters?.length ? 'freetext' : 'parameterized',
      );

      const priced = testPrices.find((p) => p.test_id === test.id);
      setFormPrice(priced?.price ?? 0);
      setFormCommType((priced?.commission_type as any) || 'percentage');
      setFormCommValue(priced?.commission_value ?? 0);
    },
    [testPrices],
  );

  const handleStartNew = () => {
    clearMessages();
    setEditingTest(null);
    setIsNew(true);

    const rad = restrictDepartment === 'radiology';
    setFormName('');
    setFormKind('investigation');
    setFormInvestigationIds([]);
    setFormDept(restrictDepartment || 'lab');
    setFormCategory(rad ? 'Ultrasound' : 'Hematology');
    setFormCustomCategory('');
    setFormSpecimen(rad ? 'Scan' : 'Whole Blood');
    setFormFormat(rad ? 'freetext' : 'parameterized');
    setFormParameters(rad ? [] : [{ ...BLANK_PARAM }]);

    setFormPrice(0);
    setFormCommType('percentage');
    setFormCommValue(0);
  };

  const handleStartPackage = () => {
    handleStartNew();
    setFormKind('package');
    setFormDept('lab');
    setFormCategory('Special Health Check Plans');
    setFormSpecimen('');
    setFormParameters([]);
    setFormFormat('parameterized');
  };

  const handleFormatChange = (format: Format) => {
    setFormFormat(format);
    if (format === 'freetext') setFormParameters([]);
    else if (formParameters.length === 0) setFormParameters([{ ...BLANK_PARAM }]);
  };

  const setParam = (index: number, field: 'name' | 'unit' | 'range', value: string) =>
    setFormParameters((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));

  const addSubParameter = (index: number) => setFormParameters((prev) => prev.map((parameter, i) =>
    i === index ? { ...parameter, children: [...(parameter.children || []), { ...BLANK_PARAM }] } : parameter,
  ));

  const setSubParameter = (parentIndex: number, childIndex: number, field: 'name' | 'unit' | 'range', value: string) =>
    setFormParameters((prev) => prev.map((parameter, i) => i === parentIndex ? {
      ...parameter,
      children: (parameter.children || []).map((child, j) => j === childIndex ? { ...child, [field]: value } : child),
    } : parameter));

  const isFreeText = formFormat === 'freetext' || formDept === 'radiology';

  /** A failed audit write does not undo a save that already landed — it is
   * folded into the same non-blocking warning the email notice uses. */
  const noteAuditFailure = (err: unknown) => {
    console.warn('Failed to record an audit entry:', err);
    setWarnMsg((prev) =>
      prev || 'The change was made, but its audit entry could not be recorded.',
    );
  };

  const auditPriceChange = async (
    testId: string,
    label: string,
    before: { price: number; commission_type: string; commission_value: number },
    after: { price: number; commission_type: string; commission_value: number },
  ) => {
    const diff = diffOf(before, after, ['price', 'commission_type', 'commission_value']);
    if (Object.keys(diff.after).length === 0) return;
    try {
      await recordAudit({
        ...auditActor,
        action: 'price.changed',
        entity_type: 'test_price',
        entity_id: testId,
        entity_label: label,
        ...diff,
      });
    } catch (err) {
      noteAuditFailure(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!formName.trim()) {
      setError('Test name is required.');
      return;
    }
    const finalCategory = formCategory === 'custom' ? formCustomCategory.trim() : formCategory;
    if (!finalCategory) {
      setError('Category is required.');
      return;
    }
    if (formKind === 'package' && formInvestigationIds.length === 0) {
      setError('Add at least one existing investigation to the package.');
      return;
    }
    if (formKind !== 'package' && !isFreeText && !formSpecimen.trim()) {
      setError('Specimen is required.');
      return;
    }
    if (formKind !== 'package' && !isFreeText && formParameters.some((p) =>
      !p.name.trim() || (p.children || []).some((child) => !child.name.trim()))) {
      setError('Every parameter needs a name.');
      return;
    }

    setSaving(true);
    try {
      const testId = isNew ? `${formKind === 'package' ? 'pkg' : 'custom'}_${crypto.randomUUID().substring(0, 8)}` : editingTest!.id;
      const packageMembers = catalogue.filter((test) => formInvestigationIds.includes(test.id));
      const packageSpecimen = Array.from(new Set(packageMembers.map((test) => test.specimen).filter(Boolean))).join(' / ');
      const testPayload = {
        id: testId,
        name: formName.trim(),
        department: formKind === 'package' ? 'lab' as const : formDept,
        category: formKind === 'package' ? 'Special Health Check Plans' : finalCategory as any,
        specimen: formKind === 'package' ? packageSpecimen : formDept === 'radiology' ? 'Scan' : formSpecimen.trim(),
        parameters: formKind === 'package' || isFreeText ? [] : formParameters,
        kind: formKind,
        investigationIds: formKind === 'package' ? formInvestigationIds : [],
      };

      if (isNew) {
        // A scientist's test goes in switched off. Only an admin can price it,
        // and an unpriced test on a bill is worse than a missing one.
        await addCustomTest({ ...testPayload, is_active: isAdmin }, organizationId);

        await upsertTestPrices(
          [
            {
              organization_id: organizationId,
              test_id: testId,
              test_name: formName.trim(),
              price: isAdmin ? formPrice : 0,
              commission_type: isAdmin ? formCommType : 'none',
              commission_value: isAdmin ? formCommValue : 0,
            },
          ],
          organizationId,
        );
        onPricesChanged?.();

        try {
          await recordAudit({
            ...auditActor,
            action: 'catalogue.test_added',
            entity_type: 'custom_test',
            entity_id: testId,
            entity_label: formName.trim(),
            after: { department: formDept, category: finalCategory },
          });
        } catch (err) {
          noteAuditFailure(err);
        }
        if (isAdmin) {
          await auditPriceChange(
            testId,
            formName.trim(),
            { price: 0, commission_type: 'none', commission_value: 0 },
            { price: formPrice, commission_type: formCommType, commission_value: formCommValue },
          );
        }

        if (isAdmin) {
          setSuccessMsg('Test added to the catalogue and priced.');
        } else {
          // The email either went or it did not, and the desk has to be told
          // which. This used to be swallowed into console.warn while the
          // screen said the administrator had been notified either way — so a
          // test could sit unpriced and unbillable with everyone believing it
          // was in hand.
          let notified = false;
          try {
            const res = await fetch('/api/custom-tests', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'notifyAdmin',
                test: testPayload,
                organizationId,
                addedBy: { name: profile?.full_name, role: profile?.role },
              }),
            });
            notified = res.ok;
          } catch {
            notified = false;
          }

          if (notified) {
            setSuccessMsg(
              'Test added. An administrator has been notified by email to set its price.',
            );
          } else {
            setWarnMsg(
              'Test added, but the administrator could not be notified by email. ' +
                'It will not appear when registering a patient until someone sets its price — ' +
                'please tell an administrator.',
            );
          }
        }
      } else {
        const before = editingTest!;
        await updateCustomTest(
          testId,
          { ...testPayload, is_active: isAdmin ? true : editingTest!.is_active },
          organizationId,
        );

        const testDiff = diffOf(
          { name: before.name, department: before.department, category: before.category, specimen: before.specimen },
          { name: testPayload.name, department: testPayload.department, category: testPayload.category, specimen: testPayload.specimen },
          ['name', 'department', 'category', 'specimen'],
        );
        if (Object.keys(testDiff.after).length > 0) {
          try {
            await recordAudit({
              ...auditActor,
              action: 'catalogue.test_updated',
              entity_type: 'custom_test',
              entity_id: testId,
              entity_label: formName.trim(),
              ...testDiff,
            });
          } catch (err) {
            noteAuditFailure(err);
          }
        }

        if (isAdmin) {
          const priorPrice = testPrices.find((p) => p.test_id === testId);
          await upsertTestPrices(
            [
              {
                organization_id: organizationId,
                test_id: testId,
                test_name: formName.trim(),
                price: formPrice,
                commission_type: formCommType,
                commission_value: formCommValue,
              },
            ],
            organizationId,
          );
          onPricesChanged?.();
          await auditPriceChange(
            testId,
            formName.trim(),
            {
              price: priorPrice?.price ?? 0,
              commission_type: priorPrice?.commission_type ?? 'none',
              commission_value: priorPrice?.commission_value ?? 0,
            },
            { price: formPrice, commission_type: formCommType, commission_value: formCommValue },
          );
          if (activeTab === 'pending') setActiveTab('catalogue');
          setSuccessMsg('Test details and price updated.');
        } else {
          setSuccessMsg('Test updated.');
        }
      }

      await loadCatalogue();
      const updated = await fetchCustomTests(organizationId);
      const matched = updated.find((t) => t.id === testId) || TEST_CATALOGUE.find((t) => t.id === testId);
      if (matched) handleSelectTest(matched);
    } catch (err: any) {
      setError(err?.message || 'Could not save that test.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTest) return;
    if (
      !(await ask(
        `Remove "${editingTest.name}" from the catalogue?\n\n` +
          'It stops appearing when registering a patient. Results already recorded ' +
          'against it keep working.',
      ))
    )
      return;

    setSaving(true);
    clearMessages();
    try {
      const retired = editingTest;
      await deleteCustomTest(retired.id, organizationId);
      setEditingTest(null);
      await loadCatalogue();
      setSuccessMsg('Test removed from the catalogue.');
      try {
        await recordAudit({
          ...auditActor,
          action: 'catalogue.test_retired',
          entity_type: 'custom_test',
          entity_id: retired.id,
          entity_label: retired.name,
          before: { is_active: true },
          after: { is_active: false },
        });
      } catch (err) {
        noteAuditFailure(err);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not remove that test.');
    } finally {
      setSaving(false);
    }
  };

  const currentList = activeTab === 'pending' ? pendingTests : catalogue;
  const activeCategories = Array.from(new Set(currentList.map((t) => t.category)));

  const filtered = currentList.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.specimen.toLowerCase().includes(q);
    return matchesSearch && (selectedCategory === 'all' || t.category === selectedCategory);
  });

  const deptCategories = formDept === 'radiology'
    ? RAD_CATEGORIES
    : LAB_CATEGORIES.filter((category) => category !== 'Special Health Check Plans');
  const eligibleMembers = catalogue.filter((test) => !isInvestigationPackage(test));
  const selectedMembers = formInvestigationIds
    .map((id) => eligibleMembers.find((test) => test.id === id))
    .filter((test): test is Test => Boolean(test));
  const visibleMembers = eligibleMembers.filter((test) => {
    const q = memberSearch.trim().toLowerCase();
    return !q || [test.name, test.department, test.category, test.specimen].join(' ').toLowerCase().includes(q);
  });

  return (
    <div className={styles['shell']}>
      <Card>
        <CardHeader
          title="Investigation catalogue"
          subtitle="What each test is called, what it is taken from, and what it reports."
          actions={
            <>
              <Button
                size="sm"
                aria-label="Reload the catalogue"
                icon={<RiRefreshLine size={15} />}
                onClick={loadCatalogue}
              />
              {onClose && (
                <Button
                  size="sm"
                  aria-label="Close the catalogue editor"
                  icon={<RiCloseLine size={16} />}
                  onClick={onClose}
                />
              )}
            </>
          }
        />
      </Card>

      <div className={styles['split']}>
        {/* ── Left: which test ─────────────────────────────────────────── */}
        <Card>
          <CardBody>
            <div className={styles['picker']}>
              {isAdmin && (
                <SegmentedControl
                  value={activeTab}
                  onValueChange={handleTabChange}
                  ariaLabel="Which tests to show"
                  options={[
                    { value: 'catalogue', label: 'In the catalogue' },
                    {
                      value: 'pending',
                      label: pendingTests.length
                        ? `Awaiting a price (${pendingTests.length})`
                        : 'Awaiting a price',
                    },
                  ]}
                />
              )}

              <Field label="Search investigations" labelHidden>
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, category or specimen…"
                />
              </Field>

              <div className={styles['categories']} role="group" aria-label="Filter by category">
                <Button
                  size="sm"
                  intent={selectedCategory === 'all' ? 'primary' : 'secondary'}
                  aria-pressed={selectedCategory === 'all'}
                  onClick={() => setSelectedCategory('all')}
                >
                  All
                </Button>
                {activeCategories.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    intent={selectedCategory === cat ? 'primary' : 'secondary'}
                    aria-pressed={selectedCategory === cat}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>

              <div className={styles['list']}>
                {loading ? (
                  <p className={styles['empty']}>Loading investigations…</p>
                ) : filtered.length === 0 ? (
                  <p className={styles['empty']}>
                    {searchQuery || selectedCategory !== 'all'
                      ? 'Nothing matches. Widen the search.'
                      : 'No investigations here yet.'}
                  </p>
                ) : (
                  filtered.map((t) => {
                    const chosen = editingTest?.id === t.id && !isNew;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        // Names the test and says what pressing it does. These
                        // were unlabelled cards announcing only their text.
                        aria-label={`Edit ${t.name}`}
                        aria-current={chosen || undefined}
                        onClick={() => handleSelectTest(t)}
                        className={[styles['item'], chosen ? styles['itemOn'] : '']
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <span>
                          <span className={styles['itemName']}>{t.name}</span>
                          <span className={styles['itemMeta']}>
                            {t.category} · {t.specimen}
                          </span>
                        </span>
                        <span className={styles['itemTail']}>
                          {customTests.some((ct) => ct.id === t.id) && (
                            <Badge tone="info">Customised</Badge>
                          )}
                          <RiEdit2Line size={13} aria-hidden="true" />
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <Button intent="secondary" icon={<RiAddLine size={15} />} onClick={handleStartNew}>
                Add custom investigation
              </Button>
              {!restrictDepartment && (
                <Button intent="secondary" icon={<RiAddLine size={15} />} onClick={handleStartPackage}>
                  Add special health check plan
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        {/* ── Right: the test itself ───────────────────────────────────── */}
        <Card>
          <CardBody>
            {!editingTest && !isNew ? (
              <div className={styles['empty']}>
                <p>Pick an investigation on the left to edit it, or add a new one.</p>
              </div>
            ) : (
              <form className={styles['form']} onSubmit={handleSave}>
                <CardHeader
                  title={isNew ? (formKind === 'package' ? 'New special health check plan' : 'New custom investigation') : `Editing ${editingTest?.name}`}
                />

                {error && (
                  <Alert tone="critical" live>
                    {error}
                  </Alert>
                )}
                {warnMsg && (
                  <Alert tone="warning" live>
                    {warnMsg}
                  </Alert>
                )}
                {successMsg && (
                  <Alert tone="success" live>
                    {successMsg}
                  </Alert>
                )}

                <div className={styles['pair']}>
                  <Field label="Investigation name" required>
                    <Input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Lipid Profile"
                    />
                  </Field>

                  {formKind === 'package' ? (
                    <Field label="Required specimens" hint="Calculated from the included investigations.">
                      <div className={styles['fixed']}>
                        {Array.from(new Set(catalogue.filter((test) => formInvestigationIds.includes(test.id)).map((test) => test.specimen))).join(' / ') || 'Add investigations below'}
                      </div>
                    </Field>
                  ) : formDept === 'radiology' ? (
                    <Field label="Specimen" hint="Scans do not have one.">
                      <div className={styles['fixed']}>Scan / exam</div>
                    </Field>
                  ) : (
                    <Field label="Specimen" required>
                      <Input
                        value={formSpecimen}
                        onChange={(e) => setFormSpecimen(e.target.value)}
                        placeholder="e.g. Serum, Whole Blood"
                      />
                    </Field>
                  )}
                </div>

                {formKind !== 'package' && <div className={styles['pair']}>
                  {restrictDepartment ? (
                    <Field label="Department">
                      <div className={styles['fixed']}>
                        {restrictDepartment === 'lab' ? 'Laboratory' : 'Radiology'}
                      </div>
                    </Field>
                  ) : (
                    <Field label="Department" required>
                      <Select
                        value={formDept}
                        onChange={(e) => {
                          const val = e.target.value as 'lab' | 'radiology';
                          setFormDept(val);
                          setFormCategory(val === 'radiology' ? 'Ultrasound' : 'Hematology');
                          setFormSpecimen(val === 'radiology' ? 'Scan' : 'Whole Blood');
                        }}
                      >
                        <option value="lab">Laboratory</option>
                        <option value="radiology">Radiology</option>
                      </Select>
                    </Field>
                  )}

                  <Field label="Category" required>
                    <Select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    >
                      {deptCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="custom">Something else…</option>
                    </Select>
                  </Field>
                </div>}

                {formKind !== 'package' && formCategory === 'custom' && (
                  <Field label="New category name" required>
                    <Input
                      value={formCustomCategory}
                      onChange={(e) => setFormCustomCategory(e.target.value)}
                      placeholder={formDept === 'radiology' ? 'e.g. MRI' : 'e.g. Immunology'}
                    />
                  </Field>
                )}

                {isAdmin && (
                  <div className={styles['money']}>
                    <Field label="Price" hint="">
                      <Input
                        type="number"
                        min={0}
                        numeric
                        prefix="₦"
                        placeholder="0"
                        value={formPrice || ''}
                        onChange={(e) => setFormPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </Field>
                    <Field label="Commission type">
                      <Select
                        value={formCommType}
                        onChange={(e) => {
                          const val = e.target.value as typeof formCommType;
                          setFormCommType(val);
                          if (val === 'none') setFormCommValue(0);
                        }}
                      >
                        <option value="percentage">Percentage of the price</option>
                        <option value="flat">Flat amount</option>
                        <option value="none">No commission</option>
                      </Select>
                    </Field>
                    <Field label="Commission value">
                      <Input
                        type="number"
                        min={0}
                        numeric
                        prefix={formCommType === 'flat' ? '₦' : '%'}
                        placeholder="0"
                        disabled={formCommType === 'none'}
                        value={formCommType === 'none' ? '' : formCommValue || ''}
                        onChange={(e) =>
                          setFormCommValue(Math.max(0, parseFloat(e.target.value) || 0))
                        }
                      />
                    </Field>
                  </div>
                )}

                {formKind !== 'package' && formDept === 'lab' && (
                  <Field label="How the result is reported" required>
                    <SegmentedControl
                      value={formFormat}
                      onValueChange={handleFormatChange}
                      ariaLabel="How the result is reported"
                      options={[
                        { value: 'parameterized', label: 'A grid of values' },
                        { value: 'freetext', label: 'Written narrative' },
                      ]}
                    />
                  </Field>
                )}

                {formKind === 'package' ? (
                  <div className={styles['packageEditor']}>
                    <Alert tone="info">
                      A plan contains existing investigations only. Each investigation keeps its own parameters, reporting format, specimen and department routing.
                    </Alert>
                    <section className={styles['packagePreview']} aria-label="Selected investigations preview">
                      <div className={styles['packagePreviewHead']}>
                        <div>
                          <strong>{formName.trim() || 'Plan preview'}</strong>
                          <small>{selectedMembers.length} investigation{selectedMembers.length === 1 ? '' : 's'} · {Array.from(new Set(selectedMembers.map((test) => test.specimen).filter(Boolean))).join(' / ') || 'No specimens yet'}</small>
                        </div>
                        <Badge tone="accent">Package</Badge>
                      </div>
                      {selectedMembers.length ? (
                        <ul className={styles['packagePreviewTests']}>
                          {selectedMembers.map((test) => (
                            <li key={test.id}>
                              <span><strong>{test.name}</strong><small>{test.department === 'lab' ? 'Laboratory' : 'Radiology'} · {test.specimen}</small></span>
                              <Button
                                size="sm"
                                intent="ghost"
                                icon={<RiCloseLine size={14} />}
                                aria-label={`Remove ${test.name} from package`}
                                onClick={() => setFormInvestigationIds((ids) => ids.filter((id) => id !== test.id))}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles['packagePreviewEmpty']}>Selected investigations will appear here exactly as the package will be presented.</p>
                      )}
                    </section>
                    <Field label="Find investigations to include" hint={`${formInvestigationIds.length} investigation${formInvestigationIds.length === 1 ? '' : 's'} included`}>
                      <Input
                        type="search"
                        value={memberSearch}
                        onChange={(event) => setMemberSearch(event.target.value)}
                        placeholder="Search by name, department or specimen…"
                      />
                    </Field>
                    <div className={styles['memberList']}>
                      {visibleMembers.map((test) => {
                        const included = formInvestigationIds.includes(test.id);
                        return (
                          <button
                            key={test.id}
                            type="button"
                            aria-pressed={included}
                            aria-label={`${included ? 'Remove' : 'Add'} ${test.name} ${included ? 'from' : 'to'} package`}
                            className={[styles['member'], included ? styles['memberOn'] : ''].filter(Boolean).join(' ')}
                            onClick={() => setFormInvestigationIds((ids) => included ? ids.filter((id) => id !== test.id) : [...ids, test.id])}
                          >
                            <span><strong>{test.name}</strong><small>{test.department === 'lab' ? 'Laboratory' : 'Radiology'} · {test.specimen}</small></span>
                            <span>{included ? 'Included' : 'Add'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : isFreeText ? (
                  <p className={styles['note']}>
                    {formDept === 'radiology'
                      ? 'Scans are reported as findings, an impression and any images. No numeric parameters or reference ranges are needed.'
                      : 'This test is reported as written findings and an impression, rather than a grid of values.'}
                  </p>
                ) : (
                  <>
                    <Field
                      label="Start from a standard panel"
                      hint="Replaces what is below, or adds to it."
                    >
                      <div className={styles['presets']}>
                        {CLINICAL_PRESETS.filter((preset) => preset.category !== 'Special Health Check Plans').map((preset) => (
                          <span key={preset.name} className={styles['preset']}>
                            <Button
                              size="sm"
                              intent="ghost"
                              aria-label={`Replace the parameters with ${preset.name}`}
                              onClick={() => {
                                setFormParameters(preset.parameters);
                                setFormSpecimen(preset.specimen);
                                if (CATEGORIES.includes(preset.category)) {
                                  setFormCategory(preset.category);
                                  setFormCustomCategory('');
                                } else {
                                  setFormCategory('custom');
                                  setFormCustomCategory(preset.category);
                                }
                              }}
                            >
                              {preset.name}
                            </Button>
                            <Button
                              size="sm"
                              intent="secondary"
                              aria-label={`Add the ${preset.name} parameters to the list`}
                              onClick={() =>
                                setFormParameters((prev) => {
                                  // One empty row is the starting state, not a
                                  // parameter someone typed.
                                  if (prev.length === 1 && !prev[0]?.name) return preset.parameters;
                                  const have = new Set(
                                    prev.map((p) => p.name.trim().toLowerCase()),
                                  );
                                  return [
                                    ...prev,
                                    ...preset.parameters.filter(
                                      (p) => !have.has(p.name.trim().toLowerCase()),
                                    ),
                                  ];
                                })
                              }
                            >
                              Add
                            </Button>
                          </span>
                        ))}
                      </div>
                    </Field>

                    <div>
                      <div className={styles['paramsHead']}>
                        <p className={styles['paramsTitle']}>Parameters and reference ranges</p>
                        <Button
                          size="sm"
                          intent="ghost"
                          icon={<RiAddLine size={13} />}
                          onClick={() => setFormParameters((prev) => [...prev, { ...BLANK_PARAM }])}
                        >
                          Add parameter
                        </Button>
                      </div>

                      <div className={styles['params']}>
                        {formParameters.map((p, idx) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <div key={idx} className={styles['paramGroup']}>
                            <div className={styles['param']}>
                            {/* Named by position. A test can carry twenty of
                              * these; unnamed they were all "edit text". */}
                            <Input
                              aria-label={`Parameter ${idx + 1} name`}
                              placeholder="Name (e.g. WBC)"
                              value={p.name}
                              onChange={(e) => setParam(idx, 'name', e.target.value)}
                            />
                            <Input
                              aria-label={`Parameter ${idx + 1} unit`}
                              placeholder="Unit"
                              value={p.unit}
                              onChange={(e) => setParam(idx, 'unit', e.target.value)}
                            />
                            <Input
                              aria-label={`Parameter ${idx + 1} reference range`}
                              placeholder="Range (e.g. 4.0-11.0)"
                              value={p.range}
                              onChange={(e) => setParam(idx, 'range', e.target.value)}
                            />
                            <Button
                              size="sm"
                              intent="secondary"
                              icon={<RiAddLine size={13} />}
                              onClick={() => addSubParameter(idx)}
                            >
                              Add sub-parameter
                            </Button>
                            {formParameters.length > 1 && (
                              <Button
                                size="sm"
                                intent="dangerQuiet"
                                aria-label={`Remove parameter ${idx + 1}${p.name ? `, ${p.name}` : ''}`}
                                icon={<RiDeleteBin6Line size={14} />}
                                onClick={() =>
                                  setFormParameters((prev) => prev.filter((_, i) => i !== idx))
                                }
                              />
                            )}
                            </div>
                            {(p.children || []).map((child, childIdx) => (
                              <div key={childIdx} className={styles['subParam']}>
                                <Input
                                  aria-label={`Sub-parameter ${childIdx + 1} name under parameter ${idx + 1}`}
                                  placeholder="Sub-parameter name"
                                  value={child.name}
                                  onChange={(event) => setSubParameter(idx, childIdx, 'name', event.target.value)}
                                />
                                <Input
                                  aria-label={`Sub-parameter ${childIdx + 1} unit under parameter ${idx + 1}`}
                                  placeholder="Unit"
                                  value={child.unit}
                                  onChange={(event) => setSubParameter(idx, childIdx, 'unit', event.target.value)}
                                />
                                <Input
                                  aria-label={`Sub-parameter ${childIdx + 1} reference range under parameter ${idx + 1}`}
                                  placeholder="Reference range"
                                  value={child.range}
                                  onChange={(event) => setSubParameter(idx, childIdx, 'range', event.target.value)}
                                />
                                <Button
                                  size="sm"
                                  intent="dangerQuiet"
                                  aria-label={`Remove sub-parameter ${childIdx + 1} under ${p.name || `parameter ${idx + 1}`}`}
                                  icon={<RiDeleteBin6Line size={14} />}
                                  onClick={() => setFormParameters((parameters) => parameters.map((parameter, i) => i === idx ? {
                                    ...parameter,
                                    children: (parameter.children || []).filter((_, j) => j !== childIdx),
                                  } : parameter))}
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className={styles['footer']}>
                  {!isNew && (
                    <Button
                      intent="dangerQuiet"
                      disabled={saving}
                      icon={<RiDeleteBin6Line size={14} />}
                      onClick={handleDelete}
                    >
                      Deactivate test
                    </Button>
                  )}
                  <div className={styles['footerEnd']}>
                    <Button
                      onClick={() => {
                        setEditingTest(null);
                        setIsNew(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" intent="primary" loading={saving}>
                      Save changes
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
