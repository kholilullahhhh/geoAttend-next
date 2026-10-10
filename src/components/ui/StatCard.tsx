import type { ReactNode } from 'react';

import type { Tone } from './Badge';

/** Text colour for each tone; `neutral` keeps the default ink. */
const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  accent: 'text-accent-ink',
};

/**
 * Headline metric.
 *
 * Each tile pairs a single number with a plain-language label. Sub-metrics are
 * optional and always text — a colour swatch alone would not be readable.
 *
 * `tone` recolours the number so a value that needs attention (late arrivals,
 * records pending review) is noticeable while scanning the grid. It is never the
 * only signal: the label and sub-text carry the meaning too.
 */
export function StatCard({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</p>
        {icon && <span className="text-ink-muted">{icon}</span>}
      </div>
      <p className={`tabular mt-2 text-2xl font-semibold ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <div className="mt-1 text-xs text-ink-secondary">{sub}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-md lg:grid-cols-4">{children}</div>;
}

/** Horizontal proportion bar used for department breakdowns. */
export function ProportionBar({
  value,
  max,
  tone = 'accent',
}: {
  value: number;
  max: number;
  tone?: 'accent' | 'warning' | 'danger';
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bg = tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-accent';
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunken"
      role="img"
      aria-label={`${value} dari ${max}`}
    >
      <div className={`h-full rounded-pill ${bg}`} style={{ width: `${pct}%` }} />
    </div>
  );
}