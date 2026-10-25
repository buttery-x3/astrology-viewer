import * as THREE from 'three';
import { astronomicalToThree, type Vector3 } from '../astronomy/coordinates';
import type { EphemerisSnapshot } from '../astronomy/ephemeris';
import { classifyLongitude } from '../domain/chart';
import { buildHouseGeometry, compareHouseAssignments, type HouseAssignmentComparison, type HouseDisplaySettings, type HouseGeometry, type HouseMesh } from '../domain/house-geometry';
import { eclipticDirection } from '../domain/sky-reference';
import { writeAstronomicalLine as writeLine } from './line-buffer';

export interface HouseSceneEntity {
  id: string; name: string; kind: 'house' | 'boundary';
  objects: THREE.Object3D[]; anchor: THREE.Vector3; valid: boolean;
  lines: THREE.Line[]; label: THREE.Sprite;
}
export interface HouseRenderer {
  group: THREE.Group;
  entities: HouseSceneEntity[];
  update(snapshot: EphemerisSnapshot | null, settings: HouseDisplaySettings, interaction: { selectedId: string | null; hoveredId: string | null; visible: boolean; quietComparison?: boolean }): void;
}
type CaptionFactory = (text: string, color: string, size: number) => THREE.Sprite;
type Fill = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

const PRIMARY = 0x85acc3;
const SELECTED = 0xf1d79d;
const HOVERED = 0xb2e5e5;
const GHOST = 0xb0a4d7;
const STEPS = { longitudeStepDeg: 4, latitudeStepDeg: 5 };
const capacity = (length: number) => 2 ** Math.ceil(Math.log2(Math.max(4, length)));
function point(value: Vector3): THREE.Vector3 {
  const converted = astronomicalToThree(value);
  return new THREE.Vector3(converted.x, converted.y, converted.z);
}

/** Grow only when necessary; ordinary chart/mode updates retain objects and buffers. */
function writeMesh(target: Fill, source: HouseMesh): void {
  let positions = target.geometry.getAttribute('position');
  let indices = target.geometry.getIndex();
  if (!positions || positions.count < source.positions.length || !indices || indices.count < source.indices.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(capacity(source.positions.length) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(capacity(source.indices.length)), 1).setUsage(THREE.DynamicDrawUsage));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.001);
    target.geometry.dispose(); target.geometry = geometry;
    positions = geometry.getAttribute('position'); indices = geometry.getIndex();
  }
  for (const [index, value] of source.positions.entries()) {
    const converted = astronomicalToThree(value);
    positions.setXYZ(index, converted.x, converted.y, converted.z);
  }
  (indices!.array as Uint32Array).set(source.indices);
  positions.needsUpdate = indices!.needsUpdate = true;
  target.geometry.setDrawRange(0, source.indices.length);
}
function fill(color: number): Fill {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, side: THREE.DoubleSide,
    depthWrite: false, forceSinglePass: true,
  }));
  mesh.renderOrder = 1; return mesh;
}
function curve(color: number, dashed = false): THREE.Line {
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.58, dashSize: 0.018, gapSize: 0.012, depthWrite: false })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false });
  const target = new THREE.Line(new THREE.BufferGeometry(), material);
  target.renderOrder = 2; return target;
}
function styleLine(target: THREE.Line, color: number, opacity: number): void {
  const material = target.material as THREE.LineBasicMaterial;
  material.color.setHex(color); material.opacity = opacity;
}
function panelOutline(snapshot: EphemerisSnapshot, start: number, width: number, direction: number): Vector3[] {
  const values: Vector3[] = [];
  const end = start + width * direction;
  for (let i = 0; i <= 36; i++) values.push(eclipticDirection(snapshot, start, -88 + i * 176 / 36));
  for (let i = 1; i <= 18; i++) values.push(eclipticDirection(snapshot, start + width * direction * i / 18, 88));
  for (let i = 1; i <= 36; i++) values.push(eclipticDirection(snapshot, end, 88 - i * 176 / 36));
  for (let i = 1; i <= 18; i++) values.push(eclipticDirection(snapshot, end - width * direction * i / 18, -88));
  return values;
}

export function createHouseRenderer(radius: number, caption: CaptionFactory): HouseRenderer {
  const group = new THREE.Group();
  group.name = 'Longitude-based house display';
  const primary = new THREE.Group(), secondary = new THREE.Group();
  primary.name = 'Primary houses'; secondary.name = 'Comparison houses';
  group.add(primary, secondary);
  const entities: HouseSceneEntity[] = [];
  const regions = Array.from({ length: 12 }, (_, index) => {
    const surface = fill(index % 2 ? 0x647e9b : 0x618d9a);
    const volume = fill(index % 2 ? 0x647e9b : 0x618d9a);
    surface.name = `House ${index + 1} outer surface`; volume.name = `House ${index + 1} radial volume`;
    volume.userData.pickable = false;
    const outline = curve(PRIMARY);
    const original = curve(PRIMARY, true); original.userData.pickable = false;
    const guides = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: SELECTED, transparent: true, opacity: 0.7, dashSize: 0.06, gapSize: 0.04, depthWrite: false }));
    guides.userData.pickable = false; guides.renderOrder = 2;
    guides.name = `House ${index + 1} shell return guides`;
    original.name = `House ${index + 1} original outline`;
    const label = caption(`H${index + 1}`, '#b0ccdb', 0.23);
    label.userData.labelPriority = 14;
    primary.add(surface, volume, outline, original, guides, label);
    const entity: HouseSceneEntity = { id: `house:${index + 1}`, name: `House ${index + 1}`, kind: 'house', objects: [surface, label, outline], anchor: new THREE.Vector3(), valid: false, lines: [outline], label };
    entities.push(entity);
    return { surface, volume, outline, original, guides, label, entity, originalLabel: new THREE.Vector3() };
  });
  const boundaries = Array.from({ length: 12 }, (_, index) => {
    const line = curve(PRIMARY); line.userData.pickable = false;
    const picking = curve(PRIMARY); (picking.material as THREE.Material).visible = false;
    const label = caption(`C${index + 1}`, '#a8c7d6', 0.19);
    label.userData.labelPriority = 16;
    primary.add(line, picking, label);
    const entity: HouseSceneEntity = { id: `boundary:${index + 1}`, name: `Boundary ${index + 1}`, kind: 'boundary', objects: [picking, label], anchor: new THREE.Vector3(), valid: false, lines: [line], label };
    entities.push(entity); return { line, picking, label, entity };
  });
  const ghosts = Array.from({ length: 12 }, (_, index) => { const target = curve(GHOST, true); target.name = `Comparison boundary ${index + 1}`; secondary.add(target); return target; });
  const changed = fill(GHOST); secondary.add(changed); changed.renderOrder = 1;
  let previousSnapshot: EphemerisSnapshot | null = null;
  let geometry: HouseGeometry | null = null, comparisonGeometry: HouseGeometry | null = null;
  let comparison: HouseAssignmentComparison | null = null;

  function updateGeometry(snapshot: EphemerisSnapshot): void {
    const first = snapshot.houses[0], second = snapshot.houses[1];
    geometry = first ? buildHouseGeometry(snapshot, first, STEPS) : null;
    comparisonGeometry = second ? buildHouseGeometry(snapshot, second, STEPS) : null;
    comparison = first && second ? compareHouseAssignments(snapshot.bodies, first, second) : null;
    for (const entity of entities) entity.valid = geometry?.status === 'valid';
    if (geometry?.status === 'valid') {
      for (const [index, region] of geometry.regions.entries()) {
        const target = regions[index]!;
        writeMesh(target.surface, region.surface); writeMesh(target.volume, region.volume);
        const outline = panelOutline(snapshot, region.startDeg, region.widthDeg, region.direction);
        writeLine(target.outline, outline); writeLine(target.original, outline);
        target.originalLabel.copy(point(eclipticDirection(snapshot, region.midpointLongitudeDeg, -11))).multiplyScalar(radius * 1.014);
        target.entity.name = `House ${region.house} · ${geometry.system}`;
      }
      for (const [index, boundary] of geometry.boundaries.entries()) {
        const target = boundaries[index]!;
        writeLine(target.line, boundary.line); writeLine(target.picking, boundary.pickingLine);
        target.line.scale.setScalar(radius * 1.003); target.picking.scale.copy(target.line.scale);
        target.entity.anchor.copy(point(eclipticDirection(snapshot, boundary.longitudeDeg, 12))).multiplyScalar(radius * 1.014);
        target.label.position.copy(target.entity.anchor);
        target.entity.name = `Boundary ${boundary.house} · ${boundary.longitudeDeg.toFixed(2)}° · ${geometry.system}`;
      }
    }
    if (comparisonGeometry?.status === 'valid') {
      for (const [index, boundary] of comparisonGeometry.boundaries.entries()) {
        writeLine(ghosts[index]!, boundary.line); ghosts[index]!.scale.setScalar(radius * 1.009);
      }
    }
    const ribbon: HouseMesh = { positions: [], indices: [] };
    for (const region of comparison?.changedRegions ?? []) {
      const count = Math.max(1, Math.ceil(region.widthDeg / 2));
      const offset = ribbon.positions.length;
      for (let row = 0; row < 2; row++) for (let i = 0; i <= count; i++) ribbon.positions.push(eclipticDirection(snapshot, region.startDeg + region.widthDeg * i / count, row ? 7 : -7));
      for (let i = 0; i < count; i++) {
        const a = offset + i, b = a + 1, c = a + count + 1, d = c + 1;
        ribbon.indices.push(a, b, c, b, d, c);
      }
    }
    writeMesh(changed, ribbon); changed.scale.setScalar(radius * 1.011);
  }

  return {
    group, entities,
    update(snapshot, settings, interaction) {
      if (snapshot !== previousSnapshot) {
        previousSnapshot = snapshot;
        if (snapshot) updateGeometry(snapshot);
        else { geometry = comparisonGeometry = null; comparison = null; for (const entity of entities) entity.valid = false; }
      }
      group.visible = interaction.visible && snapshot !== null;
      primary.visible = geometry?.status === 'valid';
      secondary.visible = comparisonGeometry?.status === 'valid' && (comparison?.status === 'valid' || !settings.comparisonChangesOnly);
      const selectedBody = snapshot?.bodies.find(body => `body:${body.id}` === interaction.selectedId);
      const assignment = selectedBody && snapshot?.houses[0] ? classifyLongitude(snapshot.houses[0], selectedBody.longitudeDeg) : null;
      const linkedHouse = assignment?.status === 'valid' ? `house:${assignment.house}` : null;
      const selectedHouse = interaction.selectedId?.startsWith('house:') ? interaction.selectedId : linkedHouse;
      const opacity = THREE.MathUtils.clamp(settings.opacity, 0, 1);
      for (const [index, target] of regions.entries()) {
        const selected = selectedHouse === target.entity.id, hovered = interaction.hoveredId === target.entity.id;
        const active = selected || hovered;
        const lift = settings.mode === 'shells' && selected ? THREE.MathUtils.clamp(settings.shellSeparation, 0, 0.2) : 0;
        target.surface.scale.setScalar(radius * (1.002 + lift)); target.volume.scale.setScalar(radius * 1.002);
        target.outline.scale.setScalar(radius * (1.003 + lift)); target.original.scale.setScalar(radius * 1.003);
        const showFill = settings.contextFill || active;
        const volume = showFill && (settings.mode === 'volumes' || settings.mode === 'arcs' && settings.hybrid && selected);
        target.volume.visible = volume && opacity > 0;
        target.volume.material.opacity = opacity * (active ? 0.6 : 0.065);
        target.surface.visible = true; // Also an invisible, outer-surface-only hit proxy.
        target.surface.material.visible = showFill && !volume && opacity > 0;
        target.surface.material.opacity = opacity * (active ? 0.65 : 0.09);
        target.surface.material.color.setHex(active ? selected ? SELECTED : HOVERED : index % 2 ? 0x647e9b : 0x618d9a);
        target.volume.material.color.copy(target.surface.material.color);
        target.outline.visible = settings.mode === 'shells' && active;
        styleLine(target.outline, selected ? SELECTED : HOVERED, 0.85);
        target.original.visible = lift > 0;
        target.guides.visible = lift > 0;
        target.label.userData.labelEnabled = group.visible && primary.visible;
        target.label.visible = target.label.userData.labelEnabled;
        target.entity.anchor.copy(target.originalLabel).multiplyScalar((1.014 + lift) / 1.014);
        target.label.position.copy(target.entity.anchor);
        if (lift > 0 && snapshot && geometry?.status === 'valid') {
          const region = geometry.regions[index]!;
          const values: Vector3[] = [];
          for (const lambda of [region.startDeg, region.startDeg + region.direction * region.widthDeg]) for (const beta of [-30, 30]) {
            const original = eclipticDirection(snapshot, lambda, beta);
            values.push({ x: original.x * radius * 1.003, y: original.y * radius * 1.003, z: original.z * radius * 1.003 }, { x: original.x * radius * (1.003 + lift), y: original.y * radius * (1.003 + lift), z: original.z * radius * (1.003 + lift) });
          }
          // Labels are lifted too; the leader ends at the actual undisplaced region.
          const before = target.originalLabel, after = target.entity.anchor;
          values.push({ x: before.x, y: -before.z, z: before.y }, { x: after.x, y: -after.z, z: after.y });
          writeLine(target.guides, values);
          target.guides.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.25);
        }
      }
      for (const target of boundaries) {
        const selected = interaction.selectedId === target.entity.id;
        const active = selected || interaction.hoveredId === target.entity.id;
        const start = Number(target.entity.id.slice(9));
        const adjacent = geometry?.status === 'valid' && selectedHouse && (selectedHouse === `house:${start}` || selectedHouse === `house:${start === 1 ? 12 : start - 1}`);
        styleLine(target.line, selected ? SELECTED : active || adjacent ? HOVERED : PRIMARY, active || adjacent ? 0.92 : 0.44);
        target.label.userData.labelEnabled = group.visible && primary.visible && active;
        target.label.visible = target.label.userData.labelEnabled;
        target.picking.visible = true;
      }
      for (const [index, ghost] of ghosts.entries()) {
        ghost.visible = !settings.comparisonChangesOnly || comparison?.changedBoundaryHouses.includes(index + 1) === true;
        (ghost.material as THREE.Material).opacity = interaction.quietComparison ? 0.18 : 0.58;
      }
      changed.visible = comparison?.status === 'valid' && comparison.changedRegions.length > 0 && opacity > 0;
      changed.material.opacity = opacity * (interaction.quietComparison ? 0.1 : 0.55);
      group.userData.primaryStatus = geometry?.status ?? 'undefined';
      group.userData.comparisonStatus = comparison?.status ?? 'absent';
      group.userData.mode = settings.mode;
      group.userData.highlightedHouse = selectedHouse;
    },
  };
}
