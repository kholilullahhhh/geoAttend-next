import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { ReviewControls } from '@/components/approvals/ReviewControls';
import { FilterChips, TabStrip } from '@/components/filters/FilterChips';
import { Badge, RequestStatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  InlineNotice,
  PageHeader,
  PermissionState,
} from '@/components/ui/States';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { tableMinWidth } from '@/lib/design';
import { FALLBACK_TIMEZONE } from '@/lib/brand';
import {
  DataError,
  fetchCorrections,
  fetchLeaveRequests,
  fetchPendingCounts,
  requireHrAdmin,
} from '@/lib/data';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { LEAVE_TYPE_LABEL, REQUEST_STATUS_ORDER, requestStatus } from '@/lib/status';

export const metadata = { title: 'Persetujuan' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

type Status = (typeof REQUEST_STATUS_ORDER)[number];

const STATUS_HINT: Record<Status, string> = {
  PENDING:
    'Menyetujui pengajuan izin akan membuat hari tersebut tercatat sebagai dispensasi pada perhitungan kehadiran. Menyetujui koreksi akan menghitung ulang durasi, keterlambatan, dan lembur di server.',
  APPROVED: 'Pengajuan yang sudah disetujui. Statusnya final dan tidak dapat diubah dari halaman ini.',
  REJECTED: 'Pengajuan yang ditolak, beserta alasan yang diberikan pada saat penolakan.',
  CANCELLED: 'Pengajuan yang dibatalkan oleh pemohon sebelum ditinjau.',
};

export default async function ApprovalsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const rawTab = first(params.tab);
  const tab: 'leave' | 'corrections' = rawTab === 'corrections' ? 'corrections' : 'leave';

  const rawStatus = first(params.status) ?? 'PENDING';
  const status: Status = (REQUEST_STATUS_ORDER as readonly string[]).includes(rawStatus)
    ? (rawStatus as Status)
    : 'PENDING';

  try {
    await requireHrAdmin();
  } catch (error) {
    if (error instanceof DataError) {
      return <PermissionState title="Akses ditolak" message={error.message} />;
    }
    throw error;
  }

  let leaves;
  let corrections;
  let pending;
  try {
    /*
     * The tab badges count PENDING items *independently* of the status filter.
     * Deriving them from the loaded rows made the badge read "0 menunggu"
     * whenever the reviewer was looking at the Approved tab — exactly when they
     * most needed to know work was waiting.
     */
    [leaves, corrections, pending] = await Promise.all([
      fetchLeaveRequests(status),
      fetchCorrections(status),
      fetchPendingCounts(),
    ]);
  } catch (error) {
    return (
      <ErrorState
        message={error instanceof DataError ? error.message : 'Terjadi kesalahan tak terduga.'}
      />
    );
  }

  const tz = FALLBACK_TIMEZONE;
  const rows = tab === 'leave' ? leaves : corrections;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        eyebrow={<Breadcrumbs items={[{ label: 'Beranda', href: '/' }, { label: 'Persetujuan' }]} />}
        title="Persetujuan"
        description="Setiap keputusan dicatat pada audit log bersama alasan dan pelakunya. Menolak pengajuan wajib menyertakan alasan."
        action={
          pending.total > 0 ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-pill bg-warning-soft px-3 text-xs font-semibold text-warning">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {pending.total.toLocaleString('id-ID')} menunggu keputusan
            </span>
          ) : null
        }
      />

      <TabStrip
        label="Jenis pengajuan"
        tabs={[
          { href: `/approvals?tab=leave&status=${status}`, label: 'Pengajuan izin', active: tab === 'leave', badge: pending.leave },
          {
            href: `/approvals?tab=corrections&status=${status}`,
            label: 'Koreksi absensi',
            active: tab === 'corrections',
            badge: pending.corrections,
          },
        ]}
      />

      <FilterChips
        label="Status pengajuan"
        chips={REQUEST_STATUS_ORDER.map((code) => ({
          href: `/approvals?tab=${tab}&status=${code}`,
          label: requestStatus(code).label,
          active: status === code,
          tone: requestStatus(code).tone,
        }))}
      />

      <InlineNotice
        tone={status === 'PENDING' ? 'info' : 'neutral'}
        title={requestStatus(status).label}
        message={STATUS_HINT[status]}
      />

      {rows.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            title={
              status === 'PENDING'
                ? 'Tidak ada pengajuan menunggu'
                : `Tidak ada pengajuan ${requestStatus(status).label.toLowerCase()}`
            }
            description={
              status === 'PENDING'
                ? 'Semua pengajuan pada jenis ini sudah diproses. Antrean baru akan muncul di sini secara otomatis.'
                : 'Coba pilih jenis pengajuan atau status lain untuk melihat antrean yang tersedia.'
            }
            action={
              status !== 'PENDING' ? (
                <Link
                  href={`/approvals?tab=${tab}&status=PENDING`}
                  className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink no-underline transition-colors hover:bg-surface-alt"
                >
                  Kembali ke yang menunggu
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : tab === 'leave' ? (
        <Card
          title={`Pengajuan izin · ${leaves.length.toLocaleString('id-ID')} catatan`}
          description="Alasan pengajuan ditampilkan sesuai yang dikirim karyawan dari aplikasi mobile."
          padded={false}
        >
          <TableWrap
            minWidth={tableMinWidth.default}
            label="Daftar pengajuan izin"
            caption={`Pengajuan izin berstatus ${requestStatus(status).label}`}
          >
            <thead>
              <tr>
                <Th sticky>Karyawan</Th>
                <Th hideBelow="lg">Jenis</Th>
                <Th>Periode</Th>
                <Th>Alasan</Th>
                <Th hideBelow="md">Diajukan</Th>
                <Th>Status</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((r) => (
                <Tr key={r.id}>
                  <Td sticky>
                    <span className="font-medium text-ink">{r.full_name}</span>
                    <p className="tabular mt-0.5 text-xs text-ink-muted">
                      {r.employee_code ?? 'Tanpa kode'}
                    </p>
                  </Td>
                  <Td hideBelow="lg">
                    <Badge tone="neutral" size="sm">
                      {LEAVE_TYPE_LABEL[r.type] ?? r.type}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="tabular text-xs whitespace-nowrap text-ink-secondary">
                      {formatDate(r.start_date, tz)}
                      <span className="mx-1 text-ink-muted" aria-label="hingga">
                        →
                      </span>
                      {formatDate(r.end_date, tz)}
                    </span>
                    <p className="tabular mt-0.5 text-2xs text-ink-muted">
                      {dayCount(r.start_date, r.end_date)} hari kerja
                    </p>
                  </Td>
                  <Td>
                    <span
                      className="line-clamp-2 block max-w-72 text-xs leading-relaxed text-ink-secondary"
                      title={r.reason}
                    >
                      {r.reason}
                    </span>
                  </Td>
                  <Td
                    hideBelow="md"
                    className="tabular text-xs whitespace-nowrap text-ink-muted"
                  >
                    {formatDateTime(r.created_at, tz)}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <RequestStatusBadge status={r.status} size="sm" />
                      {r.review_note && (
                        <span
                          className="line-clamp-2 max-w-56 text-2xs leading-relaxed text-ink-muted"
                          title={r.review_note}
                        >
                          “{r.review_note}”
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td align="right">
                    {r.status === 'PENDING' ? (
                      <ReviewControls
                        requestId={r.id}
                        kind="leave"
                        subject={`izin ${r.full_name}`}
                      />
                    ) : (
                      <span className="tabular text-2xs whitespace-nowrap text-ink-muted">
                        {r.reviewed_at ? formatDateTime(r.reviewed_at, tz) : '—'}
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      ) : (
        <Card
          title={`Koreksi absensi · ${corrections.length.toLocaleString('id-ID')} catatan`}
          description="Waktu saat ini berasal dari snapshot yang tersimpan saat pengajuan dibuat; waktu baru adalah yang diminta karyawan."
          padded={false}
        >
          <TableWrap
            minWidth={tableMinWidth.wide}
            label="Daftar koreksi absensi"
            caption={`Pengajuan koreksi absensi berstatus ${requestStatus(status).label}`}
          >
            <thead>
              <tr>
                <Th sticky>Karyawan</Th>
                <Th>Tanggal</Th>
                <Th>Waktu saat ini</Th>
                <Th>Waktu usulan</Th>
                <Th hideBelow="lg">Alasan</Th>
                <Th>Status</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {corrections.map((r) => (
                <Tr key={r.id}>
                  <Td sticky>
                    <span className="font-medium text-ink">{r.full_name}</span>
                    <p className="tabular mt-0.5 text-xs text-ink-muted">
                      {r.employee_code ?? 'Tanpa kode'}
                    </p>
                  </Td>
                  <Td className="tabular whitespace-nowrap text-ink">
                    {formatDate(r.work_date, tz)}
                  </Td>
                  <Td className="tabular text-xs whitespace-nowrap text-ink-secondary">
                    {formatTime(r.original_check_in_at, tz)}
                    <span className="mx-1 text-ink-muted" aria-label="hingga">
                      →
                    </span>
                    {r.original_check_out_at ? formatTime(r.original_check_out_at, tz) : '—'}
                  </Td>
                  <Td className="tabular text-xs whitespace-nowrap text-ink">
                    {r.requested_check_in_at ? formatTime(r.requested_check_in_at, tz) : '—'}
                    <span className="mx-1 text-ink-muted" aria-label="hingga">
                      →
                    </span>
                    {r.requested_check_out_at ? formatTime(r.requested_check_out_at, tz) : '—'}
                  </Td>
                  <Td hideBelow="lg">
                    <span
                      className="line-clamp-2 block max-w-72 text-xs leading-relaxed text-ink-secondary"
                      title={r.reason ?? undefined}
                    >
                      {r.reason ?? <span className="text-ink-muted">Tidak ada alasan</span>}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <RequestStatusBadge status={r.status} size="sm" />
                      {r.review_note && (
                        <span
                          className="line-clamp-2 max-w-56 text-2xs leading-relaxed text-ink-muted"
                          title={r.review_note}
                        >
                          “{r.review_note}”
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td align="right">
                    {r.status === 'PENDING' ? (
                      <ReviewControls
                        requestId={r.id}
                        kind="correction"
                        subject={`koreksi ${r.full_name}`}
                      />
                    ) : (
                      <span className="tabular text-2xs whitespace-nowrap text-ink-muted">
                        {r.reviewed_at ? formatDateTime(r.reviewed_at, tz) : '—'}
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-ink-muted">
        Keputusan hanya dapat diambil satu kali. Setelah statusnya final, pengajuan tidak dapat
        diubah dari dashboard — koreksi atas keputusan itu dibuat lewat pengajuan koreksi baru,
        sehingga jejaknya tetap dapat diaudit.
      </p>
    </div>
  );
}

/** Inclusive day count between two `YYYY-MM-DD` dates. */
function dayCount(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 1;
  return Math.round((b - a) / 86_400_000) + 1;
}