import Link from 'next/link';
import { Search, UserCheck, UserX, Users } from 'lucide-react';

import { EmployeeRowControls } from '@/components/employees/EmployeeRowControls';
import { RoleBadge } from '@/components/shell/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  InlineNotice,
  PageHeader,
} from '@/components/ui/States';
import { Metric, MetricGrid } from '@/components/ui/StatCard';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { tableMinWidth } from '@/lib/design';
import { DataError, fetchDepartments, fetchOffices, fetchProfiles, getViewer } from '@/lib/data';
import { ROLE_LABEL } from '@/lib/status';

export const metadata = { title: 'Karyawan' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const ROLES = ['EMPLOYEE', 'HR', 'ADMIN'] as const;

export default async function EmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? '').toLowerCase().trim();
  const rawRole = first(params.role);
  const roleFilter = rawRole && (ROLES as readonly string[]).includes(rawRole) ? rawRole : null;
  const statusFilter = first(params.status);

  const viewer = await getViewer();
  // Mirrors the endpoint's own rule, so the UI offers exactly what can succeed.
  const canEdit = viewer?.role === 'ADMIN';

  let people;
  let departments;
  let offices;
  try {
    [people, departments, offices] = await Promise.all([
      fetchProfiles(),
      fetchDepartments(),
      fetchOffices(),
    ]);
  } catch (error) {
    return (
      <ErrorState
        message={error instanceof DataError ? error.message : 'Terjadi kesalahan tak terduga.'}
      />
    );
  }

  /*
   * Filtering happens here rather than in SQL because there is no directory RPC
   * — adding one would mean a migration, and this list is capped at 1000 rows by
   * `fetchProfiles`. The count in the header is stated honestly so nobody
   * mistakes it for a server-side total.
   */
  const filtered = people.filter((p) => {
    if (roleFilter && p.role !== roleFilter) return false;
    if (statusFilter === 'ACTIVE' && !p.is_active) return false;
    if (statusFilter === 'INACTIVE' && p.is_active) return false;
    if (!query) return true;
    return (
      p.full_name.toLowerCase().includes(query) ||
      (p.employee_code ?? '').toLowerCase().includes(query) ||
      p.email.toLowerCase().includes(query) ||
      (p.position_title ?? '').toLowerCase().includes(query)
    );
  });

  const activeCount = people.filter((p) => p.is_active).length;
  const privilegedCount = people.filter((p) => p.role !== 'EMPLOYEE').length;
  const unassignedCount = people.filter((p) => !p.office_location_id).length;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        eyebrow={<Breadcrumbs items={[{ label: 'Beranda', href: '/' }, { label: 'Karyawan' }]} />}
        title="Karyawan"
        description="Direktori akun, penempatan departemen, dan lokasi kantor default."
      />

      <MetricGrid>
        <Metric
          label="Total akun"
          value={people.length.toLocaleString('id-ID')}
          icon={<Users className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Aktif"
          value={activeCount.toLocaleString('id-ID')}
          sub={`${people.length - activeCount} nonaktif`}
          tone="success"
          icon={<UserCheck className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Nonaktif"
          value={(people.length - activeCount).toLocaleString('id-ID')}
          sub="Tidak dapat masuk atau check-in"
          tone={people.length - activeCount > 0 ? 'warning' : 'neutral'}
          icon={<UserX className="size-4" aria-hidden="true" />}
        />
        <Metric
          label="Peran cakupan"
          value={privilegedCount.toLocaleString('id-ID')}
          sub="HRD dan Administrator"
          tone="info"
        />
      </MetricGrid>

      {!canEdit && (
        <InlineNotice
          tone="info"
          title="Mode baca saja."
          message="Hanya Administrator yang dapat mengubah peran, departemen, lokasi, dan status aktif karyawan. Akun HRD dapat melihat seluruh data, dan endpoint/server menolak setiap perubahan dari peran lain."
        />
      )}

      {/*
        A plain GET form rather than the client-side `FilterBar`: this list is
        already fully materialised, and a no-JavaScript form keeps the page
        working when the bundle fails to load — which for a payroll-adjacent
        screen is worth more than a nicer control.
      */}
      <Card title="Filter" description="Pencarian dan penyaringan bekerja pada daftar yang sudah dimuat.">
        <form method="get" action="/employees" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label
              htmlFor="emp-q"
              className="text-2xs font-semibold tracking-wide text-ink-secondary uppercase"
            >
              Cari
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="emp-q"
                type="search"
                name="q"
                defaultValue={first(params.q) ?? ''}
                placeholder="Nama, kode, email, atau jabatan"
                className="h-10 w-full rounded-md border border-line-input bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="emp-role"
              className="text-2xs font-semibold tracking-wide text-ink-secondary uppercase"
            >
              Peran
            </label>
            <select
              id="emp-role"
              name="role"
              defaultValue={roleFilter ?? ''}
              className="h-10 rounded-md border border-line-input bg-surface px-md text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <option value="">Semua peran</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="emp-status"
              className="text-2xs font-semibold tracking-wide text-ink-secondary uppercase"
            >
              Status akun
            </label>
            <select
              id="emp-status"
              name="status"
              defaultValue={statusFilter ?? ''}
              className="h-10 rounded-md border border-line-input bg-surface px-md text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <option value="">Semua status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
            </select>
          </div>

          <button
            type="submit"
            className="h-10 rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-alt"
          >
            Terapkan
          </button>

          {(query || roleFilter || statusFilter) && (
            <Link
              href="/employees"
              className="inline-flex h-10 items-center px-1 text-sm font-medium text-accent-ink hover:underline"
            >
              Atur ulang
            </Link>
          )}
        </form>
      </Card>

      <Card
        title={`Direktori · ${filtered.length.toLocaleString('id-ID')} dari ${people.length.toLocaleString('id-ID')} akun`}
        description={
          canEdit
            ? 'Pilih "Ubah" pada satu baris untuk mengubah peran, departemen, atau lokasi. Perubahan langsung berlaku bagi check-in berikutnya.'
            : 'Nilai yang tampil adalah penempatan tercatat masing-masing karyawan.'
        }
        padded={false}
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title="Tidak ada karyawan"
            description="Tidak ada akun yang cocok dengan pencarian atau filter peran/status. Longgarkan filter atau atur ulang semuanya."
            action={
              <Link
                href="/employees"
                className="inline-flex h-9 coarse:h-10 items-center rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink no-underline transition-colors hover:bg-surface-alt"
              >
                Tampilkan semua karyawan
              </Link>
            }
          />
        ) : (
          <TableWrap
            /*
             * A directory row is now read-only text plus one "Ubah" button, so
             * the table fits without horizontal scrolling. The previous inline
             * three-select editor forced a 1180px minimum, which pushed the
             * primary columns off-screen on a 1440px display.
             */
            minWidth={tableMinWidth.default}
            label="Direktori karyawan"
            caption="Karyawan beserta peran, departemen, lokasi, dan status akun"
          >
            <thead>
              <tr>
                <Th sticky>Karyawan</Th>
                <Th hideBelow="md">Kontak</Th>
                <Th>Peran</Th>
                <Th>Status</Th>
                <Th hideBelow="lg">Departemen</Th>
                <Th hideBelow="lg">Lokasi kantor</Th>
                <Th align="right">{canEdit ? 'Aksi' : 'Peran akses'}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <Tr key={p.id}>
                  <Td sticky>
                    <span className="font-medium text-ink">{p.full_name}</span>
                    <p className="tabular mt-0.5 text-xs text-ink-muted">
                      {p.employee_code ?? 'Tanpa kode'}
                      {p.position_title ? ` · ${p.position_title}` : ''}
                    </p>
                  </Td>
                  <Td hideBelow="md">
                    <span className="block truncate text-xs text-ink-secondary">{p.email}</span>
                    {p.phone && (
                      <span className="tabular block text-2xs text-ink-muted">{p.phone}</span>
                    )}
                  </Td>
                  <Td>
                    <RoleBadge role={p.role} />
                  </Td>
                  <Td>
                    {p.is_active ? (
                      <Badge tone="success" size="sm">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge tone="danger" size="sm">
                        Nonaktif
                      </Badge>
                    )}
                  </Td>
                  <Td hideBelow="lg" className="text-xs">
                    {p.department_name ?? <span className="text-ink-muted">Tanpa departemen</span>}
                  </Td>
                  <Td hideBelow="lg" className="text-xs">
                    {p.office_name ?? (
                      <span className="text-ink-muted">Tanpa lokasi kantor</span>
                    )}
                  </Td>
                  <Td align="right">
                    <EmployeeRowControls
                      employeeId={p.id}
                      fullName={p.full_name}
                      currentRole={p.role}
                      isActive={p.is_active}
                      departmentId={p.department_id}
                      officeId={p.office_location_id}
                      departments={departments}
                      offices={offices}
                      canEdit={canEdit}
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {/*
        Surfaced as a banner rather than only as a table value: the seed
        deliberately contains a user with no office, and such an account can sign
        in but has every check-in rejected as out-of-radius. A directory that
        shows the blank cell without explaining it reads as a working setup.
      */}
      {unassignedCount > 0 && (
        <InlineNotice
          tone="warning"
          title={`${unassignedCount} karyawan tanpa lokasi kantor`}
          message="Akun tanpa titik acuan akan ditolak check-in-nya sebagai di luar radius. Gunakan tombol “Ubah” pada baris yang bersangkutan untuk menetapkannya."
        />
      )}

      <p className="text-xs leading-relaxed text-ink-muted">
        Menonaktifkan akun mencegah check-in baru segera, tanpa menunggu kedaluwarsa token.
        Perubahan peran dan status dicatat pada audit log server. Dashboard ini tidak menyimpan
        kredensial apa pun di sisi klien.
      </p>
    </div>
  );
}