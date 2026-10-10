import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/shell/AppShell';
import { brand } from '@/lib/brand';
import { DataError, getViewer, requireHrAdmin } from '@/lib/data';
import { hasSupabaseEnv } from '@/lib/supabase/config';

/**
 * Dashboard shell + authorization gate.
 *
 * The theme bootstrap script is NOT rendered here: it lives in the root layout
 * so it also covers /login, which offers a theme toggle of its own. Rendering
 * it in both places would execute it twice.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseEnv()) return <SetupNotice />;

  const viewer = await getViewer();
  if (!viewer) redirect('/login');

  try {
    await requireHrAdmin();
  } catch (error) {
    // An authenticated EMPLOYEE must not see monitoring data at all.
    if (error instanceof DataError && error.code === 'FORBIDDEN') return <AccessDenied />;
    throw error;
  }

  return <AppShell viewer={viewer}>{children}</AppShell>;
}

function SetupNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-lg">
      <div className="w-full max-w-128 rounded-lg border border-line bg-surface p-xl">
        <h1 className="text-lg font-semibold text-ink">{brand.name} belum dikonfigurasi</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Dashboard membutuhkan dua variabel lingkungan berikut. Salin{' '}
          <code className="rounded-sm bg-surface-alt px-1 py-0.5 text-xs">.env.example</code>{' '}
          menjadi <code className="rounded-sm bg-surface-alt px-1 py-0.5 text-xs">.env.local</code>{' '}
          lalu isi nilainya, kemudian jalankan ulang dev server.
        </p>
        <ul className="mt-md flex flex-col gap-1.5 text-sm text-ink-secondary">
          <li>
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code>
          </li>
          <li>
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          </li>
        </ul>
        <p className="mt-md text-xs text-ink-muted">
          Kunci service-role tidak pernah dipakai oleh aplikasi ini. Seluruh akses melewati RLS
          dengan sesi pengguna.
        </p>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-lg">
      <div className="w-full max-w-112 rounded-lg border border-line bg-surface p-xl text-center">
        <h1 className="text-lg font-semibold text-ink">Akses dibatasi</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Dashboard monitoring hanya tersedia untuk akun HRD dan Administrator. Hubungi
          administrator bila Anda merasa ini keliru.
        </p>
        <Link
          href="/"
          className="mt-lg inline-flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-medium text-ink hover:bg-surface-alt"
        >
          Kembali
        </Link>
      </div>
    </div>
  );
}