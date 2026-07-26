import React from 'react';
import { 
  RiFolderUserLine, RiAddLine, RiSearchLine, RiWalletLine, RiArrowRightSLine
} from '@remixicon/react';
import { useWalletStore } from '@/lib/store/useWalletStore';
import { 
  createBillingAccount, depositToBillingAccount, updatePatientBillingAccount, 
  registerPatientAndGetId, logExternalCharge, fetchAccountLedger, generateSlipNumber 
} from '@/lib/store';
import { Patient, BillingAccount } from '@/lib/store';
import BillingAccountModal from './BillingAccountModal';
import LedgerModal from './LedgerModal';

const inputStyle = (error?: boolean) => ({
  width: '100%', padding: '0.65rem 1rem', borderRadius: 'var(--radius)',
  border: error ? '1px solid var(--red)' : '1px solid var(--gray-300)',
  fontSize: '0.82rem', fontFamily: 'var(--font-sans)', outline: 'none'
});

interface WalletTabProps {
  organization: any;
  patients: Patient[];
  profile: any;
  refresh: () => void;
}

export default function WalletTab({ organization, patients, profile, refresh }: WalletTabProps) {
  const { 
    billingAccounts, 
    billingSearchQuery, 
    showBillingAccountModal, 
    showLedgerModal,
    setBillingSearchQuery,
    setShowBillingAccountModal,
    resetAccountForm,
    openLedger
  } = useWalletStore();

  const handleOpenAccount = () => {
    resetAccountForm();
    setShowBillingAccountModal(true);
  };

  const filteredAccounts = billingAccounts.filter(acc => 
    acc.name.toLowerCase().includes(billingSearchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Main Action Hub Card */}
      <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <RiFolderUserLine size={20} color="var(--teal-600)" /> Client Accounts
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>Manage individual and family group deposit wallets, link dependents, and log department bills.</p>
          </div>
          <div>
            <button
              onClick={handleOpenAccount}
              style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.5rem 1rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s' }}
            >
              <RiAddLine size={16} /> Open Billing Account
            </button>
          </div>
        </div>

        {/* Accounts Directory */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', maxWidth: 400 }}>
          <input
            value={billingSearchQuery}
            onChange={e => setBillingSearchQuery(e.target.value)}
            placeholder="Search billing accounts..."
            style={inputStyle(false)}
          />
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Name</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Linked</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wallet Balance</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map(acc => {
                const linkedCount = patients.filter(p => p.billingAccountId === acc.id).length;
                const totalAvailable = acc.balance + acc.credit_limit;
                const isLow = totalAvailable < 5000 && acc.type !== 'corporate';
                
                return (
                  <tr key={acc.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--gray-900)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--teal-50)', color: 'var(--teal-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <RiFolderUserLine size={14} />
                        </div>
                        {acc.name}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--gray-600)', textTransform: 'capitalize' }}>{acc.type}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--gray-600)' }}>{linkedCount} members</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: isLow ? 'var(--red)' : 'var(--teal-700)' }}>
                        <RiWalletLine size={14} />
                        ₦{acc.balance.toLocaleString('en-NG')}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, background: totalAvailable > 0 ? '#dcfce7' : '#fee2e2', color: totalAvailable > 0 ? '#166534' : '#991b1b' }}>
                        {totalAvailable > 0 ? 'ACTIVE' : 'DEPLETED'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => openLedger(acc)}
                        style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.35rem 0.75rem', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: 'var(--gray-700)' }}
                      >
                        Manage <RiArrowRightSLine size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--gray-400)' }}>No billing wallets registered. Click "Open Billing Account" to register family/individual accounts.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
