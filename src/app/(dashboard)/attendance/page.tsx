import Link from 'next/link';
import { Download, Search } from 'lucide-react';

import { FilterBar } from '@/components/filters/FilterBar';
import { RiskFlags } from '@/components/attendance/RiskFlags';
import { LiveIndicator } from '@/components/shell/LiveIndicator';
import { AttendanceStatusBadge, Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  InlineNotice,
  PageHeader,
} from '@/components/ui/States';
import { Pagination, RowLink, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { tableMinWidth } from '@/lib/design';
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
import { ATTENDANCE_STATUS_ORDER } from '@/lib/status';

export const metadata = { title: 'Absensi' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/**
 * Row cap.
 *
 * This mirrors the server's own maximum: the detail view states "50 catatan
 * terakhir", and rendering fewer would silently contradict that copy.
 */
const ROW_LIMIT = 50;

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

  // A range longer than the export endpoint accepts is still fine to *view* —
  // only the CSV is capped. Warn so the difference is not a surprise.
  const rangeDays =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  const exportRangeTooWide = Number.isFinite(rangeDays) && rangeDays > 400;

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
        eyebrow={<Breadcrumbs items={[{ label: 'Beranda', href: '/' }, { label: 'Absensi' }]} />}
        title="Data Absensi"
        description="Pencarian, penyaringan, dan paginasi dijalankan di PostgreSQL — bukan menyaring data yang sudah dimuat di browser."
        action={
          <>
            <LiveIndicator label="Absensi langsung" />
            {exportRangeTooWide ? (
              <span
                className="inline-flex h-10 items-center gap-2 rounded-md border border-warning/40 bg-warning-soft px-3.5 text-xs font-semibold text-warning"
                title="Ekspor dibatasi 400 hari per permintaan. Persempit rentang tanggal."
              >
                <Download className="size-4" aria-hidden="true" />
                Ekspor tidak tersedia
              </span>
            ) : (
              <a
                href={exportCsvHref({ from, to, search, departmentId, officeId, status })}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-3.5 text-sm font-medium text-on-accent no-underline transition-[filter] hover:brightness-110"
              >
                <Download className="size-4" aria-hidden="true" />
                Ekspor CSV
              </a>
            )}
          </>
        }
      />

      <Card title="Filter" description="Semua filter tersimpan di URL, sehingga tampilan ini dapat dibagikan dan tetap sama setelah dimuat ulang.">
        <FilterBar
          departments={departments}
          offices={offices}
          showDateRange
          statuses={ATTENDANCE_STATUS_ORDER}
          defaultFrom={from}
          defaultTo={to}
        />
      </Card>

      {exportRangeTooWide && (
        <InlineNotice
          tone="warning"
          title="Rentang terlalu luas untuk ekspor."
          message="Penampilan tetap berfungsi, tetapi ekspor CSV dibatasi 400 hari per permintaan. Persempit tanggal untuk mengunduh data."
        />
      )}

      <Card
        title={
          result.total === 0
            ? 'Tidak ada catatan'
            : `${result.total.toLocaleString('id-ID')} catatan absensi`
        }
        description={
          result.total === 0
            ? 'Tidak ada data untuk kombinasi filter ini.'
            : `Menampilkan ${rows.length.toLocaleString('id-ID')} per halaman · halaman ${page.toLocaleString('id-ID')} dari ${totalPages.toLocaleString('id-ID')}`
        }
        padded={false}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={search || departmentId || officeId || status ? 'search' : 'inbox'}
            title="Tidak ada catatan"
            description={
              search || departmentId || officeId || status
                ? 'Filter yang dipilih tidak cocok dengan satu pun catatan pada rentang ini. Longgarkan salah satu filter atau atur ulang semuanya.'
                : 'Belum ada absensi pada rentang tanggal ini. Periksa aplikasi mobile karyawan atau pilih rentang lain.'
            }
            action={
              <Link
                href={`?from=${isoDaysAgo(6, tz)}&to=${isoDaysAgo(0, tz)}`}
                className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink no-underline transition-colors hover:bg-surface-alt"
              >
                <Search className="mr-1.5 size-3.5" aria-hidden="true" />
                Tampilkan 7 hari terakhir
              </Link>
            }
          />
        ) : (
          <>
            <TableWrap
              minWidth={tableMinWidth.wide}
              label="Daftar absensi"
              caption={`Absensi ${from} sampai ${to}`}
            >
              <thead>
                <tr>
                  <Th sticky>Tanggal</Th>
                  <Th>Karyawan</Th>
                  <Th hideBelow="lg">Lokasi</Th>
                  <Th hideBelow="md">Shift</Th>
                  <Th>Check-in</Th>
                  <Th>Check-out</Th>
                  <Th align="right" hideBelow="md">
                    Durasi
                  </Th>
                  <Th align="right" hideBelow="lg">
                    Telat
                  </Th>
                  <Th align="right" hideBelow="xl">
                    Jarak
                  </Th>
                  <Th align="right" hideBelow="xl">
                    Akurasi
                  </Th>
                  <Th>Status</Th>
                  <Th hideBelow="lg">Sumber</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td sticky className="tabular whitespace-nowrap text-ink">
                      {formatDate(row.work_date, tz)}
                    </Td>
                    <Td>
                      <RowLink href={`/attendance/${row.id}`}>{row.full_name}</RowLink>
                      <p className="tabular mt-0.5 text-xs text-ink-muted">
                        {row.employee_code ?? 'Tanpa kode'}
                      </p>
                    </Td>
                    <Td hideBelow="lg" className="text-xs">
                      {row.office_name ?? <span className="text-ink-muted">—</span>}
                    </Td>
                    <Td hideBelow="md" className="text-xs">
                      {row.shift_name ?? <span className="text-ink-muted">Tanpa shift</span>}
                    </Td>
                    <Td className="tabular whitespace-nowrap text-ink">
                      {formatTime(row.check_in_at, tz)}
                    </Td>
                    <Td className="tabular whitespace-nowrap">
                      {row.check_out_at ? (
                        formatTime(row.check_out_at, tz)
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </Td>
                    <Td align="right" hideBelow="md" className="tabular whitespace-nowrap">
                      {row.check_out_at ? (
                        formatDuration(row.worked_minutes)
                      ) : (
                        <span className="text-info">Berjalan</span>
                      )}
                    </Td>
                    <Td align="right" hideBelow="lg" className="tabular whitespace-nowrap">
                      {row.is_late ? (
                        <span className="text-warning">{row.late_minutes}m</span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </Td>
                    <Td align="right" hideBelow="xl" className="tabular whitespace-nowrap">
                      {formatDistance(row.check_in_distance_m)}
                    </Td>
                    <Td align="right" hideBelow="xl" className="tabular whitespace-nowrap">
                      {row.check_in_accuracy_m != null ? (
                        `${Math.round(row.check_in_accuracy_m)} m`
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <AttendanceStatusBadge status={row.status} size="sm" />
                        {row.review_required && (
                          <Badge tone="danger" size="sm">
                            Ditinjau
                          </Badge>
                        )}
                        {(row.risk_flags ?? []).length > 0 && (
                          <RiskFlags flags={row.risk_flags} reviewRequired={false} />
                        )}
                      </div>
                    </Td>
                    <Td hideBelow="lg">
                      {row.source === 'MANUAL' ? (
                        <Badge tone="info" size="sm">
                          Manual HRD
                        </Badge>
                      ) : (
                        <span className="text-xs text-ink-muted">Aplikasi</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>

            {rows.length === ROW_LIMIT && result.total > rows.length && (
              <p className="border-t border-line px-lg py-2.5 text-xs text-ink-muted">
                Menampilkan {ROW_LIMIT} catatan terbaru pada halaman ini. Gunakan penyaring dan
                pagination untuk menjangkau sisanya.
              </p>
            )}

            <Pagination
              page={page}
              totalPages={totalPages}
              total={result.total}
              showing={rows.length}
              hrefFor={pageHref}
            />
          </>
        )}
      </Card>

      <p className="text-xs leading-relaxed text-ink-muted">
        Status memakai kosakata yang sama dengan aplikasi mobile. Baris yang ditandai{' '}
        <span className="font-medium text-ink-secondary">Ditinjau</span> diberi tanda oleh aturan
        risiko backend — sinyal untuk diperiksa manusia, bukan bukti pelanggaran. Keterlambatan
        dan durasi dihitung dari waktu server.
      </p>
    </div>
  );
}