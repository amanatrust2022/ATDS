'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AmanaLogo from '@/components/AmanaLogo';

export default function PortalResultsPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params?.patientId as string;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    if (!token) {
      router.replace('/portal/login');
      return;
    }

    async function fetchResults() {
      try {
        const res = await fetch(`/api/portal/results/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401 || res.status === 403) {
          router.replace('/portal/login');
          return;
        }

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load results');

        setData(json);

        // Generate HTML from server-rendered template endpoint
        const htmlRes = await fetch(`/api/portal/render/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (htmlRes.ok) {
          const html = await htmlRes.text();
          setHtmlContent(html);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [patientId, router]);

  function handlePrint() {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading your results…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>⚠ {error}</p>
        <button onClick={() => router.back()} style={styles.backBtn}>← Go Back</button>
      </div>
    );
  }

  const patient = data?.patient;
  const tests = data?.tests || [];
  const org = data?.org;

  const patientName = [patient?.first_name, patient?.middle_name, patient?.surname]
    .filter(Boolean).join(' ') || 'Patient';

  const visitDate = patient?.registered_at
    ? new Date(patient.registered_at).toLocaleDateString('en-NG', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <button onClick={() => router.back()} style={styles.headerBackBtn}>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3.5"
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back to Dashboard</span>
          </button>
          <div style={styles.headerBrand}>
            <AmanaLogo size={24} inverted={true} />
            <span style={styles.headerOrgName}>Patient Portal</span>
          </div>
          <div style={styles.headerActions}>
            <button onClick={handlePrint} style={styles.printBtn}>
              🖨 Print / Save PDF
            </button>
          </div>
        </div>
      </header>

      {/* Patient Info Banner */}
      <div style={styles.patientBanner}>
        <div style={styles.bannerInner}>
          <div style={styles.patientInfo}>
            <h1 style={styles.patientName}>{patientName}</h1>
            <div style={styles.patientMeta}>
              <span style={styles.metaItem}>#{patient?.slip_number}</span>
              <span style={styles.metaDot}>·</span>
              <span style={styles.metaItem}>Visit: {visitDate}</span>
              <span style={styles.metaDot}>·</span>
              <span style={styles.metaItem}>{tests.length} Test{tests.length !== 1 ? 's' : ''} Completed</span>
            </div>
          </div>
          <div style={styles.partialNote}>
            {tests.length > 0 && (
              <div style={styles.noteBox}>
                <span style={styles.noteIcon}>ℹ</span>
                <span>
                  Showing {tests.length} completed result{tests.length !== 1 ? 's' : ''}.
                  Pending tests will appear here once ready.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div style={styles.content}>
        {tests.length === 0 ? (
          <div style={styles.noResults}>
            <div style={styles.noResultsIcon}>⏳</div>
            <h2 style={styles.noResultsTitle}>Results Not Yet Available</h2>
            <p style={styles.noResultsText}>
              Your tests are currently being processed. Results will appear here as soon as they are ready.
              You will also receive an email notification.
            </p>
            <button onClick={() => router.back()} style={styles.goBackBtn}>
              ← Return to Dashboard
            </button>
          </div>
        ) : htmlContent ? (
          /* Render the official report HTML in a sandboxed iframe */
          <div style={styles.reportWrapper}>
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              style={styles.reportIframe}
              title="Diagnostic Report"
            />
          </div>
        ) : (
          /* Fallback: display tests as cards */
          <div style={styles.testCards}>
            {tests.map((t: any) => (
              <div key={t.id} style={styles.testCard}>
                <div style={styles.testCardHeader}>
                  <h3 style={styles.testCardTitle}>{t.test_name}</h3>
                  <div style={styles.testCardMeta}>
                    <span style={styles.deptBadge}>{t.department}</span>
                    {t.completed_at && (
                      <span style={styles.completedAtText}>
                        {new Date(t.completed_at).toLocaleDateString('en-NG')}
                      </span>
                    )}
                  </div>
                </div>
                {t.results && Array.isArray(t.results) && t.results.length > 0 && (
                  <table style={styles.resultsTable}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Parameter</th>
                        <th style={styles.th}>Result</th>
                        <th style={styles.th}>Unit</th>
                        <th style={styles.th}>Reference Range</th>
                        <th style={styles.th}>Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.results.map((r: any, idx: number) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fc' }}>
                          <td style={styles.td}>{r.parameter}</td>
                          <td style={{ ...styles.td, fontWeight: '600', color: r.flag ? '#c0392b' : '#111d3b' }}>
                            {r.result}
                          </td>
                          <td style={{ ...styles.td, color: '#7f8599' }}>{r.unit}</td>
                          <td style={{ ...styles.td, color: '#7f8599' }}>{r.range}</td>
                          <td style={styles.td}>
                            {r.flag && (
                              <span style={styles.flagBadge}>{r.flag}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {t.notes && (
                  <div style={styles.notesBox}>
                    <strong>Notes:</strong> {t.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <footer style={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Amana Trust Diagnostics. All rights reserved.</p>
        <p>This report is intended for the patient named above. Please consult a qualified physician for medical advice.</p>
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
  backBtn: {
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
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  headerBackBtn: {
    background: 'transparent',
    border: 'none',
    color: '#85a9eb',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"IBM Plex Sans", sans-serif',
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  headerBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerOrgName: {
    color: '#ffffff',
    fontFamily: '"Times New Roman", Times, serif',
    fontWeight: '700',
    fontSize: '15px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-end',
  },
  printBtn: {
    background: '#0563c1',
    color: '#ffffff',
    border: 'none',
    padding: '9px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"IBM Plex Sans", sans-serif',
    whiteSpace: 'nowrap' as const,
  },

  patientBanner: {
    background: 'linear-gradient(135deg, #111d3b 0%, #1c3062 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  bannerInner: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '24px 24px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '16px',
  },
  patientInfo: {},
  patientName: {
    color: '#ffffff',
    fontFamily: '"Times New Roman", Times, serif',
    fontWeight: '700',
    fontSize: '22px',
    margin: '0 0 8px',
  },
  patientMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  metaItem: {
    color: '#b0bcd4',
    fontSize: '13px',
    fontFamily: '"IBM Plex Sans", sans-serif',
  },
  metaDot: {
    color: '#4c5266',
  },
  partialNote: {
    alignSelf: 'center',
  },
  noteBox: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#b0bcd4',
    padding: '10px 14px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    maxWidth: '340px',
    lineHeight: '1.5',
  },
  noteIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },
  content: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '24px 24px 64px',
  },
  reportWrapper: {
    border: '1px solid #dde2f0',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    background: '#fff',
    overflow: 'hidden',
  },
  reportIframe: {
    width: '100%',
    height: 'calc(100vh - 240px)',
    minHeight: '600px',
    border: 'none',
    display: 'block',
  },
  noResults: {
    textAlign: 'center' as const,
    padding: '80px 24px',
    background: '#ffffff',
    border: '1px solid #e0e4ef',
  },
  noResultsIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  noResultsTitle: {
    color: '#20232b',
    fontFamily: '"Times New Roman", Times, serif',
    fontSize: '22px',
    fontWeight: '700',
    margin: '0 0 12px',
  },
  noResultsText: {
    color: '#4c5266',
    fontSize: '15px',
    lineHeight: '1.6',
    maxWidth: '440px',
    margin: '0 auto 24px',
  },
  goBackBtn: {
    background: '#0563c1',
    color: '#ffffff',
    border: 'none',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"IBM Plex Sans", sans-serif',
  },
  testCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  testCard: {
    background: '#ffffff',
    border: '1px solid #e0e4ef',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  testCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '16px',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  testCardTitle: {
    color: '#111d3b',
    fontFamily: '"Times New Roman", Times, serif',
    fontWeight: '700',
    fontSize: '16px',
    margin: 0,
  },
  testCardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  deptBadge: {
    background: '#dce5fa',
    color: '#4472c4',
    padding: '2px 10px',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'capitalize' as const,
  },
  completedAtText: {
    color: '#7f8599',
    fontSize: '12px',
    fontFamily: '"IBM Plex Mono", monospace',
  },
  resultsTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
  },
  th: {
    background: '#111d3b',
    color: '#ffffff',
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  td: {
    padding: '9px 12px',
    borderBottom: '1px solid #e8ebf3',
    color: '#20232b',
    fontSize: '14px',
  },
  flagBadge: {
    background: '#fadbd8',
    color: '#c0392b',
    padding: '1px 8px',
    fontSize: '11px',
    fontWeight: '700',
  },
  notesBox: {
    marginTop: '12px',
    padding: '10px 14px',
    background: '#fffbe6',
    border: '1px solid #ffe58f',
    fontSize: '13px',
    color: '#4c5266',
    lineHeight: '1.5',
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
};
