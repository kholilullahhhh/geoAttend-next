/**
 * Hand-written database typings.
 *
 * Describes only the tables and RPC functions the mobile app touches. The
 * `Table<>` helper adds the `Relationships` key that supabase-js requires for
 * its generic schema, and is erased at compile time.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AppRole = 'EMPLOYEE' | 'HR' | 'ADMIN';
type AttendanceStatus = 'CHECKED_IN' | 'COMPLETED' | 'REJECTED' | 'EXCUSED' | 'ABSENT';
type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type LeaveType = 'ANNUAL' | 'SICK' | 'PERSONAL' | 'UNPAID' | 'OTHER';
type RiskCode =
  | 'LOW_ACCURACY'
  | 'OUT_OF_RADIUS'
  | 'IMPOSSIBLE_TRAVEL'
  | 'DEVICE_TIME_MISMATCH'
  | 'DUPLICATE_DEVICE';
type NotificationKind = 'ATTENDANCE' | 'LEAVE' | 'CORRECTION' | 'SYSTEM';

/**
 * Mirrors `GenericTable` from supabase-js. `Insert`/`Update` default to `never`
 * for tables that are only ever written through a SECURITY DEFINER RPC.
 */
type Table<Row, Insert = never, Update = never> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  employee_code: string | null;
  full_name: string;
  email: string;
  role: AppRole;
  department_id: string | null;
  position_title: string | null;
  phone: string | null;
  office_location_id: string | null;
  hire_date: string | null;
  avatar_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AttendanceRecordRow = {
  id: string;
  profile_id: string;
  work_date: string;
  shift_id: string | null;
  office_location_id: string | null;
  status: AttendanceStatus;
  check_in_at: string;
  check_out_at: string | null;
  check_in_latitude: number;
  check_in_longitude: number;
  check_in_accuracy_m: number;
  check_in_distance_m: number | null;
  check_in_photo_path: string;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_accuracy_m: number | null;
  check_out_distance_m: number | null;
  check_out_photo_path: string | null;
  is_late: boolean;
  late_minutes: number;
  worked_minutes: number | null;
  break_minutes: number;
  overtime_minutes: number;
  source: 'MOBILE' | 'MANUAL';
  device_id: string | null;
  risk_flags: RiskCode[];
  review_required: boolean;
  note: string | null;
  client_request_id: string;
  created_at: string;
  updated_at: string;
};

export type LeaveRequestRow = {
  id: string;
  profile_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  attachment_path: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Partial<ProfileRow> & { id: string; email: string; full_name: string }, Partial<ProfileRow>>;
      departments: Table<
        { id: string; name: string; code: string; is_active: boolean },
        { name: string; code: string; is_active?: boolean },
        Partial<{ id: string; name: string; code: string; is_active: boolean }>
      >;
      office_locations: Table<
        {
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
        },
        {
          name: string;
          code: string;
          latitude: number;
          longitude: number;
          address?: string | null;
          radius_meters?: number;
          is_active?: boolean;
        },
        Partial<{
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
        }>
      >;
      shifts: Table<
        {
          id: string;
          name: string;
          code: string;
          start_time: string;
          end_time: string;
          crosses_midnight: boolean;
          break_minutes: number;
          grace_late_minutes: number;
          early_check_in_minutes: number;
          late_check_in_minutes: number;
          work_days: number[];
          target_minutes: number;
          is_active: boolean;
        },
        { name: string; code: string; start_time: string; end_time: string; break_minutes?: number },
        never
      >;
      holidays: Table<
        { id: string; name: string; holiday_date: string; office_location_id: string | null; is_active: boolean },
        { name: string; holiday_date: string; office_location_id?: string | null },
        never
      >;
      work_schedules: Table<
        {
          id: string;
          profile_id: string;
          shift_id: string;
          office_location_id: string | null;
          effective_from: string;
          effective_to: string | null;
          is_active: boolean;
        },
        { profile_id: string; shift_id: string; effective_from: string },
        never
      >;
      attendance_records: Table<AttendanceRecordRow>;
      leave_requests: Table<LeaveRequestRow>;
      attendance_corrections: Table<{
        id: string;
        attendance_id: string;
        profile_id: string;
        requested_by: string;
        requested_check_in_at: string | null;
        requested_check_out_at: string | null;
        reason: string;
        status: RequestStatus;
        reviewed_by: string | null;
        reviewed_at: string | null;
        review_note: string | null;
        before_snapshot: Json;
        after_snapshot: Json | null;
        created_at: string;
        updated_at: string;
      }>;
      notifications: Table<
        {
          id: string;
          profile_id: string;
          kind: NotificationKind;
          title: string;
          body: string | null;
          href: string | null;
          is_read: boolean;
          created_at: string;
        },
        never,
        { is_read?: boolean }
      >;
      organization_settings: Table<{
        id: number;
        company_name: string;
        brand_accent: string;
        timezone: string;
        max_location_accuracy_m: number;
        allow_out_of_radius: boolean;
        photo_retention_days: number;
        max_photo_bytes: number;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      submit_attendance: {
        Args: {
          p_action: string;
          p_client_request_id: string;
          p_latitude: number;
          p_longitude: number;
          p_accuracy_m: number;
          p_photo_path: string;
          p_device_id?: string | null;
          p_device_captured_at?: string | null;
        };
        Returns: Json;
      };
      my_dashboard: { Args: { p_date?: string | null }; Returns: Json };
      my_work_summary: { Args: { p_from: string; p_to: string }; Returns: Json };
      // Monitoring RPCs used by the web dashboard (migration 700_analytics).
      admin_summary: {
        Args: {
          p_date?: string | null;
          p_department_id?: string | null;
          p_office_id?: string | null;
        };
        Returns: Json;
      };
      admin_attendance_list: {
        Args: {
          p_from: string;
          p_to: string;
          p_search?: string | null;
          p_department_id?: string | null;
          p_office_id?: string | null;
          p_status?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Json;
      };
      report_recap: {
        Args: {
          p_from: string;
          p_to: string;
          p_department_id?: string | null;
          p_office_id?: string | null;
        };
        Returns: Json;
      };
      admin_create_attendance: {
        Args: {
          p_profile_id: string;
          p_work_date: string;
          p_check_in_at: string;
          p_check_out_at?: string | null;
          p_note?: string | null;
        };
        Returns: Json;
      };
      request_leave: {
        Args: {
          p_type: string;
          p_start_date: string;
          p_end_date: string;
          p_reason: string;
          p_attachment_path?: string | null;
        };
        Returns: Json;
      };
      review_leave: {
        Args: { p_request_id: string; p_decision: string; p_note?: string | null };
        Returns: Json;
      };
      request_correction: {
        Args: {
          p_attendance_id: string;
          p_requested_check_in_at?: string | null;
          p_requested_check_out_at?: string | null;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      review_correction: {
        Args: { p_correction_id: string; p_decision: string; p_note?: string | null };
        Returns: Json;
      };
      mark_notifications_read: { Args: { p_ids?: string[] | null }; Returns: number };
      unread_notification_count: { Args: Record<never, never>; Returns: number };
      current_role: { Args: Record<never, never>; Returns: AppRole };
      is_hr_or_admin: { Args: Record<never, never>; Returns: boolean };
      is_admin: { Args: Record<never, never>; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      attendance_status: AttendanceStatus;
      attendance_source: 'MOBILE' | 'MANUAL';
      request_status: RequestStatus;
      leave_type: LeaveType;
      risk_code: RiskCode;
      notification_kind: NotificationKind;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
