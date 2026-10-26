export const COLD_PROFILE:Readonly<{downloadBytesPerSecond:number;responseLatencyMs:number;runs:number;timeoutMs:number;maxResponseBytes:number;maxRunBytes:number}>;
export function validateArtifactOrigin(value:string):string;
export function artifactIdentity(origin:string):Promise<{revision:string;tree:string;sourceArchiveSha256:string;servedManifestSha256:string}>;
export class AggregatePacer{
  constructor(options?:{bytesPerSecond?:number;now?:()=>number;schedule?:typeof setTimeout;cancel?:typeof clearTimeout});
  send(bytes:number,write:()=>unknown):Promise<void>;
  close():void;
}
export function createPacedProxy(origin:string,options?:{profile?:typeof COLD_PROFILE}):Promise<{origin:string;resources:{path:string;status:number|null;contentEncoding:string;encodedBytes:number;headersMs:number|null;firstBodyMs:number|null;completedMs:number|null}[];failures:{kind:string;path:string}[];readonly totalBytes:number;readonly active:number;close():Promise<void>}>;
export function summarizeColdRuns(runs:{phases:{firstUsableMs:number}}[]):{count:number;medianMs:number;p95Ms:number;maxMs:number;p95Method:string;underFiveSeconds:boolean};
