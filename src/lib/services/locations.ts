import {placeResponseSchema,timezoneResponseSchema,type PlaceResult} from './location-schema';
export type {PlaceResult} from './location-schema';
const lookupBase=import.meta.env.VITE_LOOKUP_BASE_URL??'';
async function read(url:string,signal?:AbortSignal):Promise<unknown>{
  const response=await fetch(url,{signal});
  if(!response.ok)throw new Error(response.status===429?'Location lookup is busy. Try again shortly or enter coordinates and a zone.':'Location lookup is unavailable. Enter coordinates and a time zone manually.');
  return response.json();
}
export async function searchPlaces(query:string,signal?:AbortSignal):Promise<PlaceResult[]>{
  const value=query.trim();
  if(value.length<2||value.length>100)throw new Error('Enter a place name between2 and100 characters.');
  return placeResponseSchema.parse(await read(`${lookupBase}/api/places?q=${encodeURIComponent(value)}`,signal)).results;
}
export async function lookupTimezones(latitude:number,longitude:number,signal?:AbortSignal):Promise<string[]>{
  return timezoneResponseSchema.parse(await read(`${lookupBase}/api/timezone?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`,signal)).zones;
}
