import * as THREE from 'three';
import { astronomicalToThree, type Vector3 } from '../astronomy/coordinates';

/** A frame adapter plus reusable vertex/distance buffers; no implicit closure. */
export function writeAstronomicalLine(target: THREE.Line, values: readonly Vector3[]): void {
  let positions = target.geometry.getAttribute('position');
  if (!positions || positions.count < values.length) {
    const geometry = new THREE.BufferGeometry();
    const capacity = 2 ** Math.ceil(Math.log2(Math.max(4, values.length)));
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.001);
    target.geometry.dispose(); target.geometry = geometry; positions = geometry.getAttribute('position');
  }
  for (const [index, value] of values.entries()) {
    const point = astronomicalToThree(value);
    positions.setXYZ(index, point.x, point.y, point.z);
  }
  positions.needsUpdate = true; target.geometry.setDrawRange(0, values.length);
  if (target.material instanceof THREE.LineDashedMaterial) {
    let distances = target.geometry.getAttribute('lineDistance');
    if (!distances || distances.count < positions.count) {
      distances = new THREE.Float32BufferAttribute(new Float32Array(positions.count), 1).setUsage(THREE.DynamicDrawUsage);
      target.geometry.setAttribute('lineDistance', distances);
    }
    let distance = 0;
    for (let index = 0; index < values.length; index++) {
      if (target instanceof THREE.LineSegments && index % 2 === 0) distance = 0;
      else if (index > 0) {
        const before = values[index - 1]!, after = values[index]!;
        distance += Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
      }
      distances.setX(index, distance);
    }
    distances.needsUpdate = true;
  }
}
