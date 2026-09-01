import { test, expect } from 'vitest';
import { buildFallbackProfile, createOrganizationWithFallback, upsertProfileForUser } from './workspace.js';

test('upserts a profile row for the authenticated user', async () => {
  const calls = [];
  const supabase = {
    from: (table) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        upsert: (payload, options) => {
          calls.push({ table, payload, options });
          return {
            select: () => ({
              maybeSingle: async () => ({ data: { id: payload.id }, error: null }),
            }),
          };
        },
      };
    },
  };

  await upsertProfileForUser(supabase, 'user-1', {
    full_name: 'Ada Lovelace',
    role: 'admin',
    organization_id: 'org-1',
    email: 'ada@example.com',
  });

  expect(calls[0].payload.id).toBe('user-1');
  expect(calls[0].options.onConflict).toBe('id');
  expect(calls[0].payload.organization_id).toBe('org-1');
});

test('reuses an existing organization when the slug already exists', async () => {
  const calls = [];
  const supabase = {
    rpc: async () => {
      calls.push('rpc');
      return { error: new Error('rpc failed'), data: null };
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls.push(`select:${table}`);
            return {
              data: { id: 'org-123', slug: 'demo-clinic' },
              error: null,
            };
          },
        }),
      }),
    }),
  };

  const result = await createOrganizationWithFallback(supabase, {
    name: 'Demo Clinic',
    slug: 'demo-clinic',
    address: '',
    phone: '',
    email: '',
    letterheadLine2: '',
  });

  expect(result.organization.id).toBe('org-123');
  expect(result.created).toBe(false);
  expect(calls).toEqual(['rpc', 'select:organizations']);
});

test('creates a new organization when no matching slug exists', async () => {
  const calls = [];
  const supabase = {
    rpc: async () => {
      calls.push('rpc');
      return { error: new Error('rpc failed'), data: null };
    },
    from: (table) => {
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                calls.push('select:organizations');
                return { data: null, error: null };
              },
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => {
                calls.push('insert:organizations');
                return {
                  data: { id: 'org-456', slug: 'new-clinic' },
                  error: null,
                };
              },
            }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          update: () => ({
            eq: async () => {
              calls.push('update:profiles');
              return { data: null, error: null };
            },
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const result = await createOrganizationWithFallback(supabase, {
    name: 'New Clinic',
    slug: 'new-clinic',
    address: '',
    phone: '',
    email: '',
    letterheadLine2: '',
  }, { userId: 'user-1' });

  expect(result.organization.id).toBe('org-456');
  expect(result.created).toBe(true);
  expect(calls).toEqual(['rpc', 'select:organizations', 'insert:organizations', 'update:profiles']);
});

test('builds a fallback profile payload from auth metadata when no profile row exists', () => {
  const profile = buildFallbackProfile({
    id: 'user-1',
    email: 'ada@example.com',
    user_metadata: {
      full_name: 'Ada Lovelace',
      role: 'admin',
      organization_id: 'org-1',
    },
  });

  expect(profile).toEqual({
    id: 'user-1',
    email: 'ada@example.com',
    full_name: 'Ada Lovelace',
    role: 'admin',
    organization_id: 'org-1',
  });
});

test('falls back to the server profile endpoint when direct Supabase upsert is blocked', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {};
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ success: true, data: { id: 'user-2' } }),
    };
  };

  const supabase = {
    from: () => ({
      upsert: () => {
        throw new Error('RLS denied');
      },
    }),
  };

  const result = await upsertProfileForUser(supabase, 'user-2', {
    full_name: 'Grace Hopper',
    role: 'admin',
    organization_id: 'org-2',
    email: 'grace@example.com',
  });

  expect(result).toEqual({ id: 'user-2' });
  expect(calls.length).toBe(1);
  expect(calls[0].url).toMatch(/\/api\/auth\/profile$/);

  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
});
