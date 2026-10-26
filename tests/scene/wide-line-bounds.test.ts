import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { describe, expect, it } from 'vitest';
import { astronomicalToThree, type Vector3 } from '../../src/lib/astronomy/coordinates';
import { createWideLineGeometry, writeWideLine } from '../../src/lib/scene/wide-line-buffer';

function three(point: Vector3) {
  const value = astronomicalToThree(point);
  return new THREE.Vector3(value.x, value.y, value.z);
}
function activePoints(geometry: ReturnType<typeof createWideLineGeometry>) {
  const starts = geometry.getAttribute('instanceStart'),
    ends = geometry.getAttribute('instanceEnd');
  return Array.from({ length: geometry.instanceCount }, (_, index) => [
    new THREE.Vector3().fromBufferAttribute(starts, index),
    new THREE.Vector3().fromBufferAttribute(ends, index),
  ]).flat();
}

describe('active wide-line picking bounds', () => {
  it('excludes unused capacity and the origin from a distant short figure path', () => {
    const geometry = createWideLineGeometry(128, 10);
    const points = [
      { x: 5, y: 1, z: 2 },
      { x: 5.1, y: 1.1, z: 2.05 },
      { x: 5.2, y: 1.2, z: 2.1 },
    ];
    writeWideLine(geometry, points);
    expect(geometry.instanceCount).toBe(2);
    expect(geometry.boundingBox!.min.x).toBeGreaterThan(4.99);
    expect(geometry.boundingBox!.containsPoint(new THREE.Vector3())).toBe(false);
    expect(geometry.boundingSphere!.radius).toBeLessThan(0.2);
    for (const point of points) {
      expect(geometry.boundingBox!.containsPoint(three(point))).toBe(true);
      expect(geometry.boundingSphere!.containsPoint(three(point))).toBe(true);
    }
    geometry.dispose();
  });

  it('conservatively contains both source doubles and the rounded Float32 endpoints', () => {
    const geometry = createWideLineGeometry(32, 1e8);
    // 2^24+1 rounds down in Float32; other coordinates straddle rounding edges.
    const points = [
      { x: 2 ** 24 + 1, y: 4.00000012, z: -1 / 3 },
      { x: 2 ** 24 + 3, y: 4.00000036, z: -1 / 3 - 1e-8 },
    ];
    writeWideLine(geometry, points);
    expect(activePoints(geometry)[0]!.x).not.toBe(points[0]!.x);
    for (const point of [...points.map(three), ...activePoints(geometry)]) {
      expect(geometry.boundingBox!.containsPoint(point)).toBe(true);
      expect(geometry.boundingSphere!.containsPoint(point)).toBe(true);
    }
    expect(Number.isFinite(geometry.boundingSphere!.radius)).toBe(true);
    geometry.dispose();
  });

  it('reuses bound and buffer objects while shrinking a long path without stale-tail contamination', () => {
    const geometry = createWideLineGeometry(128, 10),
      sphere = geometry.boundingSphere,
      box = geometry.boundingBox;
    const buffer = (geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute)
      .data;
    writeWideLine(
      geometry,
      Array.from({ length: 101 }, (_, index) => ({
        x: -5 + index * 0.1,
        y: Math.sin(index),
        z: Math.cos(index),
      })),
    );
    expect(geometry.boundingBox!.min.x).toBeLessThan(-4.9);
    for (let pass = 0; pass < 30; pass++)
      writeWideLine(geometry, [
        { x: 4, y: 2, z: 1 },
        { x: 4.1, y: 2, z: 1 },
      ]);
    expect(geometry.boundingSphere).toBe(sphere);
    expect(geometry.boundingBox).toBe(box);
    expect((geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data).toBe(
      buffer,
    );
    expect(geometry.instanceCount).toBe(1);
    expect(geometry.boundingBox!.min.x).toBeGreaterThan(3.99);
    expect(geometry.boundingBox!.max.x).toBeLessThan(4.11);
    expect(geometry.boundingSphere!.radius).toBeLessThan(0.051);
    expect(geometry.boundingSphere!.containsPoint(new THREE.Vector3(-5, 0, 0))).toBe(false);
    geometry.dispose();
  });

  it('clears all previous bounds for empty and single-point paths, then repopulates the same objects', () => {
    const geometry = createWideLineGeometry(16, 10),
      sphere = geometry.boundingSphere,
      box = geometry.boundingBox;
    writeWideLine(geometry, [
      { x: 3, y: 2, z: 1 },
      { x: 4, y: 2, z: 1 },
    ]);
    for (const points of [[], [{ x: 7, y: 8, z: 9 }]]) {
      writeWideLine(geometry, points);
      expect(geometry.instanceCount).toBe(0);
      expect(geometry.boundingBox!.isEmpty()).toBe(true);
      expect(geometry.boundingSphere!.center.toArray()).toEqual([0, 0, 0]);
      expect(geometry.boundingSphere!.radius).toBe(0);
    }
    writeWideLine(geometry, [
      { x: -3, y: 2, z: 1 },
      { x: -2, y: 2, z: 1 },
    ]);
    expect(geometry.boundingSphere).toBe(sphere);
    expect(geometry.boundingBox).toBe(box);
    expect(geometry.boundingBox!.containsPoint(three({ x: -2.5, y: 2, z: 1 }))).toBe(true);
    geometry.dispose();
  });

  for (const transformed of [false, true])
    it(`retains actual screen-width edge hits${transformed ? ' under a rotated and translated parent' : ''}`, () => {
      const geometry = createWideLineGeometry(64, 10);
      writeWideLine(geometry, [
        { x: -0.3, y: 5, z: 0.2 },
        { x: 0.3, y: 5, z: 0.2 },
      ]);
      const material = new LineMaterial({ color: 0xffffff, linewidth: 2 });
      material.resolution.set(800, 600);
      const line = new Line2(geometry, material),
        parent = new THREE.Group();
      parent.add(line);
      if (transformed) {
        parent.rotation.set(0.2, -0.3, 0.35);
        parent.position.set(0.2, 0.1, -0.3);
        parent.scale.setScalar(1.4);
      }
      parent.updateMatrixWorld(true);
      const midpoint = line.localToWorld(three({ x: 0, y: 5, z: 0.2 }));
      const camera = new THREE.PerspectiveCamera(55, 800 / 600, 0.01, 100);
      camera.position.copy(midpoint).add(new THREE.Vector3(0, 0, 7));
      camera.lookAt(midpoint);
      camera.updateMatrixWorld();
      const ndc = midpoint.clone().project(camera),
        raycaster = new THREE.Raycaster();
      raycaster.params.Line2 = { threshold: 6 };
      const tangent = three({ x: 0.3, y: 5, z: 0.2 })
        .applyMatrix4(line.matrixWorld)
        .project(camera)
        .sub(ndc);
      const perpendicular = new THREE.Vector2(-tangent.y, tangent.x).normalize();
      // Three adds stroke width plus threshold to the tight geometry bounds.
      raycaster.setFromCamera(
        new THREE.Vector2(
          ndc.x + (perpendicular.x * 3 * 2) / 800,
          ndc.y + (perpendicular.y * 3 * 2) / 600,
        ),
        camera,
      );
      expect(raycaster.intersectObject(line, false).length).toBeGreaterThan(0);
      raycaster.setFromCamera(
        new THREE.Vector2(
          ndc.x + (perpendicular.x * 20 * 2) / 800,
          ndc.y + (perpendicular.y * 20 * 2) / 600,
        ),
        camera,
      );
      expect(raycaster.intersectObject(line, false)).toHaveLength(0);
      geometry.dispose();
      material.dispose();
    });
});
