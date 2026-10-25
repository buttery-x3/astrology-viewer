/** Pure direction transforms. Angles are degrees, geographic longitude is east-positive. */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SphericalCoordinates {
  readonly longitudeDeg: number;
  readonly latitudeDeg: number;
}

export interface EquatorialCoordinates {
  readonly rightAscensionDeg: number;
  readonly declinationDeg: number;
}

export interface ObserverCoordinates {
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
}

export interface EastNorthUp {
  readonly east: number;
  readonly north: number;
  readonly up: number;
}

export interface HorizonCoordinates extends EastNorthUp {
  /** Undefined at the zenith/nadir; these directions have no unique azimuth. */
  readonly azimuthDeg: number | null;
  readonly altitudeDeg: number;
}

/** Row-major rotation, multiplying a column vector. */
export type Matrix3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

/**
 * The engine must supply the full of-date -> J2000 rotation, including the
 * frame's nutation convention. A precession-only estimate is not interchangeable
 * with an apparent (true equator/equinox) of-date transform.
 */
export interface EquatorialFrameTransform {
  readonly from: 'equatorial-of-date';
  readonly to: 'equatorial-j2000';
  readonly julianDateTt: number;
  readonly ofDateKind: 'mean' | 'true';
  readonly source: string;
  readonly rotation: Matrix3;
}

export const IDENTITY_MATRIX3: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const TO_RADIANS = Math.PI / 180;
const TO_DEGREES = 180 / Math.PI;
const DIRECTION_EPSILON = 1e-14;

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
}

function latitude(value: number, name: string): void {
  finite(value, name);
  if (Math.abs(value) > 90) throw new RangeError(`${name} must be between -90 and 90 degrees.`);
}

/** The result is in [0,360), with negative zero removed. */
export function normalizeDegrees(degrees: number): number {
  finite(degrees, 'Angle');
  const remainder = degrees % 360;
  const normalized = remainder < 0 ? remainder + 360 : remainder;
  return normalized === 0 || normalized === 360 ? 0 : normalized;
}

/** Signed shortest turn from `fromDeg` to `toDeg`, in [-180,180). */
export function signedAngularDifferenceDegrees(fromDeg: number, toDeg: number): number {
  return normalizeDegrees(normalizeDegrees(toDeg) - normalizeDegrees(fromDeg) + 180) - 180;
}

export function normalizeVector(vector: Vector3): Vector3 {
  finite(vector.x, 'Vector x');
  finite(vector.y, 'Vector y');
  finite(vector.z, 'Vector z');
  const scale = Math.max(Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z));
  if (scale === 0) throw new RangeError('A zero vector has no direction.');
  const x = vector.x / scale;
  const y = vector.y / scale;
  const z = vector.z / scale;
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}

export function sphericalToVector(coordinates: SphericalCoordinates): Vector3 {
  latitude(coordinates.latitudeDeg, 'Latitude');
  const longitude = normalizeDegrees(coordinates.longitudeDeg) * TO_RADIANS;
  const lat = coordinates.latitudeDeg * TO_RADIANS;
  return { x: Math.cos(lat) * Math.cos(longitude), y: Math.cos(lat) * Math.sin(longitude), z: Math.sin(lat) };
}

/** Longitude is conventionally 0 at a pole, where it is mathematically arbitrary. */
export function vectorToSpherical(vector: Vector3): SphericalCoordinates {
  const unit = normalizeVector(vector);
  return {
    longitudeDeg: Math.hypot(unit.x, unit.y) < DIRECTION_EPSILON ? 0 : normalizeDegrees(Math.atan2(unit.y, unit.x) * TO_DEGREES),
    latitudeDeg: Math.atan2(unit.z, Math.hypot(unit.x, unit.y)) * TO_DEGREES,
  };
}

export function equatorialToVector(coordinates: EquatorialCoordinates): Vector3 {
  return sphericalToVector({ longitudeDeg: coordinates.rightAscensionDeg, latitudeDeg: coordinates.declinationDeg });
}

export function vectorToEquatorial(vector: Vector3): EquatorialCoordinates {
  const spherical = vectorToSpherical(vector);
  return { rightAscensionDeg: spherical.longitudeDeg, declinationDeg: spherical.latitudeDeg };
}

export function eclipticToEquatorial(coordinates: SphericalCoordinates, obliquityDeg: number): EquatorialCoordinates {
  finite(obliquityDeg, 'Obliquity');
  const vector = sphericalToVector(coordinates);
  const epsilon = obliquityDeg * TO_RADIANS;
  return vectorToEquatorial({
    x: vector.x,
    y: Math.cos(epsilon) * vector.y - Math.sin(epsilon) * vector.z,
    z: Math.sin(epsilon) * vector.y + Math.cos(epsilon) * vector.z,
  });
}

export function equatorialToEcliptic(coordinates: EquatorialCoordinates, obliquityDeg: number): SphericalCoordinates {
  finite(obliquityDeg, 'Obliquity');
  const vector = equatorialToVector(coordinates);
  const epsilon = obliquityDeg * TO_RADIANS;
  return vectorToSpherical({
    x: vector.x,
    y: Math.cos(epsilon) * vector.y + Math.sin(epsilon) * vector.z,
    z: -Math.sin(epsilon) * vector.y + Math.cos(epsilon) * vector.z,
  });
}

/** A proper, right-handed rotation must have orthonormal rows and determinant +1. */
export function validateRotationMatrix(rotation: Matrix3, tolerance = 1e-10): void {
  if (rotation.length !== 9) throw new RangeError('A rotation matrix requires nine entries.');
  finite(tolerance, 'Rotation tolerance');
  if (tolerance <= 0 || tolerance > 1e-3) throw new RangeError('Rotation tolerance must be positive and no greater than 0.001.');
  for (const entry of rotation) finite(entry, 'Rotation entry');
  for (let row = 0; row < 3; row += 1) {
    for (let other = row; other < 3; other += 1) {
      let dot = 0;
      for (let column = 0; column < 3; column += 1) dot += rotation[row * 3 + column]! * rotation[other * 3 + column]!;
      if (Math.abs(dot - (row === other ? 1 : 0)) > tolerance) throw new RangeError('Rotation matrix must be orthonormal.');
    }
  }
  const [a, b, c, d, e, f, g, h, i] = rotation;
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(determinant - 1) > tolerance) throw new RangeError('Rotation matrix must preserve handedness.');
}

export function rotateVector(vector: Vector3, rotation: Matrix3): Vector3 {
  finite(vector.x, 'Vector x');
  finite(vector.y, 'Vector y');
  finite(vector.z, 'Vector z');
  return {
    x: rotation[0] * vector.x + rotation[1] * vector.y + rotation[2] * vector.z,
    y: rotation[3] * vector.x + rotation[4] * vector.y + rotation[5] * vector.z,
    z: rotation[6] * vector.x + rotation[7] * vector.y + rotation[8] * vector.z,
  };
}

export function transposeMatrix(rotation: Matrix3): Matrix3 {
  return [rotation[0], rotation[3], rotation[6], rotation[1], rotation[4], rotation[7], rotation[2], rotation[5], rotation[8]];
}

export function createEquatorialFrameTransform(input: Omit<EquatorialFrameTransform, 'from' | 'to'>): EquatorialFrameTransform {
  finite(input.julianDateTt, 'Julian date TT');
  if (!input.source.trim()) throw new RangeError('Frame transform requires source provenance.');
  validateRotationMatrix(input.rotation);
  return Object.freeze({ ...input, from: 'equatorial-of-date', to: 'equatorial-j2000', rotation: Object.freeze([...input.rotation]) as Matrix3 });
}

export function equatorialOfDateToFixed(vector: Vector3, transform: EquatorialFrameTransform): Vector3 {
  validateRotationMatrix(transform.rotation);
  return rotateVector(vector, transform.rotation);
}

export function fixedToEquatorialOfDate(vector: Vector3, transform: EquatorialFrameTransform): Vector3 {
  validateRotationMatrix(transform.rotation);
  return rotateVector(vector, transposeMatrix(transform.rotation));
}

/** Greenwich sidereal time must match the mean/true convention of the equatorial input. */
export function equatorialToHorizon(
  coordinates: EquatorialCoordinates,
  observer: ObserverCoordinates,
  greenwichSiderealTimeDeg: number,
): HorizonCoordinates {
  latitude(observer.latitudeDeg, 'Observer latitude');
  const vector = equatorialToVector(coordinates);
  const phi = observer.latitudeDeg * TO_RADIANS;
  const theta = normalizeDegrees(normalizeDegrees(greenwichSiderealTimeDeg) + normalizeDegrees(observer.longitudeDeg)) * TO_RADIANS;
  const east = -Math.sin(theta) * vector.x + Math.cos(theta) * vector.y;
  const north = -Math.sin(phi) * Math.cos(theta) * vector.x - Math.sin(phi) * Math.sin(theta) * vector.y + Math.cos(phi) * vector.z;
  const up = Math.cos(phi) * Math.cos(theta) * vector.x + Math.cos(phi) * Math.sin(theta) * vector.y + Math.sin(phi) * vector.z;
  const horizontalLength = Math.hypot(east, north);
  return {
    east, north, up,
    azimuthDeg: horizontalLength < DIRECTION_EPSILON ? null : normalizeDegrees(Math.atan2(east, north) * TO_DEGREES),
    altitudeDeg: Math.atan2(up, horizontalLength) * TO_DEGREES,
  };
}

export function horizonToEquatorial(
  direction: EastNorthUp,
  observer: ObserverCoordinates,
  greenwichSiderealTimeDeg: number,
): EquatorialCoordinates {
  latitude(observer.latitudeDeg, 'Observer latitude');
  const local = normalizeVector({ x: direction.east, y: direction.north, z: direction.up });
  const phi = observer.latitudeDeg * TO_RADIANS;
  const theta = normalizeDegrees(normalizeDegrees(greenwichSiderealTimeDeg) + normalizeDegrees(observer.longitudeDeg)) * TO_RADIANS;
  return vectorToEquatorial({
    x: -Math.sin(theta) * local.x - Math.sin(phi) * Math.cos(theta) * local.y + Math.cos(phi) * Math.cos(theta) * local.z,
    y: Math.cos(theta) * local.x - Math.sin(phi) * Math.sin(theta) * local.y + Math.cos(phi) * Math.sin(theta) * local.z,
    z: Math.cos(phi) * local.y + Math.sin(phi) * local.z,
  });
}

/** Geographic location on a unit schematic globe in the matching equatorial-of-date axes. */
export function geographicToEquatorialVector(observer: ObserverCoordinates, greenwichSiderealTimeDeg: number): Vector3 {
  return sphericalToVector({ longitudeDeg: normalizeDegrees(greenwichSiderealTimeDeg) + normalizeDegrees(observer.longitudeDeg), latitudeDeg: observer.latitudeDeg });
}

/** Astronomical +X=equinox,+Y=RA90,+Z=north -> Three +Y=north. */
export function astronomicalToThree(vector: Vector3): Vector3 {
  finite(vector.x, 'Vector x');
  finite(vector.y, 'Vector y');
  finite(vector.z, 'Vector z');
  return { x: vector.x, y: vector.z, z: -vector.y };
}

export function threeToAstronomical(vector: Vector3): Vector3 {
  finite(vector.x, 'Vector x');
  finite(vector.y, 'Vector y');
  finite(vector.z, 'Vector z');
  return { x: vector.x, y: -vector.z, z: vector.y };
}
