/**
 * The hub's doorbell.
 *
 * Every screen on the LAN used to find out about a change the same way: by
 * asking the hub every five seconds whether anything had happened. A result
 * entered on the bench took up to five seconds to reach reception, longer in
 * a background tab where the browser slows timers down, and every open screen
 * in the building paid for the asking whether or not anything had changed.
 *
 * This is the other half of the fix. A write anywhere in the hub rings the
 * bell; `app/api/events` holds one open connection per screen and passes the
 * ring on. The screens still fall back to polling when that connection is
 * down, so this only ever makes things faster, never quieter.
 *
 * It lives on `globalThis` because Next.js may evaluate this module more than
 * once in one process — a route handler and the sync route can each get their
 * own copy in development — and a bell with two separate clappers rings only
 * for the listeners on the side that was struck.
 *
 * Server only. There is one hub, so there is one bus; it is not scoped to an
 * organisation because the hub is a single clinic's, and a listener re-reads
 * its own queue on a ring regardless.
 */

type Listener = (at: number) => void;

interface Bus {
  listeners: Set<Listener>;
}

const g = globalThis as typeof globalThis & { __redianChangeBus?: Bus };
const bus: Bus = g.__redianChangeBus ?? (g.__redianChangeBus = { listeners: new Set() });

/**
 * Tells every open screen that something changed.
 *
 * Delivery is deferred past the current turn of the event loop (a zero
 * timeout rather than setImmediate, which not every runtime has). The hub's
 * database calls are synchronous, so a write that rings the bell from inside
 * a transaction has committed by the time anyone hears it; deferring makes
 * that true even if a caller rings before its own `COMMIT`.
 */
export function notifyChange(): void {
  if (bus.listeners.size === 0) return;
  setTimeout(() => {
    const at = Date.now();
    bus.listeners.forEach((listener) => {
      try { listener(at); } catch { /* one dead stream must not silence the rest */ }
    });
  });
}

/** Subscribes to rings. Returns the unsubscribe. */
export function onChange(listener: Listener): () => void {
  bus.listeners.add(listener);
  return () => { bus.listeners.delete(listener); };
}

/** How many screens are listening right now. For tests and diagnostics. */
export function listenerCount(): number {
  return bus.listeners.size;
}
