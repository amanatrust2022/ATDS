/**
 * The printable staff audit.
 *
 * A standalone HTML document handed to `printHtml`, so it carries its own
 * styles and cannot use the app's tokens — a print window has no access to
 * them. The colours below are therefore literal, and deliberately so; this is
 * the one place in the product where that is correct.
 *
 * It was a 90-line template string inside the staff screen's render, and it was
 * headed with one particular clinic's name for every clinic that printed it.
 */

import { formatTAT, revenueOf, volumeOf, RANGE_LABEL, type DateRange, type StaffRow, type Totals } from './staffPerformance';

const naira = (n: number) => `₦${(n || 0).toLocaleString('en-NG')}`;

/** Nothing from the database reaches this document unescaped. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildStaffAuditHtml({
  clinicName,
  range,
  totals,
  rows,
  now = new Date(),
}: {
  clinicName: string;
  range: DateRange;
  totals: Totals;
  rows: StaffRow[];
  now?: Date;
}): string {
  const leaderboard = rows
    .map((p, idx) => {
      const isReception = p.member.role === 'reception';
      return `
        <tr>
          <td class="rank">${idx + 1}</td>
          <td class="name">${escapeHtml(p.member.full_name || 'Not set up')}</td>
          <td>${escapeHtml((p.member.role || '—').toUpperCase())}</td>
          <td>${volumeOf(p)} ${isReception ? 'receipts' : 'tests'}</td>
          <td class="money">${naira(revenueOf(p))}</td>
          <td class="money">${naira(p.commissionSum)}</td>
          <td>${isReception ? '—' : formatTAT(p.avgTat)}</td>
        </tr>`;
    })
    .join('');

  return `
    <html>
      <head>
        <title>Staff workload and performance — ${escapeHtml(clinicName)}</title>
        <style>
          body { font-family: 'IBM Plex Sans', system-ui, sans-serif; padding: 3rem; color: #1e293b; background: #fff; line-height: 1.5; }
          h1 { color: #0f172a; font-size: 1.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: -0.02em; margin-bottom: 0.25rem; }
          h2 { color: #0d9488; font-size: 1.05rem; font-weight: 600; margin: 0 0 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.75rem; }
          h3 { font-size: 0.95rem; margin: 2rem 0 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem; }
          th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; }
          th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.05em; }
          td.rank, td.name { font-weight: 700; color: #0f172a; }
          td.money { font-weight: 700; font-variant-numeric: tabular-nums; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 2rem 0; }
          .kpi { border: 1px solid #e2e8f0; padding: 1.1rem; border-radius: 8px; background: #f8fafc; }
          .kpi-title { font-size: 0.65rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
          .kpi-value { font-size: 1.3rem; font-weight: 800; color: #0f172a; margin-top: 0.25rem; }
          .meta { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.78rem; color: #64748b; background: #f1f5f9; padding: 0.75rem 1rem; border-radius: 6px; }
          .footer { margin-top: 3rem; text-align: center; font-size: 0.72rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 1.25rem; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(clinicName.toUpperCase())}</h1>
        <h2>Staff workload and performance</h2>

        <div class="meta">
          <div><strong>Period:</strong> ${RANGE_LABEL[range]}</div>
          <div><strong>Printed:</strong> ${escapeHtml(now.toLocaleString())}</div>
        </div>

        <div class="kpis">
          <div class="kpi">
            <div class="kpi-title">Tests signed off</div>
            <div class="kpi-value">${totals.totalTestsCount}</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">Clinical revenue</div>
            <div class="kpi-value">${naira(totals.totalClinicalRevenue)}</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">Commissions</div>
            <div class="kpi-value">${naira(totals.totalCommissions)}</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">Average turnaround</div>
            <div class="kpi-value">${formatTAT(totals.avgTAT)}</div>
          </div>
        </div>

        <h3>Staff, ranked</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Staff member</th>
              <th>Role</th>
              <th>Work</th>
              <th>Revenue</th>
              <th>Commission</th>
              <th>Turnaround</th>
            </tr>
          </thead>
          <tbody>${leaderboard}</tbody>
        </table>

        <div class="footer">
          ${escapeHtml(clinicName)} · Confidential · Generated by Redian
        </div>
      </body>
    </html>
  `;
}
