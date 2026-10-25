import {
  eclipticToEquatorial, equatorialOfDateToFixed, equatorialToEcliptic,
  equatorialToVector, horizonToEquatorial, normalizeDegrees, normalizeVector,
  vectorToEquatorial, type Vector3,
} from '../astronomy/coordinates';
import type { EphemerisSnapshot } from '../astronomy/ephemeris';

export interface SkyReferenceSource {
  readonly title: string;
  readonly url: string;
  /** Exact source heading or glossary entry supporting the explanation. */
  readonly section: string;
}

export interface SkyReference {
  readonly id: string;
  readonly name: string;
  readonly explanation: string;
  readonly source: SkyReferenceSource;
  readonly status: 'valid' | 'undefined';
  readonly reason?: string;
  /** Unit direction in astronomical fixed-J2000 axes; apply the Three adapter once. */
  readonly point?: Vector3;
  /** A closed unit great circle with 180 samples and no repeated endpoint. */
  readonly line?: Vector3[];
  /** Geometric sky angle, not a house system's potentially swapped polar cusp axis. */
  readonly longitudeDeg?: number;
}

const RAD = Math.PI / 180;
const SAMPLES = 180;
const SINGULAR_EPSILON = 1e-12;
const NASA_URL = 'https://science.nasa.gov/learn/basics-of-space-flight/chapter2-2/';
const USNO_URL = 'https://aa.usno.navy.mil/faq/asa_glossary';
const SWISS_URL = 'https://www.astro.com/swisseph/swisseph.htm';
const nasa = (section: string): SkyReferenceSource => ({ title: 'NASA — Basics of Space Flight, Chapter 2', url: NASA_URL, section });
const glossary = (section: string): SkyReferenceSource => ({ title: 'US Naval Observatory — Astronomical Almanac Glossary', url: USNO_URL, section });
const angleSource: SkyReferenceSource = {
  title: 'Swiss Ephemeris documentation', url: SWISS_URL,
  section: '6.4 House cusps beyond the polar circle; 6.4.1 Implementation in other calculation modules',
};
const metadata: Omit<SkyReference, 'status' | 'reason' | 'point' | 'line' | 'longitudeDeg'>[] = [
  {
    id: 'reference:horizon', name: 'Horizon',
    explanation: 'The great circle at geometric altitude zero. Its plane passes through the sky’s centre, perpendicular to the observer’s upward direction.',
    source: glossary('horizon; horizon, geocentric'),
  },
  {
    id: 'reference:ecliptic', name: 'Ecliptic',
    explanation: 'The circle of zero ecliptic latitude, aligned with Earth’s orbital plane. Tropical longitude and the twelve signs are measured around this circle.',
    source: nasa('Declination and Right Ascension — ecliptic plane and vernal equinox'),
  },
  {
    id: 'reference:equator', name: 'Celestial equator',
    explanation: 'The circle of declination zero, perpendicular to the current celestial poles. Its inclination to the ecliptic is the obliquity.',
    source: nasa('The Celestial Sphere; Declination and Right Ascension'),
  },
  {
    id: 'reference:meridian', name: 'Local meridian',
    explanation: 'The great circle through the zenith, nadir, and celestial poles. It crosses the horizon at north and south.',
    source: glossary('meridian'),
  },
  {
    id: 'reference:prime-vertical', name: 'Prime vertical',
    explanation: 'The vertical great circle through east, zenith, west, and nadir, perpendicular to the local meridian.',
    source: {
      title: 'NGA — The American Practical Navigator (Bowditch), Volume 2',
      url: 'https://msi.nga.mil/api/publications/download?key=16693975%2FSFH00000%2FBowditch_Vol_2_LoRes.pdf&type=view',
      section: 'Glossary — prime vertical circle',
    },
  },
  {
    id: 'reference:zenith', name: 'Zenith',
    explanation: 'The observer’s upward direction on the celestial sphere, at geometric altitude +90°.',
    source: nasa('The Celestial Sphere — zenith'),
  },
  {
    id: 'reference:nadir', name: 'Nadir',
    explanation: 'The direction opposite the zenith, at geometric altitude −90°.',
    source: nasa('The Celestial Sphere — nadir'),
  },
  {
    id: 'reference:north-pole', name: 'North celestial pole',
    explanation: 'The north end of the celestial rotation axis, at declination +90°. Its direction follows the equatorial frame of the selected date.',
    source: nasa('The Celestial Sphere; Declination and Right Ascension — celestial poles'),
  },
  {
    id: 'reference:south-pole', name: 'South celestial pole',
    explanation: 'The south end of the celestial rotation axis, at declination −90°, opposite the north celestial pole.',
    source: nasa('The Celestial Sphere; Declination and Right Ascension — celestial poles'),
  },
  {
    id: 'angle:asc', name: 'Ascendant · ASC',
    explanation: 'The eastern intersection of the ecliptic and horizon, where an ecliptic point rises as Earth turns.',
    source: angleSource,
  },
  {
    id: 'angle:dsc', name: 'Descendant · DSC',
    explanation: 'The western intersection of the ecliptic and horizon, opposite the Ascendant, where an ecliptic point sets.',
    source: angleSource,
  },
  {
    id: 'angle:mc', name: 'Midheaven · MC',
    explanation: 'The ecliptic point at its upper daily meridian transit. At high latitudes this point can be below the horizon.',
    source: angleSource,
  },
  {
    id: 'angle:ic', name: 'Imum Coeli · IC',
    explanation: 'The ecliptic point opposite the Midheaven, at its lower daily meridian transit.',
    source: angleSource,
  },
];

function scale(value: Vector3, amount: number): Vector3 {
  return { x: value.x * amount, y: value.y * amount, z: value.z * amount };
}
function dot(a: Vector3, b: Vector3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: Vector3, b: Vector3): Vector3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function circle(first: Vector3, quarter: Vector3): Vector3[] {
  return Array.from({ length: SAMPLES }, (_, index) => {
    const phase = index * 2 * Math.PI / SAMPLES;
    return {
      x: first.x * Math.cos(phase) + quarter.x * Math.sin(phase),
      y: first.y * Math.cos(phase) + quarter.y * Math.sin(phase),
      z: first.z * Math.cos(phase) + quarter.z * Math.sin(phase),
    };
  });
}

/** Preserve latitude and rotate true ecliptic-of-date directions into the fixed world. */
export function eclipticDirection(snapshot: EphemerisSnapshot, longitudeDeg: number, latitudeDeg = 0): Vector3 {
  return equatorialOfDateToFixed(equatorialToVector(eclipticToEquatorial({ longitudeDeg, latitudeDeg }, snapshot.trueObliquityDeg)), snapshot.frame);
}

/**
 * Geometry is independent of the selected house construction. In particular, a
 * Placidus/Koch failure does not erase well-defined ecliptic/horizon intersections.
 * Swiss Regiomontanus/Campanus may swap MC/IC when the upper-transit MC is below
 * the horizon, and polar house constructions can alter cusp-axis conventions.
 * These references keep literal eastern/rising ASC and hour-angle-zero MC.
 * Construction guides must use each HouseResult's own angles and cusp convention.
 */
export function getSkyReferences(snapshot: EphemerisSnapshot): SkyReference[] {
  const fixed = (direction: Vector3) => equatorialOfDateToFixed(direction, snapshot.frame);
  const local = (east: number, north: number, up: number) => equatorialToVector(horizonToEquatorial(
    { east, north, up }, snapshot.observer, snapshot.greenwichSiderealTimeDeg,
  ));
  const eastOfDate = local(1, 0, 0);
  const northOfDate = local(0, 1, 0);
  const upOfDate = local(0, 0, 1);
  const east = fixed(eastOfDate), north = fixed(northOfDate), up = fixed(upOfDate);
  const eclipticZero = eclipticDirection(snapshot, 0), eclipticQuarter = eclipticDirection(snapshot, 90);
  const points = new Map<string, Vector3>([
    ['reference:zenith', up], ['reference:nadir', scale(up, -1)],
    ['reference:north-pole', fixed({ x: 0, y: 0, z: 1 })],
    ['reference:south-pole', fixed({ x: 0, y: 0, z: -1 })],
  ]);
  const lines = new Map<string, Vector3[]>([
    ['reference:horizon', circle(north, east)],
    ['reference:ecliptic', circle(eclipticZero, eclipticQuarter)],
    ['reference:equator', circle(fixed({ x: 1, y: 0, z: 0 }), fixed({ x: 0, y: 1, z: 0 }))],
  ]);
  const longitudes = new Map<string, number>();
  const undefinedReasons = new Map<string, string>();
  const atGeographicPole = Math.abs(snapshot.observer.latitudeDeg) === 90;
  if (atGeographicPole) {
    const reason = 'At an exact geographic pole there is no unique local north–south meridian or rising/setting orientation. These angles are undefined.';
    for (const id of ['reference:meridian', 'reference:prime-vertical', 'angle:asc', 'angle:dsc', 'angle:mc', 'angle:ic']) undefinedReasons.set(id, reason);
  } else {
    lines.set('reference:meridian', circle(north, up));
    lines.set('reference:prime-vertical', circle(east, up));
    const obliquity = snapshot.trueObliquityDeg * RAD;
    const eclipticNormal = { x: 0, y: -Math.sin(obliquity), z: Math.cos(obliquity) };
    const horizonIntersection = cross(upOfDate, eclipticNormal);
    const intersectionLength = Math.hypot(horizonIntersection.x, horizonIntersection.y, horizonIntersection.z);
    function addAngle(id: string, ofDate: Vector3): void {
      points.set(id, fixed(ofDate));
      const ecliptic = equatorialToEcliptic(vectorToEquatorial(ofDate), snapshot.trueObliquityDeg);
      longitudes.set(id, normalizeDegrees(ecliptic.longitudeDeg));
    }
    if (intersectionLength < SINGULAR_EPSILON) {
      const reason = 'The horizon and ecliptic planes coincide at this orientation; they have no unique pair of intersections.';
      undefinedReasons.set('angle:asc', reason); undefinedReasons.set('angle:dsc', reason);
    } else {
      let ascendant = normalizeVector(horizonIntersection);
      const eastComponent = dot(ascendant, eastOfDate);
      if (Math.abs(eastComponent) < SINGULAR_EPSILON) {
        const reason = 'The ecliptic touches the horizon at meridian transit; a unique rising or setting branch is undefined at this instant.';
        undefinedReasons.set('angle:asc', reason); undefinedReasons.set('angle:dsc', reason);
      } else {
        if (eastComponent < 0) ascendant = scale(ascendant, -1);
        addAngle('angle:asc', ascendant); addAngle('angle:dsc', scale(ascendant, -1));
      }
    }
    // The local east vector is normal to the meridian plane. Its intersection
    // with the ecliptic has a branch at hour angle zero, even when below horizon.
    let midheaven = normalizeVector(cross(eastOfDate, eclipticNormal));
    const theta = normalizeDegrees(snapshot.greenwichSiderealTimeDeg + snapshot.observer.longitudeDeg) * RAD;
    const upperTransitEquator = { x: Math.cos(theta), y: Math.sin(theta), z: 0 };
    if (dot(midheaven, upperTransitEquator) < 0) midheaven = scale(midheaven, -1);
    addAngle('angle:mc', midheaven); addAngle('angle:ic', scale(midheaven, -1));
  }
  return metadata.map((entry) => {
    const reason = undefinedReasons.get(entry.id);
    if (reason) return { ...entry, source: { ...entry.source }, status: 'undefined', reason };
    const point = points.get(entry.id), line = lines.get(entry.id), longitudeDeg = longitudes.get(entry.id);
    return {
      ...entry, source: { ...entry.source }, status: 'valid',
      ...(point ? { point } : {}), ...(line ? { line } : {}), ...(longitudeDeg !== undefined ? { longitudeDeg } : {}),
    };
  });
}
