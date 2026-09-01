import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BillingSummary from './BillingSummary';
import { BillingAccount } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';

const account: BillingAccount = {
  id: 'acc-1', organization_id: 'org-1', name: 'Dangote Staff Scheme',
  balance: 50000, credit_limit: 10000,
} as BillingAccount;

const poorAccount: BillingAccount = { ...account, id: 'acc-2', name: 'Small Wallet', balance: 100, credit_limit: 0 };

const setup = (over: Partial<React.ComponentProps<typeof BillingSummary>> = {}) => {
  const props: React.ComponentProps<typeof BillingSummary> = {
    billingAccounts: [account, poorAccount],
    linkedAccount: null,
    checkoutBillingAccountId: '',
    setCheckoutBillingAccountId: vi.fn(),
    subtotal: 17000,
    discountAmount: 0,
    netBill: 17000,
    balance: 0,
    totalCommission: 0,
    isReferral: false,
    saving: false,
    onRegister: vi.fn(),
    ...over,
  };
  render(<BillingSummary {...props} />);
  return props;
};

beforeEach(() => {
  useRegistrationStore.getState().resetForm();
});

describe('Feature: Registration checkout', () => {
  it('shows the subtotal and the net bill the patient actually owes', () => {
    setup({ subtotal: 17000, discountAmount: 2550, netBill: 14450 });

    expect(screen.getByText('₦17,000.00')).toBeInTheDocument();
    expect(screen.getByText('₦14,450.00')).toBeInTheDocument();
  });

  it('hides the discount value box until a discount type is chosen', () => {
    setup();

    expect(screen.queryByPlaceholderText('e.g. 10')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('No Discount'), { target: { value: 'percentage' } });

    expect(screen.getByPlaceholderText('e.g. 10')).toBeInTheDocument();
  });

  // Regression: this input called a setDiscountValue that does not exist, so
  // the receptionist could pick a discount type but never enter an amount.
  it('records the discount amount the receptionist types', () => {
    setup();

    fireEvent.change(screen.getByDisplayValue('No Discount'), { target: { value: 'percentage' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 10'), { target: { value: '15' } });

    expect(useRegistrationStore.getState().discountValue).toBe('15');
    expect(useRegistrationStore.getState().discountType).toBe('percentage');
  });

  it('keeps the entered amount when the discount type is switched', () => {
    setup();

    fireEvent.change(screen.getByDisplayValue('No Discount'), { target: { value: 'percentage' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 10'), { target: { value: '15' } });
    fireEvent.change(screen.getByDisplayValue('Percentage (%)'), { target: { value: 'flat' } });

    expect(useRegistrationStore.getState().discountValue).toBe('15');
    expect(useRegistrationStore.getState().discountType).toBe('flat');
  });

  it('shows what was taken off when a discount applies', () => {
    setup({ discountAmount: 2550, netBill: 14450 });

    expect(screen.getByText('Discount Allowed')).toBeInTheDocument();
    expect(screen.getByText('-₦2,550.00')).toBeInTheDocument();
  });

  it('records the amount paid', () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText('17000'), { target: { value: '10000' } });

    expect(useRegistrationStore.getState().paidAmount).toBe('10000');
  });

  it('flags an outstanding balance as unpaid', () => {
    setup({ balance: 7000 });

    expect(screen.getByText('Balance Due (Unpaid)')).toBeInTheDocument();
  });

  it('confirms payment is cleared when nothing is outstanding', () => {
    setup({ balance: 0 });

    expect(screen.getByText('Payment Cleared')).toBeInTheDocument();
  });

  it('registers the patient when the submit button is pressed', () => {
    const onRegister = vi.fn();
    setup({ onRegister });

    fireEvent.click(screen.getByRole('button', { name: /Register & Print Receipt/i }));

    expect(onRegister).toHaveBeenCalled();
  });

  it('blocks a second submission while the first is saving', () => {
    setup({ saving: true });

    expect(screen.getByRole('button', { name: /Registering/i })).toBeDisabled();
  });
});

describe('Feature: Paying from an account wallet', () => {
  it('does not ask which wallet until wallet payment is chosen', () => {
    setup();

    expect(screen.queryByText('Select Wallet Account')).not.toBeInTheDocument();
  });

  it('offers the organisation wallets once wallet payment is chosen', () => {
    setup();

    fireEvent.change(screen.getByDisplayValue('Cash'), { target: { value: 'wallet' } });

    expect(screen.getByText('Select Wallet Account')).toBeInTheDocument();
    expect(screen.getByText(/Dangote Staff Scheme/)).toBeInTheDocument();
  });

  it('defaults to the first wallet so the cashier is not left with an empty selection', () => {
    const setCheckoutBillingAccountId = vi.fn();
    setup({ setCheckoutBillingAccountId });

    fireEvent.change(screen.getByDisplayValue('Cash'), { target: { value: 'wallet' } });

    expect(setCheckoutBillingAccountId).toHaveBeenCalledWith('acc-1');
  });

  it('confirms when the wallet covers the bill', () => {
    useRegistrationStore.getState().setPaymentMethod('wallet');
    setup({ checkoutBillingAccountId: 'acc-1' });

    expect(screen.getByText(/Wallet Balance covers invoice amount/)).toBeInTheDocument();
  });

  it('warns when the wallet and its credit limit fall short', () => {
    useRegistrationStore.getState().setPaymentMethod('wallet');
    setup({ checkoutBillingAccountId: 'acc-2' });

    expect(screen.getByText(/Insufficient Wallet Balance/)).toBeInTheDocument();
  });

  it('shows the linked wallet and its balance when the patient has one', () => {
    setup({ linkedAccount: account });

    expect(screen.getByText('Pay with Account Wallet')).toBeInTheDocument();
    expect(screen.getByText('₦50,000.00')).toBeInTheDocument();
  });
});

describe('Feature: Referral commission', () => {
  it('shows the commission owed on a referred visit', () => {
    setup({ isReferral: true, totalCommission: 2000 });

    expect(screen.getByText('Referral Commission')).toBeInTheDocument();
    expect(screen.getByText('₦2,000.00')).toBeInTheDocument();
  });

  it('stays hidden on a walk-in visit', () => {
    setup({ isReferral: false, totalCommission: 2000 });

    expect(screen.queryByText('Referral Commission')).not.toBeInTheDocument();
  });
});
