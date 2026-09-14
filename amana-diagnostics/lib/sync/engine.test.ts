import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { fakeCloud } from './fakeCloud';

/**
 * The engine, with the hub database in memory, the cloud a stand-in, and the
 * clock under control. What is asserted is the behaviour the old
 * browser-driven sync got wrong: that a pull happens even when the push
 * cannot, that "offline" and "signed out" are decided in one place, and
 * that concurrent requests become one run.
 */

const ORG = '11111111-1111-1111-1111-111111111111';

let db: DatabaseSync;
let cloud: ReturnType<typeof fakeCloud>;
let pingResponse: () => Promise<Response>;

vi.mock('@/lib/localDb', async () => {
  const actual = await vi.importActual<typeof import('@/lib/localDb')>('@/lib/localDb');
  return { ...actual, getDb: () => db };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => cloud.from(table),
    realtime: { setAuth: () => {}, disconnect: () => {} },
    channel: () => {
      const ch: any = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: () => {},
  }),
}));

// A signed JWT is not needed; the engine only reads `exp` from the payload.
const token = (expSecondsFromNow = 3600) =>
  `h.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })).toString('base64url')}.s`;

const okPing = () => Promise.resolve(new Response('[]', { status: 200, headers: { date: new Date().toUTCString() } }));

let engine: typeof import('./engine');

beforeEach(async () => {
  vi.useFakeTimers();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://cloud.example';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.IS_LOCAL_HUB = 'true';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { initDb } = await vi.importActual<typeof import('@/lib/localDb')>('@/lib/localDb');
  db = new DatabaseSync(':memory:');
  initDb(db);
  cloud = fakeCloud({});
  pingResponse = okPing;
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (String(url).includes('/rest/v1/organizations')) return pingResponse();
    return Promise.resolve(new Response('{}', { status: 200 }));
  }));

  engine = await import('./engine');
  engine._resetSyncEngineForTests();
});

afterEach(() => {
  engine._resetSyncEngineForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Asks for a run and lets the coalescing window and the run itself play out. */
async function runOnce(reason = 'test') {
  const p = engine.requestSync(reason);
  await vi.advanceTimersByTimeAsync(engine.SYNC_COALESCE_MS + 5);
  return p;
}

describe('the sync engine', () => {
  it('is signed out, and touches nothing, with nobody to act as', async () => {
    engine.startSyncEngine();
    engine.provideSession(ORG, null);
    cloud.data.patients = [{ id: 1, organization_id: ORG, first_name: 'A', surname: 'B', updated_at: '2026-09-12T10:00:00+00:00' }];

    const state = await runOnce();

    expect(state.status).toBe('signed_out');
    expect(db.prepare('SELECT COUNT(*) AS n FROM patients').get()).toEqual({ n: 0 });
  });

  it('is offline when the cloud does not answer, and backs off', async () => {
    engine.startSyncEngine();
    engine.provideSession(ORG, token());
    pingResponse = () => Promise.reject(new TypeError('fetch failed'));

    const state = await runOnce();

    expect(state.connectivity).toBe('offline');
    expect(state.status).toBe('offline');
    expect(state.nextRunInMs).toBe(engine.SYNC_INTERVAL_MS * 2);
  });

  it('pulls even when the push is stalled', async () => {
    engine.startSyncEngine();
    engine.provideSession(ORG, token());
    // A row the cloud keeps refusing (a foreign key it cannot satisfy).
    cloud = fakeCloud(
      { patients: [{ id: 9, organization_id: ORG, first_name: 'From', surname: 'Web', updated_at: '2026-09-12T10:00:00+00:00' }] },
      { failing: { patient_tests: { message: 'violates foreign key' } } },
    );
    const { queueSync } = await vi.importActual<typeof import('@/lib/localDb')>('@/lib/localDb');
    queueSync(db, 'patient_tests', 'INSERT', 't1', { id: 't1', organization_id: ORG });

    const state = await runOnce();

    expect(state.connectivity).toBe('online');
    expect(state.pendingCount).toBe(1);
    expect(state.lastError).toContain('foreign key');
    // The web-side patient still arrived.
    expect(db.prepare('SELECT first_name FROM patients WHERE id = 9').get()).toEqual({ first_name: 'From' });
  });

  it('pushes what the hub wrote, and the badge reads synced', async () => {
    engine.startSyncEngine();
    engine.provideSession(ORG, token());
    const { queueSync } = await vi.importActual<typeof import('@/lib/localDb')>('@/lib/localDb');
    queueSync(db, 'patients', 'INSERT', '3', { id: 3, organization_id: ORG, first_name: 'Hub', surname: 'Side' });

    const state = await runOnce();

    expect(cloud.data.patients?.map((p) => p.id)).toEqual([3]);
    expect(state.status).toBe('synced');
    expect(state.pendingCount).toBe(0);
    expect(state.initialSyncDone).toBe(true);
  });

  it('folds simultaneous requests into one run', async () => {
    engine.startSyncEngine();
    engine.provideSession(ORG, token());
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    const [a, b, c] = await Promise.all([
      engine.requestSync('a'),
      engine.requestSync('b'),
      engine.requestSync('c'),
      vi.advanceTimersByTimeAsync(engine.SYNC_COALESCE_MS + 5),
    ]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    const pings = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/rest/v1/organizations'));
    expect(pings).toHaveLength(1);
  });

  it('remembers the clinic so it can run before any browser is open', async () => {
    engine.startSyncEngine();
    engine.provideSession(ORG, token());
    const row = db.prepare("SELECT value FROM sync_metadata WHERE key = 'hub_organization_id'").get() as any;
    expect(row.value).toBe(ORG);
  });

  it('runs at once when the hub writes', async () => {
    engine.startSyncEngine();
    engine.provideSession(ORG, token());
    await runOnce('settle');
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    const { queueSync } = await vi.importActual<typeof import('@/lib/localDb')>('@/lib/localDb');
    queueSync(db, 'patients', 'INSERT', '4', { id: 4, organization_id: ORG, first_name: 'X', surname: 'Y' });
    await vi.advanceTimersByTimeAsync(engine.SYNC_COALESCE_MS + 50);

    expect(cloud.data.patients?.some((p) => p.id === 4)).toBe(true);
  });

  it('declines to start on the cloud deployment', () => {
    delete process.env.IS_LOCAL_HUB;
    delete process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE;
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const state = engine.startSyncEngine();
      expect(state.enabled).toBe(false);
      expect(state.status).toBe('disabled');
    } finally {
      env.NODE_ENV = prev;
    }
  });
});
