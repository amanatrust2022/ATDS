import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import { postJson } from './localHttp';
import type { RadiologyTemplate } from '@/lib/store';

/** Organisation-authored report templates for radiology. */
export interface RadiologyTemplatesRepository {
  list(organizationId: string): Promise<RadiologyTemplate[]>;
  add(template: Omit<RadiologyTemplate, 'id' | 'created_at'>, userId?: string): Promise<RadiologyTemplate>;
  update(id: string, updates: Partial<RadiologyTemplate>): Promise<void>;
  remove(id: string): Promise<void>;
}

const ENDPOINT = '/api/radiology-templates';

export const localRadiologyTemplatesRepository: RadiologyTemplatesRepository = {
  async list(organizationId) {
    const res = await fetch(`${ENDPOINT}?organizationId=${organizationId}`);
    return res.json();
  },

  async add(template, userId) {
    const res = await postJson(ENDPOINT, { action: 'add', template, userId }, 'Failed to add template locally');
    return res.json();
  },

  async update(id, updates) {
    await postJson(ENDPOINT, { action: 'update', id, updates }, 'Failed to update template locally');
  },

  async remove(id) {
    await postJson(ENDPOINT, { action: 'delete', id }, 'Failed to delete template locally');
  },
};

export const cloudRadiologyTemplatesRepository: RadiologyTemplatesRepository = {
  async list(organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('radiology_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });
    if (error) { console.error('fetchCustomTemplates error:', error); return []; }
    return data || [];
  },

  async add(template, userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('radiology_templates')
      .insert([{ ...template, created_by: userId }])
      .select()
      .single();
    if (error) throw error;
    return data as RadiologyTemplate;
  },

  async update(id, updates) {
    const supabase = createClient();
    // Only the authored fields are writable; ownership and timestamps are not.
    const { error } = await supabase
      .from('radiology_templates')
      .update({
        key: updates.key,
        name: updates.name,
        findings: updates.findings,
        impression: updates.impression,
      })
      .eq('id', id);
    if (error) throw error;
  },

  async remove(id) {
    const supabase = createClient();
    const { error } = await supabase
      .from('radiology_templates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export const getRadiologyTemplatesRepository = (mode: RuntimeMode = RUNTIME_MODE): RadiologyTemplatesRepository =>
  mode === 'local' ? localRadiologyTemplatesRepository : cloudRadiologyTemplatesRepository;
