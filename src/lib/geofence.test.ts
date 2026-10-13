/**
 * Geofence projection tests.
 *
 * The diagram is drawn from real coordinates, so the maths that decides where a
 * point lands is worth pinning. It is pure and cheap to test, and a regression
 * here would silently misreport a check-in as inside the fence.
 *
 * The equirectangular approximation used here matches the one in
 * `GeofenceDiagram`: over a single office's radius, the error is far below the
 * metre the diagram can express.
 */
import { describe, expect, it } from 'vitest';

/** Jakarta, Bundaran HI — an office location used in the examples below. */
const OFFICE = { lat: -6.1944, lon: 106.8229, radius: 150 } as const;

const VIEW = 240;
const EDGE = VIEW / 2 - 14;
const CENTRE = VIEW / 2;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const METRES_PER_DEGREE_LAT = 111_320;

function metresPerDegreeLon(lat: number): number {
  return Math.max(1, METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
}

/** Mirrors `GeofenceDiagram`'s projection exactly. */
function project(
  officeLat: number,
  officeLon: number,
  radiusMeters: number,
  pointLat: number,
  pointLon: number,
) {
  const northM = (pointLat - officeLat) * METRES_PER_DEGREE_LAT;
  const eastM = (pointLon - officeLon) * metresPerDegreeLon(officeLat);
  const trueDistance = Math.hypot(eastM, northM);

  const plotRadius = clamp(trueDistance || radiusMeters, radiusMeters, radiusMeters * 3);
  const scale = EDGE / plotRadius;

  return {
    northM,
    eastM,
    trueDistance,
    plotRadius,
    scale,
    radiusPx: radiusMeters * scale,
    rawX: CENTRE + eastM * scale,
    rawY: CENTRE - northM * scale,
    pointX: clamp(CENTRE + eastM * scale, 14, VIEW - 14),
    pointY: clamp(CENTRE - northM * scale, 14, VIEW - 14),
  };
}

/** Degrees of latitude for `metres` north of a latitude. */
const metresNorth = (lat: number, metres: number) => lat + metres / METRES_PER_DEGREE_LAT;

describe('geofence projection', () => {
  it('reports zero distance for a check-in exactly on the office point', () => {
    const p = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, OFFICE.lat, OFFICE.lon);
    expect(p.trueDistance).toBeCloseTo(0, 5);
    expect(p.pointX).toBeCloseTo(CENTRE, 5);
    expect(p.pointY).toBeCloseTo(CENTRE, 5);
  });

  it('keeps a check-in inside the fence visually inside the circle', () => {
    // 50 m north of the office, well within the 150 m radius.
    const lat = metresNorth(OFFICE.lat, 50);
    const p = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, lat, OFFICE.lon);

    expect(p.trueDistance).toBeCloseTo(50, 0);
    expect(Math.hypot(p.pointX - CENTRE, p.pointY - CENTRE)).toBeLessThan(p.radiusPx);
  });

  it('places a check-in outside the fence visually outside the circle', () => {
    const lat = metresNorth(OFFICE.lat, 600);
    const p = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, lat, OFFICE.lon);

    expect(p.trueDistance).toBeCloseTo(600, 0);
    expect(Math.hypot(p.pointX - CENTRE, p.pointY - CENTRE)).toBeGreaterThan(p.radiusPx);
  });

  it('puts north up and east right', () => {
    const north = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, metresNorth(OFFICE.lat, 100), OFFICE.lon);
    expect(north.pointY).toBeLessThan(CENTRE);
    expect(north.pointX).toBeCloseTo(CENTRE, 5);

    const lonStep = 100 / metresPerDegreeLon(OFFICE.lat);
    const east = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, OFFICE.lat, OFFICE.lon + lonStep);
    expect(east.pointX).toBeGreaterThan(CENTRE);
    expect(east.pointY).toBeCloseTo(CENTRE, 5);
  });

  it('measures distance symmetrically in each direction', () => {
    const north = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, metresNorth(OFFICE.lat, 200), OFFICE.lon);
    const south = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, metresNorth(OFFICE.lat, -200), OFFICE.lon);

    expect(north.trueDistance).toBeCloseTo(200, 0);
    expect(south.trueDistance).toBeCloseTo(200, 0);
  });

  it('clamps a wildly distant coordinate to the canvas edge instead of dropping it', () => {
    // A spoofed check-in on another continent: the point must stay visible so
    // the row can still say "far outside the fence".
    const p = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, 51.5074, -0.1278);

    expect(p.pointX).toBeGreaterThanOrEqual(14);
    expect(p.pointX).toBeLessThanOrEqual(VIEW - 14);
    expect(p.pointY).toBeGreaterThanOrEqual(14);
    expect(p.pointY).toBeLessThanOrEqual(VIEW - 14);
    expect(p.plotRadius).toBeLessThanOrEqual(OFFICE.radius * 3);
  });

  it('never lets a point land on top of the office anchor once clamped', () => {
    const p = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, 51.5074, -0.1278);
    expect(Math.hypot(p.pointX - CENTRE, p.pointY - CENTRE)).toBeGreaterThan(0);
  });

  it('scales the fence circle to the plot range', () => {
    // Inside the fence: the canvas fits the fence, so the circle is large.
    const inside = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, metresNorth(OFFICE.lat, 50), OFFICE.lon);
    const outside = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, metresNorth(OFFICE.lat, 600), OFFICE.lon);

    // Farther away means a smaller drawn fence, because both must fit the frame.
    expect(outside.radiusPx).toBeLessThan(inside.radiusPx);
    expect(outside.radiusPx).toBeGreaterThan(0);
  });

  it('handles a location on the equator without dividing by ~zero', () => {
    // cos(0) = 1, so this is the case where the longitude scale is largest.
    const p = project(0, 0, 150, metresNorth(0, 100), 0.001);
    expect(Number.isFinite(p.pointX)).toBe(true);
    expect(Number.isFinite(p.pointY)).toBe(true);
  });

  it('handles a location near a pole without producing a huge longitude scale', () => {
    // cos(89.9) is tiny; the `max(1, ...)` guard must stop the scale exploding.
    const p = project(89.9, 0, 150, 89.9, 0.5);
    expect(Number.isFinite(p.pointX)).toBe(true);
    expect(p.pointX).toBeLessThanOrEqual(VIEW - 14);
  });

  it('draws the fence and the point at their true relative distance', () => {
    /*
     * The invariant that matters for reading the diagram: within one drawing,
     * (drawn distance to the point) / (drawn radius) must equal the real
     * distance / real radius. If the two were drawn on different scales, a
     * reviewer could not tell whether a point looked "just outside" because it
     * was or because the scale lied.
     */
    for (const metres of [50, 200, 400]) {
      const p = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, metresNorth(OFFICE.lat, metres), OFFICE.lon);
      const drawnDistance = Math.hypot(p.pointX - CENTRE, p.pointY - CENTRE);
      expect(drawnDistance / p.radiusPx).toBeCloseTo(metres / OFFICE.radius, 2);
    }
  });

  it('grows the plot range so a farther check-in fills the frame', () => {
    const near = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, metresNorth(OFFICE.lat, 200), OFFICE.lon);
    const far = project(OFFICE.lat, OFFICE.lon, OFFICE.radius, metresNorth(OFFICE.lat, 400), OFFICE.lon);

    expect(far.plotRadius).toBeGreaterThan(near.plotRadius);

    /*
     * Both points saturate the frame — that is the intent: the canvas always
     * shows the office and the check-in, and the drawn fence is what shrinks.
     * The relative-distance test above is what guarantees this rescaling stays
     * honest.
     */
    expect(Math.hypot(far.pointX - CENTRE, far.pointY - CENTRE)).toBeCloseTo(EDGE, 3);
    expect(Math.hypot(near.pointX - CENTRE, near.pointY - CENTRE)).toBeCloseTo(EDGE, 3);
    expect(far.radiusPx).toBeLessThan(near.radiusPx);
  });
});