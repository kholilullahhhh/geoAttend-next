import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import type { Tone } from '@/lib/status';

/**
 * Headline metric.
 *
 * Hierarchy is deliberate. A grid of eight identical tiles reads as a wall and
 * hides the two numbers that actually need a decision. So there are two forms:
 *
 *  - `MetricHero`  — one per page. Large, with an occupancy bar underneath, for
 *                    the single figure the page is about.
 *  - `Metric`      — the supporting row. Compact, uniform weight, tone applied
 *                    only where a non-zero value needs attention.
 *
 * A tone is never the only signal: the label, the value and the sub-text carry
 * the meaning, so removing the colour loses nothing.
 */

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  accent: 'text-accent-ink',
};

const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-surface-alt text-ink-secondary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  accent: 'bg-accent-soft text-accent-ink',
};

export interface MetricProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  /** Renders the whole tile as a link to the relevant page. */
  href?: string;
  className?: string;
}

export function Metric({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
  href,
  className = '',
}: MetricProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
          {label}
        </p>
        {icon && (
          <span
            aria-hidden="true"
            className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md ${TONE_ICON[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>
      <p className={`tabular mt-1.5 text-xl font-semibold tracking-tight ${TONE_TEXT[tone]}`}>
        {value}
      </p>
      {sub && <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">{sub}</div>}
    </>
  );

  const shell = `rounded-lg border border-line bg-surface p-md ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`group block ${shell} no-underline transition-colors hover:border-line-strong hover:bg-surface-alt/50`}
      >
        {body}
        <span className="mt-2 inline-flex items-center gap-1 text-2xs font-semibold text-accent-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Lihat detail
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </span>
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}

/**
 * The one figure a page is about.
 *
 * The bar underneath is a stacked occupancy strip — on-time, late, away,
 * not-checked-in — rather than a decorative gauge. Each segment carries a
 * label below, so the colours are a lookup aid and not the message.
 */
export function MetricHero({
  label,
  value,
  sub,
  segments,
  footer,
  action,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Ordered segments of the occupancy strip. Omit `value` to hide a segment. */
  segments: Array<{ key: string; label: string; value: number; tone: Tone }>;
  footer?: ReactNode;
  action?: ReactNode;
}) {
  const total = segments.reduce((sum, s) => sum + (Number.isFinite(s.value) ? s.value : 0), 0);

  return (
    <section className="flex flex-col rounded-lg border border-line bg-surface p-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
          <p className="tabular mt-1.5 text-3xl font-semibold tracking-tight text-ink text-balance sm:text-4xl">
            {value}
          </p>
          {sub && <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{sub}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {total > 0 && (
        <div className="mt-lg">
          <div
            className="flex h-2 w-full overflow-hidden rounded-pill bg-surface-sunken"
            role="img"
            aria-label={segments
              .filter((s) => s.value > 0)
              .map((s) => `${s.label} ${s.value}`)
              .join(', ')}
          >
            {segments.map((s) =>
              s.value > 0 ? (
                <span
                  key={s.key}
                  className={SEGMENT_FILL[s.tone]}
                  style={{ width: `${(s.value / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={`size-2 rounded-pill ${SEGMENT_FILL[s.tone]}`} />
                  <dt className="text-xs text-ink-muted">{s.label}</dt>
                  <dd className="tabular text-xs font-semibold text-ink">{s.value}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}

      {footer && <div className="mt-lg border-t border-line pt-md">{footer}</div>}
    </section>
  );
}

/** Saturated fills for the occupancy strip and proportion bars. */
const SEGMENT_FILL: Record<Tone, string> = {
  neutral: 'bg-surface-sunken',
  success: 'bg-success-bright',
  warning: 'bg-warning-bright',
  danger: 'bg-danger',
  info: 'bg-info-bright',
  accent: 'bg-accent-bright',
};

/** Uniform grid for the supporting metric row. */
export function MetricGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-md sm:grid-cols-3 xl:grid-cols-6 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Horizontal proportion bar.
 *
 * Used for the per-department breakdown. `aria-label` states the ratio in words
 * because a 62%-width div is meaningless when announced.
 */
export function ProportionBar({
  value,
  max,
  tone = 'accent',
  label,
}: {
  value: number;
  max: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  /** Defaults to "value of max". Always override with real nouns. */
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  /*
   * Saturated graphic fills. A department bar is a shape, not text, so it uses
   * the `*-bright` variants rather than the AA *text* colours — a `#92400E`
   * brown bar next to an orange one reads as two equal categories.
   */
  const fill =
    tone === 'danger'
      ? 'bg-danger'
      : tone === 'warning'
        ? 'bg-warning-bright'
        : tone === 'success'
          ? 'bg-success-bright'
          : 'bg-accent-bright';
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunken"
      role="img"
      aria-label={label ?? `${value} dari ${max}`}
    >
      <div className={`h-full rounded-pill ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Two-column list of label/value facts.
 *
 * Replaces the `dl` markup that was duplicated on the attendance detail page
 * with different spacing and different truncation rules. The value wraps rather
 * than truncating: a clipped coordinate is worse than a taller row.
 */
export function KeyValueGrid({
  items,
  columns = 4,
  className = '',
}: {
  items: Array<{ label: string; value: ReactNode; mono?: boolean }>;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const cols =
    columns === 4
      ? 'grid-cols-2 lg:grid-cols-4'
      : columns === 3
        ? 'grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-2';
  return (
    <dl className={`grid ${cols} gap-x-lg gap-y-md ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-ink-muted">{item.label}</dt>
          <dd
            className={`mt-0.5 text-sm font-medium break-words text-ink ${
              item.mono ? 'tabular' : ''
            }`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}