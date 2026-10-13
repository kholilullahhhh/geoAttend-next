'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, TriangleAlert } from 'lucide-react';

/**
 * Route-level error boundary.
 *
 * `reset()` re-runs the Server Component render, which is the only way to
 * recover from a failed query: these pages are `force-dynamic`, so there is no
 * cached page to fall back to and no stale data to show.
 *
 * The technical detail is deliberately withheld. A Supabase error string can
 * contain table names and policy fragments, which is not something to put on
 * an HR screen; it goes to the console for whoever is debugging.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[geoattend] render error', error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-4 rounded-lg border border-danger/30 bg-danger-soft/50 p-xl"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden="true" />
        <div>
          <h1 className="text-base font-semibold tracking-tight text-danger">
            Halaman ini gagal dimuat
          </h1>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-secondary">
            Data untuk halaman ini tidak dapat diambil dari server. Ini sering bersifat sementara —
            jaringan, atau sesi yang sudah berakhir.
          </p>
          {error.digest && (
            <p className="mt-1.5 font-mono text-2xs text-ink-muted">
              Kode kesalahan: {error.digest}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent transition-[filter] hover:brightness-110"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Coba lagi
        </button>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-ink no-underline transition-colors hover:bg-surface-alt"
        >
          Kembali ke ringkasan
        </Link>
      </div>
    </div>
  );
}