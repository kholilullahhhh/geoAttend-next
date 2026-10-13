import type { ReactNode } from 'react';

import type { Tone } from '@/lib/status';

/**
 * Card.
 *
 * A single bordered surface. No shadow, no gradient: hierarchy is built from
 * spacing, weight and the header rule, which is what keeps it legible in both
 * colour schemes — and it matches the mobile `Card`, which draws the same
 * hairline on the same warm neutrals.
 *
 * `tone` is optional and reproduces the mobile pattern: a 3px coloured rule on
 * the leading edge. It is a *secondary* signal — anything that needs attention
 * also carries a badge and a sentence of text, so removing the rule loses
 * nothing.
 */

const TONE_RULE: Record<Tone, string> = {
  neutral: 'border-l-line',
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
  info: 'border-l-info',
  accent: 'border-l-accent-bright',
};

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Trailing control in the header, e.g. a filter or an export link. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Removes body padding; use when the child is a full-bleed table. */
  padded?: boolean;
  tone?: Tone;
  /**
   * Heading level. Cards are `<section>`s, so the heading must match the
   * document outline rather than defaulting every card to an `h2` regardless
   * of where it sits.
   */
  headingLevel?: 2 | 3 | 4;
}

export function Card({
  title,
  description,
  action,
  children,
  className = '',
  padded = true,
  tone = 'neutral',
  headingLevel = 3,
}: CardProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const hasHeader = Boolean(title || description || action);

  return (
    <section
      className={`rounded-lg border border-line bg-surface ${TONE_RULE[tone]} ${className}`}
    >
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-lg py-md">
          <div className="min-w-0 flex-1">
            {title && (
              <Heading className="text-sm font-semibold tracking-tight text-ink">
                {title}
              </Heading>
            )}
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
            )}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={padded ? 'p-lg' : ''}>{children}</div>
    </section>
  );
}

/**
 * Card grid.
 *
 * `min` is the column count at the `sm` breakpoint and above; below it the grid
 * collapses to a single column, because two columns of numbers on a phone is
 * unreadable rather than compact.
 */
export function CardGrid({
  children,
  min = 2,
  className = '',
}: {
  children: ReactNode;
  min?: 2 | 3 | 4;
  className?: string;
}) {
  const cols =
    min === 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : min === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2';
  return <div className={`grid grid-cols-1 gap-lg ${cols} ${className}`}>{children}</div>;
}

/** Vertical rhythm for a page or a section. One gap token for everything. */
export function Stack({
  children,
  gap = 'lg',
  className = '',
}: {
  children: ReactNode;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const g =
    gap === 'sm' ? 'gap-sm' : gap === 'md' ? 'gap-md' : gap === 'lg' ? 'gap-lg' : 'gap-xl';
  return <div className={`flex flex-col ${g} ${className}`}>{children}</div>;
}