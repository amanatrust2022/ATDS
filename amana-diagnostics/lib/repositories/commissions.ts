import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import { postJson } from './localHttp';

/**
 * Settlement of referral commission on a visit.
 *
 * Reporting is not here: building the commission report is a derivation over
 * data the other repositories already return, so it lives as a pure function in
 * lib/store/commissionReport.ts.
 */
export interface CommissionsRepository {
  markPaid(patientId: number | string, notes?: string): Promise<void>;
  markUnpaid(patientIds: (number | string)[]): Promise<void>;
}

const ENDPOINT = '/api/patients';

export const localCommissionsRepository: CommissionsRepository = {
  async markPaid(patientId, notes) {
    await postJson(ENDPOINT, { action: 'markCommissionPaid', patientId, notes }, 'Failed to mark commission paid locally');
  },

  async markUnpaid(patientIds) {
    await postJson(ENDPOINT, { action: 'markCommissionsUnpaid', patientIds }, 'Failed to mark commissions unpaid locally');
  },
};

export const cloudCommissionsRepository: CommissionsRepository = {
  async markPaid(patientId, notes) {
    const supabase = createClient();
    const { error } = await supabase.from('patients').update({
      commission_status: 'paid',
      commission_paid_at: new Date().toISOString(),
      commission_paid_notes: notes || null,
    }).eq('id', patientId);
    if (error) throw error;
  },

  async markUnpaid(patientIds) {
    const supabase = createClient();
    // Reversing a settlement clears the timestamp and note as well as the status,
    // so a re-paid commission cannot inherit the previous payment's details.
    const { error } = await supabase.from('patients').update({
      commission_status: 'pending',
      commission_paid_at: null,
      commission_paid_notes: null,
    }).in('id', patientIds);
    if (error) throw error;
  },
};

export const getCommissionsRepository = (mode: RuntimeMode = RUNTIME_MODE): CommissionsRepository =>
  mode === 'local' ? localCommissionsRepository : cloudCommissionsRepository;
