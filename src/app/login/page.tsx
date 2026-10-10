'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Radio,
  ShieldCheck,
} from 'lucide-react';

import { ThemeToggle } from '@/components/shell/Controls';
import { Button } from '@/components/ui/Button';
import { brand } from '@/lib/brand';
import { createClient } from '@/lib/supabase/client';
import { hasSupabaseEnv } from '@/lib/supabase/config';

/** Only allow same-origin relative paths as a post-login redirect target. */
function safeNext(raw: string | null): string {
  if (!raw) return '/';
  // Reject absolute URLs and protocol-relative paths (open-redirect guard).
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

/**
 * The product, in three lines.
 *
 * Shown on wide screens only. A login screen that states what the product does
 * and what protects the data is more useful to an HR manager than a bare form,
 * and it removes the "is this the right site?" hesitation.
 */
const HIGHLIGHTS = [
  {
    icon: MapPin,
    title: 'Absensi berbasis lokasi',
    body: 'Check-in divalidasi di dalam geofence kantor, bukan sekadar dicatat.',
  },
  {
    icon: Radio,
    title: 'Pemantau langsung',
    body: 'Data kehadiran diperbarui otomatis tanpa perlu memuat ulang halaman.',
  },
  {
    icon: ShieldCheck,
    title: 'Terisolasi per pengguna',
    body: 'Setiap karyawan hanya dapat melihat absensi miliknya sendiri.',
  },
] as const;

/** Field wrapper: icon + label + input + inline validation slot. */
function Field({
  id,
  label,
  icon: Icon,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  endAdornment,
}: {
  id: string;
  label: string;
  icon: typeof Mail;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder: string;
  required?: boolean;
  endAdornment?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-ink-secondary">
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          id={id}
          type={type}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-11 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none ${
            endAdornment ? 'pr-10' : ''
          }`}
        />
        {endAdornment}
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const target = safeNext(params.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'signin' | 'reset'>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = createClient();

      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (resetError) throw resetError;
        // Deliberately identical message whether or not the account exists, so the
        // form cannot be used to enumerate registered email addresses.
        setNotice(
          'Jika email tersebut terdaftar, kami telah mengirim tautan untuk mengatur ulang kata sandi.',
        );
        setMode('signin');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      router.replace(target);
      router.refresh();
    } catch (err) {
      // Supabase reports credential failures in English; translate the two the
      // user can actually act on, and fall back to a generic Indonesian message.
      const raw = err instanceof Error ? err.message : '';
      if (/invalid login credentials/i.test(raw)) {
        setError('Email atau kata sandi salah. Silakan coba lagi.');
      } else if (/email not confirmed/i.test(raw)) {
        setError('Email belum diverifikasi. Periksa kotak masuk Anda.');
      } else if (/rate limit|too many/i.test(raw)) {
        setError('Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.');
      } else {
        setError(raw || 'Gagal masuk. Periksa koneksi Anda lalu coba lagi.');
      }
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: 'signin' | 'reset') {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  if (!hasSupabaseEnv()) {
    return (
      <div className="w-full max-w-112 rounded-lg border border-line bg-surface p-xl">
        <h1 className="text-base font-semibold text-ink">Konfigurasi belum lengkap</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Dashboard membutuhkan dua variabel berikut. Salin{' '}
          <code className="rounded-sm bg-surface-alt px-1 py-0.5 text-xs">.env.example</code> menjadi{' '}
          <code className="rounded-sm bg-surface-alt px-1 py-0.5 text-xs">.env.local</code>, isi
          nilainya, lalu jalankan ulang dev server.
        </p>
        <ul className="mt-md flex flex-col gap-1 text-sm text-ink-secondary">
          <li className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</li>
          <li className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------------------------------------------------------
          Brand panel — desktop only. On small screens it collapses to the
          compact header above the form, so the form is never pushed down.
          Fixed dark surface in both colour schemes: it is the one place the
          product states its own identity, and it should not flip with the OS.
         --------------------------------------------------------------- */}
      <aside className="relative hidden overflow-hidden bg-[#0B1220] px-12 py-14 lg:flex lg:flex-col">
        {/* A single restrained accent wash, not a decorative gradient field. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-24 size-[26rem] rounded-full opacity-[0.16] blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-md bg-accent text-on-accent">
            <MapPin className="size-5" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight text-white">
            {brand.name}
          </span>
        </div>

        {/* One vertically centred block, so the headline and the highlight list
            read as a single group instead of being stranded apart by
            justify-between. */}
        <div className="relative flex flex-1 flex-col justify-center">
          <h2 className="max-w-96 text-3xl leading-tight font-semibold tracking-tight text-white">
            Kehadiran karyawan, terverifikasi dan bisa diaudit.
          </h2>
          <p className="mt-3 max-w-96 text-sm leading-relaxed text-slate-400">
            {brand.tagline}. Setiap check-in dicatat dengan koordinat, akurasi GPS,
            dan foto bukti di dalam area kantor yang Anda tentukan.
          </p>

          <ul className="mt-12 flex flex-col gap-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-white/8 text-slate-200">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-400">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* slate-400 rather than slate-500: the latter measures about 4.2:1 on
            this background, which is below the 4.5:1 body-text threshold. */}
        <p className="relative text-xs text-slate-400">
          Akses diberikan berdasarkan peran. Semua keputusan persetujuan tercatat di audit log.
        </p>
      </aside>

      {/* ---------------------------------------------------------------
          Form panel
         --------------------------------------------------------------- */}
      <main className="flex flex-col bg-bg">
        <header className="flex items-center justify-between px-lg py-md">
          {/* Compact brand lockup, shown only where the aside is hidden. */}
          <div className="flex items-center gap-2 lg:invisible">
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-accent text-on-accent">
              <MapPin className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink">{brand.name}</span>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center justify-center px-lg pb-xl">
          <div className="w-full max-w-96">
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="mb-lg inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-secondary hover:text-ink"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Kembali ke masuk
              </button>
            )}

            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {mode === 'signin' ? 'Masuk ke dashboard' : 'Atur ulang kata sandi'}
            </h1>
            <p className="mt-1.5 text-sm text-ink-secondary">
              {mode === 'signin'
                ? 'Gunakan akun HRD atau Administrator Anda.'
                : 'Kami akan mengirimkan tautan pengaturan ulang ke email Anda.'}
            </p>

            <form onSubmit={onSubmit} className="mt-lg flex flex-col gap-md" noValidate={false}>
              <Field
                id="email"
                label="Email"
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                placeholder="nama@kantor.co"
                required
              />

              {mode === 'signin' && (
                <Field
                  id="password"
                  label="Kata sandi"
                  icon={Lock}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      aria-pressed={showPassword}
                      className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-surface-alt hover:text-ink"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  }
                />
              )}

              {/* Messages are announced to assistive tech and never rely on colour alone. */}
              {error && (
                <div
                  role="alert"
                  className="flex gap-2 rounded-md border border-danger/30 bg-danger-soft px-md py-2.5"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}
              {notice && (
                <div
                  role="status"
                  className="flex gap-2 rounded-md border border-success/30 bg-success-soft px-md py-2.5"
                >
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-success">{notice}</p>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                loading={busy}
                className="mt-1 h-11 w-full text-[0.9375rem]"
              >
                {mode === 'signin' ? 'Masuk' : 'Kirim tautan reset'}
              </Button>
            </form>

            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="mt-md w-full rounded-md py-1 text-sm font-medium text-accent-ink hover:underline"
              >
                Lupa kata sandi?
              </button>
            )}

            <div className="mt-xl border-t border-line pt-lg">
              <p className="text-sm text-ink-secondary">
                Karyawan memakai aplikasi mobile untuk absensi. Dashboard ini khusus untuk
                HRD dan Administrator.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <LoginForm />
    </Suspense>
  );
}
