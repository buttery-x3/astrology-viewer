import { normalizeDegrees } from '../astronomy/coordinates';
import { BODY_IDS, type BodyPosition, type HouseResult } from '../astronomy/ephemeris';

export const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'] as const;
export function zodiacSign(longitudeDeg:number){
  const longitude=normalizeDegrees(longitudeDeg),index=Math.floor(longitude/30);
  const name=SIGNS[index]!;
  return {index,id:name.toLowerCase(),name,degree:longitude-index*30};
}
export interface HouseInterval {house:number;startDeg:number;endDeg:number;widthDeg:number;direction:1|-1}
export type HousePartition={status:'valid';intervals:HouseInterval[]}|{status:'undefined';reason:string};

/** Preserve indexed cusp identities, including documented clockwise polar systems. */
export function housePartition(result:HouseResult):HousePartition{
  if(result.status==='undefined')return {status:'undefined',reason:result.reason};
  if(result.cusps.length!==12||result.cusps.some(c=>!Number.isFinite(c)))return {status:'undefined',reason:'The house boundaries are incomplete.'};
  const widths=(direction:1|-1)=>result.cusps.map((c,i)=>normalizeDegrees(direction*(result.cusps[(i+1)%12]!-c)));
  const forward=widths(1),reverse=widths(-1);
  const valid=(values:number[])=>values.every(v=>v>1e-10)&&Math.abs(values.reduce((a,b)=>a+b,0)-360)<1e-7;
  const direction:1|-1=valid(forward)?1:-1;
  const selected=direction===1?forward:reverse;
  if(!valid(selected))return {status:'undefined',reason:'These indexed cusps do not define an unambiguous longitude partition at this location.'};
  return {status:'valid',intervals:result.cusps.map((c,i)=>({house:i+1,startDeg:normalizeDegrees(c),endDeg:normalizeDegrees(result.cusps[(i+1)%12]!),widthDeg:selected[i]!,direction}))};
}
export function classifyLongitude(result:HouseResult,longitudeDeg:number):{status:'valid';house:number}|{status:'undefined';reason:string}{
  const longitude=normalizeDegrees(longitudeDeg),partition=housePartition(result);
  if(partition.status==='undefined')return partition;
  for(const interval of partition.intervals){
    const distance=normalizeDegrees(interval.direction*(longitude-interval.startDeg));
    if(distance<interval.widthDeg)return {status:'valid',house:interval.house};
  }
  return {status:'undefined',reason:'Longitude membership could not be resolved.'};
}

export const ASPECT_TYPES=[
  {id:'conjunction',name:'Conjunction',angleDeg:0,glyph:'☌'},
  {id:'sextile',name:'Sextile',angleDeg:60,glyph:'⚹'},
  {id:'square',name:'Square',angleDeg:90,glyph:'□'},
  {id:'trine',name:'Trine',angleDeg:120,glyph:'△'},
  {id:'opposition',name:'Opposition',angleDeg:180,glyph:'☍'},
] as const;
export type AspectTypeId=typeof ASPECT_TYPES[number]['id'];
export type OrbSettings=Record<AspectTypeId,number>;
export const DEFAULT_ORBS:Readonly<OrbSettings>=Object.freeze({conjunction:6,sextile:6,square:6,trine:6,opposition:6});
export interface AspectResult {
  id:string;bodyA:BodyPosition['id'];bodyB:BodyPosition['id'];type:AspectTypeId;
  separationDeg:number;targetDeg:number;departureDeg:number;orbDeg:number;closeness:number;
}
export function longitudeSeparation(a:number,b:number):number{
  const raw=Math.abs(normalizeDegrees(a)-normalizeDegrees(b));return Math.min(raw,360-raw);
}
export function calculateAspects(bodies:readonly Pick<BodyPosition,'id'|'longitudeDeg'>[],orbs:OrbSettings=DEFAULT_ORBS):AspectResult[]{
  for(const type of ASPECT_TYPES)if(!Number.isFinite(orbs[type.id])||orbs[type.id]<0||orbs[type.id]>14.999)
    throw new RangeError('Aspect orbs must be from 0° to less than15°, preventing overlap.');
  if(new Set(bodies.map(b=>b.id)).size!==bodies.length)throw new Error('Aspect bodies must be unique.');
  const sorted=[...bodies].sort((a,b)=>BODY_IDS.indexOf(a.id)-BODY_IDS.indexOf(b.id));
  const results:AspectResult[]=[];
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
    const a=sorted[i]!,b=sorted[j]!,separationDeg=longitudeSeparation(a.longitudeDeg,b.longitudeDeg);
    for(const type of ASPECT_TYPES){
      const departureDeg=Math.abs(separationDeg-type.angleDeg),orbDeg=orbs[type.id];
      if(departureDeg<=orbDeg)results.push({id:`aspect:${a.id}-${b.id}:${type.id}`,bodyA:a.id,bodyB:b.id,type:type.id,separationDeg,targetDeg:type.angleDeg,departureDeg,orbDeg,closeness:orbDeg===0?1:1-departureDeg/orbDeg});
    }
  }
  return results;
}
