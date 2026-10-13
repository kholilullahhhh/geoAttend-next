/**
 * Touch target audit.
 *
 * The desktop sweep measures with a fine pointer, where compact sizing is
 * correct. This measures the same controls with a coarse pointer and reports
 * anything short of the 40px floor from `control.minTarget` (WCAG 2.5.5).
 *
 * The project's own token is 40px, and several components -- the Button `sm`
 * variant, filter chips, breadcrumb links -- are 36px or smaller on a fine
 * pointer. That is deliberate for dense desktop toolbars, so the fix is not to
 * make them 40px everywhere but to restore the floor where a finger is doing
 * the aiming, including on a 1024px tablet that is as touch-only as a phone.
 *
 * Requires a running dev server and a Chromium build; `playwright-core` is not
 * a project dependency, so run this from a directory where it is installed.
 *
 * Usage: node scripts/check-touch-targets.mjs [--base http://localhost:3000]
 */
import { chromium } from 'playwright-core';

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:3000';

const ROUTES = ['/', '/attendance', '/approvals', '/employees', '/reports', '/settings'];
const VIEWPORTS = [
  { w: 390, h: 844, name: 'phone' },
  { w: 768, h: 1024, name: 'tablet' },
];

const findings = [];
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });

const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill('admin@geoattend.dev');
await page.locator('input[type="password"]').fill('Password123!');
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });

// What the browser actually reports for the primary pointer.
const pointer = await page.evaluate(
  () => window.matchMedia('(pointer: coarse)').matches,
);
console.log(`(pointer: coarse) -> ${pointer}`);
if (!pointer) {
  console.error('FAIL: context is not reporting a coarse pointer.');
  process.exit(1);
}

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  for (const path of ROUTES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);

    const rows = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, a[href], select, input, summary')) {
        if (el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.height === 0 || r.height >= 40) continue;
        const cs = getComputedStyle(el);
        if (cs.pointerEvents === 'none') continue;
        /*
         * The skip link is `sr-only` until it takes focus, so its resting box is
         * collapsed and its measured height says nothing about the target a
         * keyboard user actually tabs to.
         *
         * Matched by `margin: -1px` rather than by `width: 1px`: Tailwind v4
         * dropped the long-standing `clip: rect(0,0,0,0)` from `sr-only` in
         * favour of `clip-path: inset(50%)`, so the old tell no longer appears.
         * Negative margin is the property that survives the change.
         */
        if (cs.position === 'absolute' && cs.margin === '-1px') continue;
        /*
         * Stretched row links.
         *
         * `RowLink` renders its anchor around the cell's text and then covers
         * the whole cell with an `::after` pseudo-element. The anchor's own box
         * is the 17px of text inside it; the thing a finger actually lands on is
         * the stretched overlay, which is the full row height. Judging the
         * anchor's box would report a miss that does not exist.
         */
        const after = getComputedStyle(el, '::after');
        if (after.position === 'absolute' && after.inset === '0px') continue;

        out.push({
          h: Math.round(r.height),
          what: `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`,
          cls: String(el.className).slice(0, 70),
        });
      }
      return out;
    });

    for (const r of rows) {
      findings.push(`${vp.name} ${vp.w}px ${path}: ${r.what} is ${r.h}px  [${r.cls}]`);
    }
  }
}

// The drawer's own controls.
await page.goto(`${BASE}/attendance`, { waitUntil: 'networkidle' });
await page.setViewportSize({ width: 390, height: 844 });
await page.locator('button[aria-label="Buka menu navigasi"]').click();
await page.waitForTimeout(400);
const drawerRows = await page.evaluate(() => {
  const drawer = document.querySelector('#app-nav-drawer');
  if (!drawer) return [];
  const out = [];
  for (const el of drawer.querySelectorAll('button, a[href]')) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < 40) {
      out.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 24)}" is ${Math.round(r.height)}px`);
    }
  }
  return out;
});
for (const r of drawerRows) findings.push(`drawer @390px: ${r}`);

await browser.close();

console.log('\n================ TOUCH TARGETS ================');
if (findings.length === 0) {
  console.log('All interactive controls reach the 40px floor on a coarse pointer.');
} else {
  for (const f of findings) console.log(f);
  console.log(`\n${findings.length} finding(s).`);
}
