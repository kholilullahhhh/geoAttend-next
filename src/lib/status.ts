/**
 * Status vocabulary.
 *
 * ONE definition of "what a status looks like", shared by the dashboard, the
 * filters, the charts and the toasts. The labels and tones are copied verbatim
 * from `apps/mobile/src/components/Badge.tsx` (`STATUS_LABEL` / `STATUS_TONE` /
 * `RISK_LABEL`) so a record reads identically on the employee's phone and on
 * the HR screen — before this module the two had drifted (the web called
 * `COMPLETED` "accent", the mobile called it "success"; only the mobile mapping
 * is kept, because the mobile app is what employees already recognise).
 *
 * Icons are mapped to Lucide rather than Ionicons. The mapping is chosen to
 * match the mobile glyph's *shape*, not its name, so `CHECKED_IN` still reads
 * as a filled dot in both apps.
 *
 * Every entry is paired with a text label. Colour is never the only signal.
 */
import type { ComponentType, SVGProps } from 'react';
import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleMinus,
  CircleSlash,
  CircleX,
  Clock,
} from 'lucide-react';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface StatusSpec {
  /** Human label. Shown in badges, filters and chart legends alike. */
  label: string;
  tone: Tone;
  icon: Icon;
}

/** Attendance statuses, from `attendance_records.status`. */
export const ATTENDANCE_STATUS: Record<string, StatusSpec> = {
  CHECKED_IN: { label: 'Sedang bekerja', tone: 'info', icon: CircleDot },
  COMPLETED: { label: 'Selesai', tone: 'success', icon: CircleCheck },
  REJECTED: { label: 'Ditolak', tone: 'danger', icon: CircleX },
  EXCUSED: { label: 'Dispensasi', tone: 'neutral', icon: CircleMinus },
  ABSENT: { label: 'Tidak hadir', tone: 'danger', icon: CircleAlert },
};

/** Workflow statuses, from `leave_requests.status` / `attendance_corrections.status`. */
export const REQUEST_STATUS: Record<string, StatusSpec> = {
  PENDING: { label: 'Menunggu', tone: 'warning', icon: Clock },
  APPROVED: { label: 'Disetujui', tone: 'success', icon: CircleCheck },
  REJECTED: { label: 'Ditolak', tone: 'danger', icon: CircleX },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral', icon: CircleSlash },
};

/** Ordering used by every status filter, so dropdown and chip never disagree. */
export const ATTENDANCE_STATUS_ORDER = [
  'CHECKED_IN',
  'COMPLETED',
  'REJECTED',
  'EXCUSED',
  'ABSENT',
] as const;

export const REQUEST_STATUS_ORDER = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;

const FALLBACK: StatusSpec = {
  label: 'Tidak dikenal',
  tone: 'neutral',
  icon: CircleAlert,
};

/**
 * Resolve a code, degrading to a labelled placeholder rather than to the raw
 * enum. An unknown code must never render as an empty badge — a blank cell in a
 * status column is indistinguishable from a rendering bug.
 */
export function attendanceStatus(code: string | null | undefined): StatusSpec {
  return (code && ATTENDANCE_STATUS[code]) || FALLBACK;
}

export function requestStatus(code: string | null | undefined): StatusSpec {
  return (code && REQUEST_STATUS[code]) || FALLBACK;
}

export function statusLabel(code: string | null | undefined): string {
  return attendanceStatus(code).label;
}

// ---------------------------------------------------------------------------
// Risk flags
// ---------------------------------------------------------------------------

export const RISK_LABEL: Record<string, string> = {
  LOW_ACCURACY: 'GPS kurang akurat',
  OUT_OF_RADIUS: 'Di luar area kantor',
  IMPOSSIBLE_TRAVEL: 'Perjalanan tidak masuk akal',
  DEVICE_TIME_MISMATCH: 'Waktu perangkat tidak sinkron',
  DUPLICATE_DEVICE: 'Perangkat berbeda',
};

/**
 * Longer explanation, shown as a tooltip and in the attendance detail page.
 *
 * These are *signals for human review*, not proof of wrongdoing. GPS alone
 * cannot prove a location is genuine, so the wording stays neutral and never
 * asserts misconduct.
 */
export const RISK_HELP: Record<string, string> = {
  LOW_ACCURACY:
    'Akurasi GPS di ambang batas batas toleransi lokasi kantor. Titik yang tercatat masih bisa bergeser beberapa puluh meter.',
  OUT_OF_RADIUS:
    'Check-in tercatat di luar radius geofence kantor. Tepatnya di sekitar lokasi yang ditentukan.',
  IMPOSSIBLE_TRAVEL:
    'Perpindahan antara dua check-in terlalu cepat untuk jarak tempuhnya. Sering terjadi karena manipulasi waktu perangkat.',
  DEVICE_TIME_MISMATCH:
    'Jam perangkat berbeda dari waktu server. Perhitungan keterlambatan tetap memakai waktu server.',
  DUPLICATE_DEVICE: 'Perangkat yang sama dipakai oleh lebih dari satu akun.',
};

/** Terseer label for dense table cells; the long form lives in `RISK_HELP`. */
export const RISK_SHORT: Record<string, string> = {
  LOW_ACCURACY: 'GPS lemah',
  OUT_OF_RADIUS: 'Di luar radius',
  IMPOSSIBLE_TRAVEL: 'Perjalanan mustahil',
  DEVICE_TIME_MISMATCH: 'Jam perangkat beda',
  DUPLICATE_DEVICE: 'Perangkat ganda',
};

// ---------------------------------------------------------------------------
// Other enums
// ---------------------------------------------------------------------------

export const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: 'Cuti tahunan',
  SICK: 'Sakit',
  PERSONAL: 'Pribadi',
  UNPAID: 'Tanpa bayar',
  OTHER: 'Lainnya',
};

export const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Karyawan',
  HR: 'HRD',
  ADMIN: 'Administrator',
};