import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EphemerisEngine, EPHEMERIS_FILES, type EphemerisSnapshot } from '../../src/lib/astronomy/ephemeris';
import { astronomicalToThree, equatorialToVector, type Vector3 } from '../../src/lib/astronomy/coordinates';
import { DEFAULT_TRAIL_DISPLAY, DEFAULT_BOUNDARY_HISTORY, TRAIL_VERSION_KEY, makeTrailSample, projectTrail, sampleTrail, type TrailFrame, type TrailResult, type BoundaryHistoryResult } from '../../src/lib/domain/trails';
import { eclipticDirection } from '../../src/lib/domain/sky-reference';
import { createTrailRenderer } from '../../src/lib/scene/trail-renderer';
import { TRAIL_PAST_OPACITIES, TRAIL_REFERENCE_LABELS } from '../../src/lib/scene/trail-style';

let engine: EphemerisEngine, snapshot: EphemerisSnapshot;
const results = new Map<TrailFrame, TrailResult>();
const radius = 5.8, hour = 3600000;
beforeAll(async () => {
  engine = await EphemerisEngine.create({
    wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
    files: new Map(await Promise.all(EPHEMERIS_FILES.map(async file => [file.name, new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
  });
  snapshot = engine.calculate(Date.UTC(2000, 0, 1, 12), { latitudeDeg: 51.5, longitudeDeg: 0 }, ['W']);
  for (const frame of ['stars', 'horizon'] as const) results.set(frame, await sampleTrail({
    jobId: 1, bodyId: 'moon', frame, observer: snapshot.observer,
    anchorMs: snapshot.instantMs, startMs: snapshot.instantMs - 12 * hour, endMs: snapshot.instantMs + 12 * hour,
  }, instantMs => makeTrailSample(engine.calculate(instantMs, snapshot.observer, ['W']), 'moon'), { yieldControl: async () => {} }));
});
afterAll(() => engine?.close());
const interaction = (selectedId = 'body:moon') => ({ visible: true, selectedId });
const settings = (frame: TrailFrame = 'stars') => ({ ...DEFAULT_TRAIL_DISPLAY, enabled: true, frame });
const historySettings = { ...DEFAULT_BOUNDARY_HISTORY, enabled: true };
function renderer() {
  const caption = vi.fn((_text: string, _color: string, size: number) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial()); sprite.scale.setScalar(size); return sprite;
  });
  return Object.assign(createTrailRenderer(radius, caption), { caption });
}
function linePoints(line: Line2): THREE.Vector3[] {
  const start = line.geometry.getAttribute('instanceStart'), end = line.geometry.getAttribute('instanceEnd');
  return Array.from({ length: line.geometry.instanceCount }, (_, index) => [new THREE.Vector3().fromBufferAttribute(start, index), new THREE.Vector3().fromBufferAttribute(end, index)]).flat();
}
function allLines(group: THREE.Object3D): Line2[] {
  const lines: Line2[] = []; group.traverse(object => { if (object instanceof Line2) lines.push(object); }); return lines;
}
function expected(point: Vector3): THREE.Vector3 { const p = astronomicalToThree(point); return new THREE.Vector3(p.x, p.y, p.z).multiplyScalar(radius); }
function historyResult(): BoundaryHistoryResult {
  const start = snapshot.instantMs - 3 * hour, end = snapshot.instantMs + 3 * hour;
  return {
    jobId: 2, system: 'W', house: 1, observer: snapshot.observer, anchorMs: snapshot.instantMs,
    requestedStartMs: start, requestedEndMs: end, startMs: start, endMs: end, status: 'complete', progress: 1, limits: [], versionKey: TRAIL_VERSION_KEY,
    samples: Array.from({ length: 7 }, (_, index) => {
      const instantMs = start + index * hour;
      const chart = engine.calculate(instantMs, snapshot.observer, ['W']), houses = chart.houses[0]!;
      if (houses.status !== 'valid') throw new Error('Fixture needs valid Whole Sign houses.');
      const longitudeDeg = houses.cusps[0]!;
      return { instantMs, status: index === 3 ? 'jump' as const : 'valid' as const, longitudeDeg, direction: 1 as const,
        point: eclipticDirection(chart, longitudeDeg), line: Array.from({ length: 177 }, (_, step) => eclipticDirection(chart, longitudeDeg, step - 88)),
      };
    }),
  };
}

describe('selected body trail rendering', () => {
  for (const frame of ['stars', 'horizon'] as const) it(`inserts the exact latest marker in ${frame} mode without rebuilding the sampling result`, () => {
    const display = renderer(), result = results.get(frame)!;
    const later = engine.calculate(snapshot.instantMs + 17 * 60000, snapshot.observer, ['W']);
    const before = JSON.stringify(result);
    display.update(later, settings(frame), result, DEFAULT_BOUNDARY_HISTORY, null, interaction());
    const bodyGroup = display.group.getObjectByName('Selected body trail')!;
    expect(bodyGroup.visible).toBe(true); expect(display.group.userData.currentInserted).toBe(true);
    const point = equatorialToVector(later.bodies.find(body => body.id === 'moon')!.fixedEquatorial);
    expect(bodyGroup.userData.currentPoint).toEqual(point);
    const rendered = allLines(bodyGroup).filter(line => line.name.includes('trail')).flatMap(linePoints);
    expect(Math.min(...rendered.map(value => value.distanceTo(expected(point))))).toBeLessThan(0.000001);
    expect(display.caption).toHaveBeenCalledWith(TRAIL_REFERENCE_LABELS[frame], '#bddbe3', 0.17);
    expect(JSON.stringify(result)).toBe(before);
  });

  it('uses each sample horizon orientation before embedding into the current scene', () => {
    const display = renderer(), result = results.get('horizon')!;
    display.update(snapshot, settings('horizon'), result, DEFAULT_BOUNDARY_HISTORY, null, interaction());
    const projected = projectTrail(result, snapshot), first = projected.samples[0]!;
    const bodyGroup = display.group.getObjectByName('Selected body trail')!;
    const rendered = allLines(bodyGroup).filter(line => line.name.includes('trail')).flatMap(linePoints);
    expect(Math.min(...rendered.map(value => value.distanceTo(expected(first.point))))).toBeLessThan(0.000001);
    expect(Math.hypot(first.point.x - result.samples[0]!.fixed.x, first.point.y - result.samples[0]!.fixed.y, first.point.z - result.samples[0]!.fixed.z)).toBeGreaterThan(0.5);
  });

  it('renders fading solid past, dashed future, time ticks, direction arrows and labelled UTC bounds', () => {
    const display = renderer(); display.resize(1200, 800);
    display.update(snapshot, settings('horizon'), results.get('horizon')!, DEFAULT_BOUNDARY_HISTORY, null, interaction());
    const group = display.group.getObjectByName('Selected body trail')!;
    const past = allLines(group).filter(line => line.name.startsWith('Past trail'));
    expect(past.map(line => line.material.opacity)).toEqual([...TRAIL_PAST_OPACITIES]);
    expect(past.every(line => !line.material.dashed)).toBe(true);
    const future = allLines(group).find(line => line.name.startsWith('Future trail'))!;
    expect(future.material.dashed).toBe(true); expect(future.geometry.instanceCount).toBeGreaterThan(0);
    expect(allLines(group).find(line => line.name === 'Increasing-time arrows')!.geometry.instanceCount).toBeGreaterThan(0);
    expect(allLines(group).find(line => line.name === 'Trail time ticks')!.geometry.instanceCount).toBeGreaterThan(0);
    expect(display.caption.mock.calls.some(call => call[0].startsWith('Start · ') && call[0].endsWith('Z'))).toBe(true);
    expect(display.caption.mock.calls.some(call => call[0].startsWith('End · ') && call[0].endsWith('Z'))).toBe(true);
    expect(allLines(group).every(line => line.material.resolution.equals(new THREE.Vector2(1200, 800)))).toBe(true);
    expect(display.hitTargets.every(target => target.userData.entityId === 'body:moon')).toBe(true);
  });

  it('hides stale selection, frame, observer and version results instead of reusing a false path', () => {
    const display = renderer(), result = results.get('stars')!;
    for (const [config, chart, trail, selected] of [
      [settings(), snapshot, result, 'body:sun'],
      [settings('horizon'), snapshot, result, 'body:moon'],
      [settings(), { ...snapshot, observer: { ...snapshot.observer, longitudeDeg: 1 } }, result, 'body:moon'],
      [settings(), snapshot, { ...result, versionKey: 'old' }, 'body:moon'],
    ] as const) {
      display.update(chart, config, trail, DEFAULT_BOUNDARY_HISTORY, null, interaction(selected));
      expect(display.group.getObjectByName('Selected body trail')!.visible).toBe(false);
      expect(display.hitTargets).toHaveLength(0);
    }
  });

  it('reports limited metadata and does not draw a connector to the exact current marker beyond the effective interval', () => {
    const display = renderer(), source = results.get('horizon')!;
    const past = source.samples.filter(sample => sample.instantMs <= snapshot.instantMs - 6 * hour);
    const limited = { ...source, samples: past, status: 'limited' as const, endMs: past.at(-1)!.instantMs, limits: ['Point budget reached.'] };
    display.update(snapshot, settings('horizon'), limited, DEFAULT_BOUNDARY_HISTORY, null, interaction());
    expect(display.group.userData.trailStatus).toBe('limited'); expect(display.group.userData.trailLimits).toEqual(limited.limits);
    const current = expected(equatorialToVector(snapshot.bodies.find(body => body.id === 'moon')!.fixedEquatorial));
    const group = display.group.getObjectByName('Selected body trail')!;
    const rendered = allLines(group).filter(line => line.name.includes('trail')).flatMap(linePoints);
    expect(Math.min(...rendered.map(point => point.distanceTo(current)))).toBeGreaterThan(1);
    expect(display.group.userData.currentInserted).toBe(true);
  });

  it('reuses all line/position/distance resources across repeated ticks, frames and disabling', () => {
    const display = renderer();
    const lines = allLines(display.group), geometries = lines.map(line => line.geometry);
    const positions = lines.map(line => (line.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data);
    const distances = lines.map(line => (line.geometry.getAttribute('instanceDistanceStart') as THREE.InterleavedBufferAttribute).data);
    const dispose = geometries.map(geometry => vi.spyOn(geometry, 'dispose'));
    const chartBefore = JSON.stringify(snapshot.bodies);
    for (let index = 0; index < 30; index++) {
      const frame = index % 2 ? 'stars' : 'horizon';
      const chart = engine.calculate(snapshot.instantMs + index * 60000, snapshot.observer, ['W']);
      display.update(chart, { ...settings(frame), enabled: index % 3 !== 0 }, results.get(frame)!, DEFAULT_BOUNDARY_HISTORY, null, interaction());
    }
    expect(allLines(display.group).map(line => line.geometry)).toEqual(geometries);
    for (const [index, line] of lines.entries()) {
      expect((line.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data).toBe(positions[index]);
      expect((line.geometry.getAttribute('instanceDistanceStart') as THREE.InterleavedBufferAttribute).data).toBe(distances[index]);
    }
    expect(dispose.every(spy => spy.mock.calls.length === 0)).toBe(true);
    expect(JSON.stringify(snapshot.bodies)).toBe(chartBefore);
  });
});

describe('bounded selected-boundary history', () => {
  it('shows at most seven separately labelled arcs, marks jumps and never connects an undefined sample', () => {
    const display = renderer(), result = historyResult();
    result.samples[2] = { instantMs: result.samples[2]!.instantMs, status: 'undefined', reason: 'Construction unavailable.' };
    display.update(snapshot, DEFAULT_TRAIL_DISPLAY, null, historySettings, result, interaction('boundary:1'));
    expect(display.group.userData.historyCount).toBe(6); expect(display.group.userData.historyBreaks).toBe(1);
    const history = display.group.getObjectByName('Selected boundary history')!;
    expect(allLines(history).filter(line => line.visible)).toHaveLength(6);
    expect(allLines(history).find(line => line.name.includes('discrete change'))!.material.color.getHexString()).toBe('d1b18b');
    expect(display.hitTargets.every(target => target.userData.entityId === 'boundary:1')).toBe(true);
    expect(display.caption.mock.calls.some(call => call[0].endsWith(' · jump'))).toBe(true);
    // Each ghost is one independent constant-longitude arc, never twelve sheets.
    expect(allLines(history).every(line => line.geometry.instanceCount <= 176)).toBe(true);
  });

  it('preserves each ghost in its sample fixed frame, without recomputing current house boundaries', () => {
    const display = renderer(), result = historyResult(), before = JSON.stringify(snapshot.houses);
    display.update(snapshot, DEFAULT_TRAIL_DISPLAY, null, historySettings, result, interaction('house:1'));
    const history = display.group.getObjectByName('Selected boundary history')!;
    const first = result.samples[0]!; if (first.status === 'undefined') throw new Error('Needs valid fixture.');
    const start = linePoints(allLines(history)[0]!)[0]!;
    expect(start.distanceTo(expected(first.line[0]!).multiplyScalar(1.006))).toBeLessThan(0.000001);
    const geometry = allLines(history)[0]!.geometry;
    display.update({ ...snapshot, instantMs: snapshot.instantMs + 60000 }, DEFAULT_TRAIL_DISPLAY, null, historySettings, result, interaction('house:1'));
    expect(allLines(history)[0]!.geometry).toBe(geometry);
    expect(JSON.stringify(snapshot.houses)).toBe(before);
  });

  it('hides history after selection, primary system, observer or calculation version changes', () => {
    const display = renderer(), result = historyResult();
    const cases: [EphemerisSnapshot, BoundaryHistoryResult, string][] = [
      [snapshot, result, 'boundary:2'],
      [{ ...snapshot, houses: [{ system: 'E' as const, status: 'undefined' as const, reason: 'Fixture' }] }, result, 'boundary:1'],
      [{ ...snapshot, observer: { ...snapshot.observer, latitudeDeg: 52 } }, result, 'boundary:1'],
      [snapshot, { ...result, versionKey: 'old' }, 'boundary:1'],
    ];
    for (const [chart, history, selected] of cases) {
      display.update(chart, DEFAULT_TRAIL_DISPLAY, null, historySettings, history, interaction(selected));
      expect(display.group.getObjectByName('Selected boundary history')!.visible).toBe(false);
      expect(display.hitTargets).toHaveLength(0);
    }
  });
});
