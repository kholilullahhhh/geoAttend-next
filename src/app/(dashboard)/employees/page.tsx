import { Suspense } from 'react';

import { EmployeeRowControls } from '@/components/employees/EmployeeRowControls';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/States';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { DataError, fetchDepartments, fetchOffices, fetchProfiles } from '@/lib/data';
import { brand } from '@/lib/brand';

export const metadata = { title: 'Karyawan' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default async function EmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (first(params.q) ?? '').toLowerCase().trim();
  const roleFilter = first(params.role);

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

  const filtered = people.filter((p) => {
    if (roleFilter && roleFilter !== 'ALL' && p.role !== roleFilter) return false;
    if (!query) return true;
    return (
      p.full_name.toLowerCase().includes(query) ||
      (p.employee_code ?? '').toLowerCase().includes(query) ||
      p.email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Karyawan"
        description={`${people.length} akun terdaftar · ${filtered.length} ditampilkan`}
      />

      <Suspense fallback={null}>
        <Card title="Filter">
          <form method="get" className="flex flex-col gap-md sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="emp-q" className="text-xs font-medium text-ink-secondary">
                Cari
              </label>
              <input
                id="emp-q"
                type="search"
                name="q"
                defaultValue={first(params.q) ?? ''}
                placeholder="Nama, kode, atau email"
                className="h-10 w-full rounded-md border border-line-strong bg-surface px-md text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="emp-role" className="text-xs font-medium text-ink-secondary">
                Peran
              </label>
              <select
                id="emp-role"
                name="role"
                defaultValue={roleFilter ?? 'ALL'}
                className="h-10 rounded-md border border-line-strong bg-surface px-md text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option value="ALL">Semua peran</option>
                <option value="EMPLOYEE">Karyawan</option>
                <option value="HR">HRD</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <Button type="submit" variant="primary">
              Terapkan
            </Button>
          </form>
        </Card>
      </Suspense>

      <Card
        title="Direktori"
        description="Kelola peran, departemen, lokasi, dan status aktif karyawan."
        padded={false}
      >
        {filtered.length === 0 ? (
          <EmptyState
            title="Tidak ada karyawan"
            description="Tidak ada akun yang cocok dengan pencarian atau filter peran."
          />
        ) : (
          <TableWrap minWidth={900}>
            <thead>
              <tr>
                <Th>Karyawan</Th>
                <Th>Kontak</Th>
                <Th>Peran</Th>
                <Th>Status</Th>
                <Th>Penempatan</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <span className="font-medium text-ink">{p.full_name}</span>
                    <p className="tabular text-xs text-ink-muted">
                      {p.employee_code ?? '—'}
                      {p.position_title ? ` · ${p.position_title}` : ''}
                    </p>
                  </Td>
                  <Td>
                    <span className="text-sm text-ink-secondary">{p.email}</span>
                    {p.phone && <p className="tabular text-xs text-ink-muted">{p.phone}</p>}
                  </Td>
                  <Td>
                    <Badge tone={p.role === 'ADMIN' ? 'accent' : p.role === 'HR' ? 'info' : 'neutral'}>
                      {p.role === 'ADMIN' ? 'Admin' : p.role === 'HR' ? 'HRD' : 'Karyawan'}
                    </Badge>
                  </Td>
                  <Td>
                    {p.is_active ? (
                      <Badge tone="success">Aktif</Badge>
                    ) : (
                      <Badge tone="danger">Nonaktif</Badge>
                    )}
                  </Td>
                  <Td className="text-sm text-ink-secondary">
                    {p.department_name ?? '—'}
                    <p className="text-xs text-ink-muted">{p.office_name ?? 'Tanpa lokasi'}</p>
                  </Td>
                  <Td align="right">
                    <EmployeeRowControls
                      employeeId={p.id}
                      currentRole={p.role}
                      isActive={p.is_active}
                      departmentId={p.department_id}
                      officeId={p.office_location_id}
                      departments={departments}
                      offices={offices}
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <p className="text-xs text-ink-muted">
        Menonaktifkan akun mencegah check-in baru segera, tanpa menunggu kedaluwarsa token.
        Perubahan peran dan status hanya dapat dilakukan Administrator
        ({brand.name} tidak menyimpan kredensial di sisi klien).
      </p>
    </div>
  );
}