'use client';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiHospitalLine, RiTestTubeLine, RiRadarLine } from '@remixicon/react';

export default function Home() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--teal-900) 0%, var(--teal-700) 50%, var(--teal-800) 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background pattern removed */}

      {/* Logo / Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem', position: 'relative' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          border: '2px solid rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
          fontSize: '2rem',
        }}><RiMicroscopeLine size={40} color="white" /></div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.4rem, 3vw, 2rem)',
          fontWeight: 700,
          color: 'white',
          lineHeight: 1.2,
          marginBottom: '0.5rem',
        }}>
          AMANA TRUST DIAGNOSTICS
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          & Clinical Services Limited
        </p>
        <div style={{
          width: 60, height: 2,
          background: 'var(--gold)',
          margin: '1rem auto 0',
        }} />
      </div>

      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Select your workstation
      </p>

      {/* Role Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', maxWidth: 720, width: '100%', position: 'relative' }}>
        {[
          { role: 'reception', icon: <RiHospitalLine size={40} />, label: 'Reception', desc: 'Register patients, issue slips, print results', color: '#3ec5bc' },
          { role: 'lab', icon: <RiTestTubeLine size={40} />, label: 'Laboratory', desc: 'View pending tests and log results', color: 'var(--gold)' },
          { role: 'radiology', icon: <RiRadarLine size={40} />, label: 'Radiology', desc: 'View imaging requests and submit reports', color: '#a78bfa' },
        ].map(item => (
          <button
            key={item.role}
            onClick={() => router.push(`/${item.role}`)}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem 1.5rem',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = item.color;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{item.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'white', fontSize: '1.1rem', marginBottom: '0.4rem' }}>
              {item.label}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', lineHeight: 1.5 }}>{item.desc}</div>
            <div style={{
              marginTop: '1rem', fontSize: '0.75rem', fontWeight: 600,
              color: item.color, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Open →
            </div>
          </button>
        ))}
      </div>

      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', marginTop: '3rem', position: 'relative' }}>
        Amana Trust Diagnostics & Clinical Services Ltd • Internal System
      </p>
    </div>
  );
}
