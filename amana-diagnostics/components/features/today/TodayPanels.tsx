'use client';

import Link from 'next/link';
import {
  RiCoinsLine,
  RiFileList3Line,
  RiHandCoinLine,
  RiHospitalLine,
  RiRadarLine,
  RiTestTubeLine,
  RiTimeLine,
  RiUserAddLine,
  RiWalletLine,
} from '@remixicon/react';

import { Badge, Card, CardBody, CardHeader, EmptyState, Stat, Table } from '@/components/ui';
import { formatTAT } from '@/lib/staffPerformance';
import { formatAge, naira, type FloorCard as FloorCardModel, type MoneyRow as MoneyModel, type ReferrerRow, type StaffActivityRow, type Throughput } from '@/lib/today';

import styles from './today.module.css';

/**
 * The panels of the Today screen. Each takes a slice of the model built by
 * lib/today/aggregate.ts and arranges it; none of them computes anything.
 */

export function MoneyRow({ money, loading }: { money: MoneyModel | null; loading: boolean }) {
  const m = money;
  return (
    <div className={styles['row']}>
      <Stat
        label="Billed"
        value={m ? naira(m.billed.value) : ''}
        delta={m?.billed.delta}
        spark={m?.billed.spark}
        icon={<RiFileList3Line size={16} />}
        tone="accent"
        loading={loading}
      />
      <Stat
        label="Collected"
        value={m ? naira(m.collected.value) : ''}
        delta={m?.collected.delta}
        spark={m?.collected.spark}
        note={m ? 'Cash at the desk, wallet top-ups and other charges' : undefined}
        icon={<RiWalletLine size={16} />}
        tone="success"
        loading={loading}
      />
      <Stat
        label="Outstanding"
        value={m ? naira(m.outstanding.value) : ''}
        delta={m?.outstanding.delta}
        spark={m?.outstanding.spark}
        note={
          m && m.outstanding.thisPeriodCount > 0
            ? `${naira(m.outstanding.thisPeriodAmount)} from ${m.outstanding.thisPeriodCount} visit${m.outstanding.thisPeriodCount === 1 ? '' : 's'} this period`
            : m
              ? 'Across every visit on record'
              : undefined
        }
        icon={<RiCoinsLine size={16} />}
        tone={m && m.outstanding.value > 0 ? 'warning' : 'neutral'}
        loading={loading}
      />
      <Stat
        label="Commission accrued"
        value={m ? naira(m.commission.value) : ''}
        delta={m?.commission.delta}
        spark={m?.commission.spark}
        icon={<RiHandCoinLine size={16} />}
        tone="info"
        loading={loading}
      />
    </div>
  );
}

export function ThroughputRow({ t, loading }: { t: Throughput | null; loading: boolean }) {
  return (
    <div className={[styles['row'], styles['rowFive']].join(' ')}>
      <Stat
        label="Visits"
        value={t ? String(t.visits.value) : ''}
        delta={t?.visits.delta}
        spark={t?.visits.spark}
        icon={<RiUserAddLine size={16} />}
        loading={loading}
        dense
      />
      <Stat
        label="Tests signed off"
        value={t ? String(t.completed.value) : ''}
        delta={t?.completed.delta}
        spark={t?.completed.spark}
        icon={<RiTestTubeLine size={16} />}
        loading={loading}
        dense
      />
      <Stat
        label="Waiting now"
        value={t ? String(t.waitingNow) : ''}
        note={t ? 'Tests not yet signed off, any date' : undefined}
        tone={t && t.waitingNow > 0 ? 'warning' : 'neutral'}
        icon={<RiTimeLine size={16} />}
        loading={loading}
        dense
      />
      <Stat
        label="Turnaround"
        value={t ? (t.avgTatMinutes ? formatTAT(t.avgTatMinutes) : '—') : ''}
        delta={t?.avgTatMinutes ? t.avgTatDelta : undefined}
        note={t ? 'Arrival to signature, average' : undefined}
        loading={loading}
        dense
      />
      <Stat
        label="Longest wait"
        value={t ? (t.longestWait ? formatAge(t.longestWait.minutes) : '—') : ''}
        note={t?.longestWait ? `${t.longestWait.test.patient_name} · ${t.longestWait.test.test_name}` : undefined}
        tone={t?.longestWait && t.longestWait.minutes > 90 ? 'critical' : 'neutral'}
        loading={loading}
        dense
      />
    </div>
  );
}

const FLOOR_ICON = {
  reception: <RiHospitalLine size={16} aria-hidden="true" />,
  lab: <RiTestTubeLine size={16} aria-hidden="true" />,
  radiology: <RiRadarLine size={16} aria-hidden="true" />,
};

export function FloorCards({ floor }: { floor: FloorCardModel[] }) {
  return (
    <div className={styles['floor']}>
      {floor.map((f) => {
        const long = f.oldestWaitMinutes !== null && f.oldestWaitMinutes > 90;
        return (
          <Link key={f.department} href={f.href} className={styles['floorCard']}>
            <span>
              <span className={styles['floorName']}>
                {FLOOR_ICON[f.department]}
                {f.label}
              </span>
              <span className={[styles['floorOldest'], long ? styles['floorOldestLong'] : ''].filter(Boolean).join(' ')}>
                {f.department === 'reception'
                  ? f.waiting > 0
                    ? `${f.waiting} visit${f.waiting === 1 ? '' : 's'} still owing`
                    : 'Everyone registered this period has paid'
                  : f.oldestWaitMinutes === null
                    ? 'Nobody waiting'
                    : `Longest wait ${formatAge(f.oldestWaitMinutes)}`}
              </span>
            </span>
            <span className={styles['floorNums']}>
              <span className={styles['floorNum']}>
                <span className={styles['floorFigure']}>{f.waiting}</span>
                <span className={styles['floorLabel']}>{f.department === 'reception' ? 'Owing' : 'Waiting'}</span>
              </span>
              {f.department !== 'reception' && (
                <span className={styles['floorNum']}>
                  <span className={styles['floorFigure']}>{f.inProgress}</span>
                  <span className={styles['floorLabel']}>At bench</span>
                </span>
              )}
              <span className={styles['floorNum']}>
                <span className={styles['floorFigure']}>{f.doneInPeriod}</span>
                <span className={styles['floorLabel']}>{f.department === 'reception' ? 'Registered' : 'Done'}</span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function DeptShare({
  share,
  total,
}: {
  share: Record<string, { count: number; rev: number }>;
  total: number;
}) {
  const entries = Object.entries(share);
  if (entries.length === 0) {
    return <EmptyState title="Nothing signed off in this period" compact />;
  }
  return (
    <ul className={styles['depts']}>
      {entries.map(([dept, s]) => {
        const percent = total > 0 ? (s.rev / total) * 100 : 0;
        const label = dept === 'lab' ? 'Laboratory' : dept === 'radiology' ? 'Radiology' : dept;
        return (
          <li key={dept}>
            <div className={styles['deptHead']}>
              <span className={styles['deptName']}>
                {label} · {s.count} test{s.count === 1 ? '' : 's'}
              </span>
              <span className={styles['deptValue']}>
                {naira(s.rev)} ({percent.toFixed(0)}%)
              </span>
            </div>
            <div
              className={styles['bar']}
              role="meter"
              aria-valuenow={Math.round(percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label} share of revenue`}
            >
              <svg className={styles['barSvg']} viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true">
                <rect className={styles['barFill']} data-dept={dept} x="0" y="0" width={percent} height="1" />
              </svg>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TopReferrers({ rows, slug }: { rows: ReferrerRow[]; slug: string }) {
  return (
    <Card>
      <CardHeader title="Who sent patients" subtitle="By value billed in this period" />
      <CardBody flush>
        <Table
          caption="Referrers ranked by value billed"
          rows={rows}
          rowKey={(r) => r.id ?? `name:${r.name}`}
          empty={
            <EmptyState title="No referrals in this period" compact>
              Visits with a referring doctor or facility appear here.
            </EmptyState>
          }
          columns={[
            {
              key: 'name',
              header: 'Referrer',
              render: (r: ReferrerRow) =>
                r.id ? (
                  <Link href={`/${slug}/admin/referrals`} className={styles['inboxTitle']}>
                    {r.name}
                  </Link>
                ) : (
                  <span>
                    {r.name} <span className={styles['muted']}>(typed)</span>
                  </span>
                ),
            },
            {
              key: 'kind',
              header: 'Type',
              render: (r: ReferrerRow) => (
                <Badge tone={r.kind === 'doctor' ? 'accent' : r.kind === 'facility' ? 'info' : 'neutral'}>
                  {r.kind === 'doctor' ? 'Doctor' : r.kind === 'facility' ? 'Facility' : 'Unlisted'}
                </Badge>
              ),
            },
            { key: 'visits', header: 'Visits', numeric: true, render: (r: ReferrerRow) => String(r.visits) },
            { key: 'billed', header: 'Billed', numeric: true, render: (r: ReferrerRow) => naira(r.billed) },
            {
              key: 'owed',
              header: 'Owed',
              numeric: true,
              render: (r: ReferrerRow) =>
                r.owed > 0 ? (
                  <Link href={`/${slug}/admin/referrals/commissions?status=pending`} className={styles['inboxTitle']}>
                    {naira(r.owed)}
                  </Link>
                ) : (
                  <span className={styles['muted']}>—</span>
                ),
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}

export function TopStaff({ rows, slug }: { rows: StaffActivityRow[]; slug: string }) {
  return (
    <Card>
      <CardHeader
        title="Who signed off work"
        subtitle="Tests released in this period"
        actions={
          <Link href={`/${slug}/admin/staff`} className={styles['inboxTitle']}>
            All staff
          </Link>
        }
      />
      <CardBody flush>
        <Table
          caption="Staff ranked by tests signed off"
          rows={rows}
          rowKey={(r) => r.id}
          empty={<EmptyState title="Nothing signed off yet" compact />}
          columns={[
            { key: 'name', header: 'Staff member', render: (r: StaffActivityRow) => r.name },
            {
              key: 'dept',
              header: 'Bench',
              render: (r: StaffActivityRow) => (
                <span>
                  {r.departments.map((d) => (
                    <Badge key={d} tone={d === 'lab' ? 'accent' : 'info'}>
                      {d === 'lab' ? 'Lab' : 'Radiology'}
                    </Badge>
                  ))}
                </span>
              ),
            },
            { key: 'n', header: 'Signed off', numeric: true, render: (r: StaffActivityRow) => String(r.completed) },
          ]}
        />
      </CardBody>
    </Card>
  );
}
