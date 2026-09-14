/**
 * A stand-in for the cloud, for the sync tests.
 *
 * Holds rows per table and answers the subset of the PostgREST builder the
 * pull and push use — `eq`, `gte`, `gt`, `in`, `or` (the two keyset forms
 * the pull writes), `order`, `limit`, `select`, `maybeSingle`, `update`,
 * `upsert`, `delete` — faithfully enough that paging and conflict rules can
 * be tested against real data rather than against a mock that agrees with
 * whatever was asked.
 *
 * Test-only. Lives beside the code so the tests share one fake.
 */

type Row = Record<string, any>;
type Filter = (row: Row) => boolean;

export interface FakeCloudOptions {
  /** Tables that answer every query with this error. */
  failing?: Record<string, { message: string; code?: string }>;
  /** Tables the cloud does not have at all (a migration not yet applied). */
  missing?: string[];
}

const unquote = (v: string) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);

/** One clause of a PostgREST `or()`: `col.op.value`. */
function clause(text: string): Filter {
  const [col, op, ...rest] = text.split('.');
  const value = unquote(rest.join('.'));
  switch (op) {
    case 'gt': return (r) => String(r[col]) > value;
    case 'gte': return (r) => String(r[col]) >= value;
    case 'lt': return (r) => String(r[col]) < value;
    case 'lte': return (r) => String(r[col]) <= value;
    case 'eq': return (r) => String(r[col]) === value;
    case 'is': return (r) => (value === 'null' ? r[col] === null || r[col] === undefined : Boolean(r[col]) === (value === 'true'));
    default: throw new Error(`fake cloud: unsupported operator ${op}`);
  }
}

/** Splits at top-level commas only. */
function splitTop(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  let inQuote = false;
  for (const ch of text) {
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function parseOr(text: string): Filter {
  const parts = splitTop(text).map((p) => {
    if (p.startsWith('and(')) {
      const inner = splitTop(p.slice(4, -1)).map(clause);
      return (r: Row) => inner.every((f) => f(r));
    }
    return clause(p);
  });
  return (r) => parts.some((f) => f(r));
}

export function fakeCloud(tables: Record<string, Row[]>, options: FakeCloudOptions = {}) {
  const data: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(tables)) data[name] = rows.map((r) => ({ ...r }));

  /** Every write the push made, in order. */
  const writes: Array<{ table: string; op: string; data?: Row; filters: string[] }> = [];

  function builder(table: string) {
    const filters: Filter[] = [];
    const filterNames: string[] = [];
    const orders: Array<{ col: string; asc: boolean }> = [];
    let limit = Infinity;
    let op: 'select' | 'update' | 'upsert' | 'delete' = 'select';
    let payload: Row | null = null;
    let single = false;
    let returning = false;

    const rows = () => (data[table] ??= []);

    const run = (): { data: any; error: any } => {
      const failure = options.failing?.[table];
      if (failure) return { data: null, error: failure };
      if (options.missing?.includes(table)) {
        return { data: null, error: { message: `relation "public.${table}" does not exist`, code: '42P01' } };
      }

      const matching = () => rows().filter((r) => filters.every((f) => f(r)));

      if (op === 'upsert') {
        const key = table === 'test_prices' ? ['organization_id', 'test_id'] : table === 'custom_tests' ? ['organization_id', 'id'] : ['id'];
        const i = rows().findIndex((r) => key.every((k) => String(r[k]) === String(payload![k])));
        if (i >= 0) rows()[i] = { ...rows()[i], ...payload };
        else rows().push({ ...payload });
        writes.push({ table, op, data: payload!, filters: filterNames });
        return { data: null, error: null };
      }
      if (op === 'update') {
        const hit = matching();
        hit.forEach((r) => Object.assign(r, payload));
        writes.push({ table, op, data: payload!, filters: filterNames });
        return { data: returning ? hit.map((r) => ({ ...r })) : null, error: null };
      }
      if (op === 'delete') {
        const hit = new Set(matching());
        data[table] = rows().filter((r) => !hit.has(r));
        writes.push({ table, op, filters: filterNames });
        return { data: null, error: null };
      }

      let out = matching();
      for (const o of [...orders].reverse()) {
        out = [...out].sort((a, b) => {
          const x = a[o.col]; const y = b[o.col];
          const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
          return o.asc ? c : -c;
        });
      }
      if (Number.isFinite(limit)) out = out.slice(0, limit);
      if (single) return { data: out[0] ?? null, error: null };
      return { data: out.map((r) => ({ ...r })), error: null };
    };

    const q: any = {
      select: (_cols?: string) => { if (op !== 'select') returning = true; return q; },
      eq: (col: string, v: unknown) => { filters.push((r) => String(r[col]) === String(v)); filterNames.push(`${col}=${v}`); return q; },
      gt: (col: string, v: unknown) => { filters.push((r) => String(r[col]) > String(v)); filterNames.push(`${col}>${v}`); return q; },
      gte: (col: string, v: unknown) => { filters.push((r) => String(r[col]) >= String(v)); filterNames.push(`${col}>=${v}`); return q; },
      lte: (col: string, v: unknown) => { filters.push((r) => String(r[col]) <= String(v)); filterNames.push(`${col}<=${v}`); return q; },
      in: (col: string, vs: unknown[]) => { const set = new Set(vs.map(String)); filters.push((r) => set.has(String(r[col]))); filterNames.push(`${col} in ${vs.length}`); return q; },
      or: (text: string) => { filters.push(parseOr(text)); filterNames.push(`or(${text})`); return q; },
      order: (col: string, o?: { ascending?: boolean }) => { orders.push({ col, asc: o?.ascending !== false }); return q; },
      limit: (n: number) => { limit = n; return q; },
      maybeSingle: () => { single = true; return q; },
      update: (d: Row) => { op = 'update'; payload = d; return q; },
      upsert: (d: Row) => { op = 'upsert'; payload = d; return q; },
      delete: () => { op = 'delete'; return q; },
      then: (resolve: any, reject: any) => Promise.resolve().then(run).then(resolve, reject),
    };
    return q;
  }

  return {
    data,
    writes,
    from: (table: string) => builder(table),
  };
}
