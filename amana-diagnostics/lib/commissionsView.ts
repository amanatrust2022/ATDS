/**
 * What the commissions screen shows, and what it exports.
 *
 * Filtering, totals, grouping by referrer, the CSV and the printed statement
 * all lived inside the screen's component body. The two exports are the reason
 * this is worth pulling out: both were building a document by pasting patient
 * names into a string, and neither escaped anything.
 */

import { csvCell, toCsv } from './csv';
import type { CommissionEntry } from './store';

// Re-exported so the existing tests and call sites keep working; the rule
// itself now lives in lib/csv.ts, shared with the patient export.
export { csvCell };

export type TypeFilter = 'all' | 'doctor' | 'facility';
export type StatusFilter = 'all' | 'pending' | 'paid';

export interface Filters {
  type: TypeFilter;
  status: StatusFilter;
  search: string;
}

export function filterEntries(entries: CommissionEntry[], f: Filters): CommissionEntry[] {
  const q = f.search.trim().toLowerCase();
  return entries.filter((e) => {
    if (f.type !== 'all' && e.referrerType !== f.type) return false;
    if (f.status !== 'all' && e.commissionStatus !== f.status) return false;
    if (!q) return true;
    return (
      e.patientName.toLowerCase().includes(q) ||
      e.referrerName.toLowerCase().includes(q) ||
      e.slipNumber.toLowerCase().includes(q)
    );
  });
}

export interface CommissionTotals {
  billed: number;
  commission: number;
  paid: number;
  outstanding: number;
  referrers: number;
  entries: number;
}

export function totalsFor(entries: CommissionEntry[]): CommissionTotals {
  let billed = 0;
  let commission = 0;
  let paid = 0;
  let outstanding = 0;

  for (const e of entries) {
    billed += e.totalAmount;
    commission += e.commissionAmount;
    if (e.commissionStatus === 'paid') paid += e.commissionAmount;
    else outstanding += e.commissionAmount;
  }

  return {
    billed,
    commission,
    paid,
    outstanding,
    referrers: new Set(entries.map(referrerKey)).size,
    entries: entries.length,
  };
}

/* ========================================================================
 * Ageing
 * ==================================================================== */

export type AgeBucket = '0-30' | '31-60' | '61-90' | '90+';

export const AGE_BUCKETS: AgeBucket[] = ['0-30', '31-60', '61-90', '90+'];

export const AGE_BUCKET_LABEL: Record<AgeBucket, string> = {
  '0-30': 'Under a month',
  '31-60': '1–2 months',
  '61-90': '2–3 months',
  '90+': 'Over 3 months',
};

const DAY_MS = 86_400_000;

/** Whole days since the visit that earned the commission. */
export function ageOf(entry: CommissionEntry, now: Date): number {
  const t = new Date(entry.registeredAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(Math.floor((now.getTime() - t) / DAY_MS), 0);
}

export function bucketOf(days: number): AgeBucket {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

/**
 * What is still owed, by how long it has been owed. Paid entries are not
 * aged — a settled commission has no age worth worrying about.
 */
export function ageingBuckets(
  entries: CommissionEntry[],
  now: Date,
): Record<AgeBucket, { count: number; amount: number }> {
  const out = Object.fromEntries(AGE_BUCKETS.map((b) => [b, { count: 0, amount: 0 }])) as Record<
    AgeBucket,
    { count: number; amount: number }
  >;
  for (const e of entries) {
    if (e.commissionStatus === 'paid') continue;
    const b = out[bucketOf(ageOf(e, now))];
    b.count += 1;
    b.amount += e.commissionAmount;
  }
  return out;
}

export interface ReferrerGroup {
  /** Stable identity; names are not unique across doctors and facilities. */
  key: string;
  id?: string;
  name: string;
  type: 'doctor' | 'facility';
  patients: CommissionEntry[];
  totalBilled: number;
  commissionAmount: number;
  paid: number;
  outstanding: number;
}

/**
 * One row per referring doctor or facility.
 *
 * Grouped by name, which is what the screen has always done. Worth knowing:
 * two referrers with the same name become one row, because the entry does not
 * carry the referrer's id. That is a limitation of the report's shape.
 */
export function groupByReferrer(entries: CommissionEntry[]): ReferrerGroup[] {
  const groups = new Map<string, ReferrerGroup>();

  for (const entry of entries) {
    const key = referrerKey(entry);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        id: entry.referrerId,
        name: entry.referrerName,
        type: entry.referrerType,
        patients: [],
        totalBilled: 0,
        commissionAmount: 0,
        paid: 0,
        outstanding: 0,
      };
      groups.set(key, group);
    }
    group.patients.push(entry);
    group.totalBilled += entry.totalAmount;
    group.commissionAmount += entry.commissionAmount;
    if (entry.commissionStatus === 'paid') group.paid += entry.commissionAmount;
    else group.outstanding += entry.commissionAmount;
  }

  return [...groups.values()];
}

const referrerKey = (entry: CommissionEntry): string =>
  entry.referrerId
    ? `${entry.referrerType}:id:${entry.referrerId}`
    : `${entry.referrerType}:name:${entry.referrerName.trim().toLowerCase()}`;

export interface SettleResult {
  paid: (string | number)[];
  failed: { id: string | number; error: string }[];
}

/**
 * Settles a batch of commissions independently, so one slip with a stale
 * record does not stop the other nine in the batch from being paid.
 */
export async function settleMany(
  ids: (string | number)[],
  reference: string,
  markPaid: (id: string | number, notes?: string) => Promise<void>,
): Promise<SettleResult> {
  const results = await Promise.allSettled(ids.map((id) => markPaid(id, reference)));
  const paid: (string | number)[] = [];
  const failed: { id: string | number; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') paid.push(ids[i]!);
    else failed.push({ id: ids[i]!, error: r.reason?.message || 'Could not settle this commission.' });
  });
  return { paid, failed };
}

export function rateLabel(e: CommissionEntry): string {
  return e.commissionType === 'percentage' ? `${e.commissionValue}%` : `₦${e.commissionValue}`;
}

/* ========================================================================
 * Exports
 * ==================================================================== */

export const CSV_HEADERS = [
  'Slip No',
  'Patient',
  'Date',
  'Referrer',
  'Type',
  'Tests',
  'Total Bill',
  'Commission Rate',
  'Commission',
  'Status',
  'Paid At',
  'Notes',
];

export function buildCommissionCsv(entries: CommissionEntry[]): string {
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-NG') : '');

  const rows = [
    CSV_HEADERS,
    ...entries.map((e) => [
      e.slipNumber,
      e.patientName,
      date(e.registeredAt),
      e.referrerName,
      e.referrerType,
      e.tests.map((t) => t.testName).join('; '),
      e.totalAmount.toFixed(2),
      rateLabel(e),
      e.commissionAmount.toFixed(2),
      e.commissionStatus,
      date(e.commissionPaidAt),
      e.commissionPaidNotes || '',
    ]),
  ];

  return toCsv(rows);
}

/** Nothing typed by a person reaches the printed statement unescaped. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const money = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

export function buildCommissionStatementHtml({
  clinicName,
  entries,
  referrerName,
  now = new Date(),
}: {
  clinicName: string;
  entries: CommissionEntry[];
  /** Narrows the statement to one referrer, for a statement they will be sent. */
  referrerName?: string;
  now?: Date;
}): string {
  const target = referrerName ? entries.filter((e) => e.referrerName === referrerName) : entries;
  const totals = totalsFor(target);
  const title = referrerName
    ? `Referral commission statement — ${referrerName.toUpperCase()}`
    : 'All referral commissions';

  const rows = target
    .map(
      (e) => `
      <tr>
        <td>${escapeHtml(new Date(e.registeredAt).toLocaleDateString('en-NG'))}</td>
        <td><b>${escapeHtml(e.patientName)}</b><br><small>${escapeHtml(e.slipNumber)}</small></td>
        <td>${escapeHtml(e.tests.map((t) => t.testName).join(', '))}</td>
        <td class="num">${money(e.totalAmount)}</td>
        <td class="mid">${escapeHtml(rateLabel(e))}</td>
        <td class="num">${money(e.commissionAmount)}</td>
        <td class="mid ${e.commissionStatus === 'paid' ? 'paid' : 'due'}">${e.commissionStatus.toUpperCase()}</td>
      </tr>`,
    )
    .join('');

  return `
    <!DOCTYPE html><html><head><title>Commission statement — ${escapeHtml(clinicName)}</title>
    <style>
      body { font-family: 'IBM Plex Sans', system-ui, sans-serif; padding: 20px; color: #333; }
      .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 20px; }
      .org-name { font-size: 22px; font-weight: bold; color: #0d9488; }
      .title { font-size: 14px; font-weight: bold; margin-top: 10px; }
      .generated { font-size: 10px; margin-top: 5px; color: #666; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
      th { background: #0d9488; color: white; padding: 8px; text-align: left; }
      td { padding: 8px; border-bottom: 1px solid #ddd; }
      td.num { text-align: right; }
      td.mid { text-align: center; }
      td.paid { color: #0d9488; font-weight: bold; }
      td.due { color: #b45309; font-weight: bold; }
      .summary { display: flex; justify-content: flex-end; gap: 40px; margin-top: 20px; font-size: 13px; font-weight: bold; }
      .summary div { text-align: right; }
      .summary .label { font-weight: normal; color: #666; }
      .summary .figure { font-size: 16px; margin-top: 3px; }
      @media print {
        body { padding: 0; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    </style></head><body>
    <div class="header">
      <div class="org-name">${escapeHtml(clinicName.toUpperCase())}</div>
      <div class="title">${escapeHtml(title)}</div>
      <div class="generated">Generated ${escapeHtml(now.toLocaleDateString('en-NG'))}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Patient</th><th>Tests</th>
          <th class="num">Billed</th><th class="mid">Rate</th>
          <th class="num">Commission</th><th class="mid">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      <div><div class="label">Total billed</div><div class="figure">${money(totals.billed)}</div></div>
      <div><div class="label" style="color:#b45309">Outstanding</div><div class="figure" style="color:#b45309">${money(totals.outstanding)}</div></div>
      <div><div class="label" style="color:#0d9488">Settled</div><div class="figure" style="color:#0d9488">${money(totals.paid)}</div></div>
    </div>
    </body></html>
  `;
}
