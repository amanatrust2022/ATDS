'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AmanaLogo from '@/components/AmanaLogo';

interface PatientRecord {
  id: string;
  slip_number: string;
  first_name: string;
  surname: string;
  middle_name: string;
  registered_at: string;
  age: string;
  sex: string;
  phone: string;
  email: string;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  payment_status: string;
  test_count: number;
  completed_count: number;
}

interface TestRecord {
  id: string;
  patient_id: string;
  test_name: string;
  department: string;
  status: string;
  completed_at: string | null;
  price: number;
  results?: any[];
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: 'Ready', color: '#1e7e5a', bg: '#d5f0e8' },
    processing: { label: 'Processing', color: '#d4850a', bg: '#fef3cd' },
    pending: { label: 'Pending', color: '#4472c4', bg: '#dce5fa' },
  };
  const s = map[status] || { label: status, color: '#4c5266', bg: '#eff0f5' };
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      padding: '2px 10px',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.6px',
      fontFamily: '"IBM Plex Sans", sans-serif',
      display: 'inline-block',
    }}>
      {s.label}
    </span>
  );
}

export default function PortalDashboard() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [tests, setTests] = useState<Record<string, TestRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    const token = localStorage.getItem('portal_token');
    const storedEmail = localStorage.getItem('portal_email');

    if (!token || !storedEmail) {
      router.replace('/portal/login');
      return;
    }

    setEmail(storedEmail);

    try {
      const res = await fetch('/api/portal/history', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('portal_token');
        localStorage.removeItem('portal_email');
        router.replace('/portal/login');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load history');

      setPatients(data.patients || []);
      setTests(data.tests || {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function handleLogout() {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_email');
    router.push('/portal/login');
  }

  function getPatientName(p: PatientRecord) {
    return [p.first_name, p.middle_name, p.surname].filter(Boolean).join(' ') || 'Patient';
  }

  function getVisitStatus(patientId: string): 'all_ready' | 'partial' | 'pending' {
    const t = tests[patientId] || [];
    if (t.length === 0) return 'pending';
    if (t.every(x => x.status === 'completed')) return 'all_ready';
    if (t.some(x => x.status === 'completed')) return 'partial';
    return 'pending';
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading your medical history…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>⚠ {error}</p>
        <button onClick={fetchHistory} style={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  const firstName = patients[0] ? patients[0].first_name || patients[0].surname : email.split('@')[0];

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerBrand}>
            <AmanaLogo size={32} inverted={true} />
            <div>
              <span style={styles.headerOrgName}>Amana Trust Diagnostics</span>
              <span style={styles.headerPortalLabel}>Patient Portal</span>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>Sign Out</button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Welcome Banner */}
        <div style={styles.welcomeBanner}>
          <div>
            <h1 style={styles.welcomeHeading}>Welcome back, {firstName}</h1>
            <p style={styles.welcomeSub}>
              {patients.length === 0
                ? 'No visits found for this email address.'
                : `You have ${patients.length} visit${patients.length !== 1 ? 's' : ''} on record.`}
            </p>
          </div>
          <div style={styles.emailBadge}>{email}</div>
        </div>

        {/* Visits */}
        {patients.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📋</div>
            <h2 style={styles.emptyTitle}>No Records Found</h2>
            <p style={styles.emptyText}>
              We couldn't find any visits linked to <strong>{email}</strong>. If you believe this is an error,
              please contact us at the clinic.
            </p>
          </div>
        ) : (
          <div style={styles.visitsList}>
            <h2 style={styles.sectionTitle}>Visit History</h2>
            {patients.map(patient => {
              const visitTests = tests[patient.id] || [];
              const visitStatus = getVisitStatus(patient.id);
              const isExpanded = expandedVisit === patient.id;
              const completedTests = visitTests.filter(t => t.status === 'completed');
              const balance = (patient.net_amount || 0) - (patient.paid_amount || 0);

              return (
                <div key={patient.id} style={styles.visitCard}>
                  {/* Visit Header */}
                  <div
                    style={styles.visitHeader}
                    onClick={() => setExpandedVisit(isExpanded ? null : patient.id)}
                  >
                    <div style={styles.visitHeaderLeft}>
                      <div style={styles.visitDate}>
                        {new Date(patient.registered_at).toLocaleDateString('en-NG', {
                          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </div>
                      <div style={styles.visitMeta}>
                        <span style={styles.slipNum}>#{patient.slip_number}</span>
                        {visitStatus === 'all_ready' && (
                          <span style={styles.visitStatusBadge}>
                            ✓ All Results Ready
                          </span>
                        )}
                        {visitStatus === 'partial' && (
                          <span style={{ ...styles.visitStatusBadge, background: '#fef3cd', color: '#d4850a' }}>
                            ◑ Partial Results
                          </span>
                        )}
                        {visitStatus === 'pending' && (
                          <span style={{ ...styles.visitStatusBadge, background: '#dce5fa', color: '#4472c4' }}>
                            ○ Processing
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={styles.visitHeaderRight}>
                      <span style={styles.chevron}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded Body */}
                  {isExpanded && (
                    <div style={styles.visitBody}>
                      {/* Tests */}
                      <div style={styles.testsSection}>
                        <h3 style={styles.testsTitle}>Tests Ordered ({visitTests.length})</h3>
                        <div style={styles.testsList}>
                          {visitTests.map(t => (
                            <div key={t.id} style={styles.testRow}>
                              <div style={styles.testInfo}>
                                <span style={styles.testName}>{t.test_name}</span>
                                <span style={styles.testDept}>{t.department}</span>
                              </div>
                              <div style={styles.testRight}>
                                {statusBadge(t.status)}
                                {t.status === 'completed' && t.completed_at && (
                                  <span style={styles.completedAt}>
                                    {new Date(t.completed_at).toLocaleDateString('en-NG')}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {completedTests.length > 0 && (
                        <div style={styles.actionRow}>
                          <button
                            style={styles.viewResultsBtn}
                            onClick={() => router.push(`/portal/results/${patient.id}`)}
                          >
                            📄 View Results ({completedTests.length}/{visitTests.length})
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Amana Trust Diagnostics. All rights reserved.</p>
        <p>For queries, contact: <a href="mailto:amanatrust2022@gmail.com" style={styles.footerLink}>amanatrust2022@gmail.com</a></p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a1628',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: '3px solid #0563c1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#85a9eb',
    fontFamily: '"IBM Plex Sans", sans-serif',
    fontSize: '14px',
  },
  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a1628',
    gap: '16px',
  },
  errorText: {
    color: '#f5b7b1',
    fontFamily: '"IBM Plex Sans", sans-serif',
    fontSize: '15px',
  },
  retryBtn: {
    background: '#0563c1',
    color: '#fff',
    border: 'none',
    padding: '10px 24px',
    cursor: 'pointer',
    fontFamily: '"IBM Plex Sans", sans-serif',
    fontSize: '14px',
  },
  page: {
    minHeight: '100vh',
    background: '#f4f6fb',
    fontFamily: '"IBM Plex Sans", sans-serif',
  },
  header: {
    background: '#111d3b',
    borderBottom: '2px solid #0563c1',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  headerOrgName: {
    color: '#ffffff',
    fontFamily: '"Times New Roman", Times, serif',
    fontWeight: '700',
    fontSize: '15px',
    display: 'block',
    lineHeight: '1.2',
  },
  headerPortalLabel: {
    color: '#85a9eb',
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.2px',
    display: 'block',
    fontWeight: '500',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#b0bcd4',
    padding: '7px 16px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: '"IBM Plex Sans", sans-serif',
    transition: 'border-color 0.2s',
  },
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '32px 24px 64px',
  },
  welcomeBanner: {
    background: 'linear-gradient(135deg, #111d3b 0%, #0563c1 100%)',
    padding: '32px 28px',
    marginBottom: '32px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '16px',
    boxShadow: '0 4px 20px rgba(5, 99, 193, 0.3)',
  },
  welcomeHeading: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '700',
    fontFamily: '"Times New Roman", Times, serif',
    margin: '0 0 6px',
  },
  welcomeSub: {
    color: '#bed1f6',
    fontSize: '14px',
    margin: '0',
  },
  emailBadge: {
    background: 'rgba(255,255,255,0.12)',
    color: '#ffffff',
    padding: '6px 14px',
    fontSize: '13px',
    fontFamily: '"IBM Plex Mono", monospace',
    border: '1px solid rgba(255,255,255,0.2)',
    alignSelf: 'center',
  },
  sectionTitle: {
    color: '#20232b',
    fontSize: '17px',
    fontWeight: '700',
    margin: '0 0 16px',
    fontFamily: '"Times New Roman", Times, serif',
    borderBottom: '2px solid #0563c1',
    paddingBottom: '8px',
  },
  visitsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  visitCard: {
    background: '#ffffff',
    border: '1px solid #e0e4ef',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  visitHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    transition: 'background 0.15s',
    background: '#ffffff',
  },
  visitHeaderLeft: {
    flex: 1,
  },
  visitDate: {
    color: '#111d3b',
    fontWeight: '700',
    fontSize: '15px',
    fontFamily: '"Times New Roman", Times, serif',
    marginBottom: '4px',
  },
  visitMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },
  slipNum: {
    color: '#7f8599',
    fontSize: '12px',
    fontFamily: '"IBM Plex Mono", monospace',
  },
  visitStatusBadge: {
    background: '#d5f0e8',
    color: '#1e7e5a',
    padding: '2px 10px',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  visitHeaderRight: {
    display: 'flex',
    alignItems: 'center',
  },
  chevron: {
    color: '#7f8599',
    fontSize: '10px',
  },
  visitBody: {
    borderTop: '1px solid #e0e4ef',
    padding: '20px',
    background: '#fafbfe',
  },
  billingRow: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap' as const,
    marginBottom: '20px',
    padding: '16px',
    background: '#f0f4ff',
    border: '1px solid #dce5fa',
  },
  billingItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  billingLabel: {
    color: '#7f8599',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    fontWeight: '600',
  },
  billingValue: {
    color: '#20232b',
    fontSize: '16px',
    fontWeight: '600',
    fontFamily: '"IBM Plex Mono", monospace',
  },
  testsSection: {},
  testsTitle: {
    color: '#4c5266',
    fontSize: '13px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    margin: '0 0 10px',
  },
  testsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  testRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: '#ffffff',
    border: '1px solid #e8ebf3',
  },
  testInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  testName: {
    color: '#20232b',
    fontWeight: '600',
    fontSize: '14px',
  },
  testDept: {
    color: '#7f8599',
    fontSize: '11px',
    textTransform: 'capitalize' as const,
  },
  testRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '3px',
  },
  completedAt: {
    color: '#7f8599',
    fontSize: '11px',
    fontFamily: '"IBM Plex Mono", monospace',
  },
  actionRow: {
    marginTop: '16px',
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  viewResultsBtn: {
    background: '#0563c1',
    color: '#ffffff',
    border: 'none',
    padding: '11px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"IBM Plex Sans", sans-serif',
    letterSpacing: '0.2px',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '80px 24px',
    background: '#ffffff',
    border: '1px solid #e0e4ef',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyTitle: {
    color: '#20232b',
    fontFamily: '"Times New Roman", Times, serif',
    fontSize: '22px',
    fontWeight: '700',
    margin: '0 0 12px',
  },
  emptyText: {
    color: '#4c5266',
    fontSize: '15px',
    lineHeight: '1.6',
    maxWidth: '440px',
    margin: '0 auto',
  },
  footer: {
    background: '#111d3b',
    color: '#6b7fa0',
    textAlign: 'center' as const,
    padding: '20px 24px',
    fontSize: '12px',
    fontFamily: '"IBM Plex Sans", sans-serif',
    lineHeight: '1.8',
  },
  footerLink: {
    color: '#85a9eb',
    textDecoration: 'underline',
  },
};
