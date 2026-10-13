'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

/**
 * Toasts.
 *
 * Mutations used to report their outcome as inline text inside the row that
 * triggered them. Two problems: the message was off-screen by the time the
 * server replied on a long approvals table, and it disappeared as soon as the
 * row re-rendered. A toast is announced, transient, and always in the same
 * place.
 *
 * `role="status"` + `aria-live="polite"` means a screen reader announces the
 * result without interrupting; errors use `assertive` because they usually mean
 * nothing was saved.
 *
 * Deduplication: the same message twice in a row is ignored, so a double
 * submit cannot stack two identical toasts.
 */

export type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Optional single undo-style action, e.g. "Muat ulang". */
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  notify: (tone: ToastTone, message: string, action?: Toast['action']) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE = {
  success: {
    box: 'border-success/40 bg-surface',
    icon: CircleCheck,
    fg: 'text-success',
    label: 'Berhasil',
  },
  error: {
    box: 'border-danger/45 bg-surface',
    icon: CircleAlert,
    fg: 'text-danger',
    label: 'Gagal',
  },
  info: { box: 'border-line-strong bg-surface', icon: Info, fg: 'text-info', label: 'Info' },
} as const;

const AUTO_DISMISS_MS: Record<ToastTone, number> = {
  // Failures stay until dismissed: an operator who misses "gagal menyimpan"
  // would otherwise believe a change was persisted.
  success: 4000,
  info: 5000,
  error: 0,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback<ToastApi['notify']>(
    (tone, message, action) => {
      setToasts((list) => {
        if (list.some((t) => t.tone === tone && t.message === message)) return list;
        const id = nextId.current++;
        const ttl = AUTO_DISMISS_MS[tone];
        if (ttl > 0) {
          timers.current.set(
            id,
            setTimeout(() => dismiss(id), ttl),
          );
        }
        // Newest first, and bounded: a burst of failures must not cover the UI.
        return [{ id, tone, message, action }, ...list].slice(0, 4);
      });
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      notify,
      success: (m) => notify('success', m),
      error: (m) => notify('error', m),
      info: (m) => notify('info', m),
    }),
    [notify],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Read the toast API.
 *
 * Returns a no-op outside a provider so a component that reports mutations is
 * still usable in isolation (a story, a test) instead of throwing.
 */
export function useToast(): ToastApi {
  return (
    useContext(ToastContext) ?? {
      notify: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    }
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  /*
   * No `mounted` gate.
   *
   * The viewport renders nothing until there is a toast to show, and toasts can
   * only be created by user action. So there is never any server-rendered markup
   * here to mismatch, and a mount flag would only add a render pass.
   */
  if (toasts.length === 0) return null;

  return (
    <div
      // A landmark, so a screen-reader user can jump to the feedback region.
      role="region"
      aria-label="Notifikasi"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex flex-col items-center gap-2 p-md sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end"
    >
      {toasts.map((toast) => {
        const cfg = TONE[toast.tone];
        const Glyph = cfg.icon;
        return (
          <div
            key={toast.id}
            // `assertive` only for failures: a rejected save interrupts,
            // a successful one waits its turn.
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex w-full max-w-96 items-start gap-3 rounded-lg border px-md py-3 shadow-pop animate-backdrop-in ${cfg.box}`}
          >
            <Glyph className={`mt-0.5 size-4 shrink-0 ${cfg.fg}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <span className="sr-only">{cfg.label}: </span>
              <p className="text-sm leading-relaxed text-ink">{toast.message}</p>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    onDismiss(toast.id);
                  }}
                  className="mt-1.5 text-xs font-semibold text-accent-ink hover:underline"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label={`Tutup notifikasi: ${toast.message}`}
              className="-mt-1 -mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}