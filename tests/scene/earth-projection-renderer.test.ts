import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Line2 } from 'three/addons/lines/Line2.js';
import { createEarthProjectionRenderer } from '../../src/lib/scene/earth-projection-renderer';
import { DEFAULT_EARTH_PROJECTIONS, type EarthProjectionSettings } from '../../src/lib/domain/earth-projections';
import { createEquatorialFrameTransform, IDENTITY_MATRIX3 } from '../../src/lib/astronomy/coordinates';
import { BODY_IDS, type EphemerisSnapshot, type HouseResult } from '../../src/lib/astronomy/ephemeris';
import fixtures from '../fixtures/native-swiss.json';

function snapshot(result: HouseResult = fixtures.cases[0]!.observers[0]!.houses[0] as HouseResult): EphemerisSnapshot {
  return {
    instantMs: Date.UTC(2000, 0, 1, 12), greenwichSiderealTimeDeg: 113.58,
    observer: { latitudeDeg: 51.5, longitudeDeg: 0 }, trueObliquityDeg: 23.439,
    frame: createEquatorialFrameTransform({ rotation: IDENTITY_MATRIX3, julianDateTt: 2451545, ofDateKind: 'true', source: 'Renderer analytic test' }),
    bodies: BODY_IDS.map((id, i) => ({ id, equatorial: { rightAscensionDeg: i * 33, declinationDeg: (i - 5) * 7 } })), houses: [result],
  } as EphemerisSnapshot;
}
const settings = (): EarthProjectionSettings => ({ ...DEFAULT_EARTH_PROJECTIONS, bodies: { ...DEFAULT_EARTH_PROJECTIONS.bodies }, angles: { ...DEFAULT_EARTH_PROJECTIONS.angles } });
function renderer() { return createEarthProjectionRenderer(0.82, (_text, _color, size) => { const sprite = new THREE.Sprite(new THREE.SpriteMaterial()); sprite.scale.setScalar(size); return sprite; }); }
const interaction = { visible: true, selectedId: null, hoveredId: null };
function resources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) geometries.add(object.geometry);
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  }); return { geometries, materials };
}

describe('Earth surface renderer identity and lifecycle', () => {
  it('registers all24 indexed house features and40 geographic lines with independent IDs/roles', () => {
    const display = renderer(), chart = snapshot(), original = JSON.stringify(chart);
    display.update(chart, settings(), interaction);
    expect(display.entities).toHaveLength(64);
    expect(display.entities.filter(entity => entity.kind === 'astro-line' && entity.valid)).toHaveLength(40);
    expect(display.entities.filter(entity => entity.kind === 'earth-house' && entity.valid)).toHaveLength(24);
    expect(new Set(display.entities.map(entity => entity.id)).size).toBe(64);
    for (const target of display.hitTargets) {
      expect(target.userData.featureHit.id).toBe(target.userData.entityId);
      expect(target.userData.featureHit.entityId).toBe(target.userData.entityId);
      expect(target.userData.featureHit.name).toBeTruthy();
      expect(target.userData.featureHit.representation).toBe('earth');
      expect(target.userData.featureHit.role).toMatch(/line|badge|section|boundary/);
    }
    expect(JSON.stringify(chart)).toBe(original); display.dispose();
  });

  it('keeps children and filters independent, including valid astro lines with undefined houses', () => {
    const display = renderer(), chart = snapshot();
    display.update(chart, { ...settings(), houses: false }, interaction);
    expect(display.hitTargets.every(object => object.userData.entityKind === 'astro-line')).toBe(true);
    display.update(chart, { ...settings(), astrocartography: false }, interaction);
    expect(display.hitTargets.every(object => object.userData.entityKind === 'earth-house')).toBe(true);
    const filtered = settings(); filtered.houses = false; filtered.bodies.sun = false; filtered.angles.mc = false;
    display.update(chart, filtered, interaction);
    expect(display.hitTargets.some(object => /astro:sun:|:mc$/.test(object.userData.entityId))).toBe(false);
    const polar = snapshot({ system: 'P', status: 'undefined', reason: 'Native polar undefined' });
    display.update(polar, settings(), interaction);
    expect(display.houseResult).toMatchObject({ status: 'undefined', reason: 'Native polar undefined' });
    expect(display.hitTargets.length).toBeGreaterThan(0);
    expect(display.hitTargets.every(object => object.userData.entityKind === 'astro-line')).toBe(true);
    display.update(polar, { ...settings(), enabled: false }, interaction); expect(display.hitTargets).toHaveLength(0);
    display.dispose();
  });

  it('retains vertex buffers across hover/filter/house and moment changes without moving astro geography', () => {
    const display = renderer(), chart = snapshot(); display.update(chart, settings(), interaction);
    const target = display.entities.find(entity => entity.id === 'astro:moon:ac')!;
    const core = target.objects[0] as Line2;
    const before = Array.from((core.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data.array);
    const geometry = core.geometry, buffers = core.geometry.getAttribute('instanceStart');
    for (const result of fixtures.cases[0]!.observers[0]!.houses) {
      const changed = { ...chart, houses: [result as HouseResult], observer: { latitudeDeg: -33, longitudeDeg: 151 } };
      display.update(changed, settings(), { ...interaction, selectedId: 'astro:moon:ac', hoveredId: 'earth:house:primary:7' });
      expect(core.geometry).toBe(geometry); expect(core.geometry.getAttribute('instanceStart')).toBe(buffers);
      expect(Array.from((core.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data.array)).toEqual(before);
    }
    const firstCounts = resources(display.group);
    for (let index = 0; index < 20; index++) display.update({ ...chart, instantMs: chart.instantMs + index, greenwichSiderealTimeDeg: chart.greenwichSiderealTimeDeg + index * 0.01 }, settings(), interaction);
    const lastCounts = resources(display.group);
    expect(lastCounts.geometries.size).toBe(firstCounts.geometries.size); expect(lastCounts.materials.size).toBe(firstCounts.materials.size);
    expect(core.geometry).toBe(geometry); display.dispose();
  });

  it('updates local front-face labels after orbiting and rejects far-side picks even through transparent Earth', () => {
    const display = renderer(); display.update(snapshot(), settings(), interaction);
    const entity = display.entities.find(entity => entity.id === 'astro:sun:mc')!;
    const camera = new THREE.PerspectiveCamera(); camera.position.copy(entity.anchor).normalize().multiplyScalar(3);
    display.faceCamera(camera); expect(entity.label!.userData.labelEnabled).toBe(true);
    expect(display.isSurfaceHitVisible(entity.anchor)).toBe(true);
    camera.position.negate(); display.faceCamera(camera);
    expect(entity.label!.userData.labelEnabled).toBe(false); expect(display.isSurfaceHitVisible(entity.anchor)).toBe(false);
    camera.position.negate(); display.faceCamera(camera); expect(entity.label!.userData.labelEnabled).toBe(true);
    // Input can arrive between a camera change and the next render. Hit rejection
    // must use the current pose rather than the last label-layout pose.
    camera.position.negate(); expect(display.isSurfaceHitVisible(entity.anchor)).toBe(false);
    display.dispose();
  });

  it('uses pixel-width cores and disposes every owned geometry/material exactly once', () => {
    const display = renderer(); display.update(snapshot(), settings(), interaction); display.resize(1440, 900);
    const line = display.entities.find(entity => entity.kind === 'astro-line')!.objects[0] as Line2;
    expect(line.material.resolution.toArray()).toEqual([1440, 900]);
    const owned = resources(display.group), geometrySpies = [...owned.geometries].map(value => vi.spyOn(value, 'dispose')), materialSpies = [...owned.materials].map(value => vi.spyOn(value, 'dispose'));
    display.dispose(); display.dispose();
    expect(geometrySpies.every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(materialSpies.every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(display.group.children).toHaveLength(0); expect(display.hitTargets).toHaveLength(0);
    display.update(snapshot(), settings(), interaction); expect(display.group.children).toHaveLength(0);
  });

  it('resolves surface visibility under a rotated, translated and uniformly scaled Earth parent', () => {
    const display = renderer(); display.update(snapshot(), settings(), interaction);
    const parent = new THREE.Group(); parent.position.set(3, -2, 4); parent.rotation.set(0.4, 1.1, -0.3); parent.scale.setScalar(1.4); parent.add(display.group);
    const target = display.entities.find(entity => entity.id === 'astro:sun:mc')!;
    const camera = new THREE.PerspectiveCamera();
    parent.updateMatrixWorld(true);
    camera.position.copy(parent.localToWorld(target.anchor.clone().normalize().multiplyScalar(3)));
    display.faceCamera(camera);
    const front = parent.localToWorld(target.anchor.clone()), back = parent.localToWorld(target.anchor.clone().negate());
    expect(display.isSurfaceHitVisible(front)).toBe(true); expect(display.isSurfaceHitVisible(back)).toBe(false);
    expect(target.label!.userData.labelEnabled).toBe(true);
    // A sidereal/date rotation may occur before the next render. The current
    // parent transform must be respected by picking as well as by labels.
    parent.rotateY(Math.PI); parent.updateMatrixWorld(true);
    const rotated = parent.localToWorld(target.anchor.clone());
    expect(display.isSurfaceHitVisible(rotated)).toBe(false);
    display.faceCamera(camera); expect(target.label!.userData.labelEnabled).toBe(false);
    display.dispose(); expect(parent.children).toHaveLength(0);
  });
});
