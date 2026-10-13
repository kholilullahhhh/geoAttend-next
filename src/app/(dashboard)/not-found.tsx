import Link from 'next/link';

/**
 * Not found.
 *
 * Deliberately says nothing about *why*. A record that does not exist and a
 * record the caller may not read must be indistinguishable, otherwise the 404
 * page becomes an oracle that confirms which attendance ids exist.
 */
export default function DashboardNotFound() {
  return (
    <div className="mx-auto flex max-w-128 flex-col items-start gap-4 rounded-lg border border-line bg-surface p-xl">
      <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
        404 · Tidak ditemukan
      </p>
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">
          Halaman atau catatan ini tidak tersedia
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
          Alamat yang Anda buka tidak cocok dengan data yang ada, atau catatan tersebut tidak
          tersedia untuk akun Anda. Kembali ke ringkasan untuk melanjutkan monitoring.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-ink no-underline transition-colors hover:bg-surface-alt"
      >
        Kembali ke ringkasan
      </Link>
    </div>
  );
}