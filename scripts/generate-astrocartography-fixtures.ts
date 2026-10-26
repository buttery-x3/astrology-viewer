/** Reference-only native Swiss horizontal validation; no network or browser. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { EphemerisEngine, EPHEMERIS_FILES } from '../src/lib/astronomy/ephemeris';
import { buildAstrocartography } from '../src/lib/domain/astrocartography';

const probe = resolve(process.argv[2] ?? '.cache/m10-native/astro-probe.exe');
const sourceFiles = ['tests/fixtures/astrocartography-native.c', ...['swedate', 'swehouse', 'swejpl', 'swemmoon', 'swemplan', 'sweph', 'swephlib', 'swecl', 'swehel'].map(file => `vendor/swisseph/${file}.c`)];
const sha256 = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const sourceHashes = await Promise.all(sourceFiles.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
const engine = await EphemerisEngine.create({
  wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
  files: new Map(await Promise.all(EPHEMERIS_FILES.map(async file => [file.name, new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
});
interface NativeResult { version: string; flags: number; tt: number; ut1: number; gast: number; ra: number; dec: number; altitude: number; azimuthSouthWest: number }
function native(instantMs: number, bodyIndex: number, latitudeDeg: number, longitudeDeg: number): NativeResult {
  const date = new Date(instantMs);
  const arguments_ = [resolve('public/data/ephemeris'), date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), latitudeDeg, longitudeDeg, bodyIndex].map(String);
  return JSON.parse(execFileSync(probe, arguments_, { encoding: 'utf8', timeout: 5000 }));
}
const cases = [];
let maxAltitudeResidualDeg = 0, maxMeridianResidualDeg = 0;
try {
  for (const iso of ['1900-01-01T12:00:00Z', '1987-04-26T16:00:00Z', '2024-04-08T18:17:00Z', '2100-12-31T12:00:00Z']) {
    const instantMs = Date.parse(iso), snapshot = engine.calculate(instantMs, { latitudeDeg: 0, longitudeDeg: 0 }, ['W']);
    for (const line of buildAstrocartography(snapshot).lines) {
      const samples = line.segments.flat().filter(sample => !sample.singularity);
      for (const fraction of [0.32, 0.68]) {
        const sample = samples[Math.floor(samples.length * fraction)]!;
        const bodyIndex = snapshot.bodies.findIndex(body => body.id === line.bodyId);
        const expected = native(instantMs, bodyIndex, sample.latitudeDeg, sample.longitudeDeg);
        const horizon = line.angle === 'ac' || line.angle === 'dc';
        const hourAngle = ((expected.gast + sample.longitudeDeg - expected.ra + 540) % 360) - 180;
        const residual = horizon ? Math.abs(expected.altitude) : Math.abs(Math.abs(hourAngle) - (line.angle === 'ic' ? 180 : 0));
        if (horizon) maxAltitudeResidualDeg = Math.max(maxAltitudeResidualDeg, residual);
        else maxMeridianResidualDeg = Math.max(maxMeridianResidualDeg, residual);
        if (residual > 1e-6 || expected.flags !== 2306) throw new Error(`Native reference validation failed for${line.id}/${iso}: ${residual}`);
        const motion = horizon ? native(instantMs + 1000, bodyIndex, sample.latitudeDeg, sample.longitudeDeg).altitude - native(instantMs - 1000, bodyIndex, sample.latitudeDeg, sample.longitudeDeg).altitude : null;
        if (horizon && Math.sign(motion!) !== (line.angle === 'ac' ? 1 : -1)) throw new Error(`Native rise/set direction mismatch for${line.id}.`);
        cases.push({ instantMs, instantIso: iso, bodyId: line.bodyId, angle: line.angle, latitudeDeg: sample.latitudeDeg, longitudeDeg: sample.longitudeDeg, expected, altitudeChangeAcrossTwoSecondsDeg: motion });
      }
    }
  }
} finally { engine.close(); }
await writeFile('tests/fixtures/astrocartography-native.json', JSON.stringify({
  source: 'Pinned Swiss Ephemeris v2.10.3bfinal, unmodified C compiled for native Windows x64 using Visual Studio2022 cl /O2 /MD. See tests/fixtures/astrocartography-native.c.',
  upstreamRevision: 'f4dcd18e8005dde95fd8a8d2312ed12f9accd1b0', binarySha256: sha256(await readFile(probe)), sourceHashes,
  convention: 'Apparent true-equator/equinox-of-date geocentric RA/declination; flags2306; tidal acceleration−25.8; swe_utc_to_jd suppliesUT1/TT; swe_azalt SE_EQU2HOR geometric altitude, no refraction or topocentric flag. Native azimuth is south-to-west.',
  maxAltitudeResidualDeg, maxMeridianResidualDeg, cases,
}, null, 2) + '\n');
console.log(JSON.stringify({ cases: cases.length, maxAltitudeResidualDeg, maxMeridianResidualDeg }));
