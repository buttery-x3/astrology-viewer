import { BODY_IDS, type BodyPosition } from '../astronomy/ephemeris';
import { normalizeDegrees } from '../astronomy/coordinates';
import { ASPECT_TYPES, calculateAspects, DEFAULT_ORBS, longitudeSeparation, type AspectResult, type AspectTypeId, type OrbSettings } from './chart';

export interface AspectDisplaySettings {
  enabled: boolean; types: Record<AspectTypeId, boolean>; orbs: OrbSettings;
  scope: 'all' | 'selected'; backgroundOpacity: number; glow: boolean; measurement: boolean;
}
export const DEFAULT_ASPECT_DISPLAY: Readonly<AspectDisplaySettings> = Object.freeze({
  enabled: true, types: Object.freeze({ conjunction: true, sextile: true, square: true, trine: true, opposition: true }),
  orbs: Object.freeze({ ...DEFAULT_ORBS }), scope: 'all', backgroundOpacity: 0.18, glow: true, measurement: true,
});
export type AspectBody = Pick<BodyPosition, 'id' | 'longitudeDeg'> & Partial<Pick<BodyPosition, 'latitudeDeg'>>;
export interface AspectDetails extends AspectResult {
  withinOrb: boolean; longitudeADeg: number; longitudeBDeg: number;
  /** Great-circle separation retaining ecliptic latitude; eligibility uses longitude alone. */
  actualSkySeparationDeg?: number;
}
function skySeparation(a: AspectBody, b: AspectBody): number | undefined {
  if (a.latitudeDeg === undefined || b.latitudeDeg === undefined) return undefined;
  if(!Number.isFinite(a.latitudeDeg)||!Number.isFinite(b.latitudeDeg)||Math.abs(a.latitudeDeg)>90||Math.abs(b.latitudeDeg)>90)throw new RangeError('Aspect sky latitudes must be between−90° and90°.');
  const rad = Math.PI / 180;
  const vector = (body: AspectBody) => {
    const longitude = body.longitudeDeg * rad, latitude = body.latitudeDeg! * rad;
    return [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)] as const;
  };
  const p = vector(a), q = vector(b);
  const cross = Math.hypot(p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]);
  return Math.atan2(cross, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / rad;
}
/** Selection survives an orb crossing; absent/malformed pairs have no numerical claim. */
export function getAspectDetails(bodies: readonly AspectBody[], id: string, orbs: OrbSettings = DEFAULT_ORBS): AspectDetails | null {
  calculateAspects([], orbs); // Reuse the single orb-policy validation boundary.
  if(new Set(bodies.map((body)=>body.id)).size!==bodies.length)throw new Error('Aspect bodies must be unique.');
  const match = /^aspect:([a-z]+)-([a-z]+):([a-z]+)$/.exec(id);
  if (!match) return null;
  const a = bodies.find((body) => body.id === match[1]), b = bodies.find((body) => body.id === match[2]);
  const type = ASPECT_TYPES.find((item) => item.id === match[3]);
  if (!a || !b || !type || a.id === b.id || BODY_IDS.indexOf(a.id) >= BODY_IDS.indexOf(b.id)) return null;
  const separationDeg = longitudeSeparation(a.longitudeDeg, b.longitudeDeg), targetDeg = type.angleDeg;
  const departureDeg = Math.abs(separationDeg - targetDeg), orbDeg = orbs[type.id], withinOrb = departureDeg <= orbDeg;
  const actualSkySeparationDeg = skySeparation(a, b);
  return {
    id, bodyA: a.id, bodyB: b.id, type: type.id, separationDeg, targetDeg, departureDeg, orbDeg, withinOrb,
    closeness: withinOrb ? orbDeg === 0 ? 1 : 1 - departureDeg / orbDeg : 0,
    longitudeADeg: normalizeDegrees(a.longitudeDeg), longitudeBDeg: normalizeDegrees(b.longitudeDeg),
    ...(actualSkySeparationDeg !== undefined ? { actualSkySeparationDeg } : {}),
  };
}
/** 'selected' scope requires a selected body or stable eligible aspect pair. */
export function getVisibleAspects(bodies: readonly AspectBody[], settings: AspectDisplaySettings, selectedId: string | null): AspectResult[] {
  const eligible = calculateAspects(bodies, settings.orbs);
  if (!settings.enabled) return [];
  return eligible.filter((aspect) => settings.types[aspect.type] && (settings.scope === 'all' || selectedId === aspect.id || selectedId === `body:${aspect.bodyA}` || selectedId === `body:${aspect.bodyB}`));
}
