'use client';
import { useAuth } from '@/components/AuthProvider';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { RiDashboardLine, RiTeamLine, RiSettings3Line, RiHospitalLine, RiTestTubeLine, RiRadarLine, RiArrowLeftLine, RiUserHeartLine, RiPriceTag3Line, RiMoneyDollarCircleLine, RiUserLine, RiFileList2Line } from '@remixicon/react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { organization, profile } = useAuth();
  const params = useParams();
  const slug = params?.slug as string;
  const pathname = usePathname();
  const router = useRouter();

  if (profile?.role !== 'admin') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
        You do not have permission to view the admin dashboard.
      </div>
    );
  }

  const navItems = [
    { name: 'Workspace Overview', path: `/${slug}/admin`, icon: <RiDashboardLine size={18} /> },
    { name: 'Staff Management', path: `/${slug}/admin/staff`, icon: <RiTeamLine size={18} /> },
    { name: 'Test Catalogue', path: `/${slug}/admin/tests`, icon: <RiFileList2Line size={18} /> },
    { name: 'Patient Database', path: `/${slug}/admin/patients`, icon: <RiUserLine size={18} /> },
    { name: 'Organization Settings', path: `/${slug}/admin/settings`, icon: <RiSettings3Line size={18} /> },
  ];

  const referralItems = [
    { name: 'Referrals Overview', path: `/${slug}/admin/referrals`, icon: <RiHospitalLine size={16} />, color: '#4472c4' },
    { name: '↳ Facilities', path: `/${slug}/admin/referrals/facilities`, icon: <RiHospitalLine size={16} />, color: 'rgba(255,255,255,0.5)' },
    { name: '↳ Doctors', path: `/${slug}/admin/referrals/doctors`, icon: <RiUserHeartLine size={16} />, color: 'rgba(255,255,255,0.5)' },
    { name: '↳ Test Pricing', path: `/${slug}/admin/referrals/pricing`, icon: <RiPriceTag3Line size={16} />, color: 'rgba(255,255,255,0.5)' },
    { name: '↳ Commissions', path: `/${slug}/admin/referrals/commissions`, icon: <RiMoneyDollarCircleLine size={16} />, color: '#c9973a' },
  ];

  const quickLinks = [
    { name: 'Launch Reception', path: `/${slug}/reception`, icon: <RiHospitalLine size={18} />, color: '#4472c4' },
    { name: 'Launch Laboratory', path: `/${slug}/lab`, icon: <RiTestTubeLine size={18} />, color: '#10b981' },
    { name: 'Launch Radiology', path: `/${slug}/radiology`, icon: <RiRadarLine size={18} />, color: '#8b5cf6' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--gray-50)', fontFamily: 'var(--font-body)' }}>
      {/* Sidebar */}
      <aside style={{ width: 260, background: '#0a0f1e', color: 'white', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4472c4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Admin Console</div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{organization?.name}</div>
        </div>

        <nav style={{ padding: '1.5rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem', overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem', borderRadius: 8,
                textDecoration: 'none', color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                background: isActive ? 'rgba(68,114,196,0.2)' : 'transparent',
                fontWeight: isActive ? 600 : 500, transition: 'all 0.2s',
              }}>
                <span style={{ color: isActive ? '#4472c4' : 'inherit' }}>{item.icon}</span>
                <span style={{ fontSize: '0.875rem' }}>{item.name}</span>
              </Link>
            );
          })}

          {/* Referrals section */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.75rem 0' }} />
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '1rem', marginBottom: '0.25rem' }}>Referrals & Pricing</div>
          {referralItems.map(item => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} style={{
                display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 0.75rem', borderRadius: 8,
                textDecoration: 'none', color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                background: isActive ? 'rgba(68,114,196,0.18)' : 'transparent',
                fontWeight: isActive ? 600 : 400, transition: 'all 0.2s', fontSize: '0.855rem',
              }}>
                <span style={{ color: isActive ? '#4472c4' : item.color }}>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Quick Launch Panel */}
        <div style={{ padding: '1.5rem 1rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>
            Department Switcher
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {quickLinks.map(link => (
              <button key={link.path} onClick={() => router.push(link.path)} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderRadius: 8,
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s'
              }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ color: link.color }}>{link.icon}</span>
                <span style={{ fontSize: '0.85rem' }}>{link.name}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
