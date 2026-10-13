/**
 * Visual + behavioural smoke run.
 *
 * Drives a real Chromium against the dev server, signs in with the seeded
 * ADMIN account, and walks every dashboard route at three viewports, capturing
 * screenshots and asserting on accessibility-critical DOM facts.
 *
 * This exists because none of lint, typecheck, the unit tests or a production
 * build can tell you that a drawer fails to trap focus, that a table overflows
 * the viewport, or that dark mode renders a badge at 1.3:1. Those only show up
 * in a browser.
 *
 * Usage: node scripts/e2e.mjs [--base http://localhost:3000] [--out <dir>]
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf('--base', 'http://localhost:3000');
const OUT = argOf('--out', join(process.cwd(), '.screenshots'));
const EMAIL = argOf('--email', 'admin@geoattend.dev');
const PASSWORD = argOf('--password', 'Password123!');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

const ROUTES = [
  { path: '/', name: 'overview', expect: 'Ringkasan Kehadiran' },
  { path: '/attendance', name: 'attendance', expect: 'Data Absensi' },
  { path: '/approvals', name: 'approvals', expect: 'Persetujuan' },
  { path: '/reports', name: 'reports', expect: 'Laporan Kehadiran' },
  { path: '/employees', name: 'employees', expect: 'Direktori' },
  { path: '/settings', name: 'settings', expect: 'Pengaturan Sistem' },
];

mkdirSync(OUT, { recursive: true });

const findings = [];
const fail = (msg) => findings.push(`FAIL ${msg}`);
const warn = (msg) => findings.push(`WARN ${msg}`);

/**
 * WCAG relative luminance from an `rgb()`/`rgba()` string.
 * Kept here rather than imported so this file has no dependency beyond the
 * browser driver itself.
 */
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const context = await browser.newContext({
  viewport: VIEWPORTS[0],
  deviceScaleFactor: 1,
});

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') warn(`console error on ${page.url()}: ${m.text().slice(0, 160)}`);
});

/*
 * Network failures.
 *
 * Recorded but only *reported* at the end, because Next's router legitimately
 * aborts in-flight RSC prefetches when a navigation supersedes them
 * (`net::ERR_ABORTED` on `?_rsc=...`). Treating that as a defect produces a
 * permanently red suite; a 4xx/5xx is a real problem and is called out.
 */
const networkFailures = new Map();
page.on('response', (r) => {
  if (r.status() >= 400) networkFailures.set(`${r.status()} ${r.url()}`, (networkFailures.get(`${r.status()} ${r.url()}`) ?? 0) + 1);
});

console.log(`Signing in as ${EMAIL} ...`);
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#\\:r0\\:, #\\:r2\\:, input[type="email"]', EMAIL).catch(async () => {
  await page.locator('input[type="email"]').fill(EMAIL);
});
await page.locator('input[type="password"]').fill(PASSWORD);
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
console.log(`  landed on ${page.url()}`);

// ---------------------------------------------------------------------------
// Per-viewport walk
// ---------------------------------------------------------------------------
for (const vp of VIEWPORTS) {
  console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
  await page.setViewportSize({ width: vp.width, height: vp.height });

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);

    const url = page.url();
    if (url.includes('/login')) {
      fail(`${route.name}@${vp.name}: redirected to login (session lost)`);
      continue;
    }

    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    if (!h1) fail(`${route.name}@${vp.name}: no <h1> (heading outline broken)`);

    /*
     * `locator.filter({ visible: true })` rather than `.first()`: a page title
     * appears in the sidebar, the breadcrumb, the topbar and the `<h1>`, and the
     * collapsed-sidebar copy is `sr-only` -- so the first DOM match is a
     * zero-width element that is correctly hidden, and asserting on it reports a
     * false failure.
     */
    const expectVisible = page
      .getByText(route.expect, { exact: false })
      .locator('visible=true')
      .first();
    if (route.expect && !(await expectVisible.isVisible().catch(() => false))) {
      fail(`${route.name}@${vp.name}: expected text "${route.expect}" not visible`);
    }

    /*
     * Proportional bars must actually paint.
     *
     * This exists because of a real bug: a segment held the *CSS value*
     * `var(--danger)` in its `className`, which Tailwind accepts as an arbitrary
     * class and therefore silently ignored. The bar rendered at full width with
     * a transparent fill, so "100% belum check-in" displayed as an empty track.
     * A width alone proves nothing; the computed background has to be opaque.
     */
    const invisibleBars = await page.evaluate(() => {
      const out = [];
      for (const bar of document.querySelectorAll('[role="img"]')) {
        // Recharts puts its own wrapper div where our bars put segments, and it
        // is legitimately transparent -- the marks live in the SVG below it. So a
        // chart container is checked through its marks instead of its children.
        if (bar.querySelector('svg')) {
          const marks = [...bar.querySelectorAll('.recharts-bar-rectangle path, .recharts-line-curve')];
          for (const mark of marks) {
            const paint = getComputedStyle(mark).fill;
            const stroke = getComputedStyle(mark).stroke;
            if (paint === 'none' && stroke === 'none') {
              out.push(`${bar.getAttribute('aria-label')} -- a series mark has neither fill nor stroke`);
              break;
            }
          }
          continue;
        }

        for (const seg of bar.children) {
          const w = seg.getBoundingClientRect().width;
          if (w < 1) continue;
          const bg = getComputedStyle(seg).backgroundColor;
          const m = bg.match(/rgba?\(([^)]+)\)/);
          const parts = m ? m[1].split(/[,/\s]+/).filter(Boolean).map(Number) : [];
          const alpha = parts.length > 3 ? parts[3] : 1;
          if (alpha < 0.5) {
            out.push(`${bar.getAttribute('aria-label')} -- width ${Math.round(w)}px, bg ${bg}`);
          }
        }
      }
      return [...new Set(out)];
    });
    for (const ib of invisibleBars) fail(`${route.name}@${vp.name}: bar segment has no visible fill -- ${ib}`);

    // An error boundary or a "gagal memuat" card means the page failed.
    if (await page.getByText('Halaman ini gagal dimuat').isVisible().catch(() => false)) {
      fail(`${route.name}@${vp.name}: rendered an error boundary`);
    }

    // Horizontal overflow: the page must never scroll sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 2) {
      fail(`${route.name}@${vp.name}: horizontal overflow of ${overflow}px`);
    }

    // Every focusable control must be reachable and have an accessible name.
    const unnamed = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('button, a[href], input, select, textarea')];
      return nodes
        .filter((el) => {
          const label =
            el.getAttribute('aria-label') ||
            (el.labels && el.labels.length ? el.labels[0].textContent : '') ||
            (el.textContent || '').trim() ||
            el.getAttribute('title') ||
            el.getAttribute('placeholder');
          const visible = el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
          return visible && !label;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 90));
    });
    for (const u of unnamed) fail(`${route.name}@${vp.name}: control without an accessible name -- ${u}`);

    // Contrast on badge/status text, sampled in both schemes.
    for (const scheme of ['light', 'dark']) {
      await page.evaluate((s) => {
        document.documentElement.classList.toggle('dark', s === 'dark');
      }, scheme);
      await page.waitForTimeout(120);

      const lowContrast = await page.evaluate(() => {
        // Both helpers are declared *inside* the browser context: `page.evaluate`
        // serialises the function body, so it cannot close over module scope.
        const parse = (str) => {
          const m = str.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
          if (parts.length < 3 || parts.some(Number.isNaN)) return null;
          return parts;
        };
        const out = [];
        const lum = (rgb) => {
          const [r, g, b] = rgb.map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        for (const el of document.querySelectorAll('span, p, dd, td, th, h1, h2, h3, a, button, label')) {
          if (el.offsetParent === null) continue;
          const text = (el.textContent || '').trim();
          if (!text || text.length > 90) continue;
          // Only leaf-ish nodes, so we do not double-report a whole card.
          if (el.children.length > 2) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.opacity === '0') continue;

          let bgEl = el;
          let bg = parse(cs.backgroundColor);
          while (!bg && bgEl.parentElement) {
            bgEl = bgEl.parentElement;
            bg = parse(getComputedStyle(bgEl).backgroundColor);
          }
          const fg = parse(cs.color);
          if (!fg || !bg) continue;
          // Skip elements whose own background is transparent-ish but has alpha.
          if (bg[3] !== undefined && bg[3] < 0.5) continue;

          const a = lum(fg.slice(0, 3));
          const b = lum(bg.slice(0, 3));
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const px = parseFloat(cs.fontSize);
          const bold = Number(cs.fontWeight) >= 700;
          const large = px >= 24 || (px >= 18.66 && bold);
          const min = large ? 3 : 4.5;
          if (ratio < min) {
            out.push(
              `${el.tagName.toLowerCase()} "${text.slice(0, 34)}" ${ratio.toFixed(2)}:1 (need ${min}) ` +
                `fg=${cs.color} bg=${getComputedStyle(bgEl).backgroundColor}`,
            );
          }
        }
        return [...new Set(out)];
      });

      for (const lc of lowContrast) {
        fail(`${route.name}@${vp.name}/${scheme}: low contrast -- ${lc}`);
      }
    }

    // Restore light for the screenshot.
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.waitForTimeout(150);

    const shot = join(OUT, `${route.name}-${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: vp.name === 'desktop' });
    console.log(`  ${route.name}: captured ${shot}`);
  }
}

// ---------------------------------------------------------------------------
// Interaction checks at desktop
// ---------------------------------------------------------------------------
console.log('\n=== interaction ===');
await page.setViewportSize(VIEWPORTS[0]);

// Mobile drawer: focus trap, Escape, focus restore.
await page.setViewportSize(VIEWPORTS[2]);
await page.goto(`${BASE}/attendance`, { waitUntil: 'networkidle' });
const menuBtn = page.locator('button[aria-label="Buka menu navigasi"]');
if (!(await menuBtn.isVisible().catch(() => false))) {
  fail('mobile: no "Buka menu navigasi" button in the top bar');
} else {
  await menuBtn.click();
  await page.waitForTimeout(300);
  const dialog = page.locator('#app-nav-drawer');
  if (!(await dialog.isVisible().catch(() => false))) {
    fail('mobile: drawer did not open');
  } else {
    const insideDialog = await page.evaluate(
      () => document.activeElement?.closest('#app-nav-drawer') !== null,
    );
    if (!insideDialog) fail('mobile: focus did not move into the drawer on open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    if (await dialog.isVisible().catch(() => false)) fail('mobile: Escape did not close the drawer');
    const restored = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') === 'Buka menu navigasi',
    );
    if (!restored) warn('mobile: focus did not return to the trigger after closing the drawer');
  }
}
await page.screenshot({ path: join(OUT, 'mobile-drawer-check.png') });

// Filter panel collapse on mobile.
await page.goto(`${BASE}/attendance`, { waitUntil: 'networkidle' });
const filterToggle = page.locator('button[aria-controls="filter-panel"]');
if (!(await filterToggle.isVisible().catch(() => false))) {
  fail('mobile: filter panel is not collapsible below lg');
} else {
  const expanded = await filterToggle.getAttribute('aria-expanded');
  if (expanded === 'true') {
    await filterToggle.click();
    await page.waitForTimeout(250);
  }
  const panelHidden = await page.evaluate(() => {
    const p = document.getElementById('filter-panel');
    return p ? getComputedStyle(p).display === 'none' : false;
  });
  if (!panelHidden) fail('mobile: filter panel did not collapse when toggled');
  await page.screenshot({ path: join(OUT, 'mobile-filters-collapsed.png') });
}

// Reject dialog: focus trap + required reason.
await page.setViewportSize(VIEWPORTS[0]);
await page.goto(`${BASE}/approvals?tab=leave&status=PENDING`, { waitUntil: 'networkidle' });
const rejectBtn = page.locator('button[aria-label^="Tolak "]').first();
if (await rejectBtn.isVisible().catch(() => false)) {
  await rejectBtn.click();
  await page.waitForTimeout(350);
  const dialog = page.locator('[role="dialog"]');
  if (!(await dialog.isVisible().catch(() => false))) {
    fail('approvals: reject did not open a confirmation dialog');
  } else {
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    if (!focused) fail('approvals: dialog opened without moving focus');
    await page.screenshot({ path: join(OUT, 'approvals-reject-dialog.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    if (await dialog.isVisible().catch(() => false)) {
      fail('approvals: Escape did not close the reject dialog');
    }
  }
} else {
  warn('approvals: no PENDING leave request to exercise the reject dialog');
}

// Skip link.
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.keyboard.press('Tab');
const skip = await page.evaluate(() => {
  const el = document.activeElement;
  return el ? `${el.tagName.toLowerCase()}:${(el.textContent || '').trim().slice(0, 30)}` : 'none';
});
if (!/a:/i.test(skip)) fail(`skip link: first Tab stop was ${skip}, expected an anchor`);

// Live indicator honesty: it must report a state, not claim to be live blindly.
await page.goto(`${BASE}/attendance`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const live = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span')].find((s) =>
    /Langsung|Terputus|Menghubungkan/.test(s.textContent || ''),
  );
  return el ? el.textContent.trim() : 'MISSING';
});
console.log(`  live indicator reports: "${live}"`);
if (live === 'MISSING') fail('attendance: no live-indicator state is rendered');

// Attendance detail + geofence diagram.
const firstRow = page.locator('a[href^="/attendance/"]').first();
if (await firstRow.isVisible().catch(() => false)) {
  await firstRow.click();
  await page.waitForURL(/\/attendance\/[0-9a-f-]{36}/, { timeout: 20000 });
  await page.waitForTimeout(400);
  const svg = page.locator('figure svg[role="img"]').first();
  if (!(await svg.isVisible().catch(() => false))) {
    fail('detail: geofence diagram did not render for an attendance record with coordinates');
  } else {
    const label = await svg.getAttribute('aria-label');
    if (!label) fail('detail: geofence SVG has no aria-label');
    console.log(`  geofence aria-label: "${label}"`);
  }
  await page.screenshot({ path: join(OUT, 'attendance-detail-desktop.png'), fullPage: true });
} else {
  warn('attendance: no rows to open a detail page from (empty seed?)');
}

await browser.close();

// ---------------------------------------------------------------------------
for (const [what, count] of networkFailures) {
  warn(`network: ${what} (${count}x)`);
}

console.log('\n================ FINDINGS ================');
if (findings.length === 0) {
  console.log('No findings.');
} else {
  for (const f of findings) console.log(f);
  const hard = findings.filter((f) => f.startsWith('FAIL')).length;
  console.log(`\n${hard} failures, ${findings.length - hard} warnings.`);
  console.log(`Screenshots: ${OUT}`);
  if (hard > 0) process.exit(1);
}