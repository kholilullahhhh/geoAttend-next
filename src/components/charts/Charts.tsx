'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatDate, formatDuration, formatWeekdayShort } from '@/lib/format';
import type { RecapDay } from '@/lib/contracts';
import type { Tone } from '@/lib/status';

/**
 * Charts.
 *
 * Rules this file follows, all of them learned from dense HR data rather than
 * from chart aesthetics:
 *
 *  - **Every number is real.** Each series comes from a `report_recap` /
 *    `admin_summary` payload that aggregated in SQL. When a range has no rows
 *    the parent renders an empty state instead of this component, so there is
 *    no code path that invents a zero-filled series.
 *  - **A chart is never the only way to read the data.** The reports page
 *    carries the full daily table underneath; this overview trend links to it.
 *  - **Label density adapts to the range.** Ninety daily ticks cannot share a
 *    700px axis, so the interval is computed from the point count instead of
 *    being left to collide.
 *  - **Colours come from tokens.** `var(--accent-bright)` for the primary
 *    series, per `theme.ts`'s "saturated orange for chart fills, never for
 *    text" rule.
 */

const AXIS_TICK = { fontSize: 11, fill: 'var(--text-muted)' } as const;
const GRID = 'var(--border)';

/**
 * How many x-axis ticks to show.
 *
 * Recharts renders every tick unless `interval` is set, so a 90-day range draws
 * 90 overlapping labels. Roughly one label per 46px keeps them legible at every
 * viewport width without hand-tuning per breakpoint.
 */
function tickInterval(count: number): number {
  if (count <= 10) return 0;
  if (count <= 20) return 1;
  return Math.ceil(count / 12) - 1;
}

function tooltipStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    fontSize: 12,
    boxShadow: 'var(--shadow-pop)',
    padding: '8px 10px',
  } as const;
}

/**
 * Daily attendance trend.
 *
 * Two series stacked rather than grouped: "present" and "late" are parts of the
 * same whole for a given day, so a stack shows the day's total attendance at a
 * glance instead of making the reader subtract two bars.
 */
export function AttendanceTrend({ daily }: { daily: RecapDay[] }) {
  const data = useMemo(
    () =>
      daily.map((d) => ({
        day: d.day,
        label: formatWeekdayShort(d.day),
        full: formatDate(d.day),
        hadir: d.present,
        terlambat: d.late,
      })),
    [daily],
  );

  const empty = data.length === 0;
  if (empty) return null;

  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label={`Grafik batang kehadiran harian untuk ${data.length} hari. Rincian harian tersedia di halaman Laporan.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            interval={tickInterval(data.length)}
            tick={AXIS_TICK}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            minTickGap={4}
          />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={{ fill: 'var(--surface-alt)' }}
            contentStyle={tooltipStyle()}
            labelFormatter={(_label, payload) => {
              const day = payload?.[0]?.payload?.full;
              return day ? String(day) : '';
            }}
            formatter={(value, name) => [`${value} orang`, name === 'hadir' ? 'Hadir' : 'Terlambat']}
          />
          {/*
            A hairline in the surface colour separates the stacked segments, so
            "on time" and "late" stay distinguishable where the two hues are
            closest — which is exactly where a reader needs the boundary most.
          */}
          <Bar
            dataKey="hadir"
            name="hadir"
            stackId="a"
            fill="var(--accent-bright)"
            stroke="var(--surface)"
            strokeWidth={1}
            radius={[3, 3, 0, 0]}
            maxBarSize={34}
          />
          <Bar
            dataKey="terlambat"
            name="terlambat"
            stackId="a"
            // `--warning-bright`, not `--warning`: the latter is the 8:1 *text*
            // colour (a dark brown), which beside a saturated orange reads as a
            // second "present" series rather than as "late".
            fill="var(--warning-bright)"
            stroke="var(--surface)"
            strokeWidth={1}
            radius={[3, 3, 0, 0]}
            maxBarSize={34}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Worked-hours trend, in hours so the axis stays readable.
 *
 * Dots are switched off but `activeDot` is kept, so hovering a day still lands
 * a marker on the exact value.
 */
export function WorkedHoursTrend({ daily }: { daily: RecapDay[] }) {
  const data = useMemo(
    () =>
      daily.map((d) => ({
        day: d.day,
        label: formatWeekdayShort(d.day),
        full: formatDate(d.day),
        jam: Number((d.worked_minutes / 60).toFixed(1)),
        lembur: Number((d.overtime_minutes / 60).toFixed(1)),
      })),
    [daily],
  );

  if (data.length === 0) return null;

  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label="Grafik garis jam kerja dan lembur harian. Rincian harian tersedia di tabel rekap di bawah."
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            interval={tickInterval(data.length)}
            tick={AXIS_TICK}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            minTickGap={4}
          />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={{ stroke: GRID }}
            contentStyle={tooltipStyle()}
            labelFormatter={(_label, payload) => {
              const day = payload?.[0]?.payload?.full;
              return day ? String(day) : '';
            }}
            formatter={(value, name) => [
              `${value} jam`,
              name === 'jam' ? 'Jam kerja' : 'Lembur',
            ]}
          />
          <Line
            type="monotone"
            dataKey="jam"
            name="jam"
            stroke="var(--accent-bright)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="lembur"
            name="lembur"
            stroke="var(--warning-bright)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Segment fill *class names*.
 *
 * These are utilities, not CSS values. An earlier revision held `var(--danger)`
 * strings and applied them through `className`, which Tailwind happily accepts as
 * an arbitrary class name — so the bar rendered at full width with a transparent
 * fill, and "100% belum check-in" looked like an empty track. Keeping these as
 * real class names makes that failure impossible.
 */
const FILL: Record<Tone, string> = {
  neutral: 'bg-surface-sunken',
  success: 'bg-success-bright',
  warning: 'bg-warning-bright',
  danger: 'bg-danger',
  info: 'bg-info-bright',
  accent: 'bg-accent-bright',
};

/**
 * Status distribution for the selected day.
 *
 * A stacked bar plus a labelled list, deliberately not a donut: with six
 * adjacent slices a donut makes the two smallest ones unreadable, and the
 * percentages here are only meaningful next to their counts. The list carries
 * both, so nothing is encoded in angle size alone.
 */
export function StatusMix({
  segments,
}: {
  segments: Array<{ key: string; label: string; value: number; tone: Tone }>;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const shown = segments.filter((s) => s.value > 0);

  if (total === 0) {
    return (
      <p className="py-xl text-center text-sm text-ink-muted">
        Belum ada check-in pada tanggal ini.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex h-3 w-full overflow-hidden rounded-pill bg-surface-sunken"
        role="img"
        aria-label={shown.map((s) => `${s.label} ${s.value} orang`).join(', ')}
      >
        {/*
          A non-zero percentage with no visible fill would contradict the list
          below it, so the segment widths are also what the legend claims.
        */}
        {shown.map((s) => (
          <span
            key={s.key}
            className={FILL[s.tone]}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.key} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-pill ${FILL[s.tone]}`}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">
                {s.label}
              </span>
              <span className="tabular shrink-0 text-xs text-ink-muted">{pct}%</span>
              <span className="tabular w-8 shrink-0 text-right text-sm font-semibold text-ink">
                {s.value}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-line pt-3 text-xs text-ink-muted">
        Total {total} check-in tercatat. Persentase dihitung terhadap jumlah check-in, bukan
        terhadap seluruh karyawan.
      </p>
    </div>
  );
}

/** Legend shared by the reports charts. */
export function ChartLegend({
  items,
}: {
  items: Array<{ label: string; color: string; dashed?: boolean }>;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-secondary">
          {/*
            The legend swatch mirrors the chart mark exactly: a solid line for a
            solid series, a dashed swatch for the dashed overtime line. A legend
            that only differs by colour stops working the moment two series
            share a hue — and under colour-vision deficiency they do.
          */}
          <span
            aria-hidden="true"
            className="h-0.5 w-5 shrink-0"
            style={{
              backgroundColor: item.dashed ? 'transparent' : item.color,
              backgroundImage: item.dashed
                ? `repeating-linear-gradient(90deg, ${item.color} 0 5px, transparent 5px 9px)`
                : 'none',
            }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Total-duration formatter shared by the reports summary tiles. */
export function durationLabel(minutes: number | null | undefined): string {
  return minutes == null ? '—' : formatDuration(minutes);
}