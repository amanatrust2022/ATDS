'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { TEST_CATALOGUE, TestPrice, fetchTestPrices, upsertTestPrices } from '@/lib/store';
import {
  RiPriceTag3Line, RiSaveLine, RiCheckLine, RiErrorWarningLine,
  RiTestTubeLine, RiRadarLine,
} from '@remixicon/react';

const CATEGORIES = Array.from(new Set(TEST_CATALOGUE.map(t => t.category)));

export default function TestPricingPage() {
  const { organization } = useAuth();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterDept, setFilterDept] = useState<'all' | 'lab' | 'radiology'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!organization?.id) return;
    fetchTestPrices(organization.id).then(data => {
      const map: Record<string, number> = {};
      data.forEach(p => { map[p.test_id] = p.price; });
      setPrices(map);
      setSaved(map);
      setLoading(false);
    });
  }, [organization?.id]);

  const setPrice = (testId: string, val: string) => {
    const num = parseFloat(val);
    setPrices(prev => ({ ...prev, [testId]: isNaN(num) ? 0 : num }));
  };

  const isDirty = JSON.stringify(prices) !== JSON.stringify(saved);

  const totalRevenue = TEST_CATALOGUE.reduce((sum, t) => sum + (prices[t.id] || 0), 0);

  const handleSave = async () => {
    if (!organization?.id) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const rows = TEST_CATALOGUE.map(t => ({
        organization_id: organization.id,
        test_id: t.id,
        test_name: t.name,
        price: prices[t.id] || 0,
      }));
      await upsertTestPrices(rows, organization.id);
      setSaved({ ...prices });
      setSuccessMsg(`${rows.length} test prices saved successfully.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredTests = TEST_CATALOGUE.filter(t => {
    const catMatch = !filterCat || t.category === filterCat;
    const deptMatch = filterDept === 'all' || t.department === filterDept;
    const q = search.toLowerCase();
    const searchMatch = !q || t.name.toLowerCase().includes(q);
    return catMatch && deptMatch && searchMatch;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <RiPriceTag3Line size={22} color="var(--teal-600)" />
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Test Price List</h1>
            </div>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', margin: 0 }}>
              Set prices for all {TEST_CATALOGUE.length} tests. Prices are used for commission calculations.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {successMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--green)', fontSize: '0.82rem', fontWeight: 600 }}>
                <RiCheckLine size={16} /> {successMsg}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.2rem', background: isDirty ? 'var(--teal-700)' : 'var(--gray-300)',
                color: 'white', border: 'none', fontSize: '0.82rem', fontWeight: 700,
                cursor: saving || !isDirty ? 'not-allowed' : 'pointer', borderRadius: 0,
                transition: 'background 0.2s',
              }}
            >
              <RiSaveLine size={16} /> {saving ? 'Saving…' : isDirty ? 'Save All Prices' : 'All Saved'}
            </button>
          </div>
        </div>
        {errorMsg && (
          <div style={{ marginTop: '0.75rem', background: 'var(--red-light)', color: 'var(--red)', padding: '0.6rem 1rem', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <RiErrorWarningLine size={15} /> {errorMsg}
          </div>
        )}
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: 1300, margin: '0 auto' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Tests', value: TEST_CATALOGUE.length, color: 'var(--teal-600)', fmt: (v: number) => v },
            { label: 'Tests with Prices', value: Object.values(prices).filter(v => v > 0).length, color: 'var(--green)', fmt: (v: number) => v },
            { label: 'Unprice Tests', value: TEST_CATALOGUE.length - Object.values(prices).filter(v => v > 0).length, color: 'var(--amber)', fmt: (v: number) => v },
            { label: 'Total Price List', value: totalRevenue, color: 'var(--gold)', fmt: (v: number) => `₦${v.toLocaleString()}` },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid var(--gray-200)', padding: '0.9rem 1.1rem' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{(s.fmt as any)(s.value)}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--gray-500)', marginTop: '0.1rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', padding: '0.85rem 1.1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search tests…"
            style={{ flex: '1 1 180px', padding: '0.45rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.8rem', fontFamily: 'var(--font-body)', outline: 'none' }}
          />
          <select value={filterDept} onChange={e => setFilterDept(e.target.value as any)} style={selectStyle}>
            <option value="all">All Departments</option>
            <option value="lab">Lab</option>
            <option value="radiology">Radiology</option>
          </select>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={selectStyle}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(search || filterCat || filterDept !== 'all') && (
            <button onClick={() => { setSearch(''); setFilterCat(''); setFilterDept('all'); }} style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--gray-300)', background: 'white', fontSize: '0.75rem', cursor: 'pointer', borderRadius: 0, color: 'var(--gray-600)' }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: 'auto' }}>{filteredTests.length} tests shown</span>
        </div>

        {/* Price grid by category */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading prices…</div>
        ) : (
          CATEGORIES.filter(cat => !filterCat || cat === filterCat).map(cat => {
            const testsInCat = filteredTests.filter(t => t.category === cat);
            if (testsInCat.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--teal-800)', color: 'white', padding: '0.6rem 1rem', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 0 }}>
                  {cat}
                </div>
                <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderTop: 'none' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                        <th style={thStyle}>Test Name</th>
                        <th style={thStyle}>Department</th>
                        <th style={thStyle}>Specimen</th>
                        <th style={{ ...thStyle, width: 180 }}>Price (₦)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testsInCat.map((t, idx) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--gray-100)', background: idx % 2 === 0 ? 'white' : 'var(--gray-50)' }}>
                          <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: 'var(--gray-900)' }}>{t.name}</td>
                          <td style={{ padding: '0.65rem 1rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: t.department === 'lab' ? 'var(--teal-700)' : '#7c3aed' }}>
                              {t.department === 'lab' ? <RiTestTubeLine size={13} /> : <RiRadarLine size={13} />}
                              {t.department === 'lab' ? 'Lab' : 'Radiology'}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 1rem', color: 'var(--gray-500)', fontSize: '0.78rem' }}>{t.specimen}</td>
                          <td style={{ padding: '0.5rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem', fontWeight: 600 }}>₦</span>
                              <input
                                type="number"
                                min={0}
                                step={100}
                                value={prices[t.id] ?? ''}
                                onChange={e => setPrice(t.id, e.target.value)}
                                placeholder="0"
                                style={{
                                  flex: 1, padding: '0.4rem 0.6rem', border: '1px solid var(--gray-300)',
                                  borderRadius: 0, fontSize: '0.85rem', fontFamily: 'var(--font-body)',
                                  outline: 'none', textAlign: 'right', fontWeight: 700,
                                  background: (prices[t.id] || 0) !== (saved[t.id] || 0) ? 'rgba(68,114,196,0.06)' : 'white',
                                  borderColor: (prices[t.id] || 0) !== (saved[t.id] || 0) ? 'var(--teal-400)' : 'var(--gray-300)',
                                  color: 'var(--gray-900)',
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}

        {/* Floating save bar when dirty */}
        {isDirty && (
          <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: 'var(--teal-800)', color: 'white', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', animation: 'fadeIn 0.2s ease', zIndex: 50 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>You have unsaved price changes</span>
            <button onClick={handleSave} disabled={saving} style={{ background: 'white', color: 'var(--teal-800)', border: 'none', padding: '0.4rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <RiSaveLine size={14} /> {saving ? 'Saving…' : 'Save Now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.7rem', color: 'var(--gray-500)', textTransform: 'uppercase' };
const selectStyle: React.CSSProperties = { padding: '0.45rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.8rem', fontFamily: 'var(--font-body)', outline: 'none', background: 'white', color: 'var(--gray-700)' };
