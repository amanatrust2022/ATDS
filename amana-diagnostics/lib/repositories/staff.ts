import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import { getJson } from './localHttp';

/**
 * The people who work here.
 *
 * Three screens used to fetch this themselves — the overview, the staff
 * directory and the performance report — each with its own branch on the
 * runtime mode and its own idea of what to do when the read failed. One
 * read, here; the screens ask for the list.
 */
export interface StaffMember {
  id: string;
  full_name: string | null;
  first_name?: string | null;
  surname?: string | null;
  last_name?: string | null;
  email: string | null;
  role: string | null;
  role_label?: string | null;
  performance_commission_type?: 'none' | 'percentage' | 'flat' | null;
  performance_commission_value?: number | null;
  title?: string | null;
  signature_url?: string | null;
  created_at?: string | null;
}

export interface StaffRepository {
  list(organizationId: string): Promise<StaffMember[]>;
}

export const localStaffRepository: StaffRepository = {
  async list(organizationId) {
    try {
      const rows = await getJson<StaffMember[]>(`/api/profiles?organizationId=${organizationId}`, true);
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      console.error('Failed to fetch staff locally:', err);
      return [];
    }
  },
};

export const cloudStaffRepository: StaffRepository = {
  async list(organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to fetch staff:', error);
      return [];
    }
    return (data ?? []) as StaffMember[];
  },
};

export const getStaffRepository = (mode: RuntimeMode = RUNTIME_MODE): StaffRepository =>
  mode === 'local' ? localStaffRepository : cloudStaffRepository;
