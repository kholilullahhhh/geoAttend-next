import { Card } from '@/components/ui/Card';
import {
  LoadingStatus,
  PageHeader,
  SkeletonCards,
  SkeletonRows,
} from '@/components/ui/States';

/**
 * Route loading skeleton.
 *
 * This is a separate `loading.tsx` rather than an exported `Loading` from
 * `page.tsx` — the App Router only honours the file convention, so the export
 * on the overview page was dead code that never ran.
 *
 * The shapes mirror the real layout (hero block, metric row, table) so nothing
 * jumps when the data lands, and `LoadingStatus` carries the single screen-reader
 * announcement instead of six silent placeholder divs.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-xl">
      <LoadingStatus label="Memuat ringkasan" />

      <PageHeader title="Memuat halaman…" />

      <div className="grid grid-cols-1 gap-lg xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <div className="flex flex-col gap-4" aria-hidden="true">
              <div className="h-3 w-32 animate-pulse rounded-sm bg-surface-sunken motion-reduce:animate-none" />
              <div className="h-10 w-56 animate-pulse rounded-sm bg-surface-sunken motion-reduce:animate-none" />
              <div className="h-2 w-full animate-pulse rounded-pill bg-surface-sunken motion-reduce:animate-none" />
              <div className="h-16 w-full animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
            </div>
          </Card>
        </div>
        <Card>
          <div className="flex flex-col gap-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 w-full animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none"
              />
            ))}
          </div>
        </Card>
      </div>

      <SkeletonCards count={6} className="h-20" />

      <Card padded={false}>
        <SkeletonRows rows={8} />
      </Card>
    </div>
  );
}