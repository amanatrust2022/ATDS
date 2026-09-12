'use client';

import { RiAddLine, RiFolderUserLine, RiWalletLine } from '@remixicon/react';
import { useWalletStore } from '@/lib/store/useWalletStore';
import type { Patient } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Table,
  TableToolbar,
} from '@/components/ui';
import styles from './walletTab.module.css';

import BillingAccountModal from './BillingAccountModal';
import LedgerModal from './LedgerModal';

/**
 * The billing wallet directory.
 *
 * This component existed for months and was rendered nowhere: it was imported
 * by ReceptionPage and never used, while ReceptionPage carried its own inline
 * copy. Wiring it up turned up three things the copy had and this did not, all
 * of which are restored below:
 *
 *   - the Owner column, which a recent commit specifically added a narrow
 *     owner-only fetch to support;
 *   - the Credit Limit column;
 *   - anything at all in `externalCharges`, which had no setter in the store,
 *     so the Charges tab inside the ledger could only ever render empty.
 *
 * It also has something the inline copy never did: transaction reversal, which
 * is built and tested in lib/ and had no reachable UI.
 */

const naira = (n: number) =>
  `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

interface WalletTabProps {
  organization: { id: string; name?: string } | null;
  /** The queue's patients — used to count members against each account. */
  patients: Patient[];
  profile: { full_name?: string } | null;
  refresh: () => void;
}

export default function WalletTab({
  organization,
  patients,
  profile,
  refresh,
}: WalletTabProps) {
  const {
    billingAccounts,
    accountOwners,
    billingSearchQuery,
    showBillingAccountModal,
    showLedgerModal,
    setBillingSearchQuery,
    setShowBillingAccountModal,
    resetAccountForm,
    openLedger,
  } = useWalletStore();

  const handleOpenAccount = () => {
    resetAccountForm();
    setShowBillingAccountModal(true);
  };

  const query = billingSearchQuery.trim().toLowerCase();
  const filtered = query
    ? billingAccounts.filter((acc) => acc.name.toLowerCase().includes(query))
    : billingAccounts;

  const ownerNameFor = (acc: (typeof billingAccounts)[number]) => {
    const owner = accountOwners.find((p) => p.id === Number(acc.owner_patient_id));
    return owner?.name || '—';
  };

  return (
    <div>
      <Card>
        <CardHeader
          title="Client accounts"
          subtitle="Deposit wallets for individuals and families, and the bills charged against them."
          actions={
            <Button intent="primary" icon={<RiAddLine size={15} />} onClick={handleOpenAccount}>
              Open an account
            </Button>
          }
        />

        <CardBody flush>
          <TableToolbar
            count={
              query
                ? `${filtered.length} of ${billingAccounts.length} accounts`
                : `${billingAccounts.length} account${billingAccounts.length === 1 ? '' : 's'}`
            }
          >
            <div className={styles.search}>
              <Field label="Search accounts" labelHidden>
                <Input
                  type="search"
                  value={billingSearchQuery}
                  onChange={(e) => setBillingSearchQuery(e.target.value)}
                  placeholder="Search by account name…"
                />
              </Field>
            </div>
          </TableToolbar>

          <Table
            caption="Billing wallet accounts"
            rows={filtered}
            rowKey={(acc) => String(acc.id)}
            maxHeight="60vh"
            empty={
              <EmptyState
                title={query ? 'No account matches that name' : 'No billing accounts yet'}
                icon={<RiFolderUserLine size={26} />}
                action={
                  query ? undefined : (
                    <Button intent="primary" onClick={handleOpenAccount}>
                      Open an account
                    </Button>
                  )
                }
              >
                {query
                  ? 'Try a shorter search, or clear it to see every account.'
                  : 'A billing account lets a family or an individual pay from a deposit instead of settling each visit at the desk.'}
              </EmptyState>
            }
            columns={[
              {
                key: 'name',
                header: 'Account',
                render: (acc) => <span className={styles.accountName}>{acc.name}</span>,
              },
              { key: 'owner', header: 'Owner', render: ownerNameFor },
              {
                key: 'type',
                header: 'Type',
                render: (acc) => (
                  <Badge
                    tone={
                      acc.type === 'family'
                        ? 'info'
                        : acc.type === 'corporate'
                          ? 'accent'
                          : 'success'
                    }
                  >
                    {acc.type}
                  </Badge>
                ),
              },
              {
                key: 'members',
                header: 'Members',
                numeric: true,
                render: (acc) => patients.filter((p) => p.billingAccountId === acc.id).length,
              },
              {
                key: 'balance',
                header: 'Balance',
                numeric: true,
                render: (acc) => {
                  // Red on its own said nothing to anyone who cannot see red,
                  // and the minus sat mid-string after the naira sign. The
                  // word carries it (rule 5); the colour only reinforces it.
                  const owing = acc.balance < 0;
                  return (
                    <span className={owing ? `${styles.balance} ${styles.balanceOwing}` : styles.balance}>
                      {naira(Math.abs(acc.balance))}
                      {owing && <span className={styles.owing}>owing</span>}
                    </span>
                  );
                },
              },
              {
                key: 'credit',
                header: 'Credit limit',
                numeric: true,
                render: (acc) => naira(acc.credit_limit || 0),
              },
              {
                key: 'status',
                header: 'Status',
                render: (acc) => {
                  // Spendable is the deposit plus whatever credit is allowed.
                  const available = acc.balance + (acc.credit_limit || 0);
                  return available > 0 ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="critical">Depleted</Badge>
                  );
                },
              },
              {
                key: 'actions',
                header: '',
                headerLabel: 'Actions',
                actions: true,
                render: (acc) => (
                  <Button
                    size="sm"
                    intent="secondary"
                    icon={<RiWalletLine size={13} />}
                    onClick={() => openLedger(acc)}
                  >
                    Manage
                  </Button>
                ),
              },
            ]}
          />
        </CardBody>
      </Card>

      {showBillingAccountModal && (
        <BillingAccountModal
          organization={organization}
          patients={patients}
          profile={profile}
          onSuccess={refresh}
        />
      )}

      {showLedgerModal && (
        <LedgerModal
          organization={organization}
          patients={patients}
          profile={profile}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
