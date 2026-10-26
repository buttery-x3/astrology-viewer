import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EphemerisEngine, EPHEMERIS_FILES, HOUSE_SYSTEMS, type EphemerisSnapshot, type HouseSystemId } from '../../src/lib/astronomy/ephemeris';
import { equatorialToEcliptic, fixedToEquatorialOfDate, signedAngularDifferenceDegrees, threeToAstronomical, vectorToEquatorial } from '../../src/lib/astronomy/coordinates';
import { DEFAULT_CONSTRUCTION } from '../../src/lib/domain/house-construction';
import { createConstructionRenderer } from '../../src/lib/scene/construction-renderer';
import { CONSTRUCTION_LEGEND } from '../../src/lib/scene/construction-style';

let engine: EphemerisEngine, snapshot: EphemerisSnapshot;
beforeAll(async () => {
  engine = await EphemerisEngine.create({
    wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
    files: new Map(await Promise.all(EPHEMERIS_FILES.map(async file => [file.name, new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
  });
  snapshot = engine.calculate(Date.UTC(2000, 0, 1, 12), { latitudeDeg: 51.5, longitudeDeg: 0 });
});
afterAll(() => engine?.close());
const RADIUS = 5.8;
const settings = { ...DEFAULT_CONSTRUCTION, enabled: true, boundaryHouse: 11 };
const interaction = { visible: true, hoveredGuideId: null };
function primary(system: HouseSystemId) {
  return { ...snapshot, houses: [snapshot.houses.find(result => result.system === system)!] };
}
function renderer() {
  const caption = vi.fn((_text: string, _color: string, size: number) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial()); sprite.scale.setScalar(size); return sprite;
  });
  return Object.assign(createConstructionRenderer(RADIUS, caption), { caption });
}
function line(group: THREE.Group, suffix: string) {
  const match = group.children.find(object => object instanceof THREE.Line && object.name.endsWith(suffix));
  if (!(match instanceof THREE.Line)) throw new Error(`Missing ${suffix}`);
  return match as THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
}
function marker(group: THREE.Group, suffix: string) {
  const match = group.children.find(object => object instanceof THREE.Mesh && object.name.endsWith(suffix));
  if (!(match instanceof THREE.Mesh)) throw new Error(`Missing ${suffix}`);
  return match;
}

describe('validated system-specific construction rendering', () => {
  for (const { id: system } of HOUSE_SYSTEMS) it(`${system} shows three stages and focuses the actual cusp in the fixed frame`, () => {
    const display = createConstructionRenderer(RADIUS, () => new THREE.Sprite(new THREE.SpriteMaterial()));
    const sky = primary(system);
    display.update(sky, { ...settings, stage: 0 }, interaction);
    expect(display.result?.status).toBe('valid');
    expect(display.group.visible).toBe(true);
    expect(marker(display.group, ':intersection').visible).toBe(false);
    const result = display.result;
    display.update(sky, { ...settings, stage: 1 }, interaction);
    expect(display.result).toBe(result);
    expect(marker(display.group, ':sweep').visible).toBe(true);
    expect(marker(display.group, ':intersection').visible).toBe(false);
    display.update(sky, { ...settings, stage: 2 }, interaction);
    expect(marker(display.group, ':intersection').visible).toBe(true);
    const ecliptic = equatorialToEcliptic(vectorToEquatorial(fixedToEquatorialOfDate(threeToAstronomical(display.focusAnchor!), sky.frame)), sky.trueObliquityDeg);
    expect(Math.abs(signedAngularDifferenceDegrees(ecliptic.longitudeDeg, display.result!.nativeCuspDeg!))).toBeLessThan(0.01);
    expect(ecliptic.latitudeDeg).toBeCloseTo(0, 10);
    expect(display.hitTargets.filter(target => target.visible).every(target => target.userData.entityId === 'boundary:11')).toBe(true);
  });

  it('preserves the Placidus cusp declination small circle rather than rendering a generic wedge', () => {
    const display = createConstructionRenderer(RADIUS, () => new THREE.Sprite(new THREE.SpriteMaterial()));
    const sky = primary('P'); display.update(sky, settings, interaction);
    const path = line(display.group, ':declination-circle');
    const positions = path.geometry.getAttribute('position');
    const declinations: number[] = [];
    for (let index = 0; index < path.geometry.drawRange.count; index++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, index);
      declinations.push(vectorToEquatorial(fixedToEquatorialOfDate(threeToAstronomical(point), sky.frame)).declinationDeg);
    }
    expect(Math.abs(display.result!.timing!.declinationDeg!)).toBeGreaterThan(5);
    expect(Math.max(...declinations) - Math.min(...declinations)).toBeLessThan(0.00001);
    expect(declinations[0]).toBeCloseTo(display.result!.timing!.declinationDeg!, 5);
    expect(display.group.children.every(object => !(object instanceof THREE.Mesh) || object.geometry instanceof THREE.OctahedronGeometry)).toBe(true);
  });

  it('moves the Koch shifted horizon while retaining chart values, final cusp and GPU buffers', () => {
    const display = renderer(), sky = primary('K');
    const original = JSON.stringify(sky);
    display.update(sky, { ...settings, progress: 0 }, interaction);
    const horizon = line(display.group, ':shifted-horizon');
    const geometry = horizon.geometry, vertices = geometry.getAttribute('position').array, distances = geometry.getAttribute('lineDistance').array;
    const initial = Array.from(vertices), final = marker(display.group, ':intersection').position.clone();
    const captions = display.caption.mock.calls.length;
    display.update(sky, { ...settings, progress: 1 }, interaction);
    expect(horizon.geometry).toBe(geometry);
    expect(horizon.geometry.getAttribute('position').array).toBe(vertices);
    expect(horizon.geometry.getAttribute('lineDistance').array).toBe(distances);
    expect(Array.from(vertices)).not.toEqual(initial);
    expect(marker(display.group, ':intersection').position).toEqual(final);
    expect(display.caption.mock.calls.length).toBe(captions);
    expect(JSON.stringify(sky)).toBe(original);
  });

  it('uploads a hidden sweep revision when the construction becomes visible again', () => {
    const display = createConstructionRenderer(RADIUS, () => new THREE.Sprite(new THREE.SpriteMaterial()));
    const sky = primary('K');
    display.update(sky, { ...settings, progress: 0 }, interaction);
    const horizon = line(display.group, ':shifted-horizon');
    const initial = Array.from(horizon.geometry.getAttribute('position').array);
    display.update(sky, { ...settings, progress: 0.5 }, { ...interaction, visible: false });
    expect(display.group.visible).toBe(false);
    display.update(sky, { ...settings, progress: 0.5 }, interaction);
    expect(display.group.visible).toBe(true);
    expect(Array.from(horizon.geometry.getAttribute('position').array)).not.toEqual(initial);
  });

  it('uses the same role colours and dash meanings as the live legend', () => {
    const display = createConstructionRenderer(RADIUS, () => new THREE.Sprite(new THREE.SpriteMaterial()));
    const seen = new Set<string>();
    for (const system of ['W', 'R', 'P'] as const) {
      display.update(primary(system), settings, interaction);
      for (const object of display.group.children) if (object instanceof THREE.Line && object.visible) {
        const legend = CONSTRUCTION_LEGEND.find(entry => entry.kind === object.userData.constructionKind)!;
        const material = object.material as THREE.LineDashedMaterial;
        expect(material.color.getHexString()).toBe(legend.color.slice(1));
        expect(material.gapSize > 0).toBe(legend.dashed);
        seen.add(legend.kind);
      }
    }
    expect(seen).toEqual(new Set(CONSTRUCTION_LEGEND.map(entry => entry.kind)));
  });

  it('withholds failed or incomplete guides and recovers without stale geometry', () => {
    const display = createConstructionRenderer(RADIUS, () => new THREE.Sprite(new THREE.SpriteMaterial()));
    display.update(primary('P'), settings, interaction);
    display.update({ ...snapshot, houses: [{ system: 'P', status: 'undefined', reason: 'Polar substitute discarded' }] }, settings, interaction);
    expect(display.result?.status).toBe('undefined'); expect(display.group.visible).toBe(false); expect(display.focusAnchor).toBeNull();
    expect(display.hitTargets.every(target => !target.visible)).toBe(true);
    const incorrect = structuredClone(primary('P'));
    if (incorrect.houses[0]!.status !== 'valid') throw new Error('Expected a valid fixture.');
    incorrect.houses[0]!.cusps[10]! += 2;
    display.update(incorrect, settings, interaction);
    expect(display.result?.status).toBe('incomplete'); expect(display.group.visible).toBe(false);
    expect(display.hitTargets.every(target => !target.visible)).toBe(true);
    display.update(primary('P'), settings, interaction);
    expect(display.result?.status).toBe('valid'); expect(display.group.visible).toBe(true);
    display.update(primary('P'), { ...settings, enabled: false }, interaction);
    expect(display.group.visible).toBe(false);
    expect(display.hitTargets.filter(target => target instanceof THREE.Sprite).every(target => !target.userData.labelEnabled)).toBe(true);
  });
});
