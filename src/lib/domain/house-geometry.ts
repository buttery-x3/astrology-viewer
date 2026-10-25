import {
  equatorialOfDateToFixed, equatorialToVector, eclipticToEquatorial,
  fixedToEquatorialOfDate, vectorToEquatorial, equatorialToEcliptic,
  normalizeDegrees, signedAngularDifferenceDegrees, type Vector3,
} from '../astronomy/coordinates';
import type { BodyId, BodyPosition, EphemerisSnapshot, HouseResult, HouseSystemId } from '../astronomy/ephemeris';
import { classifyLongitude, housePartition, type HouseInterval } from './chart';

export interface HouseDisplaySettings {
  mode: 'volumes' | 'arcs' | 'shells';
  opacity: number;
  /** Add the selected region's radial volume while displaying boundary arcs. */
  hybrid: boolean;
  /** Selected shell's radial lift, as a fraction of the undisplaced sky radius. */
  shellSeparation: number;
  contextFill: boolean;
  comparisonChangesOnly: boolean;
}
export const DEFAULT_HOUSE_DISPLAY: Readonly<HouseDisplaySettings> = Object.freeze({
  mode: 'arcs', opacity: 0.14, hybrid: true, shellSeparation: 0.04,
  contextFill: false, comparisonChangesOnly: true,
});
export const HOUSE_PICKING_MAX_ABS_LATITUDE_DEG = 88;
export const HOUSE_BOUNDARY_COMPARISON_TOLERANCE_DEG = 1e-7;
export const HOUSE_DISPLAY_CONVENTION = 'constant-ecliptic-longitude' as const;

export interface HouseMesh {
  /** Unit fixed-J2000 directions. A radial volume additionally includes (0,0,0). */
  positions: Vector3[];
  /** Outward-facing triangle indices, including clockwise polar partitions. */
  indices: number[];
}
export interface HouseBoundaryGeometry {
  id: string;
  house: number;
  longitudeDeg: number;
  anchor: Vector3;
  /** Constant-longitude semicircle from ecliptic south pole to north pole. */
  line: Vector3[];
  /** The same boundary without ambiguous pole areas, for renderer hit targets. */
  pickingLine: Vector3[];
}
export interface HouseRegionGeometry extends HouseInterval {
  id: string;
  midpointLongitudeDeg: number;
  anchor: Vector3;
  eclipticArc: Vector3[];
  surface: HouseMesh;
  volume: HouseMesh;
}
export type HouseGeometry = {
  status: 'valid'; system: HouseSystemId; convention: typeof HOUSE_DISPLAY_CONVENTION;
  regions: HouseRegionGeometry[]; boundaries: HouseBoundaryGeometry[];
} | {
  status: 'undefined'; system: HouseSystemId; convention: typeof HOUSE_DISPLAY_CONVENTION;
  reason: string; regions: []; boundaries: [];
};
export interface HouseGeometryOptions { longitudeStepDeg?: number; latitudeStepDeg?: number }
type SkyFrame = Pick<EphemerisSnapshot, 'trueObliquityDeg' | 'frame'>;

function direction(snapshot: SkyFrame, longitudeDeg: number, latitudeDeg: number): Vector3 {
  return equatorialOfDateToFixed(equatorialToVector(eclipticToEquatorial({ longitudeDeg, latitudeDeg }, snapshot.trueObliquityDeg)), snapshot.frame);
}
function step(value: number | undefined, fallback: number): number {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result < 0.25 || result > 30) throw new RangeError('House geometry steps must be between 0.25° and 30°.');
  return result;
}
function samples(start: number, end: number, maximumStep: number): number[] {
  const count = Math.max(1, Math.ceil(Math.abs(end - start) / maximumStep));
  return Array.from({ length: count + 1 }, (_, index) => start + (end - start) * index / count);
}
function addTriangle(mesh: HouseMesh, a: number, b: number, c: number, reversed: boolean): void {
  const first = mesh.positions[a]!, second = mesh.positions[b]!, third = mesh.positions[c]!;
  const ux = second.x - first.x, uy = second.y - first.y, uz = second.z - first.z;
  const vx = third.x - first.x, vy = third.y - first.y, vz = third.z - first.z;
  // Longitudes meet at either pole. Omit zero-area triangles instead of sending
  // unstable normals to the renderer; coincident pole vertices are intentional.
  if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-14) return;
  mesh.indices.push(a, reversed ? c : b, reversed ? b : c);
}

/**
 * A shared longitude extension for display, not a house construction algorithm.
 * All modes use these exact intervals. Shell lift, opacity and hybrid state are
 * renderer choices and never alter the returned region or body membership.
 */
export function buildHouseGeometry(snapshot: SkyFrame, result: HouseResult, options: HouseGeometryOptions = {}): HouseGeometry {
  const longitudeStep = step(options.longitudeStepDeg, 5), latitudeStep = step(options.latitudeStepDeg, 5);
  const partition = housePartition(result);
  if (partition.status === 'undefined') return { status: 'undefined', system: result.system, convention: HOUSE_DISPLAY_CONVENTION, reason: partition.reason, regions: [], boundaries: [] };
  const latitudes = samples(-90, 90, latitudeStep);
  const pickingLatitudes = samples(-HOUSE_PICKING_MAX_ABS_LATITUDE_DEG, HOUSE_PICKING_MAX_ABS_LATITUDE_DEG, latitudeStep);
  const boundaries = partition.intervals.map((interval): HouseBoundaryGeometry => ({
    id: `boundary:${interval.house}`, house: interval.house, longitudeDeg: interval.startDeg,
    anchor: direction(snapshot, interval.startDeg, 0),
    line: latitudes.map((latitude) => direction(snapshot, interval.startDeg, latitude)),
    pickingLine: pickingLatitudes.map((latitude) => direction(snapshot, interval.startDeg, latitude)),
  }));
  const regions = partition.intervals.map((interval): HouseRegionGeometry => {
    const longitudes = samples(interval.startDeg, interval.startDeg + interval.direction * interval.widthDeg, longitudeStep);
    const columns = longitudes.length;
    const positions = latitudes.flatMap((latitude) => longitudes.map((longitude) => direction(snapshot, longitude, latitude)));
    const surface: HouseMesh = { positions, indices: [] };
    const reversed = interval.direction === -1;
    for (let row = 0; row < latitudes.length - 1; row++) for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column, b = a + 1, c = a + columns, d = c + 1;
      addTriangle(surface, a, b, c, reversed);
      addTriangle(surface, b, d, c, reversed);
    }
    const volume: HouseMesh = { positions: [...positions, { x: 0, y: 0, z: 0 }], indices: [...surface.indices] };
    const centre = volume.positions.length - 1;
    for (let row = 0; row < latitudes.length - 1; row++) {
      const start = row * columns, nextStart = start + columns;
      const end = start + columns - 1, nextEnd = nextStart + columns - 1;
      addTriangle(volume, centre, start, nextStart, reversed);
      addTriangle(volume, centre, nextEnd, end, reversed);
    }
    const midpointLongitudeDeg = normalizeDegrees(interval.startDeg + interval.direction * interval.widthDeg / 2);
    return {
      ...interval, id: `house:${interval.house}`, midpointLongitudeDeg,
      anchor: direction(snapshot, midpointLongitudeDeg, 0),
      eclipticArc: longitudes.map((longitude) => direction(snapshot, longitude, 0)),
      surface, volume,
    };
  });
  return { status: 'valid', system: result.system, convention: HOUSE_DISPLAY_CONVENTION, regions, boundaries };
}

/** Reject pole-area region picking, where longitude has no stable visual identity. */
export function isHouseDirectionPickable(snapshot: SkyFrame, fixedDirection: Vector3): boolean {
  const equatorial = vectorToEquatorial(fixedToEquatorialOfDate(fixedDirection, snapshot.frame));
  const ecliptic = equatorialToEcliptic(equatorial, snapshot.trueObliquityDeg);
  return Math.abs(ecliptic.latitudeDeg) <= HOUSE_PICKING_MAX_ABS_LATITUDE_DEG;
}

export interface HouseAssignmentComparisonRow {
  bodyId: BodyId;
  primaryHouse: number | null;
  secondaryHouse: number | null;
  primaryStatus: 'valid' | 'undefined';
  secondaryStatus: 'valid' | 'undefined';
  primaryReason?: string;
  secondaryReason?: string;
  /** Only true when both assignments are defined and differ. */
  changed: boolean;
}
export interface HouseComparisonRegion {
  startDeg: number; endDeg: number; widthDeg: number;
  primaryHouse: number; secondaryHouse: number; changed: boolean;
}
export interface HouseAssignmentComparison {
  status: 'valid' | 'undefined';
  reason?: string;
  primaryStatus: 'valid' | 'undefined';
  secondaryStatus: 'valid' | 'undefined';
  primaryReason?: string;
  secondaryReason?: string;
  rows: HouseAssignmentComparisonRow[];
  /** False with undefined status means uncomparable, not equal boundaries. */
  boundariesChanged: boolean;
  changedBoundaryHouses: number[];
  /** Every interval in the union of both sets of cusp breakpoints. */
  regions: HouseComparisonRegion[];
  /** The exact subset with different numbered-house assignments. */
  changedRegions: HouseComparisonRegion[];
}

export function compareHouseAssignments(
  bodies: readonly Pick<BodyPosition, 'id' | 'longitudeDeg'>[], primary: HouseResult, secondary: HouseResult,
): HouseAssignmentComparison {
  const primaryPartition = housePartition(primary), secondaryPartition = housePartition(secondary);
  const rows = bodies.map((body): HouseAssignmentComparisonRow => {
    const first = classifyLongitude(primary, body.longitudeDeg), second = classifyLongitude(secondary, body.longitudeDeg);
    return {
      bodyId: body.id,
      primaryHouse: first.status === 'valid' ? first.house : null,
      secondaryHouse: second.status === 'valid' ? second.house : null,
      primaryStatus: first.status, secondaryStatus: second.status,
      ...(first.status === 'undefined' ? { primaryReason: first.reason } : {}),
      ...(second.status === 'undefined' ? { secondaryReason: second.reason } : {}),
      changed: first.status === 'valid' && second.status === 'valid' && first.house !== second.house,
    };
  });
  const base = {
    rows, primaryStatus: primaryPartition.status, secondaryStatus: secondaryPartition.status,
    ...(primaryPartition.status === 'undefined' ? { primaryReason: primaryPartition.reason } : {}),
    ...(secondaryPartition.status === 'undefined' ? { secondaryReason: secondaryPartition.reason } : {}),
  };
  if (primaryPartition.status === 'undefined' || secondaryPartition.status === 'undefined') {
    return {
      ...base, status: 'undefined', boundariesChanged: false, changedBoundaryHouses: [], regions: [], changedRegions: [],
      reason: [base.primaryReason ? `Primary: ${base.primaryReason}` : '', base.secondaryReason ? `Comparison: ${base.secondaryReason}` : ''].filter(Boolean).join(' '),
    };
  }
  const changedBoundaryHouses = primaryPartition.intervals.filter((interval, index) =>
    Math.abs(signedAngularDifferenceDegrees(interval.startDeg, secondaryPartition.intervals[index]!.startDeg)) > HOUSE_BOUNDARY_COMPARISON_TOLERANCE_DEG,
  ).map((interval) => interval.house);
  const breaks = [...new Set([...primaryPartition.intervals, ...secondaryPartition.intervals].map((interval) => interval.startDeg))].sort((a, b) => a - b);
  const regions = breaks.map((startDeg, index): HouseComparisonRegion => {
    const endDeg = breaks[(index + 1) % breaks.length]!;
    const widthDeg = normalizeDegrees(endDeg - startDeg), midpoint = normalizeDegrees(startDeg + widthDeg / 2);
    const first = classifyLongitude(primary, midpoint), second = classifyLongitude(secondary, midpoint);
    if (first.status !== 'valid' || second.status !== 'valid') throw new Error('A validated house partition lost its midpoint assignment.');
    return { startDeg, endDeg, widthDeg, primaryHouse: first.house, secondaryHouse: second.house, changed: first.house !== second.house };
  });
  return { ...base, status: 'valid', boundariesChanged: changedBoundaryHouses.length > 0, changedBoundaryHouses, regions, changedRegions: regions.filter((region) => region.changed) };
}
