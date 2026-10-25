import rawCatalogue from './data/catalogue.json';
import rawSources from './data/sources.json';
import rawSupplemental from './data/supplemental-claims.json';
import manifest from './data/manifest.json';
import { entrySchema, sourceSchema, validateContentCatalogue, type ContentClaim, type ContentEntry, type ContentSource } from './validation';
import { classifyLongitude, zodiacSign } from '../domain/chart';
import type { BodyPosition, HouseResult } from '../astronomy/ephemeris';

export type { ContentRole, ContentClaim, ContentEntry, ContentSource, PageWordBudget, ContentValidation } from './validation';
export { validateContentCatalogue, canonicalSourceUrl, REQUIRED_CONTENT_IDS } from './validation';
export const CONTENT_VERSION='1.0.0';
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const nested of Object.values(value))freeze(nested);Object.freeze(value);}return value;}
const validation=validateContentCatalogue(rawCatalogue,rawSources,rawSupplemental);
if(!validation.valid)throw new Error(`Static content catalogue failed validation: ${validation.issues.join(' ')}`);
export const CONTENT_CATALOGUE:readonly ContentEntry[]=freeze(rawCatalogue.map((entry)=>entrySchema.parse(entry)));
export const CONTENT_SOURCES:readonly ContentSource[]=freeze(rawSources.map((source)=>sourceSchema.parse(source)));
export const CONTENT_VALIDATION=freeze(validation);
export const CONTENT_MANIFEST=freeze(manifest);
const entries=new Map(CONTENT_CATALOGUE.map((entry)=>[entry.id,entry]));
const sources=new Map(CONTENT_SOURCES.map((source)=>[source.id,source]));
export function getContent(id:string):ContentEntry|undefined{return entries.get(id);}
export function getSource(id:string):ContentSource|undefined{return sources.get(id);}
export function getClaimSources(claim:ContentClaim):readonly ContentSource[]{return claim.sourceIds.flatMap((id)=>{const source=sources.get(id);return source?[source]:[];});}
function required(id:string):ContentEntry{const entry=getContent(id);if(!entry)throw new Error(`Missing validated content ${id}`);return entry;}
export interface ResolvedBodyContent{
  body:ContentEntry;sign:ContentEntry;bodyInSign:ContentEntry;house:ContentEntry|null;bodyInHouse:ContentEntry|null;
  houseStatus:'valid'|'undefined';houseNumber:number|null;houseReason:string|null;provisional:boolean;qualification:string|null;
}
/** Read calculated placements; no interpretation is invented when a house is undefined. */
export function resolveBodyContent(body:Pick<BodyPosition,'id'|'longitudeDeg'>,houseResult:HouseResult|undefined,provisional=false):ResolvedBodyContent{
  const sign=zodiacSign(body.longitudeDeg),house=houseResult?classifyLongitude(houseResult,body.longitudeDeg):{status:'undefined' as const,reason:'No house calculation is available for this snapshot.'};
  return {
    body:required(`body:${body.id}`),sign:required(`sign:${sign.id}`),bodyInSign:required(`body-in-sign:${body.id}:${sign.id}`),
    house:house.status==='valid'?required(`house:${house.house}`):null,bodyInHouse:house.status==='valid'?required(`body-in-house:${body.id}:${house.house}`):null,
    houseStatus:house.status,houseNumber:house.status==='valid'?house.house:null,houseReason:house.status==='undefined'?house.reason:null,
    provisional,qualification:provisional?'The time is provisional; signs and time-sensitive house placements may change with the actual birth time.':null,
  };
}
