'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, useParams } from 'next/navigation';
import {
  fetchReferringFacilities, fetchReferringDoctors, fetchTestPrices, fetchCommissionReport,
} from '@/lib/store';
import {
  RiHospitalLine, RiUserHeartLine, RiPriceTag3Line, RiMoneyDollarCircleLine,
  RiArrowRightLine,
} from '@remixicon/react';
import Link from 'next/link';

export default function ReferralsOverviewPage() {
  const { organization } = useAuth();
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  const [stats, setStats] = useState({
    facilities: 0, doctors: 0, pricedTests: 0, totalCommission: 0, referralCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id) return;
    Promise.all([
      fetchReferringFacilities(organization.id),
      fetchReferringDoctors(organization.id),
      fetchTestPrices(organization.id),
      fetchCommissionReport(organization.id),
    ]).then(([facs, docs, prices, commissions]) => {
      setStats({
        facilities: facs.length,
        doctors: docs.length,
        pricedTests: prices.filter(p => p.price > 0).length,
        totalCommission: commissions.reduce((s, c) => s + c.commissionAmount, 0),
        referralCount: commissions.length,
      });
      setLoading(false);
    });
  }, [organization?.id]);

  const cards = [
    {
      title: 'Referring Facilities',
      desc: 'Hospitals & clinics that send you patients',
      value: stats.facilities,
      unit: 'facilities',
      icon: <RiHospitalLine size={24} />,
      color: 'var(--teal-600)',
      bg: 'rgba(68,114,196,0.08)',
      path: `/${slug}/admin/referrals/facilities`,
    },
    {
      title: 'Referring Doctors',
      desc: 'Individual doctors linked to facilities or independent',
      value: stats.doctors,
      unit: 'doctors',
      icon: <RiUserHeartLine size={24} />,
      color: '#7c3aed',
      bg: 'rgba(124,58,237,0.08)',
      path: `/${slug}/admin/referrals/doctors`,
    },
    {
      title: 'Test Price List',
      desc: 'Set prices for all tests — used in commission calculations',
      value: stats.pricedTests,
      unit: 'tests priced',
      icon: <RiPriceTag3Line size={24} />,
      color: 'var(--gold)',
      bg: 'rgba(201,151,58,0.08)',
      path: `/${slug}/admin/referrals/pricing`,
    },
    {
      title: 'Commissions Due',
      desc: `${stats.referralCount} referral${stats.referralCount !== 1 ? 's' : ''} tracked`,
      value: `₦${stats.totalCommission.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
      unit: 'total owed',
      icon: <RiMoneyDollarCircleLine size={24} />,
      color: 'var(--green)',
      bg: 'rgba(30,126,90,0.08)',
      path: `/${slug}/admin/referrals/commissions`,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', margin: '0 0 0.3rem' }}>
          Referrals & Pricing
        </h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', margin: 0 }}>
          Manage your referral network, set test prices, and track commissions owed to referring doctors and facilities.
        </p>
      </div>

      <div style={{ padding: '0 2rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {cards.map(c => (
            <Link key={c.path} href={c.path} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'white', border: '1px solid var(--gray-200)', padding: '1.5rem',
                cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
                display: 'flex', flexDirection: 'column', gap: '1rem',
              }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ width: 44, height: 44, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color }}>
                    {c.icon}
                  </div>
                  <RiArrowRightLine size={18} color="var(--gray-300)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-400)', marginBottom: '0.25rem' }}>{c.title}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: c.color, lineHeight: 1 }}>
                    {loading ? '—' : c.value}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>{loading ? '…' : c.unit}</div>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)', margin: 0 }}>{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
