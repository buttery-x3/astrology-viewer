import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EphemerisEngine, EPHEMERIS_FILES, BODY_IDS } from '../../src/lib/astronomy/ephemeris';
import { equatorialToHorizon, sphericalToVector, signedAngularDifferenceDegrees } from '../../src/lib/astronomy/coordinates';
import { buildAstrocartography, ASTRO_ANGLES } from '../../src/lib/domain/astrocartography';
import reference from '../fixtures/astrocartography-native.json';

let engine: EphemerisEngine;
beforeAll(async () => {
  engine = await EphemerisEngine.create({
    wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
    files: new Map(await Promise.all(EPHEMERIS_FILES.map(async file => [file.name, new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
  });
});
afterAll(() => engine?.close());

describe('native Swiss reference for geometric geographic lines', () => {
  it('binds the exact unmodified native source and reference probe', async () => {
    for (const source of reference.sourceHashes) expect(createHash('sha256').update(await readFile(source.path)).digest('hex')).toBe(source.sha256);
    expect(reference.cases).toHaveLength(320);
    expect(new Set(reference.cases.map(item => item.bodyId))).toEqual(new Set(BODY_IDS));
    expect(new Set(reference.cases.map(item => item.angle))).toEqual(new Set(ASTRO_ANGLES));
    expect(reference.maxAltitudeResidualDeg).toBeLessThan(1e-6);
    expect(reference.maxMeridianResidualDeg).toBeLessThan(1e-6);
  });

  for (const instantMs of [...new Set(reference.cases.map(item => item.instantMs))]) {
    it(`matches native body directions, every reference locus and branch motion at${new Date(instantMs).toISOString()}`, () => {
      const snapshot = engine.calculate(instantMs, { latitudeDeg: 0, longitudeDeg: 0 }, ['W']);
      const map = buildAstrocartography(snapshot);
      expect(map.lines).toHaveLength(40);
      for (const fixture of reference.cases.filter(item => item.instantMs === instantMs)) {
        const body = snapshot.bodies.find(item => item.id === fixture.bodyId)!;
        expect(fixture.expected.version).toBe('2.10.03'); expect(fixture.expected.flags).toBe(2306);
        expect(body.equatorial.rightAscensionDeg).toBeCloseTo(fixture.expected.ra, 8);
        expect(body.equatorial.declinationDeg).toBeCloseTo(fixture.expected.dec, 8);
        expect(snapshot.greenwichSiderealTimeDeg).toBeCloseTo(fixture.expected.gast, 8);
        const curve = map.lines.find(item => item.id === `astro:${fixture.bodyId}:${fixture.angle}`)!;
        const expectedPoint = sphericalToVector(fixture);
        const nearest = Math.min(...curve.segments.flat().map(point => Math.hypot(point.point.x - expectedPoint.x, point.point.y - expectedPoint.y, point.point.z - expectedPoint.z)));
        expect(nearest).toBeLessThan(1e-10);
        const horizon = equatorialToHorizon(body.equatorial, fixture, snapshot.greenwichSiderealTimeDeg);
        expect(horizon.altitudeDeg).toBeCloseTo(fixture.expected.altitude, 8);
        if (fixture.angle === 'ac' || fixture.angle === 'dc') {
          expect(Math.abs(fixture.expected.altitude)).toBeLessThan(1e-6);
          expect(Math.sign(fixture.altitudeChangeAcrossTwoSecondsDeg!)).toBe(fixture.angle === 'ac' ? 1 : -1);
        } else {
          const hourAngle = signedAngularDifferenceDegrees(fixture.expected.ra, fixture.expected.gast + fixture.longitudeDeg);
          expect(Math.abs(hourAngle)).toBeCloseTo(fixture.angle === 'mc' ? 0 : 180, 8);
        }
      }
    });
  }
});
