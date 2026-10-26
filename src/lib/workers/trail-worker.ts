import { EphemerisEngine,fetchEngineAssets } from '../astronomy/ephemeris';
import { makeTrailSample,sampleTrail,sampleBoundaryHistory,TrailCancelled,TRAIL_VERSION_KEY } from '../domain/trails';
import { trailRequestSchema,type TrailWorkerResponse } from './trail-protocol';

let enginePromise:Promise<EphemerisEngine>|undefined;
const getEngine=()=>enginePromise??=fetchEngineAssets().then(EphemerisEngine.create).catch((error)=>{enginePromise=undefined;throw error;});
const tokens={trail:0,history:0};
const respond=(message:TrailWorkerResponse)=>self.postMessage(message);
self.onmessage=async(event:MessageEvent<unknown>)=>{
  const parsed=trailRequestSchema.safeParse(event.data);
  if(!parsed.success){
    const raw=event.data as Record<string,unknown>|null;
    const kind=raw?.type==='trail'||raw?.type==='history'?raw.type:'init';
    const jobId=typeof raw?.jobId==='number'&&Number.isSafeInteger(raw.jobId)&&raw.jobId>=0?raw.jobId:0;
    respond({type:'error',kind,jobId,error:'Invalid trail request. Check the interval, target, coordinates and sampling limits.'});return;
  }
  const message=parsed.data;
  if(message.type==='cancel'){tokens[message.kind]++;return;}
  const kind=message.type,token=kind==='init'?0:++tokens[kind];
  const cancelled=()=>kind!=='init'&&tokens[kind]!==token;
  try{
    const engine=await getEngine();if(cancelled())return;
    if(message.type==='init'){respond({type:'ready',versionKey:TRAIL_VERSION_KEY});return;}
    if(message.type==='trail'){
      const result=await sampleTrail({...message.payload,jobId:message.jobId},(instantMs)=>makeTrailSample(engine.calculate(instantMs,message.payload.observer,[]),message.payload.bodyId),{cancelled,onProgress:(result)=>respond({type:'progress',kind:'trail',jobId:message.jobId,result})});
      if(!cancelled())respond({type:'result',kind:'trail',jobId:message.jobId,result});
    }else{
      const result=await sampleBoundaryHistory({...message.payload,jobId:message.jobId},(instantMs)=>engine.calculate(instantMs,message.payload.observer,[message.payload.system]),{cancelled,onProgress:(result)=>respond({type:'progress',kind:'history',jobId:message.jobId,result})});
      if(!cancelled())respond({type:'result',kind:'history',jobId:message.jobId,result});
    }
  }catch(error){if(error instanceof TrailCancelled||cancelled())return;respond({type:'error',kind,jobId:'jobId'in message?message.jobId:0,error:error instanceof Error?error.message:'Trail calculation failed.'});}
};
