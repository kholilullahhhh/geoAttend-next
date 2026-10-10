/**
 * Display formatting.
 *
 * All timestamps coming from the server are `timestamptz` (UTC). They are
 * rendered in the organisation's time zone, which is a database setting, so the
 * formatter takes it as an argument rather than assuming the viewer's locale.
 */
import { FALLBACK_TIMEZONE } from './brand';

/** "08:05" */
export function formatTime(iso: string | null | undefined, timeZone = FALLBACK_TIMEZONE): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(d);
}

/** "10 Okt 2026" */
export function formatDate(
  iso: string | null | undefined,
  timeZone = FALLBACK_TIMEZONE,
): string {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(d);
}

/** "10 Okt, 08:05" */
export function formatDateTime(
  iso: string | null | undefined,
  timeZone = FALLBACK_TIMEZONE,
): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(d);
}

/** "8j 12m" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}j` : `${h}j ${m}m`;
}

/** "142 m" / "1.4 km" */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return '-';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** "+6.4", "-0.2" — signed coordinate with fixed precision. */
export function formatCoord(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toFixed(6);
}

/** "2 menit lalu" */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '-';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '-';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 45) return 'baru saja';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} menit lalu`;
  if (diffSec < 86_400) return `${Math.round(diffSec / 3600)} jam lalu`;
  return `${Math.round(diffSec / 86_400)} hari lalu`;
}

/** `YYYY-MM-DD` for `n` days before today in the given zone. */
export function isoDaysAgo(days: number, timeZone = FALLBACK_TIMEZONE): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
}

/** Today's date in the organisation zone. */
export function isoToday(timeZone = FALLBACK_TIMEZONE): string {
  return isoDaysAgo(0, timeZone);
}

/** Inclusive list of `YYYY-MM-DD` between two dates, capped for safety. */
export function isoRange(from: string, to: string, cap = 400): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  for (let d = start; d <= end && out.length < cap; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** "Sen" for a `YYYY-MM-DD` string. */
export function weekdayShort(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return WEEKDAYS[d.getUTCDay()] ?? '';
}

/** Alias used by the charts, which label axes rather than render prose. */
export const formatWeekdayShort = weekdayShort;

/** Short label for the ISO work-day codes stored on a shift (1 = Mon). */
export function formatWorkDays(days: number[] | null | undefined): string {
  if (!Array.isArray(days) || days.length === 0 || days.length === 7) return 'Setiap hari';
  const names = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  return [...days].sort((a, b) => a - b).map((d) => names[d - 1] ?? '?').join(', ');
}

/** "HH:MM" from a Postgres `time` value ("08:30:00"). */
export function formatTimeOfDay(time: string | null | undefined): string {
  if (!time) return '--:--';
  return time.slice(0, 5);
}