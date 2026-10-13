import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  CircleAlert,
  Inbox,
  Lock,
  RefreshCw,
  SearchX,
  WifiOff,
} from 'lucide-react';

/**
 * Every data-backed surface renders one of these, so there is never a blank
 * page that leaves an operator guessing whether it is broken or merely empty.
 *
 * The states are distinguished on purpose: "no data because the filters matched
 * nothing" is a different problem from "the query failed" and from "you are not
 * allowed to see this", and each one gets different copy and a different
 * action.
 */

// ---------------------------------------------------------------------------
// Page scaffolding
// ---------------------------------------------------------------------------

export interface Crumb {
  href?: string;
  label: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Remah roti">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="size-3.5 shrink-0 text-ink-muted/60" aria-hidden="true" />
              )}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded-sm text-ink-secondary no-underline hover:text-ink hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={last ? 'font-medium text-ink-secondary' : undefined} aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Primary action, an export link, a connection indicator. */
  action?: ReactNode;
  /** `eyebrow` renders above the title; use for breadcrumbs. */
  eyebrow?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-ink text-balance sm:text-2xl">
          {title}
        </h1>
        {description && (
          <div className="mt-1.5 text-sm leading-relaxed text-ink-secondary text-pretty">
            {description}
          </div>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{action}</div>
      )}
    </header>
  );
}

/** Small uppercase label that heads a group inside a card. */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-2xs font-semibold tracking-wide text-ink-muted uppercase ${className}`}>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Skeleton block.
 *
 * `aria-hidden`: a placeholder conveys no information, and announcing "loading"
 * six times over is worse than announcing nothing. The live status below
 * carries the single announcement.
 *
 * The pulse is `motion-reduce`-disabled and the global reduced-motion block
 * collapses it anyway; what is left is a static block in the shape of the real
 * content, so nothing jumps when the data lands.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-sm bg-surface-sunken motion-reduce:animate-none ${className}`}
    />
  );
}

export function SkeletonRows({ rows = 6, dense = true }: { rows?: number; dense?: boolean }) {
  return (
    <div className={`flex flex-col ${dense ? 'gap-2' : 'gap-3'} p-lg`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4, className = 'h-24' }: { count?: number; className?: string }) {
  return (
    <div className="grid grid-cols-2 gap-md lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`w-full ${className}`} />
      ))}
    </div>
  );
}

/**
 * Visible "loading" announcement for screen readers, paired with a skeleton.
 *
 * A silent skeleton is invisible to a screen-reader user: they hear nothing and
 * cannot tell whether the page is empty or still fetching.
 */
export function LoadingStatus({ label = 'Memuat data' }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {label}…
    </p>
  );
}

// ---------------------------------------------------------------------------
// Empty / error / permission
// ---------------------------------------------------------------------------

const EMPTY_ICON = {
  inbox: Inbox,
  search: SearchX,
  offline: WifiOff,
} as const;

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: keyof typeof EMPTY_ICON;
  /** Compact form for use inside a table cell or a side panel. */
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  icon = 'inbox',
  compact = false,
}: EmptyStateProps) {
  const Glyph = EMPTY_ICON[icon];
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'gap-1.5 px-lg py-xl' : 'gap-2.5 px-lg py-3xl'}`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-pill bg-surface-alt text-ink-muted ${
          compact ? 'size-9' : 'size-12'
        }`}
      >
        <Glyph className={compact ? 'size-4' : 'size-5'} />
      </span>
      <p className={`font-medium text-ink ${compact ? 'text-sm' : 'text-sm sm:text-base'}`}>{title}</p>
      {description && (
        <p className="max-w-96 text-sm leading-relaxed text-ink-muted text-pretty">{description}</p>
      )}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  /** Extra context, e.g. "filter ini terlalu luas". */
  hint?: ReactNode;
}

export function ErrorState({
  title = 'Gagal memuat data',
  message,
  onRetry,
  hint,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft/50 p-lg"
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-danger">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{message}</p>
          {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-surface-alt"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Coba lagi
        </button>
      )}
    </div>
  );
}

/**
 * Permission state.
 *
 * Says who is allowed and what to do next. It never pretends the data is empty
 * — telling an HR that "there is no data" when the truth is that they may not
 * see it is the most misleading thing an access-denied screen can do.
 */
export function PermissionState({
  title = 'Akses dibatasi',
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft/50 p-lg"
    >
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-warning">{title}</p>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-secondary">{message}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

/**
 * Inline banner for a non-blocking problem inside an otherwise working page.
 *
 * Carries an icon and words as well as a tint, matching the mobile
 * `InlineNotice`: the meaning survives a greyscale screen and a colour-blind
 * reader.
 */
export function InlineNotice({
  tone = 'info',
  title,
  message,
  action,
}: {
  tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  message: ReactNode;
  action?: ReactNode;
}) {
  const map = {
    neutral: {
      box: 'border-line-strong bg-surface-alt/60',
      fg: 'text-ink-secondary',
      label: 'Informasi',
    },
    info: { box: 'border-info/35 bg-info-soft/60', fg: 'text-info', label: 'Informasi' },
    warning: {
      box: 'border-warning/35 bg-warning-soft/60',
      fg: 'text-warning',
      label: 'Perhatian',
    },
    danger: { box: 'border-danger/35 bg-danger-soft/60', fg: 'text-danger', label: 'Masalah' },
    success: {
      box: 'border-success/35 bg-success-soft/60',
      fg: 'text-success',
      label: 'Berhasil',
    },
  } as const;
  const cfg = map[tone];

  return (
    <div role="status" aria-live="polite" className={`flex flex-wrap items-center gap-3 rounded-md border px-md py-2.5 ${cfg.box}`}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <CircleAlert className={`mt-0.5 size-4 shrink-0 ${cfg.fg}`} aria-hidden="true" />
        <div className="min-w-0 text-sm">
          {title && <span className="sr-only">{cfg.label}: </span>}
          {title && <span className={`font-semibold ${cfg.fg}`}>{title} </span>}
          <span className="leading-relaxed text-ink-secondary">{message}</span>
        </div>
      </div>
      {action}
    </div>
  );
}