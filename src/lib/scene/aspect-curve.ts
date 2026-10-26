import { normalizeVector, type Vector3 } from '../astronomy/coordinates';
import type { AspectTypeId } from '../domain/chart';

function add(a: Vector3, b: Vector3): Vector3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale(a: Vector3, amount: number): Vector3 { return { x: a.x * amount, y: a.y * amount, z: a.z * amount }; }
function dot(a: Vector3, b: Vector3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: Vector3, b: Vector3): Vector3 { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function perpendicular(a: Vector3): Vector3 {
  const reference = Math.abs(a.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  return normalizeVector(add(reference, scale(a, -dot(reference, a))));
}

/** A display route with exact actual-body endpoints; this curve is never a measurement. */
export function buildAspectCurve(first: Vector3, second: Vector3, type: AspectTypeId, radius: number): { points: Vector3[]; anchor: Vector3; focusRadius: number } {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Aspect display radius must be positive.');
  const a = normalizeVector(first), b = normalizeVector(second);
  const start = scale(a, radius), end = scale(b, radius);
  const midpoint = scale(add(a, b), 0.5);
  const mean = Math.hypot(midpoint.x, midpoint.y, midpoint.z) > 1e-8 ? normalizeVector(midpoint) : perpendicular(a);
  const tangent = perpendicular(mean), across = normalizeVector(cross(mean, tangent));
  const points: Vector3[] = [];
  if (type === 'conjunction') {
    // This bracket remains a nonzero, selectable loop when both markers coincide.
    const controlA = add(start, add(scale(tangent, radius * 0.055), scale(across, radius * 0.075)));
    const controlB = add(end, add(scale(tangent, -radius * 0.055), scale(across, radius * 0.075)));
    for (let index = 0; index <= 64; index++) {
      const t = index / 64, u = 1 - t;
      points.push(add(add(scale(start, u ** 3), scale(controlA, 3 * u * u * t)), add(scale(controlB, 3 * u * t * t), scale(end, t ** 3))));
    }
  } else {
    // An opposition bows around Earth instead of using a diameter through it.
    const control = type === 'opposition' ? add(scale(perpendicular(a), radius * 0.85), scale(midpoint, radius * 0.35)) : scale(mean, radius * 0.6);
    for (let index = 0; index <= 64; index++) {
      const t = index / 64, u = 1 - t;
      points.push(add(add(scale(start, u * u), scale(control, 2 * u * t)), scale(end, t * t)));
    }
  }
  points[0] = start; points[64] = end;
  const anchor = points[32]!;
  const focusRadius = Math.max(0.35, ...points.map(point => Math.hypot(point.x - anchor.x, point.y - anchor.y, point.z - anchor.z)));
  return { points, anchor, focusRadius };
}
