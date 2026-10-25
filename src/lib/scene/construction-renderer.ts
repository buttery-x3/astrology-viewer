import * as THREE from 'three';
import { astronomicalToThree, type Vector3 } from '../astronomy/coordinates';
import type { EphemerisSnapshot } from '../astronomy/ephemeris';
import { buildHouseConstruction, type ConstructionSettings, type HouseConstruction } from '../domain/house-construction';
import { eclipticDirection } from '../domain/sky-reference';
import { CONSTRUCTION_STYLE, type ConstructionKind } from './construction-style';
import { writeAstronomicalLine } from './line-buffer';

type CaptionFactory = (text: string, color: string, size: number) => THREE.Sprite;
interface LineSlot { line: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>; caption: THREE.Sprite }
interface MarkerSlot { marker: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>; caption: THREE.Sprite }
export interface ConstructionRenderer {
  group: THREE.Group;
  hitTargets: THREE.Object3D[];
  readonly result: HouseConstruction | null;
  readonly focusAnchor: THREE.Vector3 | null;
  update(snapshot: EphemerisSnapshot | null, settings: ConstructionSettings, interaction: { visible: boolean; hoveredGuideId: string | null }): void;
}

function point(value: Vector3, radius: number): THREE.Vector3 {
  const converted = astronomicalToThree(value);
  return new THREE.Vector3(converted.x, converted.y, converted.z).multiplyScalar(radius);
}
function offsetCaption(target: THREE.Sprite, direction: Vector3, radius: number): void {
  const normal = point(direction, 1);
  const up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  up.addScaledVector(normal, -up.dot(normal)).normalize();
  target.position.copy(normal).multiplyScalar(radius).addScaledVector(up, 0.18);
}

/** Only validated construction output enters the scene; this layer never creates wedges. */
export function createConstructionRenderer(radius: number, captionFactory: CaptionFactory): ConstructionRenderer {
  const group = new THREE.Group(); group.name = 'Validated house construction';
  const hitTargets: THREE.Object3D[] = [];
  const lines: LineSlot[] = [], markers: MarkerSlot[] = [];
  const markerGeometry = new THREE.OctahedronGeometry(1);
  let result: HouseConstruction | null = null;
  let appliedResult: HouseConstruction | null = null;
  let focusAnchor: THREE.Vector3 | null = null;
  let previousSnapshot: EphemerisSnapshot | null = null;
  let previousHouse = -1, previousProgress = -1;
  const guideRadius = radius * 1.008;

  function caption(text: string, color: string): THREE.Sprite {
    const target = captionFactory(text, color, 0.2);
    target.userData.constructionCaption = text;
    return target;
  }
  function updateCaption(target: THREE.Sprite, source: string, color: string): void {
    const text = source.length > 16 ? `${source.slice(0, 15)}…` : source;
    const key = `${text}:${color}`;
    if (target.userData.constructionCaption === key) return;
    const replacement = captionFactory(text, color, 0.2);
    target.material.map?.dispose();
    target.material.map = replacement.material.map;
    replacement.material.map = null; replacement.material.dispose();
    target.material.needsUpdate = true;
    target.scale.copy(replacement.scale);
    for (const field of ['baseHeight', 'textFraction', 'minimumTextPixels']) target.userData[field] = replacement.userData[field];
    target.userData.constructionCaption = key;
  }
  function lineSlot(index: number): LineSlot {
    if (!lines[index]) {
      const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ transparent: true, depthWrite: false }));
      line.scale.setScalar(guideRadius); line.renderOrder = 3;
      const label = caption('', '#80aec9');
      lines.push({ line, caption: label }); group.add(line, label); hitTargets.push(line, label);
    }
    return lines[index]!;
  }
  function markerSlot(index: number): MarkerSlot {
    if (!markers[index]) {
      const marker = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const label = caption('', '#80aec9');
      markers.push({ marker, caption: label }); group.add(marker, label); hitTargets.push(marker, label);
    }
    return markers[index]!;
  }
  function identify(object: THREE.Object3D, id: string, label: string, kind: ConstructionKind): void {
    object.userData.entityId = `boundary:${result!.house}`;
    object.userData.entityKind = 'boundary';
    object.userData.constructionId = id;
    object.userData.hoverName = `${label} · ${result!.name}`;
    object.userData.constructionKind = kind;
    object.userData.labelPriority = kind === 'intersection' ? 28 : kind === 'timing' ? 22 : 18;
    object.name = id;
  }
  function hideSlot(slot: LineSlot | MarkerSlot): void {
    if ('line' in slot) slot.line.visible = false;
    else slot.marker.visible = false;
    slot.caption.visible = false; slot.caption.userData.labelEnabled = false;
  }
  return {
    group, hitTargets,
    get result() { return result; },
    get focusAnchor() { return focusAnchor; },
    update(snapshot, settings, interaction) {
      if (!settings.enabled || !snapshot || !snapshot.houses[0]) {
        group.visible = false; focusAnchor = null;
        // Suppress captions explicitly: the global label manager examines all sprites.
        for (const slot of [...lines, ...markers]) hideSlot(slot);
        return;
      }
      const rebuild = snapshot !== previousSnapshot || settings.boundaryHouse !== previousHouse || settings.progress !== previousProgress;
      if (rebuild) {
        previousSnapshot = snapshot; previousHouse = settings.boundaryHouse; previousProgress = settings.progress;
        result = buildHouseConstruction(snapshot, snapshot.houses[0], settings);
      }
      group.visible = interaction.visible && result?.status === 'valid';
      group.userData.status = result?.status ?? 'undefined';
      group.userData.system = result?.system;
      group.userData.house = result?.house;
      group.userData.stage = settings.stage;
      group.userData.progress = settings.progress;
      if (!group.visible || !result || result.status !== 'valid') {
        focusAnchor = null; for (const slot of [...lines, ...markers]) hideSlot(slot); return;
      }
      focusAnchor = result.computedCuspDeg !== null ? point(eclipticDirection(snapshot, result.computedCuspDeg), guideRadius) : null;
      const geometryChanged = result !== appliedResult;
      for (const [index, source] of result.lines.entries()) {
        const slot = lineSlot(index), style = CONSTRUCTION_STYLE[source.kind];
        const enabled = source.stage <= settings.stage;
        if (geometryChanged || slot.line.geometry.getAttribute('position') === undefined) {
          const points = source.closed && source.points.length ? [...source.points, source.points[0]!] : source.points;
          writeAstronomicalLine(slot.line, points);
        }
        slot.line.material.color.set(style.color); slot.line.material.opacity = interaction.hoveredGuideId === source.id ? 1 : style.opacity;
        slot.line.material.dashSize = style.dashSize; slot.line.material.gapSize = style.gapSize;
        slot.line.visible = enabled;
        updateCaption(slot.caption, source.label ?? '', style.color);
        const anchor = source.points[Math.floor(source.points.length / 2)];
        if (anchor) offsetCaption(slot.caption, anchor, guideRadius);
        slot.caption.userData.labelEnabled = enabled && !!source.label;
        slot.caption.visible = slot.caption.userData.labelEnabled;
        identify(slot.line, source.id, source.label ?? source.kind, source.kind);
        identify(slot.caption, source.id, source.label ?? source.kind, source.kind);
      }
      for (let index = result.lines.length; index < lines.length; index++) hideSlot(lines[index]!);
      for (const [index, source] of result.markers.entries()) {
        const slot = markerSlot(index), style = CONSTRUCTION_STYLE[source.kind];
        const enabled = source.stage <= settings.stage, hovered = interaction.hoveredGuideId === source.id;
        slot.marker.visible = enabled;
        slot.marker.position.copy(point(source.point, guideRadius));
        slot.marker.scale.setScalar((source.kind === 'intersection' ? 0.068 : source.id.endsWith(':sweep') ? 0.057 : 0.035) * (hovered ? 1.35 : 1));
        slot.marker.material.color.set(hovered ? '#ffffff' : style.color);
        updateCaption(slot.caption, source.label, style.color); offsetCaption(slot.caption, source.point, guideRadius);
        slot.caption.userData.labelEnabled = enabled;
        slot.caption.visible = enabled;
        identify(slot.marker, source.id, source.label, source.kind);
        identify(slot.caption, source.id, source.label, source.kind);
        slot.marker.userData.constructionIntersection = source.id.endsWith(':intersection');
      }
      for (let index = result.markers.length; index < markers.length; index++) hideSlot(markers[index]!);
      appliedResult = result;
    },
  };
}
