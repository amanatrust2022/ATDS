'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { CommissionEntry, fetchCommissionReport, markCommissionPaid } from '@/lib/store';
import {
  RiMoneyDollarCircleLine, RiDownloadLine, RiFilterLine,
  RiUserHeartLine, RiHospitalLine, RiCalendarLine, RiCheckLine,
  RiCloseLine, RiPrinterLine, RiArrowDownSLine, RiArrowRightSLine,
  RiTimeLine
} from '@remixicon/react';

export default function CommissionsPage() {
  const { organization } = useAuth();
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'doctor' | 'facility'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [search, setSearch] = useState('');
  const [reportTab, setReportTab] = useState<'details' | 'summary'>('details');

  // Interactive states
  const [expandedReferrers, setExpandedReferrers] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payingEntry, setPayingEntry] = useState<CommissionEntry | null>(null);
  const [payNotes, setPayNotes] = useState('');
  const [processingPay, setProcessingPay] = useState(false);

  const load = async () => {
    if (!organization?.id) return;
    setLoading(true);
    const data = await fetchCommissionReport(
      organization.id,
      dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
    );
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [organization?.id, dateFrom, dateTo]);

  const filtered = entries.filter(e => {
    const typeMatch = typeFilter === 'all' || e.referrerType === typeFilter;
    const statusMatch = statusFilter === 'all' || e.commissionStatus === statusFilter;
    const q = search.toLowerCase();
    const searchMatch = !q || e.patientName.toLowerCase().includes(q) || e.referrerName.toLowerCase().includes(q) || e.slipNumber.toLowerCase().includes(q);
    return typeMatch && statusMatch && searchMatch;
  });

  const totalBill = filtered.reduce((s, e) => s + e.totalAmount, 0);
  const totalCommission = filtered.reduce((s, e) => s + e.commissionAmount, 0);
  const uniqueReferrers = new Set(filtered.map(e => e.referrerName)).size;

  // Group by Referrer logic
  const referrerGroups = filtered.reduce((groups: Record<string, {
    name: string;
    type: 'doctor' | 'facility';
    patients: CommissionEntry[];
    totalBilled: number;
    commissionAmount: number;
    paid: number;
    outstanding: number;
  }>, entry) => {
    const key = entry.referrerName;
    if (!groups[key]) {
      groups[key] = {
        name: key,
        type: entry.referrerType,
        patients: [],
        totalBilled: 0,
        commissionAmount: 0,
        paid: 0,
        outstanding: 0
      };
    }
    groups[key].patients.push(entry);
    groups[key].totalBilled += entry.totalAmount;
    groups[key].commissionAmount += entry.commissionAmount;
    if (entry.commissionStatus === 'paid') {
      groups[key].paid += entry.commissionAmount;
    } else {
      groups[key].outstanding += entry.commissionAmount;
    }
    return groups;
  }, {});

  const referrerList = Object.values(referrerGroups);

  const toggleExpand = (name: string) => {
    setExpandedReferrers(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Bulk actions
  const toggleSelectAll = () => {
    const pendings = filtered.filter(e => e.commissionStatus === 'pending').map(e => e.patientId);
    if (selectedIds.length === pendings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendings);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkPay = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to mark ${selectedIds.length} commissions as Paid?`)) return;
    setProcessingPay(true);
    try {
      await Promise.all(selectedIds.map(id => markCommissionPaid(id, 'Bulk settlement')));
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      alert('Bulk settlement failed: ' + e.message);
    } finally {
      setProcessingPay(false);
    }
  };

  const handleSinglePay = async () => {
    if (!payingEntry) return;
    setProcessingPay(true);
    try {
      await markCommissionPaid(payingEntry.patientId, payNotes);
      setPayingEntry(null);
      setPayNotes('');
      await load();
    } catch (e: any) {
      alert('Payment failed: ' + e.message);
    } finally {
      setProcessingPay(false);
    }
  };

  // Print Statement Function
  const printStatement = (referrerName?: string) => {
    const win = window.open('', '_blank');
    if (!win) return;

    let targetEntries = filtered;
    let title = 'ALL REFERRAL COMMISSIONS STATEMENT';
    if (referrerName) {
      targetEntries = filtered.filter(e => e.referrerName === referrerName);
      title = `REFERRAL COMMISSION STATEMENT - ${referrerName.toUpperCase()}`;
    }

    const tBilled = targetEntries.reduce((s, e) => s + e.totalAmount, 0);
    const tComm = targetEntries.reduce((s, e) => s + e.commissionAmount, 0);
    const tPaid = targetEntries.filter(e => e.commissionStatus === 'paid').reduce((s, e) => s + e.commissionAmount, 0);
    const tOutstanding = targetEntries.filter(e => e.commissionStatus === 'pending').reduce((s, e) => s + e.commissionAmount, 0);

    const rows = targetEntries.map(e => `
      <tr>
        <td>${new Date(e.registeredAt).toLocaleDateString('en-NG')}</td>
        <td><b>${e.patientName}</b><br><small>${e.slipNumber}</small></td>
        <td>${e.tests.map(t => t.testName).join(', ')}</td>
        <td style="text-align:right">₦${e.totalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:center">${e.commissionType === 'percentage' ? `${e.commissionValue}%` : `₦${e.commissionValue}`}</td>
        <td style="text-align:right">₦${e.commissionAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:center"><span style="color:${e.commissionStatus === 'paid' ? '#0d9488' : '#d97706'}; font-weight:bold">${e.commissionStatus.toUpperCase()}</span></td>
      </tr>
    `).join('');

    win.document.write(`
      <!DOCTYPE html><html><head><title>Commission Statement</title>
      <style>
        body { font-family: sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 20px; }
        .org-name { font-size: 22px; font-weight: bold; color: #0d9488; }
        .title { font-size: 14px; font-weight: bold; text-decoration: underline; margin-top: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
        th { background: #0d9488; color: white; padding: 8px; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        .summary-box { display: flex; justify-content: flex-end; gap: 40px; margin-top: 20px; font-size: 13px; font-weight: bold; }
        .summary-box div { text-align: right; }
        @media print {
          body { padding: 0; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      </style></head><body>
      <div class="header">
        <div class="org-name">${organization?.name?.toUpperCase() || 'AMANA TRUST DIAGNOSTICS'}</div>
        <div class="title">${title}</div>
        <div style="font-size:10px; margin-top:5px; color:#666">Generated on ${new Date().toLocaleDateString('en-NG')}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Tests</th>
            <th style="text-align:right">Billed Amount</th>
            <th style="text-align:center">Comm. Rate</th>
            <th style="text-align:right">Commission Due</th>
            <th style="text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="summary-box">
        <div>
          <div style="color:#666">Total Billed:</div>
          <div style="color:#333; font-size:16px; margin-top:3px">₦${tBilled.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div style="color:#d97706">Outstanding Due:</div>
          <div style="color:#d97706; font-size:16px; margin-top:3px">₦${tOutstanding.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div style="color:#0d9488">Total Settled:</div>
          <div style="color:#0d9488; font-size:16px; margin-top:3px">₦${tPaid.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  const exportCsv = () => {
    const rows = [
      ['Slip No', 'Patient', 'Date', 'Referrer', 'Type', 'Tests', 'Total Bill (₦)', 'Commission Rate', 'Commission (₦)', 'Status', 'Paid At', 'Notes'],
      ...filtered.map(e => [
        e.slipNumber, e.patientName,
        new Date(e.registeredAt).toLocaleDateString('en-NG'),
        e.referrerName, e.referrerType,
        e.tests.map(t => t.testName).join('; '),
        e.totalAmount.toFixed(2),
        e.commissionType === 'percentage' ? `${e.commissionValue}%` : `₦${e.commissionValue}`,
        e.commissionAmount.toFixed(2),
        e.commissionStatus,
        e.commissionPaidAt ? new Date(e.commissionPaidAt).toLocaleDateString('en-NG') : '',
        e.commissionPaidNotes || ''
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `commissions-${dateFrom || 'all'}-to-${dateTo || 'now'}.csv`; a.click();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      {/* Page Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <RiMoneyDollarCircleLine size={22} color="var(--gold)" />
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Commission Report</h1>
            </div>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', margin: 0 }}>
              Track referral commissions owed to doctors and facilities (explicitly assigned per visit)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => printStatement()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', background: 'white', border: '1px solid var(--gray-300)', color: 'var(--gray-700)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', borderRadius: 0 }}>
              <RiPrinterLine size={16} /> Print Report Statement
            </button>
            <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', background: 'var(--teal-700)', color: 'white', border: 'none', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', borderRadius: 0 }}>
              <RiDownloadLine size={16} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: 1300, margin: '0 auto' }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Referrals Found', value: filtered.length, color: 'var(--teal-600)', prefix: '' },
            { label: 'Unique Referrers', value: uniqueReferrers, color: 'var(--teal-700)', prefix: '' },
            { label: 'Total Billed', value: totalBill, color: '#1a6aaf', prefix: '₦' },
            { label: 'Total Commission Due', value: totalCommission, color: 'var(--gold)', prefix: '₦' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid var(--gray-200)', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>
                {s.prefix}{typeof s.value === 'number' && s.prefix === '₦' ? s.value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : s.value}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--gray-500)', marginTop: '0.1rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs for details vs summary */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: '1rem', gap: '1rem' }}>
          <button
            onClick={() => setReportTab('details')}
            style={{
              padding: '0.6rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 700,
              color: reportTab === 'details' ? 'var(--teal-700)' : 'var(--gray-500)',
              borderBottom: reportTab === 'details' ? '2px solid var(--teal-600)' : '2px solid transparent'
            }}
          >
            Per-Patient Details
          </button>
          <button
            onClick={() => setReportTab('summary')}
            style={{
              padding: '0.6rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 700,
              color: reportTab === 'summary' ? 'var(--teal-700)' : 'var(--gray-500)',
              borderBottom: reportTab === 'summary' ? '2px solid var(--teal-600)' : '2px solid transparent'
            }}
          >
            By Referrer Summary
          </button>
        </div>

        {/* Filters */}
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', padding: '0.85rem 1.1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, referrer, slip…" style={inputStyle} />
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {(['all', 'doctor', 'facility'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--gray-300)', background: typeFilter === t ? 'var(--teal-700)' : 'white', color: typeFilter === t ? 'white' : 'var(--gray-600)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', borderRadius: 0 }}>
                {t === 'all' ? 'All' : t === 'doctor' ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiUserHeartLine size={14} /> Doctors</span> : <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiHospitalLine size={14} /> Facilities</span>}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {(['all', 'pending', 'paid'] as const).map(st => (
              <button key={st} onClick={() => setStatusFilter(st)} style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--gray-300)', background: statusFilter === st ? 'var(--teal-700)' : 'white', color: statusFilter === st ? 'white' : 'var(--gray-600)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', borderRadius: 0 }}>
                {st === 'all' ? 'All Status' : st === 'pending' ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiTimeLine size={14} /> Pending</span> : <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiCheckLine size={14} /> Settled / Paid</span>}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
            <RiCalendarLine size={14} color="var(--gray-400)" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateInputStyle} />
            <span style={{ color: 'var(--gray-400)', fontSize: '0.78rem' }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateInputStyle} />
          </div>
        </div>

        {/* Floating Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div style={{
            background: 'var(--teal-800)', color: 'white', padding: '0.75rem 1.25rem',
            marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderRadius: 0, animation: 'fadeIn 0.2s'
          }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{selectedIds.length} patients selected for commission settlement</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleBulkPay} disabled={processingPay} style={{ background: 'var(--gold)', color: 'var(--gray-900)', border: 'none', padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                {processingPay ? 'Settling...' : 'Mark Selected as Paid'}
              </button>
              <button onClick={() => setSelectedIds([])} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Details View */}
        {reportTab === 'details' && (
          <div style={{ background: 'white', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading commissions…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                <RiMoneyDollarCircleLine size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <div>No commission records found for the selected filters.</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)' }}>
                    <th style={{ padding: '0.75rem 0.9rem', width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === filtered.filter(e => e.commissionStatus === 'pending').length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    {['Date', 'Patient', 'Referrer', 'Tests', 'Total Bill', 'Comm. Rate', 'Comm. Due', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 0.9rem', textAlign: 'left', fontWeight: 700, fontSize: '0.7rem', color: 'var(--gray-500)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={e.patientId + i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td style={{ padding: '0.75rem 0.9rem', textAlign: 'center' }}>
                        {e.commissionStatus === 'pending' ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(e.patientId)}
                            onChange={() => toggleSelect(e.patientId)}
                          />
                        ) : (
                          <RiCheckLine size={16} color="var(--green)" style={{ margin: '0 auto' }} />
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 0.9rem', color: 'var(--gray-500)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {new Date(e.registeredAt).toLocaleDateString('en-NG')}
                      </td>
                      <td style={{ padding: '0.75rem 0.9rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{e.patientName}</div>
                        <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--teal-700)' }}>{e.slipNumber}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {e.referrerType === 'doctor'
                            ? <RiUserHeartLine size={14} color="var(--teal-600)" />
                            : <RiHospitalLine size={14} color="var(--gold)" />}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{e.referrerName}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)', textTransform: 'capitalize' }}>{e.referrerType}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.9rem' }}>
                        <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', maxWidth: 220 }}>
                          {e.tests.map(t => (
                            <span key={t.testId} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: 'var(--teal-50)', color: 'var(--teal-700)', border: '1px solid var(--teal-100)' }}>
                              {t.testName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.9rem', fontWeight: 700, color: '#1a6aaf' }}>
                        ₦{e.totalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 0.9rem' }}>
                        <span style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', padding: '0.2rem 0.5rem', fontWeight: 700, fontSize: '0.75rem' }}>
                          {e.commissionType === 'percentage' ? `${e.commissionValue}%` : `₦${e.commissionValue.toLocaleString()}`}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.9rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--gold)' }}>
                          ₦{e.commissionAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.9rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem', fontSize: '0.68rem', fontWeight: 700,
                          background: e.commissionStatus === 'paid' ? 'var(--green-light)' : 'var(--amber-light)',
                          color: e.commissionStatus === 'paid' ? 'var(--green)' : 'var(--amber)',
                        }}>
                          {e.commissionStatus === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.9rem' }}>
                        {e.commissionStatus === 'pending' ? (
                          <button
                            onClick={() => setPayingEntry(e)}
                            style={{ padding: '0.3rem 0.6rem', border: 'none', background: 'var(--teal-700)', color: 'white', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }} title={e.commissionPaidNotes || 'No notes'}>
                            {e.commissionPaidAt ? new Date(e.commissionPaidAt).toLocaleDateString('en-NG') : 'Paid'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Aggregated By Referrer Summary View */}
        {reportTab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {referrerList.length === 0 ? (
              <div style={{ background: 'white', padding: '3rem', border: '1px solid var(--gray-200)', textAlign: 'center', color: 'var(--gray-400)' }}>
                No grouped summaries match selection.
              </div>
            ) : (
              referrerList.map(ref => {
                const isExpanded = expandedReferrers[ref.name];
                return (
                  <div key={ref.name} style={{ background: 'white', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
                    <div
                      onClick={() => toggleExpand(ref.name)}
                      style={{
                        padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer', background: isExpanded ? 'var(--gray-50)' : 'white', borderBottom: isExpanded ? '1px solid var(--gray-200)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {isExpanded ? <RiArrowDownSLine size={18} /> : <RiArrowRightSLine size={18} />}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--gray-900)' }}>{ref.name}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)', textTransform: 'capitalize' }}>
                            {ref.type} · {ref.patients.length} Patient{ref.patients.length !== 1 ? 's' : ''} Sent
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '2rem', textAlign: 'right' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Billed</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a6aaf' }}>₦{ref.totalBilled.toLocaleString('en-NG')}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Total Comm.</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gold)' }}>₦{ref.commissionAmount.toLocaleString('en-NG')}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Settled</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--green)' }}>₦{ref.paid.toLocaleString('en-NG')}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Outstanding</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--red)' }}>₦{ref.outstanding.toLocaleString('en-NG')}</div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          printStatement(ref.name);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', background: 'white', border: '1px solid var(--gray-300)', color: 'var(--gray-700)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <RiPrinterLine size={13} /> Print Statement
                      </button>
                    </div>

                    {isExpanded && (
                      <div style={{ background: '#fcfdfd', padding: '0.5rem 1.25rem 1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginTop: '0.5rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--gray-200)', background: 'rgba(0,0,0,0.02)' }}>
                              <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--gray-500)' }}>Patient</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--gray-500)' }}>Date</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--gray-500)' }}>Tests</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--gray-500)' }}>Total Billed</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--gray-500)' }}>Commission</th>
                              <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--gray-500)' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ref.patients.map(pat => (
                              <tr key={pat.patientId} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{pat.patientName} <span style={{ fontSize: '10px', color: '#888' }}>({pat.slipNumber})</span></td>
                                <td style={{ padding: '0.5rem', color: '#666' }}>{new Date(pat.registeredAt).toLocaleDateString('en-NG')}</td>
                                <td style={{ padding: '0.5rem', color: '#555' }}>{pat.tests.map(t => t.testName).join(', ')}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>₦{pat.totalAmount.toLocaleString()}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--gold)' }}>₦{pat.commissionAmount.toLocaleString()}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                  <span style={{
                                    padding: '0.1rem 0.35rem', fontSize: '10px', fontWeight: 700,
                                    background: pat.commissionStatus === 'paid' ? 'var(--green-light)' : 'var(--amber-light)',
                                    color: pat.commissionStatus === 'paid' ? 'var(--green)' : 'var(--amber)',
                                  }}>
                                    {pat.commissionStatus.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Mark Paid Settlement Dialog Modal */}
      {payingEntry && (
        <div style={modalOverlayStyle}>
          <div style={modalBoxStyle}>
            <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: 'white', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Settle Referral Commission</h2>
              <button onClick={() => setPayingEntry(null)} style={closeBtnStyle}><RiCloseLine size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <p style={{ fontSize: '0.82rem', color: 'var(--gray-600)', margin: 0 }}>Patient Name:</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--gray-900)', margin: '0.1rem 0 0' }}>{payingEntry.patientName} ({payingEntry.slipNumber})</p>
              </div>
              <div>
                <p style={{ fontSize: '0.82rem', color: 'var(--gray-600)', margin: 0 }}>Referrer Name:</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--gray-900)', margin: '0.1rem 0 0' }}>{payingEntry.referrerName}</p>
              </div>
              <div style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-200)', padding: '0.75rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--teal-700)', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>Commission Owed</p>
                <p style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--teal-800)', margin: '0.2rem 0 0' }}>₦{payingEntry.commissionAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.3rem' }}>Payment Notes (Optional)</label>
                <input
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="e.g. Bank transfer ref, cash voucher#"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--gray-300)', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={handleSinglePay} disabled={processingPay} style={btnPrimaryStyle}>
                  {processingPay ? 'Processing...' : 'Mark as Paid'}
                </button>
                <button onClick={() => setPayingEntry(null)} style={btnOutlineStyle}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = { flex: '1 1 200px', padding: '0.45rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.8rem', fontFamily: 'var(--font-body)', outline: 'none' };
const dateInputStyle: React.CSSProperties = { padding: '0.4rem 0.6rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.78rem', fontFamily: 'var(--font-body)', outline: 'none', background: 'white', color: 'var(--gray-700)' };

// Modals styling
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' };
const modalBoxStyle: React.CSSProperties = { background: 'white', width: '100%', maxWidth: 420, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' };
const closeBtnStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const btnPrimaryStyle: React.CSSProperties = { flex: 1, padding: '0.55rem', background: 'var(--teal-700)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', textAlign: 'center', fontSize: '0.8rem' };
const btnOutlineStyle: React.CSSProperties = { flex: 1, padding: '0.55rem', background: 'white', border: '1px solid var(--gray-300)', color: 'var(--gray-700)', fontWeight: 600, cursor: 'pointer', textAlign: 'center', fontSize: '0.8rem' };
