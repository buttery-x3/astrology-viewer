import {
  normalizeDegrees, normalizeVector, sphericalToVector, vectorToSpherical,
  type ObserverCoordinates, type Vector3,
} from '../astronomy/coordinates';
import type { BodyId, BodyPosition, EphemerisSnapshot } from '../astronomy/ephemeris';

export const ASTRO_ANGLES = ['ac', 'dc', 'mc', 'ic'] as const;
export type AstroAngle = typeof ASTRO_ANGLES[number];
export const ASTROCARTOGRAPHY_CONVENTION = 'geocentric-apparent-in-mundo-unrefracted' as const;
const RAD = Math.PI / 180;
const EPSILON = 1e-12;

/** Unit Earth-fixed astronomical axes: +X Greenwich, +Y90°E, +Z geographic north. */
export interface GeographicSample extends ObserverCoordinates {
  point: Vector3;
  /** Pole meridians and rise/set tangencies do not have an ordinary crossing. */
  singularity?: 'pole' | 'tangent';
}
export interface AstroLine {
  id: `astro:${BodyId}:${AstroAngle}`;
  bodyId: BodyId;
  angle: AstroAngle;
  status: 'valid' | 'undefined';
  reason?: string;
  /** Separate paths at the antimeridian; no artificial longitude-wrap chord. */
  segments: GeographicSample[][];
  anchor: GeographicSample | null;
  rightAscensionDeg: number;
  declinationDeg: number;
  /** Rise/set exists only within this latitude range; endpoints are tangencies. */
  crossingLatitudeRange: readonly [number, number] | null;
  notes: string[];
}
export interface Astrocartography {
  instantMs: number;
  convention: typeof ASTROCARTOGRAPHY_CONVENTION;
  greenwichSiderealTimeDeg: number;
  lines: AstroLine[];
}
export interface AstroGeometryOptions { maximumStepDeg?: number }

export function geographicSample(point: Vector3, poleLongitudeDeg = 0): GeographicSample {
  const unit = normalizeVector(point), coordinates = vectorToSpherical(unit);
  const atPole = Math.hypot(unit.x, unit.y) < EPSILON;
  return {
    point: unit, latitudeDeg: coordinates.latitudeDeg,
    longitudeDeg: signedLongitude(atPole ? poleLongitudeDeg : coordinates.longitudeDeg),
    ...(atPole ? { singularity: 'pole' as const } : {}),
  };
}
export function signedLongitude(value: number): number { return normalizeDegrees(value + 180) - 180; }

/** The seam point is the intersection of the same great-circle plane with y=0. */
export function splitGeographicAntimeridian(samples: readonly GeographicSample[]): GeographicSample[][] {
  if (!samples.length) return [];
  const segments: GeographicSample[][] = [[samples[0]!]];
  for (let index = 1; index < samples.length; index++) {
    const a = samples[index - 1]!, b = samples[index]!;
    const current = segments[segments.length - 1]!;
    if (Math.abs(b.longitudeDeg - a.longitudeDeg) > 180 && a.singularity !== 'pole' && b.singularity !== 'pole') {
      const denominator = a.point.y - b.point.y;
      const fraction = Math.abs(denominator) > EPSILON ? a.point.y / denominator : 0.5;
      const intersection = geographicSample({
        x: a.point.x + (b.point.x - a.point.x) * fraction,
        y: 0, z: a.point.z + (b.point.z - a.point.z) * fraction,
      });
      if (fraction < EPSILON && a.singularity) intersection.singularity = a.singularity;
      else if (fraction > 1 - EPSILON && b.singularity) intersection.singularity = b.singularity;
      const longitude = a.longitudeDeg > 0 ? 180 : -180;
      current.push({ ...intersection, longitudeDeg: longitude });
      segments.push([{ ...intersection, longitudeDeg: -longitude }, b]);
    } else current.push(b);
  }
  return segments.map(segment => segment.filter((point, index) => index === 0 || Math.hypot(
    point.point.x - segment[index - 1]!.point.x, point.point.y - segment[index - 1]!.point.y, point.point.z - segment[index - 1]!.point.z,
  ) > EPSILON)).filter(segment => segment.length >= 2);
}

/** Classification is deliberately separate from rendering and never clamps an impossible acos. */
export function riseSetState(latitudeDeg: number, declinationDeg: number): 'crossing' | 'tangent' | 'always-above' | 'always-below' | 'on-horizon' {
  if (![latitudeDeg, declinationDeg].every(value => Number.isFinite(value) && Math.abs(value) <= 90)) throw new RangeError('Latitude and declination must be finite and within±90°.');
  const centre = Math.sin(latitudeDeg * RAD) * Math.sin(declinationDeg * RAD);
  const amplitude = Math.cos(latitudeDeg * RAD) * Math.cos(declinationDeg * RAD);
  if (Math.abs(amplitude) < EPSILON && Math.abs(centre) < EPSILON) return 'on-horizon';
  if (centre - amplitude > EPSILON) return 'always-above';
  if (centre + amplitude < -EPSILON) return 'always-below';
  if (Math.abs(Math.abs(centre) - amplitude) < EPSILON) return 'tangent';
  return 'crossing';
}

/**
 * Construct the geometric terminator directly as a great circle, then split it
 * by the sign of vertical motion. This stays conditioned at tangent latitudes
 * and at δ=0, where solving latitude-by-latitude with tan(phi) is singular.
 */
export function buildBodyAstrocartography(
  body: Pick<BodyPosition, 'id' | 'equatorial'>, greenwichSiderealTimeDeg: number,
  options: AstroGeometryOptions = {},
): AstroLine[] {
  const { rightAscensionDeg: ra, declinationDeg: dec } = body.equatorial;
  const maximumStep = options.maximumStepDeg ?? 2;
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || Math.abs(dec) > 90 || !Number.isFinite(greenwichSiderealTimeDeg)) throw new RangeError('Astrocartography requires finite of-date RA, declination and GAST.');
  if (!Number.isFinite(maximumStep) || maximumStep < 0.1 || maximumStep > 10) throw new RangeError('Astrocartography maximum step must be0.1–10°.');
  const longitude = signedLongitude(ra - greenwichSiderealTimeDeg);
  const base = { bodyId: body.id, rightAscensionDeg: normalizeDegrees(ra), declinationDeg: dec };
  if (Math.abs(Math.cos(dec * RAD)) < EPSILON) return ASTRO_ANGLES.map(angle => ({
    ...base, id: `astro:${body.id}:${angle}`, angle, status: 'undefined', segments: [], anchor: null,
    crossingLatitudeRange: null, reason: 'At a celestial pole the body has no unique rise/set crossing or upper/lower meridian transit.', notes: [],
  }));
  const count = Math.ceil(180 / maximumStep);
  const meridianEast = { x: -Math.sin(longitude * RAD), y: Math.cos(longitude * RAD), z: 0 };
  const tangent = { x: -Math.sin(dec * RAD) * Math.cos(longitude * RAD), y: -Math.sin(dec * RAD) * Math.sin(longitude * RAD), z: Math.cos(dec * RAD) };
  const extent = 90 - Math.abs(dec);
  return ASTRO_ANGLES.map(angle => {
    const rising = angle === 'ac', horizon = rising || angle === 'dc';
    const lineLongitude = signedLongitude(longitude + (angle === 'ic' ? 180 : 0));
    const values = Array.from({ length: count + 1 }, (_, index): GeographicSample => {
      if (!horizon) {
        const latitudeDeg = -90 + 180 * index / count;
        return geographicSample(sphericalToVector({ longitudeDeg: lineLongitude, latitudeDeg }), lineLongitude);
      }
      const phase = (rising ? -1 : 1) * Math.PI * index / count;
      const point = {
        x: tangent.x * Math.cos(phase) + meridianEast.x * Math.sin(phase),
        y: tangent.y * Math.cos(phase) + meridianEast.y * Math.sin(phase),
        z: tangent.z * Math.cos(phase),
      };
      const sample = geographicSample(point, longitude + (rising ? -90 : 90));
      if ((index === 0 || index === count) && sample.singularity !== 'pole') sample.singularity = 'tangent';
      return sample;
    });
    const anchor = horizon
      ? geographicSample({ x: (rising ? -1 : 1) * meridianEast.x, y: (rising ? -1 : 1) * meridianEast.y, z: 0 })
      : geographicSample(sphericalToVector({ longitudeDeg: lineLongitude, latitudeDeg: 0 }));
    return {
      ...base, id: `astro:${body.id}:${angle}`, angle, status: 'valid', segments: splitGeographicAntimeridian(values), anchor,
      crossingLatitudeRange: horizon ? [-extent, extent] as const : null,
      notes: horizon
        ? ['The two branch endpoints are tangent/no-crossing limits; geographic poles have no unique meridian.', 'Geocentric body centre, no atmospheric refraction or topocentric parallax.']
        : ['Upper/lower meridian transit is not necessarily zenith/nadir and can occur below the horizon.', 'Geographic pole endpoints have no unique local meridian.'],
    } satisfies AstroLine;
  });
}

export function buildAstrocartography(snapshot: Pick<EphemerisSnapshot, 'instantMs' | 'bodies' | 'greenwichSiderealTimeDeg'>, options: AstroGeometryOptions = {}): Astrocartography {
  if (!Number.isFinite(snapshot.instantMs)) throw new RangeError('A finite displayed instant is required.');
  return {
    instantMs: snapshot.instantMs, convention: ASTROCARTOGRAPHY_CONVENTION,
    greenwichSiderealTimeDeg: normalizeDegrees(snapshot.greenwichSiderealTimeDeg),
    lines: snapshot.bodies.flatMap(body => buildBodyAstrocartography(body, snapshot.greenwichSiderealTimeDeg, options)),
  };
}
