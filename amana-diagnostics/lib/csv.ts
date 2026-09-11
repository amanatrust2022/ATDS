/**
 * Writing a CSV that a spreadsheet cannot be tricked by.
 *
 * Two screens export one — the commission report and the patient database —
 * and both built theirs the same wrong way: `"${value}"`, with nothing
 * escaped. Shared here so there is one rule rather than two copies drifting.
 */

/**
 * One cell.
 *
 * Two separate problems, both live before this existed:
 *
 * 1. Quoting was `"${value}"` with no escaping, so a patient recorded as
 *    O"Brien ended the field early and shifted every following column on that
 *    row. Doubling the quote is what the CSV spec says to do.
 *
 * 2. A cell beginning =, +, - or @ is read as a *formula* by Excel, Sheets and
 *    LibreOffice, and runs when the file is opened. Patient names, referrer
 *    names and free-text notes are all typed by staff, so this is reachable
 *    rather than theoretical. A leading apostrophe is the standard defence:
 *    the spreadsheet treats the cell as text and does not display it.
 */
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Rows to a CSV document.
 *
 * Joined with \r\n, which is what the spec says and what Excel expects; \n
 * alone is read as one long row by some Windows builds.
 */
export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/**
 * Hands the browser a file to save.
 *
 * The object URL is revoked afterwards. Neither of the two exports that
 * existed before did that, so every export leaked its blob for the lifetime of
 * the tab.
 */
export function downloadCsv(filename: string, csv: string): void {
  // The BOM is what makes Excel read the file as UTF-8. Without it a patient
  // named Adéọlá opens as Adeolá on a Nigerian Windows machine.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
