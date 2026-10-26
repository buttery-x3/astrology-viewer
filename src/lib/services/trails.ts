import { writable,type Readable } from 'svelte/store';
import { TRAIL_VERSION_KEY,type TrailRequestInput,type BoundaryHistoryRequestInput,type TrailResult,type BoundaryHistoryResult } from '../domain/trails';
import { trailInputSchema,historyInputSchema,trailResponseSchema,type TrailWorkerRequest } from '../workers/trail-protocol';

export interface TrailJobState {status:'idle'|'loading'|'partial'|'ready'|'error';progress:number;result:TrailResult|null;error:string|null}
export interface HistoryJobState {status:'idle'|'loading'|'partial'|'ready'|'error';progress:number;result:BoundaryHistoryResult|null;error:string|null}
export interface TrailServiceState {trail:TrailJobState;history:HistoryJobState}
export interface TrailWorker {postMessage(message:TrailWorkerRequest):void;terminate():void;addEventListener(type:'message'|'error'|'messageerror',listener:EventListener):void;removeEventListener(type:'message'|'error'|'messageerror',listener:EventListener):void}
export interface TrailServiceOptions {workerFactory?:()=>TrailWorker;cacheSize?:number;startupTimeoutMs?:number;jobTimeoutMs?:number}
export interface TrailService extends Readable<TrailServiceState> {requestTrail(input:TrailRequestInput):void;requestHistory(input:BoundaryHistoryRequestInput):void;cancelTrail():void;cancelHistory():void;retry():void;destroy():void}
type Kind='trail'|'history';
type Result=TrailResult|BoundaryHistoryResult;
interface Active {id:number;input:TrailRequestInput|BoundaryHistoryRequestInput;key:string;sent:boolean;completed:boolean}
const idle=()=>({status:'idle' as const,progress:0,result:null,error:null});
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const nested of Object.values(value))freeze(nested);Object.freeze(value);}return value;}
function defaultWorkerFactory():TrailWorker{return new Worker(new URL('../workers/trail-worker.ts',import.meta.url),{type:'module',name:'spatial-trails'});}
/** Sampling intervals, rather than the moving current instant, identify reusable numerical work. */
export function trailCacheKey(kind:Kind,input:TrailRequestInput|BoundaryHistoryRequestInput):string{
  const common=[TRAIL_VERSION_KEY,kind,input.observer.latitudeDeg,input.observer.longitudeDeg,input.startMs,input.endMs];
  return JSON.stringify(kind==='trail'?[...common,(input as TrailRequestInput).bodyId,(input as TrailRequestInput).frame,(input as TrailRequestInput).maxVertices??2000,(input as TrailRequestInput).toleranceDeg??.2,(input as TrailRequestInput).maxComputeMs??3000]:[...common,(input as BoundaryHistoryRequestInput).system,(input as BoundaryHistoryRequestInput).house,(input as BoundaryHistoryRequestInput).count,input.anchorMs]);
}

/** A dedicated worker keeps bounded, cancelable trail jobs independent of interactive chart requests. */
export function createTrailService(options:TrailServiceOptions={}):TrailService{
  const cacheSize=options.cacheSize??8;
  if(!Number.isInteger(cacheSize)||cacheSize<0||cacheSize>32)throw new RangeError('Trail cache size must be from0 to32.');
  const startupTimeoutMs=options.startupTimeoutMs??30000;
  if(![startupTimeoutMs,options.jobTimeoutMs??5000].every(value=>Number.isFinite(value)&&value>=1&&value<=120000))throw new RangeError('Worker deadlines must be from1 to120000ms.');
  let state:TrailServiceState=freeze({trail:idle(),history:idle()});
  const store=writable(state),active:Record<Kind,Active|null>={trail:null,history:null},cache=new Map<string,Result>();
  let worker:TrailWorker|null=null,detach:(()=>void)|null=null,ready=false,generation=0,nextId=0,destroyed=false;
  let startupTimer:ReturnType<typeof setTimeout>|undefined;
  const jobTimers:Record<Kind,ReturnType<typeof setTimeout>|undefined>={trail:undefined,history:undefined};
  const clearJobTimer=(kind:Kind)=>{clearTimeout(jobTimers[kind]);jobTimers[kind]=undefined;};
  const publish=(kind:Kind,value:TrailJobState|HistoryJobState)=>{state=freeze({...state,[kind]:value});store.set(state);};
  function stopWorker():void{generation++;clearTimeout(startupTimer);startupTimer=undefined;detach?.();detach=null;worker?.terminate();worker=null;ready=false;for(const kind of ['trail','history']as const){clearJobTimer(kind);if(active[kind])active[kind]!.sent=false;}}
  function fail(message:string):void{if(destroyed)return;stopWorker();for(const kind of ['trail','history']as const)if(active[kind]&&!active[kind]!.completed)publish(kind,{...state[kind],status:'error',error:message});}
  function send(kind:Kind):void{
    const job=active[kind];if(!worker||!ready||!job||job.sent||job.completed||destroyed)return;
    job.sent=true;
    clearJobTimer(kind);
    const requestedGeneration=generation,requestedWorker=worker,requestedId=job.id;
    const timeout=options.jobTimeoutMs??(kind==='trail'?((job.input as TrailRequestInput).maxComputeMs??3000)+5000:5000);
    jobTimers[kind]=setTimeout(()=>{if(!destroyed&&generation===requestedGeneration&&worker===requestedWorker&&active[kind]?.id===requestedId&&!active[kind]?.completed)fail(`The ${kind==='trail'?'trail sampling':'boundary history'} worker stopped responding. Retry to replace it.`);},timeout);
    try{worker.postMessage(kind==='trail'?{type:'trail',jobId:job.id,payload:job.input as TrailRequestInput}:{type:'history',jobId:job.id,payload:job.input as BoundaryHistoryRequestInput});}catch{fail('Unable to send trail work. Retry to replace the calculation worker.');}
  }
  function startWorker():void{
    if(worker||destroyed)return;
    const version=++generation;
    try{
      const current=(options.workerFactory??defaultWorkerFactory)();worker=current;
      const onMessage:EventListener=(event)=>{
        if(destroyed||generation!==version||current!==worker)return;
        const raw=(event as MessageEvent<unknown>).data;
        if(raw&&typeof raw==='object'&&'kind'in raw&&(raw.kind==='trail'||raw.kind==='history')&&'jobId'in raw&&typeof raw.jobId==='number'&&Number.isSafeInteger(raw.jobId)&&raw.jobId>=0){
          const job=active[raw.kind];
          // Only known superseded/cancelled/completed work may be ignored. A
          // future or ill-typed identifier is a protocol failure, not silence.
          if(job?(raw.jobId<job.id||(job.completed&&raw.jobId===job.id)):raw.jobId<=nextId)return;
          if(job?raw.jobId>job.id:raw.jobId>nextId){fail('The trail worker returned an unrequested job identifier. Retry to restart it.');return;}
        }
        const parsed=trailResponseSchema.safeParse(raw);
        if(!parsed.success){fail('The trail worker returned invalid numerical data. Retry to restart it.');return;}
        const message=parsed.data;
        if(message.type==='ready'){if(ready)return;clearTimeout(startupTimer);startupTimer=undefined;ready=true;send('trail');send('history');return;}
        if(message.type==='error'){
          if(message.kind==='init'){fail(message.error);return;}
          if(active[message.kind]?.id!==message.jobId){fail('The trail worker returned an unrequested job identifier. Retry to restart it.');return;}
          clearJobTimer(message.kind);
          if(active[message.kind])active[message.kind]!.completed=true;
          publish(message.kind,{...state[message.kind],status:'error',error:message.error});return;
        }
        const job=active[message.kind];if(!job||job.id!==message.jobId||job.completed)return;
        const result=message.result,input=job.input;
        const sameCommon=result.observer.latitudeDeg===input.observer.latitudeDeg&&result.observer.longitudeDeg===input.observer.longitudeDeg&&result.requestedStartMs===input.startMs&&result.requestedEndMs===input.endMs&&result.anchorMs===input.anchorMs;
        const sameTarget=message.kind==='trail'?'bodyId'in result&&'bodyId'in input&&result.bodyId===input.bodyId&&result.frame===input.frame&&result.samples.length<(input.maxVertices??2000):'system'in result&&'system'in input&&result.system===input.system&&result.house===input.house&&result.samples.length<=input.count;
        if(!sameCommon||!sameTarget||(message.type==='result'&&result.status==='partial')||(message.type==='progress'&&result.status!=='partial')){fail('The trail worker returned data for a different request. Retry to restart it.');return;}
        if(message.type==='result'){
          clearJobTimer(message.kind);
          job.completed=true;
          if(cacheSize){cache.delete(job.key);cache.set(job.key,freeze(result));while(cache.size>cacheSize)cache.delete(cache.keys().next().value!);}
        }
        if(message.kind==='trail')publish('trail',{status:message.type==='result'?'ready':'partial',progress:result.progress,result:result as TrailResult,error:null});
        else publish('history',{status:message.type==='result'?'ready':'partial',progress:result.progress,result:result as BoundaryHistoryResult,error:null});
      };
      const onError:EventListener=()=>{if(generation===version&&current===worker)fail('The trail worker stopped unexpectedly. Retry to replace it.');};
      current.addEventListener('message',onMessage);current.addEventListener('error',onError);current.addEventListener('messageerror',onError);
      detach=()=>{current.removeEventListener('message',onMessage);current.removeEventListener('error',onError);current.removeEventListener('messageerror',onError);};
      startupTimer=setTimeout(()=>{if(!destroyed&&generation===version&&current===worker&&!ready)fail('The trail engine took too long to start. Retry to load its data again.');},startupTimeoutMs);
      current.postMessage({type:'init'});
    }catch{fail('Unable to start the trail worker. Retry to try again.');}
  }
  function request(kind:Kind,input:TrailRequestInput|BoundaryHistoryRequestInput):void{
    if(destroyed)return;
    clearJobTimer(kind);
    const parsed=kind==='trail'?trailInputSchema.safeParse(input):historyInputSchema.safeParse(input);
    if(worker&&active[kind]?.sent&&!active[kind]?.completed){try{worker.postMessage({type:'cancel',kind});}catch{fail('Unable to cancel previous trail work. Retry to replace the worker.');}}
    active[kind]=null;
    if(!parsed.success){publish(kind,{...idle(),status:'error',error:'Invalid trail input. Check the supported anchor, interval, coordinates and sampling limits.'});return;}
    const value=parsed.data,key=trailCacheKey(kind,value),id=++nextId;
    active[kind]={id,input:value,key,sent:false,completed:false};
    // Clearing retained geometry makes new observer/target/interval labels truthful immediately.
    publish(kind,{...idle(),status:'loading'});
    const cached=cache.get(key);
    if(cached&&value.anchorMs>=cached.startMs&&value.anchorMs<=cached.endMs){
      cache.delete(key);cache.set(key,cached);active[kind]!.completed=true;
      const result={...cached,jobId:id};
      if(kind==='trail')publish(kind,{status:'ready',progress:result.progress,result:result as TrailResult,error:null});
      else publish(kind,{status:'ready',progress:result.progress,result:result as BoundaryHistoryResult,error:null});
      return;
    }
    startWorker();send(kind);
  }
  function cancel(kind:Kind):void{if(destroyed)return;clearJobTimer(kind);active[kind]=null;if(worker){try{worker.postMessage({type:'cancel',kind});}catch{fail('Unable to cancel trail work. Retry to replace the worker.');}}if(!ready&&!active.trail&&!active.history)stopWorker();publish(kind,idle());}
  return {subscribe:store.subscribe,requestTrail:(input)=>request('trail',input),requestHistory:(input)=>request('history',input),cancelTrail:()=>cancel('trail'),cancelHistory:()=>cancel('history'),retry:()=>{if(destroyed)return;stopWorker();for(const kind of ['trail','history']as const){const job=active[kind];if(job){job.id=++nextId;job.completed=false;publish(kind,{...idle(),status:'loading'});}}if(active.trail||active.history)startWorker();},destroy:()=>{if(destroyed)return;destroyed=true;stopWorker();active.trail=null;active.history=null;cache.clear();}};
}
