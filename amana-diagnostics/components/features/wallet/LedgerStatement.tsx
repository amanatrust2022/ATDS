'use client';

import { Badge, Button, EmptyState, LoadingPanel } from '@/components/ui';

import styles from './ledger.module.css';

const money = (n: number) => `₦${Math.abs(n).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

/**
 * Everything that has happened to this wallet, newest first.
 *
 * A reversal names what it undoes in `reference_id`, so the statement itself
 * knows which entries have already been credited back — that is where
 * `reversedIds` comes from, rather than a separate flag that could drift.
 */
export function LedgerStatement({
  transactions,
  loading,
  reversing,
  onReverse,
}: {
  transactions: any[];
  loading: boolean;
  reversing: boolean;
  onReverse: (tx: any) => void;
}) {
  if (loading) return <LoadingPanel label="Reading the statement…" />;

  if (transactions.length === 0) {
    return (
      <EmptyState title="Nothing on this account yet">
        Deposits and charges will appear here as they are recorded.
      </EmptyState>
    );
  }

  const reversedIds = new Set(
    transactions.filter((t) => t.type === 'reversal' && t.reference_id).map((t) => t.reference_id),
  );

  return (
    <ul className={styles['statement']}>
      {transactions.map((tx) => {
        const when = new Date(tx.created_at).toLocaleDateString('en-NG', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const isCredit = tx.type === 'deposit' || tx.amount >= 0;
        const isReversal = tx.type === 'reversal';
        const wasReversed = reversedIds.has(tx.id);
        // Only a charge, only once, and not while one is in flight. Deposits
        // are not reversible here — taking money back out is a withdrawal.
        const canReverse = !isReversal && tx.amount < 0 && !wasReversed && !reversing;

        return (
          <li key={tx.id} className={styles['entry']} data-reversed={wasReversed || undefined}>
            <div className={styles['entryText']}>
              <span className={styles['entryDescription']}>{tx.description}</span>
              <span className={styles['entryMeta']}>
                {when} · Ref {tx.reference_id || '—'} · {tx.created_by || 'Unknown'}
                {wasReversed && (
                  <>
                    {' '}
                    <Badge tone="critical">Reversed</Badge>
                  </>
                )}
              </span>
            </div>

            <div className={styles['entryRight']}>
              {canReverse && (
                <Button
                  size="sm"
                  onClick={() => onReverse(tx)}
                  title="Records the opposite of this charge. The original entry stays on the statement."
                >
                  Reverse
                </Button>
              )}
              <span className={isCredit ? styles['credit'] : styles['debit']}>
                {isCredit ? '+' : '−'}
                {money(tx.amount)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
