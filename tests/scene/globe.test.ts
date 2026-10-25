import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createEquatorialFrameTransform, IDENTITY_MATRIX3, rotateVector,
  signedAngularDifferenceDegrees, validateRotationMatrix, type Matrix3,
} from '../../src/lib/astronomy/coordinates';
import {
  geographicToGlobePoint, globeLocalPointToCoordinates,
  globeOrientationMatrix, globeWorldPointToCoordinates,
} from '../../src/lib/scene/runtime';
import coastManifest from '../../src/lib/scene/data/coastline-manifest.json';

function orientation(rotation: Matrix3 = IDENTITY_MATRIX3, sidereal = 0) {
  return {
    frame: createEquatorialFrameTransform({ rotation, julianDateTt: 2451545, ofDateKind: 'true', source: 'Coordinate-contract fixture, not an ephemeris estimate' }),
    greenwichSiderealTimeDeg: sidereal,
  };
}

describe('globe picking geographic contract', () => {
  it('maps Greenwich, eastern/western longitudes, and poles to known local axes', () => {
    for (const [point, latitudeDeg, longitudeDeg] of [
      [{ x: 1, y: 0, z: 0 }, 0, 0],
      [{ x: 0, y: 0, z: -1 }, 0, 90],
      [{ x: 0, y: 0, z: 1 }, 0, -90],
      [{ x: -1, y: 0, z: 0 }, 0, -180],
      [{ x: 0, y: 1, z: 0 }, 90, 0],
      [{ x: 0, y: -1, z: 0 }, -90, 0],
    ] as const) {
      expect(globeLocalPointToCoordinates(point)).toEqual({ latitudeDeg, longitudeDeg });
    }
  });

  it('unrotates sidereal rotation before longitude classification', () => {
    // With GST 90°, Greenwich faces fixed RA 90°: Three.js -Z.
    const input = orientation(IDENTITY_MATRIX3, 90);
    expect(globeWorldPointToCoordinates({ x: 0, y: 0, z: -0.82 }, input).latitudeDeg).toBeCloseTo(0, 12);
    expect(globeWorldPointToCoordinates({ x: 0, y: 0, z: -0.82 }, input).longitudeDeg).toBeCloseTo(0, 12);
    expect(globeWorldPointToCoordinates({ x: 0.82, y: 0, z: 0 }, input).longitudeDeg).toBeCloseTo(-90, 12);
  });

  it('includes the full date frame instead of treating the world north as Earth north', () => {
    // A +90° rotation around astronomical X puts the of-date pole at Three +Z.
    const input = orientation([1, 0, 0, 0, 0, -1, 0, 1, 0]);
    expect(globeWorldPointToCoordinates({ x: 0, y: 0, z: 3 }, input)).toEqual({ latitudeDeg: 90, longitudeDeg: 0 });
    expect(globeWorldPointToCoordinates({ x: 0, y: 3, z: 0 }, input)).toEqual({ latitudeDeg: 0, longitudeDeg: 90 });
    validateRotationMatrix(globeOrientationMatrix(input));
  });

  it('preserves both hemispheres and the date line through orientation and schematic radius', () => {
    const input = orientation([0, -1, 0, 1, 0, 0, 0, 0, 1], 237.6);
    const rotation = globeOrientationMatrix(input);
    for (const latitudeDeg of [-89.99, -80, -33.8688, 0, 51.5, 80, 89.99]) {
      for (const longitudeDeg of [-180, -179.99, -74.006, 0, 151.2093, 179.99, 180]) {
        const local = geographicToGlobePoint({ latitudeDeg, longitudeDeg });
        const world = rotateVector({ x: local.x * 0.82, y: local.y * 0.82, z: local.z * 0.82 }, rotation);
        const picked = globeWorldPointToCoordinates(world, input);
        expect(picked.latitudeDeg).toBeCloseTo(latitudeDeg, 10);
        expect(signedAngularDifferenceDegrees(picked.longitudeDeg, longitudeDeg)).toBeCloseTo(0, 10);
      }
    }
  });

  it('rejects non-directions and invalid input coordinates', () => {
    expect(() => globeLocalPointToCoordinates({ x: 0, y: 0, z: 0 })).toThrow(/zero vector/);
    expect(() => globeLocalPointToCoordinates({ x: NaN, y: 1, z: 0 })).toThrow(/finite/);
    expect(() => geographicToGlobePoint({ latitudeDeg: 91, longitudeDeg: 0 })).toThrow(/between/);
  });
});

it('retains the pinned public-domain coastline source with unchanged bytes', () => {
  const bytes = readFileSync('src/lib/scene/data/natural-earth-coastline.json');
  expect(bytes.byteLength).toBe(coastManifest.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(coastManifest.sha256);
  const data = JSON.parse(bytes.toString()) as { features: { geometry: { type: string; coordinates: number[][] } }[] };
  expect(data.features).toHaveLength(134);
  expect(data.features.every(feature => feature.geometry.type === 'LineString')).toBe(true);
  expect(data.features.reduce((count, feature) => count + feature.geometry.coordinates.length, 0)).toBe(5128);
});
