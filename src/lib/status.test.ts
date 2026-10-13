/**
 * Status vocabulary tests.
 *
 * These guard the two things most likely to silently regress on this project:
 *
 *  1. **Mobile parity.** The labels and tones below are copied from
 *     `apps/mobile/src/components/Badge.tsx`. Nothing here verifies that file,
 *     but it pins *our* copy so a well-meaning edit has to be a deliberate one.
 *  2. **Degradation.** An unrecognised code must produce a visible, labelled
 *     placeholder. A blank badge in a status column is indistinguishable from a
 *     rendering bug, and an uncaught `undefined` map lookup is how it happens.
 */
import { describe, expect, it } from 'vitest';

import {
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_ORDER,
  LEAVE_TYPE_LABEL,
  REQUEST_STATUS,
  REQUEST_STATUS_ORDER,
  RISK_HELP,
  RISK_LABEL,
  RISK_SHORT,
  ROLE_LABEL,
  attendanceStatus,
  requestStatus,
  statusLabel,
} from './status';

describe('attendance status vocabulary', () => {
  it('covers every code the filter dropdown offers', () => {
    for (const code of ATTENDANCE_STATUS_ORDER) {
      expect(ATTENDANCE_STATUS[code], `missing definition for ${code}`).toBeDefined();
    }
  });

  it('uses the labels employees already see on their phone', () => {
    expect(ATTENDANCE_STATUS.CHECKED_IN?.label).toBe('Sedang bekerja');
    expect(ATTENDANCE_STATUS.COMPLETED?.label).toBe('Selesai');
    expect(ATTENDANCE_STATUS.EXCUSED?.label).toBe('Dispensasi');
    expect(ATTENDANCE_STATUS.ABSENT?.label).toBe('Tidak hadir');
  });

  it('keeps COMPLETED green, matching the mobile app', () => {
    // This drifted once: the web called it `accent` while the mobile app called
    // it `success`, so the same record was orange on one screen and green on
    // the other.
    expect(ATTENDANCE_STATUS.COMPLETED?.tone).toBe('success');
    expect(ATTENDANCE_STATUS.CHECKED_IN?.tone).toBe('info');
    expect(ATTENDANCE_STATUS.ABSENT?.tone).toBe('danger');
  });

  it('resolves an unknown code to a visible placeholder, never to blank', () => {
    const spec = attendanceStatus('SOMETHING_NEW');
    expect(spec.label).toBe('Tidak dikenal');
    expect(spec.icon).toBeDefined();
    expect(attendanceStatus(null).label).toBe('Tidak dikenal');
    expect(attendanceStatus(undefined).label).toBe('Tidak dikenal');
  });

  it('resolves known codes to their real definition', () => {
    expect(statusLabel('CHECKED_IN')).toBe('Sedang bekerja');
    expect(statusLabel('COMPLETED')).toBe('Selesai');
  });
});

describe('workflow status vocabulary', () => {
  it('covers every code the approvals filter offers', () => {
    for (const code of REQUEST_STATUS_ORDER) {
      expect(REQUEST_STATUS[code], `missing definition for ${code}`).toBeDefined();
    }
  });

  it('uses the Indonesian labels from the mobile app', () => {
    expect(requestStatus('PENDING').label).toBe('Menunggu');
    expect(requestStatus('APPROVED').label).toBe('Disetujui');
    expect(requestStatus('REJECTED').label).toBe('Ditolak');
    expect(requestStatus('CANCELLED').label).toBe('Dibatalkan');
  });

  it('separates pending (warning) from approved (success)', () => {
    // Both were `accent` at one point, which made the approval queue read as
    // one undifferentiated list.
    expect(requestStatus('PENDING').tone).toBe('warning');
    expect(requestStatus('APPROVED').tone).toBe('success');
    expect(requestStatus('REJECTED').tone).toBe('danger');
    expect(requestStatus('CANCELLED').tone).toBe('neutral');
  });

  it('degrades an unknown workflow code safely', () => {
    expect(requestStatus('ESCALATED').label).toBe('Tidak dikenal');
  });
});

describe('risk flags', () => {
  const codes = ['LOW_ACCURACY', 'OUT_OF_RADIUS', 'IMPOSSIBLE_TRAVEL', 'DEVICE_TIME_MISMATCH', 'DUPLICATE_DEVICE'];

  it('has a short, a long and an explanation for every code', () => {
    for (const code of codes) {
      expect(RISK_SHORT[code], `missing RISK_SHORT for ${code}`).toBeTruthy();
      expect(RISK_LABEL[code], `missing RISK_LABEL for ${code}`).toBeTruthy();
      expect(RISK_HELP[code], `missing RISK_HELP for ${code}`).toBeTruthy();
    }
  });

  it('keeps the short form short enough for a table cell', () => {
    for (const code of codes) {
      expect(RISK_SHORT[code]!.length).toBeLessThanOrEqual(24);
    }
  });

  it('does not accuse anyone in the explanation text', () => {
    // These are signals for a human to investigate. Wording that asserts
    // misconduct would be a product and legal problem, not just a tone problem.
    for (const code of codes) {
      const help = RISK_HELP[code]!.toLowerCase();
      expect(help).not.toContain('penipuan');
      expect(help).not.toContain('curang');
      expect(help).not.toContain('bohong');
      expect(help).not.toContain('mencurig');
    }
  });
});

describe('reference labels', () => {
  it('translates every leave type', () => {
    for (const code of ['ANNUAL', 'SICK', 'PERSONAL', 'UNPAID', 'OTHER']) {
      expect(LEAVE_TYPE_LABEL[code], `missing label for ${code}`).toBeTruthy();
    }
    // A typo here ("TanpaBayar") reached production once.
    expect(LEAVE_TYPE_LABEL.UNPAID).toBe('Tanpa bayar');
  });

  it('translates every role', () => {
    expect(ROLE_LABEL.EMPLOYEE).toBe('Karyawan');
    expect(ROLE_LABEL.HR).toBe('HRD');
    expect(ROLE_LABEL.ADMIN).toBe('Administrator');
  });
});