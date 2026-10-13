import { redirect } from 'next/navigation';
import { Building2, CalendarOff, Clock, Info, MapPin } from 'lucide-react';

import { Badge, MetaBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  InlineNotice,
  PageHeader,
  PermissionState,
} from '@/components/ui/States';
import { KeyValueGrid, Metric, MetricGrid } from '@/components/ui/StatCard';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { tableMinWidth } from '@/lib/design';
import {
  DataError,
  fetchHolidays,
  fetchOffices,
  fetchOrgSettings,
  fetchShifts,
  getViewer,
} from '@/lib/data';
import { formatCoord, formatDate, formatTimeOfDay, formatWorkDays } from '@/lib/format';

export const metadata = { title: 'Pengaturan' };
export const dynamic = 'force-dynamic';

/**
 * Reference data.
 *
 * Offices, shifts, holidays and organisation settings are administered through
 * Supabase Studio or a versioned migration. This page is intentionally
 * read-only, and says so: these values decide who can check in and whether a
 * record counts as late, so an ad-hoc web form would leave no reviewable
 * history behind a change that affects payroll. Every value shown is live
 * database state, read through RLS — not a cached or illustrative copy.
 */
export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer.role !== 'ADMIN') {
    return (
      <PermissionState
        title="Akses dibatasi"
        message="Hanya Administrator yang dapat melihat pengaturan sistem. Akun HRD dapat melihat absensi dan persetujuan, tetapi konfigurasi titik kantor, shift, dan hari libur dibatasi untuk Administrator."
      />
    );
  }

  let offices;
  let shifts;
  let holidays;
  let org;
  try {
    [offices, shifts, holidays, org] = await Promise.all([
      fetchOffices(),
      fetchShifts(),
      fetchHolidays(),
      fetchOrgSettings(),
    ]);
  } catch (error) {
    return (
      <ErrorState
        message={error instanceof DataError ? error.message : 'Terjadi kesalahan tak terduga.'}
      />
    );
  }

  const activeOffices = offices.filter((o) => o.is_active).length;

  /*
   * Offices whose accuracy gate differs from the organisation default.
   *
   * `effective_max_accuracy()` in migration 200 is a plain `coalesce`, so a
   * per-office value *replaces* the default rather than intersecting with it --
   * meaning a site configured at 200 m genuinely accepts a worse fix than the
   * organisation's 50 m, with nothing on the page saying so.
   */
  const overriddenOffices = org
    ? offices.filter(
        (o) =>
          o.max_accuracy_meters != null &&
          Number(o.max_accuracy_meters) !== Number(org.max_location_accuracy_m),
      )
    : [];
  const activeShifts = shifts.filter((s) => s.is_active).length;
  const activeHolidays = holidays.filter((h) => h.is_active).length;
  const upcomingHolidays = holidays.filter((h) => h.is_active && h.holiday_date >= todayIso()).length;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        eyebrow={<Breadcrumbs items={[{ label: 'Beranda', href: '/' }, { label: 'Pengaturan' }]} />}
        title="Pengaturan Sistem"
        description="Titik kantor, shift, hari libur, dan konfigurasi organisasi yang dipakai validasi geofence serta perhitungan jadwal."
      />

      <InlineNotice
        tone="neutral"
        title="Halaman baca saja."
        message="Nilai di bawah ini dibaca langsung dari database dan menentukan siapa yang boleh check-in serta bagaimana keterlambatan dihitung. Perubahan dilakukan melalui Supabase Studio atau migrasi berversi, sehingga selalu meninggalkan jejak yang dapat ditinjau — bukan melalui formulir web yang tidak berhistoris."
      />

      <MetricGrid>
        <Metric
          label="Lokasi kantor"
          value={`${activeOffices}/${offices.length}`}
          sub="Aktif dari total terdaftar"
          icon={<MapPin className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Shift"
          value={`${activeShifts}/${shifts.length}`}
          sub="Aktif dari total terdaftar"
          icon={<Clock className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Hari libur"
          value={holidays.length.toLocaleString('id-ID')}
          sub={`${activeHolidays} aktif · ${upcomingHolidays} akan datang`}
          icon={<CalendarOff className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Akurasi GPS maksimum"
          value={org ? `${Math.round(org.max_location_accuracy_m)} m` : '—'}
          sub="Batas default organisasi"
          tone={org && org.max_location_accuracy_m <= 50 ? 'success' : 'warning'}
        />
        <Metric
          label="Check-in di luar radius"
          value={org ? (org.allow_out_of_radius ? 'Diizinkan' : 'Ditolak') : '—'}
          sub="Bila diizinkan, tetap ditandai risiko"
          tone={org?.allow_out_of_radius ? 'warning' : 'success'}
        />
        <Metric
          label="Retensi foto"
          value={org ? `${org.photo_retention_days} hari` : '—'}
          sub={
            org && org.photo_retention_days === 0
              ? 'Penjadwalan penghapusan dimatikan'
              : 'Setelah itu foto dihapus permanen'
          }
        />
      </MetricGrid>

      {/*
        An override *replaces* the organisation default rather than tightening
        it, so a per-office number is easy to set and hard to notice. Naming the
        differing offices is what turns "my setting saved" into "I can see which
        sites enforce this".
      */}
      {overriddenOffices.length > 0 && (
        <InlineNotice
          tone="warning"
          title={`${overriddenOffices.length} lokasi memakai batas akurasi sendiri`}
          message="Override per lokasi menggantikan default organisasi, bukan memperketatnya. Lokasi berikut menerima toleransi GPS yang berbeda dari perusahaan."
          action={
            <span className="text-xs text-ink-muted">
              {overriddenOffices
                .map((o) => `${o.name} (${Math.round(Number(o.max_accuracy_meters))} m)`)
                .join(', ')}
            </span>
          }
        />
      )}

      {org && (
        <Card
          title="Organisasi"
          description="Baris tunggal `organization_settings` yang dipakai bersama oleh aplikasi mobile dan server."
          action={
            <span className="tabular text-2xs text-ink-muted">
              diperbarui {formatDate(org.updated_at.slice(0, 10))}
            </span>
          }
        >
          <KeyValueGrid
            columns={4}
            items={[
              { label: 'Nama perusahaan', value: org.company_name },
              { label: 'Zona waktu', value: org.timezone, mono: true },
              {
                label: 'Akurasi GPS maksimum',
                value: `${Math.round(org.max_location_accuracy_m)} m`,
                mono: true,
              },
              {
                label: 'Check-in di luar radius',
                value: org.allow_out_of_radius ? 'Diizinkan (dan ditandai)' : 'Ditolak',
              },
              { label: 'Retensi foto', value: `${org.photo_retention_days} hari`, mono: true },
              {
                label: 'Batas ukuran foto',
                value: `${(org.max_photo_bytes / 1_048_576).toFixed(1)} MB`,
                mono: true,
              },
            ]}
          />
          <p className="mt-lg flex items-start gap-2 border-t border-line pt-md text-xs leading-relaxed text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Setiap lokasi dapat menimpa batas akurasi dan kebijakan luar-radius di tabel di bawah.
            Override <span className="font-medium text-ink-secondary">menggantikan</span> default
            organisasi, bukan memperketatkannya — jadi nilai per lokasi yang lebih longgar akan
            benar-benar berlaku.
          </p>
        </Card>
      )}

      <Card
        title="Lokasi kantor"
        description="Radius menentukan apakah check-in dihitung di dalam atau di luar area; akurasi maksimum menolak fix GPS yang terlalu kasar."
        padded={false}
      >
        {offices.length === 0 ? (
          <EmptyState
            title="Belum ada lokasi"
            description="Tambahkan titik kantor terlebih dahulu. Tanpa lokasi, tidak ada check-in yang dapat divalidasi terhadap geofence."
          />
        ) : (
          <TableWrap
            minWidth={tableMinWidth.default}
            label="Daftar lokasi kantor"
            caption="Titik kantor, koordinat, radius, dan kebijakan geofence"
          >
            <thead>
              <tr>
                <Th sticky>Lokasi</Th>
                <Th>Koordinat</Th>
                <Th align="right">Radius</Th>
                <Th align="right" hideBelow="md">
                  Akurasi maks.
                </Th>
                <Th hideBelow="lg">Di luar radius</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {offices.map((o) => (
                <Tr key={o.id}>
                  <Td sticky>
                    <span className="font-medium text-ink">{o.name}</span>
                    <p className="tabular mt-0.5 text-xs text-ink-muted">{o.code}</p>
                    {o.address && (
                      <p className="mt-0.5 text-2xs text-ink-muted">{o.address}</p>
                    )}
                  </Td>
                  <Td className="tabular text-xs whitespace-nowrap text-ink-secondary">
                    {formatCoord(o.latitude)}
                    <span className="mx-1 text-ink-muted">,</span>
                    {formatCoord(o.longitude)}
                  </Td>
                  <Td align="right" className="tabular whitespace-nowrap">
                    {o.radius_meters.toLocaleString('id-ID')} m
                  </Td>
                  <Td align="right" hideBelow="md" className="tabular whitespace-nowrap">
                    {o.max_accuracy_meters != null ? (
                      `${Math.round(o.max_accuracy_meters)} m`
                    ) : (
                      <span className="text-ink-muted">Ikut default</span>
                    )}
                  </Td>
                  <Td hideBelow="lg">
                    {o.allow_out_of_radius === null ? (
                      <MetaBadge>Ikut default</MetaBadge>
                    ) : o.allow_out_of_radius ? (
                      <Badge tone="warning" size="sm">
                        Diizinkan (ditandai)
                      </Badge>
                    ) : (
                      <Badge tone="success" size="sm">
                        Ditolak
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    {o.is_active ? (
                      <Badge tone="success" size="sm">
                        Aktif
                      </Badge>
                    ) : (
                      <MetaBadge>Nonaktif</MetaBadge>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card
        title="Shift"
        description="Waktu mulai, selesai, masa tenggang, dan durasi kerja target. Shift lintas tengah malam ditandai secara eksplisit."
        padded={false}
      >
        {shifts.length === 0 ? (
          <EmptyState
            title="Belum ada shift"
            description="Tambahkan shift terlebih dahulu. Tanpa shift, tidak ada yang dijadwalkan dan tidak ada toleransi keterlambatan yang berlaku."
          />
        ) : (
          <TableWrap
            minWidth={tableMinWidth.default}
            label="Daftar shift"
            caption="Shift beserta jam kerja, hari kerja, dan parameter perhitungan"
          >
            <thead>
              <tr>
                <Th sticky>Shift</Th>
                <Th>Jam</Th>
                <Th hideBelow="md">Hari kerja</Th>
                <Th align="right" hideBelow="lg">
                  Istirahat
                </Th>
                <Th align="right">Masa tenggang</Th>
                <Th align="right" hideBelow="lg">
                  Target
                </Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <Tr key={s.id}>
                  <Td sticky>
                    <span className="font-medium text-ink">{s.name}</span>
                    <p className="tabular mt-0.5 text-xs text-ink-muted">{s.code}</p>
                  </Td>
                  <Td>
                    <span className="tabular text-xs whitespace-nowrap text-ink-secondary">
                      {formatTimeOfDay(s.start_time)} – {formatTimeOfDay(s.end_time)}
                    </span>
                    {s.crosses_midnight && (
                      <Badge tone="info" size="sm" className="mt-1">
                        lintas tengah malam
                      </Badge>
                    )}
                  </Td>
                  <Td hideBelow="md" className="text-xs text-ink-secondary">
                    {formatWorkDays(s.work_days)}
                  </Td>
                  <Td align="right" hideBelow="lg" className="tabular whitespace-nowrap">
                    {s.break_minutes}m
                  </Td>
                  <Td align="right" className="tabular whitespace-nowrap">
                    {s.grace_late_minutes}m
                  </Td>
                  <Td align="right" hideBelow="lg" className="tabular whitespace-nowrap">
                    {Math.floor(s.target_minutes / 60)}j {s.target_minutes % 60}m
                  </Td>
                  <Td>
                    {s.is_active ? (
                      <Badge tone="success" size="sm">
                        Aktif
                      </Badge>
                    ) : (
                      <MetaBadge>Nonaktif</MetaBadge>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card
        title="Hari libur"
        description="Tanggal tanpa(check-in) wajib shift. Cakupan kosong berarti berlaku untuk seluruh perusahaan."
        padded={false}
      >
        {holidays.length === 0 ? (
          <EmptyState
            title="Belum ada hari libur"
            description="Tidak ada hari libur yang terdaftar. Tambahkan melalui migrasi bila perusahaan memiliki hari libur."
          />
        ) : (
          <TableWrap
            minWidth={tableMinWidth.compact}
            label="Daftar hari libur"
            caption="Hari libur beserta cakupan lokasi dan status"
          >
            <thead>
              <tr>
                <Th sticky>Tanggal</Th>
                <Th>Nama</Th>
                <Th hideBelow="md">Cakupan</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <Tr key={h.id}>
                  <Td sticky className="tabular whitespace-nowrap text-ink">
                    {formatDate(h.holiday_date)}
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2 text-sm text-ink">
                      <CalendarOff className="size-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                      {h.name}
                    </span>
                  </Td>
                  <Td hideBelow="md" className="text-xs text-ink-secondary">
                    {h.office_location_id
                      ? (offices.find((o) => o.id === h.office_location_id)?.name ??
                        'Lokasi tidak ditemukan')
                      : 'Seluruh perusahaan'}
                  </Td>
                  <Td>
                    {h.is_active ? (
                      <Badge tone="success" size="sm">
                        Aktif
                      </Badge>
                    ) : (
                      <MetaBadge>Nonaktif</MetaBadge>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
        <Building2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Seluruh nilai pada halaman ini dibaca dengan sesi pengguna Anda, sehingga Row Level Security
        tetap berlaku. Dashboard tidak pernah membaca atau menulis dengan kunci service-role.
      </p>
    </div>
  );
}

/** Today's date in the fallback zone; used only to split past/future holidays. */
function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}