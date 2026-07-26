import React from 'react';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';

export default function ReferralSelection() {
  const form = useRegistrationStore((state) => state.form);
  const setForm = useRegistrationStore((state) => state.setForm);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
      <h3 className="text-lg font-semibold mb-4">Referral Information</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Referring Doctor</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={form.referredBy || 'None selected'}
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <button
              type="button"
              className="mt-1 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Select
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Referring Facility</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={form.referringFacility || 'None selected'}
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <button
              type="button"
              className="mt-1 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
