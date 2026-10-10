'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import type { AppRole, Department, OfficeLocation } from '@/lib/contracts';

/**
 * Employee administration.
 *
 * Writes go through `PATCH /api/employees`, which re-derives the caller's role
 * server-side. The `guard_profile_privileges()` trigger in migration 400 is the
 * real boundary — even if this UI were bypassed, the database refuses a
 * non-ADMIN changing a role.
 */
export function EmployeeRowControls({
  employeeId,
  currentRole,
  isActive,
  departments,
  offices,
  departmentId,
  officeId,
}: {
  employeeId: string;
  currentRole: AppRole;
  isActive: boolean;
  departments: Department[];
  offices: OfficeLocation[];
  departmentId: string | null;
  officeId: string | null;
}) {
  const router = useRouter();
  const [role, setRole] = useState<AppRole>(currentRole);
  const [dept, setDept] = useState(departmentId ?? '');
  const [office, setOffice] = useState(officeId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: employeeId, ...body }),
      });
      const payload = (await res.json()) as { ok: boolean; message?: string };
      if (!payload.ok) {
        setError(payload.message ?? 'Gagal menyimpan perubahan.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Tidak ada koneksi ke server.');
    } finally {
      setBusy(false);
    }
  }

  const dirty = role !== currentRole || dept !== (departmentId ?? '') || office !== (officeId ?? '');

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole)}
          aria-label="Peran"
          disabled={busy}
        >
          <option value="EMPLOYEE">Karyawan</option>
          <option value="HR">HRD</option>
          <option value="ADMIN">Admin</option>
        </Select>
        <Select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          aria-label="Departemen"
          disabled={busy}
        >
          <option value="">Tanpa departemen</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          value={office}
          onChange={(e) => setOffice(e.target.value)}
          aria-label="Lokasi kantor"
          disabled={busy}
        >
          <option value="">Tanpa lokasi</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          loading={busy}
          disabled={!dirty}
          onClick={() => patch({ role, department_id: dept || null, office_location_id: office || null })}
        >
          Simpan
        </Button>
        <Button
          size="sm"
          variant={isActive ? 'danger' : 'secondary'}
          loading={busy}
          onClick={() => patch({ is_active: !isActive })}
        >
          {isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </Button>
        {saved && (
          <span role="status" className="text-xs text-success">
            Tersimpan
          </span>
        )}
        {error && (
          <span role="alert" className="text-xs text-danger">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}