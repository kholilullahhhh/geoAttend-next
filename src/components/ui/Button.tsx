import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Button.
 *
 * One primary action per view is the rule, so `variant="primary"` is styled to
 * dominate and the other variants are deliberately quieter. Every variant keeps
 * a >=40px hit area and a visible focus ring.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  // `text-on-accent` (not a hard-coded white) because the accent inverts in dark
  // mode; white on the dark-mode accent would fail contrast.
  primary: 'bg-accent text-on-accent hover:opacity-90 active:opacity-80',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-surface-alt active:bg-surface-sunken',
  ghost: 'text-ink-secondary hover:bg-surface-alt active:bg-surface-sunken',
  danger: 'bg-danger text-white hover:opacity-90 active:opacity-80',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}