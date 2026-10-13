import Link from 'next/link';
import { Download, TrendingUp } from 'lucide-react';

import { AttendanceTrend, ChartLegend, WorkedHoursTrend } from '@/components/charts/Charts';
import { FilterBar } from '@/components/filters/FilterBar';
import { FilterChips } from '@/components/filters/FilterChips';
import { Card } from '@/components/ui/Card';
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  InlineNotice,
  PageHeader,
} from '@/components/ui/States';
import { Metric, MetricGrid } from '@/components/ui/StatCard';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { tableMinWidth } from '@/lib/design';
import { FALLBACK_TIMEZONE } from '@/lib/brand';
import { DataError, fetchDepartments, fetchOffices, fetchRecap } from '@/lib/data';
import { exportCsvHref } from '@/lib/csv';
import { formatDate, formatDuration, isoDaysAgo } from '@/lib/format';

export const metadata = { title: 'Laporan' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

/** Preset ranges keep the common cases one click away without a date picker. */
const PRESETS = [
  { key: 'week', label: '7 hari', days: 6 },
  { key: 'month', label: '30 hari', days: 29 },
  { key: 'quarter', label: '90 hari', days: 89 },
] as const;

/** Matches the cap in `GET /api/export/attendance`. */
const EXPORT_MAX_DAYS = 400;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const to = first(params.to) ?? isoDaysAgo(0, FALLBACK_TIMEZONE);
  const from = first(params.from) ?? isoDaysAgo(29, FALLBACK_TIMEZONE);
  const departmentId = first(params.dept);
  const officeId = first(params.office);

  const [departments, offices] = await Promise.all([fetchDepartments(), fetchOffices()]);

  let recap;
  try {
    recap = await fetchRecap({ from, to, departmentId, officeId });
  } catch (error) {
    return (
      <ErrorState
        message={error instanceof DataError ? error.message : 'Terjadi kesalahan tak terduga.'}
      />
    );
  }

  const daily = recap.daily ?? [];
  const hasData = recap.totals.records > 0;
  const tz = FALLBACK_TIMEZONE;

  const rangeDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  const exportTooWide = Number.isFinite(rangeDays) && rangeDays > EXPORT_MAX_DAYS;

  const rangeParam = (fromDate: string, toDate: string) => {
    const q = new URLSearchParams({ from: fromDate, to: toDate });
    if (departmentId) q.set('dept', departmentId);
    if (officeId) q.set('office', officeId);
    return `?${q.toString()}`;
  };

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        eyebrow={<Breadcrumbs items={[{ label: 'Beranda', href: '/' }, { label: 'Laporan' }]} />}
        title="Laporan Kehadiran"
        description={
          <>
            {formatDate(from, tz)} – {formatDate(to, tz)} · agregasi dihitung di PostgreSQL,
            bukan di browser.
          </>
        }
        action={
          exportTooWide ? (
            <span
              className="inline-flex h-10 items-center gap-2 rounded-md border border-warning/40 bg-warning-soft px-3.5 text-xs font-semibold text-warning"
              title={`Ekspor dibatasi ${EXPORT_MAX_DAYS} hari per permintaan.`}
            >
              <Download className="size-4" aria-hidden="true" />
              Ekspor tidak tersedia
            </span>
          ) : (
            <a
              href={exportCsvHref({ from, to, departmentId, officeId })}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-3.5 text-sm font-medium text-on-accent no-underline transition-[filter] hover:brightness-110"
            >
              <Download className="size-4" aria-hidden="true" />
              Ekspor CSV
            </a>
          )
        }
      />

      <Card title="Filter" description="Rentang, departemen, dan lokasi diterapkan pada agregasi di server.">
        <div className="flex flex-col gap-4">
          <FilterChips
            label="Rentang cepat"
            chips={PRESETS.map((p) => {
              const presetFrom = isoDaysAgo(p.days, tz);
              const active = presetFrom === from && to === isoDaysAgo(0, tz);
              return { href: rangeParam(presetFrom, to), label: p.label, active };
            })}
          />
          <FilterBar
            departments={departments}
            offices={offices}
            showDateRange
            defaultFrom={from}
            defaultTo={to}
          />
        </div>
      </Card>

      {exportTooWide && (
        <InlineNotice
          tone="warning"
          title="Rentang melebihi batas ekspor."
          message={`Ekspor CSV dibatasi ${EXPORT_MAX_DAYS} hari per permintaan. Grafik dan tabel di bawah tetap menampilkan seluruh rentang yang dipilih.`}
        />
      )}

      <MetricGrid>
        <Metric
          label="Total catatan"
          value={recap.totals.records.toLocaleString('id-ID')}
          sub={`${daily.length} hari dengan data`}
          icon={<TrendingUp className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Total hadir"
          value={recap.totals.present.toLocaleString('id-ID')}
          sub={`${recap.totals.late_records.toLocaleString('id-ID')} catatan terlambat`}
          tone="success"
        />
        <Metric
          label="Total jam kerja"
          value={formatDuration(recap.totals.worked_minutes)}
          sub={`Rata-rata ${formatDuration(avgMinutes(recap.totals.worked_minutes, recap.totals.present))} per catatan`}
        />
        <Metric
          label="Total lembur"
          value={formatDuration(recap.totals.overtime_minutes)}
        />
        <Metric
          label="Keterlambatan"
          value={formatDuration(recap.totals.late_minutes)}
          sub={
            recap.totals.late_records > 0
              ? `Rata-rata ${Math.round(recap.totals.late_minutes / recap.totals.late_records)} menit per catatan terlambat`
              : 'Tidak ada keterlambatan'
          }
          tone={recap.totals.late_minutes > 0 ? 'warning' : 'neutral'}
        />
        <Metric
          label="Akurasi GPS rata-rata"
          value={
            recap.totals.avg_accuracy_m != null
              ? `${Math.round(recap.totals.avg_accuracy_m)} m`
              : 'Tidak ada data'
          }
          sub="Semakin kecil, semakin baik"
        />
      </MetricGrid>

      {!hasData ? (
        <Card padded={false}>
          <EmptyState
            icon="search"
            title="Tidak ada data pada rentang ini"
            description="Belum ada catatan absensi untuk kombinasi tanggal, departemen, dan lokasi yang dipilih. Periksa rentang tanggal, atau longgarkan filter departemen dan lokasi."
            action={
              <Link
                href={`?from=${isoDaysAgo(29, tz)}&to=${isoDaysAgo(0, tz)}`}
                className="inline-flex h-9 coarse:h-10 items-center rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink no-underline transition-colors hover:bg-surface-alt"
              >
                Tampilkan 30 hari terakhir
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-lg xl:grid-cols-2">
            <Card
              title="Kehadiran harian"
              description="Jumlah check-in per hari, dipisahkan menjadi tepat waktu dan terlambat."
              action={
                <ChartLegend
                  items={[
                    { label: 'Tepat waktu', color: 'var(--accent-bright)' },
                    { label: 'Terlambat', color: 'var(--warning-bright)' },
                  ]}
                />
              }
            >
              <AttendanceTrend daily={daily} />
            </Card>

            <Card
              title="Jam kerja harian"
              description="Akumulasi jam kerja dan lembur dalam jam, bukan menit."
              action={
                <ChartLegend
                  items={[
                    { label: 'Jam kerja', color: 'var(--accent-bright)' },
                    { label: 'Lembur', color: 'var(--warning-bright)', dashed: true },
                  ]}
                />
              }
            >
              <WorkedHoursTrend daily={daily} />
            </Card>
          </div>

          {/*
            The table is not a "data export" afterthought: it is the accessible
            equivalent of the two charts above, and the only place a reviewer can
            read an exact per-day figure without hovering.
          */}
          <Card
            title="Rekap harian"
            description={`${daily.length.toLocaleString('id-ID')} hari dengan data, terbaru lebih dulu.`}
            padded={false}
          >
            <TableWrap
              minWidth={tableMinWidth.compact}
              label="Rekap kehadiran harian"
              caption={`Rekap harian ${formatDate(from, tz)} sampai ${formatDate(to, tz)}`}
            >
              <thead>
                <tr>
                  <Th sticky>Tanggal</Th>
                  <Th align="right">Hadir</Th>
                  <Th align="right">Terlambat</Th>
                  <Th align="right" hideBelow="sm">
                    Jam kerja
                  </Th>
                  <Th align="right" hideBelow="sm">
                    Lembur
                  </Th>
                  <Th align="right">Menit terlambat</Th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((d) => (
                  <Tr key={d.day}>
                    <Td sticky className="tabular whitespace-nowrap text-ink">
                      {formatDate(d.day, tz)}
                    </Td>
                    <Td align="right" className="tabular">
                      {d.present.toLocaleString('id-ID')}
                    </Td>
                    <Td align="right" className="tabular">
                      {d.late > 0 ? (
                        <span className="text-warning">{d.late.toLocaleString('id-ID')}</span>
                      ) : (
                        <span className="text-ink-muted">0</span>
                      )}
                    </Td>
                    <Td align="right" hideBelow="sm" className="tabular">
                      {formatDuration(d.worked_minutes)}
                    </Td>
                    <Td align="right" hideBelow="sm" className="tabular">
                      {formatDuration(d.overtime_minutes)}
                    </Td>
                    <Td align="right" className="tabular">
                      {d.late_minutes.toLocaleString('id-ID')}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>

          <p className="text-xs leading-relaxed text-ink-muted">
            Seluruh angka berasal dari fungsi <code className="rounded-sm bg-surface-alt px-1 py-0.5 text-2xs">report_recap</code>{' '}
            yang dijaga check constraint dan RLS di server. Menit keterlambatan dijumlahkan per
            catatan terlambat, bukan per hari kerja.
          </p>
        </>
      )}
    </div>
  );
}

function avgMinutes(total: number, count: number): number | null {
  if (!count) return null;
  return Math.round(total / count);
}