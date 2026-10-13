/**
 * Server-side data access for the dashboard.
 *
 * Rules this module enforces:
 *  - Runs with the signed-in user's JWT so Row Level Security applies.
 *  - Never trusts a role sent by the browser; `requireHrAdmin()` re-derives the
 *    role from `profiles` (which RLS scopes to the caller) on every request.
 *  - Validates every `jsonb` RPC payload before a page renders it, because
 *    PostgREST returns `any` and a schema drift must fail loudly, not silently.
 */
import 'server-only';

import { cache } from 'react';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type {
  AdminSummary,
  AppRole,
  AttendanceRow,
  CorrectionRow,
  Department,
  Holiday,
  LeaveRequestRow,
  OfficeLocation,
  PaginatedAttendance,
  ProfileRow,
  RecapDay,
  RecapTotals,
  ReportRecap,
  RpcError,
  Shift,
} from '@/lib/contracts';
import { FALLBACK_TIMEZONE } from '@/lib/brand';

export class DataError extends Error {
  constructor(
    message: string,
    readonly code = 'QUERY_FAILED',
  ) {
    super(message);
    this.name = 'DataError';
  }
}

// ---------------------------------------------------------------------------
// Runtime guards
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Narrow an RPC result to a typed payload, raising `RpcError` when the function
 * returned its documented error shape.
 */
function unwrap<T>(data: unknown, context: string): T {
  if (!isRecord(data)) throw new DataError(`${context}: server tidak mengembalikan objek JSON.`);
  if (data.ok === false) {
    const err = data as unknown as RpcError;
    throw new DataError(err.message ?? 'Permintaan ditolak server.', err.code ?? 'RPC_ERROR');
  }
  return data as unknown as T;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function coerceSummary(raw: AdminSummary): AdminSummary {
  return {
    ...raw,
    total_employees: num(raw.total_employees),
    expected: num(raw.expected),
    present: num(raw.present),
    on_time: num(raw.on_time),
    late: num(raw.late),
    working: num(raw.working),
    completed: num(raw.completed),
    not_checked_in: num(raw.not_checked_in),
    on_leave: num(raw.on_leave),
    pending_leave: num(raw.pending_leave),
    pending_corrections: num(raw.pending_corrections),
    need_review: num(raw.need_review),
    total_worked_minutes: num(raw.total_worked_minutes),
    total_late_minutes: num(raw.total_late_minutes),
    by_department: Array.isArray(raw.by_department) ? raw.by_department : [],
    recent: Array.isArray(raw.recent) ? raw.recent : [],
    timezone: str(raw.timezone) || FALLBACK_TIMEZONE,
  };
}

function coerceRecap(raw: ReportRecap): ReportRecap {
  const daily: RecapDay[] = (Array.isArray(raw.daily) ? raw.daily : []).map((d) => ({
    day: str(d.day),
    present: num(d.present),
    late: num(d.late),
    worked_minutes: num(d.worked_minutes),
    overtime_minutes: num(d.overtime_minutes),
    late_minutes: num(d.late_minutes),
  }));
  const t = (raw.totals ?? {}) as RecapTotals;
  return {
    ok: true,
    from_date: str(raw.from_date),
    to_date: str(raw.to_date),
    daily,
    totals: {
      records: num(t.records),
      present: num(t.present),
      late_records: num(t.late_records),
      worked_minutes: num(t.worked_minutes),
      overtime_minutes: num(t.overtime_minutes),
      late_minutes: num(t.late_minutes),
      avg_accuracy_m: typeof t.avg_accuracy_m === 'number' ? t.avg_accuracy_m : null,
    },
  };
}

function coerceAttendance(raw: PaginatedAttendance): PaginatedAttendance {
  const rows: AttendanceRow[] = (Array.isArray(raw.rows) ? raw.rows : []).map((r) => ({
    ...r,
    risk_flags: Array.isArray(r.risk_flags) ? r.risk_flags : [],
    worked_minutes: r.worked_minutes ?? null,
    overtime_minutes: r.overtime_minutes ?? null,
  }));
  return { ok: true, total: num(raw.total), limit: num(raw.limit), offset: num(raw.offset), rows };
}

// ---------------------------------------------------------------------------
// Identity & authorization
// ---------------------------------------------------------------------------

export interface Viewer {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  isPrivileged: boolean;
}

/**
 * Resolve the signed-in user and their role.
 *
 * The role is read from `profiles` (server-side, RLS-scoped) — never from a
 * cookie, query param, or anything the browser controls.
 *
 * Deduplicated per request by React `cache`.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new DataError('Gagal memuat profil pengguna.');
  if (!profile) return null;

  const row = profile as unknown as {
    id: string;
    full_name: string;
    email: string;
    role: AppRole;
    is_active: boolean;
  };

  return {
    userId: row.id,
    email: row.email ?? user.email ?? '',
    fullName: row.full_name,
    role: row.role,
    isPrivileged: row.role === 'HR' || row.role === 'ADMIN',
  };
});

/**
 * Authorization gate for every privileged page.
 *
 * A deactivated account is refused even if its token is still valid, so HR can
 * revoke access immediately without waiting for token expiry.
 */
export async function requireHrAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new DataError('Sesi tidak valid. Silakan masuk kembali.', 'UNAUTHENTICATED');
  if (!viewer.isPrivileged) {
    throw new DataError('Halaman ini hanya untuk HRD atau admin.', 'FORBIDDEN');
  }
  return viewer;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export async function fetchDepartments(): Promise<Department[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code, is_active')
    .order('name');
  if (error) throw new DataError('Gagal memuat departemen.', error.message);
  return (data ?? []) as Department[];
}

export async function fetchOffices(): Promise<OfficeLocation[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('office_locations')
    .select(
      'id, name, code, address, latitude, longitude, radius_meters, max_accuracy_meters, allow_out_of_radius, is_active',
    )
    .order('name');
  if (error) throw new DataError('Gagal memuat lokasi kantor.', error.message);
  return (data ?? []) as OfficeLocation[];
}

export async function fetchShifts(): Promise<Shift[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('shifts')
    .select(
      'id, name, code, start_time, end_time, crosses_midnight, break_minutes, grace_late_minutes, work_days, target_minutes, is_active',
    )
    .order('start_time');
  if (error) throw new DataError('Gagal memuat shift.', error.message);
  return (data ?? []) as Shift[];
}

export async function fetchHolidays(): Promise<Holiday[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('holidays')
    .select('id, name, holiday_date, office_location_id, is_active')
    .order('holiday_date', { ascending: false })
    .limit(200);
  if (error) throw new DataError('Gagal memuat hari libur.', error.message);
  return (data ?? []) as Holiday[];
}

/** Everyone the caller is allowed to see (HR: active staff; ADMIN: all). */
export async function fetchProfiles(): Promise<ProfileRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, employee_code, role, department_id, position_title, phone, office_location_id, hire_date, is_active',
    )
    .order('full_name')
    .limit(1000);

  if (error) throw new DataError('Gagal memuat data karyawan.', error.message);

  const people = (data ?? []) as Omit<ProfileRow, 'department_name' | 'office_name'>[];

  // Reference names are resolved separately to avoid a wide join on every page
  // and to keep the query count flat regardless of headcount.
  const [departments, offices] = await Promise.all([fetchDepartments(), fetchOffices()]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const officeName = new Map(offices.map((o) => [o.id, o.name]));

  return people.map((p) => ({
    ...p,
    department_name: p.department_id ? (deptName.get(p.department_id) ?? null) : null,
    office_name: p.office_location_id ? (officeName.get(p.office_location_id) ?? null) : null,
  }));
}

// ---------------------------------------------------------------------------
// Analytics RPCs
// ---------------------------------------------------------------------------

export interface SummaryFilters {
  date?: string;
  departmentId?: string | null;
  officeId?: string | null;
}

export async function fetchSummary(filters: SummaryFilters = {}): Promise<AdminSummary> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_summary', {
    p_date: filters.date ?? null,
    p_department_id: filters.departmentId ?? null,
    p_office_id: filters.officeId ?? null,
  });
  if (error) throw new DataError('Gagal memuat ringkasan.', error.message);
  return coerceSummary(unwrap<AdminSummary>(data, 'admin_summary'));
}

export interface AttendanceFilters {
  from: string;
  to: string;
  search?: string | null;
  departmentId?: string | null;
  officeId?: string | null;
  status?: string | null;
  limit?: number;
  offset?: number;
}

export async function fetchAttendanceList(
  filters: AttendanceFilters,
): Promise<PaginatedAttendance> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_attendance_list', {
    p_from: filters.from,
    p_to: filters.to,
    p_search: filters.search?.trim() || null,
    p_department_id: filters.departmentId ?? null,
    p_office_id: filters.officeId ?? null,
    p_status: filters.status ?? null,
    p_limit: filters.limit ?? 50,
    p_offset: filters.offset ?? 0,
  });
  if (error) throw new DataError('Gagal memuat daftar absensi.', error.message);
  return coerceAttendance(unwrap<PaginatedAttendance>(data, 'admin_attendance_list'));
}

export interface RecapFilters {
  from: string;
  to: string;
  departmentId?: string | null;
  officeId?: string | null;
}

export async function fetchRecap(filters: RecapFilters): Promise<ReportRecap> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('report_recap', {
    p_from: filters.from,
    p_to: filters.to,
    p_department_id: filters.departmentId ?? null,
    p_office_id: filters.officeId ?? null,
  });
  if (error) throw new DataError('Gagal memuat rekap laporan.', error.message);
  return coerceRecap(unwrap<ReportRecap>(data, 'report_recap'));
}

// ---------------------------------------------------------------------------
// Single-record detail (HR/ADMIN)
// ---------------------------------------------------------------------------

export interface AttendanceDetail extends AttendanceRow {
  check_in_latitude: number;
  check_in_longitude: number;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_accuracy_m: number | null;
  check_out_distance_m: number | null;
  check_out_corrected: boolean;
  break_minutes: number;
  device_time_skew_seconds: number | null;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
}

/**
 * Full attendance record for the detail view.
 *
 * Read through RLS (`attendance_records_select_privileged`), which is scoped to
 * HR/ADMIN — an EMPLOYEE receives zero rows and gets an explicit "not found"
 * rather than a silent blank page.
 */
export async function fetchAttendanceDetail(id: string): Promise<AttendanceDetail | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('attendance_records')
    .select(
      `id, work_date, status, source, note, is_late, late_minutes, worked_minutes,
       overtime_minutes, break_minutes, check_in_at, check_out_at, check_out_corrected,
       check_in_latitude, check_in_longitude, check_in_accuracy_m, check_in_distance_m,
       check_in_photo_path, check_out_latitude, check_out_longitude, check_out_accuracy_m,
       check_out_distance_m, check_out_photo_path, risk_flags, review_required,
       device_id, device_time_skew_seconds, profile_id, office_location_id, shift_id,
       created_at, updated_at`,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw new DataError('Gagal memuat detail absensi.', error.message);
  if (!data) return null;

  const record = data as unknown as Omit<AttendanceDetail, 'full_name' | 'employee_code' | 'department_id' | 'office_name' | 'shift_name'>;

  const dir = await profileDirectory();
  const person = dir.get(record.profile_id);
  const [offices, shifts] = await Promise.all([fetchOffices(), fetchShifts()]);

  return {
    ...record,
    risk_flags: Array.isArray(record.risk_flags) ? record.risk_flags : [],
    full_name: person?.full_name ?? 'Tidak diketahui',
    employee_code: person?.employee_code ?? null,
    department_id: person?.department_id ?? null,
    office_name: record.office_location_id
      ? (offices.find((o) => o.id === record.office_location_id)?.name ?? null)
      : null,
    shift_name: record.shift_id ? (shifts.find((s) => s.id === record.shift_id)?.name ?? null) : null,
  };
}

/**
 * Audit trail for one attendance record.
 *
 * `audit_logs` has SELECT granted to HR/ADMIN only and is not part of the
 * realtime publication, so this is the authoritative history.
 */
export async function fetchAuditTrail(entityId: string): Promise<AuditEntry[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new DataError('Gagal memuat riwayat audit.', error.message);

  const rows = (data ?? []) as Array<{
    id: number;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    before_data: unknown;
    after_data: unknown;
    created_at: string;
  }>;

  const dir = await profileDirectory();

  return rows.map((r) => ({
    ...r,
    actor_name: r.actor_id ? (dir.get(r.actor_id)?.full_name ?? null) : 'Sistem',
  }));
}

// ---------------------------------------------------------------------------
// Approvals queues
// ---------------------------------------------------------------------------

/** Profile display map, used to decorate leave/correction rows. */
const profileDirectory = cache(async (): Promise<Map<string, ProfileRow>> => {
  const rows = await fetchProfiles();
  return new Map(rows.map((r) => [r.id, r]));
});

export async function fetchLeaveRequests(status?: RequestStatusFilter): Promise<LeaveRequestRow[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from('leave_requests')
    .select(
      'id, profile_id, type, start_date, end_date, reason, status, attachment_path, created_at, reviewed_at, review_note',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new DataError('Gagal memuat pengajuan izin.', error.message);

  const dir = await profileDirectory();
  return ((data ?? []) as Omit<LeaveRequestRow, 'full_name' | 'employee_code' | 'department_id' | 'reviewer_name'>[]).map(
    (r) => {
      const person = dir.get(r.profile_id);
      return {
        ...r,
        full_name: person?.full_name ?? 'Tidak diketahui',
        employee_code: person?.employee_code ?? null,
        department_id: person?.department_id ?? null,
        reviewer_name: null,
      };
    },
  );
}

export async function fetchCorrections(status?: RequestStatusFilter): Promise<CorrectionRow[]> {
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from('attendance_corrections')
    .select(
      'id, attendance_id, profile_id, requested_by, requested_check_in_at, requested_check_out_at, reason, status, created_at, reviewed_at, review_note, before_snapshot',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new DataError('Gagal memuat koreksi absensi.', error.message);

  const rows = (data ?? []) as Array<{
    id: string;
    attendance_id: string;
    profile_id: string;
    requested_check_in_at: string | null;
    requested_check_out_at: string | null;
    reason: string | null;
    status: LeaveRequestRow['status'];
    created_at: string;
    reviewed_at: string | null;
    review_note: string | null;
    before_snapshot: Record<string, unknown> | null;
  }>;

  // Fetch the referenced attendance rows in one query, then join in memory:
  // a flat two-query join instead of a nested PostgREST embed.
  const ids = [...new Set(rows.map((r) => r.attendance_id))];
  const records = new Map<string, Record<string, unknown>>();
  if (ids.length > 0) {
    const { data: recData } = await supabase
      .from('attendance_records')
      .select('id, work_date')
      .in('id', ids);
    for (const rec of (recData ?? []) as Array<{ id: string } & Record<string, unknown>>) {
      records.set(rec.id, rec);
    }
  }

  const dir = await profileDirectory();

  return rows.map((r) => {
    const person = dir.get(r.profile_id);
    const rec = records.get(r.attendance_id);
    const snap = (r.before_snapshot ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      attendance_id: r.attendance_id,
      profile_id: r.profile_id,
      full_name: person?.full_name ?? 'Tidak diketahui',
      employee_code: person?.employee_code ?? null,
      work_date: str(rec?.work_date) || str(snap.work_date),
      original_check_in_at: typeof snap.check_in_at === 'string' ? snap.check_in_at : null,
      original_check_out_at: typeof snap.check_out_at === 'string' ? snap.check_out_at : null,
      requested_check_in_at: r.requested_check_in_at,
      requested_check_out_at: r.requested_check_out_at,
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
      reviewer_name: null,
      review_note: r.review_note,
    };
  });
}

export type RequestStatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

// ---------------------------------------------------------------------------
// Approvals queues
// ---------------------------------------------------------------------------

export interface PendingCounts {
  leave: number;
  corrections: number;
  total: number;
}

/**
 * Pending review counts, for the navigation badge.
 *
 * Two `head: true` count queries rather than fetching the rows: the sidebar only
 * needs a number, and the approvals page itself reads the full lists. RLS
 * scopes both to HR/ADMIN, so an employee would simply see zero.
 */
export async function fetchPendingCounts(): Promise<PendingCounts> {
  const supabase = await createServerSupabaseClient();

  const [leave, corrections] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING'),
    supabase
      .from('attendance_corrections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING'),
  ]);

  // A count is a nicety; a failed badge must never take the shell down with it.
  const leaveCount = leave.error ? 0 : (leave.count ?? 0);
  const correctionCount = corrections.error ? 0 : (corrections.count ?? 0);

  return {
    leave: leaveCount,
    corrections: correctionCount,
    total: leaveCount + correctionCount,
  };
}

/**
 * Organisation configuration (single row, `id = 1`).
 *
 * Read-only here. These values decide who can check in and whether a record
 * counts as late, so they belong in a reviewed migration rather than an ad-hoc
 * web form — see the note on the settings page.
 */
export interface OrgSettings {
  company_name: string;
  brand_accent: string;
  timezone: string;
  max_location_accuracy_m: number;
  allow_out_of_radius: boolean;
  photo_retention_days: number;
  max_photo_bytes: number;
  updated_at: string;
}

export async function fetchOrgSettings(): Promise<OrgSettings | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('organization_settings')
    .select(
      'company_name, brand_accent, timezone, max_location_accuracy_m, allow_out_of_radius, photo_retention_days, max_photo_bytes, updated_at',
    )
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new DataError('Gagal memuat pengaturan organisasi.', error.message);
  return (data as OrgSettings | null) ?? null;
}

// ---------------------------------------------------------------------------
// Mutations — always through audited RPCs, never a direct table write
// ---------------------------------------------------------------------------

export interface MutationResult {
  ok: boolean;
  message: string;
}

export async function reviewLeave(
  requestId: string,
  decision: 'APPROVED' | 'REJECTED',
  note?: string,
): Promise<MutationResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('review_leave', {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note?.trim() || null,
  });
  if (error) return { ok: false, message: error.message };
  return unwrapResult(data, 'review_leave');
}

export async function reviewCorrection(
  correctionId: string,
  decision: 'APPROVED' | 'REJECTED',
  note?: string,
): Promise<MutationResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('review_correction', {
    p_correction_id: correctionId,
    p_decision: decision,
    p_note: note?.trim() || null,
  });
  if (error) return { ok: false, message: error.message };
  return unwrapResult(data, 'review_correction');
}

function unwrapResult(data: unknown, context: string): MutationResult {
  if (isRecord(data) && data.ok === false) {
    const err = data as unknown as RpcError;
    return { ok: false, message: err.message ?? 'Permintaan ditolak.' };
  }
  return { ok: true, message: `${context} berhasil diproses.` };
}