import { createServer,request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { once } from 'node:events';
import { isIP } from 'node:net';
import { performance } from 'node:perf_hooks';
import { mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import os from 'node:os';
import { createHash } from 'node:crypto';

export const COLD_PROFILE=Object.freeze({downloadBytesPerSecond:2_500_000,responseLatencyMs:40,runs:3,timeoutMs:30000,maxResponseBytes:8*1024*1024,maxRunBytes:16*1024*1024});
export function validateArtifactOrigin(value){
  const url=new URL(value),host=url.hostname.replace(/^\[|\]$/g,'');
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!(host==='localhost'||host==='::1'||isIP(host)===4&&host.startsWith('127.')))throw new Error('Provide a loopback HTTP(S) artifact origin without path, credentials, query or fragment.');
  return url.origin;
}

/** One FIFO serialization clock for every response, including dedicated-worker requests. No idle-credit bursts. */
export class AggregatePacer{
  constructor({bytesPerSecond=COLD_PROFILE.downloadBytesPerSecond,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}){
    if(!Number.isFinite(bytesPerSecond)||bytesPerSecond<=0||bytesPerSecond>100_000_000)throw new RangeError('Invalid aggregate body rate.');
    this.rate=bytesPerSecond;this.now=now;this.schedule=schedule;this.cancel=cancel;this.queue=[];this.availableAt=0;this.timer=null;this.active=null;this.closed=false;
  }
  send(bytes,write){
    if(!Number.isInteger(bytes)||bytes<0||bytes>65536)return Promise.reject(new RangeError('Paced chunks must contain at most64KiB.'));
    if(this.closed||this.queue.length>=64)return Promise.reject(new Error('Paced response queue is closed or full.'));
    return new Promise((resolve,reject)=>{this.queue.push({bytes,write,resolve,reject});this.pump();});
  }
  pump(){
    if(this.active||this.closed||!this.queue.length)return;
    const entry=this.queue.shift();this.active=entry;const now=this.now();this.availableAt=Math.max(now,this.availableAt)+1000*entry.bytes/this.rate;
    this.timer=this.schedule(()=>{this.timer=null;Promise.resolve().then(entry.write).then(entry.resolve,entry.reject).finally(()=>{this.active=null;this.pump();});},Math.max(0,Math.ceil(this.availableAt-now)));
  }
  close(){this.closed=true;if(this.timer!==null)this.cancel(this.timer);const error=new Error('Paced response queue closed.');this.active?.reject(error);this.active=null;for(const entry of this.queue.splice(0))entry.reject(error);}
}

const bodyHeaders=new Set(['content-type','content-length','content-encoding','content-security-policy','cache-control','etag','vary','x-content-type-options','referrer-policy','permissions-policy','cross-origin-opener-policy','x-frame-options']);
/** Raw node:http preserves encoded bytes. Fetch must not replace this upstream transport. */
export async function createPacedProxy(origin,{profile=COLD_PROFILE}={}){
  const upstreamOrigin=validateArtifactOrigin(origin),started=performance.now(),resources=[],failures=[],pacer=new AggregatePacer({bytesPerSecond:profile.downloadBytesPerSecond});
  let totalBytes=0,totalReceived=0,active=0,requests=0;const outgoing=new Set(),clients=new Set();
  const server=createServer({maxHeaderSize:8192},(req,res)=>{
    const target=req.url??'/',method=req.method??'GET';
    // Never forward an absolute URL, API query, credential or user/provider traffic.
    if(!['GET','HEAD'].includes(method)||target.length>512||!target.startsWith('/')||target.startsWith('//')||target.includes('\\')||target.includes('%')||!/^\/(?:$|index\.html$|favicon\.ico$|assets\/[A-Za-z0-9_.-]+$|data\/ephemeris\/[A-Za-z0-9_.-]+(?:\?sha256=[a-f0-9]{64})?$)/.test(target)||++requests>64||active>=16){failures.push({kind:'blocked-request',path:'[non-asset request]'});res.writeHead(403,{'Content-Type':'text/plain'});res.end('Cold-load proxy accepts only release assets.');return;}
    active++;const record={path:target,method,status:null,contentType:null,contentEncoding:'identity',declaredBytes:null,encodedBytes:0,requestedMs:performance.now()-started,headersMs:null,firstBodyMs:null,completedMs:null};resources.push(record);
    let received=0,finished=false;const done=()=>{if(!finished){finished=true;active--;record.completedMs=performance.now()-started;}};res.once('close',()=>{done();upstream.destroy();});
    const headers={'Accept-Encoding':req.headers['accept-encoding']??'identity','User-Agent':'SpatialAstrologyColdLoad/1','Connection':'close'};
    const url=new URL(target,upstreamOrigin),transport=url.protocol==='https:'?httpsRequest:httpRequest;
    const upstream=transport(url,{method,headers},async incoming=>{
      record.status=incoming.statusCode??0;record.contentType=String(incoming.headers['content-type']??'');record.contentEncoding=String(incoming.headers['content-encoding']??'identity');record.declaredBytes=incoming.headers['content-length']===undefined?null:Number(incoming.headers['content-length']);
      try{
        await new Promise(resolve=>setTimeout(resolve,profile.responseLatencyMs));
        if(res.destroyed)return;for(const [name,value]of Object.entries(incoming.headers))if(bodyHeaders.has(name)&&value!==undefined)res.setHeader(name,value);res.statusCode=record.status;res.flushHeaders();record.headersMs=performance.now()-started;
        for await(const chunk of incoming){
          received+=chunk.length;totalReceived+=chunk.length;if(received>profile.maxResponseBytes||totalReceived>profile.maxRunBytes)throw new Error('Cold-load transfer exceeded its byte bound.');
          // A response awaits each chunk; at most16 responses can hold a chunk each.
          for(let offset=0;offset<chunk.length;offset+=65536){const bytes=chunk.subarray(offset,offset+65536);await pacer.send(bytes.length,async()=>{if(res.destroyed)throw new Error('Cold-load client disconnected.');record.firstBodyMs??=performance.now()-started;const writable=res.write(bytes);record.encodedBytes+=bytes.length;totalBytes+=bytes.length;if(!writable)await new Promise((resolve,reject)=>{const clear=()=>{res.off('drain',drain);res.off('close',close);};const drain=()=>{clear();resolve();},close=()=>{clear();reject(new Error('Cold-load client disconnected.'));};res.once('drain',drain);res.once('close',close);});});}
        }
        if(method!=='HEAD'&&record.declaredBytes!==null&&received!==record.declaredBytes)throw new Error('Encoded body length differed from its response header.');res.end();done();
      }catch{failures.push({kind:'upstream-or-pacing',path:target});res.destroy();upstream.destroy();done();}
    });
    outgoing.add(upstream);upstream.setTimeout(profile.timeoutMs,()=>upstream.destroy(new Error('Cold-load upstream timed out.')));upstream.once('close',()=>outgoing.delete(upstream));upstream.once('error',()=>{failures.push({kind:'upstream-failure',path:target});res.destroy();done();});req.resume();upstream.end();
  });
  server.on('connection',socket=>{clients.add(socket);socket.once('close',()=>clients.delete(socket));});server.maxConnections=16;server.headersTimeout=5000;server.requestTimeout=profile.timeoutMs;server.setTimeout(profile.timeoutMs,socket=>socket.destroy());server.listen(0,'127.0.0.1');await once(server,'listening');
  return{origin:`http://127.0.0.1:${server.address().port}`,resources,failures,get totalBytes(){return totalBytes;},get active(){return active;},async close(){pacer.close();for(const request of outgoing)request.destroy();for(const socket of clients)socket.destroy();await new Promise(resolve=>server.close(resolve));}};
}
export function summarizeColdRuns(runs){
  const values=runs.map(run=>run.phases.firstUsableMs).sort((a,b)=>a-b);if(!values.length)throw new Error('Cold runs are required.');
  return{count:values.length,medianMs:values[Math.floor(values.length/2)],p95Ms:values[Math.ceil(values.length*0.95)-1],maxMs:values.at(-1),p95Method:'Nearest-rank; with3 runs p95 equals the maximum. This small sample does not establish a population percentile.',underFiveSeconds:values.every(value=>value<5000)};
}

export async function artifactIdentity(origin){
  const transport=new URL(origin).protocol==='https:'?httpsRequest:httpRequest;
  return new Promise((resolve,reject)=>{const request=transport(new URL('/release-manifest.json',origin),{headers:{'Accept-Encoding':'identity'},signal:globalThis.AbortSignal.timeout(5000)},async response=>{try{if(response.statusCode!==200)throw new Error('A production release manifest is required.');const chunks=[];let size=0;for await(const chunk of response){size+=chunk.length;if(size>2*1024*1024)throw new Error('Production manifest exceeded its bound.');chunks.push(chunk);}const bytes=Buffer.concat(chunks),value=JSON.parse(bytes.toString());if(value.application!=='Spatial Astrology Explorer'||!/^[a-f0-9]{40}$/.test(value.revision)||!/^[a-f0-9]{64}$/.test(value.source?.sha256))throw new Error('Production release identity is invalid.');resolve({revision:value.revision,tree:value.tree,sourceArchiveSha256:value.source.sha256,servedManifestSha256:createHash('sha256').update(bytes).digest('hex')});}catch(error){response.destroy();reject(error);}});request.once('error',()=>reject(new Error('Production artifact identity could not be read.')));request.end();});
}
async function measure(origin,output,hardware){
  const artifact=await artifactIdentity(origin);
  process.env.PLAYWRIGHT_BROWSERS_PATH??=resolve('.cache/playwright');const {chromium}=await import('playwright');
  const args=hardware?(process.platform==='win32'?['--use-angle=d3d11','--enable-gpu','--disable-software-rasterizer']:['--enable-gpu','--disable-software-rasterizer']):[];
  const browser=await chromium.launch({headless:true,args}),runs=[];
  try{for(let index=0;index<COLD_PROFILE.runs;index++){
    const proxy=await createPacedProxy(origin),context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[];
    try{
      page.on('pageerror',error=>errors.push(error.message));await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==proxy.origin||url.pathname.startsWith('/api/')){blocked.push(url.origin+url.pathname);return route.abort('blockedbyclient');}return route.continue();});
      await context.addInitScript(()=>{
        const probe={exampleClickMs:null,chartReadyMs:null,firstUsableMs:null};window.__coldLoad=probe;
        document.addEventListener('click',event=>{if(event.target?.closest?.('button')?.textContent.includes('Explore example'))probe.exampleClickMs=performance.now();},true);
        const observer=new window.MutationObserver(()=>{if(probe.chartReadyMs!==null)return;const ready=document.querySelector('.app-status [role="status"]')?.textContent.trim()==='Moment calculated',canvas=document.querySelector('.scene-canvas canvas'),zoom=document.querySelector('button[aria-label="Zoom in"]');if(!ready||!canvas||zoom?.disabled!==false)return;probe.chartReadyMs=performance.now();observer.disconnect();window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{probe.firstUsableMs=performance.now();}));});observer.observe(document,{childList:true,subtree:true,characterData:true,attributes:true});
      });
      await page.goto(proxy.origin,{waitUntil:'domcontentloaded',timeout:COLD_PROFILE.timeoutMs});await page.getByRole('button',{name:/Explore example/}).click({timeout:COLD_PROFILE.timeoutMs});await page.waitForFunction(()=>window.__coldLoad?.firstUsableMs!==null&&window.__coldLoad?.firstUsableMs!==undefined,{},{timeout:COLD_PROFILE.timeoutMs});
      const measured=await page.evaluate(()=>{const canvas=document.querySelector('.scene-canvas canvas'),gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw new Error('A usable WebGL2 scene was not available.');const debug=gl.getExtension('WEBGL_debug_renderer_info'),navigation=performance.getEntriesByType('navigation')[0];return{phases:{...window.__coldLoad,domContentLoadedMs:navigation.domContentLoadedEventEnd,loadEventMs:navigation.loadEventEnd,clickToUsableMs:window.__coldLoad.firstUsableMs-window.__coldLoad.exampleClickMs},driver:{renderer:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER),vendor:gl.getParameter(debug?debug.UNMASKED_VENDOR_WEBGL:gl.VENDOR),version:gl.getParameter(gl.VERSION),viewport:[window.innerWidth,window.innerHeight],devicePixelRatio:window.devicePixelRatio},currentLocalMoment:document.querySelector('[data-testid="displayed-local-moment"]')?.textContent,currentUtcMoment:document.querySelector('[data-testid="displayed-utc-moment"]')?.textContent};});
      await page.waitForLoadState('networkidle',{timeout:5000});if(errors.length||blocked.length||proxy.failures.length||proxy.active)throw new Error('Cold load contained browser, blocked-network, upstream or unfinished-transfer errors.');
      const resources=proxy.resources.map(resource=>({...resource}));if(!resources.some(resource=>/ephemeris-worker.*\.js/.test(resource.path))||!resources.some(resource=>resource.path.includes('.wasm'))||resources.filter(resource=>resource.path.includes('.se1')).length!==2)throw new Error('Cold run did not account for the worker, WASM and both ephemeris assets.');
      runs.push({run:index+1,...measured,encodedBodyBytes:proxy.totalBytes,encodedCodeBytes:resources.filter(resource=>/\.(?:js|css)(?:\?|$)/.test(resource.path)).reduce((sum,resource)=>sum+resource.encodedBytes,0),resources,errors,blocked});console.log(`Cold run ${index+1}/${COLD_PROFILE.runs}: ${measured.phases.firstUsableMs.toFixed(1)}ms, ${proxy.totalBytes} encoded body bytes.`);
    }finally{await context.close();await proxy.close();}
  }}finally{await browser.close();}
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),artifact,artifactOrigin:origin,browserVersion:browser.version(),launchArgs:args,host:{platform:os.platform(),release:os.release(),architecture:os.arch(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length},profile:COLD_PROFILE,summary:summarizeColdRuns(runs),runs,method:'Three fresh isolated Chromium contexts, cache disabled by request interception, fixed Greenwich2000-01-01T12Z example. One raw HTTP(S) loopback proxy serializes encoded response-body chunks across all page/worker requests at an aggregate2,500,000B/s (20Mbps), with40ms added before each response header. No idle token credit; timer/backpressure overhead can make observed delivery slower. Node http.request preserves gzip/Brotli bytes. Encoded byte totals exclude HTTP/TLS headers and framing. Page-navigation start to committed numerical/chart UI plus two requestAnimationFrame callbacks; this instrumented application-layer network profile is not an OS packet shaper, real last-mile link, or physical scanout measurement. Browser/CPU/driver caches outside fresh contexts can remain warm. Nearest-rank p95 over3 runs is descriptive only.'};
  await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(`Saved cold-load report: ${output}`);return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const {values}=parseArgs({options:{url:{type:'string',default:process.env.RELEASE_BASE_URL??'http://127.0.0.1:8080'},output:{type:'string',default:'.cache/cold-load-performance/report.json'},hardware:{type:'boolean',default:false}}});await measure(validateArtifactOrigin(values.url),resolve(values.output),values.hardware);}
