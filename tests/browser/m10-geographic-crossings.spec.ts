import {expect,test,type Page,type Locator} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {EphemerisEngine,EPHEMERIS_FILES,BODY_IDS,type EphemerisSnapshot} from '../../src/lib/astronomy/ephemeris';
import {astronomicalToThree} from '../../src/lib/astronomy/coordinates';
import {buildAstrocartography,geographicSample,type AstroLine,type AstroAngle} from '../../src/lib/domain/astrocartography';
import {earthToFixedDirection} from '../../src/lib/domain/earth-projections';
import type {FeatureHit} from '../../src/lib/domain/scene-hit';
import {openControlGroup} from './helpers';

type CameraProbe={view:number[];projection:number[]};
type Crossing={point:THREE.Vector3;lines:[AstroLine,AstroLine];normalResidual:number};
type CanvasProjection={x:number;y:number;ndc:THREE.Vector3};
let engine:EphemerisEngine,snapshot:EphemerisSnapshot,lines:AstroLine[],crossings:Crossing[];
const radius=.82*1.006;
const v=(point:{x:number;y:number;z:number})=>new THREE.Vector3(point.x,point.y,point.z);
const title=(id:string)=>id[0]!.toUpperCase()+id.slice(1);
const angleLabels:Record<AstroAngle,string>={ac:'Rising · AC',dc:'Setting · DC',mc:'Upper meridian · MC',ic:'Lower meridian · IC'};
const condition:Record<AstroAngle,string>={ac:'Rising across the geometric horizon',dc:'Setting across the geometric horizon',mc:'Upper meridian transit',ic:'Lower meridian transit'};

test.beforeAll(async()=>{
  engine=await EphemerisEngine.create({wasmBinary:new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),files:new Map(await Promise.all(EPHEMERIS_FILES.map(async file=>[file.name,new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const)))});
  snapshot=engine.calculate(Date.UTC(2000,0,1,12),{latitudeDeg:51.5,longitudeDeg:0},['W']);
  lines=buildAstrocartography(snapshot).lines.filter(line=>line.status==='valid');crossings=[];
  const plane=(line:AstroLine)=>v(line.segments[0]![0]!.point).cross(v(line.segments[0]![1]!.point)).normalize();
  for(const meridian of lines.filter(line=>line.angle==='mc'||line.angle==='ic'))for(const horizon of lines.filter(line=>line.angle==='ac'||line.angle==='dc')){
    if(meridian.bodyId===horizon.bodyId)continue;
    const first=plane(meridian),second=plane(horizon),intersection=first.clone().cross(second);if(intersection.length()<.1)continue;
    intersection.normalize();
    for(const sign of [-1,1]){
      const point=intersection.clone().multiplyScalar(sign);
      // Each angular line is a semicircle centred on its declared anchor. This
      // rejects the opposite branch and singular pole/tangent endpoints.
      if(point.dot(v(meridian.anchor!.point))<.08||point.dot(v(horizon.anchor!.point))<.08||Math.abs(point.z)>.94)continue;
      crossings.push({point,lines:[meridian,horizon],normalResidual:Math.max(Math.abs(point.dot(first)),Math.abs(point.dot(second)))});
    }
  }
});
test.afterAll(()=>engine?.close());

async function example(page:Page){
  await page.addInitScript(()=>{
    const probe:CameraProbe=(window as any).geographicCrossingCamera={view:[],projection:[]};
    const locations=new WeakMap<WebGLUniformLocation,string>(),proto=WebGL2RenderingContext.prototype,get=proto.getUniformLocation;
    proto.getUniformLocation=function(program,name){const result=get.call(this,program,name);if(result)locations.set(result,name);return result;};
    const upload=proto.uniformMatrix4fv;proto.uniformMatrix4fv=function(...args:Parameters<typeof upload>){const name=args[0]&&locations.get(args[0]);if(name==='viewMatrix')probe.view=Array.from(args[2]);if(name==='projectionMatrix')probe.projection=Array.from(args[2]);return Reflect.apply(upload,this,args);};
  });
  await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).geographicCrossingCamera.view.length)).toBe(16);
  await openControlGroup(page,'earth');await page.getByRole('checkbox',{name:'Projected house sections',exact:true}).uncheck();
  const filters=page.locator('.earth-controls details');await filters.locator('summary').click();
}
async function matrices(page:Page){
  await expect.poll(async()=>{const probe=await page.evaluate(()=>(window as any).geographicCrossingCamera as CameraProbe),box=await page.locator('.scene-canvas canvas').boundingBox();return box?Math.abs(probe.projection[5]!/probe.projection[0]!-box.width/box.height):1;}).toBeLessThan(1e-5);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const state=await page.evaluate(()=>(window as any).geographicCrossingCamera as CameraProbe),box=await page.locator('.scene-canvas canvas').boundingBox();if(!box)throw new Error('Missing canvas.');
  const view=new THREE.Matrix4().fromArray(state.view),projection=new THREE.Matrix4().fromArray(state.projection),camera=new THREE.Vector3().setFromMatrixPosition(view.clone().invert());
  const project=(point:{x:number;y:number;z:number}):CanvasProjection=>{const fixed=earthToFixedDirection(point,snapshot),world=astronomicalToThree(fixed),ndc=new THREE.Vector3(world.x,world.y,world.z).multiplyScalar(radius).applyMatrix4(view).applyMatrix4(projection);return{x:box.x+(ndc.x+1)*box.width/2,y:box.y+(1-ndc.y)*box.height/2,ndc};};
  const facing=(point:THREE.Vector3)=>{const fixed=earthToFixedDirection(point,snapshot),world=v(astronomicalToThree(fixed)).multiplyScalar(radius);return world.dot(camera.clone().sub(world));};
  return{project,facing,camera,box};
}
async function filters(page:Page,target:Crossing){
  const bodies=new Set(target.lines.map(line=>line.bodyId)),angles=new Set(target.lines.map(line=>line.angle));
  for(const id of BODY_IDS)await page.getByRole('checkbox',{name:`${title(id)} geographic lines`,exact:true}).setChecked(bodies.has(id));
  for(const angle of ['ac','dc','mc','ic'] as const)await page.getByRole('checkbox',{name:angleLabels[angle],exact:true}).setChecked(angles.has(angle));
}
async function frontCrossing(page:Page){const camera=await matrices(page);const candidates=crossings.filter(crossing=>camera.facing(crossing.point)>.4).map(crossing=>({crossing,screen:camera.project(crossing.point)})).filter(({screen})=>Math.abs(screen.ndc.x)<.8&&Math.abs(screen.ndc.y)<.8);expect(candidates.length).toBeGreaterThan(0);return candidates.sort((a,b)=>camera.facing(b.crossing.point)-camera.facing(a.crossing.point))[0]!.crossing;}
const chooser=(page:Page)=>page.getByRole('dialog',{name:'Choose a nearby feature',exact:true});
async function inspect(page:Page,target:AstroLine){
  await expect(page.locator('#inspector').getByRole('heading',{name:`${title(target.bodyId)} · ${target.angle.toUpperCase()}`,exact:true,level:2})).toBeVisible();
  await expect(page.locator('#inspector .data-list > div').filter({has:page.locator('dt',{hasText:/^Feature role$/})})).toContainText('line');
  await expect(page.locator('#inspector .data-list > div').filter({has:page.locator('dt',{hasText:/^Angular condition$/})})).toContainText(condition[target.angle]);
  await expect(page.locator('#inspector .data-list > div').filter({has:page.locator('dt',{hasText:/^Displayed moment$/})})).toContainText('2000-01-01 · 12:00:00 UTC');
  await expect(page.locator(`#inspector [data-content-id="astro:body:${target.bodyId}"]`)).toBeVisible();await expect(page.locator(`#inspector [data-content-id="astro:angle:${target.angle}"]`)).toBeVisible();
}
async function candidateMetadata(button:Locator,line:AstroLine){
  const metadata=JSON.parse((await button.getAttribute('data-feature-json'))!) as FeatureHit&{bodyId:string;angle:string;instantMs:number;convention:string};
  expect(metadata).toMatchObject({id:line.id,entityId:line.id,kind:'astro-line',role:'line',representation:'earth',bodyId:line.bodyId,angle:line.angle,instantMs:snapshot.instantMs,convention:'geocentric-apparent-in-mundo-unrefracted'});return metadata;
}

test('a genuine geographic crossing offers both full identities and preserves each choice in the inspector',async({page},info)=>{
  await example(page);const crossing=await frontCrossing(page);expect(crossing.normalResidual).toBeLessThan(1e-12);await filters(page,crossing);
  const before=await page.locator('.context-details').innerText(),metadata:FeatureHit[]=[],position=geographicSample(crossing.point);
  const measurements=crossing.lines.map(line=>{
    const hourAngleDeg=((snapshot.greenwichSiderealTimeDeg+position.longitudeDeg-line.rightAscensionDeg+540)%360)-180,rad=Math.PI/180,phi=position.latitudeDeg*rad,dec=line.declinationDeg*rad,hourAngle=hourAngleDeg*rad;
    const geometricAltitudeDeg=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(hourAngle))/rad,verticalRate=-Math.cos(phi)*Math.cos(dec)*Math.sin(hourAngle);
    if(line.angle==='mc'||line.angle==='ic')expect(Math.abs(Math.abs(hourAngleDeg)-(line.angle==='mc'?0:180))).toBeLessThan(1e-9);
    else{expect(Math.abs(geometricAltitudeDeg)).toBeLessThan(1e-9);expect(verticalRate*(line.angle==='ac'?1:-1)).toBeGreaterThan(0);}
    return{id:line.id,rightAscensionDeg:line.rightAscensionDeg,declinationDeg:line.declinationDeg,hourAngleDeg,geometricAltitudeDeg,verticalRate};
  });
  for(const selected of crossing.lines){
    const screen=(await matrices(page)).project(crossing.point);await page.mouse.click(screen.x,screen.y);await expect(chooser(page)).toBeVisible();
    for(const line of crossing.lines){const button=chooser(page).locator(`[data-feature-id="${line.id}"]`);await expect(button).toBeVisible();metadata.push(await candidateMetadata(button,line));}
    const button=chooser(page).locator(`[data-feature-id="${selected.id}"]`);await button.focus();await page.keyboard.press('Enter');
    await expect(chooser(page)).not.toBeVisible();await expect(page.locator('.scene-canvas canvas')).toBeFocused();await inspect(page,selected);
    expect(await page.locator('.context-details').innerText()).toBe(before);
  }
  await info.attach('actual-geographic-crossing',{body:JSON.stringify({point:position,ids:crossing.lines.map(line=>line.id),planeResidual:crossing.normalResidual,measurements,metadata},null,2),contentType:'application/json'});
});

test('disabled body, angle and master filters remove their real crossing targets from picking',async({page})=>{
  await example(page);const crossing=await frontCrossing(page);await filters(page,crossing);const[first,second]=crossing.lines;
  for(const label of [`${title(first.bodyId)} geographic lines`,angleLabels[first.angle]]){
    const filter=page.getByRole('checkbox',{name:label,exact:true});await filter.uncheck();
    const screen=(await matrices(page)).project(crossing.point);await page.mouse.click(screen.x,screen.y);
    await expect(chooser(page)).not.toBeVisible();await inspect(page,second);await expect(filter).not.toBeChecked();await filter.check();
  }
  await page.getByRole('checkbox',{name:'Astrocartography lines',exact:true}).uncheck();
  const screen=(await matrices(page)).project(crossing.point);await page.mouse.click(screen.x,screen.y);
  await expect(chooser(page)).not.toBeVisible();await expect(page.locator('#inspector').getByRole('heading',{name:'Earth',exact:true,level:2})).toBeVisible();
  await expect(page.locator('#inspector [data-content-id^="astro:"]')).toHaveCount(0);
});

const distanceToSegment=(p:CanvasProjection,a:CanvasProjection,b:CanvasProjection)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
test('far-side geographic crossings stay unavailable through a translucent Earth',async({page},info)=>{
  await example(page);const camera=await matrices(page);
  const candidates=crossings.filter(crossing=>camera.facing(crossing.point)<-.5).map(crossing=>{
    const screen=camera.project(crossing.point),bodyIds=new Set(crossing.lines.map(line=>line.bodyId)),angles=new Set(crossing.lines.map(line=>line.angle));
    const active=lines.filter(line=>bodyIds.has(line.bodyId)&&angles.has(line.angle));let clearance=Infinity;
    for(const line of active){if(line.anchor&&camera.facing(v(line.anchor.point))>0){const anchor=camera.project(line.anchor.point);clearance=Math.min(clearance,Math.hypot(screen.x-anchor.x,screen.y-anchor.y)-20);}
      for(const segment of line.segments)for(let index=1;index<segment.length;index++){const a=segment[index-1]!,b=segment[index]!;if(camera.facing(v(a.point))<=0&&camera.facing(v(b.point))<=0)continue;clearance=Math.min(clearance,distanceToSegment(screen,camera.project(a.point),camera.project(b.point)));}}
    return{crossing,screen,clearance};
  }).filter(candidate=>Math.abs(candidate.screen.ndc.x)<.8&&Math.abs(candidate.screen.ndc.y)<.8&&candidate.clearance>18).sort((a,b)=>b.clearance-a.clearance);
  expect(candidates.length).toBeGreaterThan(0);const target=candidates[0]!;await filters(page,target.crossing);
  await openControlGroup(page,'display');await page.getByLabel('Earth opacity',{exact:true}).evaluate(element=>{const input=element as HTMLInputElement;input.value='.3';input.dispatchEvent(new Event('input',{bubbles:true}));});
  // The ordinary Earth occlusion filter is intentionally disabled by opacity;
  // geographic front-surface clipping must still reject these two true curves.
  const screen=(await matrices(page)).project(target.crossing.point);await page.mouse.move(screen.x,screen.y);
  await expect(page.getByTestId('scene-hover').getByRole('heading',{name:'Earth',exact:true})).toBeVisible();
  await expect(page.getByTestId('scene-hover').locator('[data-feature-kind="astro-line"]')).toHaveCount(0);await page.mouse.click(screen.x,screen.y);
  await expect(chooser(page)).not.toBeVisible();await expect(page.locator('#inspector').getByRole('heading',{name:'Earth',exact:true,level:2})).toBeVisible();
  for(const line of target.crossing.lines)await expect(page.locator('#inspector').getByRole('heading',{name:`${title(line.bodyId)} · ${line.angle.toUpperCase()}`,exact:true})).not.toBeVisible();
  await info.attach('backside-crossing-rejection',{body:JSON.stringify({point:geographicSample(target.crossing.point),ids:target.crossing.lines.map(line=>line.id),facing:camera.facing(target.crossing.point),nearestVisibleCurveClearancePx:target.clearance,earthOpacity:.3},null,2),contentType:'application/json'});
});
