import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EphemerisEngine, EPHEMERIS_FILES, BODY_IDS, type BodyId, type EphemerisSnapshot } from '../../src/lib/astronomy/ephemeris';
import { astronomicalToThree, equatorialToVector, threeToAstronomical, vectorToEquatorial, type Vector3 } from '../../src/lib/astronomy/coordinates';
import { DEFAULT_ASPECT_DISPLAY, type AspectDisplaySettings } from '../../src/lib/domain/aspect-presentation';
import { eclipticDirection } from '../../src/lib/domain/sky-reference';
import { createAspectRenderer } from '../../src/lib/scene/aspect-renderer';
import { ASPECT_LEGEND, ASPECT_STYLE } from '../../src/lib/scene/aspect-style';
import { resolveHoverCard } from '../../src/lib/domain/hover-card';
import type { FeatureHit } from '../../src/lib/domain/scene-hit';

let engine: EphemerisEngine, snapshot: EphemerisSnapshot;
beforeAll(async () => {
  engine = await EphemerisEngine.create({
    wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
    files: new Map(await Promise.all(EPHEMERIS_FILES.map(async file => [file.name, new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
  });
  snapshot = engine.calculate(Date.UTC(2000, 0, 1, 12), { latitudeDeg: 51.5, longitudeDeg: 0 });
});
afterAll(() => engine?.close());
const radius = 5.8;
const settings = (): AspectDisplaySettings => ({ ...DEFAULT_ASPECT_DISPLAY, types: { ...DEFAULT_ASPECT_DISPLAY.types }, orbs: { ...DEFAULT_ASPECT_DISPLAY.orbs } });
const interaction = (selectedId: string | null = null, hoveredId: string | null = null) => ({ visible: true, selectedId, hoveredId });
function renderer() {
  const caption = vi.fn((_text: string, _color: string, size: number) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial()); sprite.scale.setScalar(size); return sprite;
  });
  return Object.assign(createAspectRenderer(radius, caption), { caption });
}
function sky(entries: [BodyId, number, number?][]): EphemerisSnapshot {
  return { ...snapshot, bodies: entries.map(([id, longitudeDeg, latitudeDeg = 0]) => ({
    ...snapshot.bodies.find(body => body.id === id)!, longitudeDeg, latitudeDeg,
    fixedEquatorial: vectorToEquatorial(eclipticDirection(snapshot, longitudeDeg, latitudeDeg)),
  })) };
}
function namedLines(group: THREE.Group, name: string): Line2[] {
  const result: Line2[] = []; group.traverse(object => { if (object instanceof Line2 && object.name === name) result.push(object); }); return result;
}
function linePoints(line: Line2): THREE.Vector3[] {
  const starts = line.geometry.getAttribute('instanceStart'), ends = line.geometry.getAttribute('instanceEnd');
  const count = line.geometry.instanceCount;
  return count ? [new THREE.Vector3().fromBufferAttribute(starts, 0), ...Array.from({ length: count }, (_, index) => new THREE.Vector3().fromBufferAttribute(ends, index))] : [];
}
function expectedPoint(direction: Vector3, scale = radius): THREE.Vector3 {
  const value = astronomicalToThree(direction); return new THREE.Vector3(value.x, value.y, value.z).multiplyScalar(scale);
}

describe('longitude aspect rendering', () => {
  it('resolves endpoint and longitude subtargets to their own body cards with exact geometric roles', () => {
    const display = renderer(), chart = sky([['sun', 350, 12], ['moon', 50, -17]]);
    display.update(chart, settings(), interaction('aspect:sun-moon:sextile'));
    const objects = display.entities[0]!.objects;
    const endpointHits = objects.filter(object => object.userData.ignoreEarthOcclusion).map(object => object.userData.featureHit as FeatureHit);
    expect(endpointHits.map(hit => hit.entityId)).toEqual(['body:sun', 'body:moon']);
    const bodyObjects = objects.filter(object => object.userData.featureHit?.kind === 'body');
    // Two real-position endpoint rings plus marker/caption/leader/projection for each longitude anchor.
    expect(bodyObjects).toHaveLength(10);
    for (const object of bodyObjects) {
      const hit = object.userData.featureHit as FeatureHit;
      const body = hit.entityId.slice('body:'.length), card = resolveHoverCard(hit, { snapshot: chart });
      expect(hit.id).toBe(`body:${body}`);
      expect(hit.representation).toBe('sky');
      expect(card?.kind).toBe('body');
      expect(card?.aspect).toBeUndefined();
      expect(card?.sections.some(section => section.id === `body:${body}`)).toBe(true);
      expect(card?.sections.some(section => section.id === `body-in-sign:${body}:${body === 'sun' ? 'pisces' : 'taurus'}`)).toBe(true);
      expect(card?.facts.find(fact => fact.label === 'Feature role')?.value).toBe(hit.role);
      expect(hit.role).toBeTruthy();
    }
    for (const projection of namedLines(display.group, 'Body latitude projection')) expect(projection.userData.featureHit.role).toMatch(/^Latitude projection/);
    for (const leader of namedLines(display.group, 'Longitude caption leader')) expect(leader.userData.featureHit.role).toMatch(/^Caption leader/);
    expect(new Set(bodyObjects.map(object => object.userData.featureHit.role)).size).toBe(5);
  });

  it('retains the combined aspect card on the strand, symbol and measured separation arc', () => {
    const display = renderer(), chart = sky([['sun', 350, 12], ['moon', 50, -17]]);
    display.update(chart, settings(), interaction('aspect:sun-moon:sextile'));
    const objects = display.entities[0]!.objects.filter(object => object.userData.featureHit?.kind === 'aspect');
    expect(objects).toHaveLength(3);
    expect(objects.map(object => object.userData.featureHit.role)).toEqual([
      'Longitude aspect strand', 'Aspect symbol caption', 'Measured shortest ecliptic-longitude separation arc',
    ]);
    for (const object of objects) {
      const hit = object.userData.featureHit as FeatureHit, card = resolveHoverCard(hit, { snapshot: chart });
      expect(hit.id).toBe('aspect:sun-moon:sextile');
      expect(hit.entityId).toBe(hit.id);
      expect(card?.kind).toBe('aspect');
      expect(card?.aspect?.bodyA.id).toBe('sun');
      expect(card?.aspect?.bodyB.id).toBe('moon');
      expect(card?.facts.find(fact => fact.label === 'Feature role')?.value).toBe(hit.role);
    }
  });

  it('rebinds pooled endpoint and measurement identities when the eligible body pair changes', () => {
    const display = renderer();
    display.update(sky([['sun', 10, 2], ['moon', 70, 3]]), settings(), interaction('aspect:sun-moon:sextile'));
    const first = display.entities[0]!, endpoints = first.objects.filter(object => object.userData.ignoreEarthOcclusion);
    const measurement = namedLines(display.group, 'Longitude separation arc')[0]!;
    display.update(sky([['venus', 20, 8], ['mars', 110, -6]]), settings(), interaction('aspect:venus-mars:square'));
    const next = display.entities[0]!;
    expect(next.objects.filter(object => object.userData.ignoreEarthOcclusion)).toEqual(endpoints);
    expect(endpoints.map(object => object.userData.featureHit.entityId)).toEqual(['body:venus', 'body:mars']);
    expect(next.objects.filter(object => object.userData.featureHit?.kind === 'body').every(object => ['body:venus', 'body:mars'].includes(object.userData.featureHit.entityId))).toBe(true);
    expect(measurement.userData.featureHit.entityId).toBe('aspect:venus-mars:square');
    expect(next.objects.filter(object => object.userData.featureHit?.kind === 'aspect').every(object => object.userData.featureHit.entityId === next.id)).toBe(true);
    const config = settings(); config.measurement = false;
    display.update(sky([['venus', 20, 8], ['mars', 110, -6]]), config, interaction('aspect:venus-mars:square'));
    expect(next.objects.some(object => object.userData.featureHit?.role?.startsWith('Latitude projection'))).toBe(false);
    expect(measurement.parent!.visible).toBe(false);
  });

  for (const [first, second, middle] of [[350, 50, 20], [50, 350, 20], [20, 80, 50], [80, 20, 50]] as const) {
    it(`measures the shortest longitude arc from${first}° to${second}° with both correct endpoints`, () => {
      const display = renderer(), chart = sky([['sun', first, 8], ['moon', second, -5]]);
      display.update(chart, settings(), interaction('aspect:sun-moon:sextile'));
      const points = linePoints(namedLines(display.group, 'Longitude separation arc')[0]!);
      expect(points[0]!.distanceTo(expectedPoint(eclipticDirection(chart, first), radius * 1.004))).toBeLessThan(0.000001);
      expect(points.at(-1)!.distanceTo(expectedPoint(eclipticDirection(chart, second), radius * 1.004))).toBeLessThan(0.000001);
      expect(points[Math.floor(points.length / 2)]!.distanceTo(expectedPoint(eclipticDirection(chart, middle), radius * 1.004))).toBeLessThan(0.000001);
    });
  }

  it('draws dashed latitude projections from actual bodies to the corresponding ecliptic anchors', () => {
    const display = renderer(), chart = sky([['sun', 350, 12], ['moon', 50, -17]]);
    display.update(chart, settings(), interaction('aspect:sun-moon:sextile'));
    const projections = namedLines(display.group, 'Body latitude projection');
    expect(projections).toHaveLength(2);
    for (const [index, projection] of projections.entries()) {
      const body = chart.bodies[index]!, points = linePoints(projection);
      expect(projection.visible).toBe(true); expect(projection.material.dashed).toBe(true);
      expect(points[0]!.distanceTo(expectedPoint(equatorialToVector(body.fixedEquatorial)))).toBeLessThan(0.000001);
      expect(points.at(-1)!.distanceTo(expectedPoint(eclipticDirection(chart, body.longitudeDeg), radius * 1.004))).toBeLessThan(0.000001);
      expect(points.length).toBeGreaterThan(5);
      expect(threeToAstronomical(points[0]!).z).toBeCloseTo(equatorialToVector(body.fixedEquatorial).z * radius, 6);
    }
  });

  for (const selected of [null, 'body:sun', 'aspect:sun-moon:sextile']) it(`keeps brightness monotone with closeness for selection${selected}`, () => {
    const display = renderer(), values: number[] = [];
    for (const separation of [66, 63, 60]) {
      display.update(sky([['sun', 0], ['moon', separation]]), settings(), interaction(selected));
      values.push((display.entities[0]!.objects[0] as Line2).material.opacity);
    }
    expect(values[0]).toBeGreaterThan(0);
    expect(values[0]).toBeLessThan(values[1]!); expect(values[1]).toBeLessThan(values[2]!);
  });

  it('retains a selectable finite zero-orb conjunction while hiding the zero-length measurement arc', () => {
    const display = renderer(), chart = sky([['sun', 40, 3], ['moon', 40, 3]]), config = settings();
    config.orbs.conjunction = 0;
    display.resize(1200, 800); display.update(chart, config, interaction('aspect:sun-moon:conjunction'));
    expect(display.entities).toHaveLength(1);
    expect(namedLines(display.group, 'Longitude separation arc')[0]!.visible).toBe(false);
    const core = display.entities[0]!.objects[0] as Line2, points = linePoints(core);
    expect(points).toHaveLength(65);
    expect(points.every(value => Number.isFinite(value.length()))).toBe(true);
    expect(core.material.resolution.toArray()).toEqual([1200, 800]);
    const anchor = display.entities[0]!.anchor;
    const camera = new THREE.PerspectiveCamera(40, 1.5, 0.01, 100);
    camera.position.copy(anchor.clone().normalize().multiplyScalar(12)); camera.lookAt(anchor); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    display.group.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(); raycaster.params.Line2 = { threshold: 6 }; raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    expect(raycaster.intersectObject(core).length).toBeGreaterThan(0);
  });

  it('isolates a selected eligible pair and keeps explicit endpoint indicators available around Earth', () => {
    const display = renderer(), chart = sky([['sun', 0], ['moon', 180], ['mars', 60]]);
    display.update(chart, settings(), interaction('aspect:sun-moon:opposition'));
    expect(display.entities.map(entity => entity.id)).toEqual(['aspect:sun-moon:opposition']);
    const endpoints = display.entities[0]!.objects.filter(object => object.userData.ignoreEarthOcclusion);
    expect(endpoints).toHaveLength(2);
    expect(endpoints.every(object => object.visible && object.userData.aspectEndpoint)).toBe(true);
    expect(display.entities[0]!.focusRadius).toBeGreaterThan(5);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
    display.faceCamera(quaternion); expect(endpoints.every(object => object.quaternion.equals(quaternion))).toBe(true);
  });

  it('applies type, orb and selected scope filters without manufacturing an outside-orb strand', () => {
    const display = renderer(), chart = sky([['sun', 0], ['moon', 63], ['mars', 120]]), config = settings();
    config.scope = 'selected'; display.update(chart, config, interaction()); expect(display.entities).toHaveLength(0);
    display.update(chart, config, interaction('body:moon')); expect(display.entities.every(entity => entity.id.includes('moon'))).toBe(true);
    config.orbs.sextile = 1; display.update(chart, config, interaction('aspect:sun-moon:sextile'));
    expect(display.entities).toHaveLength(0); expect(display.group.userData.selectedOutsideOrb).toBe(true);
    config.orbs.sextile = 6; config.types.sextile = false;
    display.update(chart, config, interaction('aspect:sun-moon:sextile')); expect(display.entities).toHaveLength(0);
    config.types.sextile = true; config.enabled = false;
    display.update(chart, config, interaction('aspect:sun-moon:sextile')); expect(display.group.visible).toBe(false); expect(display.entities).toHaveLength(0);
  });

  it('reuses bounded position/distance buffers through chart, orb, style and selection updates without moving source bodies', () => {
    const display = renderer(), allPairs = sky(BODY_IDS.map(id => [id, 40, 4]));
    const before = JSON.stringify(allPairs.bodies);
    display.update(allPairs, settings(), interaction());
    expect(display.entities).toHaveLength(45);
    const geometries = new Set<THREE.BufferGeometry>();
    display.group.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
    const core = display.entities[0]!.objects[0] as Line2;
    const positions = (core.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data;
    const distances = (core.geometry.getAttribute('instanceDistanceStart') as THREE.InterleavedBufferAttribute).data;
    const dispose = [...geometries].map(geometry => vi.spyOn(geometry, 'dispose'));
    for (let index = 0; index < 30; index++) {
      const chart = { ...allPairs, instantMs: allPairs.instantMs + index * 1000 };
      display.update(chart, { ...settings(), glow: index % 2 === 0 }, interaction(index % 2 ? 'body:sun' : 'aspect:sun-moon:conjunction'));
    }
    const afterGeometries = new Set<THREE.BufferGeometry>();
    display.group.traverse(object => { if (object instanceof THREE.Mesh) afterGeometries.add(object.geometry); });
    expect(afterGeometries).toEqual(geometries); expect(display.group.userData.slotCount).toBe(45);
    expect((core.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data).toBe(positions);
    expect((core.geometry.getAttribute('instanceDistanceStart') as THREE.InterleavedBufferAttribute).data).toBe(distances);
    expect(dispose.every(spy => spy.mock.calls.length === 0)).toBe(true);
    expect(JSON.stringify(allPairs.bodies)).toBe(before);
  });

  it('uses the shared categorical colour, glyph and dash legend in actual materials', () => {
    const display = renderer();
    for (const [type, angle] of [['conjunction', 0], ['sextile', 60], ['square', 90], ['trine', 120], ['opposition', 180]] as const) {
      display.update(sky([['sun', 0], ['moon', angle]]), settings(), interaction(`aspect:sun-moon:${type}`));
      const core = display.entities[0]!.objects[0] as Line2;
      const legend = ASPECT_LEGEND.find(entry => entry.id === type)!;
      expect(`#${core.material.color.getHexString()}`).toBe(legend.color);
      expect(core.material.dashed).toBe(legend.dashed);
      expect(display.caption).toHaveBeenCalledWith(legend.glyph, legend.color, 0.24);
      expect(core.material.dashSize).toBe(ASPECT_STYLE[type].dashSize);
    }
  });
});
