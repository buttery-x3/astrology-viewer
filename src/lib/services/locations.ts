import {placeResponseSchema,timezoneResponseSchema,placeQuerySchema,coordinateLookupSchema,type PlaceResult} from './location-schema';
import { boundedJsonFetch,BoundedFetchError } from '../net/bounded-fetch';
export type {PlaceResult} from './location-schema';
export interface LocationClientOptions{baseUrl?:string;fetch?:typeof fetch;timeoutMs?:number}
const unavailable='Location lookup is unavailable. Enter coordinates and a time zone manually.';
export function createLocationClient(options:LocationClientOptions={}){
  const base=(options.baseUrl??'').replace(/\/$/,'');
  const configured=new URL(base||'/','https://lookup.invalid');
  if(configured.search||configured.hash||configured.username||configured.password||!['http:','https:'].includes(configured.protocol))throw new RangeError('Lookup base must be an HTTP(S) path or origin without credentials, query or fragment.');
  async function read(path:string,query:URLSearchParams,signal?:AbortSignal):Promise<unknown>{
    try{return await boundedJsonFetch(`${base}${path}?${query}`,{maxBytes:64*1024,timeoutMs:options.timeoutMs??8000,signal,fetch:options.fetch,cache:'no-store'});}
    catch(error){
      if(error instanceof DOMException&&error.name==='AbortError')throw error;
      if(error instanceof BoundedFetchError&&error.status===429)throw new Error('Location lookup is busy. Try again shortly or enter coordinates and a zone.',{cause:error});
      if(error instanceof BoundedFetchError&&error.code==='timeout')throw new Error('Location lookup timed out. Retry or enter coordinates and a time zone manually.',{cause:error});
      throw new Error(unavailable,{cause:error});
    }
  }
  return{
    async searchPlaces(query:string,signal?:AbortSignal):Promise<PlaceResult[]>{
      const parsed=placeQuerySchema.safeParse({q:query});if(!parsed.success)throw new Error('Enter a place name between 2 and 100 visible characters.');
      const data=await read('/api/places',new URLSearchParams({q:parsed.data.q}),signal);
      const response=placeResponseSchema.safeParse(data);if(!response.success)throw new Error(unavailable);return response.data.results;
    },
    async lookupTimezones(latitude:number,longitude:number,signal?:AbortSignal):Promise<string[]>{
      const parsed=coordinateLookupSchema.safeParse({latitude,longitude});if(!parsed.success)throw new Error('Enter valid latitude and longitude coordinates.');
      const data=await read('/api/timezone',new URLSearchParams({latitude:String(parsed.data.latitude),longitude:String(parsed.data.longitude)}),signal);
      const response=timezoneResponseSchema.safeParse(data);if(!response.success)throw new Error(unavailable);return response.data.zones;
    },
  };
}
const client=createLocationClient({baseUrl:import.meta.env.VITE_LOOKUP_BASE_URL??''});
export const searchPlaces=client.searchPlaces;
export const lookupTimezones=client.lookupTimezones;
