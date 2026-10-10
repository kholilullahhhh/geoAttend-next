/**
 * Presentation-layer tests.
 *
 * These cover the logic that is genuinely re-implemented on the web side
 * (formatting, CSV safety). The attendance *rules* — geofencing, lateness,
 * overnight shifts, idempotency, RLS — are asserted against a real PostgreSQL
 * instance in `tools/pgtest`, which is the authoritative suite; duplicating
 * that reasoning here would only test a copy.
 */
import { describe, expect, it } from 'vitest';

import { csvCell, csvRow, exportCsvHref } from './csv';
import {
  formatCoord,
  formatDistance,
  formatDuration,
  formatWorkDays,
  isoRange,
  weekdayShort,
} from './format';

describe('csvCell', () => {
  it('renders nullish values as empty cells', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('')).toBe('');
  });

  it('preserves numbers and plain text unchanged', () => {
    expect(csvCell(42)).toBe('42');
    expect(csvCell(0)).toBe('0');
    expect(csvCell('Budi Santoso')).toBe('Budi Santoso');
  });

  it('quotes values containing a delimiter, quote or newline', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('said "hi"')).toBe('"said ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises spreadsheet formula injection from user-supplied text', () => {
    // These strings originate from free-text fields (absence reasons, review
    // notes). Without the apostrophe prefix a spreadsheet would execute them.
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+HYPERLINK("http://evil","x")')).toBe('"\'+HYPERLINK(""http://evil"",""x"")"');
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('does not mangle values whose dangerous character is not leading', () => {
    expect(csvCell('a=b')).toBe('a=b');
    expect(csvCell('2026-10-10')).toBe('2026-10-10');
  });
});

describe('csvRow', () => {
  it('joins escaped cells with commas', () => {
    expect(csvRow(['a', 'b,c', 3, null])).toBe('a,"b,c",3,');
  });
});

describe('exportCsvHref', () => {
  it('always carries the date range', () => {
    const href = exportCsvHref({ from: '2026-10-01', to: '2026-10-10' });
    expect(href).toContain('from=2026-10-01');
    expect(href).toContain('to=2026-10-10');
  });

  it('omits empty optional filters instead of sending empty strings', () => {
    const href = exportCsvHref({ from: '2026-10-01', to: '2026-10-10', search: null });
    expect(href).not.toContain('q=');
    expect(href).not.toContain('dept=');
  });
});

describe('formatDuration', () => {
  it('renders hours and minutes', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1j');
    expect(formatDuration(90)).toBe('1j 30m');
  });

  it('shows a placeholder for missing or invalid values', () => {
    expect(formatDuration(null)).toBe('--');
    expect(formatDuration(undefined)).toBe('--');
    expect(formatDuration(Number.NaN)).toBe('--');
    expect(formatDuration(-5)).toBe('--');
  });
});

describe('formatDistance', () => {
  it('switches from metres to kilometres at 1000 m', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(142.4)).toBe('142 m');
    expect(formatDistance(999.6)).toBe('1000 m');
    expect(formatDistance(1400)).toBe('1.4 km');
  });

  it('shows a placeholder when unknown', () => {
    expect(formatDistance(null)).toBe('-');
  });
});

describe('formatCoord', () => {
  it('uses fixed six-decimal precision so columns align', () => {
    expect(formatCoord(-6.2)).toBe('-6.200000');
    expect(formatCoord(106.816666666)).toBe('106.816667');
  });

  it('shows a placeholder for unknown coordinates', () => {
    expect(formatCoord(null)).toBe('-');
  });
});

describe('formatWorkDays', () => {
  it('lists weekdays in order', () => {
    expect(formatWorkDays([1, 2, 3, 4, 5])).toBe('Sen, Sel, Rab, Kam, Jum');
    expect(formatWorkDays([6, 1])).toBe('Sen, Sab');
  });

  it('collapses a full week to a single label', () => {
    expect(formatWorkDays([1, 2, 3, 4, 5, 6, 7])).toBe('Setiap hari');
  });

  it('handles shift-only and missing day lists', () => {
    expect(formatWorkDays([2])).toBe('Sel');
    expect(formatWorkDays([])).toBe('Setiap hari');
    expect(formatWorkDays(null)).toBe('Setiap hari');
  });
});

describe('isoRange', () => {
  it('produces an inclusive range of dates', () => {
    expect(isoRange('2026-10-01', '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('crosses month and year boundaries correctly', () => {
    expect(isoRange('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('returns a single day when the range is one day', () => {
    expect(isoRange('2026-10-01', '2026-10-01')).toEqual(['2026-10-01']);
  });

  it('respects the safety cap', () => {
    expect(isoRange('2020-01-01', '2026-01-01', 10)).toHaveLength(10);
  });

  it('returns nothing for an invalid range', () => {
    expect(isoRange('not-a-date', '2026-01-01')).toEqual([]);
  });
});

describe('weekdayShort', () => {
  it('uses ISO weekday numbering where Monday is first', () => {
    expect(weekdayShort('2026-10-05')).toBe('Sen');
    expect(weekdayShort('2026-10-11')).toBe('Min');
  });
});