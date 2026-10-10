/**
 * Approval mutations.
 *
 * Every decision is made through the audited `review_leave` / `review_correction`
 * RPCs. There is deliberately no direct `update` on `leave_requests` or
 * `attendance_corrections` from the client: those tables have no UPDATE policy for
 * HR, so approval cannot bypass validation, and each decision writes an audit row.
 */
import { NextResponse } from 'next/server';

import { DataError, requireHrAdmin, reviewCorrection, reviewLeave } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireHrAdmin();
  } catch (error) {
    // Every authorization failure is reported identically so the endpoint does
    // not reveal whether a request exists or who may see it.
    const message = error instanceof DataError ? error.message : 'Akses ditolak.';
    return NextResponse.json({ ok: false, message }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: 'Permintaan tidak valid.' }, { status: 400 });
  }

  const kind = form.get('kind');
  const id = form.get('id');
  const decision = form.get('decision');
  const note = form.get('note');

  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, message: 'ID pengajuan tidak valid.' }, { status: 400 });
  }
  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    return NextResponse.json({ ok: false, message: 'Keputusan tidak valid.' }, { status: 400 });
  }

  const reason = typeof note === 'string' ? note.trim() : '';
  if (decision === 'REJECTED' && reason.length === 0) {
    return NextResponse.json(
      { ok: false, message: 'Alasan wajib diisi saat menolak pengajuan.' },
      { status: 400 },
    );
  }

  try {
    const result =
      kind === 'correction'
        ? await reviewCorrection(id, decision, reason)
        : await reviewLeave(id, decision, reason);

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof DataError ? error.message : 'Gagal memproses keputusan.',
      },
      { status: 500 },
    );
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;