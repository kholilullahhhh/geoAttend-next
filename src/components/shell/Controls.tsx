'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

/**
 * Sign out.
 *
 * Confirmation, because the consequence is not obvious from the button: the
 * session is destroyed and any unsaved filter state is lost. The dialog also
 * names what happens, so the choice is informed rather than reflexive.
 *
 * Uses the browser client, then hard-navigates so every Server Component is
 * re-rendered without the (now destroyed) session cookie.
 */
export function SignOutButton() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Even if the network call fails, drop the local session so the UI cannot
      // stay in an authenticated-looking state.
    }
    // A full navigation is deliberate, not `router.push`: the session cookie is
    // gone, so every cached RSC payload must be discarded. A soft navigation
    // would keep rendering data fetched under the previous session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/login';
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<LogOut className="size-4" aria-hidden="true" />}
        onClick={() => setConfirming(true)}
        className="px-2.5"
      >
        <span className="hidden sm:inline">Keluar</span>
      </Button>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void signOut()}
        title="Keluar dari dashboard?"
        description="Sesi di perangkat ini akan diakhiri. Anda perlu masuk kembali untuk melihat data monitoring."
        confirmLabel="Keluar"
        cancelLabel="Batal"
        loading={busy}
        busyLabel="Mengakhiri sesi…"
        error={error}
      />
    </>
  );
}

/**
 * Observe the `dark` class on <html>.
 *
 * An inline script in the layout applies that class before paint, so the DOM is
 * the source of truth. Reading it through `useSyncExternalStore` avoids a
 * setState-in-effect cascade, and the server snapshot keeps hydration stable.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

/**
 * Colour scheme toggle.
 *
 * Persisted to `localStorage` and applied before paint, so there is no flash of
 * the wrong theme on reload. `aria-pressed` states the current mode, and the
 * button also carries a polite live region so the switch is announced instead
 * of being a purely visual change.
 */
export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains('dark'),
    // Server snapshot: assume light until the client reveals otherwise.
    () => false,
  );

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('geoattend-theme', next ? 'dark' : 'light');
    } catch {
      // Private-mode browsers may reject writes; the toggle still works for the session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
      title={dark ? 'Mode gelap' : 'Mode terang'}
      className="inline-flex size-9 coarse:size-10 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-alt hover:text-ink"
    >
      {dark ? <Sun className="size-4.5" aria-hidden="true" /> : <Moon className="size-4.5" aria-hidden="true" />}
      <span role="status" aria-live="polite" className="sr-only">
        {dark ? 'Mode gelap aktif' : 'Mode terang aktif'}
      </span>
    </button>
  );
}