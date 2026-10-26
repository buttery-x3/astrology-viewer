import { describe, expect, it } from 'vitest';
import { findConstellationRegion } from '../../src/lib/domain/constellation-picking';
import { sphericalToVector } from '../../src/lib/astronomy/coordinates';
import { CATALOGUE_STARS, CONSTELLATION_REGIONS, catalogueStarDirection } from '../../src/lib/scene/sky-data';

describe('fixed-J2000 constellation region interior lookup', () => {
  it('finds every one of the89 declared region centres, including both Serpens pieces', () => {
    expect(CONSTELLATION_REGIONS).toHaveLength(89);
    for (const region of CONSTELLATION_REGIONS) expect(findConstellationRegion(region.centre), region.abbreviation).toBe(region.id);
    expect(CONSTELLATION_REGIONS.filter(region => region.id === 'constellation:ser')).toHaveLength(2);
  });

  for (const [name, expected] of [['Betelgeuse', 'ori'], ['Rigel', 'ori'], ['Sirius', 'cma'], ['Polaris', 'umi'], ['Rigil Kentaurus', 'cen'], ['Toliman', 'cen'], ['Polaris Australis', 'oct']] as const) {
    it(`classifies the actual catalogue J2000 direction of${name}`, () => {
      const star = CATALOGUE_STARS.find(star => star[1] === name);
      expect(star).toBeDefined();
      expect(findConstellationRegion(catalogueStarDirection(star!, 2451545))).toBe(`constellation:${expected}`);
    });
  }

  it('handles both celestial poles and their near-pole neighbourhoods without an arbitrary RA seam', () => {
    expect(findConstellationRegion({ x: 0, y: 0, z: 1 })).toBe('constellation:umi');
    expect(findConstellationRegion({ x: 0, y: 0, z: -1 })).toBe('constellation:oct');
    for (const longitudeDeg of [0, 90, 180, 270, 359.99999]) {
      expect(findConstellationRegion(sphericalToVector({ longitudeDeg, latitudeDeg: 89.999 }))).toBe('constellation:umi');
      expect(findConstellationRegion(sphericalToVector({ longitudeDeg, latitudeDeg: -89.999 }))).toBe('constellation:oct');
    }
  });

  it('is continuous across RA0/360 and the ±180° representation of the dateline', () => {
    for (const latitudeDeg of [-80, -45, -10, 0, 20, 50, 80]) {
      const zero = findConstellationRegion(sphericalToVector({ longitudeDeg: 0, latitudeDeg }));
      expect(zero).not.toBeNull();
      expect(findConstellationRegion(sphericalToVector({ longitudeDeg: -1e-7, latitudeDeg }))).toBe(zero);
      expect(findConstellationRegion(sphericalToVector({ longitudeDeg: 1e-7, latitudeDeg }))).toBe(zero);
      expect(findConstellationRegion(sphericalToVector({ longitudeDeg: -180, latitudeDeg }))).toBe(findConstellationRegion(sphericalToVector({ longitudeDeg: 180, latitudeDeg })));
    }
  });

  it('covers a full-sky grid and does not confuse a region with its antipodal projection', () => {
    for (let latitudeDeg = -85; latitudeDeg <= 85; latitudeDeg += 10) for (let longitudeDeg = 0; longitudeDeg < 360; longitudeDeg += 10) {
      expect(findConstellationRegion(sphericalToVector({ longitudeDeg, latitudeDeg })), `${longitudeDeg}/${latitudeDeg}`).not.toBeNull();
    }
    for (const region of CONSTELLATION_REGIONS) {
      const opposite = { x: -region.centre.x, y: -region.centre.y, z: -region.centre.z };
      expect(findConstellationRegion(opposite), region.abbreviation).not.toBe(region.id);
    }
  });

  it('has deterministic shared-edge ownership and supports non-unit, huge and subnormal directions', () => {
    for (const region of CONSTELLATION_REGIONS) {
      const vertex = region.points[0]!;
      expect(findConstellationRegion(vertex)).not.toBeNull();
      expect(findConstellationRegion({ x: region.centre.x * 10, y: region.centre.y * 10, z: region.centre.z * 10 })).toBe(region.id);
    }
    expect(findConstellationRegion({ x: 0, y: 0, z: Number.MAX_VALUE })).toBe('constellation:umi');
    expect(findConstellationRegion({ x: 0, y: 0, z: -Number.MIN_VALUE })).toBe('constellation:oct');
    // This source vertex is the shared AND/LAC/PEG corner. Ownership follows
    // lexical ID order, independently of which boundary supplied the hit.
    const corner = CONSTELLATION_REGIONS.find(region => region.abbreviation === 'AND')!.points[0]!;
    for (const abbreviation of ['AND', 'LAC', 'PEG']) {
      const region = CONSTELLATION_REGIONS.find(region => region.abbreviation === abbreviation)!;
      expect(region.points.some(point => Math.hypot(point.x - corner.x, point.y - corner.y, point.z - corner.z) < 1e-12)).toBe(true);
    }
    expect(findConstellationRegion(corner)).toBe('constellation:and');
  });

  it('rejects zero and non-finite vectors without inventing a nearest region', () => {
    for (const invalid of [{ x: 0, y: 0, z: 0 }, { x: NaN, y: 1, z: 0 }, { x: Infinity, y: 0, z: 1 }, { x: 1, y: 0, z: -Infinity }]) expect(findConstellationRegion(invalid)).toBeNull();
  });
});
