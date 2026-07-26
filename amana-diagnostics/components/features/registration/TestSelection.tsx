import React from 'react';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { RiCloseLine } from '@remixicon/react';

export default function TestSelection() {
  const { selectedTests, removeTest } = useRegistrationStore();

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Selected Tests</h3>
      <div className="space-y-2 mb-4">
        {selectedTests.length === 0 ? (
          <p className="text-sm text-gray-500">No tests selected.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md">
            {selectedTests.map((testId) => (
              <li key={testId} className="flex justify-between items-center p-2 text-sm">
                <span>{testId}</span>
                <button 
                  onClick={() => removeTest(testId)}
                  className="text-red-500 hover:text-red-700"
                >
                  <RiCloseLine size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="w-full flex justify-center py-2 px-4 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Add Test
      </button>
    </div>
  );
}
