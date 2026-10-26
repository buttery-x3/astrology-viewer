import data from './data/constellation-figures.json';
import manifest from './data/figure-manifest.json';
import {CATALOGUE_STARS,CONSTELLATIONS,catalogueStarDirection,type CatalogueStar} from './sky-data';
import {normalizeVector,type Vector3} from '../astronomy/coordinates';

export const FIGURE_SOURCE=Object.freeze(manifest);
const freezeStar=(star:CatalogueStar):CatalogueStar=>Object.freeze([...star]) as unknown as CatalogueStar;
export const FIGURE_SUPPORT_STARS:readonly CatalogueStar[]=Object.freeze(data.supportStars.map(star=>freezeStar(star as unknown as CatalogueStar)));
const stars=new Map([...CATALOGUE_STARS,...FIGURE_SUPPORT_STARS].map(star=>[star[0],star]));
export function figureStar(hygId:number):CatalogueStar|undefined{return stars.get(hygId);}
export const FIGURE_STARS:readonly CatalogueStar[]=Object.freeze(data.endpoints.map(endpoint=>{
  const star=stars.get(endpoint.hygId);if(!star)throw Error(`Missing figure endpoint HYG ${endpoint.hygId}.`);return star;
}));
export interface ConstellationFigure {readonly id:string;readonly constellationId:string;readonly abbreviation:string;readonly name:string;readonly paths:readonly(readonly number[])[]}
export const CONSTELLATION_FIGURES:readonly ConstellationFigure[]=Object.freeze(data.figures.map(figure=>{
  const constellation=CONSTELLATIONS.find(value=>value.id===figure.constellationId);
  if(!constellation)throw Error(`Unknown figure constellation ${figure.constellationId}.`);
  return Object.freeze({...figure,name:constellation.name,paths:Object.freeze(figure.paths.map(path=>Object.freeze([...path])))});
}));
const byId=new Map(CONSTELLATION_FIGURES.map(figure=>[figure.id,figure]));
/** Great-circle display interpolation; exact catalogue directions are retained at every named endpoint. */
export function interpolateFigureSegment(a:Vector3,b:Vector3,maxStepDeg=2):Vector3[]{
  if(!Number.isFinite(maxStepDeg)||maxStepDeg<=0||maxStepDeg>10)throw new RangeError('Figure arc steps must be greater than zero and at most 10°.');
  const dot=Math.max(-1,Math.min(1,a.x*b.x+a.y*b.y+a.z*b.z)),angle=Math.acos(dot);
  if(angle>Math.PI-1e-8)throw Error('Antipodal figure endpoints do not specify a unique short arc.');
  const steps=Math.max(1,Math.ceil(angle*180/Math.PI/maxStepDeg)),sin=Math.sin(angle);
  return Array.from({length:steps+1},(_,index)=>{
    if(index===0)return {...a};if(index===steps)return {...b};const t=index/steps;
    if(angle<1e-10)return normalizeVector({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
    const p=Math.sin((1-t)*angle)/sin,q=Math.sin(t*angle)/sin;return normalizeVector({x:a.x*p+b.x*q,y:a.y*p+b.y*q,z:a.z*p+b.z*q});
  });
}
export function buildFigurePaths(id:string,julianDateTt:number,maxStepDeg=2):Vector3[][]{
  const figure=byId.get(id);if(!figure)throw new RangeError(`Unknown figure ${id}.`);
  return figure.paths.map(path=>{
    const points:Vector3[]=[];
    for(let index=1;index<path.length;index++){
      const a=catalogueStarDirection(stars.get(path[index-1]!)!,julianDateTt),b=catalogueStarDirection(stars.get(path[index]!)!,julianDateTt);
      points.push(...interpolateFigureSegment(a,b,maxStepDeg).slice(index===1?0:1));
    }
    return points;
  });
}
