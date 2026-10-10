import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { brand } from '@/lib/brand';
import './globals.css';

/**
 * Theme bootstrap.
 *
 * Lives in the ROOT layout, not the dashboard layout: the login page also
 * offers a theme toggle, and without this script the stored preference is never
 * applied there, so the user's choice silently reverted on every refresh.
 *
 * Runs before paint, so there is no flash of the wrong theme.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('geoattend-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}`;

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: `${brand.name} · Dashboard HRD`,
    template: `%s · ${brand.name}`,
  },
  description: 'Monitoring absensi karyawan berbasis lokasi dan foto.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays available; the dashboard does not lock the viewport.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}