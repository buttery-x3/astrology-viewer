import { z } from 'zod';

export const CONTENT_ROLES = ['astronomy','tradition','method','evidence','time-data','project-convention'] as const;
const roleSchema=z.enum(CONTENT_ROLES);
const nonempty=z.string().trim().min(1);
const reviewed=z.literal('reviewed');
const reviewedAt=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const url=z.string().url().refine((value)=>value.startsWith('https://'),'Source links must use HTTPS.');
export const claimSchema=z.object({text:nonempty,sourceIds:z.array(nonempty).min(1),section:nonempty,role:roleSchema}).strict();
export const entrySchema=z.object({
  id:nonempty,kind:z.enum(['body','sign','house','aspect','house-system','reference','angle','evidence','time','trail','body-in-sign','body-in-house']),
  title:nonempty,summary:nonempty,claims:z.array(claimSchema).min(1),reviewStatus:reviewed,reviewedAt,
  bodyId:nonempty.optional(),signId:nonempty.optional(),house:z.number().int().min(1).max(12).optional(),aspectType:nonempty.optional(),systemId:nonempty.optional(),
  existingClaimId:nonempty.optional(),reusedFrom:nonempty.optional(),startLongitudeDeg:z.number().optional(),endLongitudeDeg:z.number().optional(),exactAngleDeg:z.number().optional(),
}).strict();
export const sourceSchema=z.object({
  id:nonempty,url,title:nonempty,author:nonempty,publisher:nonempty,role:roleSchema,tradition:nonempty,reuse:nonempty,
  sourceWordLimit:z.literal(200),editorialBudget:z.number().int().positive().max(200),reviewedAt,reviewStatus:reviewed,
  authorBasis:nonempty.optional(),reviewMethod:nonempty.optional(),
}).strict();
export const supplementalClaimSchema=z.object({id:nonempty,text:nonempty,role:roleSchema,sourceUrls:z.array(url).min(1),section:nonempty,sourceCode:nonempty}).strict();
export type ContentRole=z.infer<typeof roleSchema>;
export type ContentClaim=z.infer<typeof claimSchema>;
export type ContentEntry=z.infer<typeof entrySchema>;
export type ContentSource=z.infer<typeof sourceSchema>;
export type SupplementalClaim=z.infer<typeof supplementalClaimSchema>;
export interface PageWordBudget {canonicalUrl:string;derivedWords:number;sourceWordLimit:number;editorialBudget:number;claimIds:string[]}
export interface ContentValidation {valid:boolean;issues:string[];budgets:PageWordBudget[];entries:number;sources:number}
export function canonicalSourceUrl(input:string):string{
  const value=new URL(input);value.hash='';
  if(value.hostname==='direct.skyscript.co.uk'||value.hostname==='skyscript.co.uk')value.hostname='www.skyscript.co.uk';
  if(value.hostname==='www.skyscript.co.uk')value.pathname=value.pathname.replace(/^\/temples\/h(\d+)\.html$/,'/$1.html');
  if(value.hostname!=='msi.nga.mil')value.search='';
  return value.href;
}
const BODY_IDS=['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
const SIGN_IDS=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
export const REQUIRED_CONTENT_IDS:readonly string[]=Object.freeze([
  ...BODY_IDS.map((id)=>`body:${id}`),...SIGN_IDS.map((id)=>`sign:${id}`),...Array.from({length:12},(_,index)=>`house:${index+1}`),
  ...['conjunction','sextile','square','trine','opposition'].map((id)=>`aspect-type:${id}`),...['W','E','O','R','C','P','K'].map((id)=>`system:${id}`),
  ...['horizon','ecliptic','equator','meridian','prime-vertical','zenith','nadir','north-pole','south-pole'].map((id)=>`reference:${id}`),
  ...['asc','dsc','mc','ic'].map((id)=>`angle:${id}`),...['evidence','civil-time','trails','frames','retrograde','conventions'].map((id)=>`concept:${id}`),
  ...BODY_IDS.flatMap((body)=>SIGN_IDS.map((sign)=>`body-in-sign:${body}:${sign}`)),
  ...BODY_IDS.flatMap((body)=>Array.from({length:12},(_,index)=>`body-in-house:${body}:${index+1}`)),
]);

/** Local validation checks editorial completeness; HTTP success cannot establish claim support. */
export function validateContentCatalogue(rawEntries:unknown,rawSources:unknown,rawSupplemental:unknown=[]):ContentValidation{
  const parsedEntries=z.array(entrySchema).safeParse(rawEntries),parsedSources=z.array(sourceSchema).safeParse(rawSources),parsedSupplemental=z.array(supplementalClaimSchema).safeParse(rawSupplemental);
  const issues:string[]=[];
  for(const [name,result]of [['entries',parsedEntries],['sources',parsedSources],['supplemental',parsedSupplemental]]as const)if(!result.success)for(const issue of result.error.issues)issues.push(`${name}.${issue.path.join('.')}: ${issue.message}`);
  if(!parsedEntries.success||!parsedSources.success||!parsedSupplemental.success)return {valid:false,issues,budgets:[],entries:0,sources:0};
  const entries=parsedEntries.data,sources=parsedSources.data,supplemental=parsedSupplemental.data;
  const ids=entries.map((item)=>item.id),sourceIds=sources.map((item)=>item.id);
  if(new Set(ids).size!==ids.length)issues.push('Content IDs must be unique.');
  if(new Set(sourceIds).size!==sourceIds.length)issues.push('Source IDs must be unique.');
  if(new Set(supplemental.map((item)=>item.id)).size!==supplemental.length)issues.push('Supplemental logical claim IDs must be unique.');
  if(entries.length!==305)issues.push(`Expected exactly305 entries; found${entries.length}.`);
  if(sources.length!==89)issues.push(`Expected exactly89 reviewed sources; found${sources.length}.`);
  for(const id of REQUIRED_CONTENT_IDS)if(!ids.includes(id))issues.push(`Missing required content ${id}.`);
  for(const id of ids)if(!REQUIRED_CONTENT_IDS.includes(id))issues.push(`Unexpected content ${id}.`);
  const sourceMap=new Map(sources.map((item)=>[item.id,item]));
  const pages=new Map<string,{limit:number;editorial:number;claims:Map<string,{text:string;words:number}>}>();
  const count=(claimId:string,text:string,sourceUrl:string,editorial=180,limit=200)=>{
    const key=canonicalSourceUrl(sourceUrl),page=pages.get(key)??{limit,editorial,claims:new Map()};
    page.limit=Math.min(page.limit,limit);page.editorial=Math.min(page.editorial,editorial);
    const old=page.claims.get(claimId);
    if(old&&old.text!==text)issues.push(`Conflicting logical claim ${claimId}.`);
    page.claims.set(claimId,{text,words:text.trim().split(/\s+/).length});pages.set(key,page);
  };
  for(const entry of entries){
    const prefix=entry.id.split(':')[0];
    const expectedKind=prefix==='aspect-type'?'aspect':prefix==='system'?'house-system':prefix==='concept'?({evidence:'evidence','civil-time':'time',trails:'trail'}[entry.id.slice(8)]??'reference'):prefix;
    if(entry.kind!==expectedKind)issues.push(`Content kind disagrees with ${entry.id}.`);
    if(entry.kind==='body'&&entry.id!==`body:${entry.bodyId}`)issues.push(`Body metadata disagrees with ${entry.id}.`);
    if(entry.kind==='sign'&&entry.id!==`sign:${entry.signId}`)issues.push(`Sign metadata disagrees with ${entry.id}.`);
    if(entry.kind==='house'&&entry.id!==`house:${entry.house}`)issues.push(`House metadata disagrees with ${entry.id}.`);
    if(entry.kind==='aspect'&&entry.id!==`aspect-type:${entry.aspectType}`)issues.push(`Aspect metadata disagrees with ${entry.id}.`);
    if(entry.kind==='house-system'&&entry.id!==`system:${entry.systemId}`)issues.push(`System metadata disagrees with ${entry.id}.`);
    if(entry.summary!==entry.claims.map((claim)=>claim.text).join(' '))issues.push(`Summary has unsupported or duplicate prose: ${entry.id}.`);
    if(entry.id.startsWith('body-in-sign:')&&(!entry.bodyId||!entry.signId||entry.id!==`body-in-sign:${entry.bodyId}:${entry.signId}`))issues.push(`Placement metadata disagrees with ${entry.id}.`);
    if(entry.id.startsWith('body-in-house:')&&(!entry.bodyId||!entry.house||entry.id!==`body-in-house:${entry.bodyId}:${entry.house}`))issues.push(`Placement metadata disagrees with ${entry.id}.`);
    for(const [index,claim]of entry.claims.entries())for(const id of claim.sourceIds){
      const source=sourceMap.get(id);
      if(!source){issues.push(`Unresolved source ${id} in ${entry.id}.`);continue;}
      if(claim.role!==source.role)issues.push(`Claim/source role mismatch in ${entry.id}: ${claim.role}/${source.role}.`);
      count(entry.existingClaimId??`${entry.id}:${index}`,claim.text,source.url,source.editorialBudget,source.sourceWordLimit);
    }
  }
  for(const claim of supplemental)for(const sourceUrl of claim.sourceUrls)count(claim.id,claim.text,sourceUrl);
  const budgets=[...pages].map(([canonicalUrl,page]):PageWordBudget=>{
    const derivedWords=[...page.claims.values()].reduce((total,claim)=>total+claim.words,0);
    if(derivedWords>page.limit)issues.push(`Canonical source exceeds${page.limit} words: ${canonicalUrl} (${derivedWords}).`);
    if(derivedWords>page.editorial)issues.push(`Canonical source exceeds${page.editorial}-word editorial budget: ${canonicalUrl} (${derivedWords}).`);
    return {canonicalUrl,derivedWords,sourceWordLimit:page.limit,editorialBudget:page.editorial,claimIds:[...page.claims.keys()]};
  });
  return {valid:issues.length===0,issues,budgets,entries:entries.length,sources:sources.length};
}
