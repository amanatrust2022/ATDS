'use client';

import { RiHospitalLine, RiUserHeartLine } from '@remixicon/react';

import { Badge, Button, Checkbox, EmptyState, SkeletonRows, Table } from '@/components/ui';
import { rateLabel } from '@/lib/commissionsView';
import type { CommissionEntry } from '@/lib/store';

import styles from './commissions.module.css';

const money = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-NG');

/** One row per visit that earned somebody a commission. */
export function CommissionsDetails({
  entries,
  loading,
  selectedIds,
  onToggle,
  onToggleAll,
  onSettle,
}: {
  entries: CommissionEntry[];
  loading: boolean;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onSettle: (entry: CommissionEntry) => void;
}) {
  if (loading) {
    return (
      <div className={styles['loading']}>
        <SkeletonRows rows={6} columns={[1, 2, 2, 3, 2, 1, 2, 1, 1]} />
      </div>
    );
  }

  const pending = entries.filter((e) => e.commissionStatus === 'pending');
  const allPendingSelected =
    pending.length > 0 && pending.every((e) => selectedIds.includes(e.patientId));

  return (
    <Table
      caption="Commissions earned, one row per visit"
      rows={entries}
      rowKey={(e, i) => `${e.patientId}-${i}`}
      empty={
        <EmptyState title="Nothing matches these filters">
          Widen the dates, or clear the search.
        </EmptyState>
      }
      columns={[
        {
          key: 'select',
          // The header checkbox only ever covers what is on screen. Selections
          // are cleared when a filter changes, so a bulk settlement can never
          // reach a row the person looking at it cannot see.
          header: (
            <Checkbox
              checked={allPendingSelected}
              onChange={onToggleAll}
              disabled={pending.length === 0}
              label={<span className="sr-only">Select every unsettled commission shown</span>}
            />
          ),
          headerLabel: 'Select',
          render: (e: CommissionEntry) =>
            e.commissionStatus === 'pending' ? (
              <Checkbox
                checked={selectedIds.includes(e.patientId)}
                onChange={() => onToggle(e.patientId)}
                label={<span className="sr-only">Select the commission for {e.patientName}</span>}
              />
            ) : null,
        },
        {
          key: 'date',
          header: 'Date',
          render: (e: CommissionEntry) => <span className={styles['nowrap']}>{day(e.registeredAt)}</span>,
        },
        {
          key: 'patient',
          header: 'Patient',
          render: (e: CommissionEntry) => (
            <span className={styles['stack']}>
              <span className={styles['strong']}>{e.patientName}</span>
              <span className={styles['slip']}>{e.slipNumber}</span>
            </span>
          ),
        },
        {
          key: 'referrer',
          header: 'Referred by',
          render: (e: CommissionEntry) => (
            <span className={styles['referrer']}>
              {e.referrerType === 'doctor' ? (
                <RiUserHeartLine size={14} aria-hidden="true" />
              ) : (
                <RiHospitalLine size={14} aria-hidden="true" />
              )}
              <span className={styles['stack']}>
                <span className={styles['strong']}>{e.referrerName}</span>
                <span className={styles['muted']}>{e.referrerType}</span>
              </span>
            </span>
          ),
        },
        {
          key: 'tests',
          header: 'Tests',
          render: (e: CommissionEntry) => (
            <span className={styles['tests']}>
              {e.tests.map((t) => (
                <Badge key={t.testId} tone="accent">
                  {t.testName}
                </Badge>
              ))}
            </span>
          ),
        },
        {
          key: 'billed',
          header: 'Billed',
          numeric: true,
          render: (e: CommissionEntry) => money(e.totalAmount),
        },
        {
          key: 'rate',
          header: 'Rate',
          numeric: true,
          render: (e: CommissionEntry) => rateLabel(e),
        },
        {
          key: 'commission',
          header: 'Commission',
          numeric: true,
          render: (e: CommissionEntry) => (
            <span className={styles['commission']}>{money(e.commissionAmount)}</span>
          ),
        },
        {
          key: 'status',
          header: 'Status',
          render: (e: CommissionEntry) =>
            e.commissionStatus === 'paid' ? (
              <Badge tone="success">Settled</Badge>
            ) : (
              <Badge tone="warning">Owed</Badge>
            ),
        },
        {
          key: 'actions',
          header: 'Actions',
          actions: true,
          render: (e: CommissionEntry) =>
            e.commissionStatus === 'pending' ? (
              <Button size="sm" onClick={() => onSettle(e)}>
                Settle
              </Button>
            ) : (
              <span className={styles['muted']} title={e.commissionPaidNotes || 'No note recorded'}>
                {e.commissionPaidAt ? day(e.commissionPaidAt) : 'Settled'}
              </span>
            ),
        },
      ]}
    />
  );
}
