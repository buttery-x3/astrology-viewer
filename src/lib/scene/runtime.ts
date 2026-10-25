import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  astronomicalToThree, eclipticToEquatorial, equatorialOfDateToFixed,
  equatorialToVector, horizonToEquatorial, normalizeDegrees, rotateVector,
  sphericalToVector, threeToAstronomical, transposeMatrix, vectorToSpherical,
  type Matrix3, type ObserverCoordinates, type Vector3,
} from '../astronomy/coordinates';
import { BODY_IDS, type BodyId, type EphemerisSnapshot } from '../astronomy/ephemeris';
import { eclipticDirection, getSkyReferences } from '../domain/sky-reference';
import { classifyLongitude } from '../domain/chart';
import { DEFAULT_HOUSE_DISPLAY, isHouseDirectionPickable, type HouseDisplaySettings } from '../domain/house-geometry';
import { DEFAULT_CONSTRUCTION, type ConstructionSettings } from '../domain/house-construction';
import { DEFAULT_ASPECT_DISPLAY, getAspectDetails, type AspectDisplaySettings } from '../domain/aspect-presentation';
import { DEFAULT_TRAIL_DISPLAY, DEFAULT_BOUNDARY_HISTORY, type TrailDisplaySettings, type TrailResult, type BoundaryHistorySettings, type BoundaryHistoryResult } from '../domain/trails';
import { CATALOGUE_STARS, CONSTELLATION_REGIONS, catalogueStarDirection } from './sky-data';
import { createHouseRenderer } from './house-renderer';
import { createConstructionRenderer } from './construction-renderer';
import { createAspectRenderer } from './aspect-renderer';
import { createTrailRenderer } from './trail-renderer';
import coastline from './data/natural-earth-coastline.json';

export interface ScenePresentation {
  viewpoint: 'overview' | 'observer' | 'outside';
  selectedId: string | null;
  houseDisplay: HouseDisplaySettings;
  construction: ConstructionSettings;
  aspects: AspectDisplaySettings;
  trails: TrailDisplaySettings;
  trailResult: TrailResult | null;
  history: BoundaryHistorySettings;
  historyResult: BoundaryHistoryResult | null;
  layers: { bodies: boolean; horizon: boolean; ecliptic: boolean; houses: boolean; stars: boolean;
    signs?: boolean; equator?: boolean; meridian?: boolean; primeVertical?: boolean;
    angles?: boolean; constellations?: boolean };
  /** Only this explicit mode permits a globe click to propose an observer. */
  globePickMode?: boolean;
}

export interface SceneOptions {
  onSelect?: (id: string | null) => void;
  onStatus?: (message: string | null) => void;
  /** Keeps the application picker in sync with the canvas Home command. */
  onViewpoint?: (viewpoint: ScenePresentation['viewpoint']) => void;
  onObserverPick?: (observer: ObserverCoordinates) => void;
  onHover?: (entity: { id: string; name: string } | null) => void;
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
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const BODY_STYLE: Record<BodyId, { color: number; glyph: string }> = {
  sun: { color: 0xf4c976, glyph: '☉' }, moon: { color: 0xe0e8f3, glyph: '☽' },
  mercury: { color: 0xa6c3cb, glyph: '☿' }, venus: { color: 0xe5ba9f, glyph: '♀' },
  mars: { color: 0xe18e7c, glyph: '♂' }, jupiter: { color: 0xd5b690, glyph: '♃' },
  saturn: { color: 0xc4bfa1, glyph: '♄' }, uranus: { color: 0x8cc4c4, glyph: '♅' },
  neptune: { color: 0x8fa9d8, glyph: '♆' }, pluto: { color: 0xb8a8ca, glyph: '♇' },
};

type GlobeOrientationInput = Pick<EphemerisSnapshot, 'frame' | 'greenwichSiderealTimeDeg'>;

/** Unit geographic direction in the globe's authored Three.js local axes. */
export function geographicToGlobePoint(observer: ObserverCoordinates): Vector3 {
  return astronomicalToThree(sphericalToVector({ longitudeDeg: observer.longitudeDeg, latitudeDeg: observer.latitudeDeg }));
}

/** Inverse geographic mapping, including the conventional zero longitude at a pole. */
export function globeLocalPointToCoordinates(point: Vector3): ObserverCoordinates {
  const coordinates = vectorToSpherical(threeToAstronomical(point));
  return { latitudeDeg: coordinates.latitudeDeg, longitudeDeg: normalizeDegrees(coordinates.longitudeDeg + 180) - 180 };
}

/** Row-major Earth-fixed -> world rotation, with the engine's full date frame. */
export function globeOrientationMatrix(input: GlobeOrientationInput): Matrix3 {
  const angle = input.greenwichSiderealTimeDeg * RAD;
  const x = astronomicalToThree(equatorialOfDateToFixed({ x: Math.cos(angle), y: Math.sin(angle), z: 0 }, input.frame));
  const y = astronomicalToThree(equatorialOfDateToFixed({ x: 0, y: 0, z: 1 }, input.frame));
  const z = { x: x.y * y.z - x.z * y.y, y: x.z * y.x - x.x * y.z, z: x.x * y.y - x.y * y.x };
  return [x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z];
}

/** A picked world position is unrotated before any geographic classification. */
export function globeWorldPointToCoordinates(point: Vector3, input: GlobeOrientationInput): ObserverCoordinates {
  return globeLocalPointToCoordinates(rotateVector(point, transposeMatrix(globeOrientationMatrix(input))));
}

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
  canvas.width = text.length > 4 ? 256 : 128;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (context) {
    const font = `${text.length === 1 ? 52 : 32}px "Segoe UI Symbol", "Arial Unicode MS", sans-serif`;
    context.font = font;
    // UTC timestamps and reference names must remain complete. Resizing resets
    // the canvas context, so reapply font/style after measuring the exact text.
    canvas.width = Math.min(2048, Math.max(canvas.width, Math.ceil(context.measureText(text).width) + 32));
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.shadowColor = '#050b16';
    context.shadowBlur = 8;
    context.fillText(text, canvas.width / 2, 50, canvas.width - 24);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(size * canvas.width / 96, size, 1);
  sprite.userData.labelEnabled = true;
  sprite.userData.baseHeight = size;
  sprite.userData.textFraction = (text.length === 1 ? 52 : 32) / 96;
  sprite.userData.minimumTextPixels = text.length === 1 ? 16 : 11;
  return sprite;
}

/** A quiet fixed-J2000 coordinate graticule, distinct from catalogue stars. */
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
  const coastSegments: THREE.Vector3[] = [];
  for (const feature of coastline.features) {
    const coordinates = feature.geometry.coordinates;
    for (let index = 1; index < coordinates.length; index++) {
      const before = coordinates[index - 1]!;
      const after = coordinates[index]!;
      const start = geographicToGlobePoint({ longitudeDeg: before[0]!, latitudeDeg: before[1]! });
      const end = geographicToGlobePoint({ longitudeDeg: after[0]!, latitudeDeg: after[1]! });
      const a = new THREE.Vector3(start.x, start.y, start.z);
      const b = new THREE.Vector3(end.x, end.y, end.z);
      const subdivisions = Math.max(1, Math.ceil(Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) / (2 * RAD)));
      for (let segment = 0; segment < subdivisions; segment++) {
        coastSegments.push(
          a.clone().lerp(b, segment / subdivisions).normalize().multiplyScalar(EARTH_RADIUS * 1.008),
          a.clone().lerp(b, (segment + 1) / subdivisions).normalize().multiplyScalar(EARTH_RADIUS * 1.008),
        );
      }
    }
  }
  group.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(coastSegments),
    new THREE.LineBasicMaterial({ color: 0x8aaba4, transparent: true, opacity: 0.78 }),
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

interface SceneEntity {
  id: string; name: string; kind: 'body' | 'sign' | 'angle' | 'reference' | 'constellation' | 'house' | 'boundary' | 'aspect';
  objects: THREE.Object3D[]; anchor: THREE.Vector3; valid: boolean;
  lines: THREE.Line[]; label?: THREE.Sprite; marker?: THREE.Mesh;
  focusRadius?: number;
}

/** Magnitude controls only the restrained display encoding, never star position. */
function starField(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(CATALOGUE_STARS.length * 3), 3));
  const colors = new Float32Array(CATALOGUE_STARS.length * 3);
  const sizes = new Float32Array(CATALOGUE_STARS.length);
  for (const [index, star] of CATALOGUE_STARS.entries()) {
    const color = new THREE.Color(star[9] !== null && star[9] > 0.9 ? 0xd9c6ad : star[9] !== null && star[9] < 0.1 ? 0xb9cee6 : 0xd4d9df);
    colors.set([color.r, color.g, color.b], index * 3);
    sizes[index] = THREE.MathUtils.clamp(2.6 - star[2] * 0.29, 0.8, 3.2);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  return new THREE.Points(geometry, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { pixelRatio: { value: 1 } },
    vertexShader: `attribute float pointSize; uniform float pixelRatio; varying vec3 starColor; varying float facing;
      void main() { starColor = color; vec4 world = modelMatrix * vec4(position, 1.0);
        facing = length(cameraPosition) > ${SKY_RADIUS.toFixed(1)} ? dot(world.xyz, cameraPosition - world.xyz) : 1.0;
        gl_Position = projectionMatrix * viewMatrix * world; gl_PointSize = pointSize * pixelRatio; }`,
    fragmentShader: `varying vec3 starColor; varying float facing;
      void main() { if (facing < 0.0) discard; float radius = length(gl_PointCoord - vec2(0.5));
        if (radius > 0.5) discard; float alpha = (1.0 - smoothstep(0.04, 0.5, radius)) * 0.72;
        gl_FragColor = vec4(starColor, alpha); }`,
  }));
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

  const entities = new Map<string, SceneEntity>();
  function register(entity: SceneEntity): void {
    for (const object of entity.objects) {
      object.userData.entityId = entity.id;
      object.userData.entityKind = entity.kind;
      if (object instanceof THREE.Line) {
        const material = object.material as THREE.LineBasicMaterial;
        object.userData.baseColor = material.color.getHex();
        object.userData.baseOpacity = material.opacity;
      }
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial) object.userData.baseColor = object.material.color.getHex();
    }
    if (entity.label) entity.label.userData.labelPriority = entity.kind === 'body' ? 30 : entity.kind === 'angle' ? 25 : entity.kind === 'constellation' ? 1 : entity.kind === 'house' ? 14 : entity.kind === 'boundary' ? 16 : entity.kind === 'aspect' ? 23 : 10;
    entities.set(entity.id, entity);
  }
  register({ id: 'reference:earth', name: 'Earth · geographic reference', kind: 'reference', objects: [earth.children[0]!], anchor: new THREE.Vector3(), valid: true, lines: [] });
  register({ id: 'reference:observer', name: 'Observer location', kind: 'reference', objects: [observerMarker], anchor: observerMarker.position, marker: observerMarker, valid: true, lines: [] });
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
    register({ id: `body:${id}`, name: id[0]!.toUpperCase() + id.slice(1), kind: 'body', objects: [marker, caption], anchor: marker.position, valid: true, lines: [], label: caption, marker });
  }
  scene.add(bodies);

  const stars = starField();
  scene.add(stars);
  const constellationGroup = new THREE.Group();
  for (const region of CONSTELLATION_REGIONS) {
    const outline = line(region.points.map(point => vector(point, SKY_RADIUS * 1.002)), 0x63758e, 0.28, true);
    const caption = label(region.abbreviation.replace(/[12]$/, ''), '#7c8ba2', 0.19);
    caption.position.copy(vector(region.centre, SKY_RADIUS * 1.012));
    caption.userData.labelPriority = 1;
    constellationGroup.add(outline, caption);
    const existing = entities.get(region.id);
    if (existing) {
      existing.objects.push(outline, caption); existing.lines.push(outline);
      outline.userData.entityId = region.id; outline.userData.entityKind = 'constellation';
      outline.userData.baseColor = 0x63758e; outline.userData.baseOpacity = 0.28;
      caption.userData.entityId = region.id; caption.userData.entityKind = 'constellation';
    } else register({ id: region.id, name: region.name, kind: 'constellation', objects: [outline, caption], anchor: caption.position.clone(), valid: true, lines: [outline], label: caption });
  }
  scene.add(constellationGroup);
  const signs = new THREE.Group();
  const signBands: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  for (const [index, id] of SIGNS.entries()) {
    const band = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: index % 2 ? 0xa79872 : 0x788d93, transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false }));
    const boundary = line([], 0xc3a76c, 0.48);
    const caption = label(SIGN_GLYPHS[index]!, '#b9a87f', 0.23);
    signs.add(band, boundary, caption); signBands.push(band);
    register({ id: `sign:${id}`, name: `${id[0]!.toUpperCase()}${id.slice(1)} · tropical sign`, kind: 'sign', objects: [band, boundary, caption], anchor: caption.position, valid: true, lines: [boundary], label: caption });
  }
  scene.add(signs);
  const referenceGroup = new THREE.Group();
  scene.add(referenceGroup);
  for (const [id, name, target] of [
    ['reference:horizon', 'Local horizon', horizon], ['reference:ecliptic', 'Ecliptic', ecliptic], ['reference:equator', 'Celestial equator', equator],
  ] as const) register({ id, name, kind: 'reference', objects: [target], anchor: new THREE.Vector3(), valid: true, lines: [target] });
  const longitudeProjection = line([], 0xf1d49a, 0.9);
  const longitudeAnchor = new THREE.Mesh(new THREE.RingGeometry(0.056, 0.071, 32), new THREE.MeshBasicMaterial({ color: 0xf1d49a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(longitudeProjection, longitudeAnchor);
  const houseRenderer = createHouseRenderer(SKY_RADIUS, label);
  scene.add(houseRenderer.group);
  for (const entity of houseRenderer.entities) register(entity);
  const constructionRenderer = createConstructionRenderer(SKY_RADIUS, label);
  scene.add(constructionRenderer.group);
  const aspectRenderer = createAspectRenderer(SKY_RADIUS, label);
  scene.add(aspectRenderer.group);
  const trailRenderer = createTrailRenderer(SKY_RADIUS, label);
  scene.add(trailRenderer.group);
  const selection = new THREE.Mesh(new THREE.RingGeometry(0.105, 0.119, 48), new THREE.MeshBasicMaterial({ color: 0xf5e0ac, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  selection.renderOrder = 5;
  selection.visible = false;
  scene.add(selection);

  let snapshot: EphemerisSnapshot | null = null;
  let presentation: ScenePresentation = { viewpoint: 'overview', selectedId: null, houseDisplay: { ...DEFAULT_HOUSE_DISPLAY }, construction: { ...DEFAULT_CONSTRUCTION }, aspects: { ...DEFAULT_ASPECT_DISPLAY }, trails: { ...DEFAULT_TRAIL_DISPLAY }, trailResult: null, history: { ...DEFAULT_BOUNDARY_HISTORY }, historyResult: null, layers: { bodies: true, horizon: true, ecliptic: true, houses: false, stars: true, signs: true, angles: true } };
  let observerEast = new THREE.Vector3(0, 0, -1);
  let observerNorth = new THREE.Vector3(0, 1, 0);
  let observerUp = new THREE.Vector3(1, 0, 0);
  let azimuth = 0;
  let altitude = 25 * RAD;
  let disposed = false;
  let contextLost = false;
  let defaultFraming = true;
  let animationFrame = 0;
  let pointer: { id: number; x: number; y: number; lastX: number; lastY: number; dragged: boolean } | null = null;
  let hoveredId: string | null = null;
  let hoveredGuideId: string | null = null;
  let hoveredName: string | null = null;
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
    // Looking exactly at zenith/nadir needs a nonparallel camera-up direction.
    camera.up.copy(Math.abs(look.dot(observerUp)) > 0.9999 ? observerNorth : observerUp);
    camera.lookAt(look);
    camera.updateMatrixWorld();
  }
  function render(): void {
    animationFrame = 0;
    if (disposed || contextLost) return;
    if (controls.enabled) controls.update();
    if (selection.visible) selection.quaternion.copy(camera.quaternion);
    if (longitudeAnchor.visible) longitudeAnchor.quaternion.copy(camera.quaternion);
    aspectRenderer.faceCamera(camera.quaternion);
    updateLabelLayout();
    renderer.render(scene, camera);
  }
  function updateLabelLayout(): void {
    camera.updateMatrixWorld(); scene.updateMatrixWorld(true);
    const outside = camera.position.length() > SKY_RADIUS * 1.04;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    const candidates: { sprite: THREE.Sprite; priority: number; rectangle: number[] }[] = [];
    const sightline = new THREE.Ray();
    const earthSphere = new THREE.Sphere(new THREE.Vector3(), EARTH_RADIUS);
    const earthHit = new THREE.Vector3();
    scene.traverse(object => {
      if (!(object instanceof THREE.Sprite)) return;
      object.visible = false;
      if (!object.userData.labelEnabled) return;
      const point = object.getWorldPosition(new THREE.Vector3());
      if (outside && point.dot(camera.position) < point.lengthSq()) return;
      const toward = point.clone().sub(camera.position), distance = toward.length();
      if (earth.visible) {
        sightline.set(camera.position, toward.clone().normalize());
        if (sightline.intersectSphere(earthSphere, earthHit) && earthHit.distanceTo(camera.position) < distance - 0.025) return;
      }
      const projected = point.clone().project(camera);
      if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1.04 || Math.abs(projected.y) > 1.04) return;
      const naturalHeight = (object.userData.baseHeight as number) * height / (2 * distance * Math.tan(camera.fov * RAD / 2));
      const textFraction = object.userData.textFraction as number;
      const spriteHeight = THREE.MathUtils.clamp(naturalHeight, (object.userData.minimumTextPixels as number) / textFraction, 23 / textFraction);
      const aspect = object.scale.x / object.scale.y;
      const worldHeight = spriteHeight * 2 * distance * Math.tan(camera.fov * RAD / 2) / height;
      object.scale.set(worldHeight * aspect, worldHeight, 1);
      const spriteWidth = spriteHeight * object.scale.x / object.scale.y;
      const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
      const id = object.userData.entityId as string | undefined;
      const guideId = object.userData.constructionId as string | undefined;
      const priority = object.userData.trailLabel ? object.userData.labelPriority as number || 20
        : guideId ? guideId === hoveredGuideId ? 95 : object.userData.labelPriority as number || 18
        : id === presentation.selectedId ? 100 : id === hoveredId ? 90 : object.userData.labelPriority as number || 10;
      candidates.push({ sprite: object, priority, rectangle: [x - spriteWidth / 2 - 3, y - spriteHeight / 2 - 3, x + spriteWidth / 2 + 3, y + spriteHeight / 2 + 3] });
    });
    candidates.sort((a, b) => b.priority - a.priority);
    const occupied: number[][] = [];
    for (const candidate of candidates) {
      const a = candidate.rectangle;
      if (candidate.priority < 90 && occupied.some(b => a[0]! < b[2]! && a[2]! > b[0]! && a[1]! < b[3]! && a[3]! > b[1]!)) continue;
      candidate.sprite.visible = true; occupied.push(a);
    }
  }
  function resize(): void {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stars.material.uniforms.pixelRatio!.value = renderer.getPixelRatio();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    aspectRenderer.resize(width, height);
    trailRenderer.resize(width, height);
    camera.updateProjectionMatrix();
    if (defaultFraming && presentation.viewpoint !== 'observer') {
      if (presentation.globePickMode) frameEarthForPicking();
      else fitSky(presentation.viewpoint);
    }
    requestRender();
  }
  function viewingDistance(radius: number, margin: number): number {
    const vertical = camera.fov * RAD;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    return radius * margin / Math.sin(Math.min(vertical, horizontal) / 2);
  }
  function settleControls(): void {
    // Drain an old gesture before a deliberate camera command; otherwise its
    // damping could move the freshly framed globe away from the requested point.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
  }
  function fitSky(viewpoint: ScenePresentation['viewpoint']): void {
    settleControls();
    const distance = viewingDistance(SKY_RADIUS, viewpoint === 'outside' ? 1.24 : 1.08);
    camera.position.copy(new THREE.Vector3(7.2, 4.8, 9.4).normalize().multiplyScalar(distance));
    controls.target.set(0, 0, 0);
    controls.maxDistance = Math.max(32, distance * 2);
    camera.far = Math.max(100, distance * 2.5);
    camera.updateProjectionMatrix();
    controls.update();
  }
  function frameEarthForPicking(): void {
    settleControls();
    controls.enabled = !contextLost;
    controls.enablePan = false;
    controls.minDistance = EARTH_RADIUS * 1.15;
    controls.maxDistance = EARTH_RADIUS * 15;
    camera.fov = 43;
    camera.updateProjectionMatrix();
    camera.up.copy(new THREE.Vector3(0, 1, 0).applyQuaternion(earth.quaternion));
    if (Math.abs(camera.up.dot(observerUp)) > 0.98) camera.up.copy(observerNorth);
    camera.position.copy(observerUp).multiplyScalar(viewingDistance(EARTH_RADIUS, 1.2));
    controls.target.set(0, 0, 0);
    controls.update();
  }
  function applyViewpoint(viewpoint: ScenePresentation['viewpoint']): void {
    defaultFraming = true;
    controls.enabled = !contextLost && viewpoint !== 'observer';
    controls.enablePan = true;
    controls.minDistance = 1.4;
    camera.fov = viewpoint === 'observer' ? 65 : 43;
    camera.updateProjectionMatrix();
    if (viewpoint === 'observer') {
      aimObserver();
    } else {
      camera.up.set(0, 1, 0);
      fitSky(viewpoint);
    }
  }
  function updateVisibility(): void {
    const hasData = snapshot !== null;
    const picking = presentation.globePickMode === true;
    houseRenderer.update(snapshot, presentation.houseDisplay, { selectedId: presentation.selectedId, hoveredId, visible: hasData && !picking && presentation.layers.houses, quietComparison: presentation.construction.enabled });
    constructionRenderer.update(snapshot, presentation.construction, { visible: hasData && !picking, hoveredGuideId });
    aspectRenderer.update(snapshot, presentation.aspects, { visible: hasData && !picking, selectedId: presentation.selectedId, hoveredId });
    trailRenderer.update(snapshot, presentation.trails, presentation.trailResult, presentation.history, presentation.historyResult, { visible: hasData && !picking, selectedId: presentation.selectedId });
    // The bounded render pool can represent a different eligible pair after a
    // chart/orb change. Rebind stable IDs without retaining Three object identity.
    for (const [id, entity] of entities) if (entity.kind === 'aspect') entities.delete(id);
    for (const entity of aspectRenderer.entities) register(entity);
    if (constructionRenderer.group.visible) {
      const cuspCaption = entities.get(`boundary:${presentation.construction.boundaryHouse}`)?.label;
      if (cuspCaption) { cuspCaption.visible = false; cuspCaption.userData.labelEnabled = false; }
    }
    sky.visible = !picking;
    earth.visible = picking || presentation.viewpoint !== 'observer';
    observerMarker.visible = hasData && earth.visible;
    observerMarker.scale.setScalar(picking ? 0.35 : 1);
    tangentRing.visible = hasData && earth.visible && presentation.layers.horizon && !picking;
    observerConnector.visible = hasData && earth.visible && presentation.layers.horizon && !picking;
    horizon.visible = hasData && presentation.layers.horizon && !picking;
    compass.visible = horizon.visible;
    horizonPlane.visible = horizon.visible && presentation.viewpoint !== 'observer';
    ecliptic.visible = hasData && presentation.layers.ecliptic && !picking;
    equator.visible = hasData && !!presentation.layers.equator && !picking;
    bodies.visible = hasData && presentation.layers.bodies && !picking;
    stars.visible = hasData && presentation.layers.stars && !picking;
    signs.visible = hasData && !!presentation.layers.signs && !picking;
    constellationGroup.visible = hasData && !!presentation.layers.constellations && !picking;
    canvas.style.cursor = picking ? 'crosshair' : hoveredId ? 'pointer' : 'grab';
    canvas.setAttribute('aria-label', picking
      ? 'Choose an observer on Earth. Drag to rotate the globe, then click a location. Coordinates remain a draft until Apply; numeric fields are available in the location form.'
      : 'Interactive schematic sky. Drag to orbit or look; scroll to zoom. Arrow keys move the view, plus and minus zoom, F focuses selection, and Home returns to observer sky.');
    const linkedSign = selectedBody() ? `sign:${SIGNS[Math.floor(selectedBody()!.longitudeDeg / 30)]}` : null;
    const selectedHouseNumber = presentation.selectedId?.startsWith('house:') ? Number(presentation.selectedId.slice(6)) : null;
    const selectedAspect = snapshot && presentation.selectedId ? getAspectDetails(snapshot.bodies, presentation.selectedId, presentation.aspects.orbs) : null;
    const hoveredAspect = snapshot && hoveredId ? getAspectDetails(snapshot.bodies, hoveredId, presentation.aspects.orbs) : null;
    for (const entity of entities.values()) {
      if (entity.kind === 'house' || entity.kind === 'boundary' || entity.kind === 'aspect') continue;
      const earthReference = entity.id === 'reference:earth' || entity.id === 'reference:observer';
      const enabled = hasData && (earthReference ? earth.visible : !picking) && entity.valid && entityLayerEnabled(entity);
      const body = entity.kind === 'body' && selectedHouseNumber ? snapshot?.bodies.find(item => `body:${item.id}` === entity.id) : undefined;
      const membership = body && snapshot?.houses[0] ? classifyLongitude(snapshot.houses[0], body.longitudeDeg) : null;
      const selected = entity.id === presentation.selectedId || entity.id === linkedSign || membership?.status === 'valid' && membership.house === selectedHouseNumber
        || entity.id === `body:${selectedAspect?.bodyA}` || entity.id === `body:${selectedAspect?.bodyB}`;
      const hovered = entity.id === hoveredId || entity.id === `body:${hoveredAspect?.bodyA}` || entity.id === `body:${hoveredAspect?.bodyB}`;
      for (const object of entity.objects) {
        object.visible = enabled;
        if (object instanceof THREE.Sprite) object.userData.labelEnabled = enabled;
      }
      for (const target of entity.lines) {
        const material = target.material as THREE.LineBasicMaterial;
        material.color.setHex(selected ? 0xf2d79b : hovered ? 0xb1e5df : target.userData.baseColor as number);
        material.opacity = selected ? 0.95 : hovered ? 0.85 : target.userData.baseOpacity as number;
      }
      if (entity.kind === 'sign') {
        const band = entity.objects[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        band.material.opacity = selected ? 0.16 : hovered ? 0.1 : 0.045;
      }
      if (entity.marker) {
        entity.marker.scale.setScalar((entity.id === 'reference:observer' && picking ? 0.35 : 1) * (hovered && !selected ? 1.4 : 1));
        const material = entity.marker.material as THREE.MeshBasicMaterial;
        material.color.setHex(selected ? 0xf2d79b : hovered ? 0xb1e5df : entity.marker.userData.baseColor as number);
      }
    }
    for (const caption of compassLabels) caption.userData.labelEnabled = compass.visible;
    const selected = presentation.selectedId ? entities.get(presentation.selectedId) : undefined;
    selection.visible = !!selected && selected.id !== 'reference:earth' && hasData && !picking && selected.valid && entityLayerEnabled(selected);
    if (selected) selection.position.copy(entityAnchor(selected));
    const earthMaterial = (earth.children[0] as THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>).material;
    earthMaterial.color.setHex(presentation.selectedId === 'reference:earth' ? 0x29535a : hoveredId === 'reference:earth' ? 0x234752 : 0x183847);
    updateLongitudeProjection();
    if (hoveredId && (!entities.get(hoveredId)?.valid || !entityLayerEnabled(entities.get(hoveredId)!))) setHover(null);
    if (hoveredGuideId && !constructionRenderer.hitTargets.some(object => object.visible && object.userData.constructionId === hoveredGuideId && isVisible(object))) setHover(null);
  }
  function entityAnchor(entity: SceneEntity): THREE.Vector3 {
    return presentation.construction.enabled && entity.id === `boundary:${presentation.construction.boundaryHouse}` && constructionRenderer.focusAnchor
      ? constructionRenderer.focusAnchor : entity.anchor;
  }
  function selectedBody() { return snapshot?.bodies.find(body => `body:${body.id}` === presentation.selectedId); }
  function entityLayerEnabled(entity: SceneEntity): boolean {
    if (entity.kind === 'aspect') return presentation.aspects.enabled;
    if (entity.kind === 'house' || entity.kind === 'boundary') return presentation.layers.houses
      || entity.kind === 'boundary' && constructionRenderer.group.visible && entity.id === `boundary:${presentation.construction.boundaryHouse}`;
    if (entity.kind === 'body') return presentation.layers.bodies;
    if (entity.kind === 'sign') return !!presentation.layers.signs;
    if (entity.kind === 'angle') return !!presentation.layers.angles;
    if (entity.kind === 'constellation') return !!presentation.layers.constellations;
    const key = entity.id.slice(10);
    if (key === 'earth' || key === 'observer') return presentation.globePickMode === true || presentation.viewpoint !== 'observer';
    return key === 'horizon' || key === 'zenith' || key === 'nadir' ? presentation.layers.horizon
      : key === 'ecliptic' ? presentation.layers.ecliptic
      : key === 'meridian' ? !!presentation.layers.meridian
      : key === 'prime-vertical' ? !!presentation.layers.primeVertical
      : !!presentation.layers.equator;
  }
  function updateLongitudeProjection(): void {
    const body = selectedBody();
    longitudeProjection.visible = longitudeAnchor.visible = !!body && bodies.visible && !presentation.globePickMode;
    if (!body || !snapshot) return;
    setPoints(longitudeProjection, Array.from({ length: 24 }, (_, index) => vector(eclipticDirection(snapshot!, body.longitudeDeg, body.latitudeDeg * index / 23), SKY_RADIUS * 1.004)));
    longitudeAnchor.position.copy(vector(eclipticDirection(snapshot, body.longitudeDeg), SKY_RADIUS * 1.004));
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
    const rotation = globeOrientationMatrix(next);
    earth.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(
      rotation[0], rotation[1], rotation[2], 0,
      rotation[3], rotation[4], rotation[5], 0,
      rotation[6], rotation[7], rotation[8], 0,
      0, 0, 0, 1,
    ));
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
      const marker = markerMap.get(body.id)!;
      marker.position.copy(position);
      const below = body.horizon.altitudeDeg < 0;
      marker.material.color.setHex(BODY_STYLE[body.id].color).multiplyScalar(below ? 0.52 : 1);
      marker.userData.baseColor = marker.material.color.getHex();
      marker.material.wireframe = below;
      const caption = textMap.get(body.id)!;
      caption.position.copy(position).addScaledVector(observerUp, 0.2);
      caption.material.opacity = below ? 0.53 : 0.95;
      entities.get(`body:${body.id}`)!.name = `${body.id[0]!.toUpperCase()}${body.id.slice(1)}${below ? ' · below horizon' : ' · above horizon'}`;
      if (body.id === 'sun') sunlight.position.copy(position).multiplyScalar(3);
    }
    for (const reference of getSkyReferences(next)) {
      let entity = entities.get(reference.id);
      if (!entity) {
        const isAngle = reference.id.startsWith('angle:');
        const objects: THREE.Object3D[] = [];
        const lines: THREE.Line[] = [];
        let marker: THREE.Mesh | undefined;
        let caption: THREE.Sprite | undefined;
        if (reference.line) {
          const circle = line([], reference.id === 'reference:meridian' ? 0x8c91be : 0x7a9dac, 0.42, true);
          lines.push(circle); objects.push(circle);
        } else {
          marker = new THREE.Mesh(new THREE.OctahedronGeometry(isAngle ? 0.065 : 0.036), new THREE.MeshBasicMaterial({ color: isAngle ? 0xf0cd92 : 0x8fafbf }));
          const short = reference.id === 'reference:north-pole' ? 'NCP' : reference.id === 'reference:south-pole' ? 'SCP'
            : reference.id === 'reference:zenith' ? 'Zenith' : reference.id === 'reference:nadir' ? 'Nadir' : reference.id.slice(6).toUpperCase();
          caption = label(short, isAngle ? '#e6c68e' : '#89aabb', isAngle ? 0.2 : 0.18);
          objects.push(marker, caption);
        }
        referenceGroup.add(...objects);
        entity = { id: reference.id, name: reference.name, kind: isAngle ? 'angle' : 'reference', objects, anchor: new THREE.Vector3(), valid: false, lines, ...(marker ? { marker } : {}), ...(caption ? { label: caption } : {}) };
        register(entity);
      }
      entity.valid = reference.status === 'valid';
      if (reference.line) {
        for (const target of entity.lines) setPoints(target, reference.line.map(point => vector(point, SKY_RADIUS)));
        entity.anchor.copy(vector(reference.line[0]!, SKY_RADIUS));
      } else if (reference.point) {
        entity.anchor.copy(vector(reference.point, SKY_RADIUS));
        entity.marker?.position.copy(entity.anchor);
        const labelUp = Math.abs(entity.anchor.clone().normalize().dot(observerUp)) > 0.9 ? observerNorth : observerUp;
        entity.label?.position.copy(entity.anchor).addScaledVector(labelUp, 0.2);
      }
    }
    for (const [index, id] of SIGNS.entries()) {
      const entity = entities.get(`sign:${id}`)!;
      const vertices: number[] = [];
      for (let segment = 0; segment < 16; segment++) {
        const lambda0 = index * 30 + segment * 30 / 16;
        const lambda1 = index * 30 + (segment + 1) * 30 / 16;
        const a = vector(eclipticDirection(next, lambda0, -3), SKY_RADIUS * 0.998);
        const b = vector(eclipticDirection(next, lambda1, -3), SKY_RADIUS * 0.998);
        const c = vector(eclipticDirection(next, lambda1, 3), SKY_RADIUS * 0.998);
        const d = vector(eclipticDirection(next, lambda0, 3), SKY_RADIUS * 0.998);
        vertices.push(...a.toArray(), ...b.toArray(), ...d.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray());
      }
      const band = signBands[index]!;
      const attribute = band.geometry.getAttribute('position');
      if (attribute) { (attribute.array as Float32Array).set(vertices); attribute.needsUpdate = true; }
      else band.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      band.geometry.computeBoundingSphere();
      setPoints(entity.lines[0]!, Array.from({ length: 13 }, (_, step) => vector(eclipticDirection(next, index * 30, -3 + step * 0.5), SKY_RADIUS * 1.001)));
      entity.anchor.copy(vector(eclipticDirection(next, index * 30 + 15, 5), SKY_RADIUS));
    }
    const positions = stars.geometry.getAttribute('position');
    for (const [index, star] of CATALOGUE_STARS.entries()) {
      const point = vector(catalogueStarDirection(star, next.time.julianDateTt), SKY_RADIUS * 1.004);
      positions.setXYZ(index, point.x, point.y, point.z);
    }
    positions.needsUpdate = true; stars.geometry.computeBoundingSphere();
    if (presentation.viewpoint === 'observer') aimObserver();
  }
  function pointRay(event: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointerNdc, camera);
    const distance = camera.position.length() > SKY_RADIUS ? Math.max(1, camera.position.length() - SKY_RADIUS) : SKY_RADIUS;
    raycaster.params.Line.threshold = THREE.MathUtils.clamp(distance * Math.tan(camera.fov * RAD / 2) * 8 / Math.max(1, rect.height), 0.016, 0.1);
    raycaster.params.Line2 = { threshold: 6 };
  }
  function isVisible(object: THREE.Object3D): boolean {
    for (let target: THREE.Object3D | null = object; target; target = target.parent) if (!target.visible) return false;
    return true;
  }
  function entityAt(event: PointerEvent): (SceneEntity & { guideId?: string }) | undefined {
    if (!snapshot || presentation.globePickMode) return;
    pointRay(event);
    const targets = [...[...entities.values()].flatMap(entity => entity.objects), ...constructionRenderer.hitTargets, ...trailRenderer.hitTargets].filter(object => object.userData.pickable !== false && isVisible(object));
    const globeIntersection = earth.visible ? raycaster.intersectObject(earth.children[0]!, false)[0] : undefined;
    const pointDistance = (object: THREE.Object3D): number => {
      const id = object.userData.entityId as string;
      const pointLike = object instanceof THREE.Sprite || object instanceof THREE.Mesh && (object.userData.aspectEndpoint || object.userData.constructionId || id !== 'reference:earth' && ['body', 'angle', 'reference'].includes(object.userData.entityKind as string));
      if (!pointLike) return Infinity;
      const projected = object.getWorldPosition(new THREE.Vector3()).project(camera);
      return Math.hypot((projected.x - pointerNdc.x) * canvas.clientWidth / 2, (projected.y - pointerNdc.y) * canvas.clientHeight / 2);
    };
    const priority = (object: THREE.Object3D) => object.userData.constructionIntersection ? -1 : object.userData.constructionId && object instanceof THREE.Line ? 0.5 : Number.isFinite(pointDistance(object)) ? 0 : object.userData.wideLine ? 0.75
      : object instanceof THREE.Line ? 1 : object.userData.entityKind === 'sign' ? 2 : object.userData.entityKind === 'house' ? 4 : 3;
    const hits = raycaster.intersectObjects(targets, false).filter(hit =>
      (hit.object.userData.ignoreEarthOcclusion || !globeIntersection || hit.distance < globeIntersection.distance + (hit.object.userData.entityId === 'reference:earth' ? 1e-6 : 0))
      && (hit.object.userData.entityKind !== 'house' || isHouseDirectionPickable(snapshot!, threeToAstronomical(hit.point))));
    // Nearby body/angle markers can overlap (ASC and Jupiter in the example).
    // Resolve actual point/glyph centres before broad reference lines or belts.
    hits.sort((a, b) => priority(a.object) - priority(b.object) || (Number.isFinite(pointDistance(a.object)) ? pointDistance(a.object) - pointDistance(b.object) : 0) || a.distance - b.distance);
    const object = hits[0]?.object;
    const entity = object ? entities.get(object.userData.entityId as string) : undefined;
    return entity && object?.userData.hoverName ? { ...entity, name: object.userData.hoverName as string, ...(object.userData.constructionId ? { guideId: object.userData.constructionId as string } : {}) } : entity;
  }
  function setHover(id: string | null, name: string | null = null, guideId: string | null = null): void {
    if (id === hoveredId && name === hoveredName && guideId === hoveredGuideId) return;
    hoveredId = id; hoveredName = name; hoveredGuideId = guideId;
    const entity = id ? entities.get(id) : undefined;
    options.onHover?.(entity ? { id: entity.id, name: name ?? entity.name } : null);
    canvas.style.cursor = presentation.globePickMode ? 'crosshair' : entity ? 'pointer' : 'grab';
    updateVisibility(); requestRender();
  }
  function clearHover(): void { setHover(null); }
  function selectAt(event: PointerEvent): void {
    if (!snapshot) return;
    if (presentation.globePickMode) {
      pointRay(event);
      const picked = raycaster.intersectObject(earth.children[0]!, false)[0];
      if (picked) options.onObserverPick?.(globeWorldPointToCoordinates(picked.point, snapshot));
      return;
    }
    options.onSelect?.(entityAt(event)?.id ?? null);
  }
  function pointerDown(event: PointerEvent): void {
    if (disposed || contextLost) return;
    if (event.button !== 0) { defaultFraming = false; return; }
    canvas.focus({ preventScroll: true });
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, dragged: false };
    if (presentation.viewpoint === 'observer') canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent): void {
    if (!pointer) { const entity = entityAt(event); setHover(entity?.id ?? null, entity?.name ?? null, entity?.guideId ?? null); return; }
    if (pointer.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4) pointer.dragged = true;
    if (pointer.dragged) defaultFraming = false;
    if (pointer.dragged) clearHover();
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
    defaultFraming = false;
    if (presentation.viewpoint !== 'observer') return;
    event.preventDefault();
    camera.fov = THREE.MathUtils.clamp(camera.fov + Math.sign(event.deltaY) * 3, 25, 105);
    camera.updateProjectionMatrix();
    requestRender();
  }
  function focusSelection(): void {
    if (disposed || contextLost || presentation.globePickMode) return;
    const target = presentation.selectedId ? entities.get(presentation.selectedId) : undefined;
    if (!snapshot || !target?.valid) return;
    if (target.id === 'reference:earth' || target.id === 'reference:observer') {
      const viewpointChanged = presentation.viewpoint !== 'overview';
      presentation = { ...presentation, viewpoint: 'overview' };
      applyViewpoint('overview'); defaultFraming = false;
      settleControls();
      controls.target.copy(target.id === 'reference:observer' ? observerMarker.position : new THREE.Vector3());
      camera.position.copy(observerUp).multiplyScalar(viewingDistance(EARTH_RADIUS, 1.4));
      camera.up.copy(observerNorth); controls.update(); updateVisibility();
      if (viewpointChanged) options.onViewpoint?.('overview');
      requestRender(); return;
    }
    const anchor = entityAnchor(target);
    const direction = anchor.clone().normalize();
    if (presentation.viewpoint === 'observer') {
      azimuth = Math.atan2(direction.dot(observerEast), direction.dot(observerNorth));
      altitude = Math.asin(THREE.MathUtils.clamp(direction.dot(observerUp), -1, 1));
      aimObserver();
    } else {
      defaultFraming = false;
      settleControls();
      controls.target.copy(anchor);
      const offsetUp = observerUp.clone().addScaledVector(direction, -observerUp.dot(direction)).normalize();
      if (offsetUp.lengthSq() < 0.01) offsetUp.copy(observerNorth);
      const distance = target.focusRadius ? viewingDistance(target.focusRadius, 1.18) : 3.6;
      camera.position.copy(anchor).addScaledVector(direction, distance).addScaledVector(offsetUp, target.focusRadius ? distance * 0.12 : 1.1);
      controls.update();
    }
    requestRender();
  }
  function returnToObserver(): void {
    if (disposed || contextLost || presentation.globePickMode) return;
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
      defaultFraming = false;
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
  canvas.addEventListener('pointerleave', clearHover);
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
      const wasPicking = presentation.globePickMode === true;
      const changedSnapshot = nextSnapshot !== snapshot;
      const aspectSettings = nextPresentation.aspects ?? DEFAULT_ASPECT_DISPLAY;
      presentation = { ...nextPresentation, houseDisplay: { ...(nextPresentation.houseDisplay ?? DEFAULT_HOUSE_DISPLAY) }, construction: { ...(nextPresentation.construction ?? DEFAULT_CONSTRUCTION) }, aspects: { ...aspectSettings, types: { ...aspectSettings.types }, orbs: { ...aspectSettings.orbs } }, trails: { ...(nextPresentation.trails ?? DEFAULT_TRAIL_DISPLAY) }, trailResult: nextPresentation.trailResult ?? null, history: { ...(nextPresentation.history ?? DEFAULT_BOUNDARY_HISTORY) }, historyResult: nextPresentation.historyResult ?? null, layers: { ...nextPresentation.layers } };
      snapshot = nextSnapshot;
      if (changedSnapshot && snapshot) updateSnapshot(snapshot);
      if (presentation.globePickMode) {
        if (!wasPicking) {
          defaultFraming = true;
          presentation.viewpoint = 'overview';
          frameEarthForPicking();
          options.onViewpoint?.('overview');
        }
      } else if (changedViewpoint || wasPicking) applyViewpoint(presentation.viewpoint);
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
      canvas.removeEventListener('pointerleave', clearHover);
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
