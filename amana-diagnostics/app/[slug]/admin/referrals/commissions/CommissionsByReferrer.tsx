'use client';

import { RiArrowDownSLine, RiArrowRightSLine, RiHospitalLine, RiPrinterLine, RiUserHeartLine } from '@remixicon/react';

import { Badge, Button, Card, CardBody, EmptyState, Table } from '@/components/ui';
import type { ReferrerGroup } from '@/lib/commissionsView';
import type { CommissionEntry } from '@/lib/store';

import styles from './commissions.module.css';

const money = (n: number) => `₦${n.toLocaleString('en-NG')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-NG');

/**
 * The same commissions, totalled per referring doctor or facility.
 *
 * This is the view a clinic actually settles from: one row per person to pay,
 * with what they are owed, and a statement to print and hand over.
 */
export function CommissionsByReferrer({
  groups,
  expanded,
  onToggle,
  onPrint,
}: {
  groups: ReferrerGroup[];
  expanded: Record<string, boolean>;
  onToggle: (name: string) => void;
  onPrint: (name: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <EmptyState title="No referrers match these filters">
        Widen the dates, or clear the search.
      </EmptyState>
    );
  }

  return (
    <ul className={styles['groups']}>
      {groups.map((ref) => {
        const isOpen = Boolean(expanded[ref.name]);
        const bodyId = `referrer-${ref.name.replace(/\W+/g, '-')}`;

        return (
          <li key={ref.name}>
            <Card as="div" className={styles['groupCard']}>
              <div className={styles['groupHead']}>
                {/* The disclosure is a button; printing is a separate button
                  * beside it, rather than a click that has to stopPropagation
                  * its way out of a clickable div. */}
                <button
                  type="button"
                  className={styles['groupToggle']}
                  aria-expanded={isOpen}
                  aria-controls={bodyId}
                  onClick={() => onToggle(ref.name)}
                >
                  <span className={styles['chevron']} aria-hidden="true">
                    {isOpen ? <RiArrowDownSLine size={18} /> : <RiArrowRightSLine size={18} />}
                  </span>
                  <span className={styles['stack']}>
                    <span className={styles['groupName']}>
                      {ref.type === 'doctor' ? (
                        <RiUserHeartLine size={15} aria-hidden="true" />
                      ) : (
                        <RiHospitalLine size={15} aria-hidden="true" />
                      )}
                      {ref.name}
                    </span>
                    <span className={styles['muted']}>
                      {ref.type} · {ref.patients.length} patient
                      {ref.patients.length === 1 ? '' : 's'} sent
                    </span>
                  </span>
                </button>

                <dl className={styles['groupFigures']}>
                  <div>
                    <dt>Billed</dt>
                    <dd>{money(ref.totalBilled)}</dd>
                  </div>
                  <div>
                    <dt>Commission</dt>
                    <dd>{money(ref.commissionAmount)}</dd>
                  </div>
                  <div>
                    <dt>Settled</dt>
                    <dd className={styles['settled']}>{money(ref.paid)}</dd>
                  </div>
                  <div>
                    <dt>Outstanding</dt>
                    <dd className={ref.outstanding > 0 ? styles['owed'] : undefined}>
                      {money(ref.outstanding)}
                    </dd>
                  </div>
                </dl>

                <Button
                  size="sm"
                  icon={<RiPrinterLine size={13} />}
                  onClick={() => onPrint(ref.name)}
                >
                  Statement
                </Button>
              </div>

              <div id={bodyId} hidden={!isOpen}>
                <CardBody flush>
                  <Table
                    caption={`Patients referred by ${ref.name}`}
                    rows={ref.patients}
                    rowKey={(p) => p.patientId}
                    columns={[
                      {
                        key: 'patient',
                        header: 'Patient',
                        render: (p: CommissionEntry) => (
                          <span className={styles['stack']}>
                            <span className={styles['strong']}>{p.patientName}</span>
                            <span className={styles['slip']}>{p.slipNumber}</span>
                          </span>
                        ),
                      },
                      { key: 'date', header: 'Date', render: (p: CommissionEntry) => day(p.registeredAt) },
                      {
                        key: 'tests',
                        header: 'Tests',
                        render: (p: CommissionEntry) => p.tests.map((t) => t.testName).join(', '),
                      },
                      {
                        key: 'billed',
                        header: 'Billed',
                        numeric: true,
                        render: (p: CommissionEntry) => money(p.totalAmount),
                      },
                      {
                        key: 'commission',
                        header: 'Commission',
                        numeric: true,
                        render: (p: CommissionEntry) => (
                          <span className={styles['commission']}>{money(p.commissionAmount)}</span>
                        ),
                      },
                      {
                        key: 'status',
                        header: 'Status',
                        render: (p: CommissionEntry) =>
                          p.commissionStatus === 'paid' ? (
                            <Badge tone="success">Settled</Badge>
                          ) : (
                            <Badge tone="warning">Owed</Badge>
                          ),
                      },
                    ]}
                  />
                </CardBody>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
