/**
 * Mobile app surface.
 *
 * Cross-checks the web dashboard's design tokens against
 * `apps/mobile/src/constants/theme.ts`, the single source of truth both apps
 * derive their palettes from.
 *
 * Why this is a test rather than a comment: the two files drifted once already.
 * The web dashboard called `COMPLETED` "accent" while the mobile app called it
 * "success", so the same attendance record was orange on one screen and green on
 * the other. A comment in each file would have been read by one maintainer and
 * ignored by the other; a failing test stops the commit.
 *
 * The mobile file is parsed rather than imported, because it pulls in
 * `react-native`, which is not a dependency of the web app.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { brand } from './brand';

const MOBILE_THEME = readFileSync(
  join(process.cwd(), '..', 'mobile', 'src', 'constants', 'theme.ts'),
  'utf8',
);

const WEB_CSS = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');

/** `key: '#hex'` inside the object assigned to `const <name>`. */
function tokensOf(objectName: string, source = MOBILE_THEME): Record<string, string> {
  const start = source.indexOf(`const ${objectName}`);
  expect(start, `${objectName} not found in theme.ts`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(open, end);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(\w+):\s*'(#[0-9a-fA-F]{3,8})'/g)) {
    out[m[1]!] = m[2]!;
  }
  return out;
}

/**
 * Every `--name: value` declared in globals.css, with comments stripped.
 *
 * Scans the whole file rather than a single block on purpose: the scale tokens
 * live in `@theme inline` (the Tailwind theme namespace), not in `:root`, so a
 * block-scoped reader would report every radius and spacing token as missing.
 */
function allCssTokens(): Record<string, string> {
  const stripped = WEB_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Record<string, string> = {};
  for (const m of stripped.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
    const name = m[1]!;
    const value = m[2]!.trim();
    // First declaration wins: `:root` precedes `.dark`, and `@theme inline`
    // re-declares the same names as `var(...)` references.
    if (!(name in out)) out[name] = value;
  }
  return out;
}

const css = allCssTokens();

/** Resolve a token that may itself be `var(--other)`. */
function cssValue(name: string): string | undefined {
  const raw = css[name];
  if (raw === undefined) return undefined;
  const ref = raw.match(/^var\((--[a-z0-9-]+)\)$/);
  return ref ? cssValue(ref[1]!) : raw;
}

/** `--name: value;` inside the `:root` or `.dark` block only. */
function cssTokens(selector: ':root' | '.dark'): Record<string, string> {
  const re = new RegExp(`(?:^|\\n)\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'm');
  const m = WEB_CSS.match(re);
  expect(m, `${selector} block not found in globals.css`).toBeTruthy();
  const out: Record<string, string> = {};
  for (const line of m![1]!.split(/[\n;]/)) {
    const kv = line.match(/(--[a-z-]+)\s*:\s*(.+)/);
    if (kv) out[kv[1]!] = kv[2]!.trim();
  }
  return out;
}

const brand_tokens = tokensOf('brand');
const light = cssTokens(':root');
const dark = cssTokens('.dark');

describe('mobile / web colour parity', () => {
  /*
   * Each entry names the mobile key, the web light token and the web dark token.
   * Light values must be byte-identical to the mobile app. Dark values are
   * allowed to differ, because the mobile app ships one palette only and the
   * dashboard needs an inverted variant — but the *hue relationship* has to hold,
   * which is asserted below.
   */
  const MIRRORED: Array<[mobileKey: string, lightToken: string]> = [
    ['accent', '--accent'],
    ['accentSoft', '--accent-soft'],
    ['accentInk', '--accent-ink'],
    ['accentBright', '--accent-bright'],
    ['success', '--success'],
    ['successSoft', '--success-soft'],
    ['warning', '--warning'],
    ['warningSoft', '--warning-soft'],
    ['danger', '--danger'],
    ['dangerSoft', '--danger-soft'],
    ['info', '--info'],
    ['infoSoft', '--info-soft'],
    ['neutralSoft', '--surface-alt'],
  ];

  it.each(MIRRORED)('light --%s mirrors mobile brand.%s', (mobileKey, token) => {
    expect(light[token], `--${token} missing from :root`).toBeDefined();
    expect(light[token]!.toLowerCase()).toBe(brand_tokens[mobileKey]!.toLowerCase());
  });

  it('mirrors the mobile warm neutral scale', () => {
    const neutral = tokensOf('light');
    const MIRRORED_NEUTRAL: Array<[keyof typeof neutral, string]> = [
      ['bg', '--bg'],
      ['surface', '--surface'],
      ['surfaceAlt', '--surface-alt'],
      ['surfaceSunken', '--surface-sunken'],
      ['border', '--border'],
      ['borderStrong', '--border-strong'],
      ['text', '--text'],
      ['textSecondary', '--text-secondary'],
      ['textMuted', '--text-muted'],
    ];
    for (const [key, token] of MIRRORED_NEUTRAL) {
      expect(light[token]!.toLowerCase(), `--${token}`).toBe(String(neutral[key]).toLowerCase());
    }
  });

  it('carries the input border the mobile app defines separately', () => {
    // `theme.ts` splits `borderInput` from `border` for a specific reason: an
    // input's outline is load-bearing and has to clear 3:1, while a decorative
    // divider may stay faint. Losing the web token silently drops input borders
    // to ~1.5:1.
    const neutral = tokensOf('light');
    expect(neutral.borderInput, 'mobile borderInput missing').toBeDefined();
    expect(light['--border-input']!.toLowerCase()).toBe(
      String(neutral.borderInput).toLowerCase(),
    );
  });

  it('mirrors the mobile radius scale, including pill', () => {
    for (const token of ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-pill']) {
      expect(cssValue(token), `${token} missing from globals.css`).toBeDefined();
    }
    // `rounded-pill` was shipped for months while `--radius-pill` did not exist,
    // so Tailwind emitted no rule at all and every pill rendered square.
    expect(cssValue('--radius-pill')).toBe('999px');
  });

  it('defines every status token in the dark scheme too', () => {
    for (const token of [
      '--success',
      '--success-soft',
      '--warning',
      '--warning-soft',
      '--danger',
      '--danger-soft',
      '--info',
      '--info-soft',
      '--accent',
      '--accent-soft',
      '--accent-ink',
      '--on-accent',
    ]) {
      expect(dark[token], `${token} missing from .dark`).toBeDefined();
    }
  });

  it('gives the dark status tints a dark background, not the light pastel', () => {
    /*
     * The original bug: `.dark` set only the foreground colours, so
     * `bg-success-soft` stayed light mint (#d1fae5) while `text-success` flipped
     * to light green (#4ade80) — roughly 1.3:1, invisible in dark mode.
     * Each `*-soft` must be a DARK tint in the dark scheme.
     */
    const luminance = (hex: string) => {
      const h = hex.replace('#', '');
      const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      const channels = [0, 2, 4].map((i) => {
        const s = parseInt(full.slice(i, i + 2), 16) / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      const [r = 0, g = 0, b = 0] = channels;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    for (const token of [
      '--success-soft',
      '--warning-soft',
      '--danger-soft',
      '--info-soft',
      '--accent-soft',
    ]) {
      expect(luminance(dark[token]!), `${token} is not dark`).toBeLessThan(0.06);
      expect(luminance(dark[token]!)).toBeGreaterThan(0); // not black either
    }
  });

  it('keeps the brand accent recognisable in both schemes', () => {
    /*
     * The dark accent inverts to a light orange so it stays readable as text on
     * a dark surface. That is a deliberate deviation from the mobile value, so it
     * is asserted as a *relationship* rather than an equality: the dark accent
     * must be far lighter than the light one, and still carry warmth (R > B).
     */
    const channels = (hex: string) => {
      const h = hex.replace('#', '');
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    };
    const lightRgb = channels(light['--accent']!);
    const darkRgb = channels(dark['--accent']!);

    expect(darkRgb[0], 'dark accent is not warm (R should exceed B)').toBeGreaterThan(
      darkRgb[2]!,
    );
    expect(darkRgb[0], 'dark accent did not invert to a light value').toBeGreaterThan(
      lightRgb[0]!,
    );
  });

  it('keeps `brand.accent` in step with the stylesheet and the mobile app', () => {
    /*
     * `brand.accent` has no runtime consumer, so nothing else would notice it
     * drifting. Asserting it here is what keeps the "edit one file to rebrand"
     * promise in `brand.ts` honest.
     */
    expect(brand.accent.toLowerCase()).toBe(brand_tokens.accent!.toLowerCase());
    expect(light['--accent']!.toLowerCase()).toBe(brand.accent.toLowerCase());
  });

  it('keeps the saturated chart fills out of the text tokens', () => {
    /*
     * `theme.ts` is explicit that `accentBright` is for graphics and must never
     * be used as type: it clears 3:1 but not 4.5:1. The web needs the same
     * separation for the status colours, which is why `*-bright` tokens exist.
     */
    for (const token of ['--accent-bright', '--warning-bright', '--info-bright', '--success-bright']) {
      expect(light[token], `${token} missing`).toBeDefined();
      expect(dark[token], `${token} missing from .dark`).toBeDefined();
    }
  });
});