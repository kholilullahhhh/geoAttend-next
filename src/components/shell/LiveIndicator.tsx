'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, WifiOff } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { hasSupabaseEnv } from '@/lib/supabase/config';

type Conn = 'connecting' | 'live' | 'offline';

/**
 * Coalescing window for refreshes, in milliseconds.
 *
 * On a shift change-over, `attendance_records` receives a burst of INSERTs and
 * UPDATEs in the same second. Refreshing the RSC tree once per event meant
 * dozens of overlapping server round trips that could resolve out of order and
 * repaint the table with stale rows. One trailing refresh per window fixes both.
 */
const COALESCE_MS = 1200;

/** Backoff schedule for reconnection attempts, in milliseconds. */
const BACKOFF_MS = [1000, 4000, 10_000, 30_000] as const;

/**
 * Live attendance feed.
 *
 * Subscribes to Postgres changes on `attendance_records` and refreshes the
 * current route, so an HR manager sees check-ins appear without reloading.
 *
 * Three things the naive version got wrong, and what happens here instead:
 *
 *  1. **Flooding.** Every event triggered `router.refresh()`. Events are now
 *     coalesced into one trailing refresh per {@link COALESCE_MS}.
 *  2. **Silent death.** A socket that drops while the tab is backgrounded can
 *     stay down with no error, leaving a UI that claims to be live. `online`,
 *     `visibilitychange` and `focus` all force a reconnect, and the state is
 *     reported honestly rather than optimistically.
 *  3. **Unbounded retries.** Reconnection backs off to 30s instead of hammering
 *     the server, and the channel is always removed before a replacement is
 *     opened so subscriptions cannot leak.
 *
 * Duplicate events are harmless by construction: a refresh is idempotent, and
 * the coalescer drops anything that arrives inside the window.
 */
export function LiveIndicator({
  table = 'attendance_records',
  label = 'Data langsung',
}: {
  table?: string;
  label?: string;
}) {
  const router = useRouter();

  /**
   * Without Supabase configured there is nothing to subscribe to, so the
   * initial state is derived rather than corrected by an effect. Deriving it
   * during render also keeps the first paint honest instead of flashing
   * "connecting" on a page that can never connect.
   */
  const [conn, setConn] = useState<Conn>(() =>
    hasSupabaseEnv() ? 'connecting' : 'offline',
  );

  // Kept in refs so the effect never re-subscribes because a timer fired.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposed = useRef(false);

  useEffect(() => {
    disposed.current = false;
    if (!hasSupabaseEnv()) return;

    const supabase = createClient();
    let attempt = 0;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const clearTimer = () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };

    /** One refresh per window, always the last event in the burst. */
    const scheduleRefresh = () => {
      if (disposed.current) return;
      if (refreshTimer.current) return;
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        if (disposed.current) return;
        router.refresh();
      }, COALESCE_MS);
    };

    const close = () => {
      if (channel) {
        const dead = channel;
        channel = null;
        void supabase.removeChannel(dead).catch(() => {
          // Removing an already-dead channel rejects; nothing to recover.
        });
      }
    };

    const subscribe = () => {
      close();
      channel = supabase
        .channel(`live:${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          scheduleRefresh,
        )
        .subscribe((status) => {
          if (disposed.current) return;
          if (status === 'SUBSCRIBED') {
            attempt = 0;
            setConn('live');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setConn('offline');
            retry();
          }
        });
    };

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const retry = () => {
      if (disposed.current || retryTimer) return;
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!;
      attempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (disposed.current) return;
        setConn('connecting');
        subscribe();
      }, delay);
    };

    /**
     * The tab was hidden or the machine slept; a websocket that died there can
     * stay dead without ever surfacing an error, so connectivity is re-checked
     * on the way back rather than trusted.
     */
    const revive = () => {
      if (disposed.current) return;
      if (document.visibilityState === 'hidden') return;
      setConn('connecting');
      attempt = 0;
      subscribe();
    };

    subscribe();

    window.addEventListener('online', revive);
    window.addEventListener('focus', revive);
    document.addEventListener('visibilitychange', revive);

    return () => {
      disposed.current = true;
      window.removeEventListener('online', revive);
      window.removeEventListener('focus', revive);
      document.removeEventListener('visibilitychange', revive);
      clearTimer();
      if (retryTimer) clearTimeout(retryTimer);
      close();
    };
  }, [router, table]);

  if (conn === 'live') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-2.5 py-1 text-xs font-semibold text-success"
        title="Pembaruan otomatis aktif."
      >
        <Radio className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{label}: </span>
        Langsung
      </span>
    );
  }

  const connecting = conn === 'connecting';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-pill bg-surface-alt px-2.5 py-1 text-xs font-semibold text-ink-secondary"
      title={
        connecting
          ? 'Menghubungkan ke aliran data langsung.'
          : 'Pembaruan otomatis terputus. Data di bawah mungkin tidak terbaru.'
      }
    >
      <WifiOff className="size-3.5" aria-hidden="true" />
      {/* Announced, because "Terputus" is the difference between trusting and
          not trusting every number on this page. */}
      <span role="status" aria-live="polite">
        {connecting ? 'Menghubungkan…' : 'Terputus'}
      </span>
    </span>
  );
}