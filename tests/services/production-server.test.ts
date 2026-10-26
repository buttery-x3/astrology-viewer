import { afterEach,describe,expect,it,vi } from 'vitest';
import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises';
import { request } from 'node:http';
import path from 'node:path';
import { gzipSync,brotliCompressSync,gunzipSync,brotliDecompressSync } from 'node:zlib';
import { once } from 'node:events';
import { createProductionServer,preferredEncoding } from '../../server/production';
import { readProductionConfig,loopback,type ProductionConfig } from '../../server/config';
import { hash,inside,releaseManifestSchema,type ReleaseManifest,type ReleaseFile } from '../../server/manifest';
import { createLookupLimiter } from '../../server/rate-limit';
import { createLocationRouter } from '../../api/location-handler';
import { verifyServerGeography } from '../../server/geography';

const staging=path.resolve('.cache/m9-production-tests'),temporary:string[]=[],servers:import('node:http').Server[]=[];
const revision='a'.repeat(40),sha='b'.repeat(64),identities={engineManifest:sha,ephemerisManifest:sha,timezoneManifest:sha,skyManifest:sha,coastlineManifest:sha,contentManifest:sha,geographyManifest:sha,packageLock:sha};
async function fixture(){
  await mkdir(staging,{recursive:true});const root=await mkdtemp(path.join(staging,'test-release-'));temporary.push(root);const files:ReleaseFile[]=[];
  async function add(name:string,content:Uint8Array|string,mime:string,immutable=false,compress=false){
    const bytes=typeof content==='string'?Buffer.from(content):content,target=path.join(root,name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);const file:ReleaseFile={path:name,bytes:bytes.length,sha256:hash(bytes),mime,immutable};
    if(compress){file.encodings={};for(const encoding of ['gzip','br']as const){const encoded=encoding==='gzip'?gzipSync(bytes):brotliCompressSync(bytes),encodedPath=`${name}.${encoding==='gzip'?'gz':'br'}`;await writeFile(path.join(root,encodedPath),encoded);file.encodings[encoding]={path:encodedPath,bytes:encoded.length,sha256:hash(encoded)};}}
    files.push(file);return file;
  }
  await add('app/index.html','<!doctype html><title>Checked app</title>','text/html; charset=utf-8',false,true);
  const js=await add('app/assets/index-deadbeef.js','console.log("browser test");'.repeat(80),'text/javascript; charset=utf-8',true,true);
  const wasm=await add('app/assets/test-deadbeef.wasm',new Uint8Array([0,97,115,109,1,0,0,0]),'application/wasm',true,true);
  const model=await add('app/data/ephemeris/test.se1',new Uint8Array([1,2,3,4]),'application/octet-stream');
  const source=await add(`source/source-${revision}.tar.gz`,gzipSync(Buffer.from('test exact source archive')),'application/gzip',true);
  await add('server.mjs','// checked server entry','text/javascript; charset=utf-8');await add('licences/LICENSE','Test source licence','text/plain; charset=utf-8');
  const manifest:ReleaseManifest={schemaVersion:1,application:'Spatial Astrology Explorer',version:'0.1.0',revision,tree:'c'.repeat(40),createdAt:'2026-10-26T00:00:00.000Z',source:{path:source.path,sha256:source.sha256,url:`https://github.com/buttery-x3/astrology-viewer/tree/${revision}`},lookupOrigin:null,identities,files};await writeFile(path.join(root,'release-manifest.json'),JSON.stringify(manifest));return{root,manifest,js,wasm,model,source};
}
async function serve(config?:ProductionConfig,router?:Parameters<typeof createProductionServer>[0]['router']){const release=await fixture(),made=await createProductionServer({root:release.root,config:config??readProductionConfig({}),router:router??(async()=>({status:200,body:{zones:['Etc/UTC'],dataset:'test'}})),verifyGeography:async()=>{}});servers.push(made.server);made.server.listen(0,'127.0.0.1');await once(made.server,'listening');const port=(made.server.address()as import('node:net').AddressInfo).port;return{...release,...made,port};}
function http(port:number,target:string,headers:Record<string,string>={},method='GET'):Promise<{status:number;headers:import('node:http').IncomingHttpHeaders;body:Buffer}>{return new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:target,headers,method},res=>{const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.setTimeout(2000,()=>req.destroy(new Error('Local production test timed out.')));req.end();});}
afterEach(async()=>{for(const server of servers.splice(0)){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}for(const target of temporary.splice(0)){if(!inside(staging,path.resolve(target)))throw new Error('Unsafe staging cleanup target.');await rm(target,{recursive:true,force:true});}vi.restoreAllMocks();});

describe('strict production release serving',()=>{
  it('serves checked app/WASM, exact source and security headers without exposing server files',async()=>{
    const release=await serve(),root=await http(release.port,'/');expect(root.status).toBe(200);expect(root.body.toString()).toContain('Checked app');expect(root.headers['content-security-policy']).toContain("script-src 'self' 'wasm-unsafe-eval'");expect(root.headers['content-security-policy']).not.toContain("'unsafe-eval'");expect(root.headers['x-content-type-options']).toBe('nosniff');expect(root.headers['referrer-policy']).toBe('no-referrer');expect(root.headers['cache-control']).toBe('no-cache');
    const wasm=await http(release.port,'/assets/test-deadbeef.wasm');expect(wasm.headers['content-type']).toBe('application/wasm');expect(WebAssembly.validate(new Uint8Array(wasm.body))).toBe(true);
    const offer=await http(release.port,'/source');expect(offer.status).toBe(200);expect(offer.body.toString()).toContain(release.source.path);expect(offer.body.toString()).toContain(revision);expect(offer.headers['cache-control']).toBe('no-store');
    const source=await http(release.port,`/${release.source.path}`);expect(hash(source.body)).toBe(release.manifest.source.sha256);expect(source.headers['content-disposition']).toContain('attachment');expect(source.headers['content-encoding']).toBeUndefined();
    for(const target of ['/server.mjs','/package.json','/.env','/.git/config','/missing.wasm','/%2e%2e/private.key','/source?birthDate=private'])expect([400,404]).toContain((await http(release.port,target)).status);
    expect((await http(release.port,'/',{Host:'127.attacker.example'})).status).toBe(400);expect((await http(release.port,'/',{Host:'127.0.0.1'})).status).toBe(200);
  });
  it('serves actual gzip/Brotli bytes with original MIME, Vary, matching hashes and correct HEAD/304 semantics',async()=>{
    const release=await serve();
    for(const encoding of ['gzip','br']as const){const response=await http(release.port,'/assets/index-deadbeef.js',{'Accept-Encoding':encoding});expect(response.headers['content-encoding']).toBe(encoding);expect(response.headers.vary).toBe('Accept-Encoding');expect(response.headers['content-type']).toBe('text/javascript; charset=utf-8');expect(response.body.length).toBe(release.js.encodings![encoding]!.bytes);expect(hash(response.body)).toBe(release.js.encodings![encoding]!.sha256);expect((encoding==='gzip'?gunzipSync(response.body):brotliDecompressSync(response.body)).toString()).toContain('browser test');expect(response.headers.etag).toBe(`"${hash(response.body)}"`);
      const head=await http(release.port,'/assets/index-deadbeef.js',{'Accept-Encoding':encoding},'HEAD');expect(head.body.length).toBe(0);expect(Number(head.headers['content-length'])).toBe(response.body.length);expect(head.headers['content-encoding']).toBe(encoding);
      const cached=await http(release.port,'/assets/index-deadbeef.js',{'Accept-Encoding':encoding,'If-None-Match':String(response.headers.etag)});expect(cached.status).toBe(304);expect(cached.body.length).toBe(0);
    }
    expect((await http(release.port,'/assets/index-deadbeef.js',{'Accept-Encoding':'gzip;q=1,br;q=0.5'})).headers['content-encoding']).toBe('gzip');expect((await http(release.port,'/assets/index-deadbeef.js',{'Accept-Encoding':'identity;q=1,gzip;q=0.1'})).headers['content-encoding']).toBeUndefined();expect((await http(release.port,'/assets/index-deadbeef.js',{'Accept-Encoding':'identity;q=1,gzip;q=1'})).headers['content-encoding']).toBe('gzip');expect((await http(release.port,'/assets/index-deadbeef.js',{'Accept-Encoding':'br;q=0,gzip;q=0'})).headers['content-encoding']).toBeUndefined();expect((await http(release.port,'/assets/index-deadbeef.js',{'Accept-Encoding':'br;q=0,gzip;q=0,identity;q=0'})).status).toBe(406);
  });
  it('only makes numerical data immutable for a matching hash query and rejects personal/cache-poisoning fields',async()=>{
    const release=await serve();expect((await http(release.port,'/data/ephemeris/test.se1')).headers['cache-control']).toBe('no-cache');expect((await http(release.port,`/data/ephemeris/test.se1?sha256=${release.model.sha256}`)).headers['cache-control']).toContain('immutable');expect((await http(release.port,`/data/ephemeris/test.se1?sha256=${'0'.repeat(64)}`)).status).toBe(400);expect((await http(release.port,'/?birthDate=private')).status).toBe(400);
    const router=vi.fn(async()=>({status:200,body:{results:[]}})),api=await serve(undefined,router);expect((await http(api.port,'/api/places?q=Paris&instantMs=123')).status).toBe(400);expect((await http(api.port,'/api/places?q=Paris&q=London')).status).toBe(400);expect(router).not.toHaveBeenCalled();expect((await http(api.port,'/api/places?q=Paris')).status).toBe(200);expect(router).toHaveBeenCalledTimes(1);
  });
  it('sanitizes handler failures and never writes request URLs, query values or private error details to logs',async()=>{
    const log=vi.spyOn(console,'log'),error=vi.spyOn(console,'error'),release=await serve(undefined,async()=>{throw new Error('birthDate=private, apikey=secret');});const response=await http(release.port,'/api/places?q=PrivatePlace');expect(response.status).toBe(500);expect(response.body.toString()).not.toMatch(/private|secret|PrivatePlace/);expect(log).not.toHaveBeenCalled();expect(error).not.toHaveBeenCalled();
  });
  it('rejects tampered source/app/encoded assets and unsafe manifest data before listening',async()=>{
    const release=await fixture();await writeFile(path.join(release.root,'app/index.html'),'tampered');await expect(createProductionServer({root:release.root,verifyGeography:async()=>{}})).rejects.toThrow('manifest');
    expect(releaseManifestSchema.safeParse({...release.manifest,source:{...release.manifest.source,url:'https://github.com/buttery-x3/astrology-viewer/tree/main'}}).success).toBe(false);expect(releaseManifestSchema.safeParse({...release.manifest,lookupOrigin:'javascript:alert(1)'}).success).toBe(false);expect(releaseManifestSchema.safeParse({...release.manifest,files:release.manifest.files.map((file,index)=>index===0?{...file,path:'app/.env'}:file)}).success).toBe(false);
  });
});

describe('HTTPS, proxy, origins and lookup limits',()=>{
  it('trusts HTTPS/client-IP headers only from configured proxy addresses and redirects to the configured HTTPS origin',async()=>{
    const trusted=await serve(readProductionConfig({PUBLIC_ORIGIN:'https://explorer.example',TRUST_PROXY:'loopback'}));const redirect=await http(trusted.port,'/');expect(redirect.status).toBe(308);expect(redirect.headers.location).toBe('https://explorer.example/');const secure=await http(trusted.port,'/',{'X-Forwarded-Proto':'https'});expect(secure.status).toBe(200);expect(secure.headers['strict-transport-security']).toContain('31536000');
    const untrusted=await serve(readProductionConfig({PUBLIC_ORIGIN:'https://explorer.example',TRUST_PROXY:'203.0.113.1'}));expect((await http(untrusted.port,'/',{'X-Forwarded-Proto':'https'})).status).toBe(308);
  });
  it('uses the nearest untrusted forwarded client, preventing an injected leftmost IP from bypassing limits',async()=>{
    const config=readProductionConfig({PUBLIC_ORIGIN:'https://explorer.example',TRUST_PROXY:'loopback',LOOKUP_PER_CLIENT_PER_MINUTE:'3'}),release=await serve(config);expect((await http(release.port,'/api/places?q=Paris',{'X-Forwarded-Proto':'https','X-Forwarded-For':'203.0.113.1,198.51.100.10'})).status).toBe(200);const limited=await http(release.port,'/api/places?q=Paris',{'X-Forwarded-Proto':'https','X-Forwarded-For':'203.0.113.2,198.51.100.10'});expect(limited.status).toBe(429);expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });
  it('only enables configured CORS origins and keeps response credentials disabled',async()=>{
    const release=await serve(readProductionConfig({CORS_ORIGIN:'https://client.example'}));const allowed=await http(release.port,'/api/timezone?latitude=0&longitude=0',{Origin:'https://client.example'});expect(allowed.status).toBe(200);expect(allowed.headers['access-control-allow-origin']).toBe('https://client.example');expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();expect((await http(release.port,'/api/timezone?latitude=0&longitude=0',{Origin:'https://other.example'})).status).toBe(403);
    const preflight=await http(release.port,'/api/timezone?latitude=0&longitude=0',{Origin:'https://client.example'},'OPTIONS');expect(preflight.status).toBe(204);expect(preflight.headers['access-control-allow-methods']).toBe('GET');
  });
  it('requires explicit secure public hosting and keeps provider secrets on the backend',async()=>{
    for(const env of [{HOST:'0.0.0.0'},{PUBLIC_ORIGIN:'http://public.example'},{PUBLIC_ORIGIN:'http://127.attacker.example'},{CORS_ORIGIN:'http://127.attacker.example'},{PUBLIC_ORIGIN:'https://user:secret@public.example'},{TRUST_PROXY:'*'},{GEOCODING_MODE:'customer'},{GEOCODING_MODE:'free',GEOCODING_API_KEY:'secret'},{HTTPS_CERT_FILE:'certificate-only'}])expect(()=>readProductionConfig(env)).toThrow();
    for(const value of ['127.0.0.1','127.25.30.40','::1','localhost','::ffff:127.0.0.1'])expect(loopback(value)).toBe(true);for(const value of ['127.attacker.example','127.999.0.1','127.','203.0.113.1'])expect(loopback(value)).toBe(false);
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({results:[]}))),router=createLocationRouter({geocoding:{mode:'customer',apiKey:'backend-secret'},fetch:fetcher as typeof fetch});const result=await router(new URL('https://local/api/places?q=Paris'));expect(result?.status).toBe(200);const url=(fetcher.mock.calls[0]as unknown as[URL])[0];expect(url.hostname).toBe('customer-geocoding-api.open-meteo.com');expect(url.searchParams.get('apikey')).toBe('backend-secret');expect(JSON.stringify(result)).not.toContain('backend-secret');
    const disabled=createLocationRouter({geocoding:{mode:'disabled'},find:()=>['Etc/UTC']});expect((await disabled(new URL('https://local/api/places?q=Paris')))?.status).toBe(503);expect((await disabled(new URL('https://local/api/timezone?latitude=0&longitude=0')))?.status).toBe(200);
  });
  it('bounds memory, global search budgets and UTC-day reset independently of per-client identities',()=>{
    let now=1000;const limiter=createLookupLimiter({perClientPerMinute:3,searchPerMinute:1,searchPerDay:1,maxClients:2},()=>now);expect(limiter.consume('a',true).allowed).toBe(true);expect(limiter.consume('b',true).allowed).toBe(false);expect(limiter.consume('c',false)).toEqual({allowed:false,retryAfter:60});expect(limiter.size).toBe(2);now=86400001;expect(limiter.consume('c',true).allowed).toBe(true);expect(limiter.size).toBe(1);
  });
  it('verifies the pinned installed comprehensive geography and parses compression preferences deterministically',async()=>{await expect(verifyServerGeography()).resolves.toBeUndefined();const available={br:{path:'a',sha256:sha,bytes:1},gzip:{path:'b',sha256:sha,bytes:1}};expect(preferredEncoding('br;q=0,gzip;q=1',available)).toBe('gzip');expect(preferredEncoding('identity;q=1,gzip;q=0.1',available)).toBeNull();expect(preferredEncoding('identity;q=1,br;q=1,gzip;q=1',available)).toBe('br');});
});
