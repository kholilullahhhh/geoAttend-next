'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Search, X } from 'lucide-react';

import { DateInput, Field, Select, TextInput } from '@/components/ui/Field';
import type { Department, OfficeLocation } from '@/lib/contracts';

/**
 * Filter bar.
 *
 * State lives entirely in the URL, so a filtered view is shareable, survives a
 * refresh, and is re-rendered on the server — no client-side filtering of a
 * page-sized dataset.
 *
 * The free-text search is debounced; selects and dates apply immediately.
 */
export function FilterBar({
  departments,
  offices,
  showDateRange = false,
  showStatus = false,
  statuses,
  defaultFrom,
  defaultTo,
}: {
  departments: Department[];
  offices: OfficeLocation[];
  showDateRange?: boolean;
  showStatus?: boolean;
  statuses?: readonly string[];
  defaultFrom?: string;
  defaultTo?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get('q') ?? '');

  function push(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    // Page 1 is implied whenever the filter set changes.
    next.delete('page');
    startTransition(() => {
      router.push(next.size > 0 ? `?${next.toString()}` : '?', { scroll: false });
    });
  }

  // Debounce so each keystroke does not trigger a server round trip.
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (search === current) return;
    const timer = setTimeout(() => {
      push((next) => {
        if (search.trim()) next.set('q', search.trim());
        else next.delete('q');
      });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters =
    params.get('q') || params.get('dept') || params.get('office') || params.get('status');

  return (
    <div className="flex flex-col gap-md">
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        {showDateRange && (
          <>
            <Field label="Dari tanggal" htmlFor="f-from">
              <DateInput
                id="f-from"
                name="from"
                defaultValue={params.get('from') ?? defaultFrom}
                max={params.get('to') ?? defaultTo}
                onChange={(e) =>
                  push((next) => {
                    if (e.target.value) next.set('from', e.target.value);
                    else next.delete('from');
                  })
                }
              />
            </Field>
            <Field label="Sampai tanggal" htmlFor="f-to">
              <DateInput
                id="f-to"
                name="to"
                defaultValue={params.get('to') ?? defaultTo}
                min={params.get('from') ?? defaultFrom}
                onChange={(e) =>
                  push((next) => {
                    if (e.target.value) next.set('to', e.target.value);
                    else next.delete('to');
                  })
                }
              />
            </Field>
          </>
        )}

        <Field label="Cari" htmlFor="f-q">
          <div className="relative">
            <Search
              className="pointer-events-none pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <TextInput
              id="f-q"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama atau kode karyawan"
              className="pl-9"
            />
          </div>
        </Field>

        <Field label="Departemen" htmlFor="f-dept">
          <Select
            id="f-dept"
            defaultValue={params.get('dept') ?? ''}
            onChange={(e) =>
              push((next) => {
                if (e.target.value) next.set('dept', e.target.value);
                else next.delete('dept');
              })
            }
          >
            <option value="">Semua departemen</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Lokasi kantor" htmlFor="f-office">
          <Select
            id="f-office"
            defaultValue={params.get('office') ?? ''}
            onChange={(e) =>
              push((next) => {
                if (e.target.value) next.set('office', e.target.value);
                else next.delete('office');
              })
            }
          >
            <option value="">Semua lokasi</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>

        {showStatus && statuses && (
          <Field label="Status" htmlFor="f-status">
            <Select
              id="f-status"
              defaultValue={params.get('status') ?? ''}
              onChange={(e) =>
                push((next) => {
                  if (e.target.value) next.set('status', e.target.value);
                  else next.delete('status');
                })
              }
            >
              <option value="">Semua status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {hasFilters && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              startTransition(() => router.push(showDateRange ? '?' : '?', { scroll: false }))
            }
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-secondary hover:bg-surface-alt hover:text-ink"
          >
            <X className="size-3.5" aria-hidden="true" />
            Atur ulang filter
          </button>
        </div>
      )}
    </div>
  );
}