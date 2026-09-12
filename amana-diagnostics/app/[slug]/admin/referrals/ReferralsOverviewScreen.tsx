'use client';
import RequireRole from '@/components/RequireRole';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useParams } from 'next/navigation';
import {
  fetchReferringFacilities, fetchReferringDoctors, fetchTestPrices, fetchCommissionReport,
} from '@/lib/store';
import {
  RiHospitalLine, RiUserHeartLine, RiPriceTag3Line, RiMoneyDollarCircleLine,
  RiArrowRightLine,
} from '@remixicon/react';
import Link from 'next/link';
import { Alert, Card, Skeleton } from '@/components/ui';
import { useShellSlot } from '@/components/shell/ShellSlot';

import styles from './referrals.module.css';

function ReferralsOverviewPage() {
  const { organization } = useAuth();
  const params = useParams();
  const slug = params?.slug as string;
  const [stats, setStats] = useState({
    facilities: 0, doctors: 0, pricedTests: 0, totalCommission: 0, referralCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // The shell owns the page heading; the sentence under it is the screen's.
  useShellSlot(
    { subtitle: 'Manage your referral network, set test prices, and track commissions owed to referring doctors and facilities.' },
    [],
  );

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
    }).catch((err: unknown) => {
      // Nothing used to catch this. The promise rejected into the void and the
      // tiles sat on an em dash for ever, with no way to tell a network that
      // had failed from a referral network that was simply empty.
      setError((err as { message?: string })?.message || 'The connection could not be reached.');
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
      iconClass: styles.iconFacilities,
      path: `/${slug}/admin/referrals/facilities`,
    },
    {
      title: 'Referring Doctors',
      desc: 'Individual doctors linked to facilities or independent',
      value: stats.doctors,
      unit: 'doctors',
      icon: <RiUserHeartLine size={24} />,
      iconClass: styles.iconDoctors,
      path: `/${slug}/admin/referrals/doctors`,
    },
    {
      title: 'Test Price List',
      desc: 'Set prices for all tests — used in commission calculations',
      value: stats.pricedTests,
      unit: 'tests priced',
      icon: <RiPriceTag3Line size={24} />,
      iconClass: styles.iconPricing,
      path: `/${slug}/admin/referrals/pricing`,
    },
    {
      title: 'Commissions Due',
      desc: `${stats.referralCount} referral${stats.referralCount !== 1 ? 's' : ''} tracked`,
      value: `₦${stats.totalCommission.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
      unit: 'total owed',
      icon: <RiMoneyDollarCircleLine size={24} />,
      iconClass: styles.iconCommissions,
      path: `/${slug}/admin/referrals/commissions`,
    },
  ];

  return (
    <div className={styles.page}>
      {error && (
        <Alert tone="critical" title="The referral figures could not be loaded" live>
          {error} The four areas below are still open — only their counts are missing.
        </Alert>
      )}

      {loading && !error && (
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading the referral figures…</span>
        </div>
      )}

      <div className={styles.grid}>
        {cards.map(c => (
          <Link key={c.path} href={c.path} className={styles.link}>
            <Card raised className={styles.tile}>
              <div className={styles.tileTop}>
                <span className={`${styles.tileIcon} ${c.iconClass}`} aria-hidden="true">
                  {c.icon}
                </span>
                <RiArrowRightLine size={18} className={styles.chevron} aria-hidden="true" />
              </div>
              <div>
                <div className={styles.title}>{c.title}</div>
                {loading && !error ? (
                  <Skeleton width={90} height="1.75rem" />
                ) : (
                  <span className={styles.figure}>{error ? 'Unavailable' : c.value}</span>
                )}
                <div className={styles.unit}>{c.unit}</div>
              </div>
              <p className={styles.desc}>{c.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GuardedReferralsOverviewPage(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <ReferralsOverviewPage {...props} />
    </RequireRole>
  );
}
