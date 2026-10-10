'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import type { Decision } from '@/lib/contracts';

/**
 * Approval controls.
 *
 * A reason is not optional for a rejection, matching the database guard in
 * `review_leave` / `review_correction`. Validation happens here for fast feedback
 * *and* again in the server action — the client check is UX, the database check
 * is the security boundary.
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
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: Decision) {
    if (decision === 'REJECTED' && note.trim().length === 0) {
      setError('Alasan wajib diisi saat menolak pengajuan.');
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      const form = new FormData();
      form.set('intent', 'review');
      form.set('kind', kind);
      form.set('id', requestId);
      form.set('decision', decision);
      form.set('note', note.trim());

      const result = await fetch('/api/approvals', {
        method: 'POST',
        body: form,
      });

      const payload = (await result.json()) as { ok: boolean; message?: string };
      if (!payload.ok) {
        setError(payload.message ?? 'Gagal memproses keputusan.');
        return;
      }
      setOpen(false);
      setNote('');
      router.refresh();
    } catch {
      setError('Tidak ada koneksi ke server. Coba lagi.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            loading={busy === 'APPROVED'}
            onClick={() => decide('APPROVED')}
            aria-label={`Setujui ${subject}`}
          >
            Setujui
          </Button>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            aria-label={`Tolak ${subject}`}
          >
            Tolak
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Alasan keputusan (wajib jika menolak)"
            aria-label="Alasan keputusan"
            rows={2}
          />
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              loading={busy === 'REJECTED'}
              onClick={() => decide('REJECTED')}
            >
              Konfirmasi tolak
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      )}
      {error && !open && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}