import React from 'react';
import { RiWalletLine, RiErrorWarningLine, RiCheckLine } from '@remixicon/react';
import { BillingAccount } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { DiscountType } from '@/lib/store/registrationBilling';
import { Badge, Button, Field, Input, Select } from '@/components/ui';

import styles from './billing.module.css';

interface BillingSummaryProps {
  billingAccounts: BillingAccount[];
  linkedAccount: BillingAccount | null;
  checkoutBillingAccountId: string;
  setCheckoutBillingAccountId: (id: string) => void;

  subtotal: number;
  discountAmount: number;
  netBill: number;
  balance: number;
  totalCommission: number;
  isReferral: boolean;

  saving: boolean;
  onRegister: () => void;
}

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

/**
 * The checkout panel at the foot of registration: what the visit costs, what
 * was taken off, what was paid and how, and what is still owed.
 *
 * Five fields had labels attached to nothing. The wallet shortfall was a line
 * of red text that nothing announced, so a cashier not looking at that corner
 * found out at submit — after telling the patient the wallet would cover it.
 */
export default function BillingSummary({
  billingAccounts, linkedAccount, checkoutBillingAccountId, setCheckoutBillingAccountId,
  subtotal, discountAmount, netBill, balance, totalCommission, isReferral,
  saving, onRegister,
}: BillingSummaryProps) {
  const {
    discountType, discountValue, setDiscount,
    paymentMethod, setPaymentMethod, paidAmount, setPaidAmount,
  } = useRegistrationStore();

  const walletAccount = paymentMethod === 'wallet' && checkoutBillingAccountId
    ? billingAccounts.find((a) => a.id === checkoutBillingAccountId) ?? null
    : null;
  const walletCovers = walletAccount ? walletAccount.balance + walletAccount.credit_limit >= netBill : true;

  return (
    <div className={styles['panel']}>
      <h3 className={styles['title']}>Billing &amp; Checkout</h3>

      {linkedAccount && (
        <div className={styles['wallet']}>
          <div className={styles['walletHead']}>
            <span className={styles['walletTitle']}>
              <RiWalletLine size={15} aria-hidden="true" /> Pay with Account Wallet
            </span>
            <Badge tone="accent">Linked</Badge>
          </div>
          <div className={styles['walletRow']}>
            <span className={styles['walletName']}>{linkedAccount.name}</span>
            <span className={styles['walletBalance']}>{naira(linkedAccount.balance)}</span>
          </div>
        </div>
      )}

      <div className={styles['line']}>
        <span className={styles['lineLabel']}>Subtotal</span>
        <span className={styles['lineValue']}>{naira(subtotal)}</span>
      </div>

      <div className={`${styles['pair']} ${styles['pairWide']}`}>
        <Field label="Discount type">
          <Select
            value={discountType}
            onChange={(e) => setDiscount(e.target.value as DiscountType, discountValue)}
          >
            <option value="none">No Discount</option>
            <option value="percentage">Percentage (%)</option>
            <option value="flat">Flat (₦)</option>
          </Select>
        </Field>
        {discountType !== 'none' && (
          <Field label={`Discount value ${discountType === 'percentage' ? '(%)' : '(₦)'}`}>
            <Input
              type="number"
              min="0"
              placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 1000'}
              value={discountValue}
              onChange={(e) => setDiscount(discountType, e.target.value)}
            />
          </Field>
        )}
      </div>

      {discountAmount > 0 && (
        <div className={`${styles['line']} ${styles['note']} ${styles['noteDiscount']}`}>
          <span className={styles['lineLabel']}>Discount Allowed</span>
          <span className={styles['lineValue']}>-{naira(discountAmount)}</span>
        </div>
      )}

      <div className={`${styles['line']} ${styles['net']}`}>
        <span className={styles['lineLabel']}>Net Bill</span>
        <span className={styles['lineValue']}>{naira(netBill)}</span>
      </div>

      <div className={styles['pair']}>
        <Field label="Amount paid (₦)">
          <Input
            type="number"
            min="0"
            placeholder={netBill.toString()}
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
          />
        </Field>

        <div className={styles['stack']}>
          <Field label="Payment method">
            <Select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                if (e.target.value === 'wallet' && !checkoutBillingAccountId && billingAccounts.length > 0) {
                  // select first wallet by default if not set
                  setCheckoutBillingAccountId(billingAccounts[0]!.id);
                }
              }}
            >
              <option value="cash">Cash</option>
              <option value="pos">POS</option>
              <option value="transfer">Bank Transfer</option>
              <option value="split">Split Payment</option>
              <option value="wallet">Account Wallet</option>
            </Select>
          </Field>

          {paymentMethod === 'wallet' && (
            <Field label="Select Wallet Account">
              <Select
                value={checkoutBillingAccountId}
                onChange={(e) => setCheckoutBillingAccountId(e.target.value)}
              >
                <option value="">-- Choose Wallet --</option>
                {billingAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (Bal: ₦{acc.balance.toLocaleString('en-NG')})
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {/* Said as it appears, not only coloured. */}
          {walletAccount && (walletCovers ? (
            <p className={`${styles['cover']} ${styles['coverOk']}`} role="status">
              <RiCheckLine size={14} aria-hidden="true" /> Wallet Balance covers invoice amount.
            </p>
          ) : (
            <p className={`${styles['cover']} ${styles['coverShort']}`} role="alert">
              <RiErrorWarningLine size={14} aria-hidden="true" /> Insufficient Wallet Balance! Max credit
              allowed: ₦{(walletAccount.balance + walletAccount.credit_limit).toLocaleString('en-NG')}
            </p>
          ))}
        </div>
      </div>

      <div
        className={`${styles['line']} ${styles['note']} ${balance > 0 ? styles['noteDue'] : styles['noteCleared']}`}
        role="status"
      >
        <span className={styles['lineLabel']}>{balance > 0 ? 'Balance Due (Unpaid)' : 'Payment Cleared'}</span>
        <span className={styles['lineValue']}>{naira(balance)}</span>
      </div>

      {isReferral && totalCommission > 0 && (
        <div className={`${styles['line']} ${styles['note']} ${styles['noteCommission']}`}>
          <span className={styles['lineLabel']}>Referral Commission</span>
          <span className={styles['lineValue']}>{naira(totalCommission)}</span>
        </div>
      )}

      <Button
        intent="primary"
        className={styles['submit']}
        onClick={onRegister}
        loading={saving}
        icon={<RiCheckLine size={16} />}
      >
        {saving ? 'Registering...' : 'Register & Print Receipt'}
      </Button>
    </div>
  );
}
