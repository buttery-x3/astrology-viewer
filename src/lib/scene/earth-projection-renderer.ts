import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { astronomicalToThree, threeToAstronomical, type Vector3 } from '../astronomy/coordinates';
import { BODY_IDS, type BodyId, type EphemerisSnapshot } from '../astronomy/ephemeris';
import { buildAstrocartography, ASTRO_ANGLES, type AstroLine } from '../domain/astrocartography';
import { buildEarthHouseProjection, classifyEarthHouse, type EarthHouseProjection, type EarthProjectionSettings } from '../domain/earth-projections';
import type { HouseMesh } from '../domain/house-geometry';
import { createWideLineGeometry, writeWideLine } from './wide-line-buffer';
import { primaryHouseLink } from '../domain/house-links';

type CaptionFactory = (text: string, color: string, size: number) => THREE.Sprite;
type Fill = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
export interface EarthSceneEntity {
  id: string; name: string; kind: 'earth-house' | 'astro-line'; representation: 'earth';
  objects: THREE.Object3D[]; anchor: THREE.Vector3; valid: boolean;
  lines: THREE.Line[]; label?: THREE.Sprite; focusRadius: number;
}
export interface EarthProjectionRenderer {
  /** Attach this group under the rotating Earth group, never under the fixed sky. */
  group: THREE.Group;
  readonly entities: EarthSceneEntity[];
  readonly hitTargets: THREE.Object3D[];
  readonly houseResult: EarthHouseProjection | null;
  update(snapshot: EphemerisSnapshot | null, settings: EarthProjectionSettings, interaction: { visible: boolean; selectedId: string | null; hoveredId: string | null }): void;
  resize(width: number, height: number): void;
  /** Call before label layout/render; front-side surface labels remain honest even with transparent Earth. */
  faceCamera(camera: THREE.Camera): void;
  /** Apply to raycaster hits, since raycasting does not execute fragment clipping. */
  isSurfaceHitVisible(worldPoint: THREE.Vector3): boolean;
  /** Analytic surface/partition lookup avoids testing every projected triangle on each pointer move. */
  intersectHouse(ray:THREE.Ray,snapshot:EphemerisSnapshot):THREE.Intersection|null;
  dispose(): void;
}
const BODY_COLOURS: Record<BodyId, number> = {
  sun: 0xf4c976, moon: 0xe0e8f3, mercury: 0xa6c3cb, venus: 0xe5ba9f, mars: 0xe18e7c,
  jupiter: 0xd5b690, saturn: 0xc4bfa1, uranus: 0x8cc4c4, neptune: 0x8fa9d8, pluto: 0xb8a8ca,
};
const BODY_GLYPHS = ['☉', '☽', '☿', '♀', '♂', '♃', '♄', '♅', '♆', '♇'];
const capacity = (size: number) => 2 ** Math.ceil(Math.log2(Math.max(4, size)));
function local(value: Vector3, radius = 1): THREE.Vector3 {
  const point = astronomicalToThree(value); return new THREE.Vector3(point.x, point.y, point.z).multiplyScalar(radius);
}
function writeMesh(target: Fill, mesh: HouseMesh): void {
  let positions = target.geometry.getAttribute('position'), indices = target.geometry.getIndex();
  if (!positions || positions.count < mesh.positions.length || !indices || indices.count < mesh.indices.length) {
    const replacement = new THREE.BufferGeometry();
    replacement.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(capacity(mesh.positions.length) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    replacement.setIndex(new THREE.BufferAttribute(new Uint32Array(capacity(mesh.indices.length)), 1).setUsage(THREE.DynamicDrawUsage));
    replacement.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.001);
    target.geometry.dispose(); target.geometry = replacement;
    positions = replacement.getAttribute('position'); indices = replacement.getIndex();
  }
  for (const [index, point] of mesh.positions.entries()) { const p = astronomicalToThree(point); positions.setXYZ(index, p.x, p.y, p.z); }
  (indices!.array as Uint32Array).set(mesh.indices); positions.needsUpdate = indices!.needsUpdate = true;
  target.geometry.setDrawRange(0, mesh.indices.length);
}

export function createEarthProjectionRenderer(radius: number, captionFactory: CaptionFactory): EarthProjectionRenderer {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('A positive Earth radius is required.');
  const group = new THREE.Group(); group.name = 'Earth projections';
  const houses = new THREE.Group(), astro = new THREE.Group(); group.add(houses, astro);
  const entities: EarthSceneEntity[] = [], allLines: Line2[] = [];
  const cameraLocal = new THREE.Vector3(0, 0, radius * 10);
  let lastCamera: THREE.Camera | null = null;
  let width = 1, height = 1, disposed = false, previousHouseKey = '', previousAstroKey = '';
  let houseResult: EarthHouseProjection | null = null;
  let hitTargets: THREE.Object3D[] = [];

  function refreshCameraLocal(): void {
    if (!lastCamera) return;
    group.updateWorldMatrix(true, false);
    cameraLocal.copy(lastCamera.getWorldPosition(new THREE.Vector3())); group.worldToLocal(cameraLocal);
  }

  function wideLine(colour: number, dashed = false): Line2 {
    const material = new LineMaterial({ color: colour, linewidth: 1.15, transparent: true, opacity: 0.55, depthWrite: false, dashed, dashSize: 0.035, gapSize: 0.025 });
    material.resolution.set(width, height);
    // Keep geographic curves on the visible side even when Earth is translucent.
    // instanceStart/End are Earth-local positions; varying interpolation clips at the limb.
    material.onBeforeCompile = shader => {
      shader.uniforms.earthCameraLocal = { value: cameraLocal };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 earthCameraLocal;\nvarying float earthFacing;')
        .replace('void main() {', 'void main() {\nvec3 earthPoint = mix(instanceStart, instanceEnd, clamp(position.y, 0.0, 1.0));\nearthFacing = dot(earthPoint, earthCameraLocal - earthPoint);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float earthFacing;')
        .replace('void main() {', 'void main() {\nif (earthFacing < 0.0) discard;');
    };
    material.customProgramCacheKey = () => 'earth-front-surface-v1';
    const line = new Line2(createWideLineGeometry(256, radius * 1.03), material);
    line.userData.wideLine = true; line.renderOrder = 5; allLines.push(line); return line;
  }
  function identify(object: THREE.Object3D, entity: EarthSceneEntity, role: string, extra: Record<string, unknown> = {}): void {
    object.userData.entityId = entity.id; object.userData.entityKind = entity.kind;
    object.userData.representation = 'earth'; object.userData.earthSurface = true;
    object.userData.featureHit = { id: entity.id, entityId: entity.id, name: entity.name, kind: entity.kind, role, representation: 'earth', ...extra };
    object.userData.hoverName = entity.name;
  }
  function entity(id: string, name: string, kind: EarthSceneEntity['kind'], label?: THREE.Sprite): EarthSceneEntity {
    const value: EarthSceneEntity = { id, name, kind, representation: 'earth', objects: [], anchor: new THREE.Vector3(), valid: false, lines: [], ...(label ? { label } : {}), focusRadius: radius * 0.28 };
    if (label) { label.userData.labelPriority = kind === 'earth-house' ? 35 : 40; label.userData.labelEnabled = false; }
    entities.push(value); return value;
  }
  const regions = Array.from({ length: 12 }, (_, index) => {
    const caption = captionFactory(`H${index + 1}`, '#c6dce7', 0.08);
    const target = entity(`earth:house:primary:${index + 1}`, `Projected chart house ${index + 1}`, 'earth-house', caption);
    const surface = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: index % 2 ? 0x647e9b : 0x618d9a, side: THREE.FrontSide, transparent: true, opacity: 0.14, depthWrite: false }));
    surface.scale.setScalar(radius * 1.003); surface.renderOrder = 3;
    target.objects.push(surface, caption); houses.add(surface, caption);
    identify(surface, target, 'section', { house: index + 1 }); identify(caption, target, 'badge', { house: index + 1 });
    return { target, surface, caption };
  });
  const boundaries = Array.from({ length: 12 }, (_, index) => {
    const target = entity(`earth:boundary:primary:${index + 1}`, `Projected cusp ${index + 1}`, 'earth-house');
    const line = wideLine(0xa5c9dd); target.objects.push(line); houses.add(line); identify(line, target, 'boundary', { house: index + 1 }); return { target, line };
  });
  const curves = BODY_IDS.flatMap((bodyId, bodyIndex) => ASTRO_ANGLES.map(angle => {
    const caption = captionFactory(`${BODY_GLYPHS[bodyIndex]} ${angle.toUpperCase()}`, `#${BODY_COLOURS[bodyId].toString(16).padStart(6, '0')}`, 0.065);
    const name = `${bodyId[0]!.toUpperCase()}${bodyId.slice(1)} ${angle.toUpperCase()} · geographic line`;
    const target = entity(`astro:${bodyId}:${angle}`, name, 'astro-line', caption);
    const lines = [wideLine(BODY_COLOURS[bodyId], angle === 'dc' || angle === 'ic'), wideLine(BODY_COLOURS[bodyId], angle === 'dc' || angle === 'ic')];
    for (const line of lines) { line.material.dashScale = angle === 'ic' ? 1.7 : 1; astro.add(line); identify(line, target, 'line', { bodyId, angle }); }
    target.objects.push(...lines, caption); astro.add(caption); identify(caption, target, 'badge', { bodyId, angle });
    return { target, lines, caption, bodyId, angle, data: null as AstroLine | null };
  }));

  function setLabel(caption: THREE.Sprite, target: EarthSceneEntity, point: Vector3, active: boolean): void {
    target.anchor.copy(local(point, radius * 1.014)); caption.position.copy(target.anchor);
    caption.userData.earthLabelActive = active; caption.userData.labelEnabled = active; caption.visible = active;
  }
  function updateMetadata(target: EarthSceneEntity, roleData: Record<string, unknown>): void {
    for (const object of target.objects) {
      object.userData.featureHit = { ...object.userData.featureHit, name: target.name, ...roleData };
      object.userData.hoverName = target.name;
    }
  }

  return {
    group, entities, get hitTargets() { return hitTargets; }, get houseResult() { return houseResult; },
    update(snapshot, settings, interaction) {
      if (disposed) return;
      group.visible = interaction.visible && settings.enabled && snapshot !== null;
      houses.visible = settings.houses; astro.visible = settings.astrocartography;
      hitTargets = [];
      const primary = snapshot?.houses[0];
      const houseKey = snapshot ? JSON.stringify([snapshot.instantMs, snapshot.observer, primary, snapshot.frame.rotation, snapshot.greenwichSiderealTimeDeg, snapshot.trueObliquityDeg]) : '';
      if (snapshot && houseKey !== previousHouseKey) {
        houseResult = buildEarthHouseProjection(snapshot, primary, { longitudeStepDeg: 3, latitudeStepDeg: 3 }); previousHouseKey = houseKey;
        if (houseResult.status === 'valid') {
          for (const [index, region] of houseResult.regions.entries()) {
            const slot = regions[index]!; writeMesh(slot.surface, region.surface);
            slot.target.anchor.copy(local(region.anchor.point, radius * 1.014)); slot.caption.position.copy(slot.target.anchor);
            slot.target.name = `Projected chart house ${region.house} · ${region.system}`;
            updateMetadata(slot.target, { system: region.system, house: region.house, instantMs: snapshot.instantMs });
          }
          for (const [index, boundary] of houseResult.boundaries.entries()) {
            const slot = boundaries[index]!;
            writeWideLine(slot.line.geometry, boundary.pickingLine.map(point => ({ x: point.x * radius * 1.005, y: point.y * radius * 1.005, z: point.z * radius * 1.005 })));
            slot.target.anchor.copy(local(boundary.anchor.point, radius * 1.014));
            updateMetadata(slot.target, { system: boundary.system, house: boundary.house, longitudeDeg: boundary.longitudeDeg, instantMs: snapshot.instantMs });
          }
        }
      } else if (!snapshot) { previousHouseKey = ''; houseResult = null; }
      const astroKey = snapshot ? JSON.stringify([snapshot.instantMs, snapshot.greenwichSiderealTimeDeg, snapshot.bodies.map(body => [body.id, body.equatorial])]) : '';
      if (snapshot && astroKey !== previousAstroKey) {
        previousAstroKey = astroKey;
        const result = buildAstrocartography(snapshot);
        for (const slot of curves) {
          slot.data = result.lines.find(line => line.id === slot.target.id) ?? null;
          slot.target.valid = slot.data?.status === 'valid';
          for (const [index, line] of slot.lines.entries()) {
            const segment = slot.data?.segments[index] ?? [];
            writeWideLine(line.geometry, segment.map(sample => ({ x: sample.point.x * radius * 1.006, y: sample.point.y * radius * 1.006, z: sample.point.z * radius * 1.006 })));
          }
          if (slot.data?.anchor) setLabel(slot.caption, slot.target, slot.data.anchor.point, false);
          updateMetadata(slot.target, { bodyId: slot.bodyId, angle: slot.angle, instantMs: snapshot.instantMs, convention: result.convention });
        }
      } else if (!snapshot) { previousAstroKey = ''; for (const slot of curves) { slot.target.valid = false; slot.data = null; } }
      const houseOpacity = THREE.MathUtils.clamp(settings.houseOpacity, 0, 1), astroOpacity = THREE.MathUtils.clamp(settings.astroOpacity, 0, 1);
      const linkedSelection=primaryHouseLink(interaction.selectedId),linkedHover=primaryHouseLink(interaction.hoveredId);
      group.userData.highlightedHouse=linkedSelection?.skyHouseId??null;
      for (const slot of regions) {
        slot.target.valid = houseResult?.status === 'valid';
        const selected = linkedSelection?.earthHouseId === slot.target.id, hovered = linkedHover?.earthHouseId === slot.target.id;
        const active = group.visible && houses.visible && slot.target.valid;
        slot.surface.visible = active; slot.surface.material.opacity = Math.min(1, houseOpacity * (selected ? 2.4 : hovered ? 1.9 : 1));
        slot.surface.material.color.setHex(selected ? 0xd6b56c : hovered ? 0x8dc7c7 : slot.target.id.endsWith(':1') ? 0x759faf : Number(slot.target.id.split(':').at(-1)) % 2 ? 0x647e9b : 0x618d9a);
        slot.caption.visible = slot.caption.userData.labelEnabled = active;
        slot.caption.userData.earthLabelActive = active;
        slot.caption.userData.labelPriority = selected ? 100 : hovered ? 90 : 35;
        if (active) hitTargets.push(...slot.target.objects);
      }
      for (const slot of boundaries) {
        slot.target.valid = houseResult?.status === 'valid';
        const active = group.visible && houses.visible && slot.target.valid, emphasized = linkedSelection?.earthBoundaryId === slot.target.id || linkedHover?.earthBoundaryId === slot.target.id;
        slot.line.visible = active; slot.line.material.opacity = emphasized ? 0.95 : Math.min(0.8, 0.3 + houseOpacity); slot.line.material.linewidth = emphasized ? 2.2 : 1.1;
        if (active) hitTargets.push(slot.line);
      }
      for (const slot of curves) {
        const selected = interaction.selectedId === slot.target.id, hovered = interaction.hoveredId === slot.target.id;
        const active = group.visible && astro.visible && slot.target.valid && settings.bodies[slot.bodyId] && settings.angles[slot.angle];
        const quiet = !!interaction.selectedId?.startsWith('astro:') && !selected && !hovered;
        for (const line of slot.lines) {
          line.visible = active && line.geometry.instanceCount > 0;
          line.material.opacity = selected || hovered ? 1 : astroOpacity * (quiet ? 0.22 : 1);
          line.material.linewidth = selected ? 2.8 : hovered ? 2.1 : 1.1;
          if (line.visible) hitTargets.push(line);
        }
        slot.caption.visible = slot.caption.userData.labelEnabled = active && (!quiet || hovered);
        slot.caption.userData.earthLabelActive = slot.caption.visible;
        slot.caption.userData.labelPriority = selected ? 100 : hovered ? 90 : 40;
        if (slot.caption.visible) hitTargets.push(slot.caption);
      }
    },
    resize(nextWidth, nextHeight) { if (disposed) return; width = Math.max(1, nextWidth); height = Math.max(1, nextHeight); for (const line of allLines) line.material.resolution.set(width, height); },
    faceCamera(camera) {
      if (disposed) return;
      lastCamera = camera; refreshCameraLocal();
      for (const target of entities) if (target.label) {
        const front = target.anchor.dot(cameraLocal.clone().sub(target.anchor)) > 0;
        target.label.visible = Boolean(target.label.userData.earthLabelActive) && front;
        target.label.userData.labelEnabled = target.label.visible;
      }
    },
    isSurfaceHitVisible(worldPoint) { refreshCameraLocal(); const point = group.worldToLocal(worldPoint.clone()); return !disposed && point.dot(cameraLocal.clone().sub(point)) >= 0; },
    intersectHouse(ray,snapshot){
      if(disposed||!group.visible||!houses.visible||houseResult?.status!=='valid')return null;
      group.updateWorldMatrix(true,false);
      const localRay=ray.clone().applyMatrix4(group.matrixWorld.clone().invert());
      const point=localRay.intersectSphere(new THREE.Sphere(new THREE.Vector3(),radius*1.003),new THREE.Vector3());
      if(!point||point.dot(localRay.origin.clone().sub(point))<0)return null;
      const membership=classifyEarthHouse(snapshot,threeToAstronomical(point));
      if(membership.status!=='valid')return null;
      const surface=regions[membership.house-1]!.surface;
      if(!surface.visible)return null;
      const worldPoint=group.localToWorld(point);
      return {object:surface,point:worldPoint,distance:ray.origin.distanceTo(worldPoint)};
    },
    dispose() {
      if (disposed) return; disposed = true; hitTargets = []; group.visible = false;
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      group.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) { if (material instanceof THREE.SpriteMaterial) material.map?.dispose(); material.dispose(); }
      group.removeFromParent(); group.clear();
    },
  };
}
