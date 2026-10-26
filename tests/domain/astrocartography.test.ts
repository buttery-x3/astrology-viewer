import { describe, expect, it } from 'vitest';
import { buildBodyAstrocartography, buildAstrocartography, riseSetState, type AstroLine } from '../../src/lib/domain/astrocartography';
import { equatorialToHorizon, signedAngularDifferenceDegrees, type Vector3 } from '../../src/lib/astronomy/coordinates';
import type { BodyPosition, EphemerisSnapshot } from '../../src/lib/astronomy/ephemeris';

const body = (ra: number, dec: number) => ({ id: 'sun' as const, equatorial: { rightAscensionDeg: ra, declinationDeg: dec } });
const line = (values: AstroLine[], angle: string) => values.find(value => value.angle === angle)!;
const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;

describe('in-mundo geographic angular lines', () => {
  it('solves the hand-known equatorial body at Greenwich sidereal zero', () => {
    const values = buildBodyAstrocartography(body(0, 0), 0);
    for (const [angle, longitudeDeg] of [['ac', -90], ['dc', 90], ['mc', 0], ['ic', -180]] as const) {
      const curve = line(values, angle);
      expect(curve.status).toBe('valid');
      expect(curve.anchor!.latitudeDeg).toBeCloseTo(0, 12);
      expect(signedAngularDifferenceDegrees(curve.anchor!.longitudeDeg, longitudeDeg)).toBeCloseTo(0, 12);
      for (const sample of curve.segments.flat()) expect(signedAngularDifferenceDegrees(sample.longitudeDeg, longitudeDeg)).toBeCloseTo(0, 10);
    }
  });

  for (const ra of [0, 75, 179.9, 280, 359.99]) for (const dec of [-89.5, -55, -23.4, 0, 23.4, 55, 89.5]) {
    it(`satisfies native-contract altitude/hour angle at every sample RA${ra}/δ${dec}`, () => {
      const gast = 113.58, values = buildBodyAstrocartography(body(ra, dec), gast);
      const subpoint = { x: Math.cos(dec * Math.PI / 180) * Math.cos((ra - gast) * Math.PI / 180), y: Math.cos(dec * Math.PI / 180) * Math.sin((ra - gast) * Math.PI / 180), z: Math.sin(dec * Math.PI / 180) };
      for (const curve of values) for (const segment of curve.segments) {
        expect(segment.length).toBeGreaterThan(1);
        for (const [index, sample] of segment.entries()) {
          expect(Math.hypot(sample.point.x, sample.point.y, sample.point.z)).toBeCloseTo(1, 12);
          if (index) expect(Math.abs(sample.longitudeDeg - segment[index - 1]!.longitudeDeg)).toBeLessThanOrEqual(180 + 1e-9);
          if (curve.angle === 'ac' || curve.angle === 'dc') {
            expect(Math.abs(dot(sample.point, subpoint))).toBeLessThan(1e-12);
            const horizon = equatorialToHorizon(body(ra, dec).equatorial, sample, gast);
            expect(Math.abs(horizon.altitudeDeg)).toBeLessThan(1e-8);
            if (!sample.singularity) {
              const before = equatorialToHorizon(body(ra, dec).equatorial, sample, gast - 0.001).altitudeDeg;
              const after = equatorialToHorizon(body(ra, dec).equatorial, sample, gast + 0.001).altitudeDeg;
              expect(Math.sign(after - before)).toBe(curve.angle === 'ac' ? 1 : -1);
            }
          } else if (sample.singularity !== 'pole') {
            expect(Math.abs(signedAngularDifferenceDegrees(ra, gast + sample.longitudeDeg) - (curve.angle === 'ic' ? -180 : 0))).toBeLessThan(1e-8);
          }
        }
      }
    });
  }

  it('marks tangencies and circumpolar latitude states without fabricated crossings', () => {
    const values = buildBodyAstrocartography(body(0, 30), 0);
    const ac = line(values, 'ac');
    expect(ac.crossingLatitudeRange).toEqual([-60, 60]);
    const points = ac.segments.flat();
    expect(points[0]!.singularity).toBe('tangent'); expect(points.at(-1)!.singularity).toBe('tangent');
    expect(Math.max(...points.map(point => point.latitudeDeg))).toBeCloseTo(60, 10);
    expect(riseSetState(70, 30)).toBe('always-above');
    expect(riseSetState(-70, 30)).toBe('always-below');
    expect(riseSetState(60, 30)).toBe('tangent');
    expect(riseSetState(0, 30)).toBe('crossing');
    expect(riseSetState(90, 0)).toBe('on-horizon');
    for (const dec of [-90, 90]) expect(buildBodyAstrocartography(body(0, dec), 10).every(curve => curve.status === 'undefined' && curve.segments.length === 0 && curve.anchor === null)).toBe(true);
  });

  it('does not manufacture zero-length paths when a branch endpoint lies exactly on the dateline', () => {
    for (const ra of [0, 90, 180, 270]) for (const dec of [-30, 0, 30]) {
      for (const curve of buildBodyAstrocartography(body(ra, dec), 0)) {
        expect(curve.segments.length).toBeLessThanOrEqual(2);
        for (const segment of curve.segments) {
          for (let index = 1; index < segment.length; index++) {
            const a = segment[index - 1]!.point, b = segment[index]!.point;
            expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(1e-12);
          }
        }
      }
    }
  });

  it('keeps geography independent of observer, selected system and fixed-world frame', () => {
    const snapshot = { instantMs: 1, greenwichSiderealTimeDeg: 20, bodies: [body(30, 10) as BodyPosition] } as EphemerisSnapshot;
    const before = JSON.stringify(snapshot), original = buildAstrocartography(snapshot);
    const altered = { ...snapshot, observer: { latitudeDeg: 80, longitudeDeg: -140 }, houses: [{ system: 'P', status: 'undefined', reason: 'Polar' }], frame: { rotation: [] } } as unknown as EphemerisSnapshot;
    expect(buildAstrocartography(altered)).toEqual(original);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('rejects malformed angles and unbounded tessellation requests', () => {
    expect(() => buildBodyAstrocartography(body(0, 91), 0)).toThrow();
    expect(() => buildBodyAstrocartography(body(0, 0), NaN)).toThrow();
    expect(() => buildBodyAstrocartography(body(0, 0), 0, { maximumStepDeg: 0 })).toThrow();
  });
});
