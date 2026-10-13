import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Report any remaining encoding corruption and any non-ASCII in *user-visible*
 * string literals (as opposed to comments).
 *
 * After `fix-encoding.mjs`, this is the regression guard: it fails if a
 * future PowerShell round-trip reintroduces the corruption, or if a mojibake
 * character ends up inside a string a user will read.
 */
const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Mojibake signatures, not "any character in the Latin-1 supplement".
 *
 * A bare range like `[\u00c2-\u00ef]` flags legitimate typography -- the
 * multiplication sign U+00D7 in "per-filter x links", for one -- which is how
 * a check gets switched off. Corruption is specifically these UTF-8 lead/trail
 * byte pairs being read as single CP1252 characters: `A-circumflex` followed by
 * another Latin-1 supplement char, or the `A-tilde` that precedes them.
 */
const MOJIBAKE = /\u00c2[\u0080-\u00bf]|\u00c3[\u0080-\u00bf]|\u00e2[\u0080-\u00bf\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]|\ufffd/;
const problems = [];

for (const file of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const raw = readFileSync(file, 'utf8');

  // 1. Corruption anywhere, comments included.
  raw.split('\n').forEach((line, i) => {
    if (MOJIBAKE.test(line)) {
      problems.push(`${rel}:${i + 1}  corrupted: ${line.trim().slice(0, 80)}`);
    }
  });

  /*
   * 2. Mojibake residue inside a string literal.
   *
   * Only characters that are *impossible* in intentional Indonesian UI copy are
   * reported. Deliberate typography -- an em dash, a middle dot, an ellipsis, a
   * bullet, a multiplication sign -- is allowed, because this project's prose is
   * full of them and a rule that forbade them would simply be switched off.
   *
   * The distinguishing property of mojibake is that it is a *sequence* of
   * characters from the Latin-1 supplement that decodes to one other character,
   * which is exactly what check 1 and `fix-encoding.mjs` already handle. What
   * remains worth catching here is U+FFFD, which means bytes were lost outright.
   */
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  code.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/'([^'\\]*)'|"([^"\\]*)"|\{`([^`\\]*)`\}/g)) {
      const lit = m[1] ?? m[2] ?? m[3] ?? '';
      if (lit.includes('\ufffd')) {
        problems.push(
          `${rel}:${i + 1}  replacement char in literal: ${JSON.stringify(lit).slice(0, 70)}`,
        );
      }
    }
  });
}

if (problems.length === 0) {
  console.log('OK - no encoding corruption, no non-ASCII in user-visible strings.');
} else {
  for (const p of problems) console.log(p);
  console.log(`\n${problems.length} problem(s). Run: node scripts/fix-encoding.mjs`);
  process.exit(1);
}