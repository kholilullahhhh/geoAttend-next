import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle,
  Clock,
  FileWarning,
  UserCheck,
  UserX,
} from 'lucide-react';

import { AttendanceTrend, StatusMix } from '@/components/charts/Charts';
import { FilterBar } from '@/components/filters/FilterBar';
import { RiskFlags } from '@/components/attendance/RiskFlags';
import { LiveIndicator } from '@/components/shell/LiveIndicator';
import { AttendanceStatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  PageHeader,
} from '@/components/ui/States';
import { KeyValueGrid, Metric, MetricGrid, MetricHero, ProportionBar } from '@/components/ui/StatCard';
import { RowLink, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { tableMinWidth } from '@/lib/design';
import { FALLBACK_TIMEZONE } from '@/lib/brand';
import { DataError, fetchDepartments, fetchOffices, fetchRecap, fetchSummary } from '@/lib/data';
import {
  formatDistance,
  formatDuration,
  formatTime,
  isoDaysAgo,
  isoToday,
} from '@/lib/format';
export const metadata = { title: 'Ringkasan' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const TREND_DAYS = 6;

export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const date = first(params.date) ?? isoToday(FALLBACK_TIMEZONE);
  const departmentId = first(params.dept);
  const officeId = first(params.office);

  const [departments, offices] = await Promise.all([fetchDepartments(), fetchOffices()]);

  let summary;
  let trend;
  try {
    // The trend is the same `report_recap` the reports page uses, over a fixed
    // trailing window ending on the selected day. It is fetched in parallel with
    // the summary so the overview still costs two round trips, not three.
    const trendTo = date;
    const trendFrom = isoDaysAgo(TREND_DAYS, FALLBACK_TIMEZONE);
    [summary, trend] = await Promise.all([
      fetchSummary({ date, departmentId, officeId }),
      fetchRecap({ from: trendFrom, to: trendTo, departmentId, officeId }),
    ]);
  } catch (error) {
    return (
      <ErrorState
        message={error instanceof DataError ? error.message : 'Terjadi kesalahan tak terduga.'}
      />
    );
  }

  const tz = summary.timezone || FALLBACK_TIMEZONE;
  const recent = summary.recent ?? [];
  const RECENT_LIMIT = 8;
  const departments_ = summary.by_department ?? [];
  const maxDeptTotal = Math.max(1, ...departments_.map((d) => d.total));

  // Period comparison is only shown when the summary is for today. For a past
  // date there is no "yesterday relative to it" in this payload, and
  // comparing an arbitrary day to today would be meaningless.
  const isToday = date === isoToday(tz);

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader
        eyebrow={
          <Breadcrumbs
            items={[{ label: 'Beranda', href: '/' }, { label: 'Ringkasan' }]}
          />
        }
        title="Ringkasan Kehadiran"
        description={
          <>
            Data per <strong className="font-medium text-ink">{formatDateLong(summary.date)}</strong>{' '}
            · zona waktu {tz}
            {!isToday && ' · tampilan historis'}
          </>
        }
        action={<LiveIndicator />}
      />

      {/*
        One hero metric, then a supporting row. The previous layout was eight
        identical tiles, which made "how many people are here right now" and
        "how many correction requests are queued" equally loud — and therefore
        equally easy to miss.
      */}
      <div className="grid grid-cols-1 gap-lg xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MetricHero
            label="Hadir hari ini"
            value={
              <>
                {summary.present}
                <span className="text-lg font-medium text-ink-muted">/{summary.expected}</span>
              </>
            }
            sub={`${summary.total_employees} karyawan terdaftar · ${
              summary.on_time + summary.late
            } check-in tercatat`}
            segments={[
              { key: 'on_time', label: 'Tepat waktu', value: summary.on_time, tone: 'success' },
              { key: 'late', label: 'Terlambat', value: summary.late, tone: 'warning' },
              { key: 'working', label: 'Sedang bekerja', value: summary.working, tone: 'info' },
              { key: 'completed', label: 'Sudah check-out', value: summary.completed, tone: 'accent' },
              { key: 'leave', label: 'Izin/ dispensasi', value: summary.on_leave, tone: 'neutral' },
              {
                key: 'missing',
                label: 'Belum check-in',
                value: summary.not_checked_in,
                tone: 'danger',
              },
            ]}
            footer={
              <dl className="grid grid-cols-2 gap-x-lg gap-y-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-ink-muted">Total jam kerja</dt>
                  <dd className="tabular mt-0.5 text-sm font-semibold text-ink">
                    {formatDuration(summary.total_worked_minutes)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Akumulasi keterlambatan</dt>
                  <dd className="tabular mt-0.5 text-sm font-semibold text-ink">
                    {summary.total_late_minutes} menit
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Belum check-in</dt>
                  <dd className="tabular mt-0.5 text-sm font-semibold text-ink">
                    {summary.not_checked_in} orang
                  </dd>
                </div>
              </dl>
            }
          />
        </div>

        <Card
          title="Tindakan tertunda"
          description="Butuh keputusan Anda sebelum dapat diproses."
          padded={false}
          className="flex flex-col"
        >
          <ul className="flex flex-col divide-y divide-line">
            <QueueRow
              href="/approvals?tab=leave&status=PENDING"
              label="Pengajuan izin"
              count={summary.pending_leave}
              tone="warning"
            />
            <QueueRow
              href="/approvals?tab=corrections&status=PENDING"
              label="Koreksi absensi"
              count={summary.pending_corrections}
              tone="warning"
            />
            <QueueRow
              href="/attendance?status=REJECTED"
              label="Absensi ditandai risiko"
              count={summary.need_review}
              tone="danger"
            />
          </ul>
          <p className="border-t border-line px-lg py-3 text-xs leading-relaxed text-ink-muted">
            Jumlah dihitung oleh server dari pengajuan berstatus menunggu dan catatan yang ditandai
            aturan risiko.
          </p>
        </Card>
      </div>

      <MetricGrid>
        <Metric
          label="Tepat waktu"
          value={summary.on_time}
          sub="Check-in dalam masa tenggang shift"
          tone="success"
          icon={<CheckCircle className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Terlambat"
          value={summary.late}
          sub={summary.late > 0 ? `${summary.total_late_minutes} menit total` : 'Tidak ada keterlambatan'}
          tone={summary.late > 0 ? 'warning' : 'neutral'}
          icon={<Clock className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Sedang bekerja"
          value={summary.working}
          sub={`${summary.completed} sudah check-out`}
          tone="info"
          icon={<UserCheck className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Belum check-in"
          value={summary.not_checked_in}
          sub="Dari jadwal hari ini, bukan seluruh direktori"
          tone={summary.not_checked_in > 0 ? 'danger' : 'neutral'}
          icon={<UserX className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Perlu ditinjau"
          value={summary.need_review}
          sub="Diberi tanda aturan risiko backend"
          tone={summary.need_review > 0 ? 'danger' : 'neutral'}
          icon={<FileWarning className="size-4" aria-hidden="true" />}
          href="/attendance?status=REJECTED"
        />
        <Metric
          label="Total jam kerja"
          value={formatDuration(summary.total_worked_minutes)}
          sub={`${summary.on_leave} sedang izin/dispensasi`}
          icon={<CalendarClock className="size-4" aria-hidden="true" />}
        />
      </MetricGrid>

      <Card
        title="Filter"
        description="Tanggal, departemen, dan lokasi diterapkan di sisi server — hasil dapat dibagikan lewat URL."
      >
        <FilterBar
          departments={departments}
          offices={offices}
          showSingleDate
          dateParam="date"
          defaultDate={date}
        />
      </Card>

      <div className="grid grid-cols-1 gap-lg 2xl:grid-cols-3">
        <Card
          title="Tren kehadiran"
          description={`${TREND_DAYS + 1} hari terakhir hingga ${formatDateLong(date)} · jumlah hadir per hari.`}
          className="2xl:col-span-2"
        >
          {(trend.daily ?? []).length === 0 ? (
            <EmptyState
              compact
              icon="search"
              title="Belum ada data tren"
              description="Tidak ada catatan absensi pada rentang ini. Coba perluas rentang tanggal di filter."
            />
          ) : (
            <AttendanceTrend daily={trend.daily ?? []} />
          )}
        </Card>

        <Card
          title="Distribusi status"
          description="Porsi check-in menurut status pada tanggal terpilih."
        >
          <StatusMix
            segments={[
              { key: 'on_time', label: 'Tepat waktu', value: summary.on_time, tone: 'success' },
              { key: 'late', label: 'Terlambat', value: summary.late, tone: 'warning' },
              { key: 'working', label: 'Sedang bekerja', value: summary.working, tone: 'info' },
              { key: 'completed', label: 'Selesai', value: summary.completed, tone: 'accent' },
              { key: 'not_checked_in', label: 'Belum check-in', value: summary.not_checked_in, tone: 'danger' },
              { key: 'on_leave', label: 'Izin/dispensasi', value: summary.on_leave, tone: 'neutral' },
            ]}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-lg 2xl:grid-cols-3">
        <Card
          title="Absensi terbaru"
          description={`${RECENT_LIMIT} catatan terakhir yang masuk pada tanggal terpilih.`}
          padded={false}
          className="2xl:col-span-2"
          action={
            <Link href="/attendance" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline">
              Lihat semua
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          {recent.length === 0 ? (
            <EmptyState
              title="Belum ada absensi"
              description="Tidak ada check-in yang tercatat pada tanggal ini. Ubah tanggal atau atur ulang filter di atas untuk melihat hari lain."
              action={
                <Link href="/attendance">
                  <Button size="sm" variant="secondary">
                    Buka daftar absensi
                  </Button>
                </Link>
              }
            />
          ) : (
            <TableWrap
              minWidth={tableMinWidth.default}
              label="Absensi terbaru"
              caption={`${RECENT_LIMIT} catatan absensi terakhir pada ${summary.date}`}
            >
              <thead>
                <tr>
                  <Th sticky>Karyawan</Th>
                  <Th>Lokasi</Th>
                  <Th>Check-in</Th>
                  <Th>Check-out</Th>
                  <Th align="right" hideBelow="md">
                    Durasi
                  </Th>
                  <Th>Status</Th>
                  <Th align="right" hideBelow="lg">
                    Jarak
                  </Th>
                  <Th hideBelow="lg">Tanda</Th>
                </tr>
              </thead>
              <tbody>
                {recent.slice(0, RECENT_LIMIT).map((row) => (
                  <Tr key={row.id}>
                    <Td sticky>
                      <RowLink href={`/attendance/${row.id}`}>{row.full_name}</RowLink>
                      {row.employee_code && (
                        <p className="tabular mt-0.5 text-xs text-ink-muted">
                          {row.employee_code}
                        </p>
                      )}
                    </Td>
                    <Td hideBelow="lg" className="text-xs">
                      {row.office_name ?? <span className="text-ink-muted">—</span>}
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
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <AttendanceStatusBadge status={row.status} size="sm" />
                        {row.is_late && (
                          <Badge tone="warning" size="sm">
                            Telat {row.late_minutes}m
                          </Badge>
                        )}
                      </div>
                    </Td>
                    <Td align="right" hideBelow="lg" className="tabular whitespace-nowrap">
                      {formatDistance(row.check_in_distance_m)}
                    </Td>
                    <Td hideBelow="lg">
                      <RiskFlags flags={row.risk_flags} reviewRequired={row.review_required} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <Card
          title="Kehadiran per departemen"
          description="Hadir dibanding karyawan terjadwal per departemen."
        >
          {departments_.length === 0 ? (
            <EmptyState
              compact
              title="Belum ada karyawan aktif"
              description="Tambahkan karyawan dan assign ke departemen untuk melihat perbandingan ini."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {departments_.map((dept) => (
                <li key={dept.department_id ?? dept.name} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-ink">{dept.name}</span>
                    <span className="tabular shrink-0 text-xs text-ink-muted">
                      {dept.present}/{dept.total}
                    </span>
                  </div>
                  <ProportionBar
                    value={dept.present}
                    max={maxDeptTotal}
                    tone={dept.late > 0 ? 'warning' : 'accent'}
                    label={`${dept.name}: ${dept.present} hadir dari ${dept.total} karyawan${
                      dept.late > 0 ? `, ${dept.late} terlambat` : ''
                    }`}
                  />
                  {dept.late > 0 && (
                    <p className="text-xs text-warning">{dept.late} orang terlambat</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Ringkasan operasional" headingLevel={3}>
        <KeyValueGrid
          columns={4}
          items={[
            { label: 'Karyawan terdaftar', value: summary.total_employees },
            { label: 'Dijadwalkan hari ini', value: summary.expected },
            { label: 'Disetujui izin', value: summary.on_leave },
            { label: 'Pengajuan izin menunggu', value: summary.pending_leave },
            { label: 'Koreksi menunggu', value: summary.pending_corrections },
            { label: 'Catatan ditandai risiko', value: summary.need_review },
            { label: 'Total jam kerja', value: formatDuration(summary.total_worked_minutes), mono: true },
            { label: 'Menit keterlambatan', value: summary.total_late_minutes, mono: true },
          ]}
        />
      </Card>
    </div>
  );
}

/** One row of the "pending actions" card. */
function QueueRow({
  href,
  label,
  count,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  tone: 'warning' | 'danger';
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 px-lg py-3.5 transition-colors hover:bg-surface-alt"
      >
        <span className="min-w-0 text-sm text-ink">{label}</span>
        <span className="flex shrink-0 items-center gap-2">
          <Badge tone={count > 0 ? tone : 'neutral'}>{count}</Badge>
          <ArrowUpRight className="size-3.5 text-ink-muted" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

/**
 * Risk indicators are rendered by the shared `RiskFlags` component so the
 * overview, the attendance list and the detail page cannot drift apart.
 */

function formatDateLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}