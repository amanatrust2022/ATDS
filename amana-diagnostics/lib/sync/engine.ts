/**
 * The hub's sync engine. Server only; one per process.
 *
 * Before this, the sync was a fetch in a React component: SyncStatus, in
 * every open tab, POSTed to /api/sync every fifteen seconds, and the route
 * did a push and then a pull. Which meant:
 *
 *   - With no tab open, nothing synced. A hub PC with the browser closed
 *     overnight had the morning's web-side registrations waiting on it.
 *   - With five tabs open, five runs raced over the same outbox rows and the
 *     same cursors.
 *   - A push that stalled returned before the pull. One row the cloud would
 *     not take — for as long as it would not — meant nothing came *down*
 *     either. Cloud data reached the hub only while the hub had nothing the
 *     cloud objected to. This is the one-way sync the clinics reported.
 *   - The hub heard about cloud changes only by asking. Fifteen seconds at
 *     best; a minute in a background tab.
 *
 * Now the engine runs in the hub process, starts with it, and:
 *
 *   - runs single-flight: a request that lands mid-run is folded into one
 *     more run after it, never a parallel one;
 *   - pushes then pulls, and pulls *whether or not the push stalled* — the
 *     only thing that stops a pull is having nobody to ask as;
 *   - runs at once when the hub writes (`onOutbox`), when the cloud changes
 *     (a realtime channel, opened server-side), when a browser asks, and on
 *     a timer as the floor;
 *   - backs off while the cloud is unreachable, so an offline clinic is not
 *     ringing a dead number every fifteen seconds;
 *   - acts as the service role if the hub has that key, else as the most
 *     recently signed-in browser, whose token every SyncStatus hands over;
 *   - publishes one state object that the badge, the boot screen and the
 *     event stream all read, so "offline" is one fact from one place.
 */

import { createClient as createSupabaseClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import { getDb } from '@/lib/localDb';
import { notifyChange, onOutbox } from '@/lib/changeBus';
import { CLOUD_ORIGIN } from '@/lib/cloudOrigin';
import { isHubServer } from '@/lib/runtimeMode';
import { pushOutbox, countPending, countDeadLetters, requeueDeadLetters } from './outbox';
import { pullAll, countDeadPullRows, requeueDeadPullRows } from './pull';
import { learnCloudClock, restoreClockOffset, clockOffsetMs } from './clock';
import { SYNC_TABLES, TOMBSTONE_TABLE } from './tables';

/* ── State ─────────────────────────────────────────────────────────────────── */

/** Whether the hub can reach the cloud, and as whom. One fact, owned here. */
export type Connectivity = 'unknown' | 'online' | 'offline' | 'signed_out';

/** The word the badge shows. Derived from the rest; never set directly. */
export type SyncStatusWord = 'synced' | 'pending_sync' | 'offline' | 'signed_out' | 'needs_attention' | 'disabled';

export interface SyncState {
  /** False on the cloud deployment, where there is nothing to sync. */
  enabled: boolean;
  organizationId: string | null;
  connectivity: Connectivity;
  status: SyncStatusWord;
  running: boolean;
  /** Whom the engine acts as. */
  credential: 'service' | 'session' | 'none';
  /** Whether the hub hears cloud changes as they happen, or only by asking. */
  realtime: 'connected' | 'connecting' | 'off';
  lastRunAt: number | null;
  lastOnlineAt: number | null;
  lastPushAt: number | null;
  lastPullAt: number | null;
  lastError: string | null;
  /** Outbox rows waiting to go up. */
  pendingCount: number;
  /** Outbox rows the cloud kept refusing. Need a person. */
  deadLetterCount: number;
  /** Cloud rows the hub kept failing to write. Need a person. */
  deadPullRows: number;
  /** Tables whose last pull did not finish; their data here is behind. */
  failedTables: string[];
  /** Whether this hub has completed at least one full pull. */
  initialSyncDone: boolean;
  clockOffsetMs: number;
  /** Milliseconds until the next scheduled run. */
  nextRunInMs: number | null;
}

export type SyncStateListener = (state: SyncState) => void;

/** The floor: a run at least this often, whatever else happens. */
export const SYNC_INTERVAL_MS = 15_000;
/** While the cloud is unreachable the interval doubles up to this. */
export const SYNC_OFFLINE_MAX_INTERVAL_MS = 120_000;
/** Runs asked for by writes and realtime events are folded together within this. */
export const SYNC_COALESCE_MS = 250;
/** How long a single cloud request may take before it is treated as offline. */
export const CLOUD_REQUEST_TIMEOUT_MS = 30_000;
const PING_TIMEOUT_MS = 8_000;

const META_ORG = 'hub_organization_id';
const META_CLOCK = 'clock_offset_ms';
const META_INITIAL = 'initial_sync_done';

interface Session {
  accessToken: string;
  expiresAt: number;
}

interface Engine {
  started: boolean;
  state: SyncState;
  listeners: Set<SyncStateListener>;
  session: Session | null;
  organizationId: string | null;
  timer: ReturnType<typeof setTimeout> | null;
  coalesce: ReturnType<typeof setTimeout> | null;
  running: Promise<SyncState> | null;
  /** Resolved when the run *after* the current one finishes. */
  queued: { promise: Promise<SyncState>; resolve: (s: SyncState) => void } | null;
  intervalMs: number;
  realtime: { client: SupabaseClient; channel: RealtimeChannel; token: string } | null;
  realtimeRetry: ReturnType<typeof setTimeout> | null;
  realtimeBackoffMs: number;
  stopOutbox: (() => void) | null;
}

const initialState = (): SyncState => ({
  enabled: false,
  organizationId: null,
  connectivity: 'unknown',
  status: 'disabled',
  running: false,
  credential: 'none',
  realtime: 'off',
  lastRunAt: null,
  lastOnlineAt: null,
  lastPushAt: null,
  lastPullAt: null,
  lastError: null,
  pendingCount: 0,
  deadLetterCount: 0,
  deadPullRows: 0,
  failedTables: [],
  initialSyncDone: false,
  clockOffsetMs: 0,
  nextRunInMs: null,
});

// On globalThis for the same reason as the change bus: Next.js may evaluate
// this module more than once, and there must be one engine.
const g = globalThis as typeof globalThis & { __redianSyncEngine?: Engine };
const engine: Engine = g.__redianSyncEngine ?? (g.__redianSyncEngine = {
  started: false,
  state: initialState(),
  listeners: new Set(),
  session: null,
  organizationId: null,
  timer: null,
  coalesce: null,
  running: null,
  queued: null,
  intervalMs: SYNC_INTERVAL_MS,
  realtime: null,
  realtimeRetry: null,
  realtimeBackoffMs: 1000,
  stopOutbox: null,
});

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function readMeta(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM sync_metadata WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

function writeMeta(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO sync_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

/** `exp` from a JWT, in ms, without verifying it — the cloud does that. */
function tokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 60 * 60 * 1000;
  } catch {
    return Date.now() + 60 * 60 * 1000;
  }
}

function serviceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

/** The credential to act as right now, or null. Service role first: it never expires. */
function currentCredential(): { kind: 'service'; key: string } | { kind: 'session'; token: string } | null {
  const key = serviceKey();
  if (key) return { kind: 'service', key };
  const s = engine.session;
  if (s && s.expiresAt > Date.now() + 5_000) return { kind: 'session', token: s.accessToken };
  return null;
}

/** A fetch that gives up, so a hung request reads as offline rather than as a run that never ends. */
const timedFetch = (ms: number): typeof fetch => (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(ms) });

function makeClient(cred: NonNullable<ReturnType<typeof currentCredential>>): SupabaseClient {
  const url = supabaseUrl()!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, cred.kind === 'service' ? cred.key : anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: timedFetch(CLOUD_REQUEST_TIMEOUT_MS),
      headers: cred.kind === 'session' ? { Authorization: `Bearer ${cred.token}` } : {},
    },
  });
}

function deriveStatus(s: SyncState): SyncStatusWord {
  if (!s.enabled) return 'disabled';
  if (s.credential === 'none' || s.connectivity === 'signed_out') return 'signed_out';
  if (s.connectivity === 'offline') return 'offline';
  if (s.deadLetterCount > 0 || s.deadPullRows > 0 || s.failedTables.length > 0) return 'needs_attention';
  if (s.pendingCount > 0) return 'pending_sync';
  return 'synced';
}

function publish(patch: Partial<SyncState>): SyncState {
  const next: SyncState = { ...engine.state, ...patch };
  next.status = deriveStatus(next);
  engine.state = next;
  engine.listeners.forEach((l) => {
    try { l(next); } catch { /* one listener must not silence the rest */ }
  });
  return next;
}

/** Counts from disk, for a state that says what is actually there. */
function counts(): Pick<SyncState, 'pendingCount' | 'deadLetterCount' | 'deadPullRows'> {
  const db = getDb();
  return {
    pendingCount: countPending(db),
    deadLetterCount: countDeadLetters(db),
    deadPullRows: countDeadPullRows(db),
  };
}

/* ── Public API ────────────────────────────────────────────────────────────── */

export function getSyncState(): SyncState {
  return engine.state;
}

export function onSyncState(listener: SyncStateListener): () => void {
  engine.listeners.add(listener);
  return () => { engine.listeners.delete(listener); };
}

/**
 * A browser handing over what it knows: which clinic this is, and a session
 * to act as. Every SyncStatus does this on every tick, which is how the
 * engine's token stays fresh for as long as anyone is signed in.
 */
export function provideSession(organizationId: string, accessToken: string | null | undefined): void {
  if (!engine.started) startSyncEngine();
  if (!engine.state.enabled) return;
  if (organizationId && organizationId !== engine.organizationId) {
    engine.organizationId = organizationId;
    try { writeMeta(META_ORG, organizationId); } catch { /* a hub without a database has bigger problems */ }
    publish({ organizationId });
    openRealtime();
  }
  if (accessToken) {
    const expiresAt = tokenExpiry(accessToken);
    if (!engine.session || engine.session.accessToken !== accessToken) {
      engine.session = { accessToken, expiresAt };
      publish({ credential: serviceKey() ? 'service' : 'session' });
      // A new token is a new person; the realtime socket must act as them.
      openRealtime();
    }
  }
}

/**
 * Asks for a run. Coalesced: requests within SYNC_COALESCE_MS share one run,
 * and a request during a run gets exactly one run after it. The promise
 * resolves with the state after the run that covered this request.
 */
export function requestSync(reason: string): Promise<SyncState> {
  if (!engine.started) startSyncEngine();
  if (!engine.state.enabled) return Promise.resolve(engine.state);

  if (engine.running) {
    if (!engine.queued) {
      let resolve!: (s: SyncState) => void;
      const promise = new Promise<SyncState>((r) => { resolve = r; });
      engine.queued = { promise, resolve };
    }
    return engine.queued.promise;
  }

  // Not running: fold near-simultaneous requests into one run.
  if (!engine.queued) {
    let resolve!: (s: SyncState) => void;
    const promise = new Promise<SyncState>((r) => { resolve = r; });
    engine.queued = { promise, resolve };
  }
  if (!engine.coalesce) {
    engine.coalesce = setTimeout(() => {
      engine.coalesce = null;
      void runNow(reason);
    }, SYNC_COALESCE_MS);
  }
  return engine.queued.promise;
}

/** Puts every set-aside row — pushed or pulled — back for another try. */
export function requeueSetAside(): { outbox: number; pulled: number } {
  const db = getDb();
  const outbox = requeueDeadLetters(db);
  const pulled = requeueDeadPullRows(db);
  publish(counts());
  void requestSync('requeue');
  return { outbox, pulled };
}

/**
 * Starts the engine. Idempotent; called from instrumentation.ts when the
 * process is a hub, and by the first request that reaches it if that came
 * first. Does nothing on the cloud deployment.
 */
export function startSyncEngine(): SyncState {
  if (engine.started) return engine.state;
  engine.started = true;

  if (!isHubServer() || !supabaseUrl()) {
    return publish({ enabled: false });
  }

  try {
    engine.organizationId = readMeta(META_ORG) ?? soleOrganizationId();
    const savedOffset = Number(readMeta(META_CLOCK));
    if (Number.isFinite(savedOffset)) restoreClockOffset(savedOffset);
    publish({
      enabled: true,
      organizationId: engine.organizationId,
      credential: serviceKey() ? 'service' : 'none',
      initialSyncDone: readMeta(META_INITIAL) === 'true',
      clockOffsetMs: clockOffsetMs(),
      ...counts(),
    });
  } catch (err: any) {
    console.error('[Sync] Engine could not read the hub database:', err?.message || err);
    return publish({ enabled: false, lastError: err?.message || String(err) });
  }

  // A write on the hub asks for a run at once.
  engine.stopOutbox = onOutbox(() => { void requestSync('write'); });

  schedule(SYNC_INTERVAL_MS);
  openRealtime();
  // The first run straight away, so a hub that has been off overnight
  // catches up before anyone has typed anything.
  void requestSync('start');
  console.log('[Sync] Engine started' + (engine.organizationId ? ` for organisation ${engine.organizationId}` : ' (waiting for a browser to say which clinic this is)'));
  return engine.state;
}

/** For tests: forget everything and stop every timer. */
export function _resetSyncEngineForTests(): void {
  if (engine.timer) clearTimeout(engine.timer);
  if (engine.coalesce) clearTimeout(engine.coalesce);
  if (engine.realtimeRetry) clearTimeout(engine.realtimeRetry);
  engine.stopOutbox?.();
  closeRealtime();
  Object.assign(engine, {
    started: false,
    state: initialState(),
    listeners: new Set(),
    session: null,
    organizationId: null,
    timer: null,
    coalesce: null,
    running: null,
    queued: null,
    intervalMs: SYNC_INTERVAL_MS,
    realtimeBackoffMs: 1000,
    stopOutbox: null,
  });
}

/* ── Scheduling ────────────────────────────────────────────────────────────── */

function soleOrganizationId(): string | null {
  const rows = getDb().prepare('SELECT id FROM organizations LIMIT 2').all() as Array<{ id: string }>;
  return rows.length === 1 ? rows[0].id : null;
}

function schedule(ms: number): void {
  if (engine.timer) clearTimeout(engine.timer);
  engine.timer = setTimeout(() => {
    engine.timer = null;
    void requestSync('timer');
  }, ms);
  publish({ nextRunInMs: ms });
}

/** The interval after a run: the floor when online, doubling while offline. */
function nextInterval(connectivity: Connectivity): number {
  if (connectivity === 'online') {
    engine.intervalMs = SYNC_INTERVAL_MS;
  } else {
    engine.intervalMs = Math.min(engine.intervalMs * 2, SYNC_OFFLINE_MAX_INTERVAL_MS);
  }
  return engine.intervalMs;
}

async function runNow(reason: string): Promise<SyncState> {
  const mine = engine.queued;
  engine.queued = null;

  const run = performRun(reason)
    .catch((err: any) => publish({ running: false, lastError: err?.message || String(err) }))
    .then((state) => {
      engine.running = null;
      schedule(nextInterval(state.connectivity));
      // The state after scheduling, so a caller sees when the next run is.
      mine?.resolve(engine.state);
      // Something asked while we were busy; it gets its own run.
      if (engine.queued) void runNow('queued');
      return engine.state;
    });
  engine.running = run;
  return run;
}

/* ── One run ───────────────────────────────────────────────────────────────── */

/**
 * Whether the cloud is reachable, and as whom. Also where the hub learns
 * the cloud's clock, from the `Date` header of the reply.
 */
async function ping(cred: NonNullable<ReturnType<typeof currentCredential>>, organizationId: string): Promise<Connectivity> {
  const url = `${supabaseUrl()}/rest/v1/organizations?select=id&id=eq.${encodeURIComponent(organizationId)}`;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const headers: Record<string, string> = cred.kind === 'service'
    ? { apikey: cred.key, Authorization: `Bearer ${cred.key}` }
    : { apikey: anon, Authorization: `Bearer ${cred.token}` };
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
    learnCloudClock(res.headers.get('date'));
    if (res.status === 401 || res.status === 403) return 'signed_out';
    if (!res.ok) return 'offline';
    return 'online';
  } catch {
    return 'offline';
  }
}

async function performRun(reason: string): Promise<SyncState> {
  const organizationId = engine.organizationId;
  if (!organizationId) {
    return publish({ running: false, lastRunAt: Date.now(), lastError: 'No organisation yet', ...counts() });
  }

  const cred = currentCredential();
  if (!cred) {
    // Nobody to act as. Under RLS the anon key can neither push nor pull.
    // Touch nothing; the next browser to sign in hands over a token.
    return publish({ running: false, connectivity: 'signed_out', credential: 'none', lastRunAt: Date.now(), ...counts() });
  }

  publish({ running: true, credential: cred.kind });

  const connectivity = await ping(cred, organizationId);
  try { writeMeta(META_CLOCK, String(clockOffsetMs())); } catch { /* not worth failing the run */ }
  if (connectivity !== 'online') {
    return publish({
      running: false,
      connectivity,
      lastRunAt: Date.now(),
      clockOffsetMs: clockOffsetMs(),
      lastError: connectivity === 'offline' ? 'The cloud is unreachable' : 'The cloud did not accept this session',
      ...counts(),
    });
  }

  const db = getDb();
  const supabase = makeClient(cred);
  let lastError: string | null = null;

  // 1. Push. A stall here is recorded and does NOT skip the pull.
  const push = await pushOutbox(db, supabase, {
    cloudOrigin: CLOUD_ORIGIN,
    accessToken: cred.kind === 'session' ? cred.token : engine.session?.accessToken ?? null,
  });
  if (push.stalledOutboxId !== undefined) {
    lastError = push.stalledReason ?? 'A change could not be sent';
    if (push.unauthenticated && cred.kind === 'session') {
      // The token is no good. Say so; do not pull as it either.
      return publish({
        running: false,
        connectivity: 'signed_out',
        lastRunAt: Date.now(),
        lastPushAt: push.pushed > 0 ? Date.now() : engine.state.lastPushAt,
        lastError,
        ...counts(),
      });
    }
  }

  // 2. Pull, regardless.
  const pull = await pullAll(db, supabase, organizationId);
  if (pull.changed > 0) notifyChange();
  if (pull.failedTables.length > 0) {
    lastError = lastError ?? `Could not fetch ${pull.failedTables.join(', ')}`;
  } else if (!engine.state.initialSyncDone) {
    try { writeMeta(META_INITIAL, 'true'); } catch { /* recorded next time */ }
  }

  if (reason !== 'timer') console.log(`[Sync] ${reason}: pushed ${push.pushed}, pulled ${pull.changed}${pull.deleted ? ` (deleted ${pull.deleted})` : ''}`);

  const now = Date.now();
  return publish({
    running: false,
    connectivity: 'online',
    lastRunAt: now,
    lastOnlineAt: now,
    lastPushAt: push.pushed > 0 ? now : engine.state.lastPushAt,
    lastPullAt: now,
    lastError,
    failedTables: pull.failedTables,
    initialSyncDone: engine.state.initialSyncDone || pull.failedTables.length === 0,
    clockOffsetMs: clockOffsetMs(),
    ...counts(),
  });
}

/* ── Realtime: hearing the cloud instead of asking it ──────────────────────── */

/**
 * Opens a channel on every registered table (and the tombstones), filtered
 * to this clinic, and asks for a run on any event. This is the hop that
 * REALTIME.md listed as "not done": the hub had no session of its own, so
 * a web-side change waited for the next poll. The engine has a credential
 * now, so it can listen.
 *
 * Best effort. If the runtime has no WebSocket, or the channel will not
 * open, the timer is still the floor and the badge says "connecting".
 */
function openRealtime(): void {
  const cred = currentCredential();
  const organizationId = engine.organizationId;
  if (!engine.state.enabled || !cred || !organizationId) return;

  const token = cred.kind === 'service' ? cred.key : cred.token;
  if (engine.realtime?.token === token) return;
  closeRealtime();

  let client: SupabaseClient;
  try {
    if (typeof WebSocket === 'undefined') throw new Error('no WebSocket in this runtime');
    client = makeClient(cred);
    client.realtime.setAuth(token);
  } catch (err: any) {
    console.warn('[Sync] Realtime unavailable; the hub will poll instead:', err?.message || err);
    publish({ realtime: 'off' });
    return;
  }

  const nonce = Math.random().toString(36).slice(2, 10);
  let channel = client.channel(`hub-sync-${organizationId}-${nonce}`);
  for (const t of SYNC_TABLES) {
    if (t.realtime === false) continue;
    const filter = t.scope === 'id' ? `id=eq.${organizationId}` : `organization_id=eq.${organizationId}`;
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: t.name, filter }, () => {
      void requestSync('realtime');
    });
  }
  channel = channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: TOMBSTONE_TABLE, filter: `organization_id=eq.${organizationId}` },
    () => { void requestSync('realtime'); },
  );

  const mine = { client, channel, token };
  engine.realtime = mine;
  publish({ realtime: 'connecting' });

  channel.subscribe((status) => {
    if (engine.realtime !== mine) return; // a replaced channel's late opinion
    if (status === 'SUBSCRIBED') {
      engine.realtimeBackoffMs = 1000;
      publish({ realtime: 'connected' });
      // Whatever happened while the channel was down was never announced.
      void requestSync('realtime-open');
      return;
    }
    if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      publish({ realtime: 'connecting' });
      const wait = engine.realtimeBackoffMs;
      engine.realtimeBackoffMs = Math.min(wait * 2, 30_000);
      if (engine.realtimeRetry) clearTimeout(engine.realtimeRetry);
      engine.realtimeRetry = setTimeout(() => {
        engine.realtimeRetry = null;
        if (engine.realtime === mine) {
          engine.realtime = null; // force a fresh channel
          openRealtime();
        }
      }, wait);
    }
  });
}

function closeRealtime(): void {
  const rt = engine.realtime;
  engine.realtime = null;
  if (!rt) return;
  try { void rt.client.removeChannel(rt.channel); } catch { /* already gone */ }
  try { void rt.client.realtime.disconnect(); } catch { /* already gone */ }
}
