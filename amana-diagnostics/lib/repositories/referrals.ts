import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import { postJson } from './localHttp';
import type { ReferringDoctor, ReferringFacility } from '@/lib/store';

/**
 * Data access for referring doctors and facilities.
 *
 * Components ask for a repository and call these methods; they do not decide
 * whether the app is talking to SQLite or Supabase. Adding a back end means
 * adding an implementation here, not another branch at every call site.
 */
export interface ReferralsRepository {
  listFacilities(organizationId: string): Promise<ReferringFacility[]>;
  addFacility(facility: Omit<ReferringFacility, 'id' | 'created_at'>, organizationId: string): Promise<ReferringFacility>;
  updateFacility(id: string, updates: Partial<ReferringFacility>): Promise<void>;
  deleteFacility(id: string): Promise<void>;

  listDoctors(organizationId: string): Promise<ReferringDoctor[]>;
  addDoctor(doctor: Omit<ReferringDoctor, 'id' | 'created_at' | 'facility_name'>, organizationId: string): Promise<ReferringDoctor>;
  updateDoctor(id: string, updates: Partial<ReferringDoctor>): Promise<void>;
  deleteDoctor(id: string): Promise<void>;
}

// ─── LOCAL (on-premise hub, via this app's API routes) ────────────────────────

type ReferralTarget = 'facility' | 'doctor';
type ReferralAction = 'add' | 'update' | 'delete';

/** Every local write goes to the same endpoint with a target/action envelope. */
const postReferral = (
  body: Record<string, unknown> & { target: ReferralTarget; action: ReferralAction },
  failureMessage: string,
): Promise<Response> => postJson('/api/referrals', body, failureMessage);

export const localReferralsRepository: ReferralsRepository = {
  async listFacilities(organizationId) {
    const res = await fetch(`/api/referrals?type=facilities&organizationId=${organizationId}`);
    return res.json();
  },

  async addFacility(facility, organizationId) {
    const res = await postReferral(
      { target: 'facility', action: 'add', facility, organizationId },
      'Failed to add referring facility locally',
    );
    return res.json();
  },

  async updateFacility(id, updates) {
    await postReferral({ target: 'facility', action: 'update', id, updates }, 'Failed to update referring facility locally');
  },

  async deleteFacility(id) {
    await postReferral({ target: 'facility', action: 'delete', id }, 'Failed to delete referring facility locally');
  },

  async listDoctors(organizationId) {
    const res = await fetch(`/api/referrals?type=doctors&organizationId=${organizationId}`);
    return res.json();
  },

  async addDoctor(doctor, organizationId) {
    const res = await postReferral(
      { target: 'doctor', action: 'add', doctor, organizationId },
      'Failed to add referring doctor locally',
    );
    return res.json();
  },

  async updateDoctor(id, updates) {
    await postReferral({ target: 'doctor', action: 'update', id, updates }, 'Failed to update referring doctor locally');
  },

  async deleteDoctor(id) {
    await postReferral({ target: 'doctor', action: 'delete', id }, 'Failed to delete referring doctor locally');
  },
};

// ─── CLOUD (Supabase, under RLS) ──────────────────────────────────────────────

export const cloudReferralsRepository: ReferralsRepository = {
  async listFacilities(organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('referring_facilities')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });
    if (error) { console.error('fetchReferringFacilities error:', error); return []; }
    return data || [];
  },

  async addFacility(facility, organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('referring_facilities')
      .insert([{ ...facility, organization_id: organizationId }])
      .select().single();
    if (error) throw error;
    return data as ReferringFacility;
  },

  async updateFacility(id, updates) {
    const supabase = createClient();
    const { error } = await supabase.from('referring_facilities').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteFacility(id) {
    const supabase = createClient();
    const { error } = await supabase.from('referring_facilities').delete().eq('id', id);
    if (error) throw error;
  },

  async listDoctors(organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('referring_doctors')
      .select('*, referring_facilities(name)')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });
    if (error) { console.error('fetchReferringDoctors error:', error); return []; }
    return (data || []).map((d: any) => ({ ...d, facility_name: d.referring_facilities?.name }));
  },

  async addDoctor(doctor, organizationId) {
    const supabase = createClient();
    // facility_name is a joined column, never a writable one
    const { facility_name, ...rest } = doctor as any;
    const { data, error } = await supabase
      .from('referring_doctors')
      .insert([{ ...rest, organization_id: organizationId }])
      .select().single();
    if (error) throw error;
    return data as ReferringDoctor;
  },

  async updateDoctor(id, updates) {
    const supabase = createClient();
    const { facility_name, ...rest } = updates as any;
    const { error } = await supabase.from('referring_doctors').update(rest).eq('id', id);
    if (error) throw error;
  },

  async deleteDoctor(id) {
    const supabase = createClient();
    const { error } = await supabase.from('referring_doctors').delete().eq('id', id);
    if (error) throw error;
  },
};

export const getReferralsRepository = (mode: RuntimeMode = RUNTIME_MODE): ReferralsRepository =>
  mode === 'local' ? localReferralsRepository : cloudReferralsRepository;
