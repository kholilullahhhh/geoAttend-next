'use client';

import { useState, useSyncExternalStore } from 'react';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

/**
 * Sign out.
 *
 * Uses the browser client, then hard-navigates so every Server Component is
 * re-rendered without the (now destroyed) session cookie.
 */
export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
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
  }

  return (
    <Button variant="ghost" size="sm" loading={busy} onClick={signOut}>
      Keluar
    </Button>
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
 * the wrong theme on reload.
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
      aria-label={dark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
      className="inline-flex size-9 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-alt"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
