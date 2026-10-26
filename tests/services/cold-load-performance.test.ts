import { afterEach,expect,it,vi } from 'vitest';
import { createServer,request,type Server } from 'node:http';
import { once } from 'node:events';
import { randomBytes,createHash } from 'node:crypto';
import { gzipSync,gunzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { AggregatePacer,COLD_PROFILE,createPacedProxy,summarizeColdRuns,validateArtifactOrigin } from '../../scripts/cold-load-performance.mjs';

const servers:Server[]=[],proxies:Awaited<ReturnType<typeof createPacedProxy>>[]=[];
afterEach(async()=>{vi.useRealTimers();for(const proxy of proxies.splice(0))await proxy.close();for(const server of servers.splice(0)){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}});
function get(url:string,headers:Record<string,string>={}):Promise<{status:number;headers:import('node:http').IncomingHttpHeaders;body:Buffer}>{return new Promise((resolve,reject)=>{const req=request(url,{headers},res=>{const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,body:Buffer.concat(chunks)}));});req.once('error',reject);req.setTimeout(2000,()=>req.destroy(new Error('Local proxy test timed out.')));req.end();});}
it('serializes concurrent bodies on one clock and does not accrue idle burst credit',async()=>{
  vi.useFakeTimers();let now=0;const pacer=new AggregatePacer({bytesPerSecond:1000,now:()=>now}),sent:number[]=[];
  const first=pacer.send(1000,()=>sent.push(now)),second=pacer.send(1000,()=>sent.push(now));now=999;await vi.advanceTimersByTimeAsync(999);expect(sent).toEqual([]);now=1000;await vi.advanceTimersByTimeAsync(1);await first;expect(sent).toEqual([1000]);now=1999;await vi.advanceTimersByTimeAsync(999);expect(sent).toHaveLength(1);now=2000;await vi.advanceTimersByTimeAsync(1);await second;expect(sent).toEqual([1000,2000]);
  now=10000;const third=pacer.send(1000,()=>sent.push(now));await vi.advanceTimersByTimeAsync(999);expect(sent).toHaveLength(2);now=11000;await vi.advanceTimersByTimeAsync(1);await third;expect(sent.at(-1)).toBe(11000);pacer.close();
});
it('bounds chunks and cancels active/queued waits explicitly',async()=>{
  vi.useFakeTimers();const pacer=new AggregatePacer({bytesPerSecond:1000});await expect(pacer.send(65537,()=>{})).rejects.toThrow('64KiB');const first=expect(pacer.send(1000,()=>{})).rejects.toThrow('closed'),second=expect(pacer.send(1000,()=>{})).rejects.toThrow('closed');pacer.close();await Promise.all([first,second]);await expect(pacer.send(1,()=>{})).rejects.toThrow('closed');
});
it('preserves actual gzip bytes and shares aggregate bandwidth across parallel asset responses',async()=>{
  const original=randomBytes(1024),encoded=gzipSync(original),observed:import('node:http').IncomingHttpHeaders[]=[],server=createServer((req,res)=>{observed.push(req.headers);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Encoding':'gzip','Content-Length':encoded.length});res.end(encoded);});servers.push(server);server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin=`http://127.0.0.1:${(server.address()as import('node:net').AddressInfo).port}`,profile={...COLD_PROFILE,downloadBytesPerSecond:20000},proxy=await createPacedProxy(origin,{profile});proxies.push(proxy);const started=performance.now(),responses=await Promise.all([get(proxy.origin+'/assets/a.js',{'Accept-Encoding':'gzip',Cookie:'private=secret',Authorization:'secret'}),get(proxy.origin+'/assets/worker.js',{'Accept-Encoding':'gzip'})]),elapsed=performance.now()-started;
  for(const response of responses){expect(response.status).toBe(200);expect(response.headers['content-encoding']).toBe('gzip');expect(response.body).toEqual(encoded);expect(gunzipSync(response.body)).toEqual(original);expect(createHash('sha256').update(response.body).digest('hex')).toBe(createHash('sha256').update(encoded).digest('hex'));}
  expect(elapsed).toBeGreaterThanOrEqual(profile.responseLatencyMs+2000*encoded.length/profile.downloadBytesPerSecond-5);expect(proxy.totalBytes).toBe(2*encoded.length);expect(proxy.resources.every(item=>item.encodedBytes===encoded.length&&item.contentEncoding==='gzip'&&item.headersMs!==null)).toBe(true);expect(proxy.failures).toEqual([]);expect(observed.every(headers=>!headers.cookie&&!headers.authorization&&headers['accept-encoding']==='gzip')).toBe(true);
  expect((await get(proxy.origin+'/api/places?q=private')).status).toBe(403);expect((await get(proxy.origin+'/?birthDate=private')).status).toBe(403);expect(observed).toHaveLength(2);expect(JSON.stringify(proxy.failures)).not.toContain('private');
});
it('only accepts the provided local artifact origin and reports small-sample p95 honestly',()=>{
  for(const origin of ['https://public.example','http://127.attacker.example','http://user:secret@127.0.0.1','http://127.0.0.1/api','http://127.0.0.1/?date=private','file:///tmp/artifact'])expect(()=>validateArtifactOrigin(origin)).toThrow();expect(validateArtifactOrigin('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080');const summary=summarizeColdRuns([3000,1000,2000].map(firstUsableMs=>({phases:{firstUsableMs}})));expect(summary).toMatchObject({count:3,medianMs:2000,p95Ms:3000,maxMs:3000,underFiveSeconds:true});expect(summary.p95Method).toContain('maximum');
});
