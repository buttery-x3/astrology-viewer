import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {EphemerisEngine,EPHEMERIS_FILES,type EphemerisSnapshot} from '../../src/lib/astronomy/ephemeris';
import {buildHouseConstruction,DEFAULT_CONSTRUCTION} from '../../src/lib/domain/house-construction';
import {resolveHoverCard,type HoverCardContext} from '../../src/lib/domain/hover-card';
import {makeTrailSample,TRAIL_VERSION_KEY,type TrailResult,type BoundaryHistoryResult} from '../../src/lib/domain/trails';
import {CATALOGUE_STARS} from '../../src/lib/scene/sky-data';
import {FIGURE_SUPPORT_STARS} from '../../src/lib/scene/constellation-figures';
import {navigationGroups,featurePage,trailNavigation,historyNavigation,FEATURE_PAGE_SIZE} from '../../src/lib/ui/feature-navigation';
let engine:EphemerisEngine,sky:EphemerisSnapshot;
beforeAll(async()=>{
  engine=await EphemerisEngine.create({wasmBinary:new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),files:new Map(await Promise.all(EPHEMERIS_FILES.map(async file=>[file.name,new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))]as const)))});
  sky=engine.calculate(Date.UTC(2000,0,1,12),{latitudeDeg:51.5,longitudeDeg:0},['W','E']);
});
afterAll(()=>engine?.close());
const context=():HoverCardContext=>({snapshot:sky,stars:new Map([...CATALOGUE_STARS,...FIGURE_SUPPORT_STARS].map(star=>[star[0],star]))});

describe('bounded semantic keyboard routes to additional scene features',()=>{
  it('covers every catalogue/support star, figure, angular line, surface house/cusp and comparison cusp',()=>{
    const groups=navigationGroups(context()),counts=Object.fromEntries(groups.map(group=>[group.id,group.items.length]));
    expect(counts).toEqual({stars:2874,figures:88,astro:40,earth:24,comparison:12,construction:0});
    const ids=groups.flatMap(group=>group.items.map(item=>item.hit.id));expect(new Set(ids).size).toBe(ids.length);expect(ids.every(id=>/^[a-z][a-z0-9]*(?::[a-z0-9_-]+)+$/.test(id))).toBe(true);
    for(const group of groups)for(const item of group.items){expect(resolveHoverCard(item.hit,context()),item.hit.id).not.toBeNull();expect(item.hit.name).toBeTruthy();}
    const comparison=groups.find(group=>group.id==='comparison')!.items;expect(comparison.every(item=>item.hit.representation==='comparison'&&item.hit.system==='E'&&item.hit.entityId===item.hit.id&&item.hit.entityId.startsWith('boundary:comparison:'))).toBe(true);
  });
  it('paginates the complete catalogue without creating thousands of target rows or losing identities',()=>{
    const stars=navigationGroups(context())[0]!.items,ids:string[]=[];
    for(let page=0;page<Math.ceil(stars.length/FEATURE_PAGE_SIZE);page++){const result=featurePage(stars,'',page);expect(result.items.length).toBeLessThanOrEqual(12);ids.push(...result.items.map(item=>item.hit.id));}
    expect(ids).toHaveLength(2874);expect(new Set(ids).size).toBe(2874);
    expect(featurePage(stars,'',99999).page).toBe(Math.ceil(stars.length/12)-1);expect(featurePage(stars,'',NaN).page).toBe(0);
    expect(featurePage(stars,'',0,Infinity).items).toHaveLength(12);
  });
  it('searches names, catalogue identities and accented figure names with truthful zero results',()=>{
    const groups=navigationGroups(context()),stars=groups[0]!.items,sirius=stars.find(item=>item.hit.name.startsWith('Sirius ·'))!;
    expect(featurePage(stars,'sIrIuS HYG',0).items.map(item=>item.hit.id)).toEqual([sirius.hit.id]);expect(featurePage(stars,sirius.hit.id,0).items[0]!.hit.id).toBe(sirius.hit.id);
    expect(featurePage(groups[1]!.items,'Bootes',0).items[0]!.hit.id).toBe('asterism:boo');
    expect(featurePage(stars,'unmatched search content',0)).toMatchObject({items:[],count:0,start:0,end:0,pages:1,page:0});
  });
  it('omits undefined/absent geometry while retaining precise reasons and independent groups',()=>{
    expect(navigationGroups({snapshot:null}).every(group=>group.items.length===0&&group.reason)).toBe(true);
    const polar={...sky,houses:[{system:'P' as const,status:'undefined' as const,reason:'Native polar failure'},sky.houses[1]!]};
    const groups=navigationGroups({...context(),snapshot:polar});expect(groups.find(group=>group.id==='earth')).toMatchObject({items:[],reason:'Native polar failure'});expect(groups.find(group=>group.id==='comparison')!.items).toHaveLength(12);
    const poleBody={...sky,bodies:sky.bodies.map(body=>body.id==='sun'?{...body,equatorial:{...body.equatorial,declinationDeg:90}}:body)};expect(navigationGroups({...context(),snapshot:poleBody}).find(group=>group.id==='astro')!.items).toHaveLength(36);
  });
  it('lists only actual construction lines/markers visible through the selected stage',()=>{
    const construction=buildHouseConstruction(sky,sky.houses[0]!,{...DEFAULT_CONSTRUCTION,boundaryHouse:11});expect(construction.status).toBe('valid');
    for(const stage of [0,1,2]){const ctx={...context(),construction},items=navigationGroups(ctx,stage).find(group=>group.id==='construction')!.items,expected=[...construction.lines,...construction.markers].filter(element=>element.stage<=stage);
      expect(new Set(items.map(item=>item.hit.constructionId))).toEqual(new Set(expected.map(element=>element.id)));
      for(const item of items){expect(item.hit).toMatchObject({kind:'construction',entityId:'boundary:11',system:'W',representation:'guide'});expect(resolveHoverCard(item.hit,ctx)).not.toBeNull();}
    }
    expect(navigationGroups({...context(),construction:{...construction,status:'incomplete',notes:['Residual mismatch']}}).find(group=>group.id==='construction')).toMatchObject({items:[],reason:'Residual mismatch'});
  });
});

describe('sample navigation preserves sampled context rather than substituting current placements',()=>{
  function trail(frame:'stars'|'horizon'):TrailResult{return {jobId:1,bodyId:'moon',frame,observer:sky.observer,anchorMs:sky.instantMs,requestedStartMs:sky.instantMs-1000,requestedEndMs:sky.instantMs+1000,startMs:sky.instantMs-1000,endMs:sky.instantMs+1000,samples:[-1000,1000].map(offset=>makeTrailSample(engine.calculate(sky.instantMs+offset,sky.observer,['W']),'moon')),status:'complete',progress:1,limits:[],versionKey:TRAIL_VERSION_KEY};}
  for(const frame of ['stars','horizon']as const)it(`retains every ${frame} sample plus the exact current point with explicit time/frame metadata`,()=>{
    const result=trail(frame),ctx={...context(),trail:result},before=JSON.stringify(result),items=trailNavigation(ctx).items;
    expect(items).toHaveLength(3);expect(items.map(item=>item.hit.sampleInstantMs)).toEqual([sky.instantMs-1000,sky.instantMs,sky.instantMs+1000]);
    for(const item of items){expect(item.hit).toMatchObject({kind:'trail',entityId:'body:moon',frame,representation:'history'});const model=resolveHoverCard(item.hit,ctx)!;expect(model).not.toBeNull();expect(model.contentIds.some(id=>id.startsWith('body-in-'))).toBe(false);}
    expect(JSON.stringify(result)).toBe(before);expect(trailNavigation({...ctx,trail:{...result,versionKey:'old'}}).items).toEqual([]);expect(trailNavigation({...ctx,trail:{...result,observer:{latitudeDeg:0,longitudeDeg:0}}}).items).toEqual([]);
  });
  it('omits undefined history samples, preserves jumps/system/time and rejects obsolete contexts',()=>{
    const history:BoundaryHistoryResult={jobId:2,system:'W',house:7,observer:sky.observer,anchorMs:sky.instantMs,requestedStartMs:sky.instantMs-1000,requestedEndMs:sky.instantMs+1000,startMs:sky.instantMs-1000,endMs:sky.instantMs+1000,limits:[],status:'complete',progress:1,versionKey:TRAIL_VERSION_KEY,samples:[{instantMs:sky.instantMs-1000,status:'valid',longitudeDeg:12,direction:1,point:{x:1,y:0,z:0},line:[{x:1,y:0,z:0},{x:0,y:1,z:0}]},{instantMs:sky.instantMs,status:'undefined',reason:'No rising branch'},{instantMs:sky.instantMs+1000,status:'jump',longitudeDeg:192,direction:-1,point:{x:-1,y:0,z:0},line:[{x:-1,y:0,z:0},{x:0,y:-1,z:0}],reason:'Discrete angular convention change'}]};
    const ctx={...context(),history},result=historyNavigation(ctx);expect(result.items).toHaveLength(2);expect(result.omitted[0]).toContain('No rising branch');
    for(const item of result.items){expect(item.hit).toMatchObject({kind:'history',entityId:'boundary:7',system:'W',frame:'stars',representation:'history'});expect(item.hit.id).toMatch(/^history:w:7:/);expect(resolveHoverCard(item.hit,ctx)).not.toBeNull();}
    expect(result.items[1]!.hit.role).toBe('jump');expect(historyNavigation({...ctx,history:{...history,system:'P'}}).items).toEqual([]);expect(historyNavigation({...ctx,history:{...history,versionKey:'old'}}).items).toEqual([]);
  });
});
