import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

/**
 * Status pill.
 *
 * Colour alone never carries the meaning: every pill includes a text label, so
 * the status is still readable with colour vision deficiency or in monochrome.
 */
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-alt text-ink-secondary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  accent: 'bg-accent-soft text-accent-ink',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  /** Long-form explanation shown on hover and by screen readers. */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  CHECKED_IN: { label: 'Sedang bekerja', tone: 'success' },
  COMPLETED: { label: 'Selesai', tone: 'accent' },
  REJECTED: { label: 'Ditolak', tone: 'danger' },
  EXCUSED: { label: 'Dispensasi', tone: 'info' },
  ABSENT: { label: 'Tidak hadir', tone: 'neutral' },
  PENDING: { label: 'Menunggu', tone: 'warning' },
  APPROVED: { label: 'Disetujui', tone: 'success' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
};

export function AttendanceStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABEL[status] ?? { label: status, tone: 'neutral' as Tone };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function RequestStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABEL[status] ?? { label: status, tone: 'neutral' as Tone };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: 'Cuti tahunan',
  SICK: 'Sakit',
  PERSONAL: 'Pribadi',
  UNPAID: 'TanpaBayar',
  OTHER: 'Lainnya',
};

export function LeaveTypeBadge({ type }: { type: string }) {
  return <Badge tone="info">{LEAVE_TYPE_LABEL[type] ?? type}</Badge>;
}