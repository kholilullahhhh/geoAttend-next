import Link from 'next/link';
import { Suspense } from 'react';
import {
  AlertTriangle,
  Clock,
  Timer,
  UserCheck,
  UserMinus,
  UserX,
} from 'lucide-react';

import { FilterBar } from '@/components/filters/FilterBar';
import { LiveIndicator } from '@/components/shell/LiveIndicator';
import { AttendanceStatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageHeader, SkeletonRows } from '@/components/ui/States';
import { StatCard, StatGrid, ProportionBar } from '@/components/ui/StatCard';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { FALLBACK_TIMEZONE } from '@/lib/brand';
import { DataError, fetchDepartments, fetchOffices, fetchSummary } from '@/lib/data';
import { formatDistance, formatDuration, formatTime, isoToday } from '@/lib/format';

export const metadata = { title: 'Ringkasan' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const date = first(params.date) ?? isoToday(FALLBACK_TIMEZONE);
  const departmentId = first(params.dept);
  const officeId = first(params.office);

  const [departments, offices] = await Promise.all([fetchDepartments(), fetchOffices()]);

  let summary;
  try {
    summary = await fetchSummary({
      date,
      departmentId,
      officeId,
    });
  } catch (error) {
    return (
      <ErrorState
        message={error instanceof DataError ? error.message : 'Terjadi kesalahan tak terduga.'}
      />
    );
  }

  const tz = summary.timezone || FALLBACK_TIMEZONE;
  const recent = summary.recent ?? [];
  const maxDeptTotal = Math.max(1, ...(summary.by_department ?? []).map((d) => d.total));

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader
        title="Ringkasan Kehadiran"
        description={`Data per ${formatDateLong(summary.date)} · zona waktu ${tz}`}
        action={<LiveIndicator />}
      />

      <Suspense fallback={null}>
        <Card
          title="Filter"
          description="Rentang tanggal, departemen, dan lokasi applied di sisi server."
        >
          <FilterBar departments={departments} offices={offices} />
        </Card>
      </Suspense>

      <StatGrid>
        <StatCard
          label="Total karyawan"
          value={summary.total_employees}
          sub={`${summary.expected} dijadwalkan hari ini`}
          icon={<UserCheck className="size-4" aria-hidden="true" />}
        />
        <StatCard
          label="Hadir"
          value={summary.present}
          sub={`${summary.on_time} tepat waktu · ${summary.late} terlambat`}
          tone="success"
          icon={<UserCheck className="size-4" aria-hidden="true" />}
        />
        <StatCard
          label="Belum check-in"
          value={summary.not_checked_in}
          sub="Dihitung dari jadwal, bukan dari seluruh direktori"
          tone={summary.not_checked_in > 0 ? 'warning' : 'neutral'}
          icon={<UserX className="size-4" aria-hidden="true" />}
        />
        <StatCard
          label="Sedang bekerja"
          value={summary.working}
          sub={`${summary.completed} sudah check-out`}
          tone="accent"
          icon={<Clock className="size-4" aria-hidden="true" />}
        />
        <StatCard
          label="Total jam kerja"
          value={formatDuration(summary.total_worked_minutes)}
          sub={`${summary.total_late_minutes} menit keterlambatan`}
          icon={<Timer className="size-4" aria-hidden="true" />}
        />
        <StatCard
          label="Izin disetujui"
          value={summary.on_leave}
          sub={`${summary.pending_leave} pengajuan menunggu`}
          tone="info"
          icon={<UserMinus className="size-4" aria-hidden="true" />}
        />
        <StatCard
          label="Perlu ditinjau"
          value={summary.need_review}
          sub="Diberi tanda oleh aturan risiko backend"
          tone={summary.need_review > 0 ? 'danger' : 'neutral'}
          icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        />
        <StatCard
          label="Koreksi menunggu"
          value={summary.pending_corrections}
          sub="Pengajuan koreksi absensi"
          tone={summary.pending_corrections > 0 ? 'warning' : 'neutral'}
          icon={<UserMinus className="size-4" aria-hidden="true" />}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-lg xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card
            title="Absensi terbaru"
            description="50 catatan terakhir pada tanggal terpilih."
            padded={false}
            action={
              <Link href="/attendance">
                <Button size="sm">Lihat semua</Button>
              </Link>
            }
          >
            {recent.length === 0 ? (
              <EmptyState
                title="Belum ada absensi"
                description="Tidak ada check-in yang tercatat pada tanggal ini. Coba ubah tanggal atau reset filter di atas."
              />
            ) : (
              <TableWrap minWidth={860}>
                <thead>
                  <tr>
                    <Th>Karyawan</Th>
                    <Th>Check-in</Th>
                    <Th>Check-out</Th>
                    <Th>Durasi</Th>
                    <Th>Status</Th>
                    <Th align="right">Jarak</Th>
                    <Th>Catatan</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <Link
                          href={`/attendance/${row.id}`}
                          className="font-medium text-ink hover:text-accent-ink hover:underline"
                        >
                          {row.full_name}
                        </Link>
                        {row.employee_code && (
                          <p className="tabular text-xs text-ink-muted">{row.employee_code}</p>
                        )}
                      </Td>
                      <Td className="tabular whitespace-nowrap">
                        {formatTime(row.check_in_at, tz)}
                      </Td>
                      <Td className="tabular whitespace-nowrap">
                        {row.check_out_at ? formatTime(row.check_out_at, tz) : '—'}
                      </Td>
                      <Td className="tabular whitespace-nowrap">
                        {row.check_out_at ? formatDuration(row.worked_minutes) : 'Berjalan'}
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <AttendanceStatusBadge status={row.status} />
                          {row.is_late && (
                            <Badge tone="warning">Terlambat {row.late_minutes}m</Badge>
                          )}
                        </div>
                      </Td>
                      <Td align="right" className="tabular whitespace-nowrap">
                        {formatDistance(row.check_in_distance_m)}
                      </Td>
                      <Td>
                        <RiskFlags flags={row.risk_flags} reviewRequired={row.review_required} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-lg">
          <Card title="Kehadiran per departemen" description="Hadir dan terlambat dibanding total.">
            {(summary.by_department ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">Belum ada karyawan aktif.</p>
            ) : (
              <ul className="flex flex-col gap-md">
                {(summary.by_department ?? []).map((dept) => (
                  <li key={dept.department_id ?? dept.name} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">{dept.name}</span>
                      <span className="tabular shrink-0 text-xs text-ink-muted">
                        {dept.present}/{dept.total} hadir
                      </span>
                    </div>
                    <ProportionBar value={dept.present} max={maxDeptTotal} />
                    {dept.late > 0 && (
                      <p className="text-xs text-warning">{dept.late} orang terlambat</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Tindakan tertunda" description="Butuh keputusan Anda.">
            <div className="flex flex-col gap-md">
              <Link
                href="/approvals?tab=leave"
                className="flex items-center justify-between gap-3 rounded-md border border-line px-md py-3 hover:bg-surface-alt"
              >
                <span className="text-sm text-ink">Pengajuan izin</span>
                <Badge tone={summary.pending_leave > 0 ? 'warning' : 'neutral'}>
                  {summary.pending_leave}
                </Badge>
              </Link>
              <Link
                href="/approvals?tab=corrections"
                className="flex items-center justify-between gap-3 rounded-md border border-line px-md py-3 hover:bg-surface-alt"
              >
                <span className="text-sm text-ink">Koreksi absensi</span>
                <Badge tone={summary.pending_corrections > 0 ? 'warning' : 'neutral'}>
                  {summary.pending_corrections}
                </Badge>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Risk indicators.
 *
 * These are *signals for human review*, not proof of wrongdoing. GPS alone
 * cannot prove a location is genuine, so the wording stays neutral.
 */
function RiskFlags({
  flags,
  reviewRequired,
}: {
  flags: string[] | null;
  reviewRequired: boolean;
}) {
  const list = flags ?? [];
  if (!reviewRequired && list.length === 0) {
    return <span className="text-xs text-ink-muted">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {reviewRequired && <Badge tone="danger">Perlu ditinjau</Badge>}
      {list.map((f) => (
        <Badge key={f} tone="warning" title={RISK_LABEL[f] ?? f}>
          {RISK_SHORT[f] ?? f}
        </Badge>
      ))}
    </div>
  );
}

const RISK_SHORT: Record<string, string> = {
  LOW_ACCURACY: 'GPS lemah',
  OUT_OF_RADIUS: 'Di luar radius',
  IMPOSSIBLE_TRAVEL: 'Perjalanan tidak mungkin',
  DEVICE_TIME_MISMATCH: 'Jam perangkat beda',
  DUPLICATE_DEVICE: 'Perangkat ganda',
};

const RISK_LABEL: Record<string, string> = {
  LOW_ACCURACY: 'Akurasi GPS di ambang batas',
  OUT_OF_RADIUS: 'Di luar radius geofence',
  IMPOSSIBLE_TRAVEL: 'Perindahan terlalu cepat untuk jaraknya',
  DEVICE_TIME_MISMATCH: 'Jam perangkat berbeda dari waktu server',
  DUPLICATE_DEVICE: 'Perangkat yang sama dipakai lebih dari satu akun',
};

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

export function Loading() {
  return (
    <div className="flex flex-col gap-xl">
      <PageHeader title="Ringkasan Kehadiran" />
      <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-sunken" />
        ))}
      </div>
      <Card padded={false}>
        <SkeletonRows rows={6} />
      </Card>
    </div>
  );
}
