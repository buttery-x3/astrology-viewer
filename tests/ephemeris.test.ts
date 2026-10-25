import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { EphemerisEngine, EPHEMERIS_FILES, type EngineAssets, type HouseSystemId } from '../src/lib/astronomy/ephemeris';
import { equatorialOfDateToFixed, sphericalToVector } from '../src/lib/astronomy/coordinates';
import reference from './fixtures/native-swiss.json';

let engine: EphemerisEngine;
let assets: EngineAssets;
beforeAll(async () => {
  assets = {
    wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
    files: new Map(await Promise.all(EPHEMERIS_FILES.map(async file => [file.name,new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
  };
  engine = await EphemerisEngine.create(assets);
});
afterAll(() => engine?.close());

describe('owned WASM against pinned native Swiss reference', () => {
  for (const fixture of reference.cases) {
    it(`matches all ten bodies and seven house systems at ${fixture.instantIso}`, () => {
      for (const observer of fixture.observers) {
        const snapshot = engine.calculate(fixture.instantMs,observer);
        for (const [index, body] of snapshot.bodies.entries()) {
          const expected = fixture.bodies[index]!;
          expect(body.id).toBe(expected.id);
          for (const key of ['longitudeDeg','latitudeDeg','longitudeSpeedDegPerDay'] as const)
            expect(Math.abs(body[key]-expected[key])).toBeLessThan(1e-6);
          expect(Math.abs(body.equatorial.rightAscensionDeg-expected.equatorial.rightAscensionDeg)).toBeLessThan(1e-6);
          expect(Math.abs(body.equatorial.declinationDeg-expected.equatorial.declinationDeg)).toBeLessThan(1e-6);
          expect(body.effectiveFlags & 7).toBe(2);
        }
        for (const house of snapshot.houses) {
          const expected = observer.houses.find(h => h.system === house.system)!;
          expect(house.status).toBe(expected.status);
          if (house.status === 'valid' && expected.status === 'valid') {
            house.cusps.forEach((cusp,i) => expect(Math.abs(cusp-expected.cusps![i]!)).toBeLessThan(1e-6));
            expect(Math.abs(house.ascendantDeg-expected.ascendantDeg!)).toBeLessThan(1e-6);
          }
        }
      }
    });
  }
  it('discards polar fallback cusps while retaining valid bodies and other systems', () => {
    const fixture = reference.polarCase;
    const snapshot = engine.calculate(fixture.instantMs,fixture.observer);
    expect(snapshot.bodies).toHaveLength(10);
    for (const system of ['P','K'] as HouseSystemId[]) {
      const house = snapshot.houses.find(h=>h.system===system)!;
      expect(house.status).toBe('undefined');
      expect('cusps' in house).toBe(false);
    }
    expect(snapshot.houses.filter(h=>h.status==='valid')).toHaveLength(5);
  });
  it('true-date frame rotation agrees with separately calculated J2000 directions', () => {
    for (const fixture of reference.cases) {
      const snapshot = engine.calculate(fixture.instantMs,{latitudeDeg:0,longitudeDeg:0});
      for (const body of snapshot.bodies) {
        const actual = equatorialOfDateToFixed(sphericalToVector({longitudeDeg:body.equatorial.rightAscensionDeg,latitudeDeg:body.equatorial.declinationDeg}),snapshot.frame);
        const expected = sphericalToVector({longitudeDeg:body.fixedEquatorial.rightAscensionDeg,latitudeDeg:body.fixedEquatorial.declinationDeg});
        expect(Math.hypot(actual.x-expected.x,actual.y-expected.y,actual.z-expected.z)).toBeLessThan(1e-10);
      }
    }
  });
});

describe('calculation provenance and explicit failures', () => {
  it('reports the upstream time branch explicitly for subsecond future instants', () => {
    const time = engine.resolveTime(Date.parse('2100-01-01T00:01:03.352Z'));
    expect(time.interpretation).toBe('future-ut1-assumption');
  });
  it('reported Delta-T uses the same model as UTC/UT1/TT conversion', () => {
    const time = engine.resolveTime(Date.parse('1900-01-01T00:00:00Z'));
    expect(time.interpretation).toBe('historical-ut1');
    expect(Math.abs((time.julianDateTt-time.julianDateUt1)*86400-time.deltaTSeconds)).toBeLessThan(0.0001);
  });
  it('keeps the modern UTC leap-table path and exact range boundary', () => {
    expect(engine.resolveTime(Date.parse('2000-01-01T12:00:00Z')).interpretation).toBe('utc-leap-table');
    expect(()=>engine.resolveTime(Date.parse('2101-01-01T00:00:00Z'))).toThrow('Supported instants');
    expect(()=>engine.resolveTime(Date.parse('1899-12-31T23:59:59Z'))).toThrow('Supported instants');
  });
  it('rejects missing, corrupt, and unverified additional calculation files', async () => {
    await expect(EphemerisEngine.create({...assets,files:new Map()})).rejects.toThrow('missing');
    const corrupt = new Map(assets.files); corrupt.set(EPHEMERIS_FILES[0].name,new Uint8Array([0]));
    await expect(EphemerisEngine.create({...assets,files:corrupt})).rejects.toThrow('checksum');
    const injected = new Map(assets.files); injected.set('swe_deltat.txt',new TextEncoder().encode('2000 123.0\n'));
    await expect(EphemerisEngine.create({...assets,files:injected})).rejects.toThrow('Unverified');
  });
});
