export type BoundedFetchCode='timeout'|'too-large'|'http'|'network'|'invalid-json';
export class BoundedFetchError extends Error{
  constructor(public readonly code:BoundedFetchCode,message:string,public readonly status?:number){super(message);this.name='BoundedFetchError';}
}
export interface BoundedFetchOptions{maxBytes:number;timeoutMs:number;signal?:AbortSignal;fetch?:typeof fetch;cache?:RequestCache}
const cancelled=()=>new DOMException('Request cancelled.','AbortError');
function discard(body:ReadableStream<Uint8Array>|null):void{if(body)void body.cancel().catch(()=>{});}

/** Bound actual streamed bytes and the entire request, including a stalled body. No request URL enters errors. */
export async function boundedFetch(url:string|URL,options:BoundedFetchOptions):Promise<Uint8Array>{
  if(!Number.isSafeInteger(options.maxBytes)||options.maxBytes<1||options.maxBytes>32*1024*1024||!Number.isFinite(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>120000)throw new RangeError('A bounded request needs1–33554432 bytes and1–120000ms.');
  if(options.signal?.aborted)throw cancelled();
  const controller=new AbortController();
  let rejectAbort:(reason:unknown)=>void=()=>{};
  const aborted=new Promise<never>((_resolve,reject)=>{rejectAbort=reject;});
  // An already aborted caller can reject before the first fetch promise exists.
  void aborted.catch(()=>{});
  const onAbort=()=>rejectAbort(controller.signal.reason);
  controller.signal.addEventListener('abort',onAbort,{once:true});
  const onExternalAbort=()=>controller.abort(cancelled());
  options.signal?.addEventListener('abort',onExternalAbort,{once:true});
  if(options.signal?.aborted)onExternalAbort();
  const timer=setTimeout(()=>controller.abort(new BoundedFetchError('timeout','The network request timed out. Retry when the connection is available.')),options.timeoutMs);
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,finished=false;
  try{
    if(controller.signal.aborted)throw controller.signal.reason;
    const operation=Promise.resolve().then(()=>{
      if(controller.signal.aborted)throw controller.signal.reason;
      return (options.fetch??fetch)(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:options.cache??'default'});
    }).then((response)=>{if(controller.signal.aborted){discard(response.body);throw controller.signal.reason;}return response;});
    const response=await Promise.race([operation,aborted]);
    if(!response.ok){discard(response.body);throw new BoundedFetchError('http','The requested resource is unavailable.',response.status);}
    const declared=response.headers.get('Content-Length');
    if(declared!==null&&/^\d+$/.test(declared)&&Number(declared)>options.maxBytes){discard(response.body);throw new BoundedFetchError('too-large','The network response exceeded its permitted size.');}
    if(!response.body){finished=true;return new Uint8Array();}
    reader=response.body.getReader();
    const chunks:Uint8Array[]=[];let length=0;
    while(true){
      const next=await Promise.race([reader.read(),aborted]);
      if(next.done)break;
      length+=next.value.byteLength;
      if(length>options.maxBytes)throw new BoundedFetchError('too-large','The network response exceeded its permitted size.');
      chunks.push(next.value);
    }
    const bytes=new Uint8Array(length);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    finished=true;return bytes;
  }catch(error){
    if(controller.signal.aborted)throw controller.signal.reason;
    if(error instanceof BoundedFetchError)throw error;
    throw new BoundedFetchError('network','The network request failed. Retry when the connection is available.');
  }finally{
    clearTimeout(timer);options.signal?.removeEventListener('abort',onExternalAbort);controller.signal.removeEventListener('abort',onAbort);
    if(reader){if(!finished)void reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{/* A non-cooperating stream may still have a pending read. */}}
  }
}

export async function boundedJsonFetch(url:string|URL,options:BoundedFetchOptions):Promise<unknown>{
  const bytes=await boundedFetch(url,options);
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))as unknown;}
  catch{throw new BoundedFetchError('invalid-json','The network response was not valid JSON.');}
}
