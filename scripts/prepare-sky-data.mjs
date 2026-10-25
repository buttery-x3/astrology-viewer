/** Reproducible, deliberately small visual catalogue; original files stay in .tools. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const revision = 'c7f7f883fe678cc7680169a50ccd7dcc49b060ce';
const sources = [
  { name: 'hygdata_v41.csv', url: `https://raw.githubusercontent.com/astronexus/HYG-Database/${revision}/hyg/CURRENT/hygdata_v41.csv`, blob: 'ba2dec4eb0f6768914c7fc1051258100214ddf84', bytes: 33932548 },
  { name: 'bound_in_20.txt', url: 'https://pbarbier.com/constellations/bound_in_20.txt', sha256: 'bca972f08c3d136b77edf393c260533ec52003b5a6e1dda58c470d6ccdf262ac', bytes: 344415 },
  { name: 'centers_20.txt', url: 'https://pbarbier.com/constellations/centers_20.txt', sha256: 'c34e3bdbc6448eced93df4ff25af1032ac90b91d717b9d29582b8ed3a05bf94b', bytes: 3332 },
];
const cache = resolve('.tools/sky-source');
const output = resolve('src/lib/scene/data');
await mkdir(cache, { recursive: true });
await mkdir(output, { recursive: true });

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const verified = [];
for (const source of sources) {
  let bytes;
  try { bytes = await readFile(resolve(cache, source.name)); }
  catch {
    if (!process.argv.includes('--download')) throw new Error(`Missing ${source.name}; use --download to fetch the declared primary sources.`);
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes.length !== source.bytes) throw new Error(`${source.name}: source size changed.`);
  if (source.blob && createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== source.blob) throw new Error(`${source.name}: immutable Git blob mismatch.`);
  if (source.sha256 && sha256(bytes) !== source.sha256) throw new Error(`${source.name}: source checksum mismatch.`);
  await writeFile(resolve(cache, source.name), bytes);
  verified.push({ ...source, sha256: sha256(bytes) });
}

function csvRow(line) {
  const row = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('Unexpected multiline HYG CSV record.');
  row.push(value); return row;
}
const hygLines = (await readFile(resolve(cache, sources[0].name), 'utf8')).trim().split('\n');
const headings = csvRow(hygLines.shift().trim());
const stars = [];
for (const line of hygLines) {
  const fields = csvRow(line.trim());
  const record = Object.fromEntries(headings.map((key, index) => [key, fields[index]]));
  const magnitude = Number(record.mag);
  if (record.id === '0' || !record.mag || !Number.isFinite(magnitude) || magnitude > 5.5) continue;
  const coordinates = ['x', 'y', 'z', 'vx', 'vy', 'vz'].map(key => Number(record[key]));
  if (!coordinates.every(Number.isFinite) || Math.hypot(...coordinates.slice(0, 3)) === 0) throw new Error(`Invalid bright star ${record.id}`);
  stars.push([Number(record.id), record.proper || record.bf || `HIP ${record.hip || record.id}`, magnitude, ...coordinates, record.ci ? Number(record.ci) : null]);
}
stars.sort((a, b) => a[0] - b[0]);

const boundaries = [];
let current;
for (const row of (await readFile(resolve(cache, sources[1].name), 'utf8')).trim().split('\n')) {
  const [ra, dec, abbreviation] = row.trim().split(/\s+/);
  if (current?.abbreviation !== abbreviation) { current = { abbreviation, points: [] }; boundaries.push(current); }
  current.points.push([Number(ra) * 15, Number(dec)]);
}
const centres = (await readFile(resolve(cache, sources[2].name), 'utf8')).trim().split('\n').filter(row => row.trim()).map(row => {
  const [ra, dec, , , abbreviation] = row.trim().split(/\s+/);
  return { abbreviation, longitudeDeg: Number(ra) * 15, latitudeDeg: Number(dec) };
});

const assets = [
  { file: 'bright-stars.json', value: { columns: ['hygId', 'name', 'magnitude', 'xPc', 'yPc', 'zPc', 'vxPcPerYear', 'vyPcPerYear', 'vzPcPerYear', 'colorIndex'], epochJulianDate: 2451545, stars } },
  { file: 'constellation-boundaries.json', value: { frame: 'J2000 equatorial', boundaries, centres } },
];
const derived = [];
for (const asset of assets) {
  const bytes = Buffer.from(`${JSON.stringify(asset.value)}\n`);
  await writeFile(resolve(output, asset.file), bytes);
  derived.push({ file: asset.file, bytes: bytes.length, sha256: sha256(bytes) });
}
const manifest = {
  schema: 1,
  sources: verified,
  stars: {
    author: 'David Nash / Astronexus, HYG Database v4.1',
    documentation: `https://raw.githubusercontent.com/astronexus/HYG-Database/${revision}/hyg/README.md`,
    license: 'CC-BY-SA-4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    notice: `https://raw.githubusercontent.com/astronexus/HYG-Database/${revision}/LICENSE`,
    changes: 'Excluded the Sun and stars fainter than visual magnitude 5.5; retained ID/name, magnitude, J2000 Cartesian position/velocity and colour index; sorted by HYG ID.',
    count: stars.length,
    policy: 'Mean astrometric J2000-aligned directions propagated linearly using catalogue Cartesian pc/year velocities and Julian years since J2000. No annual aberration, annual parallax, light deflection, observer parallax, extinction, or variable-star brightness modelling. Unknown radial velocities retain the catalogue zero assumption. Catalogue star sizes/brightness are visual encodings, not photometry or physical sizes.',
  },
  constellations: {
    author: 'Pierre Barbier, constellation boundary compilation, 2012–2022; from Eugène Delporte (1930)',
    documentation: 'https://pbarbier.com/constellations/boundaries.html',
    license: 'CC-BY-SA-4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    notice: 'https://pbarbier.com/terms.html',
    changes: 'Parsed the author-provided interpolated J2000 boundary vertices and label centres; converted RA hours to degrees; retained constellation order including the two Serpens regions.',
    policy: 'Author-transformed B1875 Delporte meridian/parallel boundaries to J2000 using Explanatory Supplement pp103–104 and SOFA Besselian/Julian epoch conversion. Boundary samples follow original small-circle parallels before precession; never replace them with one endpoint-to-endpoint great-circle arc. Fixed J2000 sky regions do not undergo stellar proper motion.',
    count: 88,
  },
  assets: derived,
};
await writeFile(resolve(output, 'sky-data-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${stars.length} catalogue stars and ${boundaries.length} constellation regions (${centres.length} label centres).`);
