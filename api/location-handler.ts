import {find,setCache} from 'geo-tz/all';
import {z} from 'zod';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Plugin} from 'vite';
import {placeResponseSchema,timezoneResponseSchema,placeQuerySchema,coordinateQuerySchema,zoneIdentifierSchema,type PlaceResult} from '../src/lib/services/location-schema';
import { boundedJsonFetch } from '../src/lib/net/bounded-fetch';

class BoundedMap<K,V> extends Map<K,V>{
  constructor(private readonly limit:number){super();}
  override set(key:K,value:V):this{
    if(this.has(key))this.delete(key);
    super.set(key,value);
    if(this.size>this.limit)this.delete(this.keys().next().value!);
    return this;
  }
}
setCache({store:new BoundedMap<string,unknown>(24)});
const upstreamSchema=z.object({results:z.array(z.object({id:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),name:z.string().min(1).max(200),latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180),timezone:zoneIdentifierSchema.optional(),admin1:z.string().max(200).optional(),country:z.string().max(200).optional()})).max(8).optional()});
export interface LookupReply{status:number;body:unknown}
export interface LocationRouterOptions{fetch?:typeof fetch;find?:(latitude:number,longitude:number)=>string[];geocoding?:{mode:'free'|'customer'|'disabled';apiKey?:string}}
export function createLocationRouter(options:LocationRouterOptions={}){
  const cached=new BoundedMap<string,{expires:number;body:unknown}>(256);
  const searchFetch=options.fetch??fetch,zoneFind=options.find??find;
  return async(url:URL,method='GET'):Promise<LookupReply|null>=>{
    if(!['/api/places','/api/timezone'].includes(url.pathname))return null;
    if(method!=='GET')return {status:405,body:{error:'Use a GET location request.'}};
    const query=Object.fromEntries(url.searchParams);
    const schema=url.pathname==='/api/places'?placeQuerySchema:coordinateQuerySchema;
    const parsed=schema.safeParse(query);
    if(!parsed.success||[...url.searchParams.keys()].length!==Object.keys(query).length)
      return {status:400,body:{error:'Invalid location query. Only place text or coordinates are accepted.'}};
    const key=url.pathname+JSON.stringify(parsed.data),hit=cached.get(key);
    if(hit&&hit.expires>Date.now())return {status:200,body:hit.body};
    try{
      let body:unknown;
      if('q' in parsed.data){
        const mode=options.geocoding?.mode??'free';
        if(mode==='disabled')return{status:503,body:{error:'Place search is disabled on this host. Use manual coordinates and a zone or UTC offset.'}};
        const upstream=new URL(mode==='customer'?'https://customer-geocoding-api.open-meteo.com/v1/search':'https://geocoding-api.open-meteo.com/v1/search');
        upstream.search=new URLSearchParams({name:parsed.data.q,count:'8',language:'en',format:'json'}).toString();
        if(mode==='customer'){
          if(!options.geocoding?.apiKey)throw new Error('Customer geocoding is not configured.');
          upstream.searchParams.set('apikey',options.geocoding.apiKey);
        }
        const data=upstreamSchema.parse(await boundedJsonFetch(upstream,{fetch:searchFetch,maxBytes:64*1024,timeoutMs:6000,cache:'no-store'}));
        const results:PlaceResult[]=(data.results??[]).slice(0,8).map(p=>({id:String(p.id),name:p.name,label:[p.name,p.admin1,p.country].filter(Boolean).join(', '),latitudeDeg:p.latitude,longitudeDeg:p.longitude,timezone:p.timezone??null}));
        body=placeResponseSchema.parse({results,provider:'Open-Meteo / GeoNames',attribution:'Place search: Open-Meteo; geographic names: GeoNames (CC BY 4.0). '+(mode==='free'?'Free endpoint is for noncommercial use.':'Customer endpoint configured by this host.')});
      }else{
        const zones=zoneFind(parsed.data.latitude,parsed.data.longitude);
        body=timezoneResponseSchema.parse({zones,dataset:'geo-tz/all@8.1.10',attribution:'Timezone boundaries © OpenStreetMap contributors, ODbL-1.0; timezone-boundary-builder comprehensive product via geo-tz.'});
      }
      cached.set(key,{expires:Date.now()+3600000,body});
      return {status:200,body};
    }catch{return {status:503,body:{error:'Location lookup is unavailable. Use manual coordinates and a zone or UTC offset.'}};}
  };
}
export function locationLookupPlugin():Plugin{
  const router=createLocationRouter();
  const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
    void router(new URL(req.url??'/','http://localhost'),req.method).then(reply=>{
      if(!reply){next();return;}
      res.statusCode=reply.status;res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      res.end(JSON.stringify(reply.body));
    }).catch(()=>{res.statusCode=500;res.end(JSON.stringify({error:'Location lookup failed.'}));});
  };
  return {name:'location-lookup',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
