import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { get } from 'svelte/store';
import { createExplorerStore,type CalculationWorker } from '../../src/lib/state/explorer';
import { createTrailService,type TrailWorker } from '../../src/lib/services/trails';
import { bodyIdSchema,type CalculationRequest } from '../../src/lib/workers/protocol';
import type { TrailWorkerRequest } from '../../src/lib/workers/trail-protocol';
import { TRAIL_VERSION_KEY,type TrailRequestInput,type BoundaryHistoryRequestInput,type TrailResult,type BoundaryHistoryResult } from '../../src/lib/domain/trails';
import { IDENTITY_MATRIX3 } from '../../src/lib/astronomy/coordinates';
import { EPHEMERIS_FILES,type EphemerisSnapshot } from '../../src/lib/astronomy/ephemeris';

type ChartRequest=Extract<CalculationRequest,{type:'calculate'}>;
type BodyRequest=Extract<TrailWorkerRequest,{type:'trail'}>;
type HistoryRequest=Extract<TrailWorkerRequest,{type:'history'}>;
class WorkerDouble implements CalculationWorker,TrailWorker{
  sent:(CalculationRequest|TrailWorkerRequest)[]=[];terminated=false;listeners=new Map<string,Set<EventListener>>();
  postMessage(message:CalculationRequest|TrailWorkerRequest){this.sent.push(message);}
  terminate(){this.terminated=true;}
  addEventListener(type:string,listener:EventListener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type)!.add(listener);}
  removeEventListener(type:string,listener:EventListener){this.listeners.get(type)?.delete(listener);}
  respond(data:unknown){for(const listener of [...this.listeners.get('message')??[]])listener({data}as MessageEvent);}
  chartReady(){const init=this.sent.find(message=>message.type==='init'&&'revision'in message)as Extract<CalculationRequest,{type:'init'}>;this.respond({type:'ready',revision:init.revision,version:'test',heapBytes:1048576});}
  trailReady(){this.respond({type:'ready',versionKey:TRAIL_VERSION_KEY});}
  chart(){return this.sent.filter(message=>message.type==='calculate').at(-1)!as ChartRequest;}
  trail(){return this.sent.filter(message=>message.type==='trail').at(-1)!as BodyRequest;}
  history(){return this.sent.filter(message=>message.type==='history').at(-1)!as HistoryRequest;}
  chartComplete(message=this.chart()){this.respond({type:'result',revision:message.revision,snapshot:snapshot(message),calculationMs:1,heapBytes:1048576});}
  trailComplete(message=this.trail()){const result=bodyResult(message);this.respond({type:'result',kind:'trail',jobId:message.jobId,result});}
  historyComplete(message=this.history()){const result=ghostResult(message);this.respond({type:'result',kind:'history',jobId:message.jobId,result});}
}
function snapshot(request:ChartRequest):EphemerisSnapshot{return{instantMs:request.instantMs,observer:request.observer,time:{julianDateTt:2451545,julianDateUt1:2451545,inputJulianDate:2451545,interpretation:'utc-leap-table',deltaTSeconds:64,tidalAcceleration:-25.8},greenwichSiderealTimeDeg:0,trueObliquityDeg:23.4,frame:{from:'equatorial-of-date',to:'equatorial-j2000',julianDateTt:2451545,ofDateKind:'true',source:'test',rotation:IDENTITY_MATRIX3},bodies:bodyIdSchema.options.map((id,index)=>({id,longitudeDeg:index*30,latitudeDeg:0,distanceAu:1,longitudeSpeedDegPerDay:0,effectiveFlags:258,equatorial:{rightAscensionDeg:index*30,declinationDeg:0},fixedEquatorial:{rightAscensionDeg:index*30,declinationDeg:0},horizon:{east:1,north:0,up:0,azimuthDeg:90,altitudeDeg:0}})),houses:(request.systems??['W']).map(system=>({system,status:'valid',cusps:Array.from({length:12},(_,index)=>index*30),ascendantDeg:0,midheavenDeg:270,armcDeg:270})),provenance:{engine:'test',revision:'test',calculation:'test',data:EPHEMERIS_FILES}};}
const instant=Date.UTC(2000,0,1,12),observer={latitudeDeg:51.5,longitudeDeg:0},point={x:1,y:0,z:0};
const input:TrailRequestInput={bodyId:'moon',frame:'stars',observer,startMs:instant-1000,endMs:instant+1000,anchorMs:instant};
const history:BoundaryHistoryRequestInput={system:'W',house:1,observer,startMs:instant-1000,endMs:instant+1000,anchorMs:instant,count:3};
function bodyResult(message:BodyRequest):TrailResult{const {jobId,payload}=message;return{jobId,bodyId:payload.bodyId,frame:payload.frame,observer:payload.observer,anchorMs:payload.anchorMs,requestedStartMs:payload.startMs,requestedEndMs:payload.endMs,startMs:payload.startMs,endMs:payload.endMs,samples:[payload.startMs,payload.anchorMs,payload.endMs].map(instantMs=>({instantMs,fixed:{...point},enu:{east:1,north:0,up:0}})),status:'complete',progress:1,limits:[],versionKey:TRAIL_VERSION_KEY};}
function ghostResult(message:HistoryRequest):BoundaryHistoryResult{const {jobId,payload}=message;return{jobId,system:payload.system,house:payload.house,observer:payload.observer,anchorMs:payload.anchorMs,requestedStartMs:payload.startMs,requestedEndMs:payload.endMs,startMs:payload.startMs,endMs:payload.endMs,samples:[payload.startMs,payload.anchorMs,payload.endMs].map(instantMs=>({instantMs,status:'valid',longitudeDeg:0,direction:1,point:{...point},line:Array.from({length:45},()=>({...point}))})),status:'complete',progress:1,limits:[],versionKey:TRAIL_VERSION_KEY};}
function chartSetup(){const workers:WorkerDouble[]=[];const store=createExplorerStore({startupTimeoutMs:20,calculationTimeoutMs:10,workerFactory:()=>{const worker=new WorkerDouble();workers.push(worker);return worker;}});return{store,workers};}
function trailSetup(){const workers:WorkerDouble[]=[];const service=createTrailService({startupTimeoutMs:20,jobTimeoutMs:20,workerFactory:()=>{const worker=new WorkerDouble();workers.push(worker);return worker;}});return{service,workers};}
beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());

describe('chart-worker deadline recovery',()=>{
  it('reports a startup hang and retries with a fresh worker and cleared deadlines',async()=>{
    const {store,workers}=chartSetup();store.init();store.requestChart({instantMs:instant+1000});await vi.advanceTimersByTimeAsync(21);expect(get(store)).toMatchObject({status:'error',snapshot:null});expect(get(store).error).toContain('start');expect(workers[0]!.terminated).toBe(true);expect(vi.getTimerCount()).toBe(0);
    store.retry();workers[1]!.chartReady();workers[1]!.chartComplete();await vi.advanceTimersByTimeAsync(100);expect(get(store).status).toBe('ready');expect(vi.getTimerCount()).toBe(0);store.destroy();
  });
  it('times out an active revision while retaining the correctly labelled previous snapshot',async()=>{
    const {store,workers}=chartSetup();store.init();const worker=workers[0]!;worker.chartReady();worker.chartComplete();const previous=get(store).snapshot;store.requestChart({instantMs:instant+86400000});await vi.advanceTimersByTimeAsync(11);expect(get(store)).toMatchObject({status:'error',input:{instantMs:instant+86400000},snapshot:{instantMs:instant}});expect(get(store).snapshot).toBe(previous);expect(worker.terminated).toBe(true);store.destroy();expect(vi.getTimerCount()).toBe(0);
  });
  it('supersedes an old calculation timer and does not let stale results clear the current deadline',async()=>{
    const {store,workers}=chartSetup();store.init();const worker=workers[0]!;worker.chartReady();worker.chartComplete();store.requestChart({instantMs:instant+1000});const old=worker.chart();await vi.advanceTimersByTimeAsync(6);store.requestChart({instantMs:instant+2000});await vi.advanceTimersByTimeAsync(5);expect(get(store).status).toBe('pending');worker.chartComplete(old);expect(get(store).status).toBe('pending');await vi.advanceTimersByTimeAsync(6);expect(get(store).status).toBe('error');expect(get(store).snapshot?.instantMs).toBe(instant);store.destroy();
  });
  it('cancels both timers on a coherent response, including one arriving during a form-validation error',async()=>{
    const {store,workers}=chartSetup();store.init();const worker=workers[0]!;worker.chartReady();store.requestChart({observer:{latitudeDeg:100}});worker.chartComplete();expect(get(store).status).toBe('error');expect(get(store).error).toContain('latitude');expect(get(store).snapshot).not.toBeNull();await vi.advanceTimersByTimeAsync(100);expect(worker.terminated).toBe(false);expect(vi.getTimerCount()).toBe(0);store.destroy();
  });
  it('does not let an old generation startup deadline fail a retry and clears timers on destruction',async()=>{
    const {store,workers}=chartSetup();store.init();await vi.advanceTimersByTimeAsync(15);store.retry();await vi.advanceTimersByTimeAsync(6);expect(get(store).status).toBe('loading');workers[1]!.chartReady();workers[1]!.chartComplete();store.requestChart({instantMs:instant+1000});store.destroy();expect(vi.getTimerCount()).toBe(0);await vi.advanceTimersByTimeAsync(100);expect(workers[1]!.terminated).toBe(true);
  });
});

describe('independent trail/history deadline recovery',()=>{
  it('bounds startup for both pending channels and retries with new identifiers',async()=>{
    const {service,workers}=trailSetup();service.requestTrail(input);service.requestHistory(history);await vi.advanceTimersByTimeAsync(21);expect(get(service)).toMatchObject({trail:{status:'error'},history:{status:'error'}});expect(workers[0]!.terminated).toBe(true);expect(vi.getTimerCount()).toBe(0);service.retry();const worker=workers[1]!;worker.trailReady();worker.trailComplete();worker.historyComplete();await vi.advanceTimersByTimeAsync(100);expect(get(service)).toMatchObject({trail:{status:'ready'},history:{status:'ready'}});expect(vi.getTimerCount()).toBe(0);service.destroy();
  });
  it('keeps a hard job deadline despite partial messages and retains the last verified sampled interval',async()=>{
    const {service,workers}=trailSetup();service.requestTrail(input);const worker=workers[0]!;worker.trailReady();await vi.advanceTimersByTimeAsync(10);const result={...bodyResult(worker.trail()),status:'partial',progress:.5}as TrailResult;worker.respond({type:'progress',kind:'trail',jobId:result.jobId,result});expect(get(service).trail.status).toBe('partial');await vi.advanceTimersByTimeAsync(11);expect(get(service).trail).toMatchObject({status:'error',result:{status:'partial'}});expect(worker.terminated).toBe(true);expect(vi.getTimerCount()).toBe(0);service.destroy();
  });
  it('does not let a completed channel timer fail another channel, and a timeout preserves completed numerical results',async()=>{
    const {service,workers}=trailSetup();service.requestTrail(input);const worker=workers[0]!;worker.trailReady();worker.trailComplete();const previous=get(service).trail.result;await vi.advanceTimersByTimeAsync(5);service.requestHistory(history);await vi.advanceTimersByTimeAsync(16);expect(get(service)).toMatchObject({trail:{status:'ready'},history:{status:'loading'}});await vi.advanceTimersByTimeAsync(5);expect(get(service)).toMatchObject({trail:{status:'ready'},history:{status:'error'}});expect(get(service).trail.result).toBe(previous);service.destroy();
  });
  it('clears a superseded job deadline without letting its stale partials extend the replacement',async()=>{
    const {service,workers}=trailSetup();service.requestTrail(input);const worker=workers[0]!;worker.trailReady();const old=worker.trail();await vi.advanceTimersByTimeAsync(15);service.requestTrail({...input,bodyId:'mars'});await vi.advanceTimersByTimeAsync(6);expect(get(service).trail.status).toBe('loading');worker.respond({type:'progress',kind:'trail',jobId:old.jobId,result:null});await vi.advanceTimersByTimeAsync(15);expect(get(service).trail.status).toBe('error');service.destroy();
  });
  it('clears deadlines on explicit job error and ignores late progress after that terminal error',async()=>{
    const {service,workers}=trailSetup();service.requestTrail(input);const worker=workers[0]!;worker.trailReady();const old=worker.trail();worker.respond({type:'error',kind:'trail',jobId:old.jobId,error:'Exact anchor unavailable.'});worker.respond({type:'progress',kind:'trail',jobId:old.jobId,result:null});await vi.advanceTimersByTimeAsync(100);expect(get(service).trail).toMatchObject({status:'error',error:'Exact anchor unavailable.'});expect(worker.terminated).toBe(false);expect(vi.getTimerCount()).toBe(0);service.destroy();
  });
  it('cancels startup when all pending work is disabled, and cancels each active job timer separately',async()=>{
    const {service,workers}=trailSetup();service.requestTrail(input);service.cancelTrail();expect(workers[0]!.terminated).toBe(true);expect(vi.getTimerCount()).toBe(0);service.requestTrail(input);service.requestHistory(history);const worker=workers[1]!;worker.trailReady();service.cancelTrail();await vi.advanceTimersByTimeAsync(15);expect(get(service).history.status).toBe('loading');service.cancelHistory();expect(vi.getTimerCount()).toBe(0);await vi.advanceTimersByTimeAsync(100);expect(get(service)).toMatchObject({trail:{status:'idle'},history:{status:'idle'}});service.destroy();
  });
  it('does not reuse stale generation timers after retry and clears every timer/listener on destruction',async()=>{
    const {service,workers}=trailSetup();service.requestTrail(input);await vi.advanceTimersByTimeAsync(15);service.retry();await vi.advanceTimersByTimeAsync(6);expect(get(service).trail.status).toBe('loading');const worker=workers[1]!;worker.trailReady();service.destroy();expect(vi.getTimerCount()).toBe(0);expect([...worker.listeners.values()].every(listeners=>listeners.size===0)).toBe(true);await vi.advanceTimersByTimeAsync(100);expect(worker.terminated).toBe(true);
  });
  it('fails a fully well-formed future job response immediately instead of waiting for a watchdog',()=>{
    const {service,workers}=trailSetup();service.requestTrail(input);const worker=workers[0]!;worker.trailReady();const future={...worker.trail(),jobId:100};worker.trailComplete(future);expect(get(service).trail.status).toBe('error');expect(worker.terminated).toBe(true);expect(vi.getTimerCount()).toBe(0);service.destroy();
  });
  it('validates finite timeout overrides before creating worker resources',()=>{
    expect(()=>createTrailService({jobTimeoutMs:0})).toThrow(RangeError);expect(()=>createExplorerStore({startupTimeoutMs:Infinity})).toThrow(RangeError);
  });
});
