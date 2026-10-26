import {expect,test,type Page} from '@playwright/test';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {EphemerisEngine,EPHEMERIS_FILES,type EphemerisSnapshot} from '../../src/lib/astronomy/ephemeris';
import {astronomicalToThree,equatorialToVector} from '../../src/lib/astronomy/coordinates';
import {buildEarthHouseProjection,earthToFixedDirection} from '../../src/lib/domain/earth-projections';
import {buildAstrocartography} from '../../src/lib/domain/astrocartography';
import {buildAspectCurve} from '../../src/lib/scene/aspect-curve';
import {openControlGroup} from './helpers';

type Draw={mode:number;count:number;opacity:number|null;diffuse:number[]|null};
type Probe={view:number[];lineView:number[];projection:number[];draws:Draw[];frames:number};
let engine:EphemerisEngine,snapshot:EphemerisSnapshot;
test.beforeAll(async()=>{
  engine=await EphemerisEngine.create({wasmBinary:new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),files:new Map(await Promise.all(EPHEMERIS_FILES.map(async file=>[file.name,new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const)))});
  snapshot=engine.calculate(Date.UTC(2000,0,1,12),{latitudeDeg:51.5,longitudeDeg:0});
});
test.afterAll(()=>engine?.close());

/** Observe submitted WebGL work and the actual camera, without production test hooks. */
async function instrument(page:Page){
  await page.addInitScript(()=>{
    const probe:Probe=(window as any).m10EarthProbe={view:[],lineView:[],projection:[],draws:[],frames:0};
    const locations=new WeakMap<WebGLUniformLocation,{program:WebGLProgram;name:string}>();
    const linePrograms=new WeakSet<WebGLProgram>(),earthPrograms=new WeakSet<WebGLProgram>();
    const values=new WeakMap<WebGLProgram,{opacity:number|null;diffuse:number[]|null}>();
    let program:WebGLProgram|null=null;
    const proto=WebGL2RenderingContext.prototype;
    const uniform=proto.getUniformLocation;
    proto.getUniformLocation=function(owner,name){const value=uniform.call(this,owner,name);if(value){locations.set(value,{program:owner,name});if(name==='linewidth')linePrograms.add(owner);if(name==='earthCameraLocal')earthPrograms.add(owner);}return value;};
    const use=proto.useProgram;proto.useProgram=function(owner){program=owner;return use.call(this,owner);};
    const matrix=proto.uniformMatrix4fv;proto.uniformMatrix4fv=function(...args:Parameters<typeof matrix>){const found=args[0]&&locations.get(args[0]);if(found?.name==='viewMatrix')probe.view=Array.from(args[2]);if(found?.name==='modelViewMatrix'&&linePrograms.has(found.program)&&!earthPrograms.has(found.program))probe.lineView=Array.from(args[2]);if(found?.name==='projectionMatrix')probe.projection=Array.from(args[2]);return Reflect.apply(matrix,this,args);};
    const scalar=proto.uniform1f;proto.uniform1f=function(location,value){const found=location&&locations.get(location);if(found?.name==='opacity'){const state=values.get(found.program)??{opacity:null,diffuse:null};state.opacity=value;values.set(found.program,state);}return scalar.call(this,location,value);};
    const colour=proto.uniform3f;proto.uniform3f=function(location,x,y,z){const found=location&&locations.get(location);if(found?.name==='diffuse'){const state=values.get(found.program)??{opacity:null,diffuse:null};state.diffuse=[x,y,z];values.set(found.program,state);}return colour.call(this,location,x,y,z);};
    const colours=proto.uniform3fv;proto.uniform3fv=function(...args:Parameters<typeof colours>){const found=args[0]&&locations.get(args[0]);if(found?.name==='diffuse'){const state=values.get(found.program)??{opacity:null,diffuse:null};state.diffuse=Array.from(args[1]).slice(0,3);values.set(found.program,state);}return Reflect.apply(colours,this,args);};
    const clear=proto.clear;proto.clear=function(mask){if(mask&this.COLOR_BUFFER_BIT){probe.draws=[];probe.frames++;}return clear.call(this,mask);};
    const record=(mode:number,count:number)=>{const state=program&&values.get(program);probe.draws.push({mode,count,opacity:state?.opacity??null,diffuse:state?.diffuse??null});};
    const arrays=proto.drawArrays;proto.drawArrays=function(mode,first,count){record(mode,count);return arrays.call(this,mode,first,count);};
    const elements=proto.drawElements;proto.drawElements=function(mode,count,type,offset){record(mode,count);return elements.call(this,mode,count,type,offset);};
    const instanced=proto.drawElementsInstanced;proto.drawElementsInstanced=function(mode,count,type,offset,instances){record(mode,count*instances);return instanced.call(this,mode,count,type,offset,instances);};
  });
}
const probe=(page:Page)=>page.evaluate(()=>(window as any).m10EarthProbe as Probe);
async function example(page:Page){
  await instrument(page);await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Earth overview',exact:true}).click();
  await expect.poll(async()=>(await probe(page)).view.length).toBe(16);
}
async function settle(page:Page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function additional(page:Page,category:string,query:string,id:string){
  await openControlGroup(page,'references');await page.getByLabel('Feature category',{exact:true}).selectOption(category);
  await page.getByLabel('Search additional features',{exact:true}).fill(query);
  const result=page.locator(`.feature-navigation [data-feature-id="${id}"]`);await expect(result).toBeVisible();return result;
}
function separation(a:number[],b:number[]){return Math.hypot(...a.map((value,index)=>value-b[index]!));}
async function project(page:Page,point:{x:number;y:number;z:number},fixedLine=false){
  await expect.poll(async()=>{
    const current=await probe(page),box=await page.locator('.scene-canvas canvas').boundingBox();
    return box?Math.abs(current.projection[5]!/current.projection[0]!-box.width/box.height):1;
  }).toBeLessThan(1e-5);
  await settle(page);
  const state=await probe(page),box=await page.locator('.scene-canvas canvas').boundingBox();if(!box)throw new Error('Missing sky canvas.');
  // Fixed-sky Line2 objects have identity model transforms; their model-view
  // uniform remains available when hiding stars optimizes viewMatrix away.
  const view=new THREE.Matrix4().fromArray(fixedLine?state.lineView:state.view),projection=new THREE.Matrix4().fromArray(state.projection);
  const world=astronomicalToThree(point),ndc=new THREE.Vector3(world.x,world.y,world.z).applyMatrix4(view).applyMatrix4(projection);
  expect(Math.abs(ndc.x)).toBeLessThan(1);expect(Math.abs(ndc.y)).toBeLessThan(1);
  return {x:box.x+(ndc.x+1)*box.width/2,y:box.y+(1-ndc.y)*box.height/2};
}
function colourDraw(draws:Draw[],hex:number,opacity:number){const expected=new THREE.Color(hex);return draws.some(draw=>draw.mode===4&&draw.diffuse&&Math.hypot(draw.diffuse[0]!-expected.r,draw.diffuse[1]!-expected.g,draw.diffuse[2]!-expected.b)<1e-5&&draw.opacity!==null&&Math.abs(draw.opacity-opacity)<1e-5);}

test('constellation regions and modern figures remain independent, including endpoints with stars hidden',async({page},info)=>{
  await example(page);await page.getByRole('button',{name:'Outside sphere',exact:true}).click();await openControlGroup(page,'layers');
  const regions=page.getByLabel('Constellation regions',{exact:true}),figures=page.getByLabel('Constellation asterisms',{exact:true});
  await page.getByRole('checkbox',{name:'Catalogue stars',exact:true}).uncheck();await regions.uncheck();await figures.uncheck();await settle(page);
  expect((await probe(page)).draws.filter(draw=>draw.mode===0).map(draw=>draw.count)).not.toContain(710);
  await figures.check();await expect(regions).not.toBeChecked();
  await expect.poll(async()=>(await probe(page)).draws.some(draw=>draw.mode===0&&draw.count===710)).toBe(true);
  const figureImage=await page.locator('.scene-canvas canvas').screenshot();await info.attach('figures-with-endpoint-dots',{body:figureImage,contentType:'image/png'});
  await regions.check();await expect(figures).toBeChecked();await settle(page);
  expect(await page.locator('.scene-canvas canvas').screenshot()).not.toEqual(figureImage);
  await figures.uncheck();await expect(regions).toBeChecked();await settle(page);
  await expect.poll(async()=>(await probe(page)).draws.some(draw=>draw.mode===0&&draw.count===710)).toBe(false);
  const figure=await additional(page,'figures','Orion','asterism:ori');await figure.click();
  await expect(figures).toBeChecked();await expect(regions).toBeChecked();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Orion',exact:true})).toBeVisible();
  await expect(page.locator('#inspector')).toContainText('Constellation asterism');
});

test('re-entering Earth overview restores its close globe while retaining its layer memory and moment',async({page})=>{
  await example(page);const context=await page.locator('.context-details').innerText();await settle(page);const initial=(await probe(page)).view;
  await openControlGroup(page,'earth');await page.getByLabel('Earth projections',{exact:true}).uncheck();await page.getByLabel('Projected house sections',{exact:true}).uncheck();await page.getByLabel('Astrocartography lines',{exact:true}).uncheck();
  const canvas=page.locator('.scene-canvas canvas');await canvas.focus();await page.keyboard.press('ArrowRight');await expect.poll(async()=>(await probe(page)).view).not.toEqual(initial);
  await page.getByRole('button',{name:'Earth overview',exact:true}).click();
  for(const name of ['Earth projections','Astrocartography lines'])await expect(page.getByLabel(name,{exact:true})).not.toBeChecked();
  await expect(page.getByLabel('Projected house sections',{exact:true})).not.toBeChecked();
  await expect.poll(async()=>separation((await probe(page)).view,initial)).toBeLessThan(1e-5);
  expect(await page.locator('.context-details').innerText()).toBe(context);
});

test('a selected geographic line focuses from Outside sphere without applying the Earth re-entry preset',async({page},info)=>{
  await example(page);await page.getByRole('button',{name:'Outside sphere',exact:true}).click();await openControlGroup(page,'earth');
  await expect(page.getByLabel('Earth projections',{exact:true})).not.toBeChecked();
  await page.getByLabel('Projected house sections',{exact:true}).uncheck();
  const target=await additional(page,'astro','Venus MC','astro:venus:mc');await target.click();await settle(page);const outside=(await probe(page)).view;
  await page.getByRole('button',{name:'Focus selected feature',exact:true}).click();
  await expect(page.getByRole('group',{name:'Camera orientation',exact:true})).toContainText('Earth overview');
  await expect(page.getByLabel('Projected house sections',{exact:true})).not.toBeChecked();
  await expect(page.getByLabel('Earth projections',{exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Astrocartography lines',exact:true})).toBeChecked();
  await expect.poll(async()=>separation((await probe(page)).view,outside)).toBeGreaterThan(1);
  const focus=(await probe(page)).view;await settle(page);expect(separation((await probe(page)).view,focus)).toBeLessThan(1e-5);
  const line=buildAstrocartography(snapshot).lines.find(line=>line.id==='astro:venus:mc')!;expect(line.status).toBe('valid');expect(line.anchor).not.toBeNull();
  const point=earthToFixedDirection(line.anchor!.point,snapshot);
  // Clearing an unpinned inspector changes the actual canvas width. Project
  // after that layout change, using its newly submitted camera matrices.
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();await settle(page);
  const screen=await project(page,{x:point.x*.82*1.006,y:point.y*.82*1.006,z:point.z*.82*1.006});await page.mouse.click(screen.x,screen.y);
  const chooser=page.getByRole('dialog',{name:'Choose a nearby feature',exact:true});if(await chooser.isVisible())await chooser.getByRole('button',{name:/Venus MC/}).click();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Venus · MC',exact:true})).toBeVisible();
  await expect(page.locator('#inspector')).toContainText('Upper meridian transit');
  await info.attach('geographic-line-canvas-selection',{body:await page.locator('.scene-canvas canvas').screenshot(),contentType:'image/png'});
});

test('actual Earth house selection and sky house selection submit reciprocal highlights',async({page},info)=>{
  await example(page);await openControlGroup(page,'layers');await page.getByLabel('Longitude houses',{exact:true}).check();await openControlGroup(page,'earth');await page.getByLabel('Astrocartography lines',{exact:true}).uncheck();
  const target=await additional(page,'earth','Projected house 1','earth:house:primary:1');await target.click();await page.getByRole('button',{name:'Focus selected feature',exact:true}).click();await settle(page);
  const projection=buildEarthHouseProjection(snapshot);expect(projection.status).toBe('valid');if(projection.status!=='valid')throw new Error(projection.reason);
  const anchor=earthToFixedDirection(projection.regions[0]!.anchor.point,snapshot);
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();await settle(page);
  const screen=await project(page,{x:anchor.x*.82*1.003,y:anchor.y*.82*1.003,z:anchor.z*.82*1.003});await page.mouse.click(screen.x+4,screen.y+4);await page.mouse.move(5,5);
  await expect(page.locator('#inspector').getByRole('heading',{name:'House 1',exact:true,level:2})).toBeVisible();
  await expect(page.locator('#inspector')).toContainText('Whole Sign');
  // The selected surface in each representation has a distinct material colour.
  // Assert real GPU submissions, rather than merely checking two enabled flags.
  await expect.poll(async()=>colourDraw((await probe(page)).draws,0xd6b56c,.14*2.4)).toBe(true);
  await expect.poll(async()=>colourDraw((await probe(page)).draws,0xf1d79d,.14*.65)).toBe(true);
  await openControlGroup(page,'houses');await page.getByRole('button',{name:'House 1',exact:true}).click();await page.mouse.move(5,5);
  await expect(page.locator('#inspector').getByRole('heading',{name:'House 1',exact:true})).toBeVisible();
  await expect.poll(async()=>colourDraw((await probe(page)).draws,0xd6b56c,.14*2.4)).toBe(true);
  await expect.poll(async()=>colourDraw((await probe(page)).draws,0xf1d79d,.14*.65)).toBe(true);
  await info.attach('reciprocal-house-material-submissions',{body:JSON.stringify((await probe(page)).draws),contentType:'application/json'});
});

test('a real Orion figure path opens its asterism reading without selecting the official region',async({page})=>{
  await example(page);await page.getByRole('button',{name:'Outside sphere',exact:true}).click();await openControlGroup(page,'layers');
  // Isolate the real path from broad sign/house surfaces and neighbouring stars.
  for(const label of ['Celestial bodies','Horizon & compass','Ecliptic','Tropical signs','Ascendant, MC & opposites','Celestial equator','Local meridian','Prime vertical','Catalogue stars','Constellation regions','Longitude houses'])await page.getByRole('checkbox',{name:label,exact:true}).uncheck();
  await openControlGroup(page,'aspects');await page.getByLabel('Show aspect strands',{exact:true}).uncheck();
  await (await additional(page,'figures','Orion','asterism:ori')).click();await page.getByRole('button',{name:'Focus selected feature',exact:true}).click();await settle(page);
  // Read the pinned endpoint catalogue independently of the renderer. A point
  // between two catalogue stars lies on their figure's short great-circle arc.
  const data=JSON.parse(await readFile('src/lib/scene/data/constellation-figures.json','utf8')) as {figures:{id:string;paths:number[][]}[];supportStars:number[][]};
  const catalogue=JSON.parse(await readFile('src/lib/scene/data/bright-stars.json','utf8')) as {epochJulianDate:number;stars:number[][]};
  const path=data.figures.find(figure=>figure.id==='asterism:ori')!.paths[0]!,stars=new Map([...catalogue.stars,...data.supportStars].map(star=>[star[0],star]));
  const direction=(id:number)=>{const star=stars.get(id)!,years=(snapshot.time.julianDateTt-catalogue.epochJulianDate)/365.25;return new THREE.Vector3(star[3]!+years*star[6]!,star[4]!+years*star[7]!,star[5]!+years*star[8]!).normalize();};
  const a=direction(path[0]!),b=direction(path[1]!),point=a.multiplyScalar(.65).addScaledVector(b,.35).normalize().multiplyScalar(5.8);
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();await settle(page);const screen=await project(page,point,true);
  await page.mouse.move(screen.x,screen.y);const hover=page.getByTestId('scene-hover');
  await expect(hover.getByRole('heading',{name:'Orion',exact:true})).toBeVisible();await expect(hover).toContainText('Constellation asterism');await expect(hover).not.toContainText('Feature role');
  await expect(hover.getByRole('link')).toHaveCount(0);await page.mouse.click(screen.x,screen.y);
  await expect(page.locator('#inspector').getByRole('heading',{name:'Orion',exact:true,level:2})).toBeVisible();
  await expect(page.locator('#inspector')).toContainText('Constellation asterism');
  await expect(page.getByRole('checkbox',{name:'Constellation regions',exact:true})).not.toBeChecked();
});

test('a real aspect strand composes both placements and disappears from hover after an orb crossing',async({page})=>{
  await example(page);await page.getByRole('button',{name:'Outside sphere',exact:true}).click();await openControlGroup(page,'aspects');
  for(const name of ['Conjunction','Square','Trine','Opposition'])await page.getByRole('checkbox',{name,exact:true}).uncheck();
  await page.getByRole('button',{name:'Inspect Sun sextile Moon',exact:true}).click();await page.getByRole('button',{name:'Focus aspect F',exact:true}).click();await settle(page);
  const sun=snapshot.bodies.find(body=>body.id==='sun')!,moon=snapshot.bodies.find(body=>body.id==='moon')!;
  const curve=buildAspectCurve(equatorialToVector(sun.fixedEquatorial),equatorialToVector(moon.fixedEquatorial),'sextile',5.8);
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();await settle(page);const screen=await project(page,curve.points[16]!,true);
  await page.mouse.move(screen.x,screen.y);const hover=page.getByTestId('scene-hover');
  await expect(hover.getByRole('heading',{name:'Sextile',exact:true})).toBeVisible();
  await expect(hover.getByRole('heading',{name:'Sun in Capricorn',exact:true})).toBeVisible();await expect(hover.getByRole('heading',{name:'Moon in Scorpio',exact:true})).toBeVisible();await expect(hover.getByRole('link')).toHaveCount(0);
  await page.mouse.click(screen.x,screen.y);await expect(page.locator('#inspector .aspect-measurement')).toContainText('Within orb');
  await expect(page.getByRole('button',{name:'Inspect Sun sextile Moon',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByText('Orbs and appearance',{exact:true}).click();await page.getByLabel('Sextile orb',{exact:true}).fill('1');await page.getByRole('button',{name:'Apply orb settings',exact:true}).click();
  await expect(page.locator('#inspector .aspect-warning')).toContainText('Outside configured orb');await expect(page.getByRole('button',{name:'Inspect Sun sextile Moon',exact:true})).toHaveCount(0);
  await expect(hover.locator('[data-aspect-type="sextile"]')).toHaveCount(0);
});
