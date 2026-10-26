import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createEquatorialFrameTransform, IDENTITY_MATRIX3 } from '../../src/lib/astronomy/coordinates';
import type { EphemerisSnapshot, HouseResult } from '../../src/lib/astronomy/ephemeris';
import { DEFAULT_HOUSE_DISPLAY } from '../../src/lib/domain/house-geometry';
import { createHouseRenderer } from '../../src/lib/scene/house-renderer';
import fixtures from '../fixtures/native-swiss.json';

const RADIUS = 5.8;
function houses(start = 0): Extract<HouseResult, { status: 'valid' }> {
  return { system: 'E', status: 'valid', cusps: Array.from({ length: 12 }, (_, index) => (start + index * 30) % 360), ascendantDeg: start, midheavenDeg: 270, armcDeg: 270 };
}
function sky(results: HouseResult[] = [houses()]): EphemerisSnapshot {
  return {
    instantMs: Date.UTC(2000, 0, 1, 12), trueObliquityDeg: 23.439,
    frame: createEquatorialFrameTransform({ rotation: IDENTITY_MATRIX3, julianDateTt: 2451545, ofDateKind: 'true', source: 'Analytic display fixture' }),
    bodies: [{ id: 'mars', longitudeDeg: 45, fixedEquatorial: { rightAscensionDeg: 42, declinationDeg: 20 } }],
    houses: results,
  } as EphemerisSnapshot;
}
function renderer() {
  return createHouseRenderer(RADIUS, (_text, _color, size) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial()); sprite.scale.setScalar(size); return sprite;
  });
}
const interaction = { selectedId: 'house:1', hoveredId: null, visible: true };
const settings = { ...DEFAULT_HOUSE_DISPLAY };
function named<T extends THREE.Object3D>(group: THREE.Group, name: string): T {
  const object = group.getObjectByName(name);
  if (!object) throw new Error(`Missing ${name}`);
  return object as T;
}

describe('house renderer presentation invariants', () => {
  it('links projected house/cusp selections to the same primary sky shell without linking comparison cusps', () => {
    const display=renderer(),snapshot=sky();
    for(const selectedId of ['earth:house:primary:7','earth:boundary:primary:7','house:7']) {
      display.update(snapshot,settings,{...interaction,selectedId});
      expect(display.group.userData.highlightedHouse).toBe('house:7');
      const shell=named<THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>>(display.group,'House 7 outer surface');
      expect(shell.material.color.getHex()).toBe(0xf1d79d);
      expect(shell.material.visible).toBe(true);
    }
    display.update(snapshot,settings,{...interaction,selectedId:'boundary:comparison:7'});
    expect(display.group.userData.highlightedHouse).toBeNull();
  });
  for (const result of fixtures.cases[0]!.observers[0]!.houses) for (const mode of ['volumes', 'arcs', 'shells'] as const) {
    it(`renders native ${result.system} cusps in ${mode} without changing membership or body positions`, () => {
      const display = renderer(), snapshot = sky([result as HouseResult]);
      const original = JSON.stringify(snapshot);
      display.update(snapshot, { ...settings, mode, hybrid: false, contextFill: true }, interaction);
      expect(display.entities.every(entity => entity.valid)).toBe(true);
      const surface = named<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(display.group, 'House 1 outer surface');
      expect(surface.geometry.drawRange.count).toBeGreaterThan(0);
      expect(surface.material.visible).toBe(mode !== 'volumes');
      expect(named(display.group, 'House 1 radial volume').visible).toBe(mode === 'volumes');
      expect(JSON.stringify(snapshot)).toBe(original);
    });
  }
  it('keeps 24 indexed entities, body directions, and typed mesh buffers across modes', () => {
    const display = renderer(), snapshot = sky();
    const before = JSON.stringify(snapshot);
    const surface = named<THREE.Mesh>(display.group, 'House 1 outer surface');
    display.update(snapshot, settings, interaction);
    const geometry = surface.geometry, positions = geometry.getAttribute('position').array;
    expect(display.entities.filter(entity => entity.kind === 'house').map(entity => entity.id)).toEqual(Array.from({ length: 12 }, (_, index) => `house:${index + 1}`));
    expect(display.entities.filter(entity => entity.kind === 'boundary').map(entity => entity.id)).toEqual(Array.from({ length: 12 }, (_, index) => `boundary:${index + 1}`));
    for (const mode of ['arcs', 'volumes', 'shells'] as const) {
      display.update(snapshot, { ...settings, mode, opacity: 0.5, contextFill: true }, interaction);
      expect(display.entities.every(entity => entity.valid)).toBe(true);
      expect(surface.geometry).toBe(geometry);
      expect(surface.geometry.getAttribute('position').array).toBe(positions);
      expect(JSON.stringify(snapshot)).toBe(before);
    }
  });

  it('reuses buffers on changed snapshots and disposes a geometry only when capacity must grow', () => {
    const display = renderer();
    display.update(sky(), settings, interaction);
    const surface = named<THREE.Mesh>(display.group, 'House 1 outer surface');
    const original = surface.geometry, values = original.getAttribute('position').array;
    const first = Array.from(values);
    display.update(sky([houses(3)]), settings, interaction);
    expect(surface.geometry).toBe(original);
    expect(surface.geometry.getAttribute('position').array).toBe(values);
    expect(Array.from(values)).not.toEqual(first);
    const dispose = vi.fn(); original.addEventListener('dispose', dispose);
    const uneven = houses(); uneven.cusps = [0, ...Array.from({ length: 11 }, (_, index) => 180 + index * 180 / 11)];
    display.update(sky([uneven]), settings, interaction);
    expect(surface.geometry).not.toBe(original);
    expect(dispose).toHaveBeenCalledOnce();
    const expanded = surface.geometry;
    display.update(sky([uneven]), { ...settings, mode: 'shells' }, interaction);
    expect(surface.geometry).toBe(expanded);
  });

  it('lifts only the selected shell and retains radial leaders to the original region', () => {
    const display = renderer(), snapshot = sky();
    const originalBodies = structuredClone(snapshot.bodies);
    display.update(snapshot, { ...settings, mode: 'shells', shellSeparation: 0.2 }, interaction);
    const first = named<THREE.Mesh>(display.group, 'House 1 outer surface');
    const second = named<THREE.Mesh>(display.group, 'House 2 outer surface');
    expect(first.scale.x - second.scale.x).toBeCloseTo(RADIUS * 0.2, 12);
    const guides = named<THREE.LineSegments>(display.group, 'House 1 shell return guides');
    expect(guides.visible).toBe(true);
    expect(named(display.group, 'House 1 original outline').visible).toBe(true);
    const points = guides.geometry.getAttribute('position');
    for (let index = 0; index < guides.geometry.drawRange.count - 2; index += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(points, index), b = new THREE.Vector3().fromBufferAttribute(points, index + 1);
      expect(b.length() - a.length()).toBeCloseTo(RADIUS * 0.2, 5);
      expect(a.clone().normalize().dot(b.clone().normalize())).toBeCloseTo(1, 10);
    }
    expect(snapshot.bodies).toEqual(originalBodies);
    display.update(snapshot, { ...settings, mode: 'shells', shellSeparation: 0 }, interaction);
    expect(guides.visible).toBe(false);
    expect(first.scale.x).toBe(second.scale.x);
  });

  it('keeps outer region hit proxies and cusp curves available at zero fill opacity', () => {
    const display = renderer();
    display.update(sky(), { ...settings, opacity: 0, mode: 'volumes' }, interaction);
    const surface = named<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(display.group, 'House 1 outer surface');
    expect(surface.visible).toBe(true);
    expect(surface.material.visible).toBe(false);
    expect(named(display.group, 'House 1 radial volume').visible).toBe(false);
    const boundary = display.entities.find(entity => entity.id === 'boundary:1')!;
    expect(boundary.objects[0]!.visible).toBe(true);
    expect(boundary.lines[0]!.userData.pickable).toBe(false);
    expect(boundary.label!.userData.labelEnabled).toBe(false);
    display.update(sky(), settings, { ...interaction, selectedId: 'boundary:1' });
    expect(boundary.label!.userData.labelEnabled).toBe(true);
  });

  it('links a selected body to its primary house and shows only changed comparison boundaries by default', () => {
    const display = renderer(), secondary = houses();
    secondary.cusps = secondary.cusps.map((value, index) => value + (index % 3 ? 2 : 0));
    display.update(sky([houses(), secondary]), settings, { ...interaction, selectedId: 'body:mars' });
    expect(display.group.userData.highlightedHouse).toBe('house:2');
    const comparison = named<THREE.Group>(display.group, 'Comparison houses');
    const ghost = named<THREE.Line>(display.group, 'Comparison boundary 2');
    const distanceBuffer = ghost.geometry.getAttribute('lineDistance').array;
    expect(comparison.children.filter(child => child instanceof THREE.Line && child.visible)).toHaveLength(8);
    display.update(sky([houses(), secondary]), { ...settings, comparisonChangesOnly: false }, interaction);
    expect(comparison.children.filter(child => child instanceof THREE.Line && child.visible)).toHaveLength(12);
    expect(ghost.geometry.getAttribute('lineDistance').array).toBe(distanceBuffer);
  });

  it('hides only unavailable overlays and never installs substitute regions', () => {
    const display = renderer();
    const unavailable: HouseResult = { system: 'P', status: 'undefined', reason: 'Polar fixture: substitute discarded' };
    display.update(sky([houses(), unavailable]), settings, interaction);
    expect(named(display.group, 'Primary houses').visible).toBe(true);
    expect(named(display.group, 'Comparison houses').visible).toBe(false);
    display.update(sky([unavailable, houses()]), settings, interaction);
    expect(named(display.group, 'Primary houses').visible).toBe(false);
    expect(display.entities.every(entity => !entity.valid)).toBe(true);
    const degenerate = houses(); degenerate.cusps[1] = degenerate.cusps[0]!;
    display.update(sky([degenerate]), settings, interaction);
    expect(named(display.group, 'Primary houses').visible).toBe(false);
    display.update(sky(), settings, interaction);
    expect(display.entities.every(entity => entity.valid)).toBe(true);
  });

  it('quiets comparison outlines during construction and restores their normal contrast', () => {
    const display = renderer(), snapshot = sky([houses(), houses(4)]);
    display.update(snapshot, settings, interaction);
    const ghost = named<THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>>(display.group, 'Comparison boundary 2');
    const normal = ghost.material.opacity;
    display.update(snapshot, settings, { ...interaction, quietComparison: true });
    expect(ghost.material.opacity).toBeLessThan(normal / 2);
    display.update(snapshot, settings, { ...interaction, quietComparison: false });
    expect(ghost.material.opacity).toBe(normal);
  });
});
