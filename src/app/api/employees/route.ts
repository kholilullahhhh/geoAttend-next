/**
 * Employee administration endpoint.
 *
 * Mass-assignment guard: the body is whitelisted field by field, so a caller
 * cannot smuggle in `id`, `email`, or any other column. Authorization is
 * re-derived from the session; the role in the request body is treated as the
 * *desired* value, never as proof of permission.
 */
import { NextResponse } from 'next/server';

import { DataError, requireHrAdmin } from '@/lib/data';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AppRole } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES: readonly AppRole[] = ['EMPLOYEE', 'HR', 'ADMIN'];

export async function PATCH(request: Request) {
  let viewer;
  try {
    viewer = await requireHrAdmin();
  } catch (error) {
    const message = error instanceof DataError ? error.message : 'Akses ditolak.';
    return NextResponse.json({ ok: false, message }, { status: 403 });
  }

  // Only ADMIN may change roles or employment status.
  if (viewer.role !== 'ADMIN') {
    return NextResponse.json(
      { ok: false, message: 'Hanya Administrator yang dapat mengubah data karyawan.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Body JSON tidak valid.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ ok: false, message: 'Body tidak valid.' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  const id = input.id;
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, message: 'ID karyawan tidak valid.' }, { status: 400 });
  }

  // An admin must not be able to lock themselves out.
  if (id === viewer.userId) {
    return NextResponse.json(
      { ok: false, message: 'Anda tidak dapat mengubah akun Anda sendiri.' },
      { status: 400 },
    );
  }

  // Whitelist: only these keys are ever forwarded to the database.
  const patch: Record<string, unknown> = {};

  if ('role' in input) {
    if (typeof input.role !== 'string' || !ROLES.includes(input.role as AppRole)) {
      return NextResponse.json({ ok: false, message: 'Peran tidak valid.' }, { status: 400 });
    }
    patch.role = input.role;
  }

  if ('is_active' in input) {
    if (typeof input.is_active !== 'boolean') {
      return NextResponse.json(
        { ok: false, message: 'Status aktif harus berupa boolean.' },
        { status: 400 },
      );
    }
    patch.is_active = input.is_active;
  }

  for (const key of ['department_id', 'office_location_id'] as const) {
    if (!(key in input)) continue;
    const value = input[key];
    if (value === null || value === '') {
      patch[key] = null;
    } else if (typeof value === 'string' && UUID_RE.test(value)) {
      patch[key] = value;
    } else {
      return NextResponse.json({ ok: false, message: `Nilai ${key} tidak valid.` }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: 'Tidak ada perubahan.' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('profiles')
    // `patch` is a locally-built whitelist of validated scalars, never raw input.
    .update(patch as never)
    .eq('id', id);

  if (error) {
    // The privilege guard raises 42501; surface it without leaking SQL text.
    const denied = error.code === '42501';
    return NextResponse.json(
      {
        ok: false,
        message: denied
          ? 'Perubahan ditolak oleh kebijakan hak akses.'
          : 'Gagal menyimpan perubahan karyawan.',
      },
      { status: denied ? 403 : 500 },
    );
  }

  return NextResponse.json({ ok: true, message: 'Data karyawan diperbarui.' });
}
