import { describe, expect, it } from 'vitest';
import {
  astronomicalToThree, createEquatorialFrameTransform, eclipticToEquatorial,
  equatorialOfDateToFixed, equatorialToEcliptic, equatorialToHorizon,
  equatorialToVector, fixedToEquatorialOfDate, geographicToEquatorialVector,
  horizonToEquatorial, normalizeDegrees, normalizeVector,
  signedAngularDifferenceDegrees, sphericalToVector, threeToAstronomical,
  validateRotationMatrix, vectorToSpherical,
} from '../../src/lib/astronomy/coordinates';

function expectVector(actual: { x: number; y: number; z: number }, expected: { x: number; y: number; z: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.y).toBeCloseTo(expected.y, 12);
  expect(actual.z).toBeCloseTo(expected.z, 12);
}

describe('angular and Cartesian conventions', () => {
  it('normalizes wraparound, negative zero, tiny and large finite values', () => {
    for (const value of [-1e300, -720, -360, -1, -0, 0, 1e-20, 360, 721, 1e300]) {
      expect(normalizeDegrees(value)).toBeGreaterThanOrEqual(0);
      expect(normalizeDegrees(value)).toBeLessThan(360);
      expect(Object.is(normalizeDegrees(value), -0)).toBe(false);
    }
    expect(normalizeDegrees(-1)).toBe(359);
    expect(normalizeDegrees(721)).toBe(1);
    expect(normalizeDegrees(1e-20)).toBe(1e-20);
    expect(signedAngularDifferenceDegrees(359, 1)).toBe(2);
    expect(signedAngularDifferenceDegrees(1, 359)).toBe(-2);
    expect(signedAngularDifferenceDegrees(0, 180)).toBe(-180);
    expect(() => normalizeDegrees(Number.NaN)).toThrow(RangeError);
    expect(() => normalizeDegrees(Infinity)).toThrow(RangeError);
  });

  it('maps equinox, RA90 and north pole to a right-handed astronomical basis', () => {
    expectVector(sphericalToVector({ longitudeDeg: 0, latitudeDeg: 0 }), { x: 1, y: 0, z: 0 });
    expectVector(sphericalToVector({ longitudeDeg: 90, latitudeDeg: 0 }), { x: 0, y: 1, z: 0 });
    expectVector(sphericalToVector({ longitudeDeg: 0, latitudeDeg: 90 }), { x: 0, y: 0, z: 1 });
    expectVector(astronomicalToThree({ x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: -1 });
    expectVector(astronomicalToThree({ x: 0, y: 0, z: 1 }), { x: 0, y: 1, z: 0 });
    const source = { x: 0.24, y: -0.35, z: 0.67 };
    expectVector(threeToAstronomical(astronomicalToThree(source)), source);
  });

  it('handles pole longitude, huge vectors and invalid directions explicitly', () => {
    expect(vectorToSpherical({ x: 0, y: 0, z: 5 })).toEqual({ longitudeDeg: 0, latitudeDeg: 90 });
    expect(Math.hypot(...Object.values(normalizeVector({ x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE })))).toBeCloseTo(1, 14);
    expect(() => normalizeVector({ x: 0, y: 0, z: 0 })).toThrow(RangeError);
    expect(() => sphericalToVector({ longitudeDeg: 0, latitudeDeg: 91 })).toThrow(RangeError);
  });
});

describe('ecliptic/equatorial rotation', () => {
  const obliquity = 23.439291111;

  it('matches the equinoxes and solstices while preserving celestial latitude', () => {
    for (const [longitudeDeg, rightAscensionDeg, declinationDeg] of [
      [0, 0, 0], [90, 90, obliquity], [180, 180, 0], [270, 270, -obliquity],
    ]) {
      const equatorial = eclipticToEquatorial({ longitudeDeg: longitudeDeg!, latitudeDeg: 0 }, obliquity);
      expect(signedAngularDifferenceDegrees(equatorial.rightAscensionDeg, rightAscensionDeg!)).toBeCloseTo(0, 10);
      expect(equatorial.declinationDeg).toBeCloseTo(declinationDeg!, 10);
    }
    const offEcliptic = eclipticToEquatorial({ longitudeDeg: 0, latitudeDeg: 30 }, obliquity);
    expect(Math.abs(offEcliptic.declinationDeg)).toBeGreaterThan(20);
    expectVector(equatorialToVector(offEcliptic), { x: Math.cos(Math.PI / 6), y: -Math.sin(obliquity * Math.PI / 180) / 2, z: Math.cos(obliquity * Math.PI / 180) / 2 });
  });

  it('round-trips broad longitude/latitude samples without changing direction', () => {
    for (let longitudeDeg = -360; longitudeDeg < 720; longitudeDeg += 37) {
      for (let latitudeDeg = -90; latitudeDeg <= 90; latitudeDeg += 15) {
        const source = { longitudeDeg, latitudeDeg };
        const result = equatorialToEcliptic(eclipticToEquatorial(source, obliquity), obliquity);
        expectVector(sphericalToVector(result), sphericalToVector(source));
      }
    }
  });
});

describe('local east/north/up horizon', () => {
  it('places cardinal directions correctly for an equatorial observer', () => {
    const observer = { latitudeDeg: 0, longitudeDeg: 0 };
    const north = equatorialToHorizon({ rightAscensionDeg: 0, declinationDeg: 90 }, observer, 0);
    const east = equatorialToHorizon({ rightAscensionDeg: 90, declinationDeg: 0 }, observer, 0);
    const south = equatorialToHorizon({ rightAscensionDeg: 0, declinationDeg: -90 }, observer, 0);
    const west = equatorialToHorizon({ rightAscensionDeg: 270, declinationDeg: 0 }, observer, 0);
    for (const [actual, azimuth] of [[north, 0], [east, 90], [south, 180], [west, 270]] as const) {
      expect(actual.azimuthDeg).toBeCloseTo(azimuth, 12);
      expect(actual.altitudeDeg).toBeCloseTo(0, 12);
    }
    expect(equatorialToHorizon({ rightAscensionDeg: 0, declinationDeg: 0 }, observer, 0).azimuthDeg).toBeNull();
    expect(equatorialToHorizon({ rightAscensionDeg: 180, declinationDeg: 0 }, observer, 0).azimuthDeg).toBeNull();
  });

  it('uses east-positive longitude and mirrors meridian altitude in both hemispheres', () => {
    const east = equatorialToHorizon({ rightAscensionDeg: 90, declinationDeg: 0 }, { latitudeDeg: 0, longitudeDeg: 90 }, 0);
    expect(east.altitudeDeg).toBeCloseTo(90, 12);
    const north = equatorialToHorizon({ rightAscensionDeg: 0, declinationDeg: 0 }, { latitudeDeg: 33, longitudeDeg: 0 }, 0);
    const south = equatorialToHorizon({ rightAscensionDeg: 0, declinationDeg: 0 }, { latitudeDeg: -33, longitudeDeg: 0 }, 0);
    expect(north.altitudeDeg).toBeCloseTo(57, 12);
    expect(north.azimuthDeg).toBeCloseTo(180, 12);
    expect(south.altitudeDeg).toBeCloseTo(57, 12);
    expect(south.azimuthDeg).toBeCloseTo(0, 12);
  });

  it('round-trips both hemispheres and agrees with the centre-plane normal', () => {
    for (const latitudeDeg of [-90, -70, -33.8688, 0, 51.5074, 70, 90]) {
      for (const longitudeDeg of [-180, -74.006, 0, 151.2093, 180]) {
        for (const rightAscensionDeg of [0, 24, 90, 179.9, 270, 359.9]) {
          const observer = { latitudeDeg, longitudeDeg };
          const source = { rightAscensionDeg, declinationDeg: 28.5 };
          const horizon = equatorialToHorizon(source, observer, 123.456);
          const restored = horizonToEquatorial(horizon, observer, 123.456);
          expectVector(equatorialToVector(restored), equatorialToVector(source));
          const normal = geographicToEquatorialVector(observer, 123.456);
          const vector = equatorialToVector(source);
          expect(horizon.up).toBeCloseTo(normal.x * vector.x + normal.y * vector.y + normal.z * vector.z, 12);
          expect(Math.hypot(horizon.east, horizon.north, horizon.up)).toBeCloseTo(1, 12);
        }
      }
    }
  });
});

describe('fixed equatorial frame contract', () => {
  it('requires an explicit engine rotation and reverses it without loss', () => {
    const angle = 1.3 * Math.PI / 180;
    const transform = createEquatorialFrameTransform({
      julianDateTt: 2461338.5, ofDateKind: 'true', source: 'test rotation only',
      rotation: [Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle), 0, 0, 0, 1],
    });
    const source = sphericalToVector({ longitudeDeg: 124, latitudeDeg: -23 });
    const fixed = equatorialOfDateToFixed(source, transform);
    expect(signedAngularDifferenceDegrees(vectorToSpherical(fixed).longitudeDeg, 125.3)).toBeCloseTo(0, 10);
    expectVector(fixedToEquatorialOfDate(fixed, transform), source);
    expect(Object.isFrozen(transform.rotation)).toBe(true);
  });

  it('rejects reflection and non-orthogonal frame matrices', () => {
    expect(() => validateRotationMatrix([1, 0, 0, 0, 1, 0, 0, 0, -1])).toThrow(/handedness/);
    expect(() => validateRotationMatrix([1, 0, 0, 0, 2, 0, 0, 0, 1])).toThrow(/orthonormal/);
  });
});
