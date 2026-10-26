import {
  equatorialOfDateToFixed, fixedToEquatorialOfDate, rotateVector,
  normalizeVector, sphericalToVector, equatorialToEcliptic, vectorToEquatorial, signedAngularDifferenceDegrees,
  type Vector3,
} from '../astronomy/coordinates';
import { BODY_IDS, type BodyId, type EphemerisSnapshot, type HouseResult, type HouseSystemId } from '../astronomy/ephemeris';
import { ASTRO_ANGLES, geographicSample, type AstroAngle, type GeographicSample } from './astrocartography';
import { buildHouseGeometry, type HouseGeometryOptions, type HouseMesh } from './house-geometry';
import { classifyLongitude, housePartition } from './chart';

export interface EarthProjectionSettings {
  enabled: boolean; houses: boolean; astrocartography: boolean;
  houseOpacity: number; astroOpacity: number;
  bodies: Record<BodyId, boolean>; angles: Record<AstroAngle, boolean>;
}
export const DEFAULT_EARTH_PROJECTIONS: Readonly<EarthProjectionSettings> = Object.freeze({
  enabled: true, houses: true, astrocartography: true, houseOpacity: 0.14, astroOpacity: 0.55,
  bodies: Object.freeze(Object.fromEntries(BODY_IDS.map(id => [id, true])) as Record<BodyId, boolean>),
  angles: Object.freeze(Object.fromEntries(ASTRO_ANGLES.map(id => [id, true])) as Record<AstroAngle, boolean>),
});
type EarthFrame = Pick<EphemerisSnapshot, 'frame' | 'greenwichSiderealTimeDeg'>;
/** Sub-pixel numerical snap only; preserves half-open cusp identity after frame round trips. */
export const EARTH_HOUSE_BOUNDARY_TOLERANCE_DEG = 1e-8;

/** The controls and renderer must report the same unavailable partition. */
export function earthHouseAvailability(result: HouseResult | undefined) {
  return result ? housePartition(result) : { status: 'undefined' as const, reason: 'No primary house result is available.' };
}

/** Fixed J2000 astronomical -> Earth-fixed astronomical (not Three.js axes). */
export function fixedToEarthDirection(point: Vector3, snapshot: EarthFrame): Vector3 {
  const ofDate = fixedToEquatorialOfDate(point, snapshot.frame);
  const angle = snapshot.greenwichSiderealTimeDeg * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return normalizeVector(rotateVector(ofDate, [c, s, 0, -s, c, 0, 0, 0, 1]));
}
export function earthToFixedDirection(point: Vector3, snapshot: EarthFrame): Vector3 {
  const angle = snapshot.greenwichSiderealTimeDeg * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return equatorialOfDateToFixed(normalizeVector(rotateVector(point, [c, -s, 0, s, c, 0, 0, 0, 1])), snapshot.frame);
}
export interface EarthHouseRegion {
  id: `earth:house:primary:${number}`; house: number; system: HouseSystemId;
  startDeg: number; endDeg: number; direction: 1 | -1; widthDeg: number;
  surface: HouseMesh; anchor: GeographicSample;
}
export interface EarthHouseBoundary {
  id: `earth:boundary:primary:${number}`; house: number; system: HouseSystemId;
  longitudeDeg: number; line: Vector3[]; pickingLine: Vector3[]; anchor: GeographicSample;
}
export type EarthHouseProjection = {
  status: 'valid'; system: HouseSystemId; convention: 'radial-constant-ecliptic-longitude';
  regions: EarthHouseRegion[]; boundaries: EarthHouseBoundary[];
} | {
  status: 'undefined'; system: HouseSystemId | null; convention: 'radial-constant-ecliptic-longitude';
  reason: string; regions: []; boundaries: [];
};

/** The current chart's exact partition, radially projected; never relocated charts. */
export function buildEarthHouseProjection(snapshot: EphemerisSnapshot, result: HouseResult | undefined = snapshot.houses[0], options: HouseGeometryOptions = {}): EarthHouseProjection {
  const convention = 'radial-constant-ecliptic-longitude' as const;
  if (!result) return { status: 'undefined', system: null, convention, reason: 'No primary house result is available.', regions: [], boundaries: [] };
  const geometry = buildHouseGeometry(snapshot, result, options);
  if (geometry.status === 'undefined') return { ...geometry, convention };
  const transform = (point: Vector3) => fixedToEarthDirection(point, snapshot);
  return {
    status: 'valid', system: geometry.system, convention,
    regions: geometry.regions.map(region => ({
      id: `earth:house:primary:${region.house}`, house: region.house, system: geometry.system,
      startDeg: region.startDeg, endDeg: region.endDeg, direction: region.direction, widthDeg: region.widthDeg,
      surface: { positions: region.surface.positions.map(transform), indices: region.surface.indices },
      anchor: geographicSample(transform(region.anchor)),
    })),
    boundaries: geometry.boundaries.map(boundary => ({
      id: `earth:boundary:primary:${boundary.house}`, house: boundary.house, system: geometry.system,
      longitudeDeg: boundary.longitudeDeg, line: boundary.line.map(transform), pickingLine: boundary.pickingLine.map(transform),
      anchor: geographicSample(transform(boundary.anchor)),
    })),
  };
}

/** Geographic points near an ecliptic pole have no stable house longitude. */
export function classifyEarthHouse(snapshot: EphemerisSnapshot, earthPoint: Vector3, result: HouseResult | undefined = snapshot.houses[0]): ReturnType<typeof classifyLongitude> {
  if (!result) return { status: 'undefined', reason: 'No primary house result is available.' };
  const equatorial = vectorToEquatorial(fixedToEquatorialOfDate(earthToFixedDirection(earthPoint, snapshot), snapshot.frame));
  const ecliptic = equatorialToEcliptic(equatorial, snapshot.trueObliquityDeg);
  if (Math.abs(ecliptic.latitudeDeg) > 88) return { status: 'undefined', reason: 'Longitude identity is ambiguous near the projected ecliptic poles.' };
  const cusp = result.status === 'valid' ? result.cusps.find(value => Math.abs(signedAngularDifferenceDegrees(ecliptic.longitudeDeg, value)) <= EARTH_HOUSE_BOUNDARY_TOLERANCE_DEG) : undefined;
  return classifyLongitude(result, cusp ?? ecliptic.longitudeDeg);
}

/** Useful for geographic keyboard targets without importing any Three.js objects. */
export function geographicToEarthDirection(latitudeDeg: number, longitudeDeg: number): Vector3 {
  return sphericalToVector({ latitudeDeg, longitudeDeg });
}
