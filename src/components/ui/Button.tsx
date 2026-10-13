import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button.
 *
 * One primary action per view. The variants are deliberately asymmetric: the
 * primary is the only filled accent surface, and everything else is quieter, so
 * a screen full of actions still has a clear reading order.
 *
 * Mobile guarantees a 48dp touch target because it is a thumb-driven tool. The
 * web steps down to a 40px floor (`control.minTarget`, WCAG 2.5.5) â€” but the
 * `sm` size is for dense toolbars only, never the sole way to reach an action.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  // `text-on-accent` rather than a hard-coded white: the accent inverts in dark
  // mode, and white on the dark-mode accent would fail contrast.
  primary: 'bg-accent text-on-accent border border-transparent hover:brightness-110 active:brightness-95',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-surface-alt active:bg-surface-sunken',
  subtle:
    'bg-surface-alt text-ink-secondary border border-transparent hover:bg-surface-sunken hover:text-ink',
  ghost:
    'bg-transparent text-ink-secondary border border-transparent hover:bg-surface-alt hover:text-ink',
  danger: 'bg-danger text-white border border-transparent hover:brightness-110 active:brightness-95',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-10 px-3.5 text-sm gap-2',
  lg: 'h-11 px-4 text-sm gap-2',
};

/** Square icon-only button. `label` becomes the accessible name. */
const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'size-9',
  md: 'size-10',
  lg: 'size-11',
};

const BASE =
  'relative inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-[background-color,border-color,color,filter,opacity] duration-160 select-none disabled:pointer-events-none disabled:opacity-50';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  /**
   * Icon trailing the label. Kept separate from `icon` because a button with
   * both ends needs the leading and trailing roles to be distinguishable.
   */
  iconEnd?: ReactNode;
  /** Square, icon-only. Requires `label`. */
  iconOnly?: boolean;
  /** Required when `iconOnly`; never rendered visually. */
  label?: string;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  iconEnd,
  iconOnly = false,
  label,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      // `busy` tells assistive tech the control is working, which matters most
      // for the approve/reject buttons where a double submit is destructive.
      aria-busy={loading || undefined}
      aria-label={iconOnly ? (label ?? rest['aria-label']) : rest['aria-label']}
      className={`${BASE} ${iconOnly ? ICON_SIZES[size] : SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        icon
      )}
      {!iconOnly && children}
      {!loading && !iconOnly && iconEnd}
    </button>
  );
}

/**
 * Button that navigates.
 *
 * Renders an anchor so it is a real link: middle-click, "open in new tab" and
 * the browser's status-bar preview all behave, and keyboard users get the link
 * role they expect. Styling is shared with `Button` through the same tokens.
 */
export function LinkButton({
  variant = 'secondary',
  size = 'md',
  icon,
  iconEnd,
  iconOnly = false,
  label,
  className = '',
  children,
  ...rest
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  iconOnly?: boolean;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <a
      {...rest}
      aria-label={iconOnly ? (label ?? rest['aria-label']) : rest['aria-label']}
      className={`${BASE} no-underline ${iconOnly ? ICON_SIZES[size] : SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {icon}
      {!iconOnly && children}
      {iconEnd}
    </a>
  );
}