/**
 * Repair mojibake in source comments and string literals.
 *
 * A UTF-8 file read as CP1252 and written back as UTF-8 turns `--` into three
 * mojibake characters. Two of those landed in *user-visible* strings
 * (`Memproses...`, the separator), so this is a real bug, not just messy comments.
 *
 * The round trip is: re-encode the line's code points as CP1252 bytes, then
 * decode those bytes as UTF-8. A full CP1252 table is required -- the offending
 * characters are things like U+20AC EURO SIGN and U+2019 RIGHT SINGLE QUOTOTE,
 * which live above Latin-1 and would otherwise abort the repair.
 *
 * Only lines that both look corrupted AND round-trip cleanly are touched, so a
 * legitimately accented line is never rewritten.
 *
 * Usage: node scripts/fix-encoding.mjs [--check]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const CHECK_ONLY = process.argv.includes('--check');
const ROOT = process.cwd();

/**
 * CP1252 code points 0x80-0x9F, which Windows-1252 remaps over the C1 controls.
 * Without these the repair cannot decode the euro sign or the curly quotes.
 */
const CP1252_HIGH = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
  [0x017e, 0x9e], [0x0178, 0x9f],
]);

/** Mojibake residue: a Latin-1 supplement char in the 0xC0-0xEF band, or U+FFFD. */
const SUSPECT = /[\u00c2-\u00ef\ufffd]/;

/** Re-decode one line as if it had been CP1252-mangled. Returns null if it was not. */
function repair(line) {
  if (!SUSPECT.test(line)) return null;

  const bytes = [];
  for (const ch of line) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xff) {
      bytes.push(cp);
    } else {
      const high = CP1252_HIGH.get(cp);
      if (high === undefined) return null; // genuine non-Latin-1 text
      bytes.push(high);
    }
  }

  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    if (decoded.includes('\ufffd')) return null;
    return decoded;
  } catch {
    return null; // not valid UTF-8 once re-encoded, so it was not mojibake
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css|mjs|json)$/.test(entry)) out.push(full);
  }
  return out;
}

const findings = [];
for (const file of walk(join(ROOT, 'src')).concat(walk(join(ROOT, 'scripts')))) {
  const before = readFileSync(file, 'utf8');
  let changed = 0;

  const after = before
    .split('\n')
    .map((line) => {
      const fixed = repair(line);
      if (fixed !== null && fixed !== line) {
        changed += 1;
        return fixed;
      }
      return line;
    })
    .join('\n');

  if (changed > 0) {
    findings.push({ file: relative(ROOT, file), changed });
    if (!CHECK_ONLY) writeFileSync(file, after, 'utf8');
  }
}

if (findings.length === 0) {
  console.log('OK - no encoding corruption found.');
} else {
  for (const f of findings) {
    console.log(`${CHECK_ONLY ? 'WOULD FIX' : 'fixed'}  ${f.changed} line(s)  ${f.file}`);
  }
  if (CHECK_ONLY) process.exit(1);
}