import Link from 'next/link';
import { Suspense } from 'react';

import { AttendanceTrend, WorkedHoursTrend } from '@/components/charts/Charts';
import { FilterBar } from '@/components/filters/FilterBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/States';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
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
  { key: 'week', label: 'Minggu ini', days: 6 },
  { key: 'month', label: '30 hari', days: 29 },
  { key: 'quarter', label: '90 hari', days: 89 },
] as const;

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

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Laporan Kehadiran"
        description={`${formatDate(from, tz)} – ${formatDate(to, tz)} · agregasi di PostgreSQL`}
        action={
          <a href={exportCsvHref({ from, to, departmentId, officeId })}>
            <Button>Ekspor CSV</Button>
          </a>
        }
      />

      <Suspense fallback={null}>
        <Card title="Filter">
          <div className="flex flex-col gap-md">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const presetFrom = isoDaysAgo(p.days, tz);
                const active = presetFrom === from && to === isoDaysAgo(0, tz);
                const q = new URLSearchParams({ from: presetFrom, to });
                if (departmentId) q.set('dept', departmentId);
                if (officeId) q.set('office', officeId);
                return (
                  <Link
                    key={p.key}
                    href={`?${q.toString()}`}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-md px-md py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-accent-soft text-accent-ink'
                        : 'text-ink-secondary hover:bg-surface-alt'
                    }`}
                  >
                    {p.label}
                  </Link>
                );
              })}
            </div>
            <FilterBar departments={departments} offices={offices} showDateRange defaultFrom={from} defaultTo={to} />
          </div>
        </Card>
      </Suspense>

      <StatGrid>
        <StatCard label="Total catatan" value={recap.totals.records} />
        <StatCard
          label="Hadir"
          value={recap.totals.present}
          sub={`${recap.totals.late_records} catatan terlambat`}
          tone="success"
        />
        <StatCard label="Total jam kerja" value={formatDuration(recap.totals.worked_minutes)} />
        <StatCard label="Total lembur" value={formatDuration(recap.totals.overtime_minutes)} />
        <StatCard
          label="Total keterlambatan"
          value={formatDuration(recap.totals.late_minutes)}
          tone={recap.totals.late_minutes > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Rata-rata akurasi GPS"
          value={
            recap.totals.avg_accuracy_m != null ? `${recap.totals.avg_accuracy_m} m` : '—'
          }
          sub="Semakin kecil, semakin baik"
        />
      </StatGrid>

      {!hasData ? (
        <Card>
          <EmptyState
            title="Tidak ada data pada rentang ini"
            description="Belum ada catatan absensi untuk kombinasi tanggal, departemen, dan lokasi yang dipilih."
            action={
              <Link href={`?from=${isoDaysAgo(29, tz)}&to=${isoDaysAgo(0, tz)}`}>
                <Button size="sm">Tampilkan 30 hari terakhir</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-lg xl:grid-cols-2">
            <Card title="Kehadiran harian" description="Jumlah hadir dan terlambat per hari.">
              <AttendanceTrend daily={daily} />
            </Card>
            <Card title="Jam kerja harian" description="Akumulasi jam kerja dan lembur.">
              <WorkedHoursTrend daily={daily} />
            </Card>
          </div>

          <Card
            title="Rekap harian"
            description={`${daily.length} hari dengan data`}
            padded={false}
          >
            <TableWrap minWidth={720}>
              <thead>
                <tr>
                  <Th>Tanggal</Th>
                  <Th align="right">Hadir</Th>
                  <Th align="right">Terlambat</Th>
                  <Th align="right">Jam kerja</Th>
                  <Th align="right">Lembur</Th>
                  <Th align="right">Menit terlambat</Th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((d) => (
                  <Tr key={d.day}>
                    <Td className="tabular whitespace-nowrap">{formatDate(d.day, tz)}</Td>
                    <Td align="right" className="tabular">
                      {d.present}
                    </Td>
                    <Td align="right" className="tabular">
                      {d.late}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatDuration(d.worked_minutes)}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatDuration(d.overtime_minutes)}
                    </Td>
                    <Td align="right" className="tabular">
                      {d.late_minutes}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        </>
      )}
    </div>
  );
}