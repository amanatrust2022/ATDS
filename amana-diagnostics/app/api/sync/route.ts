import { NextResponse } from 'next/server';
import { getDb } from '@/lib/localDb';
import { getSyncState, provideSession, requestSync, requeueSetAside, startSyncEngine } from '@/lib/sync/engine';

/**
 * The browser's window onto the hub's sync engine.
 *
 * This route used to *be* the sync: push, then pull, four hundred lines of
 * per-table upserts, run by whichever browser tab asked. The engine
 * (lib/sync/engine.ts) owns all of that now and runs whether or not a
 * browser is open. What a browser does here is:
 *
 *   GET   read the state — the one place "online", "offline" and
 *         "signed out" are decided, so every screen shows the same word.
 *   POST  hand over its session (so the engine can act as someone) and ask
 *         for a run now, waiting a little for the result so the badge can
 *         show it. `action: 'session'` hands over the session without
 *         waiting; `action: 'requeue'` puts set-aside rows back.
 */

export const dynamic = 'force-dynamic';

/** How long a POST waits for the run it asked for before returning what it has. */
const WAIT_FOR_RUN_MS = 25_000;

export async function GET() {
  try {
    startSyncEngine();
    const state = getSyncState();
    const deadLetters = state.enabled && state.deadLetterCount > 0
      ? getDb().prepare(
          'SELECT id, table_name, action, record_id, attempts, last_error, last_attempt_at FROM sync_outbox WHERE dead = 1 ORDER BY id ASC LIMIT 50',
        ).all()
      : [];
    // Cloud rows this hub could not write, with the reason — so "24 records
    // could not be saved here" can be answered with *which* and *why*
    // without a SQLite client. (On one hub: eight web-registered patients
    // whose slip numbers collided with hub-registered ones, and their tests.)
    const pullFailures = state.enabled && state.deadPullRows > 0
      ? getDb().prepare(
          'SELECT table_name, record_key, attempts, last_error, last_attempt_at FROM sync_pull_failures WHERE dead = 1 ORDER BY table_name, record_key LIMIT 50',
        ).all()
      : [];
    return NextResponse.json({ ...state, deadLetters, pullFailures });
  } catch (error: any) {
    console.error('API GET /api/sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const body = await request.json();
    const { organizationId, action } = body as { organizationId?: string; action?: string };

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    provideSession(organizationId, accessToken);

    // The way out of a poisoned queue without a developer: once whatever the
    // cloud was objecting to has been dealt with, put the set-aside rows back.
    if (action === 'requeueDeadLetters' || action === 'requeue') {
      const requeued = requeueSetAside();
      console.warn(`[Sync] Re-queued ${requeued.outbox} outbox rows and ${requeued.pulled} pulled rows on request.`);
      return NextResponse.json({ ...getSyncState(), requeued });
    }

    // A browser keeping the engine's session fresh, or waking up: ask for a
    // run but do not wait for it. The stream delivers the result.
    if (action === 'session') {
      void requestSync('session');
      return NextResponse.json(getSyncState());
    }

    const state = await Promise.race([
      requestSync('browser'),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), WAIT_FOR_RUN_MS)),
    ]);
    return NextResponse.json(state ?? getSyncState());
  } catch (error: any) {
    console.error('API POST /api/sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
