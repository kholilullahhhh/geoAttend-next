import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/States';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { DataError, fetchHolidays, fetchOffices, fetchShifts, getViewer } from '@/lib/data';
import { formatCoord, formatDate, formatWorkDays } from '@/lib/format';

export const metadata = { title: 'Pengaturan' };
export const dynamic = 'force-dynamic';

/**
 * Reference data.
 *
 * Offices, shifts and holidays are administered directly in Supabase Studio or
 * via versioned migrations. This page is intentionally read-only: these values
 * decide who can check in and whether an attendance counts as late, so changing
 * one through an ad-hoc web form would leave no reviewable history. Every row
 * here is the live database state, not a cached or illustrative copy.
 */
export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer.role !== 'ADMIN') {
    return <ErrorState title="Akses dibatasi" message="Hanya Administrator yang dapat melihat pengaturan." />;
  }

  let offices;
  let shifts;
  let holidays;
  try {
    [offices, shifts, holidays] = await Promise.all([
      fetchOffices(),
      fetchShifts(),
      fetchHolidays(),
    ]);
  } catch (error) {
    return (
      <ErrorState
        message={error instanceof DataError ? error.message : 'Terjadi kesalahan tak terduga.'}
      />
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Pengaturan Sistem"
        description="Titik kantor, shift, dan hari libur yang dipakai validasi geofence dan jadwal."
      />

      <Card
        title="Lokasi kantor"
        description="Radius dipakai untuk menentukan check-in di dalam atau di luar area."
        padded={false}
      >
        {offices.length === 0 ? (
          <EmptyState title="Belum ada lokasi" description="Tambahkan lokasi kantor terlebih dahulu." />
        ) : (
          <TableWrap minWidth={860}>
            <thead>
              <tr>
                <Th>Lokasi</Th>
                <Th>Koordinat</Th>
                <Th align="right">Radius</Th>
                <Th align="right">Akurasi maks.</Th>
                <Th>Di luar radius</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {offices.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <span className="font-medium text-ink">{o.name}</span>
                    <p className="tabular text-xs text-ink-muted">{o.code}</p>
                    {o.address && <p className="text-xs text-ink-muted">{o.address}</p>}
                  </Td>
                  <Td className="tabular whitespace-nowrap text-sm text-ink-secondary">
                    {formatCoord(o.latitude)}, {formatCoord(o.longitude)}
                  </Td>
                  <Td align="right" className="tabular">
                    {o.radius_meters} m
                  </Td>
                  <Td align="right" className="tabular">
                    {o.max_accuracy_meters != null ? `${o.max_accuracy_meters} m` : 'Ikut default'}
                  </Td>
                  <Td>
                    {o.allow_out_of_radius === null ? (
                      <span className="text-xs text-ink-muted">Ikut default</span>
                    ) : o.allow_out_of_radius ? (
                      <Badge tone="warning">Diizinkan (ditandai)</Badge>
                    ) : (
                      <Badge tone="success">Ditolak</Badge>
                    )}
                  </Td>
                  <Td>
                    {o.is_active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card
        title="Shift"
        description="Waktu mulai, selesai, masa tenggang, dan durasi kerja target."
        padded={false}
      >
        {shifts.length === 0 ? (
          <EmptyState title="Belum ada shift" description="Tambahkan shift terlebih dahulu." />
        ) : (
          <TableWrap minWidth={900}>
            <thead>
              <tr>
                <Th>Shift</Th>
                <Th>Jam</Th>
                <Th>Hari kerja</Th>
                <Th align="right">Istirahat</Th>
                <Th align="right">Masa tenggang</Th>
                <Th align="right">Target</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <span className="font-medium text-ink">{s.name}</span>
                    <p className="tabular text-xs text-ink-muted">{s.code}</p>
                  </Td>
                  <Td className="tabular whitespace-nowrap text-sm text-ink-secondary">
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                    {s.crosses_midnight && (
                      <Badge tone="info" className="ml-2">
                        lintas tengah malam
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-sm text-ink-secondary">{formatWorkDays(s.work_days)}</Td>
                  <Td align="right" className="tabular">
                    {s.break_minutes}m
                  </Td>
                  <Td align="right" className="tabular">
                    {s.grace_late_minutes}m
                  </Td>
                  <Td align="right" className="tabular">
                    {Math.floor(s.target_minutes / 60)}j {s.target_minutes % 60}m
                  </Td>
                  <Td>
                    {s.is_active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card title="Hari libur" description="Tanggal tanpa(check-in) wajib Shift." padded={false}>
        {holidays.length === 0 ? (
          <EmptyState title="Belum ada hari libur" description="Tambahkan hari libur bila diperlukan." />
        ) : (
          <TableWrap minWidth={620}>
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>Nama</Th>
                <Th>Cakupan</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <Tr key={h.id}>
                  <Td className="tabular whitespace-nowrap">{formatDate(h.holiday_date)}</Td>
                  <Td className="text-sm text-ink">{h.name}</Td>
                  <Td className="text-sm text-ink-secondary">
                    {h.office_location_id
                      ? (offices.find((o) => o.id === h.office_location_id)?.name ?? 'Lokasi khusus')
                      : 'Perusahaan'}
                  </Td>
                  <Td>
                    {h.is_active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}