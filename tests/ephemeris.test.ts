import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { EphemerisEngine, EPHEMERIS_FILES, type EngineAssets, type HouseSystemId } from '../src/lib/astronomy/ephemeris';
import { equatorialOfDateToFixed, sphericalToVector } from '../src/lib/astronomy/coordinates';
import reference from './fixtures/native-swiss.json';
import { resolveCivilTime } from '../src/lib/time/civil-time';
import { civilAtInstant } from '../src/lib/state/birth-context';
import { zodiacSign } from '../src/lib/domain/chart';
import { resolveBodyContent } from '../src/lib/content';

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
  it('preserves the exact civil-to-native solar known answer through interleaved date/observer/system cache edits',()=>{
    for(const known of reference.knownAnswerCases){
      const resolution=resolveCivilTime({civil:known.civil,zoneId:known.zoneId});
      expect(resolution.status).toBe('unique');if(resolution.status!=='unique')throw new Error('Expected the unambiguous native known-answer civil time.');
      expect(resolution.candidate.utcMs).toBe(known.instantMs);expect(resolution.candidate.utcIso).toBe(known.instantIso);expect(resolution.candidate.offsetMinutes).toBe(known.offsetMinutes);
      expect(civilAtInstant(known.instantMs,{zoneId:known.zoneId,manualOffsetMinutes:null})).toEqual({civil:known.civil,offsetMinutes:known.offsetMinutes});
      for(const other of [reference.cases[1]!,reference.cases[2]!,reference.cases[0]!]){
        engine.calculate(other.instantMs,{latitudeDeg:51.5,longitudeDeg:0},['P']);
        const snapshot=engine.calculate(resolution.candidate.utcMs,known.observer,['W']),sun=snapshot.bodies.find(body=>body.id==='sun')!;
        expect(Math.abs(sun.longitudeDeg-known.sun!.longitudeDeg)).toBeLessThan(1e-6);
        expect(zodiacSign(sun.longitudeDeg).id).toBe(known.expectedSign);
        expect(resolveBodyContent(sun,snapshot.houses[0]).bodyInSign.id).toBe('body-in-sign:sun:taurus');
        // Returned observer/cusp edits must not poison the retained geocentric date.
        sun.longitudeDeg=255;
        const again=engine.calculate(known.instantMs,{latitudeDeg:0,longitudeDeg:0},['E']);
        expect(zodiacSign(again.bodies[0]!.longitudeDeg).id).toBe(known.expectedSign);
      }
    }
  });
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
  it('keeps geocentric directions fixed across observer/system edits and isolates returned data', () => {
    const instant = Date.parse('2000-01-01T12:00:00Z');
    const north = engine.calculate(instant, {latitudeDeg:51.5,longitudeDeg:0}, ['W']);
    const south = engine.calculate(instant, {latitudeDeg:-33.8688,longitudeDeg:151.2093}, ['P']);
    expect(north.bodies.map(({horizon: _horizon,...body})=>body)).toEqual(south.bodies.map(({horizon: _horizon,...body})=>body));
    expect(north.bodies[0]!.horizon.altitudeDeg).not.toBe(south.bodies[0]!.horizon.altitudeDeg);
    const expectedLongitude = south.bodies[0]!.longitudeDeg;
    north.bodies[0]!.longitudeDeg = 999;
    (north.frame.rotation as unknown as number[])[0] = 999;
    const again = engine.calculate(instant, {latitudeDeg:51.5,longitudeDeg:0}, ['W']);
    expect(again.bodies[0]!.longitudeDeg).toBe(expectedLongitude);
    expect(again.frame.rotation[0]).not.toBe(999);
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
