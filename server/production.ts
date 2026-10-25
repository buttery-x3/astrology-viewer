import { createServer,type IncomingMessage,type ServerResponse,type Server } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { type TLSSocket } from 'node:tls';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { isIP } from 'node:net';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createLocationRouter,type LookupReply } from '../api/location-handler';
import { readProductionConfig,normalizeIp,type ProductionConfig } from './config';
import { createLookupLimiter } from './rate-limit';
import { verifyRelease,type ReleaseManifest,type ReleaseFile } from './manifest';
import { verifyServerGeography } from './geography';
import { coordinateQuerySchema,placeQuerySchema } from '../src/lib/services/location-schema';
import { loopback } from './config';

interface ServerOptions{root:string;config?:ProductionConfig;router?:(url:URL,method?:string)=>Promise<LookupReply|null>;now?:()=>number;verifyGeography?:()=>Promise<void>}
const escape=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function peer(req:IncomingMessage,config:ProductionConfig):{identity:string;secure:boolean}{
  const remote=normalizeIp(req.socket.remoteAddress??'unknown'),trusted=config.trustedProxies.includes(remote);
  let identity=remote;
  if(trusted&&typeof req.headers['x-forwarded-for']==='string'){
    const chain=req.headers['x-forwarded-for'].split(',').map(value=>normalizeIp(value.trim()));
    if(chain.length<=16&&chain.every(value=>isIP(value))){chain.push(remote);while(chain.length>1&&config.trustedProxies.includes(chain.at(-1)!))chain.pop();identity=chain.at(-1)!;}
  }
  const secure=(req.socket as TLSSocket).encrypted===true||trusted&&req.headers['x-forwarded-proto']==='https';return{identity,secure};
}
export function contentSecurityPolicy(manifest:ReleaseManifest):string{
  const connect=manifest.lookupOrigin?`'self' ${new URL(manifest.lookupOrigin).origin}`:"'self'";
  return `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src ${connect}; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'`;
}
function sourcePage(manifest:ReleaseManifest):string{
  const licences=manifest.files.filter(file=>file.path.startsWith('licences/'));
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Source and licences · Spatial Astrology Explorer</title><body><main><h1>Source and licences</h1><p>This is Spatial Astrology Explorer ${escape(manifest.version)}, release <code>${manifest.revision}</code>.</p><p>Application source: GNU Affero General Public License, version3 only. Other components and data retain their own notices.</p><p><a href="/${manifest.source.path}" download>Download the exact release source (.tar.gz)</a> · <a href="${escape(manifest.source.url)}" rel="noreferrer">Browse this exact Git commit</a></p><p>Source SHA-256: <code>${manifest.source.sha256}</code>. The archive includes application/native source, wrapper, build and data preparation scripts, dependency lockfile and notices. Installation instructions are included.</p><p><a href="/release-manifest.json">Build and file provenance manifest</a></p><h2>Retained notices and data attribution</h2><ul>${licences.map(file=>`<li><a href="/${file.path}">${escape(file.path.slice(9))}</a></li>`).join('')}</ul><p><a href="/">Return to the explorer</a></p></main></body></html>`;
}
function headers(res:ServerResponse,policy:string,secure:boolean):void{
  res.setHeader('Content-Security-Policy',policy);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
}
function json(res:ServerResponse,status:number,body:unknown):void{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));}
function routeFor(file:ReleaseFile):string|null{return file.path.startsWith('app/')?`/${file.path.slice(4)}`:file.path.startsWith('source/')||file.path.startsWith('licences/')?`/${file.path}`:null;}
export function preferredEncoding(header:string,available:ReleaseFile['encodings']):'br'|'gzip'|null|false{
  const weights=new Map<string,number>();
  for(const part of header.split(',').slice(0,20)){const parsed=/^\s*(br|gzip|identity|\*)\s*(?:;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/i.exec(part);if(parsed)weights.set(parsed[1]!.toLowerCase(),Number(parsed[2]??1));}
  const candidates=(['br','gzip']as const).map(name=>({name,quality:available?.[name]?weights.get(name)??weights.get('*')??0:0})).sort((a,b)=>b.quality-a.quality);
  if(weights.has('identity')&&weights.get('identity')!>candidates[0]!.quality)return null;
  if(candidates[0]!.quality>0)return candidates[0]!.name;
  return(weights.get('identity')??(weights.get('*')===0?0:1))===0?false:null;
}
/** A production listener serves only checked release-manifest files and strict geographic GET endpoints. */
export async function createProductionServer(options:ServerOptions):Promise<{server:Server;manifest:ReleaseManifest}>{
  const root=path.resolve(options.root),config=options.config??readProductionConfig(),manifest=await verifyRelease(root);
  await(options.verifyGeography??verifyServerGeography)();
  const policy=contentSecurityPolicy(manifest),routes=new Map<string,ReleaseFile>();
  for(const file of manifest.files){const route=routeFor(file);if(route)routes.set(route,file);}
  const router=options.router??createLocationRouter({geocoding:config.geocoding}),limiter=createLookupLimiter(config.limits,options.now);
  const request=async(req:IncomingMessage,res:ServerResponse)=>{
    const context=peer(req,config);headers(res,policy,context.secure);
    try{
      const target=req.url??'/';
      if(target.length>2048||!target.startsWith('/')||target.startsWith('//')||target.includes('\\')||[...target].some(character=>character.charCodeAt(0)<32||character.charCodeAt(0)===127)){json(res,400,{error:'Invalid request target.'});return;}
      const url=new URL(target,'http://release.invalid');
      let decoded:string;try{decoded=decodeURIComponent(url.pathname);}catch{json(res,400,{error:'Invalid request path.'});return;}
      if(decoded.includes('\\')||decoded.includes('%')||decoded.split('/').some(part=>part==='.'||part==='..')||decoded.includes('\0')){json(res,400,{error:'Invalid request path.'});return;}
      const host=req.headers.host??'';if(!/^[A-Za-z0-9.:[\]-]+$/.test(host)){json(res,400,{error:'Invalid request host.'});return;}
      let requestOrigin:string;try{requestOrigin=new URL(`${context.secure?'https':'http'}://${host}`).origin;}catch{json(res,400,{error:'Invalid request host.'});return;}
      if(!config.publicOrigin&&!loopback(new URL(requestOrigin).hostname.replace(/^\[|\]$/g,''))){json(res,400,{error:'This local listener accepts loopback host names only.'});return;}
      const api=url.pathname==='/api/places'||url.pathname==='/api/timezone';
      const query=[...url.searchParams];
      if(api){const parsed=(url.pathname==='/api/places'?placeQuerySchema:coordinateQuerySchema).safeParse(Object.fromEntries(query));if(!parsed.success||query.length!==Object.keys(Object.fromEntries(query)).length){json(res,400,{error:'Only a place query or numeric coordinates are accepted.'});return;}}
      else if(query.length&&(query.length!==1||query[0]![0]!=='sha256'||!/^([a-f0-9]{64})$/.test(query[0]![1]))){json(res,400,{error:'Release resources do not accept these query fields.'});return;}
      if(config.publicOrigin?.startsWith('https://')&&!context.secure){res.statusCode=308;res.setHeader('Location',config.publicOrigin+url.pathname+url.search);res.setHeader('Cache-Control','no-store');res.end();return;}
      if(req.headers['transfer-encoding']||Number(req.headers['content-length']??0)>0){res.setHeader('Connection','close');json(res,400,{error:'Request bodies are not accepted.'});return;}
      if(api){
        const origin=req.headers.origin;
        if(origin&&origin!==config.corsOrigin&&origin!==(config.publicOrigin??requestOrigin)){json(res,403,{error:'This request origin is not enabled.'});return;}
        if(origin&&origin===config.corsOrigin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
        if(req.method==='OPTIONS'&&origin&&origin===config.corsOrigin){res.setHeader('Access-Control-Allow-Methods','GET');res.setHeader('Access-Control-Max-Age','600');res.statusCode=204;res.end();return;}
        if(req.method!=='GET'){res.setHeader('Allow','GET');json(res,405,{error:'Use a GET location request.'});return;}
        const limit=limiter.consume(context.identity,url.pathname==='/api/places');if(!limit.allowed){res.setHeader('Retry-After',String(limit.retryAfter));json(res,429,{error:'Location lookup is busy. Retry shortly or use manual coordinates and a zone.'});return;}
        const reply=await router(url,'GET');if(!reply){json(res,404,{error:'Location endpoint unavailable.'});return;}json(res,reply.status,reply.body);return;
      }
      if(!['GET','HEAD'].includes(req.method??'')){res.setHeader('Allow','GET, HEAD');json(res,405,{error:'Use GET or HEAD for a release resource.'});return;}
      if(url.pathname==='/source'){
        if(url.search){json(res,400,{error:'Source access does not accept query fields.'});return;}const body=sourcePage(manifest);res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Length',Buffer.byteLength(body));res.end(req.method==='HEAD'?undefined:body);return;
      }
      if(url.pathname==='/release-manifest.json'){
        if(url.search){json(res,400,{error:'Manifest access does not accept query fields.'});return;}const body=JSON.stringify(manifest);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Length',Buffer.byteLength(body));res.end(req.method==='HEAD'?undefined:body);return;
      }
      const requestedPath=url.pathname==='/'?'/index.html':url.pathname,file=routes.get(requestedPath);
      if(!file){json(res,404,{error:'Release resource not found.'});return;}
      if(query.length&&query[0]![1]!==file.sha256){json(res,400,{error:'Release cache identity does not match.'});return;}
      const encoding=preferredEncoding(req.headers['accept-encoding']??'',file.encodings);if(encoding===false){json(res,406,{error:'No acceptable resource encoding is available.'});return;}
      const selected=encoding?file.encodings![encoding]!:file,etag=`"${selected.sha256}"`;
      res.setHeader('Content-Type',file.mime);res.setHeader('Cache-Control',file.immutable||query.length?'public, max-age=31536000, immutable':'no-cache');res.setHeader('ETag',etag);res.setHeader('Vary','Accept-Encoding');
      if(encoding)res.setHeader('Content-Encoding',encoding);if(file.path.startsWith('source/'))res.setHeader('Content-Disposition',`attachment; filename="${path.basename(file.path)}"`);
      if(req.headers['if-none-match']===etag){res.statusCode=304;res.end();return;}
      res.setHeader('Content-Length',selected.bytes);if(req.method==='HEAD'){res.end();return;}await pipeline(createReadStream(path.join(root,selected.path)),res);
    }catch{
      if(!res.headersSent)json(res,500,{error:'The release resource could not be served.'});else res.destroy();
    }
  };
  const listener=(req:IncomingMessage,res:ServerResponse)=>{void request(req,res);};
  const server=config.tls?createSecureServer({cert:await readFile(config.tls.certFile),key:await readFile(config.tls.keyFile),maxHeaderSize:8192},listener):createServer({maxHeaderSize:8192},listener);
  server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;server.maxHeadersCount=50;server.setTimeout(30000,socket=>socket.destroy());
  server.on('clientError',(_error,socket)=>{if(socket.writable)socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');});
  return{server,manifest};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const root=process.env.RELEASE_ROOT??path.dirname(fileURLToPath(import.meta.url));
  try{
    const config=readProductionConfig(),{server,manifest}=await createProductionServer({root,config});server.listen(config.port,config.host,()=>{console.log('Spatial Astrology release server is ready.');if(process.send&&process.connected)process.send({type:'ready',port:(server.address()as import('node:net').AddressInfo).port,revision:manifest.revision});});
    const stop=()=>{server.close();setTimeout(()=>{server.closeAllConnections();process.exit(0);},5000).unref();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
  }catch{console.error('Release startup failed. Verify the release manifest, installed dependencies and server configuration.');process.exitCode=1;}
}
