'use client';
import { useAuth } from '@/components/AuthProvider';
import { RiFileList2Line } from '@remixicon/react';
import TestManager from '@/components/TestManager';

export default function AdminTestsPage() {
  const { organization } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RiFileList2Line size={24} color="var(--teal-600)" /> Dynamic Test Catalogue
        </h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Add custom investigations, customize categories and specimens, and adjust reference ranges for all departments.
        </p>
      </div>

      <div style={{ padding: '0 2rem', maxWidth: 1200, margin: '0 auto' }}>
        {organization?.id ? (
          <TestManager organizationId={organization.id} />
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>
            Loading workspace details...
          </div>
        )}
      </div>
    </div>
  );
}
