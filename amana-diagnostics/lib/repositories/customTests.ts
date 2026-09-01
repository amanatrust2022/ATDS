import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import { postJson } from './localHttp';
import type { Test } from '@/lib/store';

/**
 * Organisation-authored tests, and organisation overrides of the built-in
 * catalogue.
 *
 * The two back ends store the same test differently, and each implementation
 * owns its own serialisation:
 *   local  — `parameters` as a JSON string, `is_active` as 0/1 (SQLite)
 *   cloud  — `parameters` as jsonb, `is_active` as boolean (Postgres)
 */
export interface CustomTestsRepository {
  list(organizationId: string): Promise<Test[]>;
  add(test: Omit<Test, 'is_active'> & { is_active?: boolean }, organizationId: string): Promise<void>;
  update(id: string, updates: Partial<Test>, organizationId: string): Promise<void>;
  remove(id: string, organizationId: string): Promise<void>;
}

const ENDPOINT = '/api/custom-tests';

/** The columns common to both back ends, before per-back-end encoding. */
const baseRow = (test: Omit<Test, 'is_active'> & { is_active?: boolean }, organizationId: string) => ({
  id: test.id,
  organization_id: organizationId,
  name: test.name,
  department: test.department,
  category: test.category,
  specimen: test.specimen,
  updated_at: new Date().toISOString(),
});

export const localCustomTestsRepository: CustomTestsRepository = {
  async list(organizationId) {
    const res = await fetch(`${ENDPOINT}?organizationId=${organizationId}`);
    if (!res.ok) return [];
    return res.json();
  },

  async add(test, organizationId) {
    const payload = {
      ...baseRow(test, organizationId),
      parameters: JSON.stringify(test.parameters),
      is_active: test.is_active === false ? 0 : 1,
    };
    await postJson(ENDPOINT, { action: 'add', test: payload, organizationId }, 'Failed to add custom test locally');
  },

  async update(id, updates, organizationId) {
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.department !== undefined) payload.department = updates.department;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.specimen !== undefined) payload.specimen = updates.specimen;
    if (updates.parameters !== undefined) payload.parameters = JSON.stringify(updates.parameters);
    if (updates.is_active !== undefined) payload.is_active = updates.is_active ? 1 : 0;

    await postJson(ENDPOINT, { action: 'update', id, updates: payload, organizationId }, 'Failed to update custom test locally');
  },

  async remove(id, organizationId) {
    await postJson(ENDPOINT, { action: 'delete', id, organizationId }, 'Failed to delete custom test locally');
  },
};

export const cloudCustomTestsRepository: CustomTestsRepository = {
  async list(organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('custom_tests')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) {
      console.error('Error fetching custom tests:', error);
      return [];
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      department: t.department,
      category: t.category,
      specimen: t.specimen,
      parameters: typeof t.parameters === 'string' ? JSON.parse(t.parameters) : t.parameters,
      is_active: t.is_active,
    }));
  },

  async add(test, organizationId) {
    const supabase = createClient();
    const { error } = await supabase
      .from('custom_tests')
      .insert([{
        ...baseRow(test, organizationId),
        parameters: test.parameters,
        is_active: test.is_active !== false,
      }]);
    if (error) throw error;
  },

  async update(id, updates, organizationId) {
    const supabase = createClient();
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.department !== undefined) payload.department = updates.department;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.specimen !== undefined) payload.specimen = updates.specimen;
    if (updates.parameters !== undefined) payload.parameters = updates.parameters;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;

    // upsert, not update: an override row does not exist until the first edit
    const { error } = await supabase
      .from('custom_tests')
      .upsert({ ...payload, id, organization_id: organizationId });
    if (error) throw error;
  },

  async remove(id, organizationId) {
    const supabase = createClient();
    const { error } = await supabase
      .from('custom_tests')
      .delete()
      .eq('organization_id', organizationId)
      .eq('id', id);
    if (error) throw error;
  },
};

export const getCustomTestsRepository = (mode: RuntimeMode = RUNTIME_MODE): CustomTestsRepository =>
  mode === 'local' ? localCustomTestsRepository : cloudCustomTestsRepository;
