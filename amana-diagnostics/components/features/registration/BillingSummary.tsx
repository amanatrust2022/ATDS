import React from 'react';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { TestPrice } from '@/lib/store';

// We mock testPrices here for the UI component, in reality we'd pass it down or fetch it
const MOCK_PRICES: TestPrice[] = [];

export default function BillingSummary() {
  const { 
    discountType, 
    discountValue, 
    setDiscount,
    paymentMethod,
    setPaymentMethod,
    paidAmount,
    setPaidAmount,
    calculateTotal,
    calculateDiscountAmount
  } = useRegistrationStore();

  const subtotal = calculateTotal(MOCK_PRICES);
  const discountAmount = calculateDiscountAmount(subtotal);
  const total = subtotal - discountAmount;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
      <h3 className="text-lg font-semibold mb-4">Billing & Payment</h3>
      
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-500">Subtotal</span>
        <span className="font-medium">₦{subtotal.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-700">Discount Type</label>
          <select
            value={discountType}
            onChange={(e) => setDiscount(e.target.value as any, discountValue)}
            className="mt-1 block w-full rounded-md border-gray-300 text-sm"
          >
            <option value="none">None</option>
            <option value="flat">Flat Amount</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Value</label>
          <input
            type="number"
            value={discountValue}
            onChange={(e) => setDiscount(discountType, e.target.value)}
            disabled={discountType === 'none'}
            className="mt-1 block w-full rounded-md border-gray-300 text-sm disabled:bg-gray-100"
          />
        </div>
      </div>

      {discountType !== 'none' && (
        <div className="flex justify-between text-sm mb-2 text-green-600">
          <span>Discount Applied</span>
          <span>-₦{discountAmount.toFixed(2)}</span>
        </div>
      )}

      <div className="flex justify-between text-lg font-bold border-t pt-2 mb-4">
        <span>Total</span>
        <span>₦{total.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-700">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 text-sm"
          >
            <option value="cash">Cash</option>
            <option value="pos">POS</option>
            <option value="transfer">Transfer</option>
            <option value="hmo">HMO</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Amount Paid</label>
          <input
            type="number"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
