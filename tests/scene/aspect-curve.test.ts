import { describe, expect, it } from 'vitest';
import { buildAspectCurve } from '../../src/lib/scene/aspect-curve';
import { equatorialToVector } from '../../src/lib/astronomy/coordinates';

const radius = 5.8;
const direction = (ra: number, dec = 0) => equatorialToVector({ rightAscensionDeg: ra, declinationDeg: dec });
const length = (point: { x: number; y: number; z: number }) => Math.hypot(point.x, point.y, point.z);

describe('aspect display routes', () => {
  it('keeps actual latitude-bearing endpoints and does not substitute longitude anchors', () => {
    const first = direction(40, 13), second = direction(100, -9);
    const curve = buildAspectCurve(first, second, 'sextile', radius);
    expect(curve.points[0]).toEqual({ x: first.x * radius, y: first.y * radius, z: first.z * radius });
    expect(curve.points.at(-1)).toEqual({ x: second.x * radius, y: second.y * radius, z: second.z * radius });
    expect(curve.points.every(point => Number.isFinite(length(point)))).toBe(true);
    expect(curve.focusRadius).toBeGreaterThan(radius * 0.4);
  });

  for (const declination of [0, 90, -90]) it(`leaves a nonzero pickable conjunction bracket at coincident ${declination}° endpoints`, () => {
    const first = direction(0, declination);
    const curve = buildAspectCurve(first, first, 'conjunction', radius);
    expect(curve.points[0]).toEqual(curve.points.at(-1));
    expect(Math.hypot(curve.anchor.x - curve.points[0]!.x, curve.anchor.y - curve.points[0]!.y, curve.anchor.z - curve.points[0]!.z)).toBeGreaterThan(0.2);
    for (let index = 1; index < curve.points.length; index++) {
      const a = curve.points[index - 1]!, b = curve.points[index]!;
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(0.0001);
    }
  });

  for (const separation of [174, 179.99999, 180, 186]) it(`routes a ${separation}° opposition around the opaque Earth`, () => {
    const curve = buildAspectCurve(direction(0), direction(separation), 'opposition', radius);
    // Earth radius is 0.82; this display curve must not be an occluded diameter.
    expect(Math.min(...curve.points.map(length))).toBeGreaterThan(1.5);
    expect(curve.points.every(point => Number.isFinite(length(point)))).toBe(true);
    expect(curve.focusRadius).toBeGreaterThan(5);
  });

  it('rejects invalid display radii', () => {
    expect(() => buildAspectCurve(direction(0), direction(60), 'sextile', 0)).toThrow(RangeError);
  });
});
