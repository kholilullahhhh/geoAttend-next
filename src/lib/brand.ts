/**
 * Brand configuration.
 *
 * Single place to rename/re-skin the product. Mirrors
 * `apps/mobile/src/constants/theme.ts`; keep the two in sync when rebranding.
 *
 * `accent` has no runtime consumer — the colour itself lives in CSS, because that
 * is what lets `dark` repoint it without a re-render. It is kept, and asserted
 * against `theme.ts` by `theme-parity.test.ts`, so the rebrand story stays true:
 * three files change (here, `theme.ts`, `globals.css`) and the test fails if any
 * one of them is missed.
 */
export const brand = {
  name: 'GeoAttend',
  tagline: 'Absensi berbasis lokasi & foto',
  /** Mirrors `theme.ts -> brand.accent`. */
  accent: '#C2410C',
  supportEmail: 'hrd@contoh.co',
} as const;

/** Org time zone fallback; the authoritative value comes from `organization_settings`. */
export const FALLBACK_TIMEZONE = 'Asia/Jakarta';