'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, WifiOff } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { hasSupabaseEnv } from '@/lib/supabase/config';

type Conn = 'connecting' | 'live' | 'offline';

/**
 * Live attendance feed.
 *
 * Subscribes to Postgres changes on `attendance_records` and refreshes the
 * current route, so an HR manager sees check-ins appear without reloading.
 *
 * Reconnect handling: Supabase's client reconnects on its own, but a socket that
 * dies while the tab is backgrounded can stay down silently. This also listens
 * for the browser coming back online and re-subscribes, and reflects the true
 * connection state in the UI rather than pretending to be live.
 */
export function LiveIndicator({ table = 'attendance_records' }: { table?: string }) {
  const router = useRouter();
  const [conn, setConn] = useState<Conn>('connecting');

  useEffect(() => {
    if (!hasSupabaseEnv()) return;

    let active = true;
    const supabase = createClient();

    const channel = supabase
      .channel(`live:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          if (active) router.refresh();
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') setConn('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConn('offline');
        }
      });

    // The browser tab was backgrounded and the socket did not survive it.
    const onOnline = () => {
      setConn('connecting');
      void supabase.removeChannel(channel).then(() => {
        if (!active) return;
        const next = supabase
          .channel(`live:${table}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            () => {
              if (active) router.refresh();
            },
          )
          .subscribe((status) => {
            if (!active) return;
            setConn(status === 'SUBSCRIBED' ? 'live' : 'offline');
          });
        // Keep a reference so the cleanup below closes whichever is live.
        currentRef.current = next;
      });
    };

    const currentRef = { current: channel };
    window.addEventListener('online', onOnline);

    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      void supabase.removeChannel(currentRef.current);
    };
  }, [router, table]);

  if (conn === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-success-soft px-2 py-1 text-xs font-medium text-success">
        <Radio className="size-3.5" aria-hidden="true" />
        Langsung
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm bg-surface-alt px-2 py-1 text-xs font-medium text-ink-secondary"
      title="Pembaruan otomatis terputus. Muat ulang halaman untuk mencoba lagi."
    >
      <WifiOff className="size-3.5" aria-hidden="true" />
      {conn === 'connecting' ? 'Menghubungkan…' : 'Terputus'}
    </span>
  );
}
