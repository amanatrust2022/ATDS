import React from 'react';
import { RiWalletLine, RiErrorWarningLine, RiCheckLine } from '@remixicon/react';
import { BillingAccount } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { inputStyle } from './styles';
import { DiscountType } from '@/lib/store/registrationBilling';

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

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', fontWeight: 600,
  color: 'var(--gray-600)', marginBottom: '0.15rem',
};

const compactInput: React.CSSProperties = { ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' };

export default function BillingSummary({
  billingAccounts, linkedAccount, checkoutBillingAccountId, setCheckoutBillingAccountId,
  subtotal, discountAmount, netBill, balance, totalCommission, isReferral,
  saving, onRegister,
}: BillingSummaryProps) {
  const {
    discountType, discountValue, setDiscount,
    paymentMethod, setPaymentMethod, paidAmount, setPaidAmount,
  } = useRegistrationStore();

  return (
    <div style={{ borderTop: '1px solid var(--teal-100)', padding: '1rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--teal-800)', borderBottom: '1px solid rgba(13,148,136,0.1)', paddingBottom: '0.35rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Billing &amp; Checkout
      </h3>

      {/* Pay with Account Wallet Card */}
      {linkedAccount && (
        <div style={{
          background: 'linear-gradient(135deg, var(--teal-50) 0%, #f0fdfa 100%)',
          border: '1px solid var(--teal-200)',
          borderRadius: 6,
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          boxShadow: '0 2px 8px rgba(13,148,136,0.04)',
          marginBottom: '0.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--teal-800)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <RiWalletLine size={15} color="var(--teal-600)" /> Pay with Account Wallet
            </span>
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'var(--teal-600)',
              color: 'white',
              textTransform: 'uppercase'
            }}>
              Linked
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{linkedAccount.name}</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--teal-700)' }}>
              ₦{linkedAccount.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Subtotal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)', fontWeight: 600 }}>Subtotal</span>
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--gray-800)' }}>
          ₦{subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Discount Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
        <div>
          <label style={labelStyle}>Discount Type</label>
          <select
            style={compactInput}
            value={discountType}
            onChange={e => setDiscount(e.target.value as DiscountType, discountValue)}
          >
            <option value="none">No Discount</option>
            <option value="percentage">Percentage (%)</option>
            <option value="flat">Flat (₦)</option>
          </select>
        </div>
        {discountType !== 'none' && (
          <div>
            <label style={labelStyle}>
              Value {discountType === 'percentage' ? '(%)' : '(₦)'}
            </label>
            <input
              type="number"
              min="0"
              style={compactInput}
              placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 1000'}
              value={discountValue}
              onChange={e => setDiscount(discountType, e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Discount Amount (if any) */}
      {discountAmount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '0.35rem 0.5rem', border: '1px solid #fee2e2', borderRadius: 4 }}>
          <span style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>Discount Allowed</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b91c1c' }}>
            -₦{discountAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Net Bill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--gray-300)', paddingTop: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-800)', fontWeight: 700 }}>Net Bill</span>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--teal-700)' }}>
          ₦{netBill.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Paid Amount & Payment Method */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={labelStyle}>Amount Paid (₦)</label>
          <input
            type="number"
            min="0"
            style={compactInput}
            placeholder={netBill.toString()}
            value={paidAmount}
            onChange={e => setPaidAmount(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Payment Method</label>
          <select
            style={compactInput}
            value={paymentMethod}
            onChange={e => {
              setPaymentMethod(e.target.value);
              if (e.target.value === 'wallet' && !checkoutBillingAccountId && billingAccounts.length > 0) {
                // select first wallet by default if not set
                setCheckoutBillingAccountId(billingAccounts[0].id);
              }
            }}
          >
            <option value="cash">Cash</option>
            <option value="pos">POS</option>
            <option value="transfer">Bank Transfer</option>
            <option value="split">Split Payment</option>
            <option value="wallet">Account Wallet</option>
          </select>

          {paymentMethod === 'wallet' && (
            <div style={{ marginTop: '0.5rem' }}>
              <label style={labelStyle}>Select Wallet Account</label>
              <select
                style={compactInput}
                value={checkoutBillingAccountId}
                onChange={e => setCheckoutBillingAccountId(e.target.value)}
              >
                <option value="">-- Choose Wallet --</option>
                {billingAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (Bal: ₦{acc.balance.toLocaleString('en-NG')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {paymentMethod === 'wallet' && checkoutBillingAccountId && (() => {
            const acc = billingAccounts.find(a => a.id === checkoutBillingAccountId);
            if (!acc) return null;
            const isSufficient = (acc.balance + acc.credit_limit) >= netBill;
            return (
              <div style={{
                fontSize: '0.7rem',
                color: !isSufficient ? 'var(--red)' : '#27ae60',
                fontWeight: 600,
                marginTop: '0.25rem'
              }}>
                {!isSufficient ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <RiErrorWarningLine size={14} color="var(--red)" /> Insufficient Wallet Balance! Max credit allowed: ₦{(acc.balance + acc.credit_limit).toLocaleString('en-NG')}
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <RiCheckLine size={14} color="#27ae60" /> Wallet Balance covers invoice amount.
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Balance Due */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: balance > 0 ? '#fff7ed' : '#f0fdf4', padding: '0.4rem 0.6rem', border: `1px solid ${balance > 0 ? '#ffedd5' : '#bbf7d0'}`, borderRadius: 4 }}>
        <span style={{ fontSize: '0.72rem', color: balance > 0 ? '#c2410c' : '#15803d', fontWeight: 600 }}>
          {balance > 0 ? 'Balance Due (Unpaid)' : 'Payment Cleared'}
        </span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: balance > 0 ? '#c2410c' : '#15803d' }}>
          ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Referral Commission Summary (informative) */}
      {isReferral && totalCommission > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fefcf0', border: '1px solid #fef08a', padding: '0.4rem 0.6rem', borderRadius: 4 }}>
          <span style={{ fontSize: '0.72rem', color: '#a16207', fontWeight: 600 }}>
            Referral Commission
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a16207' }}>
            ₦{totalCommission.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={onRegister}
        disabled={saving}
        style={{
          background: 'var(--teal-700)', color: 'white', border: 'none',
          borderRadius: 'var(--radius)', padding: '0.65rem',
          fontSize: '0.82rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          marginTop: '0.25rem', letterSpacing: '0.02em',
          opacity: saving ? 0.7 : 1,
          transition: 'all 0.15s',
        }}
      >
        {saving ? 'Registering...' : (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
            <RiCheckLine size={16} /> Register &amp; Print Receipt
          </span>
        )}
      </button>
    </div>
  );
}
