import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const moment = require('moment-timezone/moment-timezone-utils');
const version = '2026e';
const cache = path.join(root, '.cache/timezones', version);
const outputDirectory = path.join(root, 'src/lib/time/data');
const outputName = `tzdata-${version}-backzone.json`;
const manifestName = 'manifest.json';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = [
  { name: `tzcode${version}.tar.gz`, sha256: 'cc3d27ca2a0d8399504551b920970d80af83bfb9c216e8082a15491921935d54' },
  { name: `tzdata${version}.tar.gz`, sha256: 'b26882805f26aac59d5b222978e6580484b834ccdc98be89df2f05a6dc53a652' },
].map((source) => ({ ...source, url: `https://data.iana.org/time-zones/releases/${source.name}` }));

function verifyHistoricalFixtures(data) {
  const zones = new Map(data.zones.map((packed) => { const zone = new moment.tz.Zone(packed); return [zone.name, zone]; }));
  for (const [name, expectedSecondsEast] of [
    ['Europe/Amsterdam', 1172], ['Asia/Aden', 10794], ['Asia/Riyadh', 11212], ['Africa/Accra', -52], ['Europe/Paris', 561],
  ]) {
    const actual = -zones.get(name)?.utcOffset(Date.UTC(1900, 0, 1, 12)) * 60;
    if (Math.abs(actual - expectedSecondsEast) > 1e-7) throw new Error(`Historical fixture failed: ${name}, expected ${expectedSecondsEast} seconds east, got ${actual}`);
  }
  for (const [name, expectedMinutesEast] of [['Australia/Sydney', 600], ['America/New_York', -240], ['Europe/Amsterdam', 120], ['America/Winnipeg', -300]]) {
    if (-zones.get(name)?.utcOffset(Date.UTC(2100, 6, 1, 12)) !== expectedMinutesEast) throw new Error(`Future range fixture failed: ${name}`);
  }
  if (zones.size !== 598) throw new Error(`Expected 598 tailored zones, got ${zones.size}.`);
}

if (process.argv.includes('--check')) {
  const bytes = readFileSync(path.join(outputDirectory, outputName));
  const manifest = JSON.parse(readFileSync(path.join(outputDirectory, manifestName), 'utf8'));
  if (sha256(bytes) !== manifest.output.sha256 || bytes.length !== manifest.output.bytes) throw new Error('Committed timezone data does not match its manifest.');
  if (manifest.ianaVersion !== version || manifest.packratData !== 'backzone' || manifest.packratList !== 'zone.tab') throw new Error('Unexpected timezone data build policy.');
  verifyHistoricalFixtures(JSON.parse(bytes));
  console.log(`Verified ${manifest.zoneCount} zones, historical fixtures, future coverage, and ${manifest.output.sha256}.`);
  process.exit(0);
}

mkdirSync(cache, { recursive: true });
mkdirSync(outputDirectory, { recursive: true });
for (const source of sources) {
  const filename = path.join(cache, source.name);
  if (!existsSync(filename)) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`Unable to download ${source.name}: HTTP ${response.status}`);
    writeFileSync(filename, new Uint8Array(await response.arrayBuffer()));
  }
  if (sha256(readFileSync(filename)) !== source.sha256) throw new Error(`IANA archive checksum mismatch: ${source.name}`);
}
const sdk = process.env.EMSDK ?? path.join(root, '.tools/emsdk');
const sdkPython = path.join(sdk, 'python/3.13.3_64bit/python.exe');
const python = process.env.EMSDK_PYTHON ?? (existsSync(sdkPython) ? sdkPython : 'python3');
const emcc = path.join(sdk, 'upstream/emscripten/emcc.py');
const compilerEnv = { ...process.env, TEMP: cache, TMP: cache, TMPDIR: cache };
const run = (executable, args, options = {}) => execFileSync(executable, args, { cwd: root, env: compilerEnv, encoding: 'utf8', ...options });
const pythonVersion = run(python, ['--version']).trim().replace(/^Python /, '');
if (!pythonVersion.startsWith('3.13.')) throw new Error('Timezone rebuild requires Python 3.13.x for the recorded ZoneInfo verification.');
if (!run(python, [emcc, '--version']).includes('4.0.23')) throw new Error('Timezone rebuild requires Emscripten 4.0.23.');
const sourceDirectory = path.join(cache, 'source');
run(python, ['scripts/build-timezones.py', 'extract', ...sources.flatMap((source) => ['--archive', path.join(cache, source.name)]), '--directory', sourceDirectory]);
writeFileSync(path.join(sourceDirectory, 'version.h'), 'static char const PKGVERSION[]="(tzcode) ";\nstatic char const TZVERSION[]="2026e";\nstatic char const REPORT_BUGS_TO[]="tz@iana.org";\n');
writeFileSync(path.join(sourceDirectory, 'tzdir.h'), '#define TZDEFAULT "/etc/localtime"\n#define TZDIR "/usr/share/zoneinfo"\n');
const defaultWindowsAwk = 'C:/Program Files/Git/usr/bin/awk.exe';
const awk = process.env.AWK ?? (process.platform === 'win32' && existsSync(defaultWindowsAwk) ? defaultWindowsAwk : 'awk');
const inputFiles = ['africa', 'antarctica', 'asia', 'australasia', 'europe', 'northamerica', 'southamerica', 'etcetera', 'factory', 'backward', 'backzone'];
const tailored = run(awk, ['-v', 'DATAFORM=main', '-v', 'PACKRATDATA=backzone', '-v', 'PACKRATLIST=zone.tab', '-f', 'ziguard.awk', ...inputFiles], { cwd: sourceDirectory });
const tailoredFilename = path.join(sourceDirectory, 'main-backzone.zi');
writeFileSync(tailoredFilename, tailored.replace(/\r\n/g, '\n'));
const compilerFlags = [
  '-O2', '-DHAVE_GETTEXT=0', '-DHAVE_MEMPCPY=1', '-DHAVE_FCHMOD=0', '-DHAVE_GETRANDOM=0', '-DHAVE_LINK=0',
  '-Dlinkat=sa_tz_linkat', '-Dsymlink=sa_tz_symlink',
  '-sNODERAWFS=1', '-sALLOW_MEMORY_GROWTH=1', '-sENVIRONMENT=node', '-sEXIT_RUNTIME=1',
];
const zicFilename = path.join(cache, 'zic.cjs');
run(python, [emcc, path.join(sourceDirectory, 'zic.c'), 'native/zic-portability.c', ...compilerFlags, '-o', zicFilename]);
if (!run(process.execPath, [zicFilename, '--version']).includes(`zic (tzcode) ${version}`)) throw new Error('Unexpected compiled zic version.');
const zoneinfoDirectory = path.join(cache, 'zoneinfo');
run(process.execPath, [zicFilename, '-b', 'fat', '-r@-2240524800/@4165516800', '-d', zoneinfoDirectory, tailoredFilename]);
const unpackedFilename = path.join(cache, 'unpacked.json');
process.stdout.write(run(python, ['scripts/build-timezones.py', 'unpack', '--directory', zoneinfoDirectory, '--source', tailoredFilename, '--output', unpackedFilename]));
const unpacked = JSON.parse(readFileSync(unpackedFilename, 'utf8'));
const packed = { version, zones: [], links: [], countries: [] };
for (const source of unpacked.zones) {
  const full = { ...source, untils: source.untils.map((until) => until === null ? Infinity : until) };
  const encoded = moment.tz.pack(full);
  const decoded = moment.tz.unpack(encoded);
  if (decoded.untils.length !== full.untils.length || decoded.untils.some((until, index) => until !== full.untils[index])
    || decoded.offsets.some((offset, index) => Math.abs(offset - full.offsets[index]) > 1e-9)
    || decoded.abbrs.some((abbr, index) => abbr !== full.abbrs[index])) throw new Error(`Moment packing round-trip failed: ${source.name}`);
  packed.zones.push(encoded);
}
verifyHistoricalFixtures(packed);
const bytes = Buffer.from(`${JSON.stringify(packed)}\n`);
writeFileSync(path.join(outputDirectory, outputName), bytes);
const manifest = {
  ianaVersion: version, packratData: 'backzone', packratList: 'zone.tab', dataform: 'main',
  range: { fromInclusive: '1899-01-01T00:00:00.000Z', toExclusive: '2102-01-01T00:00:00.000Z', purpose: 'Guards local date entry around the supported 1900–2100 UTC boundaries.' },
  compiler: { ianaZic: version, emscripten: '4.0.23', python: pythonVersion, flags: compilerFlags },
  sources, zoneCount: packed.zones.length, verifiedPeriods: unpacked.verifiedPeriods,
  packing: { library: 'moment-timezone', version: moment.tz.version, precision: 'One second for offsets and transition instants; no historical zone deduplication.' },
  output: { name: outputName, bytes: bytes.length, sha256: sha256(bytes) },
  limitation: 'Backzone retains additional historical identities but can contain uncertain records. This is not a historical boundary atlas or a certification of recorded civil time; future rules are projections.',
};
writeFileSync(path.join(outputDirectory, manifestName), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${packed.zones.length} zones (${bytes.length} bytes), SHA-256 ${manifest.output.sha256}.`);
