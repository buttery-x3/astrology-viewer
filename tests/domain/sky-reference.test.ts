import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { EphemerisEngine, EPHEMERIS_FILES, type EphemerisSnapshot } from '../../src/lib/astronomy/ephemeris';
import {
  equatorialOfDateToFixed, equatorialToHorizon, equatorialToVector,
  fixedToEquatorialOfDate, horizonToEquatorial, signedAngularDifferenceDegrees,
  vectorToEquatorial, type Vector3,
} from '../../src/lib/astronomy/coordinates';
import { eclipticDirection, getSkyReferences, type SkyReference } from '../../src/lib/domain/sky-reference';
import native from '../fixtures/native-swiss.json';

let engine: EphemerisEngine;
beforeAll(async () => {
  engine = await EphemerisEngine.create({
    wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
    files: new Map(await Promise.all(EPHEMERIS_FILES.map(async (file) => [file.name, new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
  });
});
afterAll(() => engine?.close());
const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;
const point = (references: SkyReference[], id: string): Vector3 => {
  const entry = references.find((reference) => reference.id === id);
  expect(entry?.status).toBe('valid');
  expect(entry?.point).toBeDefined();
  return entry!.point!;
};
const eq = (snapshot: EphemerisSnapshot, direction: Vector3) => vectorToEquatorial(fixedToEquatorialOfDate(direction, snapshot.frame));
const horizon = (snapshot: EphemerisSnapshot, direction: Vector3, sidereal = snapshot.greenwichSiderealTimeDeg) => equatorialToHorizon(eq(snapshot, direction), snapshot.observer, sidereal);

describe('fixed-world sky reference geometry', () => {
  it('provides the thirteen stable entities with exact source sections and unit geometry', () => {
    const snapshot = engine.calculate(Date.UTC(2000, 0, 1, 12), { latitudeDeg: 51.5, longitudeDeg: 0 });
    const references = getSkyReferences(snapshot);
    expect(references.map((entry) => entry.id)).toEqual([
      'reference:horizon', 'reference:ecliptic', 'reference:equator', 'reference:meridian', 'reference:prime-vertical',
      'reference:zenith', 'reference:nadir', 'reference:north-pole', 'reference:south-pole', 'angle:asc', 'angle:dsc', 'angle:mc', 'angle:ic',
    ]);
    for (const reference of references) {
      expect(reference.status).toBe('valid');
      expect(new URL(reference.source.url).protocol).toBe('https:');
      expect(reference.source.section.length).toBeGreaterThan(4);
      expect(Boolean(reference.line)).not.toBe(Boolean(reference.point));
      if (reference.line) {
        expect(reference.line).toHaveLength(180);
        expect(reference.line[0]).not.toEqual(reference.line.at(-1));
      }
      for (const vector of reference.line ?? [reference.point!]) expect(Math.hypot(vector.x, vector.y, vector.z)).toBeCloseTo(1, 12);
    }
  });

  it('keeps each reference in its mathematical plane after the full frame rotation', () => {
    for (const latitudeDeg of [-70, -33.8688, 0, 51.5, 70]) {
      const snapshot = engine.calculate(Date.UTC(2100, 6, 1), { latitudeDeg, longitudeDeg: 151.2093 });
      const references = getSkyReferences(snapshot);
      const up = point(references, 'reference:zenith');
      const northPole = point(references, 'reference:north-pole');
      const east = equatorialOfDateToFixed(equatorialToVector(horizonToEquatorial({ east: 1, north: 0, up: 0 }, snapshot.observer, snapshot.greenwichSiderealTimeDeg)), snapshot.frame);
      const north = equatorialOfDateToFixed(equatorialToVector(horizonToEquatorial({ east: 0, north: 1, up: 0 }, snapshot.observer, snapshot.greenwichSiderealTimeDeg)), snapshot.frame);
      for (const [id, normal] of [['reference:horizon', up], ['reference:equator', northPole], ['reference:meridian', east], ['reference:prime-vertical', north]] as const) {
        for (const sample of references.find((entry) => entry.id === id)!.line!) expect(Math.abs(dot(sample, normal))).toBeLessThan(1e-12);
      }
      expect(dot(point(references, 'reference:nadir'), up)).toBeCloseTo(-1, 12);
      expect(dot(point(references, 'reference:south-pole'), northPole)).toBeCloseTo(-1, 12);
      expect(horizon(snapshot, up).altitudeDeg).toBeCloseTo(90, 10);
    }
  });

  it('preserves nonzero ecliptic latitude and agrees with the independently returned fixed body direction', () => {
    const snapshot = engine.calculate(Date.UTC(2026, 9, 25), { latitudeDeg: -33.8688, longitudeDeg: 151.2093 });
    for (const body of snapshot.bodies) {
      const actual = eclipticDirection(snapshot, body.longitudeDeg, body.latitudeDeg);
      const expected = equatorialToVector(body.fixedEquatorial);
      expect(Math.hypot(actual.x - expected.x, actual.y - expected.y, actual.z - expected.z)).toBeLessThan(2e-8);
    }
    const pluto = snapshot.bodies.find((body) => body.id === 'pluto')!;
    const flattened = eclipticDirection(snapshot, pluto.longitudeDeg);
    const actual = eclipticDirection(snapshot, pluto.longitudeDeg, pluto.latitudeDeg);
    expect(dot(actual, flattened)).toBeLessThan(0.9999);
  });
});

describe('independent geometric chart angles', () => {
  for (const fixture of native.cases) {
    it(`agrees within 1e-6 degrees with all valid Swiss angle fixtures at ${fixture.instantIso}`, () => {
      for (const observer of fixture.observers) {
        const snapshot = engine.calculate(fixture.instantMs, observer);
        const references = getSkyReferences(snapshot);
        const asc = references.find((entry) => entry.id === 'angle:asc')!;
        const mc = references.find((entry) => entry.id === 'angle:mc')!;
        for (const houses of observer.houses) {
          expect(Math.abs(signedAngularDifferenceDegrees(asc.longitudeDeg!, houses.ascendantDeg))).toBeLessThan(1e-6);
          expect(Math.abs(signedAngularDifferenceDegrees(mc.longitudeDeg!, houses.midheavenDeg))).toBeLessThan(1e-6);
        }
        const ascPoint = point(references, 'angle:asc'), dscPoint = point(references, 'angle:dsc');
        expect(Math.abs(horizon(snapshot, ascPoint).altitudeDeg)).toBeLessThan(1e-10);
        expect(Math.abs(horizon(snapshot, dscPoint).altitudeDeg)).toBeLessThan(1e-10);
        expect(horizon(snapshot, ascPoint).east).toBeGreaterThan(0);
        expect(horizon(snapshot, dscPoint).east).toBeLessThan(0);
        expect(horizon(snapshot, ascPoint, snapshot.greenwichSiderealTimeDeg + 0.01).altitudeDeg).toBeGreaterThan(0);
        expect(horizon(snapshot, ascPoint, snapshot.greenwichSiderealTimeDeg - 0.01).altitudeDeg).toBeLessThan(0);
        const localSidereal = snapshot.greenwichSiderealTimeDeg + snapshot.observer.longitudeDeg;
        expect(signedAngularDifferenceDegrees(eq(snapshot, point(references, 'angle:mc')).rightAscensionDeg, localSidereal)).toBeCloseTo(0, 9);
        expect(Math.abs(signedAngularDifferenceDegrees(eq(snapshot, point(references, 'angle:ic')).rightAscensionDeg, localSidereal))).toBeCloseTo(180, 9);
        expect(dot(ascPoint, dscPoint)).toBeCloseTo(-1, 12);
        expect(dot(point(references, 'angle:mc'), point(references, 'angle:ic'))).toBeCloseTo(-1, 12);
      }
    });
  }

  it('retains defined angles when Placidus and Koch are undefined at polar latitudes', () => {
    const fixture = native.polarCase;
    const snapshot = engine.calculate(fixture.instantMs, fixture.observer, ['P', 'K']);
    expect(snapshot.houses.every((house) => house.status === 'undefined')).toBe(true);
    const references = getSkyReferences(snapshot);
    expect(references.filter((entry) => entry.id.startsWith('angle:')).every((entry) => entry.status === 'valid')).toBe(true);
    expect(Math.abs(horizon(snapshot, point(references, 'angle:asc')).altitudeDeg)).toBeLessThan(1e-10);
    expect(horizon(snapshot, point(references, 'angle:asc')).east).toBeGreaterThan(0);
    expect(signedAngularDifferenceDegrees(eq(snapshot, point(references, 'angle:mc')).rightAscensionDeg, snapshot.greenwichSiderealTimeDeg)).toBeCloseTo(0, 9);
  });

  it('preserves geometric MC when polar house constructions swap their cusp axes', () => {
    const snapshot = engine.calculate(Date.UTC(2000, 0, 1, 12), { latitudeDeg: 80, longitudeDeg: 0 }, ['R', 'C']);
    const references = getSkyReferences(snapshot);
    const mc = references.find((entry) => entry.id === 'angle:mc')!;
    expect(horizon(snapshot, mc.point!).altitudeDeg).toBeLessThan(0);
    for (const houses of snapshot.houses) {
      expect(houses.status).toBe('valid');
      if (houses.status !== 'valid') throw new Error('Expected defined polar spatial houses');
      // These per-system MC values belong to the construction convention. They
      // must not replace the literal upper-transit angle in the reference layer.
      expect(Math.abs(signedAngularDifferenceDegrees(mc.longitudeDeg!, houses.midheavenDeg))).toBeCloseTo(180, 8);
    }
  });

  it('keeps the upper-transit MC branch even when it is below the horizon', () => {
    const base = engine.calculate(Date.UTC(2000, 0, 1, 12), { latitudeDeg: 80, longitudeDeg: 0 });
    const snapshot = { ...base, greenwichSiderealTimeDeg: 270 };
    const references = getSkyReferences(snapshot);
    const mc = point(references, 'angle:mc');
    expect(signedAngularDifferenceDegrees(eq(snapshot, mc).rightAscensionDeg, 270)).toBeCloseTo(0, 10);
    expect(horizon(snapshot, mc).altitudeDeg).toBeLessThan(0);
    expect(horizon(snapshot, point(references, 'angle:asc')).east).toBeGreaterThan(0);
  });

  it.each([-90, 90])('reports exact geographic pole %i angles as undefined', (latitudeDeg) => {
    const snapshot = engine.calculate(Date.UTC(2000, 0, 1, 12), { latitudeDeg, longitudeDeg: 0 });
    const references = getSkyReferences(snapshot);
    for (const entry of references.filter((reference) => reference.id.startsWith('angle:') || ['reference:meridian', 'reference:prime-vertical'].includes(reference.id))) {
      expect(entry.status).toBe('undefined');
      expect(entry.reason).toMatch(/no unique/);
      expect(entry.point).toBeUndefined();
      expect(entry.line).toBeUndefined();
      expect(entry.longitudeDeg).toBeUndefined();
    }
    expect(references.find((reference) => reference.id === 'reference:horizon')?.line).toHaveLength(180);
  });

  it('does not invent Ascendant intersections when the horizon and ecliptic coincide', () => {
    const base = engine.calculate(Date.UTC(2000, 0, 1, 12), { latitudeDeg: 0, longitudeDeg: 0 });
    const snapshot = { ...base, observer: { latitudeDeg: 90 - base.trueObliquityDeg, longitudeDeg: 0 }, greenwichSiderealTimeDeg: 270 };
    const references = getSkyReferences(snapshot);
    for (const id of ['angle:asc', 'angle:dsc']) {
      const entry = references.find((reference) => reference.id === id)!;
      expect(entry.status).toBe('undefined');
      expect(entry.reason).toMatch(/planes coincide/);
    }
  });
});
