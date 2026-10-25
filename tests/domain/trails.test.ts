import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { EphemerisEngine,EPHEMERIS_FILES,type EphemerisSnapshot } from '../../src/lib/astronomy/ephemeris';
import { equatorialToVector,equatorialToHorizon,fixedToEquatorialOfDate,vectorToEquatorial,type Vector3 } from '../../src/lib/astronomy/coordinates';
import { makeTrailSample,projectTrail,sampleTrail,sampleBoundaryHistory,TrailCancelled,TRAIL_MIN_MS,TRAIL_MAX_MS,TRAIL_VERSION_KEY,trailMaximumGapMs,type TrailRequest,type TrailSample } from '../../src/lib/domain/trails';
import { trailResultSchema,historyResultSchema } from '../../src/lib/workers/trail-protocol';

const anchor=Date.UTC(2026,9,25),hour=3600000,observer={latitudeDeg:-33.8688,longitudeDeg:151.2093};
const request:TrailRequest={jobId:1,bodyId:'moon',frame:'stars',observer,startMs:anchor-3*hour,endMs:anchor+3*hour,anchorMs:anchor,maxComputeMs:10000};
const unit=(angle:number,latitude=0):Vector3=>equatorialToVector({rightAscensionDeg:angle,declinationDeg:latitude});
function analytic(instantMs:number):TrailSample{const fixed=unit((instantMs-anchor)/hour*20,30);return {instantMs,fixed,enu:{east:fixed.x,north:fixed.y,up:fixed.z}};}
const immediate=async()=>{};
const angular=(a:Vector3,b:Vector3)=>Math.atan2(Math.hypot(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x),a.x*b.x+a.y*b.y+a.z*b.z)*180/Math.PI;
const midpoint=(a:Vector3,b:Vector3):Vector3=>{const length=Math.hypot(a.x+b.x,a.y+b.y,a.z+b.z);return{x:(a.x+b.x)/length,y:(a.y+b.y)/length,z:(a.z+b.z)/length};};

describe('bounded adaptive one-body sampling',()=>{
  it('refines a small-circle curvature, keeps an exact anchor, and reports truthful bounded partials',async()=>{
    const partials:number[]=[];
    const result=await sampleTrail({...request,toleranceDeg:.05},analytic,{yieldControl:immediate,onProgress:(value)=>{expect(value.status).toBe('partial');expect(value.startMs).toBe(value.samples[0]!.instantMs);expect(value.endMs).toBe(value.samples.at(-1)!.instantMs);partials.push(value.samples.length);}});
    expect(result.status).toBe('complete');expect(result.progress).toBe(1);expect(partials[0]).toBe(1);
    expect(result.samples.length).toBeGreaterThan(5);expect(result.samples.filter((value)=>value.instantMs===anchor)).toHaveLength(1);
    for(let index=1;index<result.samples.length;index++){
      const a=result.samples[index-1]!,b=result.samples[index]!;
      expect(b.instantMs).toBeGreaterThan(a.instantMs);
      expect(angular(midpoint(a.fixed,b.fixed),analytic(Math.round((a.instantMs+b.instantMs)/2)).fixed)).toBeLessThanOrEqual(.05+1e-10);
    }
    expect(trailResultSchema.safeParse(result).success).toBe(true);
  });
  it('bounds elapsed horizon gaps to one hour even when a full daily revolution aliases its endpoints',async()=>{
    const daily=(instantMs:number):TrailSample=>{const fixed=unit(0),local=unit((instantMs-anchor)/hour*15);return{instantMs,fixed,enu:{east:local.x,north:local.y,up:local.z}};};
    const result=await sampleTrail({...request,frame:'horizon',startMs:anchor-24*hour,endMs:anchor+24*hour},daily,{yieldControl:immediate});
    expect(result.status).toBe('complete');expect(result.samples.length).toBeGreaterThanOrEqual(49);
    for(let index=1;index<result.samples.length;index++)expect(result.samples[index]!.instantMs-result.samples[index-1]!.instantMs).toBeLessThanOrEqual(hour);
    expect(trailMaximumGapMs('moon','stars')).toBe(6*hour);expect(trailMaximumGapMs('pluto','stars')).toBe(14*24*hour);
  });
  it('never exceeds2000 vertices and never connects a discarded point-budget chunk',async()=>{
    const flat=(instantMs:number):TrailSample=>({instantMs,fixed:unit(0),enu:{east:1,north:0,up:0}});
    const result=await sampleTrail({...request,frame:'horizon',startMs:anchor-100*24*hour,endMs:anchor+100*24*hour,maxVertices:32},flat,{yieldControl:immediate,now:()=>0});
    expect(result.status).toBe('limited');expect(result.samples).toHaveLength(31);expect(result.limits.join(' ')).toContain('Point budget');
    expect(result.startMs).toBeGreaterThan(request.startMs-100*24*hour);expect(result.progress).toBeLessThan(1);
    for(let index=1;index<result.samples.length;index++)expect(result.samples[index]!.instantMs-result.samples[index-1]!.instantMs).toBeLessThanOrEqual(hour);
  });
  it('stops at a computation budget and keeps the contiguous verified prefix',async()=>{
    let clock=0;const timed=(instantMs:number)=>{clock+=3;return analytic(instantMs);};
    const result=await sampleTrail({...request,maxComputeMs:10},timed,{yieldControl:immediate,now:()=>clock});
    expect(result.status).toBe('limited');expect(result.limits.join(' ')).toContain('Computation budget');expect(result.samples.some((value)=>value.instantMs===anchor)).toBe(true);
  });
  it('yields in bounded evaluation batches and cancels before publishing a final result',async()=>{
    let cancelled=false,calls=0,yields=0;
    await expect(sampleTrail({...request,frame:'horizon',startMs:anchor-24*hour,endMs:anchor+24*hour},(time)=>{calls++;return analytic(time);},{cancelled:()=>cancelled,yieldControl:async()=>{yields++;cancelled=true;}})).rejects.toBeInstanceOf(TrailCancelled);
    expect(calls).toBe(8);expect(yields).toBe(1);
  });
  it('clips both UTC range ends honestly and validates input budgets and sample directions',async()=>{
    const flat=(instantMs:number):TrailSample=>({instantMs,fixed:unit(0),enu:{east:1,north:0,up:0}});
    for(const instant of [TRAIL_MIN_MS,TRAIL_MAX_MS]){
      const result=await sampleTrail({...request,anchorMs:instant,startMs:instant-hour,endMs:instant+hour},flat,{yieldControl:immediate});
      expect(result.status).toBe('limited');expect(result.progress).toBeCloseTo(.5);expect(result.limits[0]).toContain('1900–2100');
      expect(result.samples.every((sample)=>sample.instantMs>=TRAIL_MIN_MS&&sample.instantMs<=TRAIL_MAX_MS)).toBe(true);
    }
    await expect(sampleTrail({...request,maxVertices:2001},flat)).rejects.toThrow('32–2000');
    await expect(sampleTrail({...request,anchorMs:request.endMs+1},flat)).rejects.toThrow('anchor');
    await expect(sampleTrail(request,(instantMs)=>({instantMs,fixed:{x:0,y:0,z:0},enu:{east:1,north:0,up:0}}))).rejects.toThrow('invalid');
  });
  it('does not bridge unavailable or unresolved discontinuous samples',async()=>{
    const provider=(instantMs:number)=>{if(instantMs<anchor)throw new Error('Pinned data unavailable before this instant.');return analytic(instantMs);};
    const result=await sampleTrail(request,provider,{yieldControl:immediate});
    expect(result.status).toBe('limited');expect(result.startMs).toBe(anchor);expect(result.endMs).toBe(request.endMs);expect(result.limits.join()).toContain('Pinned data unavailable');
  });
});

let engine:EphemerisEngine;
beforeAll(async()=>{engine=await EphemerisEngine.create({wasmBinary:new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),files:new Map(await Promise.all(EPHEMERIS_FILES.map(async(file)=>[file.name,new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))]as const)))});});
afterAll(()=>engine?.close());
function snapshot(instantMs=anchor,location=observer):EphemerisSnapshot{return engine.calculate(instantMs,location);}
describe('native numerical trail frames and indexed boundary history',()=>{
  for(const frame of ['stars','horizon']as const)it(`inserts the exact current native Moon marker into the cached ${frame} path without recalculation`,async()=>{
    let calls=0;
    const result=await sampleTrail({...request,frame,startMs:anchor-hour,endMs:anchor+hour},(time)=>{calls++;return makeTrailSample(snapshot(time),'moon');},{yieldControl:immediate});
    expect(result.status).toBe('complete');const samplingCalls=calls,current=snapshot(anchor+1234567);
    const projected=projectTrail(result,current),exact=makeTrailSample(current,'moon').fixed;
    expect(projected.currentInserted).toBe(true);expect(projected.samples.find((value)=>value.isCurrent)!.point).toEqual(exact);expect(calls).toBe(samplingCalls);
    expect(current.bodies.find((body)=>body.id==='moon')!.latitudeDeg).not.toBe(0);
    for(const entry of projected.samples){expect(Math.hypot(entry.point.x,entry.point.y,entry.point.z)).toBeCloseTo(1,11);if(frame==='horizon'&&!entry.isCurrent){const original=result.samples.find((sample)=>sample.instantMs===entry.instantMs)!;const ofDate=vectorToEquatorial(fixedToEquatorialOfDate(entry.point,current.frame));const enu=equatorialToHorizon(ofDate,current.observer,current.greenwichSiderealTimeDeg);expect(enu.east).toBeCloseTo(original.enu.east,11);expect(enu.north).toBeCloseTo(original.enu.north,11);expect(enu.up).toBeCloseTo(original.enu.up,11);}}
    const same=projectTrail(result,snapshot(anchor));expect(same.samples.filter((value)=>value.instantMs===anchor)).toHaveLength(1);
    expect(trailResultSchema.safeParse(result).success).toBe(true);
  });
  it('withholds stale observer/version data and isolates the current marker beyond a limited sampled interval',async()=>{
    const result=await sampleTrail(request,(time)=>makeTrailSample(snapshot(time),'moon'),{yieldControl:immediate});
    expect(projectTrail(result,snapshot(anchor,{latitudeDeg:0,longitudeDeg:0}))).toMatchObject({segments:[],currentInserted:false});
    expect(projectTrail({...result,versionKey:'old'},snapshot())).toMatchObject({segments:[],currentInserted:false});
    const limited={...result,startMs:anchor,endMs:anchor,samples:[makeTrailSample(snapshot(),'moon')],status:'limited' as const,limits:['Budget']};
    const projected=projectTrail(limited,snapshot(anchor+hour));expect(projected.segments).toHaveLength(2);expect(projected.segments.every((segment)=>segment.length===1)).toBe(true);expect(projected.samples.find((sample)=>sample.isCurrent)!.instantMs).toBe(anchor+hour);
  });
  it('calculates at most7 independent native boundary ghosts, with exact anchor and Whole Sign jumps',async()=>{
    const result=await sampleBoundaryHistory({jobId:3,system:'W',house:1,observer,startMs:anchor-3*hour,endMs:anchor+3*hour,anchorMs:anchor+1234,count:7},(time)=>snapshot(time),{yieldControl:immediate,onProgress:(value)=>{expect(value.startMs).toBe(value.samples[0]!.instantMs);expect(value.endMs).toBe(value.samples.at(-1)!.instantMs);expect(value.progress).toBeGreaterThan(0);}});
    expect(result.status).toBe('complete');expect(result.samples).toHaveLength(7);expect(result.samples.some((sample)=>sample.instantMs===anchor+1234)).toBe(true);expect(result.samples.some((sample)=>sample.status==='jump')).toBe(true);
    for(const sample of result.samples)if(sample.status!=='undefined'){expect(sample.line).toHaveLength(45);const native=snapshot(sample.instantMs).houses.find((house)=>house.system==='W')!;if(native.status==='valid')expect(sample.longitudeDeg).toBe(native.cusps[0]);for(const point of sample.line)expect(Math.hypot(point.x,point.y,point.z)).toBeCloseTo(1,11);}
    expect(historyResultSchema.safeParse(result).success).toBe(true);
  });
  it('preserves polar undefined states and reverse indexed orientation without replacement',async()=>{
    const polar={latitudeDeg:75,longitudeDeg:0};
    for(const system of ['P','K']as const){const result=await sampleBoundaryHistory({jobId:4,system,house:11,observer:polar,startMs:anchor-hour,endMs:anchor+hour,anchorMs:anchor,count:3},(time)=>snapshot(time,polar),{yieldControl:immediate});expect(result.samples.every((sample)=>sample.status==='undefined')).toBe(true);expect(result.samples.every((sample)=>sample.status==='undefined'&&sample.reason.length>0)).toBe(true);}
    const result=await sampleBoundaryHistory({jobId:5,system:'R',house:11,observer:polar,startMs:anchor-12*hour,endMs:anchor+12*hour,anchorMs:anchor,count:7},(time)=>snapshot(time,polar),{yieldControl:immediate});
    expect(result.samples.some((sample)=>sample.status!=='undefined'&&sample.direction===-1)).toBe(true);
    expect(result.samples.some((sample)=>sample.status==='jump')).toBe(true);
  });
  it('clips long ghost windows to24h, validates limits and cancels between individual native calculations',async()=>{
    const input={jobId:6,system:'E' as const,house:2,observer,startMs:anchor-100*hour,endMs:anchor+100*hour,anchorMs:anchor,count:7};
    const result=await sampleBoundaryHistory(input,(time)=>snapshot(time),{yieldControl:immediate});expect(result.status).toBe('limited');expect(result.endMs-result.startMs).toBe(24*hour);expect(result.versionKey).toBe(TRAIL_VERSION_KEY);
    let cancelled=false,calls=0;await expect(sampleBoundaryHistory(input,(time)=>{calls++;return snapshot(time);},{cancelled:()=>cancelled,yieldControl:async()=>{cancelled=true;}})).rejects.toBeInstanceOf(TrailCancelled);expect(calls).toBe(1);
    await expect(sampleBoundaryHistory({...input,count:8},snapshot)).rejects.toThrow('1–7');
  });
});
