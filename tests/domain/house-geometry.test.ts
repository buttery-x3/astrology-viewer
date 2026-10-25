import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  EphemerisEngine, EPHEMERIS_FILES, HOUSE_SYSTEMS,
  type EphemerisSnapshot, type HouseResult,
} from '../../src/lib/astronomy/ephemeris';
import {
  equatorialToEcliptic, fixedToEquatorialOfDate, normalizeDegrees,
  signedAngularDifferenceDegrees, vectorToEquatorial, type Vector3,
} from '../../src/lib/astronomy/coordinates';
import { classifyLongitude, housePartition } from '../../src/lib/domain/chart';
import { eclipticDirection } from '../../src/lib/domain/sky-reference';
import {
  buildHouseGeometry, compareHouseAssignments, DEFAULT_HOUSE_DISPLAY,
  isHouseDirectionPickable, HOUSE_PICKING_MAX_ABS_LATITUDE_DEG,
  type HouseGeometry, type HouseMesh,
} from '../../src/lib/domain/house-geometry';
import fixtures from '../fixtures/native-swiss.json';

let engine: EphemerisEngine;
let snapshot: EphemerisSnapshot;
beforeAll(async () => {
  engine = await EphemerisEngine.create({
    wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
    files: new Map(await Promise.all(EPHEMERIS_FILES.map(async (file) => [file.name, new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
  });
  snapshot = engine.calculate(Date.UTC(2026, 9, 25), { latitudeDeg: -33.8688, longitudeDeg: 151.2093 });
});
afterAll(() => engine?.close());

function valid(geometry: HouseGeometry) {
  expect(geometry.status).toBe('valid');
  if (geometry.status !== 'valid') throw new Error(geometry.reason);
  return geometry;
}
function ecliptic(sky: EphemerisSnapshot, point: Vector3) {
  return equatorialToEcliptic(vectorToEquatorial(fixedToEquatorialOfDate(point, sky.frame)), sky.trueObliquityDeg);
}
function cross(a: Vector3, b: Vector3): Vector3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function dot(a: Vector3, b: Vector3) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function subtract(a: Vector3, b: Vector3) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function volume(mesh: HouseMesh) {
  let total = 0;
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const [a, b, c] = mesh.indices.slice(index, index + 3).map((item) => mesh.positions[item]!);
    total += dot(a!, cross(b!, c!)) / 6;
  }
  return total;
}
function equalHouses(start = 0, reversed = false): Extract<HouseResult, { status: 'valid' }> {
  return { system: 'E', status: 'valid', cusps: Array.from({ length: 12 }, (_, index) => normalizeDegrees(start + (reversed ? -1 : 1) * index * 30)), ascendantDeg: start, midheavenDeg: 270, armcDeg: 270 };
}

describe('one shared longitude extension for the three house displays', () => {
  for (const { id: system } of HOUSE_SYSTEMS) for (const mode of ['volumes', 'arcs', 'shells'] as const) {
    it(`${system} ${mode} retains indexed cusp and region identities`, () => {
      const result = snapshot.houses.find((item) => item.system === system)!;
      const geometry = valid(buildHouseGeometry(snapshot, result));
      expect(geometry.convention).toBe('constant-ecliptic-longitude');
      expect(geometry.regions.map((item) => item.id)).toEqual(Array.from({ length: 12 }, (_, index) => `house:${index + 1}`));
      expect(geometry.boundaries.map((item) => item.id)).toEqual(Array.from({ length: 12 }, (_, index) => `boundary:${index + 1}`));
      if (result.status !== 'valid') throw new Error('Unexpected undefined normal houses');
      for (const [index, region] of geometry.regions.entries()) {
        expect(geometry.boundaries[index]!.longitudeDeg).toBe(result.cusps[index]);
        expect(classifyLongitude(result, region.startDeg)).toEqual({ status: 'valid', house: region.house });
        expect(classifyLongitude(result, region.endDeg)).toEqual({ status: 'valid', house: region.house % 12 + 1 });
        const anchor = ecliptic(snapshot, region.anchor);
        expect(Math.abs(signedAngularDifferenceDegrees(anchor.longitudeDeg, region.midpointLongitudeDeg))).toBeLessThan(1e-10);
        expect(anchor.latitudeDeg).toBeCloseTo(0, 10);
        const points = mode === 'arcs' ? region.eclipticArc : mode === 'shells' ? region.surface.positions : region.volume.positions.slice(0, -1);
        expect(points.length).toBeGreaterThan(2);
        for (const point of points) expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(1, 12);
      }
    });
  }

  it('matches native cusp longitudes and preserves wraparound in both hemispheres and extreme dates', () => {
    for (const fixture of fixtures.cases) for (const observer of fixture.observers) {
      const sky = engine.calculate(fixture.instantMs, observer);
      for (const result of observer.houses) {
        const geometry = valid(buildHouseGeometry(sky, result as HouseResult, { longitudeStepDeg: 15, latitudeStepDeg: 15 }));
        for (const [index, boundary] of geometry.boundaries.entries()) {
          expect(Math.abs(signedAngularDifferenceDegrees(ecliptic(sky, boundary.anchor).longitudeDeg, result.cusps[index]!))).toBeLessThan(1e-10);
        }
        expect(geometry.regions.reduce((sum, region) => sum + region.widthDeg, 0)).toBeCloseTo(360, 9);
      }
    }
  });

  it('keeps full off-ecliptic body directions inside the same longitude extension', () => {
    for (const result of snapshot.houses) {
      const geometry = valid(buildHouseGeometry(snapshot, result));
      for (const body of snapshot.bodies) {
        const assigned = classifyLongitude(result, body.longitudeDeg);
        if (assigned.status !== 'valid') throw new Error('Unexpected undefined normal assignment');
        const region = geometry.regions[assigned.house - 1]!;
        for (const latitudeDeg of [body.latitudeDeg, -80, 0, 80]) {
          const projected = ecliptic(snapshot, eclipticDirection(snapshot, body.longitudeDeg, latitudeDeg));
          expect(classifyLongitude(result, projected.longitudeDeg)).toEqual(assigned);
          expect(normalizeDegrees(region.direction * (projected.longitudeDeg - region.startDeg))).toBeLessThan(region.widthDeg);
        }
      }
    }
  });

  it('extends display boundaries through latitude without presenting a construction surface', () => {
    const geometry = valid(buildHouseGeometry(snapshot, equalHouses(345)));
    for (const boundary of geometry.boundaries) {
      const first = ecliptic(snapshot, boundary.line[0]!), last = ecliptic(snapshot, boundary.line.at(-1)!);
      expect(first.latitudeDeg).toBeCloseTo(-90, 10);
      expect(last.latitudeDeg).toBeCloseTo(90, 10);
      for (const point of boundary.line.slice(1, -1)) {
        expect(Math.abs(signedAngularDifferenceDegrees(ecliptic(snapshot, point).longitudeDeg, boundary.longitudeDeg))).toBeLessThan(1e-10);
      }
    }
    expect(geometry.regions[0]).toMatchObject({ startDeg: 345, endDeg: 15, widthDeg: 30, midpointLongitudeDeg: 0 });
  });

  it('omits degenerate pole triangles and keeps both normal and reverse-polar volume winding outward', () => {
    // At this later sidereal orientation the geometric upper-transit ecliptic
    // point lies below the 80°N horizon and Swiss C/R reverse cusp progression.
    const polar = engine.calculate(fixtures.polarCase.instantMs + 12 * 3600000, fixtures.polarCase.observer);
    const reverse = polar.houses.find((result) => result.status === 'valid' && housePartition(result).status === 'valid' && valid(buildHouseGeometry(polar, result)).regions[0]!.direction === -1);
    expect(reverse).toBeDefined();
    for (const result of [equalHouses(345), equalHouses(15, true), reverse!]) {
      const geometry = valid(buildHouseGeometry(snapshot, result));
      let totalVolume = 0;
      for (const region of geometry.regions) {
        for (let index = 0; index < region.surface.indices.length; index += 3) {
          const [a, b, c] = region.surface.indices.slice(index, index + 3).map((item) => region.surface.positions[item]!);
          const normal = cross(subtract(b!, a!), subtract(c!, a!));
          expect(Math.hypot(normal.x, normal.y, normal.z)).toBeGreaterThan(1e-14);
          expect(dot(normal, a!)).toBeGreaterThan(0);
        }
        const regionVolume = volume(region.volume);
        expect(regionVolume).toBeGreaterThan(0);
        totalVolume += regionVolume;
      }
      expect(totalVolume).toBeCloseTo(4 * Math.PI / 3, 1);
    }
  });

  it('excludes ambiguous pole caps from boundary and panel picking', () => {
    const geometry = valid(buildHouseGeometry(snapshot, equalHouses()));
    for (const boundary of geometry.boundaries) {
      for (const point of boundary.pickingLine) {
        expect(Math.abs(ecliptic(snapshot, point).latitudeDeg)).toBeLessThanOrEqual(HOUSE_PICKING_MAX_ABS_LATITUDE_DEG + 1e-10);
      }
    }
    expect(isHouseDirectionPickable(snapshot, eclipticDirection(snapshot, 20, 87))).toBe(true);
    expect(isHouseDirectionPickable(snapshot, eclipticDirection(snapshot, 20, 89))).toBe(false);
    expect(isHouseDirectionPickable(snapshot, eclipticDirection(snapshot, 20, -90))).toBe(false);
  });

  it('retains undefined requested systems and rejects degenerate partitions and invalid tessellation', () => {
    for (const system of ['P', 'K'] as const) {
      const result = fixtures.polarCase.houses.find((item) => item.system === system)! as HouseResult;
      expect(result.status).toBe('undefined');
      expect(buildHouseGeometry(snapshot, result)).toMatchObject({ status: 'undefined', system, regions: [], boundaries: [] });
    }
    expect(buildHouseGeometry(snapshot, { ...equalHouses(), status: 'valid', cusps: Array(12).fill(0) })).toMatchObject({ status: 'undefined' });
    expect(() => buildHouseGeometry(snapshot, equalHouses(), { longitudeStepDeg: 0 })).toThrow(RangeError);
    expect(() => buildHouseGeometry(snapshot, equalHouses(), { latitudeStepDeg: NaN })).toThrow(RangeError);
    expect(Object.isFrozen(DEFAULT_HOUSE_DISPLAY)).toBe(true);
  });
});

describe('house comparison by indexed boundaries and longitude membership', () => {
  it('reports known assignments, exact cusp inclusion and the changed union intervals through 0°', () => {
    const comparison = compareHouseAssignments([
      { id: 'sun', longitudeDeg: 355 }, { id: 'moon', longitudeDeg: 0 },
      { id: 'mercury', longitudeDeg: 10 }, { id: 'venus', longitudeDeg: 29.999 },
    ], equalHouses(), equalHouses(10));
    expect(comparison.status).toBe('valid');
    expect(comparison.rows.map((row) => [row.primaryHouse, row.secondaryHouse, row.changed])).toEqual([[12, 12, false], [1, 12, true], [1, 1, false], [1, 1, false]]);
    expect(comparison.boundariesChanged).toBe(true);
    expect(comparison.changedBoundaryHouses).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    expect(comparison.regions).toHaveLength(24);
    expect(comparison.changedRegions).toHaveLength(12);
    expect(comparison.changedRegions.find((region) => region.startDeg === 0)).toEqual({ startDeg: 0, endDeg: 10, widthDeg: 10, primaryHouse: 1, secondaryHouse: 12, changed: true });
    expect(comparison.changedRegions.reduce((sum, region) => sum + region.widthDeg, 0)).toBe(120);
    expect(comparison.regions.reduce((sum, region) => sum + region.widthDeg, 0)).toBe(360);
  });

  it('recognizes equal indexed cusps across wrapped representations', () => {
    const first = equalHouses(350);
    const second: HouseResult = { ...first, status: 'valid', cusps: first.status === 'valid' ? first.cusps.map((item) => item + 360) : [] };
    const comparison = compareHouseAssignments(snapshot.bodies, first, second);
    expect(comparison).toMatchObject({ status: 'valid', boundariesChanged: false, changedBoundaryHouses: [], changedRegions: [] });
    expect(comparison.rows.every((row) => !row.changed && row.primaryHouse === row.secondaryHouse)).toBe(true);
    expect(comparison.regions).toHaveLength(12);
  });

  it('preserves each body and the valid primary when a comparison system is undefined', () => {
    const failed: HouseResult = { system: 'K', status: 'undefined', reason: 'Koch is undefined at this latitude.' };
    const comparison = compareHouseAssignments(snapshot.bodies, equalHouses(), failed);
    expect(comparison).toMatchObject({ status: 'undefined', primaryStatus: 'valid', secondaryStatus: 'undefined', secondaryReason: failed.reason, changedRegions: [] });
    expect(comparison.rows.map((row) => row.bodyId)).toEqual(snapshot.bodies.map((body) => body.id));
    for (const row of comparison.rows) expect(row).toMatchObject({ primaryStatus: 'valid', secondaryStatus: 'undefined', secondaryHouse: null, secondaryReason: failed.reason, changed: false });
    expect(comparison.rows.every((row) => row.primaryHouse !== null)).toBe(true);
  });

  it('compares reverse-polar numbering without sorting indexed cusp identities away', () => {
    const first = equalHouses(0), second = equalHouses(0, true);
    const comparison = compareHouseAssignments([{ id: 'sun', longitudeDeg: 15 }, { id: 'moon', longitudeDeg: 345 }], first, second);
    expect(comparison.rows.map((row) => [row.primaryHouse, row.secondaryHouse])).toEqual([[1, 12], [12, 1]]);
    expect(comparison.changedBoundaryHouses).not.toContain(1);
    expect(comparison.changedRegions.reduce((sum, region) => sum + region.widthDeg, 0)).toBe(360);
  });
});
