import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EphemerisEngine, EPHEMERIS_FILES, type BodyId } from '../../src/lib/astronomy/ephemeris';
import { HORIZONS_EPOCHS, HORIZONS_TARGETS, HORIZONS_TOLERANCE_ARCSEC, loadHorizonsReference, compareHorizonsSample, type HorizonsSample } from '../../scripts/horizons-reference';

let engine:EphemerisEngine;
let references:readonly HorizonsSample[];
const bytes=async(path:string)=>new Uint8Array(await readFile(path));
beforeAll(async()=>{
  references=await loadHorizonsReference(fileURLToPath(new URL('../fixtures/horizons',import.meta.url)));
  engine=await EphemerisEngine.create({wasmBinary:await bytes('src/lib/astronomy/generated/spatial-ephemeris.wasm'),files:new Map(await Promise.all(EPHEMERIS_FILES.map(async file=>[file.name,await bytes(`public/data/ephemeris/${file.name}`)]as const)))});
});
afterAll(()=>engine?.close());
const cases=(['UT','TT']as const).flatMap(timeType=>HORIZONS_EPOCHS.flatMap(iso=>(Object.keys(HORIZONS_TARGETS)as BodyId[]).map(bodyId=>({timeType,iso,bodyId}))));

describe('reviewed NASA/JPL Horizons apparent geocentric reference',()=>{
  it('retains all 10 body centers, 4 epochs and 2 time modes with verified raw provenance',()=>{
    expect(references).toHaveLength(80);
    expect(new Set(references.map(reference=>`${reference.timeType}:${reference.iso}:${reference.bodyId}`)).size).toBe(80);
  });
  it.each(cases)('$timeType $iso $bodyId agrees within the predeclared angular tolerance',({timeType,iso,bodyId})=>{
    const reference=references.find(sample=>sample.timeType===timeType&&sample.iso===iso&&sample.bodyId===bodyId);
    expect(reference).toBeDefined();
    const result=compareHorizonsSample(engine,reference!);
    expect(result.angularSeparationArcsec,JSON.stringify(result)).toBeLessThan(HORIZONS_TOLERANCE_ARCSEC);
  });
});
