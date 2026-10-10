'use client';

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

import { formatWeekdayShort } from '@/lib/format';
import type { RecapDay } from '@/lib/contracts';

/**
 * Attendance trend.
 *
 * Every point comes from `report_recap`, which aggregates in SQL. When the range
 * genuinely has no rows the parent renders an empty state instead of this
 * component, so the chart never invents data.
 */
export function AttendanceTrend({ daily }: { daily: RecapDay[] }) {
  const data = daily.map((d) => ({
    day: d.day,
    label: formatWeekdayShort(d.day),
    hadir: d.present,
    terlambat: d.late,
  }));

  return (
    <div className="h-64 w-full" role="img" aria-label="Grafik tren kehadiran harian">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(label, payload) => {
              const day = payload?.[0]?.payload?.day;
              return day ? `${label} · ${day}` : String(label);
            }}
          />
          <Bar dataKey="hadir" name="Hadir" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="terlambat" name="Terlambat" fill="var(--warning)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Worked-hours trend, in hours so the axis stays readable. */
export function WorkedHoursTrend({ daily }: { daily: RecapDay[] }) {
  const data = daily.map((d) => ({
    day: d.day,
    label: formatWeekdayShort(d.day),
    jam: Number((d.worked_minutes / 60).toFixed(1)),
    lembur: Number((d.overtime_minutes / 60).toFixed(1)),
  }));

  return (
    <div className="h-64 w-full" role="img" aria-label="Grafik tren jam kerja">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => `${value} jam`}
          />
          <Line
            type="monotone"
            dataKey="jam"
            name="Jam kerja"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="lembur"
            name="Lembur"
            stroke="var(--warning)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}