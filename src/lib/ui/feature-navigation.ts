import {BODY_IDS,HOUSE_SYSTEMS} from '../astronomy/ephemeris';
import type {HoverCardContext} from '../domain/hover-card';
import type {FeatureHit} from '../domain/scene-hit';
import {housePartition} from '../domain/chart';
import {TRAIL_VERSION_KEY} from '../domain/trails';
import {CATALOGUE_STARS} from '../scene/sky-data';
import {CONSTELLATION_FIGURES,FIGURE_SUPPORT_STARS} from '../scene/constellation-figures';

export interface NavigationItem {hit:FeatureHit;detail:string}
export interface NavigationGroup {id:string;title:string;items:readonly NavigationItem[];reason?:string}
export const FEATURE_PAGE_SIZE=12;
const title=(id:string)=>id.charAt(0).toUpperCase()+id.slice(1);
const systemName=(id:string)=>HOUSE_SYSTEMS.find(system=>system.id===id)?.name??id;
export const sampleTime=(instantMs:number)=>new Date(instantMs).toISOString().replace('T',' ').replace('Z',' UTC');
const stars=new Map([...CATALOGUE_STARS,...FIGURE_SUPPORT_STARS].map(star=>[star[0],star]));
const starItems:readonly NavigationItem[]=Object.freeze([...stars.values()].sort((a,b)=>a[1].localeCompare(b[1],'en')||a[0]-b[0]).map(star=>({hit:{id:`star:hyg:${star[0]}`,entityId:`star:hyg:${star[0]}`,kind:'star' as const,name:`${star[1]} · HYG ${star[0]}`,representation:'sky' as const,role:'catalogue-star'},detail:`Catalogue star · magnitude ${star[2].toFixed(2)}`})));
const figureItems:readonly NavigationItem[]=Object.freeze([...CONSTELLATION_FIGURES].sort((a,b)=>a.name.localeCompare(b.name,'en')).map(figure=>({hit:{id:figure.id,entityId:figure.id,kind:'asterism' as const,name:`${figure.name} · constellation figure`,representation:'sky' as const,role:'figure'},detail:`Modern Western figure · ${figure.abbreviation}`})));

/** Lists expose semantic targets; enabling their hidden presentation is the caller's selection command. */
export function navigationGroups(context:HoverCardContext,stage=2):NavigationGroup[]{
  const sky=context.snapshot,astro:NavigationItem[]=[],earth:NavigationItem[]=[],comparison:NavigationItem[]=[],construction:NavigationItem[]=[];
  const groups:NavigationGroup[]=[{id:'stars',title:'Catalogue stars',items:sky?starItems:[],...(!sky?{reason:'Calculate a moment before inspecting catalogue positions.'}:{})},{id:'figures',title:'Constellation figures',items:sky?figureItems:[],...(!sky?{reason:'Calculate a moment before inspecting sky figures.'}:{})}];
  let astroReason=sky?undefined:'A calculated snapshot is needed.',earthReason=astroReason,comparisonReason='No comparison system is calculated.',constructionReason='Enable a construction guide to browse its elements.';
  if(sky){
    for(const id of BODY_IDS){const body=sky.bodies.find(body=>body.id===id);if(!body||!Number.isFinite(body.equatorial.rightAscensionDeg)||!Number.isFinite(body.equatorial.declinationDeg)||Math.abs(body.equatorial.declinationDeg)>90||Math.abs(Math.cos(body.equatorial.declinationDeg*Math.PI/180))<1e-12)continue;
      for(const angle of ['ac','dc','mc','ic']){const entityId=`astro:${id}:${angle}`;astro.push({hit:{id:entityId,entityId,name:`${title(id)} ${angle.toUpperCase()} · geographic line`,kind:'astro-line',representation:'earth',role:'line'},detail:`Astrocartography · ${angle==='ac'?'rising':angle==='dc'?'setting':angle==='mc'?'upper meridian transit':'lower meridian transit'}`});}
    }
    if(!astro.length)astroReason='No body has a defined angular line at this input.';
    const primary=sky.houses[0],partition=primary?housePartition(primary):null;
    if(primary&&partition?.status==='valid')for(let house=1;house<=12;house++)for(const role of ['house','boundary']){const id=`earth:${role}:primary:${house}`;earth.push({hit:{id,entityId:id,name:`Projected ${role==='house'?'house':'cusp'} ${house} · ${systemName(primary.system)}`,kind:'earth-house',representation:'earth',system:primary.system,role:role==='house'?'section':'boundary'},detail:role==='house'?'Projected chart house':'Projected indexed boundary'});}
    else earthReason=partition?.status==='undefined'?partition.reason:'No primary house calculation is available.';
    const secondary=sky.houses[1],secondaryPartition=secondary?housePartition(secondary):null;
    if(secondary&&secondaryPartition?.status==='valid')for(let house=1;house<=12;house++)comparison.push({hit:{id:`boundary:comparison:${house}`,entityId:`boundary:${house}`,name:`Comparison cusp ${house} · ${systemName(secondary.system)}`,kind:'boundary',representation:'comparison',system:secondary.system,role:'comparison-boundary'},detail:`Comparison boundary · ${systemName(secondary.system)}`});
    else if(secondaryPartition?.status==='undefined')comparisonReason=secondaryPartition.reason;
    const guide=context.construction;
    if(guide?.status==='valid'){
      const maximumStage=Math.min(2,Math.max(0,Number.isFinite(stage)?Math.trunc(stage):2)),seen=new Set<string>();
      for(const element of [...guide.lines,...guide.markers]){if(element.stage>maximumStage||seen.has(element.id))continue;seen.add(element.id);construction.push({hit:{id:element.id,entityId:`boundary:${guide.house}`,kind:'construction',name:`${element.label??element.kind} · C${guide.house} · ${systemName(guide.system)}`,representation:'guide',system:guide.system,constructionId:element.id,role:element.kind},detail:`Stage ${element.stage+1} · ${element.kind}`});}
      if(!construction.length)constructionReason='No construction element is visible at this stage.';
    }else if(guide)constructionReason=guide.notes[0]??`Construction is ${guide.status}; no substitute geometry is listed.`;
  }
  groups.push({id:'astro',title:'Astrocartography lines',items:astro,reason:astroReason},{id:'earth',title:'Projected houses and cusps',items:earth,reason:earthReason},{id:'comparison',title:'Comparison cusps',items:comparison,reason:comparisonReason},{id:'construction',title:'Construction elements',items:construction,reason:constructionReason});return groups;
}

const searchable=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('en');
export function featurePage(items:readonly NavigationItem[],query:string,page:number,pageSize=FEATURE_PAGE_SIZE){
  const words=searchable(query).trim().split(/\s+/).filter(Boolean),filtered=words.length?items.filter(item=>words.every(word=>searchable(`${item.hit.name} ${item.hit.id} ${item.detail}`).includes(word))):items;
  const size=Number.isFinite(pageSize)?Math.min(50,Math.max(1,Math.trunc(pageSize))):FEATURE_PAGE_SIZE,pages=Math.max(1,Math.ceil(filtered.length/size)),index=Math.max(0,Math.min(pages-1,Number.isFinite(page)?Math.trunc(page):0));
  return {items:filtered.slice(index*size,(index+1)*size),count:filtered.length,page:index,pages,start:filtered.length?index*size+1:0,end:Math.min(filtered.length,(index+1)*size)};
}
const sameObserver=(a:{latitudeDeg:number;longitudeDeg:number},b:{latitudeDeg:number;longitudeDeg:number})=>a.latitudeDeg===b.latitudeDeg&&a.longitudeDeg===b.longitudeDeg;
export function trailNavigation(context:HoverCardContext):{items:NavigationItem[];reason?:string}{
  const sky=context.snapshot,result=context.trail;
  if(!sky||!result)return {items:[],reason:'Select a body and calculate its trail to browse sampled times.'};
  if(result.versionKey!==TRAIL_VERSION_KEY||!sameObserver(result.observer,sky.observer)||!sky.bodies.some(body=>body.id===result.bodyId))return {items:[],reason:'The trail does not match the displayed observer or calculation version.'};
  const times=new Set(result.samples.map(sample=>sample.instantMs));
  // Mirror projectTrail's exact-current insertion, without recalculating 2,000 vectors for a list of times.
  if(sky.instantMs>=result.requestedStartMs&&sky.instantMs<=result.requestedEndMs)times.add(sky.instantMs);
  const samples=[...times].sort((a,b)=>a-b);
  return {items:samples.map(instantMs=>({hit:{id:`trail:${result.bodyId}:sample:${instantMs}`,entityId:`body:${result.bodyId}`,name:`${title(result.bodyId)} trail sample · ${sampleTime(instantMs)}`,kind:'trail',representation:'history',role:'sample',frame:result.frame,sampleInstantMs:instantMs},detail:`${instantMs===sky.instantMs?'Exact current point':instantMs<sky.instantMs?'Past sample':'Future sample'} · ${result.frame==='stars'?'relative to stars':'relative to local horizon'}`})),...(!samples.length?{reason:'No valid trail sample is available yet.'}:{})};
}
export function historyNavigation(context:HoverCardContext):{items:NavigationItem[];omitted:string[];reason?:string}{
  const sky=context.snapshot,result=context.history;
  if(!sky||!result)return {items:[],omitted:[],reason:'Select a boundary and calculate its history to browse discrete samples.'};
  if(result.versionKey!==TRAIL_VERSION_KEY||!sameObserver(result.observer,sky.observer)||result.system!==sky.houses[0]?.system)return {items:[],omitted:[],reason:'The history does not match the displayed observer, primary system or calculation version.'};
  return {items:result.samples.filter(sample=>sample.status!=='undefined').slice(0,7).map(sample=>({hit:{id:`history:${result.system.toLowerCase()}:${result.house}:${sample.instantMs}`,entityId:`boundary:${result.house}`,name:`Cusp ${result.house} history · ${sampleTime(sample.instantMs)}${sample.status==='jump'?' · discrete change':''}`,kind:'history',representation:'history',role:sample.status,frame:'stars',system:result.system,sampleInstantMs:sample.instantMs},detail:sample.status==='jump'?'Discrete change · not a continuous connection':'Discrete boundary sample'})),omitted:result.samples.filter(sample=>sample.status==='undefined').map(sample=>`${sampleTime(sample.instantMs)}: ${sample.reason}`)};
}
