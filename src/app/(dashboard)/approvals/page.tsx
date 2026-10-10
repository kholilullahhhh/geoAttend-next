import Link from 'next/link';
import { Suspense } from 'react';

import { ReviewControls } from '@/components/approvals/ReviewControls';
import { LiveIndicator } from '@/components/shell/LiveIndicator';
import { Badge, LeaveTypeBadge, RequestStatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/States';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { FALLBACK_TIMEZONE } from '@/lib/brand';
import {
  DataError,
  fetchCorrections,
  fetchLeaveRequests,
  requireHrAdmin,
} from '@/lib/data';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';

export const metadata = { title: 'Persetujuan' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default async function ApprovalsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab = first(params.tab) === 'corrections' ? 'corrections' : 'leave';
  const status = first(params.status) ?? 'PENDING';
  const validStatus = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status ?? '')
    ? (status as 'PENDING')
    : 'PENDING';

  try {
    await requireHrAdmin();
  } catch (error) {
    if (error instanceof DataError) {
      return <ErrorState title="Akses ditolak" message={error.message} />;
    }
    throw error;
  }

  let leaves;
  let corrections;
  try {
    [leaves, corrections] = await Promise.all([
      fetchLeaveRequests(validStatus),
      fetchCorrections(validStatus),
    ]);
  } catch (error) {
    return (
      <ErrorState
        message={error instanceof DataError ? error.message : 'Terjadi kesalahan tak terduga.'}
      />
    );
  }

  const pendingLeave = leaves.filter((l) => l.status === 'PENDING');
  const pendingCorrections = corrections.filter((c) => c.status === 'PENDING');
  const tz = FALLBACK_TIMEZONE;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Persetujuan"
        description="Setiap keputusan dicatat pada audit log beserta alasan dan pelakunya."
        action={<LiveIndicator />}
      />

      <nav className="flex gap-2 border-b border-line" aria-label="Tab persetujuan">
        <TabLink href="/approvals?tab=leave&status=PENDING" active={tab === 'leave'}>
          Pengajuan izin
          {pendingLeave.length > 0 && (
            <Badge tone="warning" className="ml-2">
              {pendingLeave.length}
            </Badge>
          )}
        </TabLink>
        <TabLink
          href="/approvals?tab=corrections&status=PENDING"
          active={tab === 'corrections'}
        >
          Koreksi absensi
          {pendingCorrections.length > 0 && (
            <Badge tone="warning" className="ml-2">
              {pendingCorrections.length}
            </Badge>
          )}
        </TabLink>
      </nav>

      <div className="flex flex-wrap gap-2">
        {(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((s) => (
          <Link
            key={s}
            href={`/approvals?tab=${tab}&status=${s}`}
            aria-current={validStatus === s ? 'page' : undefined}
            className={`rounded-md px-md py-1.5 text-xs font-medium transition-colors ${
              validStatus === s
                ? 'bg-accent-soft text-accent-ink'
                : 'text-ink-secondary hover:bg-surface-alt'
            }`}
          >
            {
              { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan' }[
                s
              ]
            }
          </Link>
        ))}
      </div>

      <Suspense fallback={null}>
        {tab === 'leave' ? (
          <Card
            title={`Pengajuan izin · ${leaves.length} catatan`}
            description="Persetujuan membuat hari tersebut menjadi hari excused di perhitungan kehadiran."
            padded={false}
          >
            {leaves.length === 0 ? (
              <EmptyState
                title="Tidak ada pengajuan"
                description="Belum ada pengajuan izin pada status ini."
              />
            ) : (
              <TableWrap minWidth={960}>
                <thead>
                  <tr>
                    <Th>Karyawan</Th>
                    <Th>Jenis</Th>
                    <Th>Periode</Th>
                    <Th>Alasan</Th>
                    <Th>Diajukan</Th>
                    <Th>Status</Th>
                    <Th align="right">Aksi</Th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((r) => (
                    <Tr key={r.id}>
                      <Td>
                        <span className="font-medium text-ink">{r.full_name}</span>
                        <p className="text-xs text-ink-muted">{r.employee_code ?? '—'}</p>
                      </Td>
                      <Td>
                        <LeaveTypeBadge type={r.type} />
                      </Td>
                      <Td className="tabular whitespace-nowrap text-ink-secondary">
                        {formatDate(r.start_date, tz)} → {formatDate(r.end_date, tz)}
                      </Td>
                      <Td className="max-w-64">
                        <span className="line-clamp-2 text-ink-secondary">{r.reason}</span>
                      </Td>
                      <Td className="tabular whitespace-nowrap text-xs text-ink-muted">
                        {formatDateTime(r.created_at, tz)}
                      </Td>
                      <Td>
                        <RequestStatusBadge status={r.status} />
                        {r.review_note && (
                          <p className="mt-1 max-w-48 text-xs text-ink-muted">{r.review_note}</p>
                        )}
                      </Td>
                      <Td align="right">
                        {r.status === 'PENDING' ? (
                          <div className="flex justify-end">
                            <ReviewControls
                              requestId={r.id}
                              kind="leave"
                              subject={`izin ${r.full_name}`}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-ink-muted">
                            {r.reviewed_at ? formatDateTime(r.reviewed_at, tz) : '—'}
                          </span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        ) : (
          <Card
            title={`Koreksi absensi · ${corrections.length} catatan`}
            description="Menyetujui koreksi akan menghitung ulang durasi, keterlambatan, dan lembur di server."
            padded={false}
          >
            {corrections.length === 0 ? (
              <EmptyState
                title="Tidak ada koreksi"
                description="Belum ada pengajuan koreksi absensi pada status ini."
              />
            ) : (
              <TableWrap minWidth={1020}>
                <thead>
                  <tr>
                    <Th>Karyawan</Th>
                    <Th>Tanggal</Th>
                    <Th>Waktu saat ini</Th>
                    <Th>Waktu/usulan baru</Th>
                    <Th>Alasan</Th>
                    <Th>Status</Th>
                    <Th align="right">Aksi</Th>
                  </tr>
                </thead>
                <tbody>
                  {corrections.map((r) => (
                    <Tr key={r.id}>
                      <Td>
                        <span className="font-medium text-ink">{r.full_name}</span>
                        <p className="text-xs text-ink-muted">{r.employee_code ?? '—'}</p>
                      </Td>
                      <Td className="tabular whitespace-nowrap">
                        {formatDate(r.work_date, tz)}
                      </Td>
                      <Td className="tabular whitespace-nowrap text-ink-secondary">
                        {formatTime(r.original_check_in_at, tz)}
                        {' → '}
                        {r.original_check_out_at ? formatTime(r.original_check_out_at, tz) : '—'}
                      </Td>
                      <Td className="tabular whitespace-nowrap text-ink">
                        {r.requested_check_in_at ? formatTime(r.requested_check_in_at, tz) : '—'}
                        {' → '}
                        {r.requested_check_out_at
                          ? formatTime(r.requested_check_out_at, tz)
                          : '—'}
                      </Td>
                      <Td className="max-w-64">
                        <span className="line-clamp-2 text-ink-secondary">
                          {r.reason ?? '—'}
                        </span>
                      </Td>
                      <Td>
                        <RequestStatusBadge status={r.status} />
                        {r.review_note && (
                          <p className="mt-1 max-w-48 text-xs text-ink-muted">{r.review_note}</p>
                        )}
                      </Td>
                      <Td align="right">
                        {r.status === 'PENDING' ? (
                          <div className="flex justify-end">
                            <ReviewControls
                              requestId={r.id}
                              kind="correction"
                              subject={`koreksi ${r.full_name}`}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-ink-muted">
                            {r.reviewed_at ? formatDateTime(r.reviewed_at, tz) : '—'}
                          </span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        )}
      </Suspense>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`-mb-px border-b-2 px-md py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-accent text-ink'
          : 'border-transparent text-ink-secondary hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}