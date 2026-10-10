/**
 * Typed shapes for the admin RPC payloads.
 *
 * Every function in `supabase/migrations/*_analytics.sql` and
 * `*_workflow_rpcs.sql` returns `jsonb`, so TypeScript cannot help us at the
 * call site. These interfaces are the contract, and they are validated at
 * runtime in `parse.ts` before a page renders them — a shape drift surfaces as a
 * clear error rather than `undefined` deep inside a table cell.
 *
 * Field names here must stay identical to the SQL `jsonb_build_object` keys.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type AppRole = 'EMPLOYEE' | 'HR' | 'ADMIN';
export type AttendanceStatus = 'CHECKED_IN' | 'COMPLETED' | 'REJECTED' | 'EXCUSED' | 'ABSENT';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type LeaveType = 'ANNUAL' | 'SICK' | 'PERSONAL' | 'UNPAID' | 'OTHER';
export type Decision = 'APPROVED' | 'REJECTED';

export type RiskCode =
  | 'LOW_ACCURACY'
  | 'OUT_OF_RADIUS'
  | 'IMPOSSIBLE_TRAVEL'
  | 'DEVICE_TIME_MISMATCH'
  | 'DUPLICATE_DEVICE';

/** Every RPC failure has this shape (`rpc_error()` in migration 300). */
export interface RpcError {
  ok: false;
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// admin_summary(date, uuid, uuid)
// ---------------------------------------------------------------------------

export interface DepartmentBreakdown {
  department_id: string | null;
  name: string;
  present: number;
  late: number;
  total: number;
}

export interface RecentAttendance {
  id: string;
  work_date: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  is_late: boolean;
  late_minutes: number;
  worked_minutes: number | null;
  check_in_distance_m: number | null;
  check_in_accuracy_m: number | null;
  check_in_photo_path: string | null;
  risk_flags: RiskCode[] | null;
  review_required: boolean;
  office_location_id: string | null;
  shift_id: string | null;
  full_name: string;
  employee_code: string | null;
  department_id: string | null;
  office_name: string | null;
}

export interface AdminSummary {
  ok: true;
  date: string;
  timezone: string;
  generated_at: string;
  total_employees: number;
  expected: number;
  present: number;
  on_time: number;
  late: number;
  working: number;
  completed: number;
  not_checked_in: number;
  on_leave: number;
  pending_leave: number;
  pending_corrections: number;
  need_review: number;
  total_worked_minutes: number;
  total_late_minutes: number;
  by_department: DepartmentBreakdown[] | null;
  recent: RecentAttendance[] | null;
}

// ---------------------------------------------------------------------------
// admin_attendance_list(date, date, text, uuid, uuid, text, integer, integer)
// ---------------------------------------------------------------------------

export interface AttendanceRow {
  id: string;
  work_date: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  is_late: boolean;
  late_minutes: number;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy_m: number | null;
  check_in_distance_m: number | null;
  check_in_photo_path: string | null;
  check_out_photo_path: string | null;
  risk_flags: RiskCode[] | null;
  review_required: boolean;
  note: string | null;
  source: 'MOBILE' | 'MANUAL';
  profile_id: string;
  full_name: string;
  employee_code: string | null;
  department_id: string | null;
  office_location_id: string | null;
  office_name: string | null;
  shift_id: string | null;
  shift_name: string | null;
}

export interface PaginatedAttendance {
  ok: true;
  total: number;
  limit: number;
  offset: number;
  rows: AttendanceRow[] | null;
}

// ---------------------------------------------------------------------------
// report_recap(date, date, uuid, uuid)
// ---------------------------------------------------------------------------

export interface RecapDay {
  day: string;
  present: number;
  late: number;
  worked_minutes: number;
  overtime_minutes: number;
  late_minutes: number;
}

export interface RecapTotals {
  records: number;
  present: number;
  late_records: number;
  worked_minutes: number;
  overtime_minutes: number;
  late_minutes: number;
  avg_accuracy_m: number | null;
}

export interface ReportRecap {
  ok: true;
  from_date: string;
  to_date: string;
  daily: RecapDay[] | null;
  totals: RecapTotals;
}

// ---------------------------------------------------------------------------
// Workflow RPCs
// ---------------------------------------------------------------------------

export interface LeaveRequestRow {
  id: string;
  profile_id: string;
  full_name: string;
  employee_code: string | null;
  department_id: string | null;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  status: RequestStatus;
  attachment_path: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewer_name: string | null;
  review_note: string | null;
}

export interface CorrectionRow {
  id: string;
  attendance_id: string;
  profile_id: string;
  full_name: string;
  employee_code: string | null;
  work_date: string;
  original_check_in_at: string | null;
  original_check_out_at: string | null;
  requested_check_in_at: string | null;
  requested_check_out_at: string | null;
  reason: string | null;
  status: RequestStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewer_name: string | null;
  review_note: string | null;
}

/** Generic acknowledgement returned by the review RPCs on success. */
export interface WorkflowAck {
  ok: true;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Reference data (read through RLS, admin-writable)
// ---------------------------------------------------------------------------

export interface Department {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface OfficeLocation {
  id: string;
  name: string;
  code: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  max_accuracy_meters: number | null;
  allow_out_of_radius: boolean | null;
  is_active: boolean;
}

export interface Shift {
  id: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
  break_minutes: number;
  grace_late_minutes: number;
  work_days: number[];
  target_minutes: number;
  is_active: boolean;
}

export interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  office_location_id: string | null;
  is_active: boolean;
}

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  employee_code: string | null;
  role: AppRole;
  department_id: string | null;
  department_name: string | null;
  position_title: string | null;
  phone: string | null;
  office_location_id: string | null;
  office_name: string | null;
  hire_date: string | null;
  is_active: boolean;
}