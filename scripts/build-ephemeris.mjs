import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const sdk = process.env.EMSDK ?? path.join(root, '.tools/emsdk');
const emcc = path.join(sdk, 'upstream/emscripten/emcc.py');
const python = process.env.EMSDK_PYTHON ?? 'python';
if (!existsSync(emcc)) throw new Error('Install Emscripten 4.0.23 locally or set EMSDK; see docs/m0-build.md.');
const output = 'src/lib/astronomy/generated';
mkdirSync(output, { recursive: true });
mkdirSync('.cache/build', { recursive: true });
const leapSource = readFileSync('vendor/swisseph/swedate.c','utf8').match(/static TLS int leap_seconds\[[^\]]+\] = \{([\s\S]*?)\};/);
if (!leapSource) throw new Error('Pinned upstream leap table not found.');
const leapDates = leapSource[1].match(/\b\d{8}\b/g);
if (!leapDates?.length) throw new Error('Pinned upstream leap table is empty.');
writeFileSync('.cache/build/leap-second-dates.h', `/* Generated from the pinned, unmodified swedate.c. */\n#define SA_LEAP_COUNT ${leapDates.length}\nstatic const int sa_leap_dates[] = {${leapDates.join(',')}};\n`);
const sources = ['swedate', 'swehouse', 'swejpl', 'swemmoon', 'swemplan', 'sweph', 'swephlib', 'swecl', 'swehel'];
const exports = ['sa_init','sa_close','sa_version','sa_time','sa_body','sa_houses','sa_sidereal','sa_delta_t','sa_horizon','sa_frame','sa_file','malloc','free'].map(n => `_${n}`);
const args = [emcc, 'native/spatial_ephemeris.c', ...sources.map(n => `vendor/swisseph/${n}.c`),
  '-Ivendor/swisseph', '-I.cache/build', '-O3', '-lm', '--no-entry',
  '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sEXPORT_NAME=createSpatialEphemeris',
  '-sENVIRONMENT=web,worker,node', '-sALLOW_MEMORY_GROWTH=1', '-sINITIAL_MEMORY=16777216',
  '-sFILESYSTEM=1', '-sEXPORTED_RUNTIME_METHODS=["ccall","cwrap","FS","UTF8ToString","stringToUTF8","lengthBytesUTF8","HEAPF64","HEAPU8"]',
  `-sEXPORTED_FUNCTIONS=${JSON.stringify(exports)}`,
  '-sINCOMING_MODULE_JS_API=["locateFile","wasmBinary","print","printErr"]',
  '-o', `${output}/spatial-ephemeris.js`];
const temporaryDirectory = path.join(root,'.cache/compiler-temp');
mkdirSync(temporaryDirectory,{recursive:true});
const compilerEnvironment = {
  ...process.env, TEMP:temporaryDirectory, TMP:temporaryDirectory, TMPDIR:temporaryDirectory,
};
const compilerVersion = spawnSync(python,[emcc,'--version'],{encoding:'utf8',env:compilerEnvironment});
if (compilerVersion.status !== 0 || !compilerVersion.stdout.includes('4.0.23'))
  throw new Error('This reproducible build requires Emscripten 4.0.23.');
const result = spawnSync(python, args, { stdio: 'inherit', env: compilerEnvironment });
if (result.status !== 0) process.exit(result.status ?? 1);
const files = ['spatial-ephemeris.js','spatial-ephemeris.wasm'].map(name => {
  const data = readFileSync(`${output}/${name}`);
  return { name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
});
writeFileSync(`${output}/build-manifest.json`, JSON.stringify({
  upstream: 'https://github.com/aloistr/swisseph', revision: 'f4dcd18e8005dde95fd8a8d2312ed12f9accd1b0',
  tag: 'v2.10.3bfinal', emscripten: '4.0.23', flags: args.slice(1), files,
}, null, 2) + '\n');
console.log('Built owned Swiss Ephemeris binding:', files);
