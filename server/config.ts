import { isIP } from 'node:net';

export type GeocodingMode='free'|'customer'|'disabled';
export interface ProductionConfig{
  host:string;port:number;publicOrigin:string|null;trustedProxies:readonly string[];
  tls:{certFile:string;keyFile:string}|null;corsOrigin:string|null;
  geocoding:{mode:GeocodingMode;apiKey?:string};
  limits:{perClientPerMinute:number;searchPerMinute:number;searchPerDay:number;maxClients:number};
}
export function normalizeIp(value:string):string{return value.startsWith('::ffff:')&&isIP(value.slice(7))===4?value.slice(7):value;}
export function loopback(value:string):boolean{const ip=normalizeIp(value);return ip==='::1'||ip==='localhost'||isIP(ip)===4&&ip.startsWith('127.');}
function origin(value:string|undefined):string|null{
  if(!value)return null;
  let url:URL;try{url=new URL(value);}catch{throw new Error('A configured public/CORS origin must be an absolute HTTP(S) origin.');}
  if(value.length>200||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!loopback(url.hostname.replace(/^\[|\]$/g,'')))throw new Error('Public/CORS origins must use HTTPS, except loopback development origins, without credentials, path, query or fragment.');
  return url.origin;
}
function integer(value:string|undefined,fallback:number,minimum:number,maximum:number):number{
  if(value===undefined||value==='')return fallback;
  if(!/^\d+$/.test(value))throw new Error('Server numeric settings must be bounded integers.');
  const result=Number(value);if(!Number.isSafeInteger(result)||result<minimum||result>maximum)throw new Error('A server numeric setting is outside its supported bounds.');return result;
}
export function readProductionConfig(env:Record<string,string|undefined>=process.env):ProductionConfig{
  const host=env.HOST??'127.0.0.1';if(!isIP(host)&&host!=='localhost')throw new Error('HOST must be an IP address or localhost.');
  const port=integer(env.PORT,8080,0,65535),publicOrigin=origin(env.PUBLIC_ORIGIN),corsOrigin=origin(env.CORS_ORIGIN);
  const trust=env.TRUST_PROXY??'none';
  const trustedProxies=trust==='none'?[]:trust==='loopback'?['127.0.0.1','::1']:trust.split(',').map(value=>normalizeIp(value.trim()));
  if(trustedProxies.length>16||trustedProxies.some(value=>!isIP(value)))throw new Error('TRUST_PROXY must be none, loopback, or at most16 explicit IP addresses.');
  const certFile=env.HTTPS_CERT_FILE,keyFile=env.HTTPS_KEY_FILE;
  if(Boolean(certFile)!==Boolean(keyFile))throw new Error('Direct TLS requires both HTTPS_CERT_FILE and HTTPS_KEY_FILE.');
  const tls=certFile&&keyFile?{certFile,keyFile}:null;
  if(!loopback(host)&&(!publicOrigin?.startsWith('https://')||!tls&&!trustedProxies.length))throw new Error('A public listener requires an HTTPS public origin and direct TLS or an explicitly trusted reverse proxy.');
  if(publicOrigin?.startsWith('https://')&&!tls&&!trustedProxies.length)throw new Error('An HTTPS public origin requires direct TLS or an explicitly trusted reverse proxy.');
  const mode=env.GEOCODING_MODE??'free';if(!['free','customer','disabled'].includes(mode))throw new Error('GEOCODING_MODE must be free, customer or disabled.');
  const apiKey=env.GEOCODING_API_KEY;
  if(mode==='customer'&&(!apiKey||apiKey.length>256||!/^[-A-Za-z0-9_]+$/.test(apiKey)))throw new Error('Customer geocoding requires a bounded GEOCODING_API_KEY.');
  if(mode!=='customer'&&apiKey)throw new Error('GEOCODING_API_KEY is only used in customer mode.');
  return{host,port,publicOrigin,trustedProxies,tls,corsOrigin,geocoding:{mode:mode as GeocodingMode,...(apiKey?{apiKey}:{})},limits:{perClientPerMinute:integer(env.LOOKUP_PER_CLIENT_PER_MINUTE,60,3,1000),searchPerMinute:integer(env.SEARCH_PER_MINUTE,60,1,1000),searchPerDay:integer(env.SEARCH_PER_DAY,mode==='free'?9000:100000,1,1000000),maxClients:4096}};
}
