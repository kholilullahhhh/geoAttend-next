import type { ReactNode } from 'react';

/**
 * Data table.
 *
 * Below the point where the columns no longer fit, the table scrolls
 * horizontally inside its own container rather than collapsing into cards.
 * Attendance rows carry ten comparable numeric columns: a stacked card layout
 * turns them into an unreadable list of label/value pairs, and a horizontally
 * scrollable region stays keyboard-reachable (`tabIndex={0}` plus
 * `role="region"`).
 *
 * The header is sticky so that a 50-row page keeps its column meanings visible
 * while scrolling — on a monitoring screen, "which column was distance?" is
 * answered without scrolling back up.
 */

export type Density = 'comfortable' | 'compact';

const DENSITY: Record<Density, { cellY: string; headY: string; text: string }> = {
  comfortable: { cellY: 'py-3', headY: 'py-2.5', text: 'text-sm' },
  compact: { cellY: 'py-2', headY: 'py-2', text: 'text-[0.8125rem]' },
};

export interface TableWrapProps {
  children: ReactNode;
  /** Below this the columns start wrapping; the region scrolls instead. */
  minWidth?: number;
  density?: Density;
  /** Accessible name for the scrollable region. */
  label?: string;
  /** `<caption>`, visually hidden unless `showCaption`. */
  caption?: string;
  showCaption?: boolean;
}

export function TableWrap({
  children,
  minWidth = 900,
  density = 'comfortable',
  label = 'Tabel data',
  caption,
  showCaption = false,
}: TableWrapProps) {
  return (
    <div
      className="w-full overflow-x-auto overscroll-x-contain"
      // Announced so screen-reader users know the region scrolls, and
      // focusable so the scrollbar is reachable from the keyboard.
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table
        className={`w-full border-collapse ${DENSITY[density].text}`}
        style={{ minWidth }}
      >
        {caption && (
          <caption
            className={
              showCaption
                ? 'px-lg py-2 text-left text-xs text-ink-muted'
                : 'sr-only'
            }
          >
            {caption}
          </caption>
        )}
        {children}
      </table>
    </div>
  );
}

export type Align = 'left' | 'right' | 'center';

const ALIGN: Record<Align, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

export interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  /** Hide below this breakpoint, so phones keep the columns that matter. */
  hideBelow?: Breakpoint;
  /** Pinned to the left edge while the table scrolls horizontally. */
  sticky?: boolean;
  density?: Density;
}

const HIDE_BELOW: Record<Breakpoint, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

export function Th({
  children,
  align = 'left',
  className = '',
  hideBelow,
  sticky = false,
  density = 'comfortable',
  scope,
  ...rest
}: ThProps) {
  return (
    <th
      {...rest}
      scope={scope ?? 'col'}
      className={`border-b border-line bg-surface-alt/70 px-md text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase ${hideBelow ? HIDE_BELOW[hideBelow] : ''} ${
        sticky ? 'sticky left-0 z-20' : ''
      } ${DENSITY[density].headY} ${ALIGN[align]} ${className}`}
    >
      {children}
    </th>
  );
}

export interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  hideBelow?: Breakpoint;
  sticky?: boolean;
  density?: Density;
}

export function Td({
  children,
  align = 'left',
  className = '',
  hideBelow,
  sticky = false,
  density = 'comfortable',
  ...rest
}: TdProps) {
  return (
    <td
      {...rest}
      className={`border-b border-line px-md align-middle text-ink-secondary ${
        hideBelow ? HIDE_BELOW[hideBelow] : ''
      } ${sticky ? 'sticky left-0 z-10 bg-surface' : ''} ${ALIGN[align]} ${
        DENSITY[density].cellY
      } ${className}`}
    >
      {children}
    </td>
  );
}

/**
 * Row.
 *
 * Hover is a tint of the surface, and the *entire* row links to the detail page
 * via a stretched anchor in the first cell — a row that looks clickable but
 * only responds on the name is the most common way a table gets mis-used.
 */
export function Tr({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      {...rest}
      className={`transition-colors duration-160 hover:bg-surface-alt/60 ${className}`}
    >
      {children}
    </tr>
  );
}

/** First-line identity cell: name plus a secondary line. */
export function IdentityCell({
  primary,
  secondary,
  className = '',
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="truncate font-medium text-ink">{primary}</div>
      {secondary && <div className="mt-0.5 truncate text-xs text-ink-muted">{secondary}</div>}
    </div>
  );
}

/**
 * Cell content that links to the detail page.
 *
 * The anchor is `after:absolute inset-0`, which makes the whole row a hit
 * target while keeping a single, correctly-labelled tab stop in the row — a
 * per-cell link in every column would put a dozen tab stops in one record.
 */
export function RowLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`relative rounded-sm font-medium text-ink no-underline after:absolute after:inset-0 hover:text-accent-ink hover:underline focus-visible:underline ${className}`}
    >
      {children}
    </a>
  );
}

/**
 * Pagination footer.
 *
 * Server-side: the caller passes the total row count and builds the hrefs, so
 * the page number lives in the URL and a reload or a shared link reproduces the
 * exact view.
 */
export function Pagination({
  page,
  totalPages,
  total,
  showing,
  hrefFor,
  label = 'Navigasi halaman',
}: {
  page: number;
  totalPages: number;
  total: number;
  showing: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-line px-lg py-3 sm:flex-row sm:items-center"
      aria-label={label}
    >
      <p className="tabular text-xs text-ink-muted">
        Menampilkan {showing.toLocaleString('id-ID')} dari {total.toLocaleString('id-ID')} catatan
        {' · '}
        halaman {page} dari {totalPages.toLocaleString('id-ID')}
      </p>
      <div className="flex items-center gap-2">
        <PageLink href={page > 1 ? hrefFor(page - 1) : null} rel="prev">
          Sebelumnya
        </PageLink>
        <PageLink href={page < totalPages ? hrefFor(page + 1) : null} rel="next">
          Berikutnya
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  rel,
  children,
}: {
  href: string | null;
  rel: 'prev' | 'next';
  children: ReactNode;
}) {
  const base =
    'inline-flex h-9 coarse:h-10 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors';
  if (!href) {
    // Rendered, not omitted: the control keeps its place so the row does not
    // reflow as the user pages through, and `aria-disabled` explains why.
    return (
      <span
        aria-disabled="true"
        className={`${base} cursor-not-allowed border-line bg-surface-alt text-ink-muted opacity-60`}
      >
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      rel={rel}
      className={`${base} border-line-strong bg-surface text-ink no-underline hover:bg-surface-alt`}
    >
      {children}
    </a>
  );
}