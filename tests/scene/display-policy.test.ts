import { describe, expect, it } from 'vitest';
import { earthOccludes, nearbyPointCandidates, scenePixelRatio } from '../../src/lib/scene/display-policy';
import { placeLabels } from '../../src/lib/scene/label-layout';

describe('scene display policy', () => {
  it('caps Auto/Low/High pixel work while respecting a lower device ratio', () => {
    expect(scenePixelRatio(3, 'auto')).toBe(1.5);
    expect(scenePixelRatio(3, 'low')).toBe(1);
    expect(scenePixelRatio(3, 'high')).toBe(2);
    expect(scenePixelRatio(1, 'high')).toBe(1);
    expect(scenePixelRatio(NaN, 'auto')).toBe(1);
  });
  it('uses the same opaque threshold for Earth labels and picking, keeping the explicit globe picker solid', () => {
    expect(earthOccludes(1)).toBe(true); expect(earthOccludes(0.999)).toBe(true);
    expect(earthOccludes(0.5)).toBe(false); expect(earthOccludes(0)).toBe(false);
    expect(earthOccludes(0.2, true)).toBe(true);
  });
  it('offers only genuinely nearby point identities, deduplicated in actual picking order', () => {
    const candidates = [
      { id: 'body:sun', name: 'Sun', x: 100, y: 100, pointLike: true },
      { id: 'body:sun', name: 'Sun label', x: 100, y: 100, pointLike: true },
      { id: 'body:moon', name: 'Moon', x: 104, y: 102, pointLike: true },
      { id: 'angle:asc', name: 'ASC', x: 107, y: 100, pointLike: true },
      { id: 'reference:horizon', name: 'Horizon', x: 100, y: 100, pointLike: false },
    ];
    expect(nearbyPointCandidates(candidates)).toEqual([{ id: 'body:sun', name: 'Sun' }, { id: 'body:moon', name: 'Moon' }]);
    expect(nearbyPointCandidates([candidates[4]!, ...candidates])).toEqual([]);
  });
});

describe('readable bounded label layout', () => {
  it('moves overlapping marker captions while preserving the selected caption and input anchors', () => {
    const labels = [
      { id: 1, x: 200, y: 100, width: 40, height: 20, priority: 100, movable: true },
      { id: 2, x: 200, y: 100, width: 40, height: 20, priority: 30, movable: true },
    ];
    const before = JSON.stringify(labels), result = placeLabels(labels, 400, 300);
    expect(result).toHaveLength(2); expect(result[0]).toEqual({ id: 1, x: 200, y: 100 });
    expect(result[1]?.y).not.toBe(100); expect(JSON.stringify(labels)).toBe(before);
  });
  it('clamps movable captions inside the viewport and culls nonmovable collisions', () => {
    const result = placeLabels([
      { id: 1, x: 2, y: 2, width: 80, height: 30, priority: 100, movable: true },
      { id: 2, x: 44, y: 19, width: 80, height: 30, priority: 20, movable: false },
    ], 200, 100);
    expect(result).toEqual([{ id: 1, x: 44, y: 19 }]);
  });
  it('keeps scaled large labels apart with no overlap or out-of-frame rectangles', () => {
    const labels = Array.from({ length: 8 }, (_, id) => ({ id, x: 150 + id * 12, y: 120, width: 70, height: 32, priority: 30 - id, movable: true }));
    const result = placeLabels(labels, 400, 250);
    expect(result.length).toBeGreaterThan(3);
    for (const [index, value] of result.entries()) {
      expect(value.x - 35).toBeGreaterThanOrEqual(4); expect(value.x + 35).toBeLessThanOrEqual(396);
      expect(value.y - 16).toBeGreaterThanOrEqual(4); expect(value.y + 16).toBeLessThanOrEqual(246);
      for (const other of result.slice(index + 1)) expect(Math.abs(value.x - other.x) >= 76 || Math.abs(value.y - other.y) >= 38).toBe(true);
    }
  });
});
