import { z } from '../schema';
import { bodyIdSchema,houseSystemSchema,instantSchema,observerSchema } from './protocol';
import { TRAIL_VERSION_KEY,type TrailResult,type BoundaryHistoryResult } from '../domain/trails';

const finite=z.number().finite(),safeTime=finite.int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),jobId=finite.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const interval={startMs:safeTime,endMs:safeTime,anchorMs:instantSchema};
const containsAnchor=(value:{startMs:number;endMs:number;anchorMs:number})=>value.startMs<=value.anchorMs&&value.anchorMs<=value.endMs;
export const trailInputSchema=z.object({bodyId:bodyIdSchema,frame:z.enum(['stars','horizon']),observer:observerSchema,...interval,maxVertices:z.number().int().min(32).max(2000).optional(),toleranceDeg:finite.min(.01).max(2).optional(),maxComputeMs:finite.min(10).max(10000).optional()}).strict().refine(containsAnchor,'Interval must contain the supported exact anchor.');
export const historyInputSchema=z.object({system:houseSystemSchema,house:z.number().int().min(1).max(12),observer:observerSchema,...interval,count:z.number().int().min(1).max(7)}).strict().refine(containsAnchor,'Interval must contain the supported exact anchor.');
export const trailRequestSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('init')}).strict(),
  z.object({type:z.literal('trail'),jobId,payload:trailInputSchema}).strict(),
  z.object({type:z.literal('history'),jobId,payload:historyInputSchema}).strict(),
  z.object({type:z.literal('cancel'),kind:z.enum(['trail','history'])}).strict(),
]);
export type TrailWorkerRequest=z.infer<typeof trailRequestSchema>;
const unit=z.object({x:finite,y:finite,z:finite}).strict().refine((value)=>Math.abs(Math.hypot(value.x,value.y,value.z)-1)<1e-8,'Expected a unit fixed-frame direction.');
const enu=z.object({east:finite,north:finite,up:finite}).strict().refine((value)=>Math.abs(Math.hypot(value.east,value.north,value.up)-1)<1e-8,'Expected a unit local direction.');
const sample=z.object({instantMs:instantSchema,fixed:unit,enu}).strict();
const metadata={jobId,observer:observerSchema,anchorMs:instantSchema,requestedStartMs:safeTime,requestedEndMs:safeTime,startMs:instantSchema,endMs:instantSchema,status:z.enum(['partial','complete','limited']),progress:finite.min(0).max(1),limits:z.array(z.string().min(1).max(4096)).max(20),versionKey:z.literal(TRAIL_VERSION_KEY)};
function orderedBounds(value:{anchorMs:number;requestedStartMs:number;requestedEndMs:number;startMs:number;endMs:number;samples:{instantMs:number}[]}):boolean{
  return value.requestedStartMs<=value.startMs&&value.startMs<=value.endMs&&value.endMs<=value.requestedEndMs&&value.requestedStartMs<=value.anchorMs&&value.anchorMs<=value.requestedEndMs&&value.samples.every((entry,index)=>entry.instantMs>=value.startMs&&entry.instantMs<=value.endMs&&(index===0||entry.instantMs>value.samples[index-1]!.instantMs));
}
export const trailResultSchema:z.ZodType<TrailResult>=z.object({...metadata,bodyId:bodyIdSchema,frame:z.enum(['stars','horizon']),samples:z.array(sample).min(1).max(1999)}).strict().refine((value)=>orderedBounds(value)&&value.samples[0]!.instantMs===value.startMs&&value.samples.at(-1)!.instantMs===value.endMs&&value.samples.some((entry)=>entry.instantMs===value.anchorMs),'Invalid sampled trail interval.');
const historySample=z.discriminatedUnion('status',[
  z.object({instantMs:instantSchema,status:z.enum(['valid','jump']),longitudeDeg:finite.min(0).lt(360),direction:z.union([z.literal(1),z.literal(-1)]),point:unit,line:z.array(unit).length(45),reason:z.string().min(1).max(4096).optional()}).strict(),
  z.object({instantMs:instantSchema,status:z.literal('undefined'),reason:z.string().min(1).max(4096)}).strict(),
]);
export const historyResultSchema:z.ZodType<BoundaryHistoryResult>=z.object({...metadata,system:houseSystemSchema,house:z.number().int().min(1).max(12),samples:z.array(historySample).min(1).max(7)}).strict().refine((value)=>orderedBounds(value)&&value.endMs-value.startMs<=86400000,'Invalid bounded history interval.');
export const trailResponseSchema=z.union([
  z.object({type:z.literal('ready'),versionKey:z.literal(TRAIL_VERSION_KEY)}).strict(),
  z.object({type:z.enum(['progress','result']),kind:z.literal('trail'),jobId,result:trailResultSchema}).strict().refine((value)=>value.jobId===value.result.jobId,'Job identifier mismatch.'),
  z.object({type:z.enum(['progress','result']),kind:z.literal('history'),jobId,result:historyResultSchema}).strict().refine((value)=>value.jobId===value.result.jobId,'Job identifier mismatch.'),
  z.object({type:z.literal('error'),kind:z.enum(['init','trail','history']),jobId,error:z.string().min(1).max(4096)}).strict(),
]);
export type TrailWorkerResponse=z.infer<typeof trailResponseSchema>;
