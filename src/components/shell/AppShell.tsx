'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  CalendarCheck,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  FileBarChart,
  Menu,
  X,
  MapPin,
} from 'lucide-react';

import { SignOutButton, ThemeToggle } from './Controls';
import { brand } from '@/lib/brand';
import type { Viewer } from '@/lib/data';

const NAV = [
  { href: '/', label: 'Ringkasan', icon: LayoutDashboard, adminOnly: false },
  { href: '/attendance', label: 'Absensi', icon: CalendarCheck, adminOnly: false },
  { href: '/approvals', label: 'Persetujuan', icon: ShieldCheck, adminOnly: false },
  { href: '/reports', label: 'Laporan', icon: FileBarChart, adminOnly: false },
  { href: '/employees', label: 'Karyawan', icon: Users, adminOnly: false },
  { href: '/settings', label: 'Pengaturan', icon: Settings, adminOnly: true },
] as const;

/**
 * Dashboard shell.
 *
 * Desktop: a fixed 240px sidebar. Tablet/mobile: the sidebar becomes an
 * overlay drawer so the data table keeps the full viewport width. The active
 * route is marked with `aria-current`, not colour alone.
 */
export function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const pathname = usePathname();
  /*
   * The drawer is keyed by the route it was opened on rather than a boolean.
   * Navigating therefore closes it as a consequence of state, with no effect
   * needed just to mirror `pathname` into state.
   */
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  const closeDrawer = useCallback(() => setOpenFor(null), []);

  // Lock body scroll while the drawer overlays the page.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const items = NAV.filter((n) => !n.adminOnly || viewer.role === 'ADMIN');

  return (
    <div className="min-h-dvh bg-bg">
      {/* Top bar (mobile + tablet) */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface px-md lg:hidden">
        <button
          type="button"
          onClick={() => setOpenFor(pathname)}
          aria-label="Buka menu navigasi"
          aria-expanded={open}
          className="inline-flex size-10 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-alt"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <Brand />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-14 items-center border-b border-line px-lg">
          <Brand />
        </div>
        <nav className="flex-1 overflow-y-auto p-md" aria-label="Navigasi utama">
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={isActive(pathname, item.href)} />
              </li>
            ))}
          </ul>
        </nav>
        <ViewerCard viewer={viewer} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-overlay"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface"
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi"
          >
            <div className="flex h-14 items-center justify-between border-b border-line px-lg">
              <Brand />
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Tutup menu"
                className="inline-flex size-9 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-alt"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-md" aria-label="Navigasi utama">
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} active={isActive(pathname, item.href)} />
                  </li>
                ))}
              </ul>
            </nav>
            <ViewerCard viewer={viewer} />
          </div>
        </div>
      )}

      {/* Main region */}
      <div className="lg:pl-60">
        <div className="hidden h-14 items-center justify-end gap-1 border-b border-line bg-surface px-lg lg:flex">
          <ThemeToggle />
          <SignOutButton />
        </div>
        <main className="mx-auto w-full max-w-7xl px-md py-lg sm:px-lg sm:py-xl">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md">
      <span className="inline-flex size-8 items-center justify-center rounded-md bg-accent text-on-accent">
        <MapPin className="size-4.5" aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-ink">{brand.name}</span>
    </Link>
  );
}

function NavLink({
  item,
  active,
}: {
  item: { href: string; label: string; icon: typeof LayoutDashboard };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-md rounded-md px-md py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-accent-soft text-accent-ink'
          : 'text-ink-secondary hover:bg-surface-alt hover:text-ink'
      }`}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function ViewerCard({ viewer }: { viewer: Viewer }) {
  const initials = viewer.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="border-t border-line p-md">
      <div className="flex items-center gap-md">
        <span
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-alt text-xs font-semibold text-ink-secondary"
          aria-hidden="true"
        >
          {initials || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{viewer.fullName}</p>
          <p className="truncate text-xs text-ink-muted">{viewer.email}</p>
        </div>
      </div>
      <span className="mt-md inline-flex rounded-sm bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink">
        {viewer.role === 'ADMIN' ? 'Administrator' : 'HRD'}
      </span>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}