import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const revision = 'f4dcd18e8005dde95fd8a8d2312ed12f9accd1b0';
const binaryRelativePath = '.tools/swetest.exe';
const binaryPath = resolve(root, binaryRelativePath);
const binarySha256 = '86e8903a5e763e37887c12a3f16092cc1d59ccfd523bc1be7c1375f46c04d750';
const sourceRootUrl = `https://github.com/aloistr/swisseph/tree/${revision}`;
const binarySourceUrl = `https://raw.githubusercontent.com/aloistr/swisseph/${revision}/windows/programs/swetest.exe`;
const bodyIds = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const systemIds = ['W', 'E', 'O', 'P', 'K', 'R', 'C'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

if (sha256(readFileSync(binaryPath)) !== binarySha256) {
  throw new Error(`Native fixture binary checksum mismatch. Obtain ${binarySourceUrl}`);
}
const help = execFileSync(binaryPath, ['-h'], { cwd: root, encoding: 'utf8' });
if (!/Version:\s*2\.10\.03\b/.test(help)) throw new Error('Expected native Swiss Ephemeris 2.10.03.');

const ephemerisFiles = [
  { name: 'sepl_18.se1', sha256: 'ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66' },
  { name: 'semo_18.se1', sha256: '1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7' },
].map((expected) => {
  const bytes = readFileSync(resolve(root, 'public/data/ephemeris', expected.name));
  if (sha256(bytes) !== expected.sha256) throw new Error(`Native fixture data checksum mismatch: ${expected.name}`);
  return { ...expected, bytes: bytes.byteLength, sourceUrl: `https://raw.githubusercontent.com/aloistr/swisseph/${revision}/ephe/${expected.name}` };
});

function argsFor(instantIso, observer, system) {
  const date = new Date(instantIso);
  const args = [
    `-b${date.getUTCDate()}.${date.getUTCMonth() + 1}.${date.getUTCFullYear()}greg`,
    `-utc${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}`,
    '-ep', '-eswe', '-speed', '-tidacc-25.8', '-p0123456789', '-fPlbRsad', '-g,', '-head', '-edirpublic/data/ephemeris',
  ];
  if (observer && system) args.push(`-house${observer.longitudeDeg},${observer.latitudeDeg},${system}`);
  return args;
}

function runNative(instantIso, observer, system) {
  const args = argsFor(instantIso, observer, system);
  const output = execFileSync(binaryPath, args, { cwd: root, encoding: 'utf8' });
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const errors = lines.filter((line) => /^error:/i.test(line));
  // Native swetest still prints Porphyry substitute cusps on this error. Capture
  // the error but discard those numbers, matching the strict application policy.
  const houseFailure = errors.find((line) => /^error:\s*House method .+ failed, Porphyry calculated instead$/i.test(line));
  const unexpected = lines.filter((line) => /error|warning|not found|moshier/i.test(line) && line !== houseFailure);
  if (unexpected.length) throw new Error(`Native fixture generation failed: ${unexpected.join('\n')}`);
  const rows = lines.filter((line) => !/^error:/i.test(line)).map((line) => line.split(',').map((field) => field.trim()));
  const bodies = bodyIds.map((id) => {
    const row = rows.find((entry) => entry[0].toLowerCase() === id);
    if (!row || row.length !== 7) throw new Error(`Unexpected ${id} native row: ${JSON.stringify(row)}`);
    const numbers = row.slice(1).map(Number);
    if (!numbers.every(Number.isFinite)) throw new Error(`Non-numeric ${id} native row.`);
    const [longitudeDeg, latitudeDeg, distanceAu, longitudeSpeedDegPerDay, rightAscensionDeg, declinationDeg] = numbers;
    return { id, longitudeDeg, latitudeDeg, distanceAu, longitudeSpeedDegPerDay, equatorial: { rightAscensionDeg, declinationDeg } };
  });
  let houses;
  if (system) {
    if (houseFailure) {
      houses = { system, status: 'undefined', reason: houseFailure.replace(/^error:\s*/i, ''), discardedNativeSubstitute: 'Porphyry' };
    } else {
      const numberFor = (label) => {
        const value = Number(rows.find((row) => row[0] === label)?.[1]);
        if (!Number.isFinite(value)) throw new Error(`Missing or invalid ${label} in native house output.`);
        return value;
      };
      const cusps = Array.from({ length: 12 }, (_, index) => {
        const row = rows.find((entry) => new RegExp(`^house\\s+${index + 1}$`).test(entry[0]));
        const longitude = Number(row?.[1]);
        if (!Number.isFinite(longitude)) throw new Error(`Missing cusp ${index + 1}.`);
        return longitude;
      });
      houses = { system, status: 'valid', cusps, ascendantDeg: numberFor('Ascendant'), midheavenDeg: numberFor('MC'), armcDeg: numberFor('ARMC') };
    }
  }
  return { args, bodies, houses };
}

const observers = [
  { id: 'greenwich', latitudeDeg: 51.5, longitudeDeg: 0 },
  { id: 'sydney', latitudeDeg: -33.8688, longitudeDeg: 151.2093 },
];
const cases = [
  '1900-01-01T12:00:00.000Z', '2000-01-01T12:00:00.000Z',
  '2026-10-25T00:00:00.000Z', '2100-12-31T12:00:00.000Z',
].map((instantIso) => {
  const native = runNative(instantIso);
  return {
    id: instantIso.slice(0, 10), instantIso, instantMs: Date.parse(instantIso),
    commandArguments: native.args, bodies: native.bodies,
    observers: observers.map((observer) => ({
      ...observer,
      houses: systemIds.map((system) => {
        const result = runNative(instantIso, observer, system);
        if (result.houses.status !== 'valid') throw new Error(`Unexpected undefined normal-latitude houses: ${instantIso} ${observer.id} ${system}`);
        return { ...result.houses, commandArguments: result.args };
      }),
    })),
  };
});
const polarObserver = { id: 'arctic-80n', latitudeDeg: 80, longitudeDeg: 0 };
const polarInstantIso = '2026-10-25T00:00:00.000Z';
const polarCase = {
  id: 'polar-80n', instantIso: polarInstantIso, instantMs: Date.parse(polarInstantIso), observer: polarObserver,
  houses: systemIds.map((system) => {
    const result = runNative(polarInstantIso, polarObserver, system);
    return { ...result.houses, commandArguments: result.args };
  }),
};
const knownAnswerInstant='1987-04-26T16:00:00.000Z';
const knownAnswerNative=runNative(knownAnswerInstant);
const knownAnswerCases=[{
  id:'solar-civil-roundtrip-1987',
  civil:{year:1987,month:4,day:27,hour:2,minute:0,second:0},
  zoneId:'Australia/Melbourne',offsetMinutes:600,
  observer:{latitudeDeg:-37.814,longitudeDeg:144.96332},
  instantIso:knownAnswerInstant,instantMs:Date.parse(knownAnswerInstant),
  commandArguments:knownAnswerNative.args,
  sun:knownAnswerNative.bodies.find(body=>body.id==='sun'),expectedSign:'taurus',
}];
for (const system of ['P', 'K']) {
  if (polarCase.houses.find((houses) => houses.system === system)?.status !== 'undefined') {
    throw new Error(`Expected a native polar failure for ${system}.`);
  }
}

const fixture = {
  schemaVersion: 1,
  provenance: {
    generator: 'scripts/generate-native-fixtures.mjs',
    engine: 'Swiss Ephemeris', version: '2.10.03', sourceRevision: revision, sourceRootUrl,
    binary: { path: binaryRelativePath, sourceUrl: binarySourceUrl, sha256: binarySha256 },
    dataFiles: ephemerisFiles,
    comparison: 'Native versus WASM integration reference using the same Swiss model; not an independent astronomical model.',
    inputTime: 'UTC via -utc; Swiss swe_utc_to_jd derives TT and UT1, matching the application binding.',
    deltaTModel: 'Swiss Ephemeris default delta-T model with lunar tidal acceleration explicitly fixed to SE_TIDAL_DE431 (-25.8 arcseconds/century squared) using -tidacc-25.8; matches the application initialization and prevents model changes after ephemeris-file loading.',
    conventions: 'Apparent geocentric tropical ecliptic/equatorial of date; Swiss ephemeris with high-precision speed; longitude-based house cusps.',
    units: { angles: 'degrees', rightAscension: 'degrees', distance: 'AU', speed: 'degrees/day', time: 'UTC-labelled ISO 8601 and Unix milliseconds' },
    rightAscensionNote: `Pinned swetest.c case 'a' prints xequ[0] directly in degrees; its help text incorrectly says hours. Source: https://github.com/aloistr/swisseph/blob/${revision}/swetest.c`,
    polarPolicy: 'Native Porphyry substitute cusps are discarded when the requested construction reports failure.',
  },
  cases, polarCase,knownAnswerCases,
};
const output = resolve(root, 'tests/fixtures/native-swiss.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Generated ${cases.length} body dates, ${cases.length * observers.length * systemIds.length} normal house results, and ${polarCase.houses.length} polar results in tests/fixtures/native-swiss.json`);
