import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { EphemerisEngine, EPHEMERIS_FILES, HOUSE_SYSTEMS, type EphemerisSnapshot, type HouseResult } from '../../src/lib/astronomy/ephemeris';
import { equatorialToEcliptic, equatorialToHorizon, fixedToEquatorialOfDate, vectorToEquatorial, signedAngularDifferenceDegrees, type Vector3 } from '../../src/lib/astronomy/coordinates';
import { buildHouseConstruction, DEFAULT_CONSTRUCTION, type HouseConstruction } from '../../src/lib/domain/house-construction';
import native from '../fixtures/construction-native.json';

let engine: EphemerisEngine;
let sky: EphemerisSnapshot;
beforeAll(async()=>{
  engine=await EphemerisEngine.create({wasmBinary:new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),files:new Map(await Promise.all(EPHEMERIS_FILES.map(async(file)=>[file.name,new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const)))});
  sky=engine.calculate(Date.UTC(2026,9,25),{latitudeDeg:-33.8688,longitudeDeg:151.2093});
});
afterAll(()=>engine?.close());
const settings={...DEFAULT_CONSTRUCTION,boundaryHouse:11};
function guide(snapshot:EphemerisSnapshot,result:HouseResult,house=11,progress=1){return buildHouseConstruction(snapshot,result,{...settings,boundaryHouse:house,progress});}
function point(result:HouseConstruction,suffix:string){const found=result.markers.find((marker)=>marker.id.endsWith(`:${suffix}`));expect(found).toBeDefined();return found!.point;}
const dot=(a:Vector3,b:Vector3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:Vector3,b:Vector3):Vector3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});

describe('independent house construction validation',()=>{
  for(const fixture of native.cases){
    it(`reconstructs all indexed cusps for ${fixture.id}`,()=>{
      const snapshot=engine.calculate(fixture.instantMs,fixture.observer);
      for(const expected of fixture.houses){
        const result=guide(snapshot,expected as HouseResult);
        if(expected.status==='undefined'){
          expect(result).toMatchObject({status:'undefined',lines:[],markers:[],computedCuspDeg:null,maxResidualDeg:null});
          expect(result.notes.join(' ')).toContain('failed');
          continue;
        }
        expect(result.status).toBe('valid');
        expect(result.cuspChecks).toHaveLength(12);
        expect(result.maxResidualDeg).toBeLessThan(.01);
        for(const check of result.cuspChecks){
          expect(check.nativeCuspDeg).toBe(expected.cusps![check.house-1]);
          expect(Math.abs(signedAngularDifferenceDegrees(check.computedCuspDeg,check.nativeCuspDeg))).toBeLessThan(.01);
        }
      }
    });
  }

  it('has three sourced stages and unit fixed-J2000 geometry for every system and every selected cusp',()=>{
    for(const result of sky.houses)for(let house=1;house<=12;house++){
      const construction=guide(sky,result,house);
      expect(construction.status).toBe('valid');
      expect(construction.steps).toHaveLength(3);
      expect(construction.steps.every((step)=>step.source.url.includes(native.provenance.revision)&&step.source.section.includes('CalcH'))).toBe(true);
      expect(construction.house).toBe(house);
      expect(construction.nativeCuspDeg).toBe(result.status==='valid'?result.cusps[house-1]:null);
      expect(construction.markers.some((marker)=>marker.id.endsWith(':intersection')&&marker.stage===2)).toBe(true);
      for(const direction of [...construction.lines.flatMap((line)=>line.points),...construction.markers.map((marker)=>marker.point)])expect(Math.hypot(direction.x,direction.y,direction.z)).toBeCloseTo(1,11);
      const final=vectorToEquatorial(fixedToEquatorialOfDate(point(construction,'intersection'),sky.frame));
      const ecliptic=equatorialToEcliptic(final,sky.trueObliquityDeg);
      expect(Math.abs(signedAngularDifferenceDegrees(ecliptic.longitudeDeg,construction.computedCuspDeg!))).toBeLessThan(1e-10);
      expect(ecliptic.latitudeDeg).toBeCloseTo(0,11);
    }
  });

  it('withholds misleading geometry when an independently reconstructed cusp disagrees',()=>{
    const normal=sky.houses.find((result)=>result.system==='E')!;
    if(normal.status!=='valid')throw new Error('Expected equal house fixture');
    const changed={...normal,cusps:normal.cusps.map((value,index)=>value+(index===10?1:0))};
    const result=guide(sky,changed);
    expect(result.status).toBe('incomplete');
    expect(result.maxResidualDeg).toBeCloseTo(1,9);
    expect(result.lines).toEqual([]);expect(result.markers).toEqual([]);
    expect(result.computedCuspDeg).not.toBe(result.nativeCuspDeg);
  });

  it('keeps validation independent of stage, enabled and construction sweep',()=>{
    for(const system of HOUSE_SYSTEMS){
      const houses=sky.houses.find((result)=>result.system===system.id)!;
      const before=JSON.stringify(sky),initial=guide(sky,houses,11,0),final=guide(sky,houses,11,1);
      expect(initial.cuspChecks).toEqual(final.cuspChecks);
      expect(initial.computedCuspDeg).toBe(final.computedCuspDeg);
      expect(initial.nativeCuspDeg).toBe(final.nativeCuspDeg);
      expect(initial.maxResidualDeg).toBe(final.maxResidualDeg);
      expect(point(initial,'sweep')).not.toEqual(point(final,'sweep'));
      expect(buildHouseConstruction(sky,houses,{...settings,enabled:true,stage:0}).cuspChecks).toEqual(final.cuspChecks);
      expect(JSON.stringify(sky)).toBe(before);
    }
  });
});

describe('actual defining geometry and timing',()=>{
  it('uses the selected Placidus cusp’s own small circle and actual hour-angle fraction',()=>{
    const houses=sky.houses.find((result)=>result.system==='P')!;
    for(let house=1;house<=12;house++){
      const result=guide(sky,houses,house),timing=result.timing!;
      const circle=result.lines.find((line)=>line.id.endsWith(':declination-circle'))!;
      expect(circle.closed).toBe(true);
      for(const direction of circle.points){
        const equatorial=vectorToEquatorial(fixedToEquatorialOfDate(direction,sky.frame));
        expect(equatorial.declinationDeg).toBeCloseTo(timing.declinationDeg!,10);
      }
      const final=vectorToEquatorial(fixedToEquatorialOfDate(point(result,'intersection'),sky.frame));
      expect(Math.abs(signedAngularDifferenceDegrees(timing.hourAngleDeg!,sky.greenwichSiderealTimeDeg+sky.observer.longitudeDeg-final.rightAscensionDeg))).toBeLessThan(1e-9);
      expect(timing.fraction).toBeGreaterThanOrEqual(0);expect(timing.fraction).toBeLessThanOrEqual(1);
    }
  });

  it('intersects the actual past/future Koch horizon, including opposite and anchor cusps',()=>{
    const houses=sky.houses.find((result)=>result.system==='K')!;
    for(let house=1;house<=12;house++){
      const result=guide(sky,houses,house),timing=result.timing!;
      expect(timing.siderealHours).toBeCloseTo(timing.siderealOffsetDeg!/15,12);
      const final=vectorToEquatorial(fixedToEquatorialOfDate(point(result,'intersection'),sky.frame));
      if(house!==4&&house!==10)expect(Math.abs(equatorialToHorizon(final,sky.observer,sky.greenwichSiderealTimeDeg+timing.siderealOffsetDeg!).altitudeDeg)).toBeLessThan(1e-9);
      if([11,12,5,6].includes(house))expect(timing.siderealOffsetDeg).toBeLessThan(0);
      if([2,3,8,9].includes(house))expect(timing.siderealOffsetDeg).toBeGreaterThan(0);
      if([1,4,7,10].includes(house))expect(result.notes.join(' ')).toContain('Angle anchors');
    }
  });

  it('uses real Regiomontanus/Campanus defining planes in reversed polar cases',()=>{
    const polar=engine.calculate(Date.UTC(2026,9,25,12),{latitudeDeg:80,longitudeDeg:0});
    for(const system of ['R','C'] as const)for(let house=1;house<=12;house++){
      const result=guide(polar,polar.houses.find((item)=>item.system===system)!,house);
      expect(result.status).toBe('valid');
      const circle=result.lines.find((line)=>line.id.endsWith(':final-plane'))!;
      const normal=cross(circle.points[0]!,circle.points[45]!);
      expect(Math.abs(dot(normal,point(result,'intersection')))).toBeLessThan(1e-11);
      expect(result.notes.join(' ')).toContain('polar angles');
    }
  });

  it('rejects invalid guide settings and retains exact-pole undefined states',()=>{
    const houses=sky.houses[0]!;
    expect(()=>guide(sky,houses,0)).toThrow(RangeError);
    expect(()=>guide(sky,houses,13)).toThrow(RangeError);
    expect(()=>guide(sky,houses,1,NaN)).toThrow(RangeError);
    const pole=engine.calculate(sky.instantMs,{latitudeDeg:90,longitudeDeg:0});
    for(const result of pole.houses)expect(guide(pole,result)).toMatchObject({status:'undefined',lines:[],markers:[]});
    expect(new Set(native.cases.map((item)=>item.id)).size).toBe(native.cases.length);
  });
});
