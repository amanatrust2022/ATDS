import { onChange } from '@/lib/changeBus';

/**
 * The hub's change stream.
 *
 * One long-lived connection per open screen. The hub writes a `change` event
 * whenever anything in it changes (see lib/changeBus.ts), and the screen
 * re-reads its queue. Nothing about the change travels — no row, no table —
 * because the screens do not want it: every one of them answers a ring the
 * same way, by asking the hub for its queue again. A doorbell, not a letter,
 * which is also what the cloud channel is.
 *
 * Server-sent events rather than a websocket because the browser reconnects
 * an EventSource by itself, it passes through the service worker and any
 * proxy untouched, and the hub is a single Node process, so there is no
 * fan-out to build.
 *
 * Only the hub serves this usefully. The cloud deployment never opens it —
 * `localPatientsRepository` is the only caller — but the route has to build
 * there, so it touches nothing that needs the database.
 */

export const dynamic = 'force-dynamic';

/** Keeps proxies and the browser from deciding a quiet stream is a dead one. */
const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (!searchParams.get('organizationId')) {
    return new Response(JSON.stringify({ error: 'Missing organizationId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let stop = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: string | number) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          // The client went away between the check and the write.
          closed = true;
        }
      };

      const unsubscribe = onChange((at) => send('change', at));
      const heartbeat = setInterval(() => send('ping', Date.now()), HEARTBEAT_MS);

      stop = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed by the other end */ }
      };

      // A screen that navigates away or closes drops the request; the
      // listener must go with it, or the bus fills with dead streams.
      request.signal.addEventListener('abort', stop);

      // Tells the browser the stream is up before anything has changed, so a
      // screen that was polling can stop.
      send('hello', Date.now());
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // nginx, if a clinic ever puts one in front of the hub, would otherwise
      // hold the stream until it had a page's worth to send.
      'X-Accel-Buffering': 'no',
    },
  });
}
