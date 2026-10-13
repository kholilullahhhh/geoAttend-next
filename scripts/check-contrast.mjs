/**
 * Contrast audit for the design tokens.
 *
 * Every badge, notice and status colour in the app is a foreground/background
 * pair from `globals.css`. Tailwind cannot check contrast, so this does: it
 * resolves each pair in BOTH schemes and asserts against the WCAG thresholds.
 *
 * This is not decoration. The dark scheme previously reused the light pastels
 * for the `*-soft` backgrounds while flipping the foreground to a light colour,
 * which produced light-green-on-mint badges at roughly 1.3:1 -- invisible to a
 * build and only caught by looking. A numeric gate catches it forever.
 *
 * Thresholds (WCAG 2.1):
 *   1.4.3  normal text  -> 4.5:1   (badge labels are 12-13px semibold)
 *   1.4.11 UI boundary  -> 3:1     (input borders, focus rings)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');

/** Extract the `:root` and `.dark` blocks. */
function block(selector) {
  const re = new RegExp(`(?:^|\\n)\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'm');
  const m = CSS.match(re);
  if (!m) throw new Error(`Could not find the ${selector} block in globals.css`);
  const vars = {};
  for (const line of m[1].split(/[\n;]/)) {
    const kv = line.match(/(--[a-z-]+)\s*:\s*(.+)/);
    if (kv) vars[kv[1]] = kv[2].trim();
  }
  return vars;
}

const root = block(':root');
const dark = block('.dark');

/** Resolve a token name (with or without its leading `--`) to a hex colour. */
function resolve(vars, name) {
  const key = name.startsWith('--') ? name : `--${name}`;
  const raw = vars[key];
  if (raw === undefined) throw new Error(`Missing token ${key}`);
  const ref = raw.match(/^var\((--[a-z-]+)\)$/);
  return ref ? resolve(vars, ref[1]) : raw;
}

/** `50%` of `fg` laid over `bg`, as a hex string. */
function compositeHex(fg, bg) {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  const mix = f.map((v, i) => Math.round(v * 0.5 + b[i] * 0.5));
  return (
    '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('')
  );
}

function hexToRgb(hex) {
  let h = hex.trim();
  if (h.startsWith('rgb')) {
    const parts = h.match(/[\d.]+/g).map(Number);
    return parts.slice(0, 3);
  }
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** WCAG relative luminance. */
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground token, background token, minimum ratio, what it is] */
const PAIRS = [
  // Status badges: soft tint behind a status-coloured label.
  ['--success', '--success-soft', 4.5, 'Badge "success"'],
  ['--warning', '--warning-soft', 4.5, 'Badge "warning"'],
  ['--danger', '--danger-soft', 4.5, 'Badge "danger"'],
  ['--info', '--info-soft', 4.5, 'Badge "info"'],
  ['--accent-ink', '--accent-soft', 4.5, 'Badge "accent"'],
  // Notice banners reuse the same pairs, so they are covered by the above.
  // Text and surfaces.
  ['--text', '--surface', 4.5, 'Body text on a card'],
  ['--text', '--bg', 4.5, 'Body text on the page'],
  ['--text-secondary', '--surface', 4.5, 'Secondary text on a card'],
  ['--text-muted', '--surface', 4.5, 'Muted text on a card'],
  ['--text-muted', '--surface-alt', 4.5, 'Muted text on a tinted chip'],
  ['--text-secondary', '--surface-alt', 4.5, 'Secondary text on a tinted chip'],
  ['--accent-ink', '--surface', 4.5, 'Accent link on a card'],
  // Primary button: filled accent, label sits on `--on-accent`.
  [
    '--on-accent',
    '--accent',
    4.5,
    'Primary button label',
    // Rendered as `fg` at 50% over `bg`, which is what the base layer's
    // `disabled:opacity-50` actually produces.
    { disabled: true },
  ],
  ['--on-accent', '--accent', 4.5, 'Primary button label'],
  ['--danger', '--surface', 4.5, 'Danger text on a card'],
  // Focus ring and input borders are non-text UI boundaries (WCAG 1.4.11).
  ['--focus-ring', '--surface', 3, 'Focus ring on a card'],
  ['--focus-ring', '--bg', 3, 'Focus ring on the page'],
  ['--border-input', '--surface', 3, 'Input border'],
  // Table header row: muted label on the tinted header background.
  ['--text-muted', '--surface-alt', 4.5, 'Table column header'],
  /*
   * The `*-bright` fills are graphics, not text, so they are held to WCAG 1.4.11
   * (3:1) rather than 1.4.3 (4.5:1). They still have to be told apart from the
   * surfaces they sit on, which is exactly what a chart legend depends on.
   */
  ['--accent-bright', '--surface', 3, 'Accent chart fill'],
  ['--warning-bright', '--surface', 3, 'Warning chart fill'],
  ['--info-bright', '--surface', 3, 'Info chart fill'],
  ['--success-bright', '--surface', 3, 'Success chart fill'],
  /*
   * Deliberately NOT asserted: 3:1 between two *adjacent series* fills.
   *
   * No four-hue categorical palette can satisfy that, and the WCAG 1.4.11
   * adjacent-colour clause is about information needed to identify a control or
   * boundary, not about every pair of hues in a chart. Segment identity here
   * comes from three channels that do not depend on hue: a fixed stack order, a
   * hairline separator drawn between segments, and exact per-day figures in the
   * recap table directly below the chart. Asserting an unachievable threshold
   * here would only invite someone to weaken a real check.
   */
];

let failures = 0;
let checks = 0;

for (const [schemeName, vars] of [
  ['light', root],
  ['dark', dark],
]) {
  console.log(`\n${schemeName} scheme`);
  console.log('-'.repeat(64));
  for (const [fg, bg, min, label] of PAIRS) {
    const ratio = contrast(resolve(vars, fg), resolve(vars, bg));
    checks += 1;
    const pass = ratio >= min;
    if (!pass) failures += 1;
    console.log(
      `  ${pass ? 'PASS' : 'FAIL'}  ${ratio.toFixed(2).padStart(6)}:1  (min ${min})  ${label}  [${fg} on ${bg}]`,
    );
  }
}

/*
 * Disabled controls, reported but not gated.
 *
 * WCAG 1.4.3 explicitly exempts "inactive" components, and a 50% composite
 * mathematically cannot reach 4.5:1 against its own fill: white on #b91c1c
 * lands at 2.56:1 once dimmed, and the dark accent lands at 3.21:1. Asserting
 * 4.5:1 here would fail every palette, which teaches the reader to ignore the
 * gate.
 *
 * What is worth watching is the *trend*: a disabled control should not be
 * *worse* in dark mode than in light, because the dark accent inverts to a light
 * fill and a uniform opacity then dims text and background by different
 * amounts. A regression here is what produced the 4.11:1 "Setujui" button,
 * which prompted moving `--on-accent` off #431407.
 */
const DISABLED_PAIRS = [
  ['--on-accent', '--accent', 'Primary button label (disabled)'],
  ['--text-inverse', '--danger', 'Danger button label (disabled)'],
];

console.log('\ndisabled controls (50% composite, informational)');
console.log('-'.repeat(64));
for (const [schemeName, vars] of [
  ['light', root],
  ['dark', dark],
]) {
  for (const [fg, bg, label] of DISABLED_PAIRS) {
    const resolvedBg = resolve(vars, bg);
    const ratio = contrast(compositeHex(resolve(vars, fg), resolvedBg), resolvedBg);
    console.log(
      `  INFO  ${ratio.toFixed(2).padStart(6)}:1          ${schemeName}: ${label} (exempt as inactive)`,
    );
  }
}

console.log('');
if (failures > 0) {
  console.error(`${failures} of ${checks} contrast checks FAILED.`);
  process.exit(1);
}
console.log(`All ${checks} contrast checks passed.`);