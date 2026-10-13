import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, History } from 'lucide-react';

import { EvidencePhoto } from '@/components/attendance/EvidencePhoto';
import { GeofenceDiagram } from '@/components/attendance/GeofenceDiagram';
import { RiskFlags } from '@/components/attendance/RiskFlags';
import { AttendanceStatusBadge, Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  InlineNotice,
  PageHeader,
  PermissionState,
} from '@/components/ui/States';
import { KeyValueGrid } from '@/components/ui/StatCard';
import { FALLBACK_TIMEZONE } from '@/lib/brand';
import {
  DataError,
  fetchAttendanceDetail,
  fetchAuditTrail,
  fetchOffices,
  requireHrAdmin,
} from '@/lib/data';
import { createEvidenceUrl } from '@/lib/evidence';
import {
  formatCoord,
  formatDate,
  formatDateTime,
  formatDistance,
  formatDuration,
  formatRelative,
  formatTime,
} from '@/lib/format';

export const metadata = { title: 'Detail Absensi' };
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await requireHrAdmin();
  } catch (error) {
    if (error instanceof DataError) {
      return <PermissionState title="Akses ditolak" message={error.message} />;
    }
    throw error;
  }

  // A malformed UUID would make PostgREST raise a 22P02 error; treat it as 404.
  if (!UUID_RE.test(id)) notFound();

  let record;
  let audit;
  let offices;
  try {
    [record, audit, offices] = await Promise.all([
      fetchAttendanceDetail(id),
      fetchAuditTrail(id),
      fetchOffices(),
    ]);
  } catch (error) {
    return (
      <ErrorState
        message={error instanceof DataError ? error.message : 'Terjadi kesalahan tak terduga.'}
      />
    );
  }

  // RLS returned nothing: either the id does not exist, or the caller is not
  // allowed to see it. Both must be indistinguishable to the client.
  if (!record) notFound();

  const tz = FALLBACK_TIMEZONE;
  const [checkInPhoto, checkOutPhoto] = await Promise.all([
    createEvidenceUrl(record.check_in_photo_path),
    createEvidenceUrl(record.check_out_photo_path),
  ]);

  const office = offices.find((o) => o.id === record.office_location_id) ?? null;
  const workDate = formatDate(record.work_date, tz);

  return (
    <div className="flex flex-col gap-lg">
      <Breadcrumbs
        items={[
          { label: 'Beranda', href: '/' },
          { label: 'Absensi', href: '/attendance' },
          { label: `${record.full_name} · ${workDate}` },
        ]}
      />

      <PageHeader
        title={record.full_name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="tabular">{record.employee_code ?? 'Tanpa kode karyawan'}</span>
            <span aria-hidden="true">·</span>
            <span>{workDate}</span>
            <span aria-hidden="true">·</span>
            <span>{record.office_name ?? 'Tanpa lokasi kantor'}</span>
          </span>
        }
        action={
          <>
            <AttendanceStatusBadge status={record.status} />
            {record.is_late && (
              <Badge tone="warning">Terlambat {record.late_minutes} menit</Badge>
            )}
            {record.source === 'MANUAL' && <Badge tone="info">Diinput manual HRD</Badge>}
            {record.review_required && <Badge tone="danger">Perlu ditinjau</Badge>}
          </>
        }
      />

      {record.review_required && (
        <InlineNotice
          tone="danger"
          title="Catatan ini ditandai untuk ditinjau."
          message="Backend menandai absensi ini berdasarkan aturan risiko. Tanda tersebut adalah sinyal untuk diperiksa manusia, bukan bukti bahwa karyawan melanggar kebijakan — GPS pada perangkat umum tidak dapat membuktikan keaslian lokasi secara mutlak."
          action={
            (record.risk_flags ?? []).length > 0 ? (
              <RiskFlags flags={record.risk_flags} reviewRequired={false} size="md" />
            ) : undefined
          }
        />
      )}

      {(record.risk_flags ?? []).length > 0 && !record.review_required && (
        <InlineNotice
          tone="warning"
          title="Catatan risiko terdeteksi."
          message="Aturan backend menandai hal-hal berikut pada catatan ini. Periksa sebelum mengambil keputusan."
          action={<RiskFlags flags={record.risk_flags} reviewRequired={false} size="md" />}
        />
      )}

      <div className="grid grid-cols-1 gap-lg xl:grid-cols-3">
        <div className="flex flex-col gap-lg xl:col-span-2">
          <Card
            title="Waktu kerja"
            description="Waktu server adalah sumber kebenaran. Waktu perangkat hanya informasi pendukung."
          >
            <KeyValueGrid
              columns={4}
              items={[
                { label: 'Check-in', value: formatTime(record.check_in_at, tz), mono: true },
                {
                  label: 'Check-out',
                  value: record.check_out_at ? formatTime(record.check_out_at, tz) : 'Belum check-out',
                  mono: true,
                },
                {
                  label: 'Durasi kerja',
                  value: record.check_out_at
                    ? formatDuration(record.worked_minutes)
                    : 'Masih berjalan',
                  mono: true,
                },
                { label: 'Lembur', value: formatDuration(record.overtime_minutes), mono: true },
                { label: 'Istirahat', value: formatDuration(record.break_minutes), mono: true },
                {
                  label: 'Keterlambatan',
                  value: record.is_late ? `${record.late_minutes} menit` : 'Tepat waktu',
                },
                { label: 'Shift', value: record.shift_name ?? 'Tidak ada shift' },
                {
                  label: 'Sumber data',
                  value: record.source === 'MANUAL' ? 'Manual HRD' : 'Aplikasi mobile',
                },
              ]}
            />

            {record.note && (
              <p className="mt-lg rounded-md border-l-3 border-accent-bright bg-surface-alt px-md py-2.5 text-sm leading-relaxed text-ink-secondary">
                <span className="font-medium text-ink">Catatan: </span>
                {record.note}
              </p>
            )}
          </Card>

          <Card
            title="Lokasi dan geofence"
            description="Koordinat, akurasi, dan jarak dihitung ulang oleh server saat pengiriman — bukan oleh perangkat."
          >
            <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
              <KeyValueGrid
                columns={2}
                className="content-start"
                items={[
                  { label: 'Latitude', value: formatCoord(record.check_in_latitude), mono: true },
                  { label: 'Longitude', value: formatCoord(record.check_in_longitude), mono: true },
                  {
                    label: 'Akurasi GPS',
                    value:
                      record.check_in_accuracy_m != null
                        ? `±${Math.round(record.check_in_accuracy_m)} m`
                        : 'Tidak dilaporkan',
                    mono: true,
                  },
                  {
                    label: 'Jarak ke kantor',
                    value: formatDistance(record.check_in_distance_m),
                    mono: true,
                  },
                ]}
              />

              {office ? (
                <GeofenceDiagram
                  officeName={office.name}
                  officeLat={office.latitude}
                  officeLon={office.longitude}
                  radiusMeters={office.radius_meters}
                  checkInLat={record.check_in_latitude}
                  checkInLon={record.check_in_longitude}
                  distanceMeters={record.check_in_distance_m}
                  accuracyMeters={record.check_in_accuracy_m}
                />
              ) : (
                <p className="self-center rounded-md border border-dashed border-line-strong bg-surface-alt px-md py-lg text-center text-sm text-ink-muted">
                  Catatan ini tidak tertaut ke titik kantor, sehingga diagram geofence tidak dapat
                  digambar.
                </p>
              )}
            </div>

            {record.check_out_at && (
              <div className="mt-lg border-t border-line pt-lg">
                <h3 className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                  Lokasi check-out
                </h3>
                <KeyValueGrid
                  columns={4}
                  className="mt-3"
                  items={[
                    {
                      label: 'Latitude',
                      value: formatCoord(record.check_out_latitude),
                      mono: true,
                    },
                    {
                      label: 'Longitude',
                      value: formatCoord(record.check_out_longitude),
                      mono: true,
                    },
                    {
                      label: 'Akurasi',
                      value:
                        record.check_out_accuracy_m != null
                          ? `±${Math.round(record.check_out_accuracy_m)} m`
                          : '—',
                      mono: true,
                    },
                    {
                      label: 'Jarak ke kantor',
                      value: formatDistance(record.check_out_distance_m),
                      mono: true,
                    },
                  ]}
                />
              </div>
            )}

            {office && (
              <div className="mt-lg rounded-md border border-line px-md py-3">
                <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                  Titik acuan kantor
                </p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {office.name}
                  <span className="tabular ml-2 font-normal text-ink-muted">
                    radius {office.radius_meters.toLocaleString('id-ID')} m
                  </span>
                </p>
                <p className="tabular mt-0.5 text-xs text-ink-muted">
                  {formatCoord(office.latitude)}, {formatCoord(office.longitude)}
                  {office.address ? ` · ${office.address}` : ''}
                </p>
                {/*
                  Deliberately a link, not an embedded map. Loading map tiles
                  would transmit an employee's precise location to a third party
                  on every page view; here nothing leaves the browser until the
                  reviewer actively asks for it. That makes data minimisation a
                  product behaviour rather than only a policy document.
                */}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${record.check_in_latitude}&mlon=${record.check_in_longitude}#map=18/${record.check_in_latitude}/${record.check_in_longitude}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
                >
                  Buka koordinat di peta OpenStreetMap
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </div>
            )}
          </Card>

          <Card
            title="Riwayat perubahan"
            description="Setiap perubahan status tercatat pada audit log, termasuk pelakunya."
            padded={false}
          >
            {audit.length === 0 ? (
              <EmptyState
                compact
                title="Belum ada perubahan"
                description="Catatan ini dibuat sekali dan belum pernah dimodifikasi sejak check-in tercatat."
              />
            ) : (
              <ol className="flex flex-col gap-0 p-lg">
                {audit.map((entry, i) => (
                  <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {/*
                      The connector is drawn behind the dot and only between
                      items, so the last entry has no dangling line — the small
                      thing that makes a timeline read as finished rather than
                      truncated.
                    */}
                    {i < audit.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-3 bottom-0 left-[5px] w-px bg-line"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-pill bg-ink-muted ring-3 ring-surface"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <span className="font-medium">{humanAction(entry.action)}</span>
                        <span className="text-ink-muted">
                          {' '}
                          oleh {entry.actor_name ?? 'Sistem'}
                        </span>
                      </p>
                      <p className="tabular mt-0.5 text-xs text-ink-muted">
                        {formatDateTime(entry.created_at, tz)} · {formatRelative(entry.created_at)}
                      </p>
                      {hasDiff(entry) && (
                        <details className="mt-1.5 group">
                          <summary className="inline-block cursor-pointer list-none py-0.5 coarse:py-3 text-xs font-medium text-accent-ink hover:underline">
                            <span className="group-open:hidden">Lihat perubahan</span>
                            <span className="hidden group-open:inline">Tutup perubahan</span>
                          </summary>
                          <pre className="mt-1.5 max-h-56 overflow-auto rounded-md border border-line bg-surface-alt p-md font-mono text-2xs leading-relaxed whitespace-pre-wrap text-ink-secondary">
                            {JSON.stringify(
                              { sebelum: entry.before_data, sesudah: entry.after_data },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-lg">
          <Card
            title="Bukti foto"
            description="Foto disimpan pada bucket privat dan diakses lewat tautan bertanda tangan berumur 5 menit."
          >
            <div className="grid grid-cols-2 gap-md">
              <EvidencePhoto
                src={checkInPhoto}
                alt={`Foto selfie check-in ${record.full_name} pada ${workDate}`}
                caption="Check-in"
              />
              <EvidencePhoto
                src={checkOutPhoto}
                alt={`Foto bukti check-out ${record.full_name} pada ${workDate}`}
                caption={record.check_out_at ? 'Check-out' : 'Check-out (belum ada)'}
                expiredNote="Tidak ada foto check-out yang tersimpan."
              />
            </div>
          </Card>

          <Card title="Asal data" description="Metadata pengajuan dan pencatatan.">
            <KeyValueGrid
              columns={2}
              items={[
                { label: 'Dibuat', value: formatDateTime(record.created_at, tz), mono: true },
                { label: 'Diperbarui', value: formatDateTime(record.updated_at, tz), mono: true },
                {
                  label: 'Selisih jam perangkat',
                  value:
                    record.device_time_skew_seconds != null
                      ? `${record.device_time_skew_seconds} detik`
                      : 'Tidak dilaporkan',
                  mono: true,
                },
                {
                  label: 'Check-out dikoreksi HRD',
                  value: record.check_out_corrected ? 'Ya' : 'Tidak',
                },
                {
                  label: 'ID perangkat',
                  value: record.device_id ?? 'Tidak tersimpan',
                  mono: true,
                },
              ]}
            />
            <p className="mt-lg border-t border-line pt-md text-xs leading-relaxed text-ink-muted">
              Waktu perangkat hanya menjadi informasi pendukung. Seluruh perhitungan keterlambatan
              dan durasi memakai waktu server.
            </p>
          </Card>

          <Card title="Tautan" padded>
            <div className="flex flex-col gap-2">
              <Link
                href="/attendance"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink no-underline transition-colors hover:bg-surface-alt"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Kembali ke daftar absensi
              </Link>
              {record.employee_code && (
                <Link
                  href={`/attendance?q=${encodeURIComponent(record.employee_code)}`}
                  className="inline-flex h-10 items-center gap-2 rounded-md px-3.5 text-sm font-medium text-ink-secondary no-underline transition-colors hover:bg-surface-alt hover:text-ink"
                >
                  <History className="size-4" aria-hidden="true" />
                  Semua absensi karyawan ini
                </Link>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function hasDiff(entry: { before_data: unknown; after_data: unknown }): boolean {
  return entry.before_data !== null || entry.after_data !== null;
}

/**
 * Audit actions as prose.
 *
 * `write_audit_log` stores dotted machine identifiers such as
 * `leave.reviewed`. Shown raw they read as an error code; shown as a sentence
 * they read as a history entry.
 */
function humanAction(action: string): string {
  const [entity, verb] = action.split('.');
  const verbs: Record<string, string> = {
    created: 'Dicatat',
    updated: 'Diperbarui',
    reviewed: 'Ditinjau',
    corrected: 'Dikoreksi',
    cancelled: 'Dibatalkan',
    deleted: 'Dihapus',
  };
  const entities: Record<string, string> = {
    attendance: 'absensi',
    attendance_record: 'absensi',
    attendance_correction: 'koreksi absensi',
    correction: 'koreksi absensi',
    leave_request: 'pengajuan izin',
    leave: 'pengajuan izin',
    profile: 'data karyawan',
    employee: 'data karyawan',
  };
  const verbLabel = verbs[verb ?? ''] ?? verb?.replace(/_/g, ' ') ?? action;
  const entityLabel = entities[entity ?? ''] ?? entity?.replace(/_/g, ' ') ?? '';
  return entityLabel ? `${verbLabel} ${entityLabel}` : `${verbLabel} (${action})`;
}