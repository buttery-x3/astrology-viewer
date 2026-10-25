import { describe, expect, it } from 'vitest';
import { buildTimedTrailStrokes, type TimedTrailPoint } from '../../src/lib/scene/trail-path';

const sample = (instantMs: number, degrees: number, isCurrent = false): TimedTrailPoint => ({ instantMs, point: { x: Math.cos(degrees * Math.PI / 180), y: Math.sin(degrees * Math.PI / 180), z: 0 }, isCurrent });

describe('trail stroke timing and discontinuities', () => {
  it('fades past paths in order, gives future paths a separate bucket, and retains exact current endpoints', () => {
    const current = sample(0, 0, true);
    const points = [sample(-100, 350), sample(-75, 352), sample(-50, 355), sample(-25, 358), current, sample(50, 5), sample(100, 10)];
    const result = buildTimedTrailStrokes([points], 0, 5.8);
    expect(result.buckets.map(bucket => bucket.length)).toEqual([1, 1, 1, 1, 2]);
    expect(result.buckets[3]![0]!.end).toEqual({ x: 5.8, y: 0, z: 0 });
    expect(result.buckets[4]![0]!.start).toEqual({ x: 5.8, y: 0, z: 0 });
    expect(result.decorations.length).toBeLessThanOrEqual(7);
    for (const decoration of result.decorations) {
      const [tail, tip] = decoration.arrow;
      const tangent = { x: -decoration.sample.point.y, y: decoration.sample.point.x, z: 0 };
      expect((tip.x - tail.x) * tangent.x + (tip.y - tail.y) * tangent.y).toBeGreaterThan(0);
    }
  });

  it('never bridges separate computed pieces or a singleton current point beyond a limited interval', () => {
    const first = [sample(-100, 0), sample(-90, 1)];
    const second = [sample(-50, 30), sample(-40, 31)];
    const exact = sample(0, 40, true);
    const result = buildTimedTrailStrokes([first, second, [exact]], 0, 1);
    const strokes = result.buckets.flat();
    expect(strokes).toHaveLength(2);
    expect(strokes.every(stroke => Math.hypot(stroke.start.x - stroke.end.x, stroke.start.y - stroke.end.y) < 0.02)).toBe(true);
    expect(result.first?.instantMs).toBe(-100); expect(result.last?.instantMs).toBe(-40);
    expect(result.decorations.every(decoration => decoration.sample.instantMs !== 0)).toBe(true);
    expect(result.buckets[4]).toHaveLength(0);
  });

  it('treats wrapped longitude as a continuous short 3D path', () => {
    const result = buildTimedTrailStrokes([[sample(-1, 359), sample(0, 0, true), sample(1, 1)]], 0, 1);
    expect(result.buckets.flat()).toHaveLength(2);
    expect(result.buckets.flat().every(stroke => stroke.distanceEnd - stroke.distanceStart < 0.02)).toBe(true);
  });

  it('omits zero-length stationary lines and invalid arrow tangents', () => {
    const result = buildTimedTrailStrokes([[sample(-1, 30), sample(0, 30, true), sample(1, 30)]], 0, 1);
    expect(result.buckets.flat()).toHaveLength(0); expect(result.decorations).toHaveLength(0);
  });
});
