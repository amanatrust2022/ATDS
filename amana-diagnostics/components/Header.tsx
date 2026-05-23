'use client';
import { ReactNode, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiArrowLeftLine, RiUserLine, RiSettings3Line, RiTeamLine, RiLogoutCircleLine, RiDashboardLine } from '@remixicon/react';
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
  const { profile, organization, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

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
    if (profile.role === 'admin') return `/${organization.slug}/admin/staff`;
    if (profile.role === 'lab') return `/${organization.slug}/lab`;
    if (profile.role === 'radiology') return `/${organization.slug}/radiology`;
    return `/${organization.slug}/reception`;
  };

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
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--gray-500)', fontSize: '1.1rem', padding: '0.25rem',
            display: 'flex', alignItems: 'center',
          }}
          title="Back to home"
        >
          <RiArrowLeftLine size={18} />
        </button>
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
              background: 'white', borderRadius: 'var(--radius-lg)',
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
    </header>
  );
}

const dropdownBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
  padding: '0.5rem 0.75rem', background: 'none', border: 'none',
  textAlign: 'left', fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)',
  cursor: 'pointer', borderRadius: 'var(--radius)', transition: 'background 0.1s',
};
