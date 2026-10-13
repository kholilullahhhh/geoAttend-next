/**
 * Control and layout metrics that TypeScript needs to know about.
 *
 * The colour half of the design system lives in CSS custom properties (see
 * `app/globals.css`), because that is what lets `dark` repoint them without a
 * re-render. These are the values that must exist in JS: sizes referenced from
 * layout maths, and the mirrored `apps/mobile/src/constants/theme.ts` metrics
 * that keep the two apps in step.
 *
 * Keep this file small. If a value is only ever used to build a class name, it
 * belongs in the stylesheet, not here.
 */

/** `theme.ts -> space`, the 4pt scale. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** `theme.ts -> radius`. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * `theme.ts -> control`, stepped down for a dense desktop surface.
 *
 * Mobile guarantees 48dp because it is a thumb-driven, out-of-hand tool. The
 * dashboard is looked at from a desk with a mouse, and 48px controls would make
 * a monitoring table unusable — but 40px is the WCAG 2.5.5 comfortable
 * minimum, so nothing interactive drops below it.
 */
export const control = {
  heightSm: 36,
  heightMd: 40,
  heightLg: 44,
  /** Comfortable pointer target; matches WCAG 2.5.5. */
  minTarget: 40,
} as const;

/** `theme.ts -> iconSize`. Lucide is drawn on a 24px grid. */
export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/**
 * `theme.ts -> motion`.
 *
 * Short, single-property transitions only. Everything is disabled by the global
 * `prefers-reduced-motion` block in `globals.css`; these are the values used
 * when motion is welcome.
 */
export const motion = {
  duration: {
    instant: 90,
    fast: 160,
    normal: 240,
    slow: 320,
  },
  opacity: {
    pressed: 0.86,
    disabled: 0.45,
  },
} as const;

/** Page gutter and shell widths, used by the layout and by the drawer. */
export const layout = {
  sidebarWidth: 248,
  sidebarCollapsedWidth: 68,
  topbarHeight: 56,
  contentMaxWidth: 1600,
} as const;

/**
 * Minimum column width before a data table starts scrolling horizontally.
 *
 * Attendance rows carry ten comparable numeric columns. Below roughly this
 * width the numbers wrap and the table stops being scannable, so the region
 * scrolls instead — which keeps every column on one line and stays
 * keyboard-reachable through `TableWrap`.
 */
export const tableMinWidth = {
  wide: 1180,
  default: 900,
  compact: 620,
} as const;