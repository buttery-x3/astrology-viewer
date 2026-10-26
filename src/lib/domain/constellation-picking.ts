import { normalizeVector, type Vector3 } from '../astronomy/coordinates';
import { CONSTELLATION_REGIONS } from '../scene/sky-data';

const EDGE_SIZE = 11;
const BOUNDARY_EPSILON = 1e-10;
interface RegionIndex {
  id: string; edges: Float64Array; centre: Vector3; capCosine: number; windingSign: 1 | -1;
}

/**
 * Winding of the rendered sampled spherical polygon around the query direction.
 * Sign matters: the antipodal projection has the opposite winding and must not
 * be mistaken for this small sky region. Infinity identifies an actual edge.
 */
function winding(edges: Float64Array, point: Vector3): number {
  let total = 0, correction = 0;
  for (let offset = 0; offset < edges.length; offset += EDGE_SIZE) {
    const a = edges[offset]! * point.x + edges[offset + 1]! * point.y + edges[offset + 2]! * point.z;
    const b = edges[offset + 3]! * point.x + edges[offset + 4]! * point.y + edges[offset + 5]! * point.z;
    const determinant = edges[offset + 6]! * point.x + edges[offset + 7]! * point.y + edges[offset + 8]! * point.z;
    const ab = edges[offset + 9]!;
    if (Math.abs(determinant) <= BOUNDARY_EPSILON * edges[offset + 10]!
      && a >= ab - BOUNDARY_EPSILON && b >= ab - BOUNDARY_EPSILON) return Infinity;
    const angle = Math.atan2(determinant, ab - a * b);
    const adjusted = angle - correction, next = total + adjusted;
    correction = next - total - adjusted; total = next;
  }
  return total;
}

// Precompute actual edge planes and conservative spherical caps once. A cap is
// only a rejection accelerator; centre proximity never decides membership.
const regions: RegionIndex[] = CONSTELLATION_REGIONS.map(region => {
  const values: number[] = [];
  let minimumDot = 1, maximumEdge = 0;
  for (let index = 0; index < region.points.length; index++) {
    const a = region.points[index]!, b = region.points[(index + 1) % region.points.length]!;
    minimumDot = Math.min(minimumDot, a.x * region.centre.x + a.y * region.centre.y + a.z * region.centre.z);
    const nx = a.y * b.z - a.z * b.y, ny = a.z * b.x - a.x * b.z, nz = a.x * b.y - a.y * b.x;
    const length = Math.hypot(nx, ny, nz), ab = a.x * b.x + a.y * b.y + a.z * b.z;
    if (length < 1e-15) continue;
    maximumEdge = Math.max(maximumEdge, Math.atan2(length, ab));
    values.push(a.x, a.y, a.z, b.x, b.y, b.z, nx, ny, nz, ab, length);
  }
  const edges = new Float64Array(values), signedWinding = winding(edges, region.centre);
  if (!Number.isFinite(signedWinding) || Math.abs(signedWinding) < Math.PI) throw new Error(`Invalid interior reference for constellation region${region.abbreviation}.`);
  const radius = Math.min(Math.PI, Math.acos(Math.max(-1, Math.min(1, minimumDot))) + maximumEdge / 2 + BOUNDARY_EPSILON);
  return { id: region.id, edges, centre: region.centre, capCosine: Math.cos(radius), windingSign: signedWinding > 0 ? 1 as const : -1 as const };
}).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Identify the existing J2000 boundary region, including both Serpens pieces.
 * Call only as a background sky candidate after foreground geometry. Coordinates
 * are fixed-J2000 astronomical axes, not of-date or Three.js axes. Finite nonzero
 * vectors may have any magnitude. Invalid/zero directions return null.
 *
 * Edges follow the same author-sampled small-circle approximation as the visible
 * boundary layer. A shared-edge tie uses stable lexical constellation-ID order.
 */
export function findConstellationRegion(fixedJ2000Vector: Vector3): string | null {
  if (![fixedJ2000Vector.x, fixedJ2000Vector.y, fixedJ2000Vector.z].every(Number.isFinite)
    || fixedJ2000Vector.x === 0 && fixedJ2000Vector.y === 0 && fixedJ2000Vector.z === 0) return null;
  const point = normalizeVector(fixedJ2000Vector);
  for (const region of regions) {
    if (point.x * region.centre.x + point.y * region.centre.y + point.z * region.centre.z < region.capCosine) continue;
    const angle = winding(region.edges, point);
    if (angle === Infinity || angle * region.windingSign > Math.PI) return region.id;
  }
  return null;
}
