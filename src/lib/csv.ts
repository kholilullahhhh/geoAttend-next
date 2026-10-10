/**
 * CSV link builder.
 *
 * Kept separate from the route so the UI can produce a plain `<a href>` — the
 * export is a navigation, not a fetch, so it needs no client-side state and
 * works with the browser's own download handling.
 */

export interface ExportFilters {
  from: string;
  to: string;
  search?: string | null;
  departmentId?: string | null;
  officeId?: string | null;
  status?: string | null;
}

export function exportCsvHref(filters: ExportFilters): string {
  const q = new URLSearchParams();
  q.set('from', filters.from);
  q.set('to', filters.to);
  if (filters.search) q.set('q', filters.search);
  if (filters.departmentId) q.set('dept', filters.departmentId);
  if (filters.officeId) q.set('office', filters.officeId);
  if (filters.status) q.set('status', filters.status);
  return `/api/export/attendance?${q.toString()}`;
}

/**
 * Escape a single CSV cell.
 *
 * Two protections, both necessary:
 *  1. Quoting, for values containing a delimiter, quote or newline.
 *  2. Formula-injection neutralisation — a leading `=`, `+`, `-`, `@`, tab or
 *     CR is prefixed with an apostrophe. Employee-supplied free text (an
 *     absence reason, a correction justification) ends up in these columns, and
 *     an unescaped `=HYPERLINK(...)` would execute when the file is opened in
 *     Excel or Sheets.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Join a row's already-escaped cells. */
export function csvRow(cells: Array<string | number | boolean | null | undefined>): string {
  return cells.map(csvCell).join(',');
}