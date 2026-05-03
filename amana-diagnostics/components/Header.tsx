'use client';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiArrowLeftLine } from '@remixicon/react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  accentColor?: string;
  notifications?: number;
}

export default function Header({ title, subtitle, icon = <RiMicroscopeLine size={20} color="white" />, accentColor = 'var(--teal-600)', notifications }: HeaderProps) {
  const router = useRouter();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

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
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{dateStr}</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: accentColor, fontFamily: 'var(--font-mono)' }}>{timeStr}</div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--teal-100)', color: 'var(--teal-700)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', fontWeight: 700,
        }}>
          ATD
        </div>
      </div>
    </header>
  );
}
