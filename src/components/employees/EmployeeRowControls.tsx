'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Pencil, Power } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import type { AppRole, Department, OfficeLocation } from '@/lib/contracts';
import { ROLE_LABEL } from '@/lib/status';

/**
 * Employee administration.
 *
 * Writes go through `PATCH /api/employees`, which re-derives the caller's role
 * server-side and refuses anything but ADMIN. The `guard_profile_privileges()`
 * trigger in migration 400 is the real boundary — even if this UI were
 * bypassed, the database refuses a non-ADMIN changing a role.
 *
 * Two decisions worth stating:
 *
 *  - **`canEdit` is not decoration.** Without it an HR account is shown live
 *    "Simpan" and "Nonaktifkan" buttons that are guaranteed to fail with a 403,
 *    which reads as a broken product rather than as a permission boundary.
 *  - **Editing happens in a dialog, not inline.** Three selects plus two buttons
 *    in every row made the directory 1180px wide and 90px tall per person: the
 *    table scrolled off-screen, the shared columns stopped being comparable at a
 *    glance, and the primary data (name, role, placement) was pushed out of
 *    view. The row now shows values as text and opens one editor on demand.
 */
export function EmployeeRowControls({
  employeeId,
  fullName,
  currentRole,
  isActive,
  departments,
  offices,
  departmentId,
  officeId,
  canEdit,
}: {
  employeeId: string;
  fullName: string;
  currentRole: AppRole;
  isActive: boolean;
  departments: Department[];
  offices: OfficeLocation[];
  departmentId: string | null;
  officeId: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const [role, setRole] = useState<AppRole>(currentRole);
  const [dept, setDept] = useState(departmentId ?? '');
  const [office, setOffice] = useState(officeId ?? '');

  const dirty =
    role !== currentRole || dept !== (departmentId ?? '') || office !== (officeId ?? '');

  /*
   * The dialog is only opened on demand, so the form state below is seeded from
   * the props each time rather than live-bound — which also means a value that
   * changed underneath (another admin edited the row) is not silently carried
   * into the next edit.
   */

  async function patch(body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: employeeId, ...body }),
      });

      let payload: { ok: boolean; message?: string };
      try {
        payload = (await res.json()) as typeof payload;
      } catch {
        toast.error('Server tidak memberikan jawaban yang dapat dibaca.');
        return false;
      }

      if (!payload.ok) {
        toast.error(payload.message ?? 'Gagal menyimpan perubahan.');
        return false;
      }

      toast.success(successMessage);
      router.refresh();
      return true;
    } catch {
      toast.error('Tidak ada koneksi ke server. Coba lagi.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <span className="text-xs whitespace-nowrap text-ink-muted">
        {ROLE_LABEL[currentRole]}
      </span>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <Button
          size="sm"
          variant="subtle"
          icon={<Pencil className="size-3.5" aria-hidden="true" />}
          onClick={() => {
            // Re-seed the form from current values each time it opens, so a
            // cancelled edit never leaves stale state behind.
            setRole(currentRole);
            setDept(departmentId ?? '');
            setOffice(officeId ?? '');
            setEditing(true);
          }}
          aria-label={`Ubah peran dan penempatan ${fullName}`}
        >
          Ubah
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          label={isActive ? `Nonaktifkan akun ${fullName}` : `Aktifkan akun ${fullName}`}
          title={isActive ? 'Nonaktifkan akun' : 'Aktifkan akun'}
          icon={
            isActive ? (
              <Power className="size-4" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )
          }
          onClick={() => setConfirming(true)}
        />
      </div>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title={`Ubah ${fullName}`}
        description="Perubahan berlaku untuk check-in berikutnya dan dicatat pada audit log server."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Batal
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!dirty}
              onClick={async () => {
                const ok = await patch(
                  { role, department_id: dept || null, office_location_id: office || null },
                  `Perubahan untuk ${fullName} tersimpan.`,
                );
                if (ok) setEditing(false);
              }}
            >
              Simpan perubahan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Peran" htmlFor={`emp-role-${employeeId}`} hint="Menentukan akses dashboard dan izin persetujuan.">
            <Select
              id={`emp-role-${employeeId}`}
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              disabled={busy}
            >
              <option value="EMPLOYEE">Karyawan</option>
              <option value="HR">HRD</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>

          <Field label="Departemen" htmlFor={`emp-dept-${employeeId}`}>
            <Select
              id={`emp-dept-${employeeId}`}
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              disabled={busy}
            >
              <option value="">Tanpa departemen</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Lokasi kantor"
            htmlFor={`emp-office-${employeeId}`}
            hint="Titik acuan geofence yang dipakai saat check-in."
          >
            <Select
              id={`emp-office-${employeeId}`}
              value={office}
              onChange={(e) => setOffice(e.target.value)}
              disabled={busy}
            >
              <option value="">Tanpa lokasi</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>

          {dirty && (
            <p className="rounded-md bg-accent-soft px-md py-2 text-xs leading-relaxed text-accent-ink">
              Belum disimpan. Menutup dialog membatalkan perubahan.
            </p>
          )}
        </div>
      </Dialog>

      {/*
        Deactivating an account stops check-in immediately, without waiting for
        the access token to expire. That is worth a confirmation, and the copy
        states the consequence rather than just asking "are you sure?".
      */}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          const ok = await patch(
            { is_active: !isActive },
            isActive ? `${fullName} dinonaktifkan.` : `${fullName} diaktifkan kembali.`,
          );
          if (ok) setConfirming(false);
        }}
        title={isActive ? `Nonaktifkan akun ${fullName}?` : `Aktifkan kembali ${fullName}?`}
        description={
          isActive
            ? 'Akun ini langsung tidak dapat masuk dan tidak dapat melakukan check-in baru, tanpa menunggu kedaluwarsa token. Riwayat absensi tetap tersimpan.'
            : 'Akun ini akan dapat masuk dan melakukan check-in kembali sesuai jadwalnya.'
        }
        confirmLabel={isActive ? 'Nonaktifkan akun' : 'Aktifkan akun'}
        destructive={isActive}
        loading={busy}
        busyLabel="Menyimpan…"
      />
    </>
  );
}