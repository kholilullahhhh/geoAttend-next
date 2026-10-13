/**
 * Geofence diagram.
 *
 * A schematic of one check-in against its office, drawn entirely in SVG from
 * data already on the page.
 *
 * Why not an embedded map? Because the previous implementation linked out to
 * OpenStreetMap, and embedding tiles would send an employee's precise
 * check-in coordinates to a third party on every page load. A static diagram
 * answers the question an HR reviewer actually has — "was this inside the
 * fence, and by how much?" — without transmitting anything and without an API
 * key to leak or a tile provider to fail.
 *
 * The projection is deliberately schematic and is labelled as such: the office
 * sits at the centre, the radius is a circle around it, and the check-in point
 * is placed at its true bearing and distance, clamped to a visible range. North
 * is up. A reader must not mistake it for a survey drawing, so the caption
 * states the scale and the padding.
 */

export interface GeofenceDiagramProps {
  officeName: string;
  officeLat: number;
  officeLon: number;
  radiusMeters: number;
  checkInLat: number | null;
  checkInLon: number | null;
  /** Server-computed distance. Used for the label, not re-derived. */
  distanceMeters: number | null;
  accuracyMeters: number | null;
}

const VIEW = 240;
const CENTRE = VIEW / 2;

export function GeofenceDiagram({
  officeName,
  officeLat,
  officeLon,
  radiusMeters,
  checkInLat,
  checkInLon,
  distanceMeters,
  accuracyMeters,
}: GeofenceDiagramProps) {
  const hasPoint = Number.isFinite(checkInLat) && Number.isFinite(checkInLon);

  if (!hasPoint) {
    return (
      <p className="rounded-md border border-dashed border-line-strong bg-surface-alt px-md py-lg text-center text-sm text-ink-muted">
        Koordinat check-in tidak tersimpan pada catatan ini, sehingga diagram geofence tidak dapat
        digambar.
      </p>
    );
  }

  /*
   * Scale.
   *
   * The office fence is always drawn, and the canvas grows only as far as the
   * check-in demands — clamped to three radii, so a spoofed coordinate in
   * another country still renders as "far outside the fence" instead of
   * vanishing off-canvas. One scale factor drives everything, which is what
   * keeps the relationship between the fence and the point honest.
   */
  const EDGE = VIEW / 2 - 14;
  const MIN_PLOT = radiusMeters;
  const MAX_PLOT = radiusMeters * 3;

  const metresPerDegreeLat = 111_320;
  const metresPerDegreeLon = Math.max(
    1,
    111_320 * Math.cos((officeLat * Math.PI) / 180),
  );

  const northM = (checkInLat! - officeLat) * metresPerDegreeLat;
  const eastM = (checkInLon! - officeLon) * metresPerDegreeLon;
  const trueDistance = Math.hypot(eastM, northM);

  const plotRadius = clamp(trueDistance || MIN_PLOT, MIN_PLOT, MAX_PLOT);
  const scale = EDGE / plotRadius;

  const radiusPx = radiusMeters * scale;
  const rawX = CENTRE + eastM * scale;
  const rawY = CENTRE - northM * scale;
  const pointX = clamp(rawX, 14, VIEW - 14);
  const pointY = clamp(rawY, 14, VIEW - 14);
  const clamped = Math.abs(pointX - rawX) > 0.5 || Math.abs(pointY - rawY) > 0.5;

  const insideRadius =
    distanceMeters != null ? distanceMeters <= radiusMeters : trueDistance <= radiusMeters;
  const pointTone = insideRadius ? 'var(--success)' : 'var(--danger)';

  const accuracyPx =
    accuracyMeters != null && Number.isFinite(accuracyMeters)
      ? Math.min(accuracyMeters * scale, 28)
      : null;

  const bearing = bearingLabel(eastM, northM);

  /*
   * True drawn offset, before clamping. At a check-in 17 m from a 200 m fence
   * this is well under one pixel, so the connector line is suppressed rather
   * than drawn as a visible — and false — offset.
   */
  const drawnOffset = Math.hypot(pointX - CENTRE, pointY - CENTRE);
  const overlapping = drawnOffset < 6;

  return (
    <figure className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-md border border-line bg-surface-alt/50">
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="h-auto w-full max-w-72"
          role="img"
          aria-label={describe({
            officeName,
            radiusMeters,
            distanceMeters,
            accuracyMeters,
            bearing,
            inside: insideRadius,
          })}
        >
          {/* Range ring at the outer bound, for scale. */}
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={radiusPx * (plotRadius / radiusMeters)}
            fill="none"
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={radiusPx}
            fill="var(--accent-bright)"
            fillOpacity={0.1}
            stroke="var(--accent-bright)"
            strokeWidth={1.5}
          />

          {/* Accuracy halo. Reported, never adjusted. */}
          {accuracyPx != null && accuracyPx > 2 && (
            <circle
              cx={pointX}
              cy={pointY}
              r={accuracyPx}
              fill={pointTone}
              fillOpacity={0.14}
              stroke={pointTone}
              strokeOpacity={0.45}
              strokeDasharray="2 3"
            />
          )}

          {/*
            Connector drawn *under* both markers, and only when the two are far
            enough apart to see it. At a 17 m check-in against a 200 m fence the
            true offset is sub-pixel, so a visible line would be a lie; in that
            case the labels below carry the distance instead.
          */}
          {!overlapping && (
            <line
              x1={CENTRE}
              y1={CENTRE}
              x2={pointX}
              y2={pointY}
              stroke={pointTone}
              strokeWidth={1.5}
              strokeOpacity={0.8}
              strokeDasharray="4 3"
            />
          )}

          {/*
            Two *different shapes*, not two circles of different colour.

            A 17 m offset on a 200 m fence puts the two markers on top of each
            other, and colour alone cannot separate them there — a colour-blind
            reader would see one blob. A square for the office and a disc for the
            check-in stay distinguishable at any offset and in greyscale.
          */}
          <rect
            x={CENTRE - 4.5}
            y={CENTRE - 4.5}
            width={9}
            height={9}
            rx={1.5}
            fill="var(--accent-bright)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
          <circle
            cx={pointX}
            cy={pointY}
            r={5}
            fill={pointTone}
            stroke="var(--surface)"
            strokeWidth={2}
          />

          {/* North marker, so the bearing text below is verifiable. */}
          <path
            d={`M ${CENTRE} 6 l 4.5 10 h -9 z`}
            fill="var(--ink-muted)"
            fillOpacity={0.65}
          />
        </svg>

        <span
          className={`absolute top-2 left-2 inline-flex items-center rounded-pill px-2 py-0.5 text-2xs font-semibold ${
            insideRadius
              ? 'bg-success-soft text-success'
              : 'bg-danger-soft text-danger'
          }`}
        >
          {insideRadius ? 'Di dalam radius' : 'Di luar radius'}
        </span>

        {/*
          Marker key. Without it, a square and a disc two pixels apart need the
          caption to explain which is which — and the caption is prose, which is
          the wrong place to look when comparing two marks.
        */}
        <ul className="absolute top-2 right-2 flex flex-col items-end gap-1 text-2xs">
          <li className="inline-flex items-center gap-1.5 rounded-pill bg-surface/90 px-1.5 py-0.5 font-medium text-ink-secondary">
            <span
              aria-hidden="true"
              className="size-2 rounded-[2px] bg-accent-bright ring-1 ring-surface"
            />
            Kantor
          </li>
          <li className="inline-flex items-center gap-1.5 rounded-pill bg-surface/90 px-1.5 py-0.5 font-medium text-ink-secondary">
            <span
              aria-hidden="true"
              className={`size-2 rounded-pill ring-1 ring-surface ${
                insideRadius ? 'bg-success' : 'bg-danger'
              }`}
            />
            Check-in
          </li>
        </ul>
      </div>

      <figcaption className="text-xs leading-relaxed text-ink-muted">
        Skema, bukan peta satirik. Titik oranye adalah titik acuan{' '}
        <span className="font-medium text-ink-secondary">{officeName}</span> dengan radius{' '}
        {radiusMeters.toLocaleString('id-ID')} m; arah utara ke atas.
        {distanceMeters != null && (
          <>
            {' '}
            Jarak check-in <span className="tabular font-medium text-ink-secondary">{distanceMeters.toFixed(0)} m</span>{' '}
            pada arah {bearing}.
          </>
        )}
        {accuracyMeters != null && (
          <>
            {' '}
            Lingkaran putus-putus menunjukkan akurasi GPS yang dilaporkan perangkat (±
            <span className="tabular font-medium text-ink-secondary">
              {accuracyMeters.toFixed(0)} m
            </span>
            ), bukan koreksi posisi.
          </>
        )}
        {clamped && (
          <>
            {' '}
            Titik digambar pada posisi tepi karena jaraknya jauh melampaui radius; koordinat
            sebenarnya tetap tercetak di atas.
          </>
        )}
        {overlapping && distanceMeters != null && (
          <>
            {' '}
            Pada skala ini jarak {Math.round(distanceMeters)} m terlalu kecil untuk digambar
            terpisah dari titik kantor, sehingga kedua penanda bertumpuk.
          </>
        )}
      </figcaption>
    </figure>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Eight-point compass label from east/north offsets, in metres. */
function bearingLabel(eastM: number, northM: number): string {
  const raw = (Math.atan2(eastM, northM) * 180) / Math.PI;
  const angle = raw < 0 ? raw + 360 : raw;
  const names = [
    'Utara',
    'Timur laut',
    'Timur',
    'Tenggara',
    'Selatan',
    'Barat daya',
    'Barat',
    'Barat laut',
  ];
  return names[Math.round(angle / 45) % 8]!;
}

/** Sentence used as the SVG's accessible name. */
function describe(input: {
  officeName: string;
  radiusMeters: number;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  bearing: string;
  inside: boolean;
}): string {
  const parts = [
    `Diagram geofence untuk ${input.officeName}`,
    `radius ${input.radiusMeters} meter`,
    input.distanceMeters != null
      ? `jarak check-in ${Math.round(input.distanceMeters)} meter pada arah ${input.bearing}`
      : null,
    input.accuracyMeters != null
      ? `akurasi GPS ${Math.round(input.accuracyMeters)} meter`
      : null,
    input.inside ? 'berada di dalam radius' : 'berada di luar radius',
  ].filter(Boolean);
  return `${parts.join(', ')}.`;
}