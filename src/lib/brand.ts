/**
 * Brand configuration.
 *
 * Single place to rename/re-skin the product. Mirrors
 * `apps/mobile/src/constants/theme.ts`; keep the two in sync when rebranding.
 */
export const brand = {
  name: 'GeoAttend',
  tagline: 'Absensi berbasis lokasi & foto',
  accent: '#1D4ED8',
  supportEmail: 'hrd@contoh.co',
} as const;

/** Org time zone fallback; the authoritative value comes from `organization_settings`. */
export const FALLBACK_TIMEZONE = 'Asia/Jakarta';