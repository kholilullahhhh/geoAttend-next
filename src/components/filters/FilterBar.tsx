'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useState, useTransition } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { ActiveFilters } from './FilterChips';
import { DateInput, Field, SearchInput, Select } from '@/components/ui/Field';
import { FALLBACK_TIMEZONE } from '@/lib/brand';
import type { Department, OfficeLocation } from '@/lib/contracts';
import { isoToday } from '@/lib/format';
import { ATTENDANCE_STATUS, attendanceStatus } from '@/lib/status';

/**
 * Filter bar.
 *
 * State lives entirely in the URL, so a filtered view is shareable, survives a
 * refresh, and is re-rendered on the server — no client-side filtering of a
 * page-sized dataset, and no second source of truth to fall out of sync.
 *
 * Free-text search is debounced; selects and dates apply immediately. Any
 * change resets to page 1, because staying on page 7 of a filtered-out result
 * set is the classic "no results" bug.
 *
 * Status options are labelled with `ATTENDANCE_STATUS`, the same table the
 * badges use. They used to be rendered as raw enum codes (`CHECKED_IN`,
 * `COMPLETED`), which put two different vocabularies on one screen.
 */
export interface FilterBarProps {
  departments: Department[];
  offices: OfficeLocation[];
  showDateRange?: boolean;
  /** Single-day control, for pages that are scoped to one date. */
  showSingleDate?: boolean;
  /** Query key the single date writes to. Defaults to `date`. */
  dateParam?: string;
  /** Status codes to offer, or omit to hide the control entirely. */
  statuses?: readonly string[];
  defaultFrom?: string;
  defaultTo?: string;
  defaultDate?: string;
  /** Extra label/value pairs for the "filter aktif" summary. */
  extraActive?: Array<{ label: string; value: string; href: string }>;
}

export function FilterBar({
  departments,
  offices,
  showDateRange = false,
  showSingleDate = false,
  dateParam = 'date',
  statuses,
  defaultFrom,
  defaultTo,
  defaultDate,
  extraActive = [],
}: FilterBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  // `isPending` is intentionally unused: the panel must not flash a spinner
  // over the filters while typing, and the server response is the feedback.
  const [, startTransition] = useTransition();

  const searchId = useId();
  const deptId = useId();
  const officeId = useId();
  const statusId = useId();
  const fromId = useId();
  const toId = useId();
  const singleId = useId();

  const [search, setSearch] = useState(() => params.get('q') ?? '');
  const [open, setOpen] = useState(false);

  /**
   * Push a mutated query string to the router.
   *
   * Built from the *current* `params`, so any filter set by a sibling control
   * is preserved rather than clobbered.
   */
  const push = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      // Page 1 is implied whenever the filter set changes.
      next.delete('page');
      startTransition(() => {
        router.push(next.size > 0 ? `?${next.toString()}` : '?', { scroll: false });
      });
    },
    [params, router],
  );

  const setParam = useCallback(
    (key: string, value: string) => {
      push((next) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
    },
    [push],
  );

  /**
   * Debounce the search box so each keystroke does not trigger a server round
   * trip.
   *
   * The effect is keyed on the *pair* (local input, URL value) rather than on a
   * ref holding the latest callback. When the push lands, the URL value catches
   * up with the input and the effect returns early — so there is no re-arm loop
   * and no ref read during render.
   */
  const committedQuery = params.get('q') ?? '';

  /*
   * Adopt the URL as the source of truth when the query is cleared elsewhere.
   *
   * "Atur ulang semua" and the per-filter × links are real navigations, so the
   * component does not remount and the box would otherwise keep its stale text —
   * then the debounce would helpfully push that text straight back into the URL,
   * making the reset look broken.
   *
   * This is React's documented "adjust state during render" pattern: React
   * re-renders immediately without committing, and discards the output if a
   * higher-priority update lands first. Comparing against the previously-seen
   * URL value (rather than an in-flight flag) is what keeps our *own* debounced
   * write from being mistaken for an external reset.
   */
  const [previousQuery, setPreviousQuery] = useState(committedQuery);
  if (previousQuery !== committedQuery) {
    setPreviousQuery(committedQuery);
    if (committedQuery === '') setSearch('');
  }

  // Debounce so each keystroke does not trigger a server round trip. Once the
  // push lands, `trimmed === committedQuery` and the effect settles.
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === committedQuery) return;
    const timer = setTimeout(() => setParam('q', trimmed), 350);
    return () => clearTimeout(timer);
  }, [search, committedQuery, setParam]);

  const from = params.get('from') ?? defaultFrom ?? '';
  const to = params.get('to') ?? defaultTo ?? '';
  const singleDate = params.get(dateParam) ?? defaultDate ?? '';
  const dept = params.get('dept') ?? '';
  const office = params.get('office') ?? '';
  const status = params.get('status') ?? '';

  // Active-filter summary. The names are resolved from the reference lists so
  // the summary says "Keuangan", not a UUID.
  const active: Array<{ label: string; value: string; href: string }> = [
    ...(showSingleDate && params.get(dateParam)
      ? [{ label: 'Tanggal', value: params.get(dateParam)!, href: without(params, dateParam) }]
      : []),
    ...(params.get('q')
      ? [{ label: 'Cari', value: params.get('q')!, href: without(params, 'q') }]
      : []),
    ...(dept
      ? [
          {
            label: 'Departemen',
            value: departments.find((d) => d.id === dept)?.name ?? dept,
            href: without(params, 'dept'),
          },
        ]
      : []),
    ...(office
      ? [
          {
            label: 'Lokasi',
            value: offices.find((o) => o.id === office)?.name ?? office,
            href: without(params, 'office'),
          },
        ]
      : []),
    ...(status
      ? [
          {
            label: 'Status',
            value: attendanceStatus(status).label,
            href: without(params, 'status'),
          },
        ]
      : []),
    ...extraActive,
  ];

  const controlCount = active.length;

  return (
    <div className="flex flex-col gap-3">
      {/*
        On a phone the filter set is a panel, not a wall of controls: it is
        secondary to the data, and six stacked inputs above a table pushes the
        table below the fold.
      */}
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="filter-panel"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-ink"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filter
          {controlCount > 0 && (
            <span className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-accent-soft px-1.5 text-2xs font-bold text-accent-ink">
              {controlCount}
            </span>
          )}
        </button>
      </div>

      <div
        id="filter-panel"
        className={`${open ? 'grid' : 'hidden'} grid-cols-1 gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-4 xl:grid-cols-5`}
      >
        {showSingleDate && (
          <Field
            label="Tanggal"
            htmlFor={singleId}
            hint="Ringkasan menampilkan satu hari kerja"
          >
            <DateInput
              id={singleId}
              defaultValue={singleDate}
              max={isoToday(FALLBACK_TIMEZONE)}
              onChange={(e) => setParam(dateParam, e.target.value)}
            />
          </Field>
        )}

        {showDateRange && (
          <>
            <Field label="Dari tanggal" htmlFor={fromId}>
              <DateInput
                id={fromId}
                defaultValue={from}
                max={to || undefined}
                onChange={(e) => setParam('from', e.target.value)}
              />
            </Field>
            <Field label="Sampai tanggal" htmlFor={toId}>
              <DateInput
                id={toId}
                defaultValue={to}
                min={from || undefined}
                onChange={(e) => setParam('to', e.target.value)}
              />
            </Field>
          </>
        )}

        <Field label="Cari" htmlFor={searchId} hint="Nama, kode, atau email karyawan">
          <SearchInput
            id={searchId}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama atau kode karyawan"
          />
        </Field>

        <Field label="Departemen" htmlFor={deptId}>
          <Select
            id={deptId}
            value={dept}
            onChange={(e) => setParam('dept', e.target.value)}
          >
            <option value="">Semua departemen</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Lokasi kantor" htmlFor={officeId}>
          <Select
            id={officeId}
            value={office}
            onChange={(e) => setParam('office', e.target.value)}
          >
            <option value="">Semua lokasi</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>

        {statuses && statuses.length > 0 && (
          <Field label="Status" htmlFor={statusId}>
            <Select
              id={statusId}
              value={status}
              onChange={(e) => setParam('status', e.target.value)}
            >
              <option value="">Semua status</option>
              {statuses.map((code) => (
                <option key={code} value={code}>
                  {ATTENDANCE_STATUS[code]?.label ?? code}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <ActiveFilters items={active} onResetHref="?" />
    </div>
  );
}

/** `params` with one key removed, preserving everything else. */
function without(params: URLSearchParams, key: string): string {
  const next = new URLSearchParams(params.toString());
  next.delete(key);
  next.delete('page');
  return next.size > 0 ? `?${next.toString()}` : '?';
}