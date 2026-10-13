'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  CalendarCheck,
  ChevronLeft,
  FileBarChart,
  LayoutDashboard,
  MapPin,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';

import { SignOutButton, ThemeToggle } from './Controls';
import { Avatar } from './Avatar';
import { brand } from '@/lib/brand';
import { ROLE_LABEL } from '@/lib/status';
import type { Viewer } from '@/lib/data';

// ---------------------------------------------------------------------------
// Navigation model
// ---------------------------------------------------------------------------

type Icon = typeof LayoutDashboard;

interface NavItem {
  href: string;
  label: string;
  /** Screen-reader disambiguator, e.g. "Reports". */
  icon: Icon;
  /** Number of items awaiting a decision, from the server. */
  badge?: number;
  adminOnly?: boolean;
}

interface NavGroup {
  /** Small-caps heading. `null` renders the group without a label. */
  heading: string;
  items: NavItem[];
}

function buildNav(pending: number): NavGroup[] {
  return [
    {
      heading: 'Pemantauan',
      items: [
        { href: '/', label: 'Ringkasan', icon: LayoutDashboard },
        { href: '/attendance', label: 'Absensi', icon: CalendarCheck },
        { href: '/reports', label: 'Laporan', icon: FileBarChart },
      ],
    },
    {
      heading: 'Tindakan',
      items: [
        { href: '/approvals', label: 'Persetujuan', icon: ShieldCheck, badge: pending },
      ],
    },
    {
      heading: 'Administrasi',
      items: [
        { href: '/employees', label: 'Karyawan', icon: Users },
        { href: '/settings', label: 'Pengaturan', icon: Settings, adminOnly: true },
      ],
    },
  ];
}

/**
 * Role-based filtering is a *usability* measure only.
 *
 * The server re-derives the caller's role on every request (`requireHrAdmin`,
 * `PATCH /api/employees`) and the database enforces it, so hiding a link is not
 * a security control. It is here so an HR account does not navigate to a page
 * that will refuse it.
 */
function visibleGroups(groups: NavGroup[], viewer: Viewer): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((i) => !i.adminOnly || viewer.role === 'ADMIN'),
    }))
    .filter((group) => group.items.length > 0);
}

/** Title shown in the topbar for the active route. */
function routeTitle(pathname: string): string {
  if (pathname === '/') return 'Ringkasan';
  if (pathname.startsWith('/attendance/')) return 'Detail absensi';
  const known = [
    '/attendance',
    '/approvals',
    '/reports',
    '/employees',
    '/settings',
  ];
  const match = known.find((href) => pathname === href || pathname.startsWith(`${href}/`));
  if (!match) return 'Dashboard';
  return buildNav(0)
    .flatMap((g) => g.items)
    .find((i) => i.href === match)?.label ?? 'Dashboard';
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function AppShell({
  viewer,
  pendingCount,
  children,
}: {
  viewer: Viewer;
  pendingCount: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const mainId = useId();

  /*
   * The drawer is keyed by the route it was opened on rather than a boolean:
   * navigating therefore closes it as a consequence of state, with no effect
   * needed just to mirror `pathname` into state.
   */
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  /*
   * Sidebar collapse.
   *
   * Deliberately not persisted. The rail is a preference about *this* screen;
   * storing it would mean reading it back before paint to avoid a flash, and
   * that layout cost is paid on every navigation for a benefit invisible to
   * everyone who never touches the button.
   */
  const [collapsed, setCollapsed] = useState(false);

  const groups = visibleGroups(buildNav(pendingCount), viewer);

  return (
    <div className="min-h-dvh bg-bg">
      {/*
        Skip link. The sidebar plus the topbar put the page heading below two
        landmarks on every route, so a keyboard user otherwise has to tab
        through the whole navigation to reach the content.
      */}
      <a
        href={`#${mainId}`}
        className="sr-only left-md top-md z-70 rounded-md border border-line-strong bg-surface px-md py-2 text-sm font-medium text-ink no-underline shadow-pop focus:not-sr-only focus:fixed"
      >
        Lompat ke konten utama
      </a>

      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-line bg-topbar px-md backdrop-blur-sm lg:hidden">
        <button
          type="button"
          onClick={() => setOpenFor(pathname)}
          aria-label="Buka menu navigasi"
          aria-expanded={open}
          aria-controls="app-nav-drawer"
          className="inline-flex size-10 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-alt hover:text-ink"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <span className="truncate text-sm font-semibold tracking-tight text-ink">
          {routeTitle(pathname)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-sidebar transition-[width] duration-240 lg:flex ${
          collapsed ? 'w-17' : 'w-62'
        }`}
      >
        <div
          className={`flex h-14 shrink-0 items-center border-b border-line ${
            collapsed ? 'justify-center px-2' : 'justify-between px-lg'
          }`}
        >
          <Brand collapsed={collapsed} />
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Perlebar sidebar' : 'Perkecil sidebar'}
            aria-pressed={collapsed}
            className="hidden size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink xl:inline-flex"
          >
            <ChevronLeft
              className={`size-4 transition-transform duration-240 ${
                collapsed ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-md" aria-label="Navigasi utama">
          <NavList groups={groups} pathname={pathname} collapsed={collapsed} />
        </nav>

        <div className={`border-t border-line ${collapsed ? 'p-md' : 'p-md'}`}>
          <ViewerCard viewer={viewer} collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <Drawer
          id="app-nav-drawer"
          groups={groups}
          pathname={pathname}
          viewer={viewer}
          onClose={() => setOpenFor(null)}
        />
      )}

      {/* Main region */}
      <div className={collapsed ? 'lg:pl-17' : 'lg:pl-62'}>
        <div className="sticky top-0 z-20 hidden h-14 items-center gap-3 border-b border-line bg-topbar px-lg backdrop-blur-sm lg:flex">
          <h2 className="truncate text-sm font-semibold tracking-tight text-ink">
            {routeTitle(pathname)}
          </h2>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>

        {/*
          `max-w-[1600px]` rather than `max-w-7xl`: a monitoring table needs the
          extra width, and the sidebar already bounds how wide the content
          column can get on a large display.
        */}
        <main id={mainId} className="mx-auto w-full max-w-400 px-md py-lg sm:px-lg sm:py-xl">
          {children}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

function Drawer({
  id,
  groups,
  pathname,
  viewer,
  onClose,
}: {
  id: string;
  groups: NavGroup[];
  pathname: string;
  viewer: Viewer;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Move focus in, restore it on close, and trap Tab inside the panel.
  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-overlay animate-backdrop-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-78 max-w-[85vw] flex-col border-r border-line bg-sidebar shadow-pop"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-lg">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            className="inline-flex size-9 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-alt hover:text-ink"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-md" aria-label="Navigasi utama">
          <NavList groups={groups} pathname={pathname} collapsed={false} onNavigate={onClose} />
        </nav>
        <div className="border-t border-line p-md">
          <ViewerCard viewer={viewer} collapsed={false} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav rendering
// ---------------------------------------------------------------------------

function NavList({
  groups,
  pathname,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.heading}>
          {/*
            `aria-hidden` because the heading is decorative grouping: each link
            already names itself, and announcing six more short strings on every
            page load adds noise rather than structure.
          */}
          <p
            aria-hidden="true"
            className={`px-md pb-1.5 text-2xs font-semibold tracking-wide text-ink-muted uppercase ${
              collapsed ? 'lg:sr-only' : ''
            }`}
          >
            {group.heading}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isActive(pathname, item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const badge = item.badge ?? 0;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center rounded-md text-sm font-medium transition-colors ${
        collapsed ? 'h-10 justify-center px-0' : 'gap-md px-md py-2.5'
      } ${
        active
          ? 'bg-accent-soft text-accent-ink'
          : 'text-ink-secondary hover:bg-surface-alt hover:text-ink'
      }`}
    >
      {/*
        A 3px rule plus the tinted background. The rule matters in the collapsed
        rail, where the background is the only difference between two 40px
        squares of similar colour.
      */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-pill bg-accent-bright"
        />
      )}
      <Icon className="size-4.5 shrink-0" aria-hidden="true" />
      {(!collapsed || badge > 0) && (
        <span className={collapsed ? 'sr-only lg:not-sr-only' : ''}>{item.label}</span>
      )}
      {badge > 0 && (
        <span
          className={`tabular ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-warning-soft px-1.5 text-2xs font-bold text-warning ${
            collapsed ? 'absolute top-1 right-1 h-4 min-w-4 px-1' : ''
          }`}
        >
          {badge > 99 ? '99+' : badge}
          <span className="sr-only"> menunggu keputusan</span>
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/"
      className="flex min-w-0 items-center gap-2.5 rounded-md py-1 no-underline"
      aria-label={`${brand.name} â€” ringkasan`}
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent">
        <MapPin className="size-4.5" aria-hidden="true" />
      </span>
      <span
        className={`min-w-0 truncate text-sm font-semibold tracking-tight text-ink ${
          collapsed ? 'lg:sr-only' : ''
        }`}
      >
        {brand.name}
      </span>
    </Link>
  );
}

function ViewerCard({ viewer, collapsed }: { viewer: Viewer; collapsed: boolean }) {
  return (
    <div className={`flex items-center gap-md ${collapsed ? 'justify-center' : ''}`}>
      <Avatar name={viewer.fullName} size="md" />
      {/*
        Identity plus role only. No permissions, employee id or department: the
        topbar repeats what the person already knows about themselves, and
        anything else would be data the shell has no use for.
      */}
      <div className={`min-w-0 flex-1 ${collapsed ? 'lg:sr-only' : ''}`}>
        <p className="truncate text-sm font-medium text-ink">{viewer.fullName}</p>
        <p className="truncate text-xs text-ink-muted">
          {ROLE_LABEL[viewer.role] ?? viewer.role}
        </p>
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}