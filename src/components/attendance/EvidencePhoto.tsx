'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * Attendance evidence photo with a lightbox.
 *
 * If the object has been purged by the retention job — or access is refused —
 * the component says so explicitly instead of showing a broken image.
 */
export function EvidencePhoto({
  src,
  alt,
  caption,
}: {
  src: string | null;
  alt: string;
  caption?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  if (!src || failed) {
    return (
      <figure className="flex flex-col gap-2">
        <div className="flex aspect-3/4 w-full max-w-56 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong bg-surface-alt text-center">
          <ImageOff className="size-6 text-ink-muted" aria-hidden="true" />
          <p className="px-md text-xs text-ink-muted">
            {src ? 'Foto tidak dapat dimuat atau sudah dihapus.' : 'Tidak ada foto tersimpan.'}
          </p>
        </div>
        {caption && <figcaption className="text-xs text-ink-muted">{caption}</figcaption>}
      </figure>
    );
  }

  return (
    <figure className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full max-w-56 overflow-hidden rounded-md border border-line"
        aria-label={`Perbesar foto bukti: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="aspect-3/4 w-full object-cover"
        />
      </button>
      {caption && <figcaption className="text-xs text-ink-muted">{caption}</figcaption>}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-lg"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          <span className="absolute bottom-lg text-xs text-white/90">
            Klik di mana saja untuk menutup
          </span>
        </div>
      )}
    </figure>
  );
}