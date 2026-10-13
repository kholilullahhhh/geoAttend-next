'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, TextArea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import type { Decision } from '@/lib/contracts';

/**
 * Approval controls.
 *
 * Approve and Reject behave differently on purpose:
 *
 *  - **Approve** fires immediately. It is the common, reversible-by-correction
 *    action, and putting it behind a dialog would train people to click through
 *    dialogs.
 *  - **Reject** opens a confirmation that restates the subject and *requires* a
 *    reason. The database guard in `review_leave` / `review_correction` refuses
 *    a rejection without a note, so validating here is fast feedback, not the
 *    security boundary — the check runs again server-side.
 *
 * The outcome is reported through a toast rather than inline text. Inline text
 * lived inside the row, which had usually scrolled away by the time the server
 * replied on a 50-row table.
 */
export function ReviewControls({
  requestId,
  kind,
  subject,
}: {
  requestId: string;
  kind: 'leave' | 'correction';
  subject: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: Decision, reason: string): Promise<boolean> {
    setBusy(decision);
    setError(null);
    try {
      const form = new FormData();
      form.set('kind', kind);
      form.set('id', requestId);
      form.set('decision', decision);
      form.set('note', reason);

      const response = await fetch('/api/approvals', { method: 'POST', body: form });

      let payload: { ok: boolean; message?: string };
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        // A non-JSON body means a proxy or an expired session, not a refusal.
        setError(
          response.status === 401 || response.status === 403
            ? 'Sesi Anda berakhir. Muat ulang halaman lalu masuk kembali.'
            : 'Server tidak memberikan jawaban yang dapat dibaca.',
        );
        return false;
      }

      if (!payload.ok) {
        setError(payload.message ?? 'Gagal memproses keputusan.');
        return false;
      }

      setRejecting(false);
      setNote('');
      toast.success(
        decision === 'APPROVED'
          ? `Pengajuan ${subject} disetujui.`
          : `Pengajuan ${subject} ditolak.`,
      );
      router.refresh();
      return true;
    } catch {
      setError('Tidak ada koneksi ke server. Coba lagi.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  const canReject = note.trim().length > 0;

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="primary"
          loading={busy === 'APPROVED'}
          disabled={busy !== null}
          icon={<Check className="size-4" aria-hidden="true" />}
          onClick={() => void decide('APPROVED', note.trim())}
          aria-label={`Setujui ${subject}`}
        >
          Setujui
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy !== null}
          icon={<X className="size-4" aria-hidden="true" />}
          onClick={() => {
            setError(null);
            setRejecting(true);
          }}
          aria-label={`Tolak ${subject}`}
        >
          Tolak
        </Button>
      </div>

      {/*
        Errors raised outside the dialog (a failed approve) still need a home,
        and this is where the operator's attention already is.
      */}
      {error && !rejecting && (
        <p role="alert" className="mt-1.5 text-right text-xs text-danger">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        onConfirm={() => void decide('REJECTED', note.trim())}
        title={`Tolak pengajuan ${subject}?`}
        description="Keputusan akan tercatat pada audit log bersama alasan dan nama Anda, dan karyawan menerima notifikasi."
        confirmLabel="Tolak pengajuan"
        loading={busy === 'REJECTED'}
        busyLabel="Menyimpan…"
        error={error}
      >
        <Field
          label="Alasan penolakan"
          htmlFor={`reject-note-${requestId}`}
          hint="Wajib diisi. Alasan ini dikirim ke karyawan dan disimpan permanen."
          error={note.length > 0 && !canReject ? 'Alasan belum diisi.' : undefined}
        >
          <TextArea
            id={`reject-note-${requestId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: bentrok dengan periode cuti yang sudah disetujui."
            rows={3}
            maxLength={500}
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}