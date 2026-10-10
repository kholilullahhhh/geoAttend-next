import type { ReactNode } from 'react';

/**
 * Responsive table.
 *
 * Below `md` the table scrolls horizontally inside its own container rather than
 * collapsing into cards: attendance rows have too many comparable columns for a
 * stacked layout to stay scannable, and a horizontally scrollable region is
 * keyboard-reachable.
 */
export function TableWrap({ children, minWidth = 880 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div
      className="w-full overflow-x-auto"
      // Announced so screen-reader users know the table scrolls.
      role="region"
      aria-label="Tabel data"
      tabIndex={0}
    >
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className = '',
  ...rest
}: { children?: ReactNode; align?: 'left' | 'right' | 'center' } & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      scope={rest.scope ?? 'col'}
      className={`border-b border-line px-md py-sm text-xs font-semibold tracking-wide text-ink-muted uppercase whitespace-nowrap ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className = '',
  ...rest
}: { align?: 'left' | 'right' | 'center' } & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...rest}
      className={`border-b border-line px-md py-sm align-middle ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr {...rest} className={`hover:bg-surface-alt/60 ${className}`}>
      {children}
    </tr>
  );
}