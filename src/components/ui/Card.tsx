import type { ReactNode } from 'react';

/**
 * Card.
 *
 * A single surface with a border. No shadows, no gradients — hierarchy comes
 * from spacing and weight, which stays legible in both colour schemes.
 */
export function Card({
  title,
  description,
  action,
  children,
  className = '',
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface ${className}`}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-lg py-md">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={padded ? 'p-lg' : ''}>{children}</div>
    </section>
  );
}