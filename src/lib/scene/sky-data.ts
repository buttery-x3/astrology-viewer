import { sphericalToVector, type Vector3 } from '../astronomy/coordinates';
import starData from './data/bright-stars.json';
import boundaryData from './data/constellation-boundaries.json';
import manifest from './data/sky-data-manifest.json';

export type CatalogueStar = readonly [hygId: number, name: string, magnitude: number,
  xPc: number, yPc: number, zPc: number, vxPcPerYear: number, vyPcPerYear: number,
  vzPcPerYear: number, colorIndex: number | null];
export const CATALOGUE_STARS = starData.stars as unknown as readonly CatalogueStar[];
export const SKY_DATA_SOURCES = { stars: manifest.stars, constellations: manifest.constellations } as const;
export const SKY_DATA_POLICY = 'HYG v4.1 stars use mean astrometric J2000 directions with linear catalogue proper motion; annual aberration/parallax and variable brightness are omitted. Constellation regions use Pierre Barbier’s interpolated J2000 transformation of Delporte’s B1875 boundaries. Both derived datasets are CC BY-SA 4.0.';

/** Factual IAU names; Serpens is one constellation with two disjoint regions. */
const names: Record<string, string> = {
  AND: 'Andromeda', ANT: 'Antlia', APS: 'Apus', AQR: 'Aquarius', AQL: 'Aquila', ARA: 'Ara', ARI: 'Aries', AUR: 'Auriga', BOO: 'Boötes', CAE: 'Caelum', CAM: 'Camelopardalis', CNC: 'Cancer', CVN: 'Canes Venatici', CMA: 'Canis Major', CMI: 'Canis Minor', CAP: 'Capricornus', CAR: 'Carina', CAS: 'Cassiopeia', CEN: 'Centaurus', CEP: 'Cepheus', CET: 'Cetus', CHA: 'Chamaeleon', CIR: 'Circinus', COL: 'Columba', COM: 'Coma Berenices', CRA: 'Corona Australis', CRB: 'Corona Borealis', CRV: 'Corvus', CRT: 'Crater', CRU: 'Crux', CYG: 'Cygnus', DEL: 'Delphinus', DOR: 'Dorado', DRA: 'Draco', EQU: 'Equuleus', ERI: 'Eridanus', FOR: 'Fornax', GEM: 'Gemini', GRU: 'Grus', HER: 'Hercules', HOR: 'Horologium', HYA: 'Hydra', HYI: 'Hydrus', IND: 'Indus', LAC: 'Lacerta', LEO: 'Leo', LMI: 'Leo Minor', LEP: 'Lepus', LIB: 'Libra', LUP: 'Lupus', LYN: 'Lynx', LYR: 'Lyra', MEN: 'Mensa', MIC: 'Microscopium', MON: 'Monoceros', MUS: 'Musca', NOR: 'Norma', OCT: 'Octans', OPH: 'Ophiuchus', ORI: 'Orion', PAV: 'Pavo', PEG: 'Pegasus', PER: 'Perseus', PHE: 'Phoenix', PIC: 'Pictor', PSC: 'Pisces', PSA: 'Piscis Austrinus', PUP: 'Puppis', PYX: 'Pyxis', RET: 'Reticulum', SGE: 'Sagitta', SGR: 'Sagittarius', SCO: 'Scorpius', SCL: 'Sculptor', SCT: 'Scutum', SER: 'Serpens', SEX: 'Sextans', TAU: 'Taurus', TEL: 'Telescopium', TRI: 'Triangulum', TRA: 'Triangulum Australe', TUC: 'Tucana', UMA: 'Ursa Major', UMI: 'Ursa Minor', VEL: 'Vela', VIR: 'Virgo', VOL: 'Volans', VUL: 'Vulpecula',
};
export const CONSTELLATIONS = Object.entries(names).map(([abbreviation, name]) => ({
  id: `constellation:${abbreviation.toLowerCase()}`, name, abbreviation,
})).sort((a, b) => a.name.localeCompare(b.name, 'en'));

export const CONSTELLATION_REGIONS = boundaryData.boundaries.map(region => {
  const abbreviation = region.abbreviation.replace(/[12]$/, '');
  const centre = boundaryData.centres.find(value => value.abbreviation === region.abbreviation)!;
  return {
    id: `constellation:${abbreviation.toLowerCase()}`,
    abbreviation: region.abbreviation, name: names[abbreviation]!,
    points: region.points.map(point => sphericalToVector({ longitudeDeg: point[0]!, latitudeDeg: point[1]! })),
    centre: sphericalToVector(centre),
  };
});

/** HYG vectors already share the fixed J2000 orientation; do not precess twice. */
export function catalogueStarDirection(star: CatalogueStar, julianDateTt: number): Vector3 {
  if (!Number.isFinite(julianDateTt)) throw new RangeError('A finite star epoch is required.');
  const years = (julianDateTt - starData.epochJulianDate) / 365.25;
  const x = star[3] + star[6] * years;
  const y = star[4] + star[7] * years;
  const z = star[5] + star[8] * years;
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length === 0) throw new RangeError('Invalid catalogue star position.');
  return { x: x / length, y: y / length, z: z / length };
}
