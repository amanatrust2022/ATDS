'use client';
import { ReactNode, useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  RiMicroscopeLine, RiArrowLeftLine, RiUserLine, RiSettings3Line, 
  RiTeamLine, RiLogoutCircleLine, RiDashboardLine,
  RiCloudLine, RiCloudOffLine, RiRefreshLine,
  RiHospitalLine, RiTestTubeLine, RiRadarLine
} from '@remixicon/react';
import { useAuth } from '@/components/AuthProvider';

interface HeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  accentColor?: string;
  notifications?: number;
}

export default function Header({ title, subtitle, icon = <RiMicroscopeLine size={20} color="white" />, accentColor = 'var(--teal-600)', notifications }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, organization, session, signOut } = useAuth();
  
  const isLocalMode = typeof window !== 'undefined'
    ? (localStorage.getItem('amana_local_mode') === null
        ? (window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' || 
           window.location.hostname.startsWith('192.168.') || 
           window.location.hostname.startsWith('10.') || 
           window.location.hostname.startsWith('172.'))
        : localStorage.getItem('amana_local_mode') === 'true')
    : (process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [syncStatus, setSyncStatus] = useState<{ status: string; pendingCount: number } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);


  const now = new Date();
  const dateStr = now.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      console.log(`PWA installation outcome: ${outcome}`);
      setInstallPrompt(null);
      setShowInstallBtn(false);
    } else {
      setShowInstructionsModal(true);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !organization) return;
    if (!isLocalMode) return;

    let active = true;

    const runSync = async () => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch('/api/sync', {
          method: 'POST',
          headers,
          body: JSON.stringify({ organizationId: organization.id })
        });
        if (!res.ok) throw new Error('Sync failed');
        const data = await res.json();
        if (active) {
          setSyncStatus({ status: data.status, pendingCount: data.pendingCount });
        }
      } catch (err) {
        console.error('Background sync failed:', err);
        if (active) {
          setSyncStatus(prev => ({ status: 'offline', pendingCount: prev?.pendingCount || 0 }));
        }
      }
    };

    // Run immediately, then poll every 15 seconds
    runSync();
    const interval = setInterval(runSync, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [organization, session]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getWorkspacePath = () => {
    if (!organization || !profile) return '/';
    if (profile.role === 'admin') return `/${organization.slug}/admin`;
    if (profile.role === 'lab') return `/${organization.slug}/lab`;
    if (profile.role === 'radiology') return `/${organization.slug}/radiology`;
    return `/${organization.slug}/reception`;
  };

  const handleBackClick = () => {
    if (typeof window === 'undefined') return;

    if (profile?.role === 'admin' && pathname !== `/${organization?.slug}/admin`) {
      router.push(`/${organization?.slug}/admin`);
    } else if (window.history.length > 1) {
      router.back();
    } else {
      router.push(getWorkspacePath());
    }
  };

  const showBackButton = profile?.role === 'admin'
    ? pathname !== `/${organization?.slug}/admin`
    : (typeof window !== 'undefined' && pathname !== getWorkspacePath());

  const userInitials = profile?.full_name ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

  return (
    <header style={{
      background: 'white',
      borderBottom: '1px solid var(--gray-300)',
      padding: '0 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 64,
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {showBackButton && (
          <button
            onClick={handleBackClick}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--gray-500)', fontSize: '1.1rem', padding: '0.25rem',
              display: 'flex', alignItems: 'center',
            }}
            title="Go Back"
          >
            <RiArrowLeftLine size={18} />
          </button>
        )}
        <div style={{
          width: 36, height: 36, borderRadius: 0,
          background: accentColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem',
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--gray-900)' }}>
            {title}
          </div>
          {subtitle && <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>{subtitle}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {notifications !== undefined && notifications > 0 && (
          <div style={{
            background: 'var(--red)', color: 'white',
            borderRadius: 0, padding: '0.15rem 0.6rem',
            fontSize: '0.72rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}>
            <span style={{ position: 'relative', display: 'inline-block', width: 8, height: 8 }}>
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'white', opacity: 0.6,
                animation: 'ping 1.5s infinite',
              }} />
              <span style={{ position: 'absolute', inset: 1, borderRadius: '50%', background: 'white' }} />
            </span>
            {notifications} pending
          </div>
        )}

        {/* PWA Install Button */}
        <button
          onClick={handleInstallClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '0.2rem 0.6rem',
            border: '1px solid var(--teal-600)',
            backgroundColor: 'var(--teal-600)',
            color: 'white',
            borderRadius: 0,
            cursor: 'pointer',
            transition: 'background-color 0.15s, border-color 0.15s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--teal-700)'; e.currentTarget.style.borderColor = 'var(--teal-700)'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--teal-600)'; e.currentTarget.style.borderColor = 'var(--teal-600)'; }}
          title={installPrompt ? "Install App natively on your Desktop/Laptop" : "How to install this app locally"}
        >
          <span>Install App</span>
        </button>

        {/* Sync Status Indicator */}
        {isLocalMode && syncStatus && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '0.72rem', 
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              border: '1px solid var(--gray-300)',
              backgroundColor: '#f9fafb',
              color: 'var(--gray-700)',
              borderRadius: 0,
            }}
            title={
              syncStatus.status === 'offline' 
                ? 'Local Server Offline (No Internet Connection)' 
                : syncStatus.status === 'pending_sync' || syncStatus.status === 'sync_stalled'
                ? `Syncing: ${syncStatus.pendingCount} updates pending`
                : 'Synced to Supabase Cloud'
            }
          >
            {syncStatus.status === 'offline' ? (
              <>
                <RiCloudOffLine size={14} style={{ color: '#ef4444' }} />
                <span>Offline ({syncStatus.pendingCount})</span>
              </>
            ) : syncStatus.status === 'pending_sync' || syncStatus.status === 'sync_stalled' ? (
              <>
                <RiRefreshLine size={14} style={{ color: '#7c3aed', animation: 'spin 1.5s linear infinite' }} />
                <span>Syncing ({syncStatus.pendingCount})</span>
              </>
            ) : (
              <>
                <RiCloudLine size={14} style={{ color: '#10b981' }} />
                <span>Synced</span>
              </>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        <div style={{ textAlign: 'right', display: 'none' }}>
          {/* Hide date/time on very small screens if needed, but keeping logic */}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{dateStr}</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: accentColor, fontFamily: 'var(--font-mono)' }}>{timeStr}</div>
        </div>

        {/* User Dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--teal-100)', color: 'var(--teal-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer',
              outline: 'none',
              boxShadow: dropdownOpen ? '0 0 0 2px var(--teal-300)' : 'none',
              transition: 'box-shadow 0.2s',
            }}
          >
            {userInitials}
          </button>

          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 0.5rem)', right: 0,
              background: 'white', borderRadius: 0,
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
              border: '1px solid var(--gray-200)', minWidth: '220px', overflow: 'hidden',
              animation: 'fadeIn 0.15s ease',
            }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gray-900)' }}>{profile?.full_name || 'Loading...'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--teal-600)', fontWeight: 600, textTransform: 'uppercase', marginTop: '0.1rem' }}>
                  {profile?.role || 'User'}
                </div>
              </div>
              <div style={{ padding: '0.5rem' }}>
                <button onClick={() => { router.push(getWorkspacePath()); setDropdownOpen(false); }} style={dropdownBtnStyle}>
                  <RiDashboardLine size={16} /> My Workspace
                </button>

                <button onClick={() => { router.push(`/${organization?.slug}/settings`); setDropdownOpen(false); }} style={dropdownBtnStyle}>
                  <RiUserLine size={16} /> My Profile
                </button>
                
                {profile?.role === 'admin' && organization && (
                  <>
                    <button onClick={() => { router.push(`/${organization.slug}/admin/staff`); setDropdownOpen(false); }} style={dropdownBtnStyle}>
                      <RiTeamLine size={16} /> Manage Staff
                    </button>
                    <button onClick={() => { router.push(`/${organization.slug}/admin/settings`); setDropdownOpen(false); }} style={dropdownBtnStyle}>
                      <RiSettings3Line size={16} /> Org Settings
                    </button>
                    
                    <div style={{ height: '1px', background: 'var(--gray-200)', margin: '0.4rem 0' }} />
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', paddingLeft: '0.75rem', marginBottom: '0.25rem', marginTop: '0.25rem' }}>
                      Departments
                    </div>
                    <button onClick={() => { router.push(`/${organization.slug}/reception`); setDropdownOpen(false); }} style={dropdownBtnStyle}>
                      <RiHospitalLine size={16} color="#4472c4" /> Reception
                    </button>
                    <button onClick={() => { router.push(`/${organization.slug}/lab`); setDropdownOpen(false); }} style={dropdownBtnStyle}>
                      <RiTestTubeLine size={16} color="#10b981" /> Laboratory
                    </button>
                    <button onClick={() => { router.push(`/${organization.slug}/radiology`); setDropdownOpen(false); }} style={dropdownBtnStyle}>
                      <RiRadarLine size={16} color="#8b5cf6" /> Radiology
                    </button>
                  </>
                )}
                

                
                <div style={{ height: '1px', background: 'var(--gray-200)', margin: '0.4rem 0' }} />
                
                <button onClick={() => { signOut(); setDropdownOpen(false); }} style={{ ...dropdownBtnStyle, color: 'var(--red)' }}>
                  <RiLogoutCircleLine size={16} color="var(--red)" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showInstructionsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'white',
            width: '100%',
            maxWidth: '560px',
            border: '1px solid var(--gray-300)',
            borderRadius: 0,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            padding: '1.5rem',
            position: 'relative',
            color: 'var(--gray-900)',
          }}>
            <button 
              onClick={() => setShowInstructionsModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer',
                color: 'var(--gray-500)'
              }}
            >
              ×
            </button>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--gray-900)' }}>
              Install DiagnosticOS App
            </h3>
            
            <p style={{ fontSize: '0.82rem', color: 'var(--gray-600)', marginBottom: '1rem', lineHeight: '1.4' }}>
              Since you are connecting to a local LAN Server PC over HTTP, browsers disable the default install prompt for security. You can install it manually in 5 seconds using your browser's options:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <div style={{ borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--teal-700)', marginBottom: '0.25rem' }}>
                  Google Chrome
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-700)', margin: 0 }}>
                  1. Click the <strong>three vertical dots menu (...)</strong> in the top-right corner.<br />
                  2. Select <strong>Save and share</strong>.<br />
                  3. Click <strong>Install page as app...</strong>.
                </p>
              </div>

              <div style={{ borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--teal-700)', marginBottom: '0.25rem' }}>
                  Microsoft Edge
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-700)', margin: 0 }}>
                  1. Click the <strong>three horizontal dots menu (...)</strong> in the top-right corner.<br />
                  2. Hover over <strong>Apps</strong>.<br />
                  3. Click <strong>Install this site as an app</strong>.
                </p>
              </div>

              <div style={{ borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--teal-700)', marginBottom: '0.25rem' }}>
                  Apple Safari (Mac)
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-700)', margin: 0 }}>
                  1. Click the <strong>Share button</strong> in the toolbar.<br />
                  2. Select <strong>Add to Dock</strong>.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--teal-700)', marginBottom: '0.25rem' }}>
                  Enable Native PWA Install over Local Wi-Fi (Advanced)
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-700)', margin: 0 }}>
                  To make Chrome show the native "Install App" prompt on insecure local network IPs, copy/paste this URL in a new tab:<br />
                  <code style={{ background: '#f1f5f9', padding: '2px 4px', fontSize: '0.75rem', display: 'block', margin: '4px 0', wordBreak: 'break-all' }}>
                    chrome://flags/#unsafely-treat-insecure-origin-as-secure
                  </code>
                  Paste <code style={{ background: '#f1f5f9', padding: '2px 4px', fontSize: '0.75rem' }}>{typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://your-server-ip:3000'}</code> into the text area, select "Enabled" from the dropdown, and click "Relaunch".
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button 
                onClick={() => setShowInstructionsModal(false)}
                style={{
                  padding: '0.4rem 1rem',
                  border: '1px solid var(--gray-300)',
                  backgroundColor: 'white',
                  color: 'var(--gray-700)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: 0,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </header>
  );
}

const dropdownBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
  padding: '0.5rem 0.75rem', background: 'none', border: 'none',
  textAlign: 'left', fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)',
  cursor: 'pointer', borderRadius: 0, transition: 'background 0.1s',
};
