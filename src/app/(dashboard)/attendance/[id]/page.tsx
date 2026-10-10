import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, ShieldAlert } from 'lucide-react';

import { EvidencePhoto } from '@/components/attendance/EvidencePhoto';
import { AttendanceStatusBadge, Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/States';
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
      return <ErrorState title="Akses ditolak" message={error.message} />;
    }
    throw error;
  }

  // A malformed UUID would make PostgREST raise a 22P02 error; treat it as 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

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

  return (
    <div className="flex flex-col gap-lg">
      <Link
        href="/attendance"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Kembali ke daftar absensi
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{record.full_name}</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {record.employee_code ?? 'Tanpa kode'} · {formatDate(record.work_date, tz)} ·{' '}
            {record.office_name ?? 'Tanpa lokasi'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AttendanceStatusBadge status={record.status} />
          {record.is_late && <Badge tone="warning">Terlambat {record.late_minutes} menit</Badge>}
          {record.source === 'MANUAL' && <Badge tone="info">Diinput manual HRD</Badge>}
        </div>
      </div>

      {record.review_required && (
        <div
          role="status"
          className="flex items-start gap-md rounded-md border border-danger/30 bg-danger-soft px-lg py-md"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium text-danger">Catatan ini ditandai untuk ditinjau</p>
            <p className="mt-0.5 text-danger/90">
              Backend menandai absensi ini berdasarkan aturan risiko. Tanda tersebut adalah
              sinyal untuk diperiksa manusia, bukan bukti bahwa karyawan melanggar
              kebijakan. GPS pada perangkat umum tidak dapat membuktikan keaslian lokasi
              secara mutlak.{' '}
              {(record.risk_flags ?? []).length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {(record.risk_flags ?? []).map((f) => (
                    <Badge key={f} tone="danger">
                      {RISK_LABEL[f] ?? f}
                    </Badge>
                  ))}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-lg xl:grid-cols-3">
        <div className="flex flex-col gap-lg xl:col-span-2">
          <Card title="Waktu kerja" description="Waktu server adalah sumber kebenaran.">
            <dl className="grid grid-cols-2 gap-md sm:grid-cols-4">
              <Fact label="Check-in" value={formatTime(record.check_in_at, tz)} />
              <Fact label="Check-out" value={record.check_out_at ? formatTime(record.check_out_at, tz) : 'Belum'} />
              <Fact label="Durasi kerja" value={record.check_out_at ? formatDuration(record.worked_minutes) : 'Berjalan'} />
              <Fact label="Lembur" value={formatDuration(record.overtime_minutes)} />
              <Fact label="Istirahat" value={formatDuration(record.break_minutes)} />
              <Fact label="Keterlambatan" value={record.is_late ? `${record.late_minutes} menit` : 'Tepat waktu'} />
              <Fact label="Shift" value={record.shift_name ?? '—'} />
              <Fact label="Sumber" value={record.source === 'MANUAL' ? 'Manual HRD' : 'Aplikasi'} />
            </dl>

            {record.note && (
              <p className="mt-lg rounded-md bg-surface-alt px-md py-sm text-sm text-ink-secondary">
                Catatan: {record.note}
              </p>
            )}
          </Card>

          <Card
            title="Lokasi check-in"
            description="Koordinat, akurasi, dan jarak dihitung ulang oleh server saat pengiriman."
          >
            <dl className="grid grid-cols-2 gap-md sm:grid-cols-4">
              <Fact label="Latitude" value={formatCoord(record.check_in_latitude)} mono />
              <Fact label="Longitude" value={formatCoord(record.check_in_longitude)} mono />
              <Fact label="Akurasi GPS" value={`${Math.round(record.check_in_accuracy_m ?? 0)} m`} />
              <Fact label="Jarak ke kantor" value={formatDistance(record.check_in_distance_m)} />
            </dl>

            {office && (
              <div className="mt-lg rounded-md border border-line px-md py-3">
                <p className="text-xs font-medium text-ink-secondary">Titik acuan kantor</p>
                <p className="mt-1 text-sm text-ink">
                  {office.name} · radius {office.radius_meters} m
                </p>
                <p className="tabular mt-0.5 text-xs text-ink-muted">
                  {formatCoord(office.latitude)}, {formatCoord(office.longitude)}
                  {office.address ? ` · ${office.address}` : ''}
                </p>
                {/*
                  External map tiles would transmit an employee's precise location to a
                  third party on every page load. Instead the map opens only on an
                  explicit click, which keeps data minimisation a product behaviour
                  rather than only a policy document.
                */}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${record.check_in_latitude}&mlon=${record.check_in_longitude}#map=18/${record.check_in_latitude}/${record.check_in_longitude}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline"
                >
                  Buka koordinat di peta OpenStreetMap
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </div>
            )}

            {record.check_out_at && (
              <dl className="mt-lg grid grid-cols-2 gap-md border-t border-line pt-md sm:grid-cols-4">
                <Fact
                  label="Latitude (out)"
                  value={formatCoord(record.check_out_latitude)}
                  mono
                />
                <Fact
                  label="Longitude (out)"
                  value={formatCoord(record.check_out_longitude)}
                  mono
                />
                <Fact
                  label="Akurasi (out)"
                  value={
                    record.check_out_accuracy_m != null
                      ? `${Math.round(record.check_out_accuracy_m)} m`
                      : '—'
                  }
                />
                <Fact
                  label="Jarak (out)"
                  value={formatDistance(record.check_out_distance_m)}
                />
              </dl>
            )}
          </Card>

          <Card title="Riwayat perubahan" description="Setiap perubahan status tercatat di audit log.">
            {audit.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Belum ada perubahan tercatat untuk absensi ini.
              </p>
            ) : (
              <ol className="flex flex-col gap-md">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex gap-md">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-pill bg-ink-muted"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        <span className="font-medium">{entry.action}</span>
                        <span className="text-ink-muted"> oleh {entry.actor_name ?? 'Sistem'}</span>
                      </p>
                      <p className="tabular text-xs text-ink-muted">
                        {formatDateTime(entry.created_at, tz)} · {formatRelative(entry.created_at)}
                      </p>
                      {hasDiff(entry) && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-ink-secondary">
                            Lihat perubahan
                          </summary>
                          <pre className="mt-1 max-h-56 overflow-auto rounded-sm bg-surface-alt p-md text-xs whitespace-pre-wrap text-ink-secondary">
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
          <Card title="Bukti foto" description="Tautan bertanda tangan berlaku 5 menit.">
            <div className="flex gap-lg">
              <EvidencePhoto
                src={checkInPhoto}
                alt={`Foto selfie check-in ${record.full_name} pada ${formatDate(record.work_date, tz)}`}
                caption="Check-in"
              />
              {record.check_out_at && (
                <EvidencePhoto
                  src={checkOutPhoto}
                  alt={`Foto selfie check-out ${record.full_name} pada ${formatDate(record.work_date, tz)}`}
                  caption="Check-out"
                />
              )}
            </div>
          </Card>

          <Card title="Provenance" description="Metadata pengajuan dan pencatatan.">
            <dl className="flex flex-col gap-md">
              <Fact label="Dibuat" value={formatDateTime(record.created_at, tz)} small />
              <Fact label="Diperbarui" value={formatDateTime(record.updated_at, tz)} small />
              <Fact
                label="Selisih jam perangkat"
                value={
                  record.device_time_skew_seconds != null
                    ? `${record.device_time_skew_seconds} detik`
                    : '—'
                }
                small
              />
              <Fact label="Check-out dikoreksi HRD" value={record.check_out_corrected ? 'Ya' : 'Tidak'} small />
              <Fact label="ID perangkat" value={record.device_id ?? '—'} small mono />
            </dl>
            <p className="mt-md border-t border-line pt-md text-xs text-ink-muted">
              Waktu perangkat hanya menjadi informasi pendukung. Seluruh perhitungan
              keterlambatan dan durasi memakai waktu server.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

const RISK_LABEL: Record<string, string> = {
  LOW_ACCURACY: 'Akurasi GPS di ambang batas',
  OUT_OF_RADIUS: 'Di luar radius geofence',
  IMPOSSIBLE_TRAVEL: 'Perindahan terlalu cepat untuk jaraknya',
  DEVICE_TIME_MISMATCH: 'Jam perangkat berbeda dari waktu server',
  DUPLICATE_DEVICE: 'Perangkat yang sama dipakai lebih dari satu akun',
};

function Fact({
  label,
  value,
  mono = false,
  small = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className={`text-ink-muted ${small ? 'text-xs' : 'text-xs font-medium'}`}>{label}</dt>
      <dd
        className={`mt-0.5 truncate text-ink ${small ? 'text-sm' : 'text-base font-medium'} ${mono ? 'tabular' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

function hasDiff(entry: { before_data: unknown; after_data: unknown }): boolean {
  return entry.before_data !== null || entry.after_data !== null;
}