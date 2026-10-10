import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { FilterBar } from '@/components/filters/FilterBar';
import { AttendanceStatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/States';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { FALLBACK_TIMEZONE } from '@/lib/brand';
import { DataError, fetchAttendanceList, fetchDepartments, fetchOffices } from '@/lib/data';
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatTime,
  isoDaysAgo,
} from '@/lib/format';
import { exportCsvHref } from '@/lib/csv';

export const metadata = { title: 'Absensi' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  'CHECKED_IN',
  'COMPLETED',
  'REJECTED',
  'EXCUSED',
  'ABSENT',
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const from = first(params.from) ?? isoDaysAgo(6, FALLBACK_TIMEZONE);
  const to = first(params.to) ?? isoDaysAgo(0, FALLBACK_TIMEZONE);
  const search = first(params.q);
  const departmentId = first(params.dept);
  const officeId = first(params.office);
  const status = first(params.status);
  const page = Math.max(1, Number(first(params.page) ?? '1') || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [departments, offices] = await Promise.all([fetchDepartments(), fetchOffices()]);

  let result;
  try {
    result = await fetchAttendanceList({
      from,
      to,
      search,
      departmentId,
      officeId,
      status,
      limit: PAGE_SIZE,
      offset,
    });
  } catch (error) {
    return (
      <ErrorState
        message={error instanceof DataError ? error.message : 'Terjadi kesalahan tak terduga.'}
      />
    );
  }

  const rows = result.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const tz = FALLBACK_TIMEZONE;

  // Preserve the current filter set when moving between pages.
  function pageHref(target: number): string {
    const next = new URLSearchParams();
    next.set('from', from);
    next.set('to', to);
    if (search) next.set('q', search);
    if (departmentId) next.set('dept', departmentId);
    if (officeId) next.set('office', officeId);
    if (status) next.set('status', status);
    if (target > 1) next.set('page', String(target));
    return `?${next.toString()}`;
  }

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Data Absensi"
        description="Paginasi dan filter dijalankan di database, bukan di browser."
        action={
          <a href={exportCsvHref({ from, to, search, departmentId, officeId, status })}>
            <Button>Ekspor CSV</Button>
          </a>
        }
      />

      <Suspense fallback={null}>
        <Card title="Filter">
          <FilterBar
            departments={departments}
            offices={offices}
            showDateRange
            showStatus
            statuses={STATUS_OPTIONS}
            defaultFrom={from}
            defaultTo={to}
          />
        </Card>
      </Suspense>

      <Card
        title={`${result.total.toLocaleString('id-ID')} catatan`}
        description={
          result.total === 0
            ? 'Tidak ada data untuk kombinasi filter ini.'
            : `Menampilkan ${rows.length} dari ${result.total} · halaman ${page} dari ${totalPages}`
        }
        padded={false}
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Tidak ada catatan"
            description="Belum ada absensi pada rentang tanggal dan filter yang dipilih."
          />
        ) : (
          <>
            <TableWrap minWidth={1040}>
              <thead>
                <tr>
                  <Th>Tanggal</Th>
                  <Th>Karyawan</Th>
                  <Th>Lokasi</Th>
                  <Th>Check-in</Th>
                  <Th>Check-out</Th>
                  <Th align="right">Durasi</Th>
                  <Th align="right">Telat</Th>
                  <Th align="right">Jarak</Th>
                  <Th align="right">Akurasi</Th>
                  <Th>Status</Th>
                  <Th>Sumber</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td className="tabular whitespace-nowrap">
                      {formatDate(row.work_date, tz)}
                    </Td>
                    <Td>
                      <Link
                        href={`/attendance/${row.id}`}
                        className="font-medium text-ink hover:text-accent-ink hover:underline"
                      >
                        {row.full_name}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {row.employee_code ?? '—'} · {row.shift_name ?? 'Tanpa shift'}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-secondary">{row.office_name ?? '—'}</Td>
                    <Td className="tabular whitespace-nowrap">{formatTime(row.check_in_at, tz)}</Td>
                    <Td className="tabular whitespace-nowrap">
                      {row.check_out_at ? formatTime(row.check_out_at, tz) : '—'}
                    </Td>
                    <Td align="right" className="tabular whitespace-nowrap">
                      {row.check_out_at ? formatDuration(row.worked_minutes) : 'Berjalan'}
                    </Td>
                    <Td align="right" className="tabular whitespace-nowrap">
                      {row.is_late ? `${row.late_minutes}m` : '—'}
                    </Td>
                    <Td align="right" className="tabular whitespace-nowrap">
                      {formatDistance(row.check_in_distance_m)}
                    </Td>
                    <Td align="right" className="tabular whitespace-nowrap">
                      {row.check_in_accuracy_m != null ? `${Math.round(row.check_in_accuracy_m)} m` : '—'}
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <AttendanceStatusBadge status={row.status} />
                        {row.review_required && <Badge tone="danger">Ditinjau</Badge>}
                      </div>
                    </Td>
                    <Td>
                      {row.source === 'MANUAL' ? (
                        <Badge tone="info">Manual HRD</Badge>
                      ) : (
                        <span className="text-xs text-ink-muted">Aplikasi</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>

            {totalPages > 1 && (
              <nav
                className="flex items-center justify-between gap-3 border-t border-line px-lg py-md"
                aria-label="Navigasi halaman"
              >
                {page > 1 ? (
                  <Link href={pageHref(page - 1)}>
                    <Button size="sm" icon={<ChevronLeft className="size-4" aria-hidden="true" />}>
                      Sebelumnya
                    </Button>
                  </Link>
                ) : (
                  <span />
                )}
                <span className="tabular text-xs text-ink-muted">
                  Halaman {page} / {totalPages}
                </span>
                {page < totalPages ? (
                  <Link href={pageHref(page + 1)}>
                    <Button size="sm">
                      Berikutnya
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Button>
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
      </Card>
    </div>
  );
}