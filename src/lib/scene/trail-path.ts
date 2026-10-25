import { normalizeVector, type Vector3 } from '../astronomy/coordinates';

export interface TimedTrailPoint { instantMs: number; point: Vector3; isCurrent: boolean }
export interface TrailStroke { start: Vector3; end: Vector3; distanceStart: number; distanceEnd: number }
export interface TrailDecoration { sample: TimedTrailPoint; tick: [Vector3, Vector3]; arrow: [Vector3, Vector3, Vector3, Vector3] }
const scale = (point: Vector3, amount: number): Vector3 => ({ x: point.x * amount, y: point.y * amount, z: point.z * amount });
const add = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const difference = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const length = (value: Vector3): number => Math.hypot(value.x, value.y, value.z);
const cross = (a: Vector3, b: Vector3): Vector3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/** Preserve explicit discontinuities and split only at the exact inserted current point. */
export function buildTimedTrailStrokes(segments: readonly (readonly TimedTrailPoint[])[], currentMs: number, radius: number): { buckets: TrailStroke[][]; decorations: TrailDecoration[]; first: TimedTrailPoint | null; last: TimedTrailPoint | null } {
  const buckets: TrailStroke[][] = [[], [], [], [], []];
  // An exact current point beyond a budget-clipped path is a separate singleton.
  // It must not expand that path's labels, ticks or faded time interval.
  const flat = segments.filter(segment => segment.length > 1).flat().sort((a, b) => a.instantMs - b.instantMs);
  const first = flat[0] ?? null, last = flat.at(-1) ?? null;
  const pastSpan = Math.max(1, currentMs - (first?.instantMs ?? currentMs));
  const decorations: TrailDecoration[] = [];
  const targetTimes = first && last ? Array.from({ length: 7 }, (_, index) => first.instantMs + (last.instantMs - first.instantMs) * index / 6) : [];
  const used = new Set<number>();
  for (const segment of segments) {
    let distance = 0;
    for (let index = 1; index < segment.length; index++) {
      const previous = segment[index - 1]!, next = segment[index]!;
      const start = scale(previous.point, radius), end = scale(next.point, radius);
      const strokeLength = length(difference(end, start));
      // A stationary direction has a current marker, rather than a zero-length GPU line.
      if (strokeLength < 1e-9) continue;
      const midTime = (previous.instantMs + next.instantMs) / 2;
      const bucket = midTime > currentMs ? 4 : Math.min(3, Math.max(0, Math.floor(4 * (midTime - (currentMs - pastSpan)) / pastSpan)));
      buckets[bucket]!.push({ start, end, distanceStart: distance, distanceEnd: distance + strokeLength });
      distance += strokeLength;
    }
    for (const time of targetTimes) {
      if (segment.length < 2 || time < segment[0]!.instantMs || time > segment.at(-1)!.instantMs) continue;
      let index = 0;
      for (let candidate = 1; candidate < segment.length; candidate++) if (Math.abs(segment[candidate]!.instantMs - time) < Math.abs(segment[index]!.instantMs - time)) index = candidate;
      const sample = segment[index]!;
      if (used.has(sample.instantMs)) continue;
      const before = segment[Math.max(0, index - 1)]!, after = segment[Math.min(segment.length - 1, index + 1)]!;
      const delta = difference(after.point, before.point);
      if (length(delta) < 1e-9) continue;
      const normal = normalizeVector(sample.point), tangent = normalizeVector(delta);
      const sideRaw = cross(normal, tangent);
      if (length(sideRaw) < 1e-9) continue;
      const side = normalizeVector(sideRaw), center = scale(sample.point, radius * 1.003);
      const tip = add(center, scale(tangent, radius * 0.022));
      const tail = add(center, scale(tangent, -radius * 0.011));
      decorations.push({ sample,
        tick: [add(center, scale(side, radius * 0.009)), add(center, scale(side, -radius * 0.009))],
        arrow: [add(tail, scale(side, radius * 0.008)), tip, tip, add(tail, scale(side, -radius * 0.008))],
      });
      used.add(sample.instantMs);
    }
  }
  return { buckets, decorations, first, last };
}
