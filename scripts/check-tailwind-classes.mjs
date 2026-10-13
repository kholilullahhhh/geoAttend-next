/**
 * Dev-only check: find Tailwind classes referenced in source but absent from
 * the compiled CSS.
 *
 * Tailwind v4 silently drops a class it does not recognise ??" no build error, no
 * warning. That is how `rounded-pill` shipped as a dead class for months, and
 * how `outline-focus-ring` and `duration-fast` nearly shipped the same way. This
 * script turns that silence into a failure.
 *
 * Run with: node scripts/check-tailwind-classes.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const CSS_DIR = join(ROOT, '.next', 'static');

/** Utilities whose names are dynamic and cannot be grepped for statically. */
const IGNORE_PREFIXES = ['peer-', 'group-'];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(tsx?|css)$/.test(entry)) files.push(full);
  }
  return files;
}

function compiledCss() {
  let found = null;
  const search = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) search(full);
      else if (entry.endsWith('.css') && !found) found = readFileSync(full, 'utf8');
    }
  };
  search(CSS_DIR);
  return found;
}

/** Class names appearing inside `className` strings and Tailwind directives. */
function extractCandidates(source) {
  const out = new Set();
  const classAttr = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;
  for (const m of source.matchAll(classAttr)) {
    for (const raw of [m[1], m[2], m[3]]) {
      if (!raw) continue;
      // Keep only the static word-ish parts; ignore `${...}` interpolation.
      for (const token of raw.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
        const t = token.trim();
        if (!t || t.startsWith('${')) continue;
        if (IGNORE_PREFIXES.some((p) => t.startsWith(p))) continue;
        // Must look like a utility: contains a letter and a hyphen or is a known
        // bare keyword. This filters out sentence fragments and route paths.
        if (/^[a-z0-9:/[\]().,_%-]+$/.test(t) && /[a-z]/.test(t)) out.add(t);
      }
    }
  }
  return out;
}

const css = compiledCss();
if (!css) {
  console.error('No compiled CSS found in .next/static ??" run `npm run build` first.');
  process.exit(1);
}

/**
 * The `--spacing-*` collision.
 *
 * `globals.css` defines `--spacing-xs/sm/md/lg/xl/2xl/3xl` to mirror the mobile
 * app's 4pt scale. Tailwind v4 resolves `max-w-<name>` against that scale before
 * the container scale, so `max-w-xl` silently becomes 1.5rem -- which produced a
 * 24px dialog that clipped its own title to one character per line. Lint,
 * typecheck, the unit tests and a successful build all stayed green; only a
 * screenshot caught it.
 *
 * A static guard is the right shape for this trap, so it does not need a browser.
 */
const SPACING_COLLISIONS = new Set([
  'max-w-xs',
  'max-w-sm',
  'max-w-md',
  'max-w-lg',
  'max-w-xl',
  'max-w-2xl',
  'max-w-3xl',
]);

/*
 * Scans the raw source, not just `className` attributes.
 *
 * The Dialog widths live in a plain `const width = ... ? 'max-w-md' : ...` and
 * are interpolated later, so an attribute-only scan misses exactly the case
 * this guard exists for. A boundary check on either side of the name is enough
 * to avoid matching prose such as "max-w-xl (36rem)=144".
 */
const collisions = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const raw = readFileSync(file, 'utf8');

  // Strip block and line comments first. The `globals.css` documentation for
  // this very collision lists every bad name as prose, and matching that would
  // make the guard permanently red.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  src.split('\n').forEach((line, i) => {
    for (const name of SPACING_COLLISIONS) {
      const re = new RegExp(`(^|[^\\w-])${name}([^\\w-]|$)`);
      if (re.test(line)) {
        collisions.push(`  ${name}  (${rel}:${i + 1})`);
      }
    }
  });
}

if (collisions.length > 0) {
  console.error(
    '\n`--spacing-*` collision: named `max-w` utilities resolve against the 4pt\n' +
      'spacing scale in globals.css, not the container scale, so they resolve to\n' +
      '4pt-based widths. Use the numeric equivalents:\n' +
      '  max-w-sm(24rem)=96   max-w-md(28rem)=112  max-w-lg(32rem)=128\n' +
      '  max-w-xl(36rem)=144  max-w-2xl(42rem)=168 max-w-3xl(48rem)=192\n',
  );
  for (const c of collisions) console.error(c);
  console.error('');
  process.exit(1);
}

/**
 * Every class the stylesheet actually defines, unescaped.
 *
 * Tailwind escapes the characters that are special in a CSS selector, so
 * `.gap-1\.5` in the output is `.gap-1.5` as written in the source. Unescaping
 * first is what makes this comparison meaningful.
 */
const defined = new Set();
for (const m of css.matchAll(/\.((?:\\.|[^\s.,:[\]()>+~{])+)/g)) {
  let raw = m[1].replace(/\\(.)/g, '$1');
  // Split variant prefixes on the real colons, not on escaped ones.
  for (const part of raw.split(':')) {
    if (!part) continue;
    defined.add(part);
    // `[1fr_1fr]` is written `[1fr_1fr]` in source, `_` in the selector.
    defined.add(part.replace(/_/g, ' '));
  }
}

const missing = new Map();
for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  for (const candidate of extractCandidates(src)) {
    // A candidate is satisfied if the stylesheet defines the full class or the
    // last segment of a variant prefix (`lg:pl-62` -> `pl-62`).
    const parts = candidate.split(':');
    if (parts.some((p) => defined.has(p))) continue;
    const key = candidate;
    if (!missing.has(key)) missing.set(key, new Set());
    missing.get(key).add(relative(ROOT, file));
  }
}

if (missing.size === 0) {
  console.log(`OK - every Tailwind class in src/ is present in the compiled CSS.`);
  process.exit(0);
}

console.error(`\n${missing.size} Tailwind class(es) referenced but not generated:\n`);
for (const [cls, files] of [...missing].sort()) {
  console.error(`  ${cls}`);
  for (const f of files) console.error(`      ${f}`);
}
console.error(
  '\nTailwind v4 drops unrecognised utilities silently. Either the token is',
);
console.error('missing from @theme in src/app/globals.css, or the class is wrong.\n');
process.exit(1);
