import type { ReactNode } from 'react';
import Link from 'next/link';

import { ToneDot } from '@/components/ui/Badge';
import type { Tone } from '@/lib/status';

/**
 * Filter chips.
 *
 * These are links, not buttons: each chip is a complete URL, so a filtered view
 * is shareable, survives a reload, and works with the browser's back button.
 * A `useState`-driven filter would lose all three.
 *
 * `aria-current="true"` rather than `"page"`: the chip changes the current
 * view's data, it does not navigate to a different page, and reserving
 * `aria-current="page"` for real navigations keeps the two distinguishable.
 */

export interface Chip {
  href: string;
  label: string;
  active: boolean;
  count?: number;
  tone?: Tone;
}

export function FilterChips({
  chips,
  label,
  className = '',
}: {
  chips: Chip[];
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          aria-current={chip.active ? 'true' : undefined}
          className={`inline-flex h-8 coarse:min-h-10 coarse:px-4 items-center gap-1.5 rounded-pill border px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
            chip.active
              ? 'border-transparent bg-accent-soft text-accent-ink'
              : 'border-line-strong bg-surface text-ink-secondary hover:bg-surface-alt hover:text-ink'
          }`}
        >
          {chip.tone && !chip.active && <ToneDot tone={chip.tone} />}
          {chip.label}
          {typeof chip.count === 'number' && (
            <span className={`tabular ${chip.active ? 'text-accent-ink/80' : 'text-ink-muted'}`}>
              {chip.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Tab strip for switching between two views of the same data.
 *
 * Distinct from {@link FilterChips}: tabs change the *record set's subject*
 * (leave vs corrections), chips change a *dimension* of one subject.
 */
export function TabStrip({
  tabs,
  label,
}: {
  tabs: Array<{ href: string; label: string; active: boolean; badge?: number }>;
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-md py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
            tab.active
              ? 'border-accent text-ink'
              : 'border-transparent text-ink-secondary hover:border-line-strong hover:text-ink'
          }`}
        >
          {tab.label}
          {typeof tab.badge === 'number' && tab.badge > 0 && (
            <span className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-warning-soft px-1.5 text-2xs font-bold text-warning">
              {tab.badge}
              <span className="sr-only"> menunggu</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Summary of what is currently filtered, with a single reset. */
export function ActiveFilters({
  items,
  onResetHref,
  className = '',
}: {
  items: Array<{ label: string; value: string; href: string }>;
  /** Where "reset" goes. Usually `?` — every page has sensible defaults. */
  onResetHref: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs ${className}`}
    >
      <span className="text-ink-muted">Filter aktif:</span>
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface-alt py-0.5 pr-1 pl-2.5 coarse:py-2"
        >
          <span className="text-ink-muted">{item.label}:</span>
          <span className="max-w-40 truncate font-medium text-ink">{item.value}</span>
          <Link
            href={item.href}
            aria-label={`Hapus filter ${item.label} ${item.value}`}
            className="inline-flex size-5 coarse:size-10 items-center justify-center rounded-pill text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </Link>
        </span>
      ))}
      <Link
        href={onResetHref}
        className="rounded-sm py-2 font-semibold text-accent-ink hover:underline"
      >
        Atur ulang semua
      </Link>
    </div>
  );
}

/** Wrapper that keeps a filter toolbar's controls aligned and gapped. */
export function FilterRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-3 ${className}`}>{children}</div>;
}