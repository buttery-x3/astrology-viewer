import * as THREE from 'three';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { astronomicalToThree, type Vector3 } from '../astronomy/coordinates';

/** Shared position/distance instances allow a crisp core and halo without duplicate buffers. */
export function createWideLineGeometry(capacity: number, boundRadius: number): LineGeometry {
  const geometry = new LineGeometry();
  geometry.setPositions(new Float32Array((capacity + 1) * 3));
  const positions = geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
  positions.data.setUsage(THREE.DynamicDrawUsage);
  const distances = new THREE.InstancedInterleavedBuffer(new Float32Array(capacity * 2), 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('instanceDistanceStart', new THREE.InterleavedBufferAttribute(distances, 1, 0));
  geometry.setAttribute('instanceDistanceEnd', new THREE.InterleavedBufferAttribute(distances, 1, 1));
  geometry.instanceCount = 0;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), boundRadius);
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-boundRadius, -boundRadius, -boundRadius), new THREE.Vector3(boundRadius, boundRadius, boundRadius));
  return geometry;
}

export function writeWideLine(geometry: LineGeometry, points: readonly Vector3[]): void {
  const positions = geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
  const distances = geometry.getAttribute('instanceDistanceStart') as THREE.InterleavedBufferAttribute;
  const count = Math.max(0, points.length - 1);
  if (count > positions.count) throw new RangeError('The aspect line exceeds its declared segment budget.');
  const values = positions.data.array as Float32Array, distanceValues = distances.data.array as Float32Array;
  let distance = 0;
  for (let index = 0; index < count; index++) {
    const before = points[index]!, after = points[index + 1]!;
    const a = astronomicalToThree(before), b = astronomicalToThree(after);
    values.set([a.x, a.y, a.z, b.x, b.y, b.z], index * 6);
    distanceValues[index * 2] = distance;
    distance += Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
    distanceValues[index * 2 + 1] = distance;
  }
  positions.data.needsUpdate = distances.data.needsUpdate = true;
  geometry.instanceCount = count;
}
