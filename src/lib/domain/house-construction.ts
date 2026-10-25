import {
  eclipticToEquatorial, equatorialToEcliptic, equatorialToVector,
  equatorialOfDateToFixed, normalizeDegrees, normalizeVector,
  signedAngularDifferenceDegrees, vectorToEquatorial, type Vector3,
} from '../astronomy/coordinates';
import { ENGINE_REVISION, HOUSE_SYSTEMS, type EphemerisSnapshot, type HouseResult, type HouseSystemId } from '../astronomy/ephemeris';
import { housePartition } from './chart';
import { getSkyReferences } from './sky-reference';

export interface ConstructionSettings { enabled: boolean; boundaryHouse: number; stage: number; progress: number }
export const DEFAULT_CONSTRUCTION: Readonly<ConstructionSettings> = Object.freeze({ enabled: false, boundaryHouse: 1, stage: 2, progress: 1 });
export type ConstructionKind = 'reference' | 'division' | 'timing' | 'projection' | 'intersection';
export interface ConstructionSource { title: string; url: string; section: string }
export interface ConstructionStep { title: string; explanation: string; source: ConstructionSource }
export interface ConstructionLine { id: string; points: Vector3[]; kind: ConstructionKind; stage: 0 | 1 | 2; closed: boolean; label?: string }
export interface ConstructionMarker { id: string; point: Vector3; label: string; kind: ConstructionKind; stage: 0 | 1 | 2 }
export interface ConstructionTiming {
  declinationDeg?: number; hourAngleDeg?: number;
  semiDiurnalArcDeg?: number; semiNocturnalArcDeg?: number;
  siderealOffsetDeg?: number; siderealHours?: number; fraction?: number;
  sweepSiderealOffsetDeg?: number;
}
export interface ConstructionCuspCheck { house: number; nativeCuspDeg: number; computedCuspDeg: number; residualDeg: number }
export interface HouseConstruction {
  status: 'valid' | 'undefined' | 'incomplete'; system: HouseSystemId; house: number; name: string;
  steps: ConstructionStep[]; sources: ConstructionSource[];
  lines: ConstructionLine[]; markers: ConstructionMarker[];
  nativeCuspDeg: number | null; computedCuspDeg: number | null;
  residualDeg: number | null; maxResidualDeg: number | null;
  cuspChecks: ConstructionCuspCheck[]; notes: string[]; timing?: ConstructionTiming;
}
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
export const CONSTRUCTION_MAX_RESIDUAL_DEG = 0.01;
const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (a: Vector3, amount: number): Vector3 => ({ x: a.x * amount, y: a.y * amount, z: a.z * amount });
const add = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const cross = (a: Vector3, b: Vector3): Vector3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
type ValidHouses = Extract<HouseResult, { status: 'valid' }>;
const SOURCE_URL = `https://github.com/aloistr/swisseph/blob/${ENGINE_REVISION}/swehouse.c`;
const source = (system: HouseSystemId): ConstructionSource => ({
  title: 'Swiss Ephemeris — pinned house implementation', url: SOURCE_URL,
  section: `CalcH — ${system === 'P' ? 'default Placidus, VERY_SMALL_PLAC_ITER and opposite-cusp assignment' : `case '${system}' and opposite-cusp assignment`}`,
});
const STEP_TEXT: Record<HouseSystemId, readonly [string, string, string]> = {
  W: ['Locate the system’s Ascendant sign.', 'Advance one whole sign per house.', 'The sign’s starting degree is the cusp.'],
  E: ['Start at the system’s Ascendant degree.', 'Advance thirty degrees per house.', 'The resulting longitude defines the cusp.'],
  O: ['Use the system’s four principal angles.', 'Trisect each directed ecliptic quadrant.', 'The third marks locate intermediate cusps.'],
  R: ['Divide the celestial equator into twelve parts.', 'Project through the north and south horizon points.', 'Keep the system’s indexed ecliptic intersection.'],
  C: ['Divide the prime vertical into twelve parts.', 'Project through the north and south horizon points.', 'Keep the system’s indexed ecliptic intersection.'],
  P: ['Follow this cusp’s own declination circle.', 'Thirds divide rising or setting time.', 'Solve its time fraction on the ecliptic.'],
  K: ['Track the Midheaven degree’s rising arc.', 'Use its thirds to shift horizons.', 'Intersect each shifted horizon with the ecliptic.'],
};
class UndefinedConstruction extends Error {}
function basis(sky: EphemerisSnapshot, thetaDeg = normalizeDegrees(sky.greenwichSiderealTimeDeg + sky.observer.longitudeDeg)) {
  const phi = sky.observer.latitudeDeg * RAD, theta = thetaDeg * RAD;
  return {
    up: { x: Math.cos(phi) * Math.cos(theta), y: Math.cos(phi) * Math.sin(theta), z: Math.sin(phi) },
    north: { x: -Math.sin(phi) * Math.cos(theta), y: -Math.sin(phi) * Math.sin(theta), z: Math.cos(phi) },
    east: { x: -Math.sin(theta), y: Math.cos(theta), z: 0 },
  };
}
function eclipticNormal(sky: EphemerisSnapshot): Vector3 { return { x: 0, y: -Math.sin(sky.trueObliquityDeg * RAD), z: Math.cos(sky.trueObliquityDeg * RAD) }; }
function eclipticPoint(sky: EphemerisSnapshot, lambda: number): Vector3 { return equatorialToVector(eclipticToEquatorial({ longitudeDeg: lambda, latitudeDeg: 0 }, sky.trueObliquityDeg)); }
function longitude(sky: EphemerisSnapshot, point: Vector3): number { return equatorialToEcliptic(vectorToEquatorial(point), sky.trueObliquityDeg).longitudeDeg; }
function upperMeridian(sky: EphemerisSnapshot): number {
  const theta = (sky.greenwichSiderealTimeDeg + sky.observer.longitudeDeg) * RAD;
  return normalizeDegrees(Math.atan2(Math.sin(theta) / Math.cos(sky.trueObliquityDeg * RAD), Math.cos(theta)) * DEG);
}
function eastIntersection(sky: EphemerisSnapshot, theta: number): number {
  const local = basis(sky, theta), raw = cross(local.up, eclipticNormal(sky));
  if (Math.hypot(raw.x, raw.y, raw.z) < 1e-12) throw new UndefinedConstruction('The ecliptic and shifted horizon coincide; their intersection is not unique.');
  let ray = normalizeVector(raw);
  if (Math.abs(dot(ray, local.east)) < 1e-12) throw new UndefinedConstruction('The ecliptic is tangent to the shifted horizon; the rising branch is not unique.');
  if (dot(ray, local.east) < 0) ray = scale(ray, -1);
  return longitude(sky, ray);
}
function semiDiurnal(sky: EphemerisSnapshot, declinationDeg: number): number {
  const product = Math.tan(sky.observer.latitudeDeg * RAD) * Math.tan(declinationDeg * RAD);
  if (Math.abs(product) > 1) throw new UndefinedConstruction('This declination has no complete rise/set semi-arc at the observer latitude.');
  return Math.acos(-product) * DEG;
}
function placidusHourAngle(house: number, h0: number): number {
  return [NaN, -h0, -h0 - (180 - h0) / 3, -h0 - 2 * (180 - h0) / 3, -180,
    h0 + 2 * (180 - h0) / 3, h0 + (180 - h0) / 3, h0, 2 * h0 / 3, h0 / 3, 0, -h0 / 3, -2 * h0 / 3][house]!;
}
function placidusPhase(sky: EphemerisSnapshot, lambda: number, house: number): number {
  const equatorial = eclipticToEquatorial({ longitudeDeg: lambda, latitudeDeg: 0 }, sky.trueObliquityDeg);
  const h0 = semiDiurnal(sky, equatorial.declinationDeg);
  const current = sky.greenwichSiderealTimeDeg + sky.observer.longitudeDeg - equatorial.rightAscensionDeg;
  return signedAngularDifferenceDegrees(placidusHourAngle(house, h0), current);
}
/** Independent angular root search; no returned cusp is used as a seed. */
function solvePlacidus(sky: EphemerisSnapshot, house: number): number {
  const roots: number[] = [];
  const include = (value: number) => { const lambda = normalizeDegrees(value); if (!roots.some((old) => Math.abs(signedAngularDifferenceDegrees(old, lambda)) < 1e-7)) roots.push(lambda); };
  let previous = placidusPhase(sky, 0, house);
  for (let right = 1; right <= 360; right++) {
    const current = placidusPhase(sky, right, house);
    if (Math.abs(previous) < 1e-12) include(right - 1);
    if (previous * current < 0 && Math.abs(current - previous) < 180) {
      let low = right - 1, high = right, lower = previous;
      for (let iteration = 0; iteration < 50; iteration++) {
        const midpoint = (low + high) / 2, phase = placidusPhase(sky, midpoint, house);
        if (Math.abs(phase) < 1e-13) { low = high = midpoint; break; }
        if (lower * phase <= 0) high = midpoint; else { low = midpoint; lower = phase; }
      }
      include((low + high) / 2);
    }
    previous = current;
  }
  if (Math.abs(previous) < 1e-12) include(360);
  if (roots.length !== 1) throw new Error(`The independent Placidus solver found ${roots.length} roots for C${house}; validation is incomplete.`);
  return roots[0]!;
}
function kochOffset(house: number, h0: number): number {
  return ({ 11: -2 / 3, 12: -1 / 3, 2: 1 / 3, 3: 2 / 3, 5: -2 / 3, 6: -1 / 3, 8: 1 / 3, 9: 2 / 3 } as Record<number, number>)[house]! * h0;
}
function projectedDivision(sky: EphemerisSnapshot, system: 'R' | 'C', phaseDeg: number): { point: Vector3; division: Vector3 } {
  const local = basis(sky), theta = sky.greenwichSiderealTimeDeg + sky.observer.longitudeDeg;
  const division = system === 'R' ? equatorialToVector({ rightAscensionDeg: theta + phaseDeg, declinationDeg: 0 }) : add(scale(local.up, Math.cos(phaseDeg * RAD)), scale(local.east, Math.sin(phaseDeg * RAD)));
  const k = eclipticNormal(sky), divisor = dot(k, local.north);
  if (Math.abs(divisor) < 1e-12) throw new UndefinedConstruction('Projection is singular here; no unique guide branch is drawn.');
  return { point: normalizeVector(add(division, scale(local.north, -dot(k, division) / divisor))), division };
}
/** Independently reconstruct all indexed cusps from the method's defining inputs. */
export function reconstructHouseCusps(sky: EphemerisSnapshot, result: ValidHouses): number[] {
  const values = Array<number>(12).fill(NaN), theta = normalizeDegrees(sky.greenwichSiderealTimeDeg + sky.observer.longitudeDeg);
  if (result.system === 'W' || result.system === 'E') {
    const first = result.system === 'W' ? Math.floor(result.ascendantDeg / 30) * 30 : result.ascendantDeg;
    return values.map((_, index) => normalizeDegrees(first + index * 30));
  }
  if (result.system === 'O') {
    const anchors = [result.ascendantDeg, normalizeDegrees(result.midheavenDeg + 180), normalizeDegrees(result.ascendantDeg + 180), result.midheavenDeg];
    for (let quadrant = 0; quadrant < 4; quadrant++) for (let third = 0; third < 3; third++) values[quadrant * 3 + third] = normalizeDegrees(anchors[quadrant]! + third * normalizeDegrees(anchors[(quadrant + 1) % 4]! - anchors[quadrant]!) / 3);
    return values;
  }
  if (result.system === 'R' || result.system === 'C') return values.map((_, index) => longitude(sky, projectedDivision(sky, result.system as 'R' | 'C', normalizeDegrees((index + 1 - 10) * 30)).point));
  values[0] = eastIntersection(sky, theta); values[9] = upperMeridian(sky);
  if (result.system === 'K') {
    const mc = eclipticToEquatorial({ longitudeDeg: values[9], latitudeDeg: 0 }, sky.trueObliquityDeg);
    const h0 = semiDiurnal(sky, mc.declinationDeg);
    for (const house of [11, 12, 2, 3]) values[house - 1] = eastIntersection(sky, theta + kochOffset(house, h0));
  } else for (const house of [11, 12, 2, 3]) values[house - 1] = solvePlacidus(sky, house);
  for (const [base, opposite] of [[1, 7], [2, 8], [3, 9], [10, 4], [11, 5], [12, 6]]) values[opposite! - 1] = normalizeDegrees(values[base! - 1]! + 180);
  return values;
}
function arc(start: number, end: number, point: (phase: number) => Vector3, step = 4): Vector3[] {
  const count = Math.max(1, Math.ceil(Math.abs(end - start) / step));
  return Array.from({ length: count + 1 }, (_, index) => point(start + (end - start) * index / count));
}
function circle(first: Vector3, quarter: Vector3): Vector3[] {
  return Array.from({ length: 180 }, (_, index) => add(scale(first, Math.cos(index * 2 * Math.PI / 180)), scale(quarter, Math.sin(index * 2 * Math.PI / 180))));
}
function planeCircle(first: Vector3, other: Vector3): Vector3[] {
  const orthogonal = add(other, scale(first, -dot(first, other)));
  return circle(first, normalizeVector(orthogonal));
}

/** enabled/stage are presentation state; validation is always final and independent of sweep progress. */
export function buildHouseConstruction(sky: EphemerisSnapshot, result: HouseResult, settings: ConstructionSettings): HouseConstruction {
  if (!Number.isInteger(settings.boundaryHouse) || settings.boundaryHouse < 1 || settings.boundaryHouse > 12 || !Number.isInteger(settings.stage) || settings.stage < 0 || settings.stage > 2 || !Number.isFinite(settings.progress) || settings.progress < 0 || settings.progress > 1) throw new RangeError('Construction needs C1–C12, stage 0–2 and sweep progress 0–1.');
  const house = settings.boundaryHouse, citation = source(result.system);
  const guide: HouseConstruction = {
    status: 'undefined', system: result.system, house,
    name: `${HOUSE_SYSTEMS.find((item) => item.id === result.system)!.name} · C${house}`,
    steps: STEP_TEXT[result.system].map((explanation, index) => ({ title: ['Reference', 'Division / timing', 'Ecliptic intersection'][index]!, explanation, source: { ...citation } })),
    sources: [citation, { title: 'Construction guide coordinate contract', url: 'https://github.com/buttery-x3/astrology-viewer/blob/codex/development/docs/house-construction-contract.md', section: 'Timing-circle display convention; Sweep and validation' }], lines: [], markers: [], nativeCuspDeg: result.status === 'valid' ? result.cusps[house - 1]! : null,
    computedCuspDeg: null, residualDeg: null, maxResidualDeg: null, cuspChecks: [], notes: [],
  };
  const partition = housePartition(result);
  if (partition.status === 'undefined') { guide.notes.push(partition.reason); return guide; }
  if (result.status !== 'valid') return guide;
  try {
    const computed = reconstructHouseCusps(sky, result);
    guide.cuspChecks = computed.map((computedCuspDeg, index) => ({ house: index + 1, nativeCuspDeg: result.cusps[index]!, computedCuspDeg, residualDeg: Math.abs(signedAngularDifferenceDegrees(computedCuspDeg, result.cusps[index]!)) }));
    guide.computedCuspDeg = computed[house - 1]!;
    guide.residualDeg = guide.cuspChecks[house - 1]!.residualDeg;
    guide.maxResidualDeg = Math.max(...guide.cuspChecks.map((item) => item.residualDeg));
    if (!Number.isFinite(guide.maxResidualDeg) || guide.maxResidualDeg > CONSTRUCTION_MAX_RESIDUAL_DEG) { guide.status = 'incomplete'; guide.notes.push('Independent construction differs from the returned cusps by more than 0.01°. Geometry is withheld until the discrepancy is resolved.'); return guide; }
    const prefix = `construction:${result.system.toLowerCase()}:${house}`;
    const fixed = (point: Vector3) => equatorialOfDateToFixed(point, sky.frame);
    const line = (id: string, points: Vector3[], kind: ConstructionKind, stage: 0 | 1 | 2, closed: boolean, label: string) => guide.lines.push({ id: `${prefix}:${id}`, points: points.map(fixed), kind, stage, closed, label });
    const marker = (id: string, point: Vector3, label: string, kind: ConstructionKind, stage: 0 | 1 | 2) => guide.markers.push({ id: `${prefix}:${id}`, point: fixed(point), label, kind, stage });
    const ecl = (lambda: number) => eclipticPoint(sky, lambda);
    const theta = normalizeDegrees(sky.greenwichSiderealTimeDeg + sky.observer.longitudeDeg), local = basis(sky);
    const lambda = guide.computedCuspDeg;
    const ecliptic = circle(ecl(0), ecl(90));
    line('ecliptic', ecliptic, 'reference', result.system === 'W' || result.system === 'E' || result.system === 'O' ? 0 : 2, true, 'Ecliptic');
    if (result.system === 'W' || result.system === 'E' || result.system === 'O') {
      let start: number, span: number, division: number;
      if (result.system === 'O') {
        const quadrant = Math.floor((house - 1) / 3), index = quadrant * 3;
        start = computed[index]!; span = normalizeDegrees(computed[(index + 3) % 12]! - start); division = (house - 1) % 3;
        for (let third = 0; third <= 3; third++) marker(`third-${third}`, ecl(start + span * third / 3), `${third}/3`, 'division', 1);
      } else {
        start = computed[0]!; span = 330; division = house - 1;
        marker('ascendant', ecl(result.ascendantDeg), 'System ASC', 'reference', 0);
        for (let index = 0; index < 12; index++) marker(`division-${index + 1}`, ecl(start + index * 30), `C${index + 1}`, 'division', 1);
      }
      const targetSpan = result.system === 'O' ? span * division / 3 : division * 30;
      line('division-arc', arc(start, start + (result.system === 'O' ? span : 360), ecl), 'division', 1, false, result.system === 'O' ? 'Directed quadrant and thirds' : 'Thirty-degree longitude divisions');
      marker('sweep', ecl(start + targetSpan * settings.progress), 'Construction sweep', 'division', 1);
    } else if (result.system === 'R' || result.system === 'C') {
      const phase = normalizeDegrees((house - 10) * 30);
      const reference = (angle: number) => projectedDivision(sky, result.system as 'R' | 'C', angle).division;
      line('reference-circle', circle(reference(0), reference(90)), 'reference', 0, true, result.system === 'R' ? 'Celestial equator' : 'Prime vertical');
      marker('north-horizon', local.north, 'North horizon', 'reference', 0);
      marker('south-horizon', scale(local.north, -1), 'South horizon', 'reference', 0);
      for (let index = 0; index < 12; index++) marker(`division-${index}`, reference(index * 30), `${index * 30}°`, 'division', 1);
      const sweep = reference(phase * settings.progress), final = reference(phase);
      marker('sweep', sweep, 'Construction sweep', 'division', 1);
      line('sweep-plane', planeCircle(local.north, sweep), 'projection', 1, true, 'Swept projection circle');
      line('final-plane', planeCircle(local.north, final), 'intersection', 2, true, 'Final defining circle');
    } else if (result.system === 'P') {
      const equatorial = eclipticToEquatorial({ longitudeDeg: lambda, latitudeDeg: 0 }, sky.trueObliquityDeg);
      const h0 = semiDiurnal(sky, equatorial.declinationDeg), target = placidusHourAngle(house, h0);
      const path = (hourAngle: number) => equatorialToVector({ rightAscensionDeg: theta - hourAngle, declinationDeg: equatorial.declinationDeg });
      const [from, to] = [10,11,12,1].includes(house) ? [-h0,0] : [2,3,4].includes(house) ? [-180,-h0] : [5,6,7].includes(house) ? [h0,180] : [0,h0];
      line('declination-circle', arc(0, 360, path).slice(0, -1), 'reference', 0, true, 'Cusp’s own declination circle');
      line('timing-arc', arc(from!, to!, path), 'timing', 1, false, 'Semi-arc divided by sidereal time');
      for (let third = 0; third <= 3; third++) marker(`time-${third}`, path(from! + (to! - from!) * third / 3), `${third}/3`, 'timing', 1);
      marker('sweep', path(from! + (target - from!) * settings.progress), 'Time-fraction sweep', 'timing', 1);
      guide.timing = { declinationDeg: equatorial.declinationDeg, hourAngleDeg: target, semiDiurnalArcDeg: h0, semiNocturnalArcDeg: 180 - h0, fraction: (target - from!) / (to! - from!), siderealOffsetDeg: target, siderealHours: target / 15, sweepSiderealOffsetDeg: from! + (target - from!) * settings.progress };
    } else {
      const mc = upperMeridian(sky), equatorial = eclipticToEquatorial({ longitudeDeg: mc, latitudeDeg: 0 }, sky.trueObliquityDeg);
      const h0 = semiDiurnal(sky, equatorial.declinationDeg), offset = [1,4,7,10].includes(house) ? 0 : kochOffset(house,h0);
      const path = (hourAngle: number) => equatorialToVector({ rightAscensionDeg: theta - hourAngle, declinationDeg: equatorial.declinationDeg });
      line('mc-declination-circle', arc(0, 360, path).slice(0, -1), 'reference', 0, true, 'Midheaven degree’s diurnal circle');
      line('mc-rising-arc', arc(-h0, 0, path), 'timing', 1, false, 'MC rise to culmination');
      for (let third = 0; third <= 3; third++) marker(`mc-time-${third}`, path(-h0 + h0 * third / 3), `${third}/3`, 'timing', 1);
      const shifted = basis(sky, theta + offset * settings.progress), final = basis(sky, theta + offset);
      line('shifted-horizon', circle(shifted.north, shifted.east), 'projection', 1, true, offset === 0 ? 'Current horizon' : `${offset < 0 ? 'Past' : 'Future'} shifted horizon sweep`);
      if ([4,10].includes(house)) line('final-meridian', circle(local.north, local.up), 'intersection', 2, true, 'Current meridian anchor');
      else line('final-horizon', circle(final.north, final.east), 'intersection', 2, true, offset === 0 ? 'Current horizon anchor' : 'Final shifted horizon');
      marker('sweep', path(offset * settings.progress), 'Sidereal-rotation sweep', 'timing', 1);
      guide.timing = { declinationDeg: equatorial.declinationDeg, semiDiurnalArcDeg: h0, semiNocturnalArcDeg: 180 - h0, siderealOffsetDeg: offset, siderealHours: offset / 15, fraction: offset / h0, sweepSiderealOffsetDeg: offset * settings.progress };
    }
    marker('intersection', ecl(lambda), `C${house} · final intersection`, 'intersection', 2);
    if ((result.system === 'P' || result.system === 'K') && [1,4,7,10].includes(house)) guide.notes.push('Angle anchors need no timed trisection. Select C11, C12, C2 or C3 to inspect it.');
    if (result.system === 'P' || result.system === 'K') guide.notes.push('Timing-circle markers illustrate Earth’s rotation relative to a held horizon; the fixed ecliptic degree does not move against the stars.');
    if (result.system === 'K') guide.notes.push('Shifted horizon planes show past/future orientations in fixed axes; the MC arc is a separate local-timing reference.');
    const references = getSkyReferences(sky);
    const asc = references.find((item) => item.id === 'angle:asc'), mc = references.find((item) => item.id === 'angle:mc');
    if ((asc?.longitudeDeg !== undefined && Math.abs(signedAngularDifferenceDegrees(asc.longitudeDeg,result.ascendantDeg)) > .01) || (mc?.longitudeDeg !== undefined && Math.abs(signedAngularDifferenceDegrees(mc.longitudeDeg,result.midheavenDeg)) > .01)) guide.notes.push('System-specific polar angles can differ from literal eastern ASC or upper-transit MC.');
    guide.notes.push('Construction sweep illustrates the rule; chart values stay fixed.');
    guide.status = 'valid';
  } catch (error) {
    guide.status = error instanceof UndefinedConstruction ? 'undefined' : 'incomplete';
    guide.lines = []; guide.markers = [];
    guide.notes.push(error instanceof Error ? error.message : 'Construction validation could not complete.');
  }
  return guide;
}
