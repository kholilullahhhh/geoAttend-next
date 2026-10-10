/**
 * CSV export of the attendance ledger.
 *
 * Design notes:
 *  - Runs with the caller's JWT, so `admin_attendance_list` applies RLS. An
 *    EMPLOYEE cannot reach this route and would be refused even if they could:
 *    the handler calls `requireHrAdmin()` first.
 *  - Pages through the RPC rather than issuing one unbounded query, so a year of
 *    data cannot exhaust server memory.
 *  - Hard-capped at `MAX_ROWS`; exceeding it produces a truncated export plus a
 *    visible marker rather than an unexpectedly huge download.
 */
import { NextResponse } from 'next/server';

import { DataError, fetchAttendanceList, requireHrAdmin } from '@/lib/data';
import { csvRow } from '@/lib/csv';
import { formatTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAGE = 500;
const MAX_ROWS = 50_000;

const COLUMNS = [
  'tanggal',
  'kode_karyawan',
  'nama',
  'lokasi_kantor',
  'shift',
  'status',
  'check_in',
  'check_out',
  'durasi_menit',
  'terlambat_menit',
  'jam_kerja',
  'jarak_m',
  'akurasi_m',
  'sumber',
  'perlu_ditinjau',
  'risiko',
] as const;

/**
 * Escape a CSV cell.
 *
 * Prefixes a leading `=`, `+`, `-`, `@`, tab or CR with an apostrophe so a value
 * originating from user input cannot be interpreted as a formula when the file
 * is opened in Excel or Sheets (CSV injection).
 */

export async function GET(request: Request) {
  try {
    await requireHrAdmin();
  } catch (error) {
    const code = error instanceof DataError ? error.code : 'FORBIDDEN';
    const message =
      error instanceof DataError ? error.message : 'Akses ditolak.';
    return NextResponse.json({ ok: false, code, message }, { status: code === 'UNAUTHENTICATED' ? 401 : 403 });
  }

  const url = new URL(request.url);
  const p = (k: string) => url.searchParams.get(k) || null;

  const from = p('from');
  const to = p('to');
  if (!from || !to) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_RANGE', message: 'Parameter from dan to wajib diisi.' },
      { status: 400 },
    );
  }
  // Bound the range server-side: an unbounded export is a denial-of-service vector.
  const maxDays = 400;
  const dayMs = 86_400_000;
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > maxDays * dayMs) {
    return NextResponse.json(
      {
        ok: false,
        code: 'RANGE_TOO_LARGE',
        message: `Rentang maksimum ${maxDays} hari per ekspor. Persempit filter tanggal.`,
      },
      { status: 400 },
    );
  }

  const lines: string[] = [COLUMNS.join(',')];
  let offset = 0;
  let truncated = false;

  try {
    for (;;) {
      const page = await fetchAttendanceList({
        from,
        to,
        search: p('q'),
        departmentId: p('dept'),
        officeId: p('office'),
        status: p('status'),
        limit: PAGE,
        offset,
      });

      const rows = page.rows ?? [];
      for (const r of rows) {
        if (lines.length - 1 >= MAX_ROWS) {
          truncated = true;
          break;
        }
        lines.push(
          csvRow([
            r.work_date,
            r.employee_code,
            r.full_name,
            r.office_name,
            r.shift_name,
            r.status,
            r.check_in_at ? `${r.work_date} ${formatTime(r.check_in_at)}` : null,
            r.check_out_at ? `${r.work_date} ${formatTime(r.check_out_at)}` : null,
            r.worked_minutes,
            r.is_late ? r.late_minutes : 0,
            r.overtime_minutes,
            r.check_in_distance_m,
            r.check_in_accuracy_m,
            r.source,
            r.review_required ? 'ya' : 'tidak',
            (r.risk_flags ?? []).join('|'),
          ]),
        );
      }

      offset += rows.length;
      if (rows.length < PAGE || offset >= page.total) break;
      if (truncated) break;
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: 'EXPORT_FAILED',
        message: error instanceof DataError ? error.message : 'Ekspor gagal.',
      },
      { status: 500 },
    );
  }

  if (truncated) {
    lines.push(`# hasil dipotong pada ${MAX_ROWS} baris, perpersempit rentang tanggal`);
  }

  // BOM so Excel detects UTF-8 and renders Indonesian characters correctly.
  const body = `\uFEFF${lines.join('\r\n')}\r\n`;
  const stamp = `${from}_${to}`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="absensi_${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}