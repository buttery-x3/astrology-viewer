import {
  equatorialOfDateToFixed,equatorialToHorizon,equatorialToVector,fixedToEquatorialOfDate,
  horizonToEquatorial,vectorToEquatorial,normalizeVector,type EastNorthUp,type ObserverCoordinates,type Vector3,
} from '../astronomy/coordinates';
import { ENGINE_REVISION,EPHEMERIS_FILES,type BodyId,type EphemerisSnapshot,type HouseSystemId } from '../astronomy/ephemeris';
import { housePartition,longitudeSeparation } from './chart';
import { eclipticDirection } from './sky-reference';

export type TrailFrame='stars'|'horizon';
export interface TrailDisplaySettings {enabled:boolean;frame:TrailFrame;windowMs:number;maxVertices:number;toleranceDeg:number;maxComputeMs:number}
export const DEFAULT_TRAIL_DISPLAY:Readonly<TrailDisplaySettings>=Object.freeze({enabled:false,frame:'stars',windowMs:86400000,maxVertices:2000,toleranceDeg:.2,maxComputeMs:3000});
export interface BoundaryHistorySettings {enabled:boolean;windowMs:number;count:number}
export const DEFAULT_BOUNDARY_HISTORY:Readonly<BoundaryHistorySettings>=Object.freeze({enabled:false,windowMs:21600000,count:7});
export const TRAIL_MIN_MS=Date.UTC(1900,0,1),TRAIL_MAX_MS=Date.UTC(2101,0,1)-1;
export const TRAIL_MAX_VERTICES=2000;
export const TRAIL_VERSION_KEY=`trail-v1:${ENGINE_REVISION}:${EPHEMERIS_FILES.map((file)=>file.sha256).join(':')}`;
export interface TrailRequestInput {bodyId:BodyId;frame:TrailFrame;observer:ObserverCoordinates;startMs:number;endMs:number;anchorMs:number;maxVertices?:number;toleranceDeg?:number;maxComputeMs?:number}
export interface TrailRequest extends TrailRequestInput {jobId:number}
export interface TrailSample {instantMs:number;fixed:Vector3;enu:EastNorthUp}
export interface TrailResult {
  jobId:number;bodyId:BodyId;frame:TrailFrame;observer:ObserverCoordinates;anchorMs:number;
  requestedStartMs:number;requestedEndMs:number;startMs:number;endMs:number;
  samples:TrailSample[];status:'partial'|'complete'|'limited';progress:number;limits:string[];versionKey:string;
}
export interface BoundaryHistoryRequestInput {system:HouseSystemId;house:number;observer:ObserverCoordinates;startMs:number;endMs:number;anchorMs:number;count:number}
export interface BoundaryHistoryRequest extends BoundaryHistoryRequestInput {jobId:number}
export type BoundaryHistorySample={instantMs:number;status:'valid'|'jump';longitudeDeg:number;direction:1|-1;point:Vector3;line:Vector3[];reason?:string}|{instantMs:number;status:'undefined';reason:string};
export interface BoundaryHistoryResult {
  jobId:number;system:HouseSystemId;house:number;observer:ObserverCoordinates;anchorMs:number;
  requestedStartMs:number;requestedEndMs:number;startMs:number;endMs:number;
  samples:BoundaryHistorySample[];limits:string[];status:'partial'|'complete'|'limited';progress:number;versionKey:string;
}
export interface ProjectedTrailSample {instantMs:number;point:Vector3;isCurrent:boolean}
export interface ProjectedTrail {bodyId:BodyId;frame:TrailFrame;samples:ProjectedTrailSample[];segments:ProjectedTrailSample[][];currentInserted:boolean;reason?:string}

/** Derive ENU from the same fixed vector as the marker, preserving exact re-embedding. */
export function makeTrailSample(snapshot:EphemerisSnapshot,bodyId:BodyId):TrailSample{
  const body=snapshot.bodies.find((item)=>item.id===bodyId);
  if(!body)throw new Error(`Body ${bodyId} is absent from the current snapshot.`);
  const fixed=equatorialToVector(body.fixedEquatorial);
  const ofDate=vectorToEquatorial(fixedToEquatorialOfDate(fixed,snapshot.frame));
  const {east,north,up}=equatorialToHorizon(ofDate,snapshot.observer,snapshot.greenwichSiderealTimeDeg);
  return {instantMs:snapshot.instantMs,fixed,enu:{east,north,up}};
}
/** A changing current instant is not a sampling/cache key. Insert its exact calculated marker here. */
export function projectTrail(result:TrailResult,snapshot:EphemerisSnapshot):ProjectedTrail{
  const projected:ProjectedTrail={bodyId:result.bodyId,frame:result.frame,samples:[],segments:[],currentInserted:false};
  if(result.observer.latitudeDeg!==snapshot.observer.latitudeDeg||result.observer.longitudeDeg!==snapshot.observer.longitudeDeg||result.versionKey!==TRAIL_VERSION_KEY){projected.reason='Trail observer or calculation version differs from the current snapshot.';return projected;}
  const current=makeTrailSample(snapshot,result.bodyId);
  const point=(sample:TrailSample)=>result.frame==='stars'?sample.fixed:equatorialOfDateToFixed(equatorialToVector(horizonToEquatorial(sample.enu,snapshot.observer,snapshot.greenwichSiderealTimeDeg)),snapshot.frame);
  const samples=result.samples.filter((sample)=>sample.instantMs!==snapshot.instantMs).map((sample)=>({instantMs:sample.instantMs,point:point(sample),isCurrent:false}));
  if(snapshot.instantMs>=result.requestedStartMs&&snapshot.instantMs<=result.requestedEndMs){
    const exact={instantMs:snapshot.instantMs,point:current.fixed,isCurrent:true};
    projected.currentInserted=true;
    if(snapshot.instantMs>=result.startMs&&snapshot.instantMs<=result.endMs)samples.push(exact);
    else projected.segments.push([exact]); // Never bridge an uncalculated gap after budget clipping.
  }
  samples.sort((a,b)=>a.instantMs-b.instantMs);
  if(samples.length)projected.segments.unshift(samples);
  projected.samples=projected.segments.flat().sort((a,b)=>a.instantMs-b.instantMs);
  return projected;
}

export interface TrailSamplingHooks {
  cancelled?:()=>boolean;yieldControl?:()=>Promise<void>;now?:()=>number;onProgress?:(result:TrailResult)=>void;
}
export class TrailCancelled extends Error {constructor(){super('Trail request cancelled.');}}
const MAX_GAP_STARS:Record<BodyId,number>={sun:7*86400000,moon:6*3600000,mercury:86400000,venus:86400000,mars:2*86400000,jupiter:7*86400000,saturn:7*86400000,uranus:14*86400000,neptune:14*86400000,pluto:14*86400000};
export function trailMaximumGapMs(bodyId:BodyId,frame:TrailFrame):number{return frame==='horizon'?3600000:MAX_GAP_STARS[bodyId];}
function angularDistance(a:Vector3,b:Vector3):number{
  const cross=Math.hypot(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
  return Math.atan2(cross,a.x*b.x+a.y*b.y+a.z*b.z)*180/Math.PI;
}
function errorVector(sample:TrailSample,frame:TrailFrame):Vector3{return frame==='stars'?sample.fixed:{x:sample.enu.east,y:sample.enu.north,z:sample.enu.up};}
function validateSample(sample:TrailSample,instantMs:number):void{
  const fixed=Math.hypot(sample.fixed.x,sample.fixed.y,sample.fixed.z),enu=Math.hypot(sample.enu.east,sample.enu.north,sample.enu.up);
  if(sample.instantMs!==instantMs||!Number.isFinite(fixed)||!Number.isFinite(enu)||Math.abs(fixed-1)>1e-8||Math.abs(enu-1)>1e-8)throw new Error('A trail sample has invalid time or direction data.');
}

/** Adaptive contiguous expansion from an exact anchor; untested budget-limited gaps are never connected. */
export async function sampleTrail(request:TrailRequest,provider:(instantMs:number)=>TrailSample,hooks:TrailSamplingHooks={}):Promise<TrailResult>{
  const maxVertices=request.maxVertices??2000,tolerance=request.toleranceDeg??.2,maxComputeMs=request.maxComputeMs??3000;
  if(!Number.isInteger(maxVertices)||maxVertices<32||maxVertices>2000||!Number.isFinite(tolerance)||tolerance<.01||tolerance>2||!Number.isFinite(maxComputeMs)||maxComputeMs<10||maxComputeMs>10000)throw new RangeError('Trail sampling needs 32–2000 vertices, tolerance0.01–2° and time budget10–10000ms.');
  if(![request.startMs,request.endMs,request.anchorMs].every(Number.isSafeInteger)||request.startMs>request.endMs||request.anchorMs<request.startMs||request.anchorMs>request.endMs||request.anchorMs<TRAIL_MIN_MS||request.anchorMs>TRAIL_MAX_MS)throw new RangeError('Trail interval must contain a supported exact anchor.');
  const now=hooks.now??(()=>performance.now()),started=now(),deadline=started+maxComputeMs;
  const yieldControl=hooks.yieldControl??(()=>new Promise<void>((resolve)=>setTimeout(resolve,0)));
  const bounds={start:Math.max(TRAIL_MIN_MS,request.startMs),end:Math.min(TRAIL_MAX_MS,request.endMs)};
  const limits:string[]=[];
  if(bounds.start!==request.startMs||bounds.end!==request.endMs)limits.push('Requested interval clipped to the supported 1900–2100 UTC range.');
  const cache=new Map<number,TrailSample>();let evaluations=0,lastProgress=started,limited=false;
  const check=()=>{if(hooks.cancelled?.())throw new TrailCancelled();};
  const sample=async(instantMs:number):Promise<TrailSample>=>{
    check();const old=cache.get(instantMs);if(old)return old;
    if(evaluations>0&&now()>=deadline)throw new Error('Computation budget reached; only the sampled interval is shown.');
    const value=provider(instantMs);validateSample(value,instantMs);cache.set(instantMs,value);evaluations++;
    if(evaluations%8===0){await yieldControl();check();}
    return value;
  };
  const anchor=await sample(request.anchorMs),past:TrailSample[]=[],future:TrailSample[]=[];
  const result=(status:TrailResult['status']):TrailResult=>{
    const samples=[...past].reverse().concat(anchor,future),startMs=samples[0]!.instantMs,endMs=samples.at(-1)!.instantMs;
    const covered=endMs-startMs,total=request.endMs-request.startMs;
    return {jobId:request.jobId,bodyId:request.bodyId,frame:request.frame,observer:{...request.observer},anchorMs:request.anchorMs,requestedStartMs:request.startMs,requestedEndMs:request.endMs,startMs,endMs,samples,status,progress:total===0?1:Math.min(1,covered/total),limits:[...limits],versionKey:TRAIL_VERSION_KEY};
  };
  hooks.onProgress?.(result('partial')); // First exact feedback is independent of full-path completion.
  const gap=trailMaximumGapMs(request.bodyId,request.frame);
  const refine=async(a:TrailSample,b:TrailSample,capacity:number):Promise<TrailSample[]>=>{
    check();
    if(capacity<=0)throw new Error('Point budget reached; only the sampled interval is shown.');
    if(a.instantMs===b.instantMs)return [];
    const midpoint=Math.round((a.instantMs+b.instantMs)/2);
    if(midpoint===a.instantMs||midpoint===b.instantMs)return [b];
    const middle=await sample(midpoint),v1=errorVector(a,request.frame),v2=errorVector(b,request.frame);
    const sum={x:v1.x+v2.x,y:v1.y+v2.y,z:v1.z+v2.z};
    const antipodal=Math.hypot(sum.x,sum.y,sum.z)<1e-10;
    const error=antipodal?180:angularDistance(normalizeVector(sum),errorVector(middle,request.frame));
    if(error<=tolerance&&Math.abs(b.instantMs-a.instantMs)<=gap)return [b];
    if(Math.abs(b.instantMs-a.instantMs)<=2)throw new Error('Sampling resolution reached; an unresolved discontinuity is not connected.');
    const first=await refine(a,middle,capacity);
    const second=await refine(middle,b,capacity-first.length);
    return first.concat(second);
  };
  let pastDone=request.anchorMs===bounds.start,futureDone=request.anchorMs===bounds.end;
  while(!pastDone||!futureDone){
    for(const direction of [-1,1]as const){
      if(direction===-1?pastDone:futureDone)continue;
      const chain=direction===-1?past:future,a=chain.at(-1)??anchor;
      const end=direction===-1?Math.max(bounds.start,a.instantMs-gap):Math.min(bounds.end,a.instantMs+gap);
      try{
        // Reserve one display vertex for the exact current marker inserted by
        // projectTrail while playback reuses this fixed sampling interval.
        const capacity=maxVertices-2-past.length-future.length;
        if(capacity<=0)throw new Error('Point budget reached; only the sampled interval is shown.');
        const b=await sample(end),accepted=await refine(a,b,capacity);
        chain.push(...accepted);
        if(direction===-1)pastDone=end===bounds.start;else futureDone=end===bounds.end;
      }catch(error){
        if(error instanceof TrailCancelled)throw error;
        limited=true;const message=error instanceof Error?error.message:'An unavailable sample stopped this direction.';
        if(!limits.includes(message))limits.push(message);
        if(direction===-1)pastDone=true;else futureDone=true;
      }
      if(now()-lastProgress>=50){hooks.onProgress?.(result('partial'));lastProgress=now();}
    }
  }
  check();return result(limited||limits.length?'limited':'complete');
}

export interface HistorySamplingHooks {cancelled?:()=>boolean;yieldControl?:()=>Promise<void>;onProgress?:(result:BoundaryHistoryResult)=>void}
/** A short, independently calculated history of one indexed native cusp. Ghosts are never interpolated. */
export async function sampleBoundaryHistory(request:BoundaryHistoryRequest,provider:(instantMs:number)=>EphemerisSnapshot,hooks:HistorySamplingHooks={}):Promise<BoundaryHistoryResult>{
  if(!Number.isInteger(request.count)||request.count<1||request.count>7||!Number.isInteger(request.house)||request.house<1||request.house>12)throw new RangeError('Boundary history needs one indexed boundary and1–7 samples.');
  if(![request.startMs,request.endMs,request.anchorMs].every(Number.isSafeInteger)||request.startMs>request.endMs||request.anchorMs<request.startMs||request.anchorMs>request.endMs||request.anchorMs<TRAIL_MIN_MS||request.anchorMs>TRAIL_MAX_MS)throw new RangeError('History interval must contain a supported exact anchor.');
  const limits:string[]=[];
  let start=Math.max(TRAIL_MIN_MS,request.startMs),end=Math.min(TRAIL_MAX_MS,request.endMs);
  if(start!==request.startMs||end!==request.endMs)limits.push('Requested history clipped to the supported1900–2100 UTC range.');
  if(end-start>86400000){start=Math.max(start,Math.min(request.anchorMs-43200000,end-86400000));end=start+86400000;limits.push('Boundary history is limited to a24-hour window.');}
  let times=request.count===1?[request.anchorMs]:Array.from({length:request.count},(_,index)=>Math.round(start+(end-start)*index/(request.count-1)));
  if(!times.includes(request.anchorMs)){
    const replacement=request.count===2?(request.anchorMs-start>end-request.anchorMs?1:0):times.slice(1,-1).reduce((best,time,index)=>Math.abs(time-request.anchorMs)<Math.abs(times[best]!-request.anchorMs)?index+1:best,1);
    times[replacement]=request.anchorMs;
  }
  times=[...new Set(times)].sort((a,b)=>a-b);
  const samples:BoundaryHistorySample[]=[];
  const result=(status:BoundaryHistoryResult['status']):BoundaryHistoryResult=>({jobId:request.jobId,system:request.system,house:request.house,observer:{...request.observer},anchorMs:request.anchorMs,requestedStartMs:request.startMs,requestedEndMs:request.endMs,startMs:samples[0]!.instantMs,endMs:samples.at(-1)!.instantMs,samples:[...samples],limits:[...limits],status,progress:samples.length/times.length,versionKey:TRAIL_VERSION_KEY});
  const check=()=>{if(hooks.cancelled?.())throw new TrailCancelled();};
  const yieldControl=hooks.yieldControl??(()=>new Promise<void>((resolve)=>setTimeout(resolve,0)));
  let previous:Extract<BoundaryHistorySample,{status:'valid'|'jump'}>|undefined;
  for(const instantMs of times){
    check();
    try{
      const snapshot=provider(instantMs),houses=snapshot.houses.find((house)=>house.system===request.system);
      if(snapshot.instantMs!==instantMs||snapshot.observer.latitudeDeg!==request.observer.latitudeDeg||snapshot.observer.longitudeDeg!==request.observer.longitudeDeg)throw new Error('History calculation returned a different instant or observer.');
      const partition=houses?housePartition(houses):{status:'undefined' as const,reason:'Requested house system is absent from this calculation.'};
      if(partition.status==='undefined'){samples.push({instantMs,status:'undefined',reason:partition.reason});previous=undefined;}
      else{
        const interval=partition.intervals[request.house-1]!,longitudeDeg=interval.startDeg;
        const jump=previous&&(previous.direction!==interval.direction||(request.system==='W'&&longitudeSeparation(previous.longitudeDeg,longitudeDeg)>1e-7));
        const value:Extract<BoundaryHistorySample,{status:'valid'|'jump'}>={instantMs,status:jump?'jump':'valid',longitudeDeg,direction:interval.direction,point:eclipticDirection(snapshot,longitudeDeg),line:Array.from({length:45},(_,index)=>eclipticDirection(snapshot,longitudeDeg,-88+176*index/44))};
        if(jump)value.reason=previous!.direction!==interval.direction?'Indexed house orientation changed between samples; no continuous boundary motion is implied.':'Whole Sign changed its rising sign between samples; the indexed boundary jumps by sign.';
        samples.push(value);previous=value;
      }
    }catch(error){if(error instanceof TrailCancelled)throw error;samples.push({instantMs,status:'undefined',reason:error instanceof Error?error.message:'History calculation unavailable.'});previous=undefined;}
    hooks.onProgress?.(result('partial'));await yieldControl();check();
  }
  return result(limits.length?'limited':'complete');
}
