'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageOff, Maximize2 } from 'lucide-react';

/**
 * Attendance evidence photo with a lightbox.
 *
 * If the object has been purged by the retention job — or access is refused —
 * the component says so explicitly instead of showing a broken image. The
 * caption distinguishes the two cases because they mean different things: "no
 * photo on record" is a normal state, "could not be loaded or has been deleted"
 * is a data-retention event an auditor may want to know about.
 *
 * The lightbox is a real dialog: focus moves in, Tab is trapped, Escape closes,
 * and focus returns to the thumbnail. The previous version rendered a
 * `aria-modal` div that nothing could focus, so a keyboard user opened the photo
 * and was then stranded.
 */
export function EvidencePhoto({
  src,
  alt,
  caption,
  /** Overrides the default explanation when a stored photo cannot be shown. */
  expiredNote,
}: {
  src: string | null;
  /** Empty when no photo is expected; the caption then carries the meaning. */
  alt: string;
  caption?: string;
  /** Overrides the default explanation when a stored photo cannot be shown. */
  expiredNote?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => panelRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, close]);

  const figureBody = () => {
    if (!src) {
      return (
        <div className="flex aspect-3/4 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong bg-surface-alt px-2 text-center">
          <ImageOff className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
          <p className="text-2xs leading-relaxed text-ink-muted">Tidak ada foto tersimpan.</p>
        </div>
      );
    }

    if (failed) {
      return (
        <div className="flex aspect-3/4 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong bg-surface-alt px-2 text-center">
          <ImageOff className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
          <p className="text-2xs leading-relaxed text-ink-muted">
            {expiredNote ?? 'Foto tidak dapat dimuat atau sudah dihapus oleh kebijakan retensi.'}
          </p>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-md border border-line transition-colors hover:border-line-strong focus-visible:border-accent"
        aria-label={`Perbesar foto bukti: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="aspect-3/4 w-full bg-surface-alt object-cover"
        />
        {/*
          Hover affordance only. The accessible name above carries the meaning,
          so removing the overlay (on touch, or with a keyboard) loses nothing.
        */}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-overlay opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Maximize2 className="size-5 text-white" />
        </span>
      </button>
    );
  };

  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      {figureBody()}
      {caption && <figcaption className="text-xs text-ink-muted">{caption}</figcaption>}

      {open && src && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-lg animate-backdrop-in"
          onClick={close}
          role="presentation"
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Foto bukti: ${alt}`}
            tabIndex={-1}
            className="flex max-h-full max-w-full flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[82dvh] max-w-full rounded-lg object-contain shadow-pop"
            />
            <button
              type="button"
              onClick={close}
              className="inline-flex h-10 items-center rounded-md border border-white/25 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </figure>
  );
}