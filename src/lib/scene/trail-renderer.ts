import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { astronomicalToThree, type Vector3 } from '../astronomy/coordinates';
import type { EphemerisSnapshot } from '../astronomy/ephemeris';
import { projectTrail, TRAIL_VERSION_KEY, type TrailDisplaySettings, type TrailResult, type BoundaryHistorySettings, type BoundaryHistoryResult } from '../domain/trails';
import { createWideLineGeometry, writeWideLine } from './wide-line-buffer';
import { buildTimedTrailStrokes, type TrailStroke } from './trail-path';
import { TRAIL_PAST_OPACITIES, TRAIL_REFERENCE_LABELS } from './trail-style';

type CaptionFactory = (text: string, color: string, size: number) => THREE.Sprite;
export interface TrailRenderer {
  group: THREE.Group;
  readonly hitTargets: THREE.Object3D[];
  update(snapshot: EphemerisSnapshot | null, settings: TrailDisplaySettings, result: TrailResult | null, history: BoundaryHistorySettings, historyResult: BoundaryHistoryResult | null, interaction: { visible: boolean; selectedId: string | null }): void;
  resize(width: number, height: number): void;
}
const CAPACITY = 2000;
function position(value: Vector3, radius: number): THREE.Vector3 {
  const point = astronomicalToThree(value); return new THREE.Vector3(point.x, point.y, point.z).multiplyScalar(radius);
}
function sameObserver(a: { latitudeDeg: number; longitudeDeg: number }, b: { latitudeDeg: number; longitudeDeg: number }): boolean {
  return a.latitudeDeg === b.latitudeDeg && a.longitudeDeg === b.longitudeDeg;
}
function timeLabel(instantMs: number): string { return new Date(instantMs).toISOString().slice(0, 16).replace('T', ' ') + 'Z'; }
function writeStrokes(target: Line2, strokes: readonly TrailStroke[]): void {
  if (strokes.length > CAPACITY) throw new RangeError('Trail display exceeds the validated vertex budget.');
  const starts = target.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
  const distances = target.geometry.getAttribute('instanceDistanceStart') as THREE.InterleavedBufferAttribute;
  const values = starts.data.array as Float32Array, distanceValues = distances.data.array as Float32Array;
  for (const [index, stroke] of strokes.entries()) {
    const a = astronomicalToThree(stroke.start), b = astronomicalToThree(stroke.end);
    values.set([a.x, a.y, a.z, b.x, b.y, b.z], index * 6);
    distanceValues[index * 2] = stroke.distanceStart; distanceValues[index * 2 + 1] = stroke.distanceEnd;
  }
  starts.data.needsUpdate = distances.data.needsUpdate = true; target.geometry.instanceCount = strokes.length;
}

export function createTrailRenderer(radius: number, captionFactory: CaptionFactory): TrailRenderer {
  const group = new THREE.Group(); group.name = 'Selected trail and boundary history';
  const bodyGroup = new THREE.Group(); bodyGroup.name = 'Selected body trail'; group.add(bodyGroup);
  const historyGroup = new THREE.Group(); historyGroup.name = 'Selected boundary history'; group.add(historyGroup);
  const allLines: Line2[] = [];
  const captions: THREE.Sprite[] = [];
  let hitTargets: THREE.Object3D[] = [];
  let previousSnapshot: EphemerisSnapshot | null = null, previousResult: TrailResult | null = null;
  let previousHistory: BoundaryHistoryResult | null = null;
  let cachedBodyId = '', width = 1, height = 1;
  const makeLine = (capacity: number, color: string, opacity: number, dashed = false): Line2 => {
    const target = new Line2(createWideLineGeometry(capacity, radius * 1.1), new LineMaterial({ color, opacity, transparent: true, linewidth: 1.55, depthWrite: false, dashed, dashSize: 0.11, gapSize: 0.085 }));
    target.userData.wideLine = true; target.renderOrder = 3; allLines.push(target); return target;
  };
  const makeCaption = (priority: number): THREE.Sprite => {
    const target = captionFactory('', '#bddbe3', 0.17);
    target.userData.trailLabel = true; target.userData.labelPriority = priority; target.userData.labelEnabled = false;
    captions.push(target); return target;
  };
  const label = (target: THREE.Sprite, text: string, color = '#bddbe3'): void => {
    const key = `${text}:${color}`;
    if (target.userData.trailText === key) return;
    const replacement = captionFactory(text, color, 0.17);
    target.material.map?.dispose(); target.material.map = replacement.material.map;
    replacement.material.map = null; replacement.material.dispose(); target.material.needsUpdate = true;
    target.scale.copy(replacement.scale);
    for (const field of ['baseHeight', 'textFraction', 'minimumTextPixels']) target.userData[field] = replacement.userData[field];
    target.userData.trailText = key;
  };
  const strokes = [...TRAIL_PAST_OPACITIES.map(opacity => makeLine(CAPACITY, '#8bc6d3', opacity)), makeLine(CAPACITY, '#8bc6d3', 0.48, true)];
  strokes.forEach((target, index) => { target.name = index === 4 ? 'Future trail · dashed' : `Past trail · fade ${index + 1}`; bodyGroup.add(target); });
  const arrows = makeLine(32, '#bddbe3', 0.7), ticks = makeLine(16, '#bddbe3', 0.7);
  arrows.name = 'Increasing-time arrows'; ticks.name = 'Trail time ticks'; bodyGroup.add(arrows, ticks);
  const startLabel = makeCaption(28), endLabel = makeCaption(28), referenceLabel = makeCaption(27);
  const tickLabels = Array.from({ length: 7 }, () => makeCaption(20));
  bodyGroup.add(startLabel, endLabel, referenceLabel, ...tickLabels);
  const ghosts = Array.from({ length: 7 }, () => {
    const line = makeLine(180, '#aca4d1', 0.28, true), caption = makeCaption(22);
    historyGroup.add(line, caption); return { line, caption };
  });
  function identify(target: THREE.Object3D, id: string, name: string): void {
    target.userData.entityId = id; target.userData.entityKind = id.startsWith('body:') ? 'body' : 'boundary';
    target.userData.hoverName = name;
  }
  function resolution(): void { for (const target of allLines) target.material.resolution.set(width, height); }
  return {
    group, get hitTargets() { return hitTargets; },
    resize(nextWidth, nextHeight) { width = Math.max(1, nextWidth); height = Math.max(1, nextHeight); resolution(); },
    update(snapshot, settings, result, history, historyResult, interaction) {
      group.visible = interaction.visible && snapshot !== null;
      bodyGroup.visible = false; historyGroup.visible = false; hitTargets = [];
      for (const target of captions) target.visible = target.userData.labelEnabled = false;
      group.userData.currentInserted = false;
      group.userData.trailStatus = result?.status ?? 'empty';
      group.userData.trailLimits = result?.limits ?? [];
      const bodyId = result ? `body:${result.bodyId}` : '';
      const validBody = snapshot && settings.enabled && result && result.frame === settings.frame && interaction.selectedId === bodyId && sameObserver(result.observer, snapshot.observer);
      if (validBody) {
        if (previousSnapshot !== snapshot || previousResult !== result || cachedBodyId !== bodyId) {
          const projected = projectTrail(result, snapshot);
          const geometry = buildTimedTrailStrokes(projected.segments, snapshot.instantMs, radius);
          const count = geometry.buckets.reduce((total, bucket) => total + bucket.length, 0);
          if (count > CAPACITY) throw new RangeError('Trail samples exceed the first-release display budget.');
          for (const [index, target] of strokes.entries()) writeStrokes(target, geometry.buckets[index]!);
          const arrowStrokes: TrailStroke[] = [], tickStrokes: TrailStroke[] = [];
          for (const decoration of geometry.decorations) {
            const [a, b, c, d] = decoration.arrow;
            arrowStrokes.push({ start: a, end: b, distanceStart: 0, distanceEnd: 1 }, { start: c, end: d, distanceStart: 0, distanceEnd: 1 });
            tickStrokes.push({ start: decoration.tick[0], end: decoration.tick[1], distanceStart: 0, distanceEnd: 1 });
          }
          writeStrokes(arrows, arrowStrokes); writeStrokes(ticks, tickStrokes);
          const offsetLabel = (target: THREE.Sprite, point: Vector3, side: number): void => {
            const center = position(point, radius * 1.017);
            let tangent = new THREE.Vector3(0, 1, 0).addScaledVector(center, -center.y / center.lengthSq());
            if (tangent.lengthSq() < 1e-8) tangent = new THREE.Vector3(1, 0, 0);
            target.position.copy(center).addScaledVector(tangent.normalize(), side);
          };
          if (geometry.first && geometry.last) {
            label(startLabel, `Start · ${timeLabel(geometry.first.instantMs)}`); offsetLabel(startLabel, geometry.first.point, 0.23);
            label(endLabel, `End · ${timeLabel(geometry.last.instantMs)}`); offsetLabel(endLabel, geometry.last.point, -0.23);
            label(referenceLabel, TRAIL_REFERENCE_LABELS[result.frame]);
            const current = projected.samples.find(sample => sample.isCurrent) ?? projected.samples[Math.floor(projected.samples.length / 2)]!;
            offsetLabel(referenceLabel, current.point, 0.47);
          }
          for (const [index, target] of tickLabels.entries()) {
            const decoration = geometry.decorations[index]; target.userData.hasTick = Boolean(decoration);
            if (!decoration) continue;
            label(target, timeLabel(decoration.sample.instantMs)); offsetLabel(target, decoration.sample.point, -0.14);
          }
          bodyGroup.userData.hasPath = count > 0;
          bodyGroup.userData.currentInserted = projected.currentInserted;
          bodyGroup.userData.currentPoint = projected.samples.find(sample => sample.isCurrent)?.point ?? null;
          bodyGroup.userData.pointCount = projected.samples.length;
          previousSnapshot = snapshot; previousResult = result; cachedBodyId = bodyId;
        }
        bodyGroup.visible = group.visible && bodyGroup.userData.hasPath;
        group.userData.currentInserted = bodyGroup.userData.currentInserted;
        if (bodyGroup.visible) {
          for (const target of [startLabel, endLabel, referenceLabel]) target.visible = target.userData.labelEnabled = true;
          for (const target of tickLabels) target.visible = target.userData.labelEnabled = target.userData.hasTick;
          const name = `${result.bodyId[0]!.toUpperCase()}${result.bodyId.slice(1)} trail · ${TRAIL_REFERENCE_LABELS[result.frame]}`;
          for (const target of [...strokes, arrows, ticks, startLabel, endLabel, referenceLabel, ...tickLabels]) identify(target, bodyId, name);
          hitTargets.push(...strokes, arrows, ticks, startLabel, endLabel, referenceLabel, ...tickLabels);
        }
      }
      const boundaryHouse = interaction.selectedId?.startsWith('boundary:') || interaction.selectedId?.startsWith('house:') ? Number(interaction.selectedId.split(':')[1]) : null;
      const primarySystem = snapshot?.houses[0]?.system;
      const validHistory = snapshot && history.enabled && historyResult && historyResult.house === boundaryHouse && historyResult.system === primarySystem && historyResult.versionKey === TRAIL_VERSION_KEY && sameObserver(historyResult.observer, snapshot.observer);
      if (validHistory) {
        historyGroup.visible = group.visible;
        const boundaryId = `boundary:${historyResult.house}`;
        for (const [index, ghost] of ghosts.entries()) {
          const sample = historyResult.samples[index];
          ghost.line.visible = Boolean(sample && sample.status !== 'undefined');
          if (!sample || sample.status === 'undefined') continue;
          const changed = sample.status === 'jump', color = changed ? '#d1b18b' : '#aca4d1';
          if (previousHistory !== historyResult) {
            writeWideLine(ghost.line.geometry, sample.line.map(point => ({ x: point.x * radius * 1.006, y: point.y * radius * 1.006, z: point.z * radius * 1.006 })));
            label(ghost.caption, `C${historyResult.house} · ${timeLabel(sample.instantMs)}${changed ? ' · jump' : ''}`, color);
            ghost.caption.position.copy(position(sample.point, radius * 1.02));
          }
          ghost.line.material.color.set(color); ghost.line.material.opacity = sample.instantMs > snapshot.instantMs ? 0.38 : 0.15 + 0.25 * Math.max(0, 1 - (snapshot.instantMs - sample.instantMs) / Math.max(1, history.windowMs));
          ghost.line.material.dashed = true;
          ghost.line.material.dashSize = changed ? 0.025 : 0.11; ghost.line.material.gapSize = changed ? 0.08 : 0.085;
          ghost.caption.visible = ghost.caption.userData.labelEnabled = group.visible;
          const name = `Cusp ${historyResult.house} history · ${timeLabel(sample.instantMs)}${changed ? ' · discrete change' : ''}`;
          identify(ghost.line, boundaryId, name); identify(ghost.caption, boundaryId, name);
          ghost.line.name = name; hitTargets.push(ghost.line, ghost.caption);
        }
        previousHistory = historyResult;
      }
      group.userData.historyCount = validHistory ? Math.min(7, historyResult.samples.filter(sample => sample.status !== 'undefined').length) : 0;
      group.userData.historyBreaks = validHistory ? historyResult.samples.filter(sample => sample.status === 'undefined').length : 0;
      resolution();
    },
  };
}
