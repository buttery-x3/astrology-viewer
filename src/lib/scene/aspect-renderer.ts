import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { astronomicalToThree, equatorialToVector, signedAngularDifferenceDegrees, type Vector3 } from '../astronomy/coordinates';
import type { EphemerisSnapshot } from '../astronomy/ephemeris';
import { getAspectDetails, getVisibleAspects, type AspectDisplaySettings } from '../domain/aspect-presentation';
import { eclipticDirection } from '../domain/sky-reference';
import { featureHit } from '../domain/scene-hit';
import { ASPECT_STYLE } from './aspect-style';
import { buildAspectCurve } from './aspect-curve';
import { createWideLineGeometry, writeWideLine } from './wide-line-buffer';

type CaptionFactory = (text: string, color: string, size: number) => THREE.Sprite;
export interface AspectSceneEntity {
  id: string; name: string; kind: 'aspect'; objects: THREE.Object3D[];
  anchor: THREE.Vector3; valid: boolean; lines: THREE.Line[];
  label: THREE.Sprite; focusRadius: number;
}
interface AspectSlot {
  group: THREE.Group; core: Line2; glow: Line2; caption: THREE.Sprite;
  endpoints: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[];
  entity: AspectSceneEntity; previousSnapshot: EphemerisSnapshot | null; previousId: string;
}
export interface AspectRenderer {
  group: THREE.Group;
  readonly entities: AspectSceneEntity[];
  update(snapshot: EphemerisSnapshot | null, settings: AspectDisplaySettings, interaction: { visible: boolean; selectedId: string | null; hoveredId: string | null }): void;
  resize(width: number, height: number): void;
  faceCamera(quaternion: THREE.Quaternion): void;
}
function point(value: Vector3, radius = 1): THREE.Vector3 {
  const converted = astronomicalToThree(value);
  return new THREE.Vector3(converted.x, converted.y, converted.z).multiplyScalar(radius);
}
const bodyName = (id: string) => id[0]!.toUpperCase() + id.slice(1);

/** Keep a subtarget's meaning separate from the pooled aspect that owns it. */
function identify(object: THREE.Object3D, id: string, name: string, role: string): void {
  object.userData.hoverName = name;
  object.userData.featureHit = featureHit(id, name, { representation: 'sky', role });
}

export function createAspectRenderer(radius: number, captionFactory: CaptionFactory): AspectRenderer {
  const group = new THREE.Group(); group.name = 'Longitude aspects';
  const slots: AspectSlot[] = [];
  let entities: AspectSceneEntity[] = [];
  let width = 1, height = 1;
  const endpointGeometry = new THREE.RingGeometry(0.095, 0.112, 40);
  const anchorGeometry = new THREE.OctahedronGeometry(0.045);
  const measurementGroup = new THREE.Group(); measurementGroup.name = 'Selected longitude measurement';
  const measurement = new Line2(createWideLineGeometry(128, radius * 1.12), new LineMaterial({ color: 0xf1db9f, linewidth: 2.5, transparent: true, opacity: 0.92, depthWrite: false }));
  measurement.name = 'Longitude separation arc';
  measurement.userData.wideLine = true; measurement.renderOrder = 4;
  measurementGroup.add(measurement); group.add(measurementGroup);
  const anchors = [0, 1].map(() => {
    const marker = new THREE.Mesh(anchorGeometry, new THREE.MeshBasicMaterial({ color: 0xf1db9f }));
    marker.userData.aspectEndpoint = true; marker.renderOrder = 4;
    const caption = captionFactory('', '#f1db9f', 0.2);
    const leader = new Line2(createWideLineGeometry(4, radius * 1.12), new LineMaterial({ color: 0xf1db9f, linewidth: 1, transparent: true, opacity: 0.45, depthWrite: false }));
    leader.userData.wideLine = true; leader.renderOrder = 4;
    leader.name = 'Longitude caption leader';
    const projection = new Line2(createWideLineGeometry(64, radius * 1.12), new LineMaterial({ color: 0xf1db9f, linewidth: 1.4, transparent: true, opacity: 0.7, depthWrite: false, dashed: true, dashSize: 0.1, gapSize: 0.07 }));
    projection.userData.wideLine = true; projection.renderOrder = 4;
    projection.name = 'Body latitude projection';
    measurementGroup.add(marker, caption, leader, projection); return { marker, caption, leader, projection };
  });

  function label(target: THREE.Sprite, text: string, color: string): void {
    const key = `${text}:${color}`;
    if (target.userData.aspectCaption === key) return;
    const replacement = captionFactory(text, color, 0.24);
    target.material.map?.dispose(); target.material.map = replacement.material.map;
    replacement.material.map = null; replacement.material.dispose(); target.material.needsUpdate = true;
    target.scale.copy(replacement.scale);
    for (const field of ['baseHeight', 'textFraction', 'minimumTextPixels']) target.userData[field] = replacement.userData[field];
    target.userData.aspectCaption = key;
  }
  function slot(index: number): AspectSlot {
    if (!slots[index]) {
      const geometry = createWideLineGeometry(64, radius * 1.12);
      const core = new Line2(geometry, new LineMaterial({ transparent: true, depthWrite: false, linewidth: 1.4 }));
      const glow = new Line2(geometry, new LineMaterial({ transparent: true, depthWrite: false, linewidth: 6 }));
      core.userData.wideLine = true; core.renderOrder = 4;
      glow.userData.pickable = false; glow.renderOrder = 3;
      const caption = captionFactory('', '#ffffff', 0.24);
      const endpoints = [0, 1].map(() => {
        const proxy = new THREE.Mesh(endpointGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
        proxy.userData.aspectEndpoint = true;
        // These outlined selection indicators remain available over an opaque Earth.
        // Actual body meshes continue to use ordinary depth testing.
        proxy.userData.ignoreEarthOcclusion = true; proxy.renderOrder = 6; return proxy;
      });
      const local = new THREE.Group(); local.add(core, glow, caption, ...endpoints); group.add(local);
      const entity: AspectSceneEntity = { id: '', name: '', kind: 'aspect', objects: [], anchor: new THREE.Vector3(), valid: false, lines: [], label: caption, focusRadius: 1 };
      slots.push({ group: local, core, glow, caption, endpoints, entity, previousSnapshot: null, previousId: '' });
    }
    return slots[index]!;
  }
  function resolution(): void {
    for (const target of [measurement, ...anchors.flatMap(anchor => [anchor.leader, anchor.projection]), ...slots.flatMap(target => [target.core, target.glow])]) target.material.resolution.set(width, height);
  }
  return {
    group,
    get entities() { return entities; },
    resize(nextWidth, nextHeight) { width = Math.max(1, nextWidth); height = Math.max(1, nextHeight); resolution(); },
    faceCamera(quaternion) { for (const target of slots) for (const endpoint of target.endpoints) endpoint.quaternion.copy(quaternion); },
    update(snapshot, settings, interaction) {
      group.visible = settings.enabled && interaction.visible && snapshot !== null;
      measurementGroup.visible = false;
      for (const anchor of anchors) anchor.caption.userData.labelEnabled = anchor.caption.visible = false;
      let visible = snapshot ? getVisibleAspects(snapshot.bodies, settings, interaction.selectedId) : [];
      const selected = snapshot && interaction.selectedId ? getAspectDetails(snapshot.bodies, interaction.selectedId, settings.orbs) : null;
      if (selected) visible = visible.filter(aspect => aspect.id === selected.id);
      entities = [];
      for (const [index, aspect] of visible.entries()) {
        const target = slot(index), style = ASPECT_STYLE[aspect.type];
        const first = snapshot!.bodies.find(body => body.id === aspect.bodyA)!, second = snapshot!.bodies.find(body => body.id === aspect.bodyB)!;
        const isSelected = interaction.selectedId === aspect.id, hovered = interaction.hoveredId === aspect.id;
        const bodySelected = interaction.selectedId?.startsWith('body:');
        const related = interaction.selectedId === `body:${aspect.bodyA}` || interaction.selectedId === `body:${aspect.bodyB}`;
        const emphasis = isSelected ? 1 : hovered ? 0.95 : related ? 0.85 : THREE.MathUtils.clamp(settings.backgroundOpacity, 0, 1) * (bodySelected ? 0.5 : 1);
        // Brightness always encodes longitude closeness; width and endpoint rings
        // additionally identify selection without changing the underlying value.
        const alpha = emphasis * (0.8 + 0.2 * THREE.MathUtils.clamp(aspect.closeness, 0, 1));
        target.group.visible = true; target.entity.valid = true;
        target.entity.id = aspect.id; target.entity.name = `${bodyName(aspect.bodyA)} — ${bodyName(aspect.bodyB)} · ${aspect.type}`;
        target.entity.objects = [target.core, target.caption, ...target.endpoints];
        identify(target.core, aspect.id, target.entity.name, 'Longitude aspect strand');
        identify(target.caption, aspect.id, target.entity.name, 'Aspect symbol caption');
        if (target.previousSnapshot !== snapshot || target.previousId !== aspect.id) {
          const curve = buildAspectCurve(equatorialToVector(first.fixedEquatorial), equatorialToVector(second.fixedEquatorial), aspect.type, radius);
          writeWideLine(target.core.geometry, curve.points);
          target.entity.anchor.copy(point(curve.anchor)); target.entity.focusRadius = curve.focusRadius;
          target.caption.position.copy(target.entity.anchor);
          target.endpoints[0]!.position.copy(point(equatorialToVector(first.fixedEquatorial), radius));
          target.endpoints[1]!.position.copy(point(equatorialToVector(second.fixedEquatorial), radius));
          target.previousSnapshot = snapshot; target.previousId = aspect.id;
        }
        for (const line of [target.core, target.glow]) {
          line.material.color.set(style.color); line.material.dashed = style.dashed;
          line.material.dashSize = style.dashSize; line.material.gapSize = style.gapSize;
        }
        target.core.material.opacity = alpha; target.core.material.linewidth = isSelected ? 2.8 : hovered || related ? 2.2 : 1.7;
        target.glow.visible = settings.glow; target.glow.material.opacity = alpha * 0.13;
        target.glow.material.linewidth = isSelected ? 9 : hovered || related ? 7 : 5;
        label(target.caption, style.glyph, style.color);
        target.caption.userData.labelEnabled = group.visible && (isSelected || hovered || related);
        target.caption.visible = target.caption.userData.labelEnabled;
        for (const [endpointIndex, endpoint] of target.endpoints.entries()) {
          endpoint.visible = isSelected;
          endpoint.material.color.set(style.color);
          const endpointBody = endpointIndex ? aspect.bodyB : aspect.bodyA;
          identify(endpoint, `body:${endpointBody}`, `${bodyName(endpointBody)} endpoint · selected aspect indicator`, 'Body endpoint · selected aspect indicator');
        }
        if (isSelected && settings.measurement) {
          measurementGroup.visible = group.visible;
          identify(measurement, aspect.id, `${target.entity.name} · measured longitude separation`, 'Measured shortest ecliptic-longitude separation arc');
          const delta = signedAngularDifferenceDegrees(first.longitudeDeg, second.longitudeDeg);
          const count = Math.max(1, Math.ceil(Math.abs(delta) / 2));
          const points = Array.from({ length: count + 1 }, (_, step) => {
            const direction = eclipticDirection(snapshot!, first.longitudeDeg + delta * step / count);
            return { x: direction.x * radius * 1.004, y: direction.y * radius * 1.004, z: direction.z * radius * 1.004 };
          });
          measurement.visible = Math.abs(delta) > 1e-8;
          if (measurement.visible) writeWideLine(measurement.geometry, points);
          for (const [anchorIndex, anchor] of anchors.entries()) {
            const body = anchorIndex ? second : first;
            const direction = eclipticDirection(snapshot!, body.longitudeDeg);
            const labelDirection = eclipticDirection(snapshot!, body.longitudeDeg, anchorIndex ? -4 : 4);
            anchor.marker.position.copy(point(direction, radius * 1.004));
            anchor.caption.position.copy(point(labelDirection, radius * 1.014));
            label(anchor.caption, Math.abs(delta) <= 1e-8 ? `λ ${bodyName(first.id)} = ${bodyName(second.id)}` : `λ ${bodyName(body.id)}`, '#f1db9f');
            const enabled = group.visible && (anchorIndex === 0 || Math.abs(delta) > 1e-8);
            anchor.marker.visible = enabled; anchor.caption.visible = anchor.caption.userData.labelEnabled = enabled;
            anchor.caption.userData.labelPriority = 24;
            identify(anchor.marker, `body:${body.id}`, `${bodyName(body.id)} · ecliptic longitude anchor`, 'Ecliptic longitude anchor · actual body latitude is retained');
            identify(anchor.caption, `body:${body.id}`, `${bodyName(body.id)} · longitude anchor caption`, 'Ecliptic longitude anchor caption');
            identify(anchor.leader, `body:${body.id}`, `${bodyName(body.id)} · longitude caption leader`, 'Caption leader · connects the label to its ecliptic longitude anchor');
            const a = anchor.marker.position, b = anchor.caption.position;
            writeWideLine(anchor.leader.geometry, [{ x: a.x, y: -a.z, z: a.y }, { x: b.x, y: -b.z, z: b.y }]);
            anchor.leader.visible = enabled;
            const projectionCount = Math.max(1, Math.ceil(Math.abs(body.latitudeDeg) / 2));
            const projectionPoints = Array.from({ length: projectionCount + 1 }, (_, step) => {
              const fraction = step / projectionCount;
              const projected = eclipticDirection(snapshot!, body.longitudeDeg, body.latitudeDeg * (1 - fraction));
              const displayRadius = radius * (1 + 0.004 * fraction);
              return { x: projected.x * displayRadius, y: projected.y * displayRadius, z: projected.z * displayRadius };
            });
            // Keep the start attached to the actual body, retaining its latitude.
            const actual = equatorialToVector(body.fixedEquatorial);
            projectionPoints[0] = { x: actual.x * radius, y: actual.y * radius, z: actual.z * radius };
            writeWideLine(anchor.projection.geometry, projectionPoints);
            anchor.projection.visible = group.visible && Math.abs(body.latitudeDeg) > 1e-8;
            identify(anchor.projection, `body:${body.id}`, `${bodyName(body.id)} · latitude projection to the ecliptic`, 'Latitude projection · actual body position to its ecliptic longitude');
          }
          target.entity.objects.push(measurement, ...anchors.flatMap(anchor => [anchor.marker, anchor.caption, anchor.leader, anchor.projection]));
        }
        target.core.name = aspect.id; target.group.name = aspect.id; target.caption.userData.labelPriority = 23;
        entities.push(target.entity);
      }
      for (let index = visible.length; index < slots.length; index++) {
        const target = slots[index]!; target.group.visible = false; target.entity.valid = false;
        target.caption.userData.labelEnabled = target.caption.visible = false;
      }
      group.userData.activeCount = entities.length;
      group.userData.slotCount = slots.length;
      group.userData.selectedOutsideOrb = selected !== null && !selected.withinOrb;
      resolution();
    },
  };
}
