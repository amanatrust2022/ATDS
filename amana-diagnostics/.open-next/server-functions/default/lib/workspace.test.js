import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrganizationWithFallback } from './workspace.js';

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

  assert.equal(result.organization.id, 'org-123');
  assert.equal(result.created, false);
  assert.deepEqual(calls, ['rpc', 'select:organizations']);
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

  assert.equal(result.organization.id, 'org-456');
  assert.equal(result.created, true);
  assert.deepEqual(calls, ['rpc', 'select:organizations', 'insert:organizations', 'update:profiles']);
});
