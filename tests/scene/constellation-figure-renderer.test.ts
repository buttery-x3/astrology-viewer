import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {beforeAll,afterAll,describe,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {EphemerisEngine,EPHEMERIS_FILES,type EphemerisSnapshot} from '../../src/lib/astronomy/ephemeris';
import {astronomicalToThree} from '../../src/lib/astronomy/coordinates';
import {createConstellationFigureRenderer} from '../../src/lib/scene/constellation-figure-renderer';
import {FIGURE_STARS,FIGURE_SUPPORT_STARS,figureStar} from '../../src/lib/scene/constellation-figures';
import {catalogueStarDirection} from '../../src/lib/scene/sky-data';
let engine:EphemerisEngine,sky:EphemerisSnapshot;
beforeAll(async()=>{
  engine=await EphemerisEngine.create({
    wasmBinary:new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
    files:new Map(await Promise.all(EPHEMERIS_FILES.map(async file=>[file.name,new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))]as const))),
  });
  sky=engine.calculate(Date.UTC(2000,0,1,12),{latitudeDeg:51.5,longitudeDeg:0});
});
afterAll(()=>engine?.close());
const render=()=>createConstellationFigureRenderer(5.8,()=>new THREE.Sprite(new THREE.SpriteMaterial()));
const state={visible:true,starsVisible:true,selectedId:null,hoveredId:null};
describe('independent constellation figure rendering',()=>{
  it('shows only support dots with catalogue stars and all endpoint dots without them',()=>{const display=render();display.update(sky,state);expect(display.endpointStars.geometry.drawRange.count).toBe(9);expect(display.endpointStars.userData.hygIds).toEqual(FIGURE_SUPPORT_STARS.map(star=>star[0]));display.update(sky,{...state,starsVisible:false});expect(display.endpointStars.geometry.drawRange.count).toBe(710);expect(display.endpointStars.userData.hygIds).toEqual(FIGURE_STARS.map(star=>star[0]));const p=display.endpointStars.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const star=figureStar(display.endpointStars.userData.hygIds[i])!,value=astronomicalToThree(catalogueStarDirection(star,sky.time.julianDateTt));expect(p.getX(i)).toBeCloseTo(value.x*5.8,5);expect(p.getY(i)).toBeCloseTo(value.y*5.8,5);expect(p.getZ(i)).toBeCloseTo(value.z*5.8,5);}display.update(sky,{...state,visible:false});expect(display.group.visible).toBe(false);expect(display.entities.every(e=>!e.valid&&!e.label.userData.labelEnabled)).toBe(true);});
  it('registers figure/label roles, highlights the linked constellation and reuses geometry',()=>{const display=render();display.resize(1440,900);display.update(sky,state);expect(display.entities).toHaveLength(88);const entity=display.entities.find(e=>e.id==='asterism:ori')!,line=entity.objects.find(o=>o instanceof Line2)as Line2;expect(line.userData.featureHit.role).toBe('figure-path');expect(entity.label.userData.featureHit.role).toBe('figure-label');expect(line.userData.selectionId).toBe('constellation:ori');const geometry=line.geometry;display.update(sky,{...state,selectedId:'constellation:ori'});expect(line.material.linewidth).toBe(2.6);expect(line.material.resolution.toArray()).toEqual([1440,900]);display.update(engine.calculate(Date.UTC(2100,0,1),sky.observer),state);expect(line.geometry).toBe(geometry);expect(entity.anchor.length()).toBeCloseTo(5.8*1.006,10);expect(line.geometry.instanceCount).toBeGreaterThan(0);});
});
