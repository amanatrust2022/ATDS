import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import type { AuditEntry } from '@/lib/audit';
import { getJson, postJson } from './localHttp';

/**
 * Where audit rows are kept.
 *
 * On a hub the row goes into SQLite through `/api/audit`, which also queues
 * it for the cloud. On the web it goes straight into Supabase under the
 * signed-in administrator's own session, which row-level security scopes to
 * their clinic.
 *
 * Reads return [] on failure, as every other repository's reads do: a log
 * that cannot be fetched is an empty screen, not a broken one. Writes throw,
 * and the screens that call them decide whether a missing audit row should
 * stop the change (it should not) or merely be reported.
 */
export interface AuditQuery {
  since?: string;
  action?: string;
  limit?: number;
}

export interface AuditRepository {
  record(entry: AuditEntry): Promise<void>;
  list(organizationId: string, query?: AuditQuery): Promise<AuditEntry[]>;
}

const ENDPOINT = '/api/audit';
const DEFAULT_LIMIT = 200;

export const localAuditRepository: AuditRepository = {
  async record(entry) {
    await postJson(ENDPOINT, entry as unknown as Record<string, unknown>, 'Failed to record the audit entry locally');
  },

  async list(organizationId, query = {}) {
    const params = new URLSearchParams({ organizationId });
    if (query.since) params.set('since', query.since);
    if (query.action) params.set('action', query.action);
    params.set('limit', String(query.limit ?? DEFAULT_LIMIT));
    try {
      const rows = await getJson<AuditEntry[]>(`${ENDPOINT}?${params.toString()}`, true);
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      console.error('Failed to fetch the audit log locally:', err);
      return [];
    }
  },
};

export const cloudAuditRepository: AuditRepository = {
  async record(entry) {
    const supabase = createClient();
    const { error } = await supabase.from('audit_log').insert(entry);
    if (error) throw error;
  },

  async list(organizationId, query = {}) {
    const supabase = createClient();
    let q = supabase
      .from('audit_log')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(query.limit ?? DEFAULT_LIMIT);
    if (query.since) q = q.gte('created_at', query.since);
    if (query.action) q = q.eq('action', query.action);
    const { data, error } = await q;
    if (error) {
      console.error('Failed to fetch the audit log:', error);
      return [];
    }
    return (data ?? []) as AuditEntry[];
  },
};

export const getAuditRepository = (mode: RuntimeMode = RUNTIME_MODE): AuditRepository =>
  mode === 'local' ? localAuditRepository : cloudAuditRepository;
