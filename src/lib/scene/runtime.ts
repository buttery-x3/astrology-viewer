import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  astronomicalToThree, eclipticToEquatorial, equatorialOfDateToFixed,
  equatorialToVector, horizonToEquatorial, sphericalToVector,
  type Vector3,
} from '../astronomy/coordinates';
import { BODY_IDS, type BodyId, type EphemerisSnapshot } from '../astronomy/ephemeris';

export interface ScenePresentation {
  viewpoint: 'overview' | 'observer' | 'outside';
  selectedId: string | null;
  layers: { bodies: boolean; horizon: boolean; ecliptic: boolean; houses: boolean; stars: boolean };
}

export interface SceneOptions {
  onSelect?: (id: string | null) => void;
  onStatus?: (message: string | null) => void;
  /** Keeps the application picker in sync with the canvas Home command. */
  onViewpoint?: (viewpoint: ScenePresentation['viewpoint']) => void;
}

export interface SceneRuntime {
  update(snapshot: EphemerisSnapshot | null, presentation: ScenePresentation): void;
  focusSelection(): void;
  returnToObserver(): void;
  dispose(): void;
}

const SKY_RADIUS = 5.8;
const EARTH_RADIUS = 0.82;
const RAD = Math.PI / 180;
const BODY_STYLE: Record<BodyId, { color: number; glyph: string }> = {
  sun: { color: 0xf4c976, glyph: '☉' }, moon: { color: 0xe0e8f3, glyph: '☽' },
  mercury: { color: 0xa6c3cb, glyph: '☿' }, venus: { color: 0xe5ba9f, glyph: '♀' },
  mars: { color: 0xe18e7c, glyph: '♂' }, jupiter: { color: 0xd5b690, glyph: '♃' },
  saturn: { color: 0xc4bfa1, glyph: '♄' }, uranus: { color: 0x8cc4c4, glyph: '♅' },
  neptune: { color: 0x8fa9d8, glyph: '♆' }, pluto: { color: 0xb8a8ca, glyph: '♇' },
};

function vector(value: Vector3, radius = 1): THREE.Vector3 {
  const converted = astronomicalToThree(value);
  return new THREE.Vector3(converted.x, converted.y, converted.z).multiplyScalar(radius);
}

function line(points: THREE.Vector3[], color: number, opacity: number, loop = false): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  return loop ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
}

function setPoints(target: THREE.Line, points: THREE.Vector3[]): void {
  const existing = target.geometry.getAttribute('position');
  if (existing?.count === points.length) {
    for (const [index, point] of points.entries()) existing.setXYZ(index, point.x, point.y, point.z);
    existing.needsUpdate = true;
    target.geometry.computeBoundingSphere();
  } else {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    target.geometry.dispose();
    target.geometry = geometry;
  }
}

function label(text: string, color: string, size = 0.28): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (context) {
    context.font = '52px "Segoe UI Symbol", "Arial Unicode MS", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.shadowColor = '#050b16';
    context.shadowBlur = 8;
    context.fillText(text, 64, 50);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(size * 128 / 96, size, 1);
  return sprite;
}

/** A quiet reference graticule, with no invented star catalogue. */
function celestialGrid(): THREE.Group {
  const group = new THREE.Group();
  for (const declination of [-60, -30, 0, 30, 60]) {
    const points = Array.from({ length: 144 }, (_, index) => vector(sphericalToVector({ longitudeDeg: index * 2.5, latitudeDeg: declination }), SKY_RADIUS));
    group.add(line(points, 0x25334a, 0.24, true));
  }
  for (let longitude = 0; longitude < 180; longitude += 30) {
    const points = Array.from({ length: 145 }, (_, index) => {
      const angle = index * Math.PI * 2 / 144;
      return new THREE.Vector3(Math.cos(angle) * Math.cos(longitude * RAD), Math.sin(angle), -Math.cos(angle) * Math.sin(longitude * RAD)).multiplyScalar(SKY_RADIUS);
    });
    group.add(line(points, 0x25334a, 0.2));
  }
  return group;
}

function globe(): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x183847, roughness: 0.95, metalness: 0.03 }),
  ));
  for (const latitude of [-60, -30, 0, 30, 60]) {
    group.add(line(Array.from({ length: 96 }, (_, index) => vector(sphericalToVector({ longitudeDeg: index * 360 / 96, latitudeDeg: latitude }), EARTH_RADIUS * 1.005)), 0x4b737d, latitude === 0 ? 0.5 : 0.25, true));
  }
  for (let longitude = 0; longitude < 180; longitude += 30) {
    group.add(line(Array.from({ length: 97 }, (_, index) => {
      const angle = index * Math.PI * 2 / 96;
      return new THREE.Vector3(Math.cos(angle) * Math.cos(longitude * RAD), Math.sin(angle), -Math.cos(angle) * Math.sin(longitude * RAD)).multiplyScalar(EARTH_RADIUS * 1.005);
    }), 0x4b737d, 0.25));
  }
  return group;
}

function releaseScene(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse(object => {
    const drawable = object as THREE.Mesh;
    if (drawable.geometry) geometries.add(drawable.geometry);
    if (drawable.material) {
      for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) materials.add(material);
    }
  });
  for (const material of materials) {
    for (const entry of Object.values(material)) if (entry instanceof THREE.Texture) textures.add(entry);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
  scene.clear();
}

/** One canvas owns its renderer, controls, listeners, geometry, and animation frame. */
export function mountScene(container: HTMLElement, options: SceneOptions = {}): SceneRuntime {
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Interactive schematic sky. Drag to orbit or look; scroll to zoom. Arrow keys move the view, plus and minus zoom, F focuses selection, and Home returns to observer sky.');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline-offset:-4px;';
  container.append(canvas);
  let renderer: THREE.WebGLRenderer;
  try {
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!context) throw new Error('WebGL2 is unavailable.');
    renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
  } catch {
    const message = 'The 3D view requires WebGL2. Chart controls and numerical results remain available.';
    const fallback = document.createElement('p');
    fallback.textContent = message;
    fallback.setAttribute('role', 'status');
    fallback.style.cssText = 'position:absolute;inset:20%;margin:auto;max-width:30rem;color:#b8c7d8;text-align:center;line-height:1.6;';
    container.append(fallback);
    canvas.hidden = true;
    canvas.style.display = 'none';
    options.onStatus?.(message);
    return { update() {}, focusSelection() {}, returnToObserver() {}, dispose() { canvas.remove(); fallback.remove(); } };
  }

  renderer.setClearColor(0x070d17, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.015, 100);
  camera.position.set(7.2, 4.8, 9.4);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.dampingFactor = 0.09;
  controls.minDistance = 1.4;
  controls.maxDistance = 32;
  controls.target.set(0, 0, 0);
  controls.update();

  scene.add(new THREE.AmbientLight(0xc9dbea, 1.3));
  const sunlight = new THREE.DirectionalLight(0xffe3b5, 2.8);
  sunlight.position.set(9, 4, 6);
  scene.add(sunlight);
  const earth = globe();
  const sky = celestialGrid();
  scene.add(earth, sky);
  const ecliptic = line([], 0xc7a35e, 0.76, true);
  const equator = line([], 0x7d83ad, 0.4, true);
  const horizon = line([], 0x75c9ba, 0.78, true);
  const horizonPlane = new THREE.Mesh(new THREE.CircleGeometry(SKY_RADIUS, 96), new THREE.MeshBasicMaterial({ color: 0x408f83, transparent: true, opacity: 0.025, side: THREE.DoubleSide, depthWrite: false }));
  const observerMarker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: 0xb7f3dc }));
  const tangentRing = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.17, 48), new THREE.MeshBasicMaterial({ color: 0x75c9ba, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false }));
  const observerConnector = line([], 0x75c9ba, 0.36);
  const compass = new THREE.Group();
  const compassLabels = ['N', 'E', 'S', 'W'].map(text => label(text, '#86c6bb', 0.24));
  compass.add(...compassLabels);
  scene.add(ecliptic, equator, horizon, horizonPlane, observerMarker, tangentRing, observerConnector, compass);

  const bodies = new THREE.Group();
  const bodyGeometry = new THREE.SphereGeometry(0.063, 14, 10);
  const markerMap = new Map<BodyId, THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>();
  const textMap = new Map<BodyId, THREE.Sprite>();
  for (const id of BODY_IDS) {
    const style = BODY_STYLE[id];
    const marker = new THREE.Mesh(bodyGeometry, new THREE.MeshBasicMaterial({ color: style.color }));
    marker.userData.entityId = `body:${id}`;
    const caption = label(style.glyph, `#${style.color.toString(16).padStart(6, '0')}`);
    caption.userData.entityId = `body:${id}`;
    markerMap.set(id, marker);
    textMap.set(id, caption);
    bodies.add(marker, caption);
  }
  scene.add(bodies);
  const selection = new THREE.Mesh(new THREE.RingGeometry(0.105, 0.119, 48), new THREE.MeshBasicMaterial({ color: 0xf5e0ac, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
  selection.renderOrder = 5;
  selection.visible = false;
  scene.add(selection);

  let snapshot: EphemerisSnapshot | null = null;
  let presentation: ScenePresentation = { viewpoint: 'overview', selectedId: null, layers: { bodies: true, horizon: true, ecliptic: true, houses: false, stars: false } };
  let observerEast = new THREE.Vector3(0, 0, -1);
  let observerNorth = new THREE.Vector3(0, 1, 0);
  let observerUp = new THREE.Vector3(1, 0, 0);
  let azimuth = 0;
  let altitude = 25 * RAD;
  let disposed = false;
  let contextLost = false;
  let animationFrame = 0;
  let pointer: { id: number; x: number; y: number; lastX: number; lastY: number; dragged: boolean } | null = null;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  function requestRender(): void {
    if (!animationFrame && !disposed && !contextLost) animationFrame = requestAnimationFrame(render);
  }
  function aimObserver(): void {
    const look = observerNorth.clone().multiplyScalar(Math.cos(altitude) * Math.cos(azimuth))
      .addScaledVector(observerEast, Math.cos(altitude) * Math.sin(azimuth))
      .addScaledVector(observerUp, Math.sin(altitude));
    camera.position.set(0, 0, 0);
    camera.up.copy(observerUp);
    camera.lookAt(look);
    camera.updateMatrixWorld();
  }
  function render(): void {
    animationFrame = 0;
    if (disposed || contextLost) return;
    if (controls.enabled) controls.update();
    if (selection.visible) selection.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
  }
  function resize(): void {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }
  function applyViewpoint(viewpoint: ScenePresentation['viewpoint']): void {
    controls.enabled = !contextLost && viewpoint !== 'observer';
    camera.fov = viewpoint === 'observer' ? 65 : 43;
    camera.updateProjectionMatrix();
    if (viewpoint === 'observer') {
      aimObserver();
    } else {
      camera.up.set(0, 1, 0);
      controls.target.set(0, 0, 0);
      camera.position.set(...(viewpoint === 'outside' ? [10.8, 7.2, 13.8] : [7.2, 4.8, 9.4]) as [number, number, number]);
      controls.update();
    }
  }
  function updateVisibility(): void {
    const hasData = snapshot !== null;
    earth.visible = presentation.viewpoint !== 'observer';
    observerMarker.visible = hasData && earth.visible;
    tangentRing.visible = hasData && earth.visible && presentation.layers.horizon;
    observerConnector.visible = hasData && earth.visible && presentation.layers.horizon;
    horizon.visible = hasData && presentation.layers.horizon;
    compass.visible = horizon.visible;
    horizonPlane.visible = horizon.visible && presentation.viewpoint !== 'observer';
    ecliptic.visible = hasData && presentation.layers.ecliptic;
    equator.visible = hasData;
    bodies.visible = hasData && presentation.layers.bodies;
    const selected = presentation.selectedId?.startsWith('body:') ? markerMap.get(presentation.selectedId.slice(5) as BodyId) : undefined;
    selection.visible = !!selected && bodies.visible;
    if (selected) selection.position.copy(selected.position);
  }
  function updateSnapshot(next: EphemerisSnapshot): void {
    const direction = (east: number, north: number, up: number) => vector(equatorialOfDateToFixed(
      equatorialToVector(horizonToEquatorial({ east, north, up }, next.observer, next.greenwichSiderealTimeDeg)), next.frame,
    ));
    observerEast = direction(1, 0, 0);
    observerNorth = direction(0, 1, 0);
    observerUp = direction(0, 0, 1);
    // Earth is authored in Three's +Y-north axes. Form its Greenwich, pole, and
    // westward axes explicitly rather than mixing precession with Euler order.
    const earthX = vector(equatorialOfDateToFixed({ x: Math.cos(next.greenwichSiderealTimeDeg * RAD), y: Math.sin(next.greenwichSiderealTimeDeg * RAD), z: 0 }, next.frame));
    const earthY = vector(equatorialOfDateToFixed({ x: 0, y: 0, z: 1 }, next.frame));
    const earthZ = earthX.clone().cross(earthY);
    earth.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(earthX, earthY, earthZ));
    observerMarker.position.copy(observerUp).multiplyScalar(EARTH_RADIUS * 1.025);
    tangentRing.position.copy(observerUp).multiplyScalar(EARTH_RADIUS * 1.012);
    tangentRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), observerUp);
    horizonPlane.quaternion.copy(tangentRing.quaternion);
    setPoints(observerConnector, [new THREE.Vector3(), observerMarker.position.clone()]);
    setPoints(horizon, Array.from({ length: 180 }, (_, index) => observerEast.clone().multiplyScalar(Math.cos(index * Math.PI / 90)).addScaledVector(observerNorth, Math.sin(index * Math.PI / 90)).multiplyScalar(SKY_RADIUS)));
    for (const [index, heading] of [observerNorth, observerEast, observerNorth.clone().negate(), observerEast.clone().negate()].entries()) compassLabels[index]!.position.copy(heading).multiplyScalar(SKY_RADIUS * 1.045);
    setPoints(ecliptic, Array.from({ length: 180 }, (_, index) => vector(equatorialOfDateToFixed(
      equatorialToVector(eclipticToEquatorial({ longitudeDeg: index * 2, latitudeDeg: 0 }, next.trueObliquityDeg)), next.frame,
    ), SKY_RADIUS)));
    setPoints(equator, Array.from({ length: 180 }, (_, index) => vector(equatorialOfDateToFixed(
      equatorialToVector({ rightAscensionDeg: index * 2, declinationDeg: 0 }), next.frame,
    ), SKY_RADIUS)));
    for (const body of next.bodies) {
      const position = vector(equatorialToVector(body.fixedEquatorial), SKY_RADIUS);
      markerMap.get(body.id)!.position.copy(position);
      const caption = textMap.get(body.id)!;
      caption.position.copy(position).addScaledVector(observerUp, 0.2);
      if (body.id === 'sun') sunlight.position.copy(position).multiplyScalar(3);
    }
    if (presentation.viewpoint === 'observer') aimObserver();
  }
  function selectAt(event: PointerEvent): void {
    if (!snapshot || !bodies.visible) return;
    const rect = canvas.getBoundingClientRect();
    pointerNdc.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointerNdc, camera);
    const intersection = raycaster.intersectObjects(bodies.children, false)[0];
    const globeIntersection = earth.visible ? raycaster.intersectObject(earth.children[0]!, false)[0] : undefined;
    const visibleIntersection = intersection && (!globeIntersection || intersection.distance < globeIntersection.distance) ? intersection : undefined;
    options.onSelect?.(visibleIntersection ? visibleIntersection.object.userData.entityId as string : null);
  }
  function pointerDown(event: PointerEvent): void {
    if (event.button !== 0 || disposed || contextLost) return;
    canvas.focus({ preventScroll: true });
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, dragged: false };
    if (presentation.viewpoint === 'observer') canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent): void {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4) pointer.dragged = true;
    if (presentation.viewpoint === 'observer' && pointer.dragged) {
      azimuth -= (event.clientX - pointer.lastX) * 0.004;
      altitude = THREE.MathUtils.clamp(altitude + (event.clientY - pointer.lastY) * 0.004, -Math.PI / 2 + 0.005, Math.PI / 2 - 0.005);
      aimObserver();
      requestRender();
    }
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
  }
  function pointerUp(event: PointerEvent): void {
    if (!pointer || pointer.id !== event.pointerId) return;
    const shouldSelect = !pointer.dragged && event.type === 'pointerup';
    pointer = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (shouldSelect) selectAt(event);
  }
  function wheel(event: WheelEvent): void {
    if (presentation.viewpoint !== 'observer') return;
    event.preventDefault();
    camera.fov = THREE.MathUtils.clamp(camera.fov + Math.sign(event.deltaY) * 3, 25, 105);
    camera.updateProjectionMatrix();
    requestRender();
  }
  function focusSelection(): void {
    if (disposed || contextLost) return;
    const id = presentation.selectedId?.startsWith('body:') ? presentation.selectedId.slice(5) as BodyId : null;
    const target = id ? markerMap.get(id) : undefined;
    if (!snapshot || !target) return;
    const direction = target.position.clone().normalize();
    if (presentation.viewpoint === 'observer') {
      azimuth = Math.atan2(direction.dot(observerEast), direction.dot(observerNorth));
      altitude = Math.asin(THREE.MathUtils.clamp(direction.dot(observerUp), -1, 1));
      altitude = THREE.MathUtils.clamp(altitude, -Math.PI / 2 + 0.005, Math.PI / 2 - 0.005);
      aimObserver();
    } else {
      const offset = camera.position.clone().sub(controls.target).normalize().multiplyScalar(3.6);
      controls.target.copy(target.position);
      camera.position.copy(target.position).add(offset);
      controls.update();
    }
    requestRender();
  }
  function returnToObserver(): void {
    if (disposed || contextLost) return;
    azimuth = 0;
    altitude = 25 * RAD;
    presentation = { ...presentation, viewpoint: 'observer' };
    applyViewpoint('observer');
    updateVisibility();
    options.onViewpoint?.('observer');
    requestRender();
  }
  function keyDown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || contextLost) return;
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Home', 'f', 'F'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (key === 'Home') { returnToObserver(); return; }
    if (key.toLowerCase() === 'f') { focusSelection(); return; }
    const zoom = key === '+' || key === '=' ? 0.88 : key === '-' || key === '_' ? 1.14 : 1;
    if (presentation.viewpoint === 'observer') {
      azimuth += key === 'ArrowRight' ? 0.08 : key === 'ArrowLeft' ? -0.08 : 0;
      altitude = THREE.MathUtils.clamp(altitude + (key === 'ArrowUp' ? 0.06 : key === 'ArrowDown' ? -0.06 : 0), -Math.PI / 2 + 0.005, Math.PI / 2 - 0.005);
      camera.fov = THREE.MathUtils.clamp(camera.fov * zoom, 25, 105);
      camera.updateProjectionMatrix();
      aimObserver();
    } else {
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      spherical.theta += key === 'ArrowRight' ? -0.08 : key === 'ArrowLeft' ? 0.08 : 0;
      spherical.phi += key === 'ArrowUp' ? -0.06 : key === 'ArrowDown' ? 0.06 : 0;
      spherical.radius = THREE.MathUtils.clamp(spherical.radius * zoom, controls.minDistance, controls.maxDistance);
      spherical.makeSafe();
      camera.position.copy(new THREE.Vector3().setFromSpherical(spherical)).add(controls.target);
      controls.update();
    }
    requestRender();
  }
  function loseContext(event: Event): void {
    event.preventDefault();
    contextLost = true;
    controls.enabled = false;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    options.onStatus?.('The 3D view is paused while the browser restores its graphics context. Numerical results remain available.');
  }
  function restoreContext(): void {
    if (disposed) return;
    // WebGLRenderer restores its own GL state; retained geometry and textures are reuploaded.
    contextLost = false;
    controls.enabled = presentation.viewpoint !== 'observer';
    options.onStatus?.(null);
    resize();
  }
  function preventContextMenu(event: Event): void { event.preventDefault(); }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function motionPreference(): void { controls.enableDamping = !reducedMotion.matches; requestRender(); }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  controls.addEventListener('change', requestRender);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('keydown', keyDown);
  canvas.addEventListener('contextmenu', preventContextMenu);
  canvas.addEventListener('webglcontextlost', loseContext);
  canvas.addEventListener('webglcontextrestored', restoreContext);
  window.addEventListener('resize', resize);
  reducedMotion.addEventListener('change', motionPreference);
  updateVisibility();
  resize();
  options.onStatus?.(null);

  return {
    update(nextSnapshot, nextPresentation) {
      if (disposed) return;
      const changedViewpoint = nextPresentation.viewpoint !== presentation.viewpoint;
      const changedSnapshot = nextSnapshot !== snapshot;
      presentation = { ...nextPresentation, layers: { ...nextPresentation.layers } };
      snapshot = nextSnapshot;
      if (changedSnapshot && snapshot) updateSnapshot(snapshot);
      if (changedViewpoint) applyViewpoint(presentation.viewpoint);
      updateVisibility();
      requestRender();
    },
    focusSelection,
    returnToObserver,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', keyDown);
      canvas.removeEventListener('contextmenu', preventContextMenu);
      canvas.removeEventListener('webglcontextlost', loseContext);
      canvas.removeEventListener('webglcontextrestored', restoreContext);
      window.removeEventListener('resize', resize);
      reducedMotion.removeEventListener('change', motionPreference);
      releaseScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      pointer = null;
    },
  };
}
