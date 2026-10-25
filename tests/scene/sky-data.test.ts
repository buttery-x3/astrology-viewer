import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { vectorToEquatorial } from '../../src/lib/astronomy/coordinates';
import { CATALOGUE_STARS, CONSTELLATIONS, CONSTELLATION_REGIONS, SKY_DATA_SOURCES, catalogueStarDirection } from '../../src/lib/scene/sky-data';
import manifest from '../../src/lib/scene/data/sky-data-manifest.json';

describe('declared-frame real sky assets', () => {
  it('keeps derived bytes reproducible and separately attributed under CC BY-SA 4.0', () => {
    for (const asset of manifest.assets) {
      const bytes = readFileSync(`src/lib/scene/data/${asset.file}`);
      expect(bytes.length).toBe(asset.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    }
    expect(SKY_DATA_SOURCES.stars.license).toBe('CC-BY-SA-4.0');
    expect(SKY_DATA_SOURCES.constellations.license).toBe('CC-BY-SA-4.0');
    expect(manifest.sources[0]!.url).toContain('c7f7f883fe678cc7680169a50ccd7dcc49b060ce');
  });

  it('contains a restrained actual bright-star catalogue, without a second Sun', () => {
    expect(CATALOGUE_STARS).toHaveLength(2865);
    expect(new Set(CATALOGUE_STARS.map(star => star[0])).size).toBe(CATALOGUE_STARS.length);
    expect(CATALOGUE_STARS.every(star => star[0] > 0 && Number.isFinite(star[2]) && star[2] <= 5.5)).toBe(true);
    for (const star of CATALOGUE_STARS) {
      const direction = catalogueStarDirection(star, 2451545);
      expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 12);
    }
  });

  it('places Sirius at its known J2000 catalogue direction, without an of-date rotation', () => {
    const sirius = CATALOGUE_STARS.find(star => star[1] === 'Sirius')!;
    const direction = vectorToEquatorial(catalogueStarDirection(sirius, 2451545));
    expect(direction.rightAscensionDeg).toBeCloseTo(101.2872, 3);
    expect(direction.declinationDeg).toBeCloseTo(-16.7161, 3);
  });

  it('propagates the measured fast motion of Arcturus across a century in J2000 axes', () => {
    const star = CATALOGUE_STARS.find(value => value[1] === 'Arcturus')!;
    const before = catalogueStarDirection(star, 2451545);
    const after = catalogueStarDirection(star, 2451545 + 36525);
    const arcseconds = Math.acos(before.x * after.x + before.y * after.y + before.z * after.z) * 180 / Math.PI * 3600;
    // Arcturus moves about 2.28 arcseconds per year, mostly southward.
    expect(arcseconds).toBeGreaterThan(220);
    expect(arcseconds).toBeLessThan(240);
    expect(vectorToEquatorial(after).declinationDeg).toBeLessThan(vectorToEquatorial(before).declinationDeg);
    expect(() => catalogueStarDirection(star, NaN)).toThrow(/finite/);
  });

  it('retains all 88 real regions and both separated pieces of Serpens', () => {
    expect(CONSTELLATIONS).toHaveLength(88);
    expect(CONSTELLATION_REGIONS).toHaveLength(89);
    expect(new Set(CONSTELLATION_REGIONS.map(region => region.id))).toEqual(new Set(CONSTELLATIONS.map(region => region.id)));
    expect(CONSTELLATION_REGIONS.filter(region => region.id === 'constellation:ser')).toHaveLength(2);
    expect(CONSTELLATIONS.find(region => region.id === 'constellation:oph')?.name).toBe('Ophiuchus');
    for (const region of CONSTELLATION_REGIONS) {
      expect(region.points.length).toBeGreaterThan(3);
      expect(region.name).toBeTruthy();
      expect(Math.hypot(region.centre.x, region.centre.y, region.centre.z)).toBeCloseTo(1, 12);
      for (let index = 1; index < region.points.length; index++) {
        const a = region.points[index - 1]!, b = region.points[index]!;
        const step = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))) * 180 / Math.PI;
        // Preserve the author's small-circle interpolation rather than connect
        // only distant B1875 endpoints with an incorrect great-circle shortcut.
        expect(step).toBeLessThan(2.01);
      }
    }
  });
});
