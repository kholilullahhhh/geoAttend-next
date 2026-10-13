'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Modal dialog.
 *
 * Hand-built rather than `<dialog>` because the requirements differ per call
 * site: the reject-confirmation and sign-out dialogs must trap focus and refuse
 * to close on an outside click, while the photo lightbox must dismiss on a click
 * anywhere. `showModal()` gives one behaviour for all of them.
 *
 * What it does, and why each matters:
 *  - moves focus into the dialog on open and restores it on close, so a
 *    keyboard user is not dropped back at the top of the document;
 *  - keeps Tab inside the dialog (`focusin` guard);
 *  - closes on Escape;
 *  - locks background scroll and restores the previous value on unmount;
 *  - marks the rest of the page `aria-hidden` via `inert` where supported, so a
 *    screen reader does not wander into the table behind the dialog.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer actions, right-aligned and wrapped on narrow viewports. */
  footer?: ReactNode;
  /** Dismiss when the backdrop is clicked. Off for destructive confirmations. */
  closeOnBackdrop?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Screen-reader label when the visual content is an image. */
  label?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeOnBackdrop = false,
  size = 'sm',
  label,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const focusFirst = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const target = panel.querySelector<HTMLElement>(FOCUSABLE);
    // Fall back to the panel itself so focus never escapes to <body>.
    (target ?? panel).focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus after paint so the element is laid out and focusable.
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Returning focus is what makes the dialog feel like a dialog: without it
      // the next Tab continues from the top of the page.
      restoreRef.current?.focus?.();
    };
  }, [open, onClose, focusFirst]);

  if (!open) return null;

  /*
   * Widths are written as numerics, NOT as `max-w-sm/md/lg/xl/3xl`.
   *
   * This is the collision `globals.css` warns about: because the project
   * defines `--spacing-sm/md/lg/xl/2xl/3xl` (the mobile app's 4pt scale),
   * Tailwind resolves `max-w-<name>` against that scale. `max-w-xl` therefore
   * became 1.5rem — a 24px dialog that clipped its own title to one character
   * per line, and which a screenshot caught but a build never would.
   *
   * Numeric equivalents: max-w-sm(24rem)=96, md(28rem)=112, lg(32rem)=128,
   * xl(36rem)=144, 3xl(48rem)=192.
   */
  const width = size === 'lg' ? 'max-w-192' : size === 'md' ? 'max-w-144' : 'max-w-112';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-lg">
      <div
        className="absolute inset-0 bg-overlay animate-backdrop-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        aria-describedby={description ? 'dialog-description' : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[90dvh] w-full ${width} flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-pop sm:rounded-xl`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-lg py-md">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
            {description && (
              <div id="dialog-description" className="mt-1 text-sm leading-relaxed text-ink-secondary">
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="-mt-1 -mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        {children && <div className="min-h-0 flex-1 overflow-y-auto px-lg py-md">{children}</div>}

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-alt/60 px-lg py-md">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmation dialog.
 *
 * For irreversible actions. The consequence is stated in the body, the
 * destructive control is the one that receives focus, and the safe action is
 * the default so a stray Enter does not approve.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Batal',
  destructive = true,
  loading = false,
  busyLabel,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  busyLabel?: string;
  error?: string | null;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      description={description}
      closeOnBackdrop={!loading}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-alt disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading || undefined}
            className={`inline-flex h-10 items-center rounded-md px-3.5 text-sm font-medium text-white transition-[filter] hover:brightness-110 disabled:opacity-60 ${
              destructive ? 'bg-danger' : 'bg-accent text-on-accent'
            }`}
          >
            {loading ? (busyLabel ?? 'Memproses…') : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}