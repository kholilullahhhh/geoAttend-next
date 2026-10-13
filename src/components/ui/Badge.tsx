import type { ReactNode } from 'react';

import { iconSize } from '@/lib/design';
import {
  attendanceStatus,
  requestStatus,
  type Icon,
  type Tone,
} from '@/lib/status';

/**
 * Status pill.
 *
 * Mirrors `apps/mobile/src/components/Badge.tsx`: pill radius, a label that is
 * always present, and an optional glyph so state survives colour-vision
 * deficiency and a greyscale print.
 *
 * Note the radius. This used to be `rounded-sm`, and `rounded-pill` elsewhere
 * silently emitted no CSS at all because `--radius-pill` had never been
 * declared. Both are fixed by the token now.
 */
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-alt text-ink-secondary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  accent: 'bg-accent-soft text-accent-ink',
};

const SIZES = {
  sm: { box: 'size-3.5', text: 'text-2xs', pad: 'px-2 py-0.5 gap-1' },
  md: { box: 'size-4', text: 'text-xs', pad: 'px-2.5 py-1 gap-1.5' },
} as const;

export interface BadgeProps {
  tone?: Tone;
  size?: keyof typeof SIZES;
  children: ReactNode;
  className?: string;
  /** Long-form explanation shown on hover and read by screen readers. */
  title?: string;
  /** Opt-in glyph. Omit where the surrounding text already carries the state. */
  icon?: Icon;
}

export function Badge({
  tone = 'neutral',
  size = 'md',
  children,
  className = '',
  title,
  icon: Icon,
}: BadgeProps) {
  const s = SIZES[size];
  const Glyph = Icon;
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center rounded-pill font-semibold whitespace-nowrap ${s.pad} ${s.text} ${TONES[tone]} ${className}`}
    >
      {Glyph ? <Glyph className={s.box} aria-hidden="true" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Badge for an `attendance_records.status` code, including the glyph.
 *
 * Sizing the glyph to the badge rather than to a fixed icon size is what keeps
 * a dense table from looking like a row of mismatched stickers.
 */
export function AttendanceStatusBadge({
  status,
  size = 'md',
}: {
  status: string;
  size?: keyof typeof SIZES;
}) {
  const spec = attendanceStatus(status);
  return (
    <Badge tone={spec.tone} size={size} icon={spec.icon}>
      {spec.label}
    </Badge>
  );
}

/** Badge for a leave/correction workflow status. */
export function RequestStatusBadge({
  status,
  size = 'md',
}: {
  status: string;
  size?: keyof typeof SIZES;
}) {
  const spec = requestStatus(status);
  return (
    <Badge tone={spec.tone} size={size} icon={spec.icon}>
      {spec.label}
    </Badge>
  );
}

/** Neutral badge for reference data such as departments, shifts and offices. */
export function MetaBadge({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <Badge tone="neutral" size="sm" title={title} className={className}>
      {children}
    </Badge>
  );
}

/** Dot used where a full badge would crowd a table cell. Always beside text. */
export function ToneDot({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 rounded-pill ${
        tone === 'neutral'
          ? 'bg-ink-muted'
          : tone === 'success'
            ? 'bg-success-bright'
            : tone === 'warning'
              ? 'bg-warning-bright'
              : tone === 'danger'
                ? 'bg-danger'
                : tone === 'info'
                  ? 'bg-info-bright'
                  : 'bg-accent-bright'
      }`}
    />
  );
}

export { iconSize };