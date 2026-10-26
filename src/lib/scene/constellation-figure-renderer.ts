import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import type {EphemerisSnapshot} from '../astronomy/ephemeris';
import {astronomicalToThree,equatorialOfDateToFixed,equatorialToVector,horizonToEquatorial,normalizeVector,type Vector3} from '../astronomy/coordinates';
import {CONSTELLATION_FIGURES,FIGURE_STARS,FIGURE_SUPPORT_STARS,buildFigurePaths} from './constellation-figures';
import {catalogueStarDirection} from './sky-data';
import {createWideLineGeometry,writeWideLine} from './wide-line-buffer';

type CaptionFactory=(text:string,color:string,size:number)=>THREE.Sprite;
export interface ConstellationFigureSceneEntity {id:string;name:string;kind:'asterism';objects:THREE.Object3D[];anchor:THREE.Vector3;valid:boolean;lines:THREE.Line[];label:THREE.Sprite;focusRadius:number}
export interface FigureInteraction {visible:boolean;starsVisible:boolean;selectedId:string|null;hoveredId:string|null}
export interface ConstellationFigureRenderer {group:THREE.Group;readonly entities:ConstellationFigureSceneEntity[];endpointStars:THREE.Points;update(snapshot:EphemerisSnapshot|null,interaction:FigureInteraction):void;resize(width:number,height:number):void}
const point=(value:Vector3,radius:number)=>{const p=astronomicalToThree(value);return new THREE.Vector3(p.x,p.y,p.z).multiplyScalar(radius);};

/** All geometry is catalogue-derived; visibility never changes star/sign/house classifications. */
export function createConstellationFigureRenderer(radius:number,captionFactory:CaptionFactory):ConstellationFigureRenderer{
  if(!Number.isFinite(radius)||radius<=0)throw new RangeError('A positive sky radius is required.');
  const group=new THREE.Group();group.name='Modern Western constellation figures';
  const entities:ConstellationFigureSceneEntity[]=[];
  const slots=CONSTELLATION_FIGURES.map(figure=>{
    const initial=buildFigurePaths(figure.id,2451545),lines=initial.map((points,index)=>{
      const capacity=points.length+figure.paths[index]!.length*4+8;
      const geometry=createWideLineGeometry(capacity,radius*1.01);geometry.setColors(new Float32Array((capacity+1)*3));
      const line=new Line2(geometry,new LineMaterial({color:0xffffff,vertexColors:true,linewidth:1.15,transparent:true,opacity:.38,depthWrite:false}));
      line.name=`${figure.name} figure path ${index+1}`;line.userData.wideLine=true;line.userData.entityId=figure.id;line.userData.entityKind='asterism';line.userData.selectionId=figure.constellationId;
      line.userData.featureHit={id:`${figure.id}:path:${index}`,entityId:figure.id,name:`${figure.name} · modern Western figure`,kind:'asterism',representation:'sky',role:'figure-path'};
      line.renderOrder=2;group.add(line);return line;
    });
    const label=captionFactory(figure.name,'#8cabbf',.22);label.userData.labelPriority=6;label.userData.entityId=figure.id;label.userData.entityKind='asterism';label.userData.selectionId=figure.constellationId;
    label.userData.featureHit={id:`${figure.id}:label`,entityId:figure.id,name:`${figure.name} · modern Western figure`,kind:'asterism',representation:'sky',role:'figure-label'};
    group.add(label);const entity:ConstellationFigureSceneEntity={id:figure.id,name:`${figure.name} · modern Western figure`,kind:'asterism',objects:[...lines,label],anchor:label.position,valid:false,lines:[],label,focusRadius:radius*.28};entities.push(entity);
    return {figure,lines,label,entity,paths:initial};
  });
  const positions=new THREE.BufferAttribute(new Float32Array(FIGURE_STARS.length*3),3).setUsage(THREE.DynamicDrawUsage),colors=new THREE.BufferAttribute(new Float32Array(FIGURE_STARS.length*3),3).setUsage(THREE.DynamicDrawUsage);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',positions);geometry.setAttribute('color',colors);geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),radius*1.01);
  const endpointStars=new THREE.Points(geometry,new THREE.PointsMaterial({size:1.8,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.65,depthWrite:false}));
  endpointStars.name='Constellation figure endpoint stars';endpointStars.userData.entityKind='star';endpointStars.userData.hygIds=[];group.add(endpointStars);
  let previousSnapshot:EphemerisSnapshot|null=null,previousStarsVisible:boolean|null=null;
  const scaled=(value:Vector3)=>({x:value.x*radius,y:value.y*radius,z:value.z*radius});
  return {group,entities,endpointStars,resize(width,height){for(const slot of slots)for(const line of slot.lines)line.material.resolution.set(Math.max(1,width),Math.max(1,height));},
    update(snapshot,interaction){
      group.visible=interaction.visible&&snapshot!==null;
      for(const slot of slots){slot.entity.valid=group.visible;slot.label.userData.labelEnabled=group.visible;slot.label.visible=group.visible;}
      if(!snapshot||!group.visible)return;
      const changed=snapshot!==previousSnapshot,up=equatorialOfDateToFixed(equatorialToVector(horizonToEquatorial({east:0,north:0,up:1},snapshot.observer,snapshot.greenwichSiderealTimeDeg)),snapshot.frame);
      if(changed){for(const slot of slots){
        slot.paths=buildFigurePaths(slot.figure.id,snapshot.time.julianDateTt);
        for(const [index,values]of slot.paths.entries())writeWideLine(slot.lines[index]!.geometry,values.map(scaled));
        const longest=slot.paths.reduce((a,b)=>a.length>b.length?a:b),middle=normalizeVector(longest.reduce((sum,p)=>({x:sum.x+p.x,y:sum.y+p.y,z:sum.z+p.z}),{x:0,y:0,z:0}));
        slot.label.position.copy(point(middle,radius*1.006));
      }}
      for(const slot of slots){const selected=interaction.selectedId===slot.figure.id||interaction.selectedId===slot.figure.constellationId,hovered=interaction.hoveredId===slot.figure.id;
        const color=new THREE.Color(selected?0xf0d292:hovered?0xb9e5de:0x7d9cb5);
        for(const [index,line]of slot.lines.entries()){
          line.material.linewidth=selected?2.6:hovered?2:1.15;line.material.opacity=selected?.92:hovered?.78:.38;
          const attribute=line.geometry.getAttribute('instanceColorStart') as THREE.InterleavedBufferAttribute,values=attribute.data.array as Float32Array,path=slot.paths[index]!;
          for(let i=0;i<path.length-1;i++)for(let end=0;end<2;end++){const p=path[i+end]!,factor=p.x*up.x+p.y*up.y+p.z*up.z<0?.45:1;values.set([color.r*factor,color.g*factor,color.b*factor],i*6+end*3);}attribute.data.needsUpdate=true;
        }
      }
      if(changed||previousStarsVisible!==interaction.starsVisible){const stars=interaction.starsVisible?FIGURE_SUPPORT_STARS:FIGURE_STARS;endpointStars.userData.hygIds=stars.map(star=>star[0]);endpointStars.userData.starIds=stars.map(star=>`star:hyg:${star[0]}`);
        for(const [index,star]of stars.entries()){const direction=catalogueStarDirection(star,snapshot.time.julianDateTt),p=point(direction,radius),factor=direction.x*up.x+direction.y*up.y+direction.z*up.z<0?.4:1;positions.setXYZ(index,p.x,p.y,p.z);colors.setXYZ(index,.72*factor,.83*factor,.9*factor);}geometry.setDrawRange(0,stars.length);positions.needsUpdate=colors.needsUpdate=true;
      }
      previousSnapshot=snapshot;previousStarsVisible=interaction.starsVisible;
    }};
}
