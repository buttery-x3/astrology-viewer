import { describe,expect,it } from 'vitest';
import { get } from 'svelte/store';
import { createTrailService,trailCacheKey,type TrailWorker } from '../../src/lib/services/trails';
import { TRAIL_VERSION_KEY,type TrailRequestInput,type TrailResult,type BoundaryHistoryRequestInput,type BoundaryHistoryResult } from '../../src/lib/domain/trails';
import type { TrailWorkerRequest } from '../../src/lib/workers/trail-protocol';

const instant=Date.UTC(2026,9,25),observer={latitudeDeg:51.5,longitudeDeg:0};
const input:TrailRequestInput={bodyId:'moon',frame:'stars',observer,startMs:instant-1000,endMs:instant+1000,anchorMs:instant};
const historyInput:BoundaryHistoryRequestInput={system:'W',house:1,observer,startMs:instant-1000,endMs:instant+1000,anchorMs:instant,count:3};
const fixed={x:1,y:0,z:0},enu={east:1,north:0,up:0};
class FakeWorker implements TrailWorker{
  sent:TrailWorkerRequest[]=[];terminated=false;listeners=new Map<string,Set<EventListener>>();
  postMessage(message:TrailWorkerRequest){this.sent.push(message);}
  terminate(){this.terminated=true;}
  addEventListener(type:string,listener:EventListener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type)!.add(listener);}
  removeEventListener(type:string,listener:EventListener){this.listeners.get(type)?.delete(listener);}
  emit(data:unknown){for(const listener of [...this.listeners.get('message')??[]])listener({data}as MessageEvent);}
  error(){for(const listener of [...this.listeners.get('error')??[]])listener({}as Event);}
  ready(){this.emit({type:'ready',versionKey:TRAIL_VERSION_KEY});}
  latestTrail(){return this.sent.filter((message)=>message.type==='trail').at(-1)! as Extract<TrailWorkerRequest,{type:'trail'}>;}
  latestHistory(){return this.sent.filter((message)=>message.type==='history').at(-1)! as Extract<TrailWorkerRequest,{type:'history'}>;}
}
function setup(cacheSize=8){const workers:FakeWorker[]=[];const service=createTrailService({cacheSize,workerFactory:()=>{const worker=new FakeWorker();workers.push(worker);return worker;}});return{service,workers};}
function trailResult(message:Extract<TrailWorkerRequest,{type:'trail'}>,patch:Partial<TrailResult>={}):TrailResult{
  const {payload,jobId}=message;
  return{jobId,bodyId:payload.bodyId,frame:payload.frame,observer:payload.observer,anchorMs:payload.anchorMs,requestedStartMs:payload.startMs,requestedEndMs:payload.endMs,startMs:payload.startMs,endMs:payload.endMs,samples:[payload.startMs,payload.anchorMs,payload.endMs].filter((time,index,values)=>values.indexOf(time)===index).sort((a,b)=>a-b).map((instantMs)=>({instantMs,fixed:{...fixed},enu:{...enu}})),status:'complete',progress:1,limits:[],versionKey:TRAIL_VERSION_KEY,...patch};
}
function historyResult(message:Extract<TrailWorkerRequest,{type:'history'}>,patch:Partial<BoundaryHistoryResult>={}):BoundaryHistoryResult{
  const {payload,jobId}=message;
  return{jobId,system:payload.system,house:payload.house,observer:payload.observer,anchorMs:payload.anchorMs,requestedStartMs:payload.startMs,requestedEndMs:payload.endMs,startMs:payload.startMs,endMs:payload.endMs,samples:[payload.startMs,payload.anchorMs,payload.endMs].map((instantMs)=>({instantMs,status:'valid',longitudeDeg:30,direction:1,point:{...fixed},line:Array.from({length:45},()=>({...fixed}))})),status:'complete',progress:1,limits:[],versionKey:TRAIL_VERSION_KEY,...patch};
}
function finish(worker:FakeWorker,result=trailResult(worker.latestTrail())){worker.emit({type:'result',kind:'trail',jobId:result.jobId,result});}

describe('dedicated immutable trail service',()=>{
  it('starts lazily, coalesces pre-init requests and keeps trail/history channels independent',()=>{
    const {service,workers}=setup();expect(workers).toHaveLength(0);expect(get(service)).toMatchObject({trail:{status:'idle'},history:{status:'idle'}});
    service.requestTrail(input);service.requestTrail({...input,bodyId:'mars'});service.requestHistory(historyInput);
    expect(workers).toHaveLength(1);const worker=workers[0]!;expect(worker.sent).toEqual([{type:'init'}]);worker.ready();
    expect(worker.latestTrail().payload.bodyId).toBe('mars');expect(worker.latestHistory().payload.system).toBe('W');
    const final=trailResult(worker.latestTrail());finish(worker,final);expect(get(service)).toMatchObject({trail:{status:'ready',result:{bodyId:'mars'}},history:{status:'loading'}});
    const result=historyResult(worker.latestHistory());worker.emit({type:'result',kind:'history',jobId:result.jobId,result});expect(get(service).history.status).toBe('ready');service.destroy();
  });
  it('exposes partial numerical data, clears it on any changed request, and ignores known stale malformed messages',()=>{
    const {service,workers}=setup();service.requestTrail(input);const worker=workers[0]!;worker.ready();const first=worker.latestTrail();
    const partial=trailResult(first,{status:'partial',progress:0,startMs:instant,endMs:instant,samples:[{instantMs:instant,fixed,enu}]});worker.emit({type:'progress',kind:'trail',jobId:first.jobId,result:partial});
    expect(get(service).trail).toMatchObject({status:'partial',progress:0,result:{samples:[{instantMs:instant}]}});
    service.requestTrail({...input,observer:{latitudeDeg:0,longitudeDeg:30}});expect(get(service).trail).toMatchObject({status:'loading',result:null,error:null});
    expect(worker.sent.some((message)=>message.type==='cancel'&&message.kind==='trail')).toBe(true);
    worker.emit({type:'result',kind:'trail',jobId:first.jobId,result:'malformed old payload'});expect(get(service).trail.status).toBe('loading');
    finish(worker);expect(get(service).trail.status).toBe('ready');service.destroy();
  });
  it('uses an interval cache across moving anchors while retaining the truthful original sampling origin',()=>{
    const {service,workers}=setup();service.requestTrail(input);const worker=workers[0]!;worker.ready();finish(worker);const count=worker.sent.length,firstId=get(service).trail.result!.jobId;
    service.requestTrail({...input,anchorMs:instant+500});expect(worker.sent).toHaveLength(count);expect(get(service).trail.status).toBe('ready');
    expect(get(service).trail.result!.anchorMs).toBe(instant);expect(get(service).trail.result!.jobId).toBeGreaterThan(firstId);
    expect(trailCacheKey('trail',input)).toBe(trailCacheKey('trail',{...input,anchorMs:instant+500}));service.destroy();
  });
  it('recomputes an exhausted limited interval when the new anchor is outside its sampled bounds',()=>{
    const {service,workers}=setup();service.requestTrail(input);const worker=workers[0]!;worker.ready();const sampled=trailResult(worker.latestTrail(),{status:'limited',progress:0,startMs:instant,endMs:instant,samples:[{instantMs:instant,fixed,enu}],limits:['Computation budget reached.']});finish(worker,sampled);
    service.requestTrail({...input,anchorMs:instant+500});expect(get(service).trail.status).toBe('loading');expect(worker.sent.filter((message)=>message.type==='trail')).toHaveLength(2);service.destroy();
  });
  it('includes the forced anchor in the history cache key and never reuses old cusp history as a new exact anchor',()=>{
    const {service,workers}=setup();service.requestHistory(historyInput);const worker=workers[0]!;worker.ready();const result=historyResult(worker.latestHistory());worker.emit({type:'result',kind:'history',jobId:result.jobId,result});
    service.requestHistory({...historyInput,anchorMs:instant+500});expect(get(service).history.status).toBe('loading');expect(worker.sent.filter((message)=>message.type==='history')).toHaveLength(2);
    expect(trailCacheKey('history',historyInput)).not.toBe(trailCacheKey('history',{...historyInput,anchorMs:instant+500}));service.destroy();
  });
  it('uses bounded LRU eviction and distinguishes observer, target, frame and sampler settings',()=>{
    const {service,workers}=setup(1);service.requestTrail(input);const worker=workers[0]!;worker.ready();finish(worker);service.requestTrail({...input,bodyId:'mars'});finish(worker);const before=worker.sent.filter((message)=>message.type==='trail').length;service.requestTrail(input);expect(worker.sent.filter((message)=>message.type==='trail')).toHaveLength(before+1);
    const keys=[input,{...input,bodyId:'mars' as const},{...input,frame:'horizon' as const},{...input,observer:{latitudeDeg:0,longitudeDeg:0}},{...input,toleranceDeg:.1},{...input,maxVertices:32},{...input,maxComputeMs:100}].map((value)=>trailCacheKey('trail',value));expect(new Set(keys).size).toBe(keys.length);service.destroy();
  });
  it('freezes published inputs and nested result vectors so external mutation cannot poison the cache',()=>{
    const {service,workers}=setup();service.requestTrail(input);const worker=workers[0]!;worker.ready();finish(worker);const result=get(service).trail.result!;
    expect(Object.isFrozen(get(service))).toBe(true);expect(Object.isFrozen(result.samples[0]!.fixed)).toBe(true);expect(()=>{(result.samples[0]!.fixed as {x:number}).x=5;}).toThrow();service.requestTrail(input);expect(get(service).trail.result!.samples[0]!.fixed.x).toBe(1);service.destroy();
  });
  it('rejects invalid request input without creating a worker or dispatching calculations',()=>{
    const {service,workers}=setup();service.requestTrail({...input,maxVertices:2001});expect(get(service).trail).toMatchObject({status:'error',result:null});expect(workers).toHaveLength(0);service.requestHistory({...historyInput,count:8});expect(get(service).history.status).toBe('error');service.destroy();
  });
  it('cancels either channel and ignores cancelled responses without disturbing other work',()=>{
    const {service,workers}=setup();service.requestTrail(input);service.requestHistory(historyInput);const worker=workers[0]!;worker.ready();const old=worker.latestTrail();service.cancelTrail();expect(get(service)).toMatchObject({trail:{status:'idle',result:null},history:{status:'loading'}});worker.emit({type:'result',kind:'trail',jobId:old.jobId,result:null});expect(get(service).trail.status).toBe('idle');service.cancelHistory();expect(get(service).history.status).toBe('idle');service.destroy();
  });
  it('replaces a crashed worker on retry and guards messages from its old generation',()=>{
    const {service,workers}=setup();service.requestTrail(input);const old=workers[0]!;old.ready();const result=trailResult(old.latestTrail());old.error();expect(old.terminated).toBe(true);expect(get(service).trail.status).toBe('error');service.retry();const current=workers[1]!;expect(current.sent).toEqual([{type:'init'}]);old.emit({type:'result',kind:'trail',jobId:result.jobId,result});expect(get(service).trail.status).toBe('loading');current.ready();finish(current);expect(get(service).trail.status).toBe('ready');service.destroy();
  });
  it('reports explicit initialization and active job errors and can retry each',()=>{
    const {service,workers}=setup();service.requestTrail(input);workers[0]!.emit({type:'error',kind:'init',jobId:0,error:'Calculation data checksum mismatch.'});expect(get(service).trail.error).toContain('checksum');service.retry();const worker=workers[1]!;worker.ready();worker.emit({type:'error',kind:'trail',jobId:worker.latestTrail().jobId,error:'No exact anchor data.'});expect(get(service).trail.error).toBe('No exact anchor data.');service.retry();expect(worker.terminated).toBe(true);expect(workers).toHaveLength(3);service.destroy();
  });
  for(const mode of ['future','ill-typed','malformed-current','wrong-target','wrong-version']as const)it(`fails ${mode} current responses explicitly instead of leaving loading forever`,()=>{
    const {service,workers}=setup();service.requestTrail(input);const worker=workers[0]!;worker.ready();const message=worker.latestTrail(),result=trailResult(message);
    if(mode==='future')worker.emit({type:'result',kind:'trail',jobId:message.jobId+100,result});
    if(mode==='ill-typed')worker.emit({type:'result',kind:'trail',jobId:String(message.jobId),result});
    if(mode==='malformed-current')worker.emit({type:'result',kind:'trail',jobId:message.jobId,result:null});
    if(mode==='wrong-target')worker.emit({type:'result',kind:'trail',jobId:message.jobId,result:{...result,bodyId:'mars'}});
    if(mode==='wrong-version')worker.emit({type:'ready',versionKey:'unsupported'});
    expect(get(service).trail.status).toBe('error');expect(worker.terminated).toBe(true);service.destroy();
  });
  it('ignores late progress for completed work and detaches all listeners when destroyed',()=>{
    const {service,workers}=setup();service.requestTrail(input);const worker=workers[0]!;worker.ready();finish(worker);const result=trailResult(worker.latestTrail(),{status:'partial',progress:.5});worker.emit({type:'progress',kind:'trail',jobId:result.jobId,result});expect(get(service).trail.status).toBe('ready');service.destroy();expect(worker.terminated).toBe(true);expect([...worker.listeners.values()].every((listeners)=>listeners.size===0)).toBe(true);service.requestTrail(input);service.retry();expect(workers).toHaveLength(1);
  });
});
