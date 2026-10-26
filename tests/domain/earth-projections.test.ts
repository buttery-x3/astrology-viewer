import { describe, expect, it } from 'vitest';
import { buildEarthHouseProjection, classifyEarthHouse, fixedToEarthDirection, earthToFixedDirection, DEFAULT_EARTH_PROJECTIONS } from '../../src/lib/domain/earth-projections';
import { createEquatorialFrameTransform, IDENTITY_MATRIX3, sphericalToVector, type Matrix3 } from '../../src/lib/astronomy/coordinates';
import type { EphemerisSnapshot, HouseResult } from '../../src/lib/astronomy/ephemeris';
import { buildHouseGeometry } from '../../src/lib/domain/house-geometry';
import { eclipticDirection } from '../../src/lib/domain/sky-reference';
import reference from '../fixtures/native-swiss.json';

function sky(result: HouseResult, rotation: Matrix3 = IDENTITY_MATRIX3): EphemerisSnapshot {
  return {
    instantMs: 946728000000, observer: { latitudeDeg: 51.5, longitudeDeg: 0 }, greenwichSiderealTimeDeg: 113.58,
    trueObliquityDeg: 23.439,
    frame: createEquatorialFrameTransform({ rotation, julianDateTt: 2451545, ofDateKind: 'true', source: 'Analytic test only' }),
    houses: [result], bodies: [],
  } as unknown as EphemerisSnapshot;
}

describe('radial geographic projection of the primary chart partition', () => {
  for (const result of reference.cases.flatMap(date => date.observers.flatMap(observer => observer.houses))) {
    it(`preserves indexed ${result.system}/${result.status} partition and exact directions`, () => {
      const snapshot = sky(result as HouseResult, [0, -1, 0, 1, 0, 0, 0, 0, 1]);
      const projected = buildEarthHouseProjection(snapshot), original = buildHouseGeometry(snapshot, result as HouseResult);
      expect(projected.status).toBe(original.status);
      if (projected.status !== 'valid' || original.status !== 'valid') return;
      expect(projected.regions).toHaveLength(12); expect(projected.boundaries).toHaveLength(12);
      for (const [index, region] of projected.regions.entries()) {
        expect(region.widthDeg).toBe(original.regions[index]!.widthDeg);
        expect(region.direction).toBe(original.regions[index]!.direction);
        expect(classifyEarthHouse(snapshot, region.anchor.point)).toEqual({ status: 'valid', house: region.house });
        for (const sample of [0, Math.floor(region.surface.positions.length / 2), region.surface.positions.length - 1]) {
          const fixed = earthToFixedDirection(region.surface.positions[sample]!, snapshot);
          const expected = original.regions[index]!.surface.positions[sample]!;
          expect(fixed.x).toBeCloseTo(expected.x, 12); expect(fixed.y).toBeCloseTo(expected.y, 12); expect(fixed.z).toBeCloseTo(expected.z, 12);
        }
      }
    });
  }
  it('round-trips known geographic axes with the complete of-date rotation exactly once', () => {
    const snapshot = sky(reference.cases[0]!.observers[0]!.houses[0] as HouseResult, [1, 0, 0, 0, 0, -1, 0, 1, 0]);
    for (const latitudeDeg of [-90, -33, 0, 51, 90]) for (const longitudeDeg of [-180, -90, 0, 90, 180]) {
      const original = sphericalToVector({ latitudeDeg, longitudeDeg });
      const result = fixedToEarthDirection(earthToFixedDirection(original, snapshot), snapshot);
      expect(result.x).toBeCloseTo(original.x, 12); expect(result.y).toBeCloseTo(original.y, 12); expect(result.z).toBeCloseTo(original.z, 12);
    }
  });
  it('retains explicit undefined state and safe independent default filters', () => {
    const result = buildEarthHouseProjection(sky({ system: 'P', status: 'undefined', reason: 'Native polar failure' }));
    expect(result).toMatchObject({ status: 'undefined', reason: 'Native polar failure', regions: [], boundaries: [] });
    expect(Object.values(DEFAULT_EARTH_PROJECTIONS.bodies).filter(Boolean)).toHaveLength(10);
    expect(Object.values(DEFAULT_EARTH_PROJECTIONS.angles).filter(Boolean)).toHaveLength(4);
  });
  it('preserves clockwise polar partitions, cusp identity and both sides of every indexed boundary', () => {
    for (const direction of [1, -1] as const) {
      const result = { system: 'R', status: 'valid', cusps: Array.from({ length: 12 }, (_, i) => (360 + direction * i * 30) % 360), ascendantDeg: 0, midheavenDeg: 270, armcDeg: 270 } as const;
      const snapshot = sky(result), projection = buildEarthHouseProjection(snapshot);
      expect(projection.status).toBe('valid'); if (projection.status !== 'valid') throw Error('Expected valid reverse partition');
      expect(projection.regions.every(region => region.direction === direction)).toBe(true);
      for (const boundary of projection.boundaries) {
        expect(classifyEarthHouse(snapshot, boundary.anchor.point)).toEqual({ status: 'valid', house: boundary.house });
        const inside = fixedToEarthDirection(eclipticDirection(snapshot, boundary.longitudeDeg + direction * 1e-5), snapshot);
        const outside = fixedToEarthDirection(eclipticDirection(snapshot, boundary.longitudeDeg - direction * 1e-5), snapshot);
        expect(classifyEarthHouse(snapshot, inside)).toEqual({ status: 'valid', house: boundary.house });
        expect(classifyEarthHouse(snapshot, outside)).toEqual({ status: 'valid', house: boundary.house === 1 ? 12 : boundary.house - 1 });
      }
      const pole = fixedToEarthDirection(eclipticDirection(snapshot, 0, 89), snapshot);
      expect(classifyEarthHouse(snapshot, pole).status).toBe('undefined');
    }
  });
});
