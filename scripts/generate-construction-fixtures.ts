import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { EphemerisEngine, EPHEMERIS_FILES, ENGINE_REVISION, HOUSE_SYSTEMS, type HouseSystemId } from '../src/lib/astronomy/ephemeris';

// Run from the repository root: npx tsx scripts/generate-construction-fixtures.ts
const binary = '.tools/swetest.exe';
const binarySha256 = '86e8903a5e763e37887c12a3f16092cc1d59ccfd523bc1be7c1375f46c04d750';
if (createHash('sha256').update(await readFile(binary)).digest('hex') !== binarySha256) throw new Error('Unpinned Swiss fixture binary.');
if (!/Version:\s*2\.10\.03\b/u.test(execFileSync(binary,['-h'],{encoding:'utf8'}))) throw new Error('Expected swetest 2.10.03.');
const engine = await EphemerisEngine.create({
  wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
  files: new Map(await Promise.all(EPHEMERIS_FILES.map(async (file) => [file.name,new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
});
function native(instantMs:number,latitudeDeg:number,longitudeDeg:number,system:HouseSystemId) {
  const date = new Date(instantMs);
  const commandArguments = [`-b${date.getUTCDate()}.${date.getUTCMonth()+1}.${date.getUTCFullYear()}greg`,`-utc${date.getUTCHours()}:${date.getUTCMinutes()}:${date.getUTCSeconds()}`,'-ep','-eswe','-speed','-tidacc-25.8','-p0','-fPlbRsad','-g,','-head','-edirpublic/data/ephemeris',`-house${longitudeDeg},${latitudeDeg},${system}`];
  const output = execFileSync(binary,commandArguments,{encoding:'utf8'});
  const lines = output.split(/\r?\n/u).map((line)=>line.trim()).filter(Boolean);
  const failure = lines.find((line)=>/^error:\s*House method .+ failed, Porphyry calculated instead$/iu.test(line));
  const unexpected = lines.filter((line)=>/error|warning|moshier|not found/iu.test(line)&&line!==failure);
  if(unexpected.length)throw new Error(unexpected.join('\n'));
  if(failure)return {system,status:'undefined' as const,reason:failure.replace(/^error:\s*/iu,''),discardedNativeSubstitute:'Porphyry',commandArguments};
  const rows=lines.map((line)=>line.split(',').map((field)=>field.trim()));
  const number=(label:string)=>Number(rows.find((row)=>row[0]===label)?.[1]);
  const cusps=Array.from({length:12},(_,index)=>Number(rows.find((row)=>new RegExp(`^house\\s+${index+1}$`,'u').test(row[0]!))?.[1]));
  if(![...cusps,number('Ascendant'),number('MC'),number('ARMC')].every(Number.isFinite))throw new Error(`Malformed native result ${system}`);
  return {system,status:'valid' as const,cusps,ascendantDeg:number('Ascendant'),midheavenDeg:number('MC'),armcDeg:number('ARMC'),commandArguments};
}
const inputs:{id:string;instantMs:number;latitudeDeg:number;longitudeDeg:number}[]=[];
for(const instantMs of [Date.UTC(1900,0,1,12),Date.UTC(2000,0,1,12),Date.UTC(2026,9,25),Date.UTC(2100,11,31,12)])for(const observer of [{id:'greenwich',latitudeDeg:51.5,longitudeDeg:0},{id:'sydney',latitudeDeg:-33.8688,longitudeDeg:151.2093}])inputs.push({id:`${new Date(instantMs).toISOString()}-${observer.id}`,instantMs,latitudeDeg:observer.latitudeDeg,longitudeDeg:observer.longitudeDeg});
for(const latitudeDeg of [-89.9,-80,-70,-66.55,-66.5,0,66.5,66.55,70,80,89.9])for(const hour of [0,6,12,18])inputs.push({id:`latitude-${latitudeDeg}-${hour}`,instantMs:Date.UTC(2026,9,25,hour),latitudeDeg,longitudeDeg:0});
for(const hour of [0,6,12,18]){
  const instantMs=Date.UTC(2026,9,25,hour),sky=engine.calculate(instantMs,{latitudeDeg:0,longitudeDeg:0});
  for(const sign of [-1,1])for(const delta of [-1e-5,-1e-8,1e-8,1e-5]){
    const latitudeDeg=sign*(90-sky.trueObliquityDeg+delta);
    inputs.push({id:`polar-circle-${hour}-${sign}-${delta}`,instantMs,latitudeDeg,longitudeDeg:0});
  }
}
for(const year of [1900,2100])for(const latitudeDeg of [-66.5,66.5])for(const hour of [0,12])inputs.push({id:`edge-${year}-${latitudeDeg}-${hour}`,instantMs:Date.UTC(year,0,1,hour),latitudeDeg,longitudeDeg:151.2093});
const cases=inputs.map((input)=>{
  const observer={latitudeDeg:input.latitudeDeg,longitudeDeg:input.longitudeDeg};
  const sky=engine.calculate(input.instantMs,observer);
  return {id:input.id,instantMs:input.instantMs,instantIso:new Date(input.instantMs).toISOString(),observer,orientation:{greenwichSiderealTimeDeg:sky.greenwichSiderealTimeDeg,trueObliquityDeg:sky.trueObliquityDeg},houses:HOUSE_SYSTEMS.map(({id})=>native(input.instantMs,input.latitudeDeg,input.longitudeDeg,id))};
});
engine.close();
const output={schemaVersion:1,provenance:{generator:'scripts/generate-construction-fixtures.ts',engine:'Swiss Ephemeris',version:'2.10.03',revision:ENGINE_REVISION,sourceUrl:`https://github.com/aloistr/swisseph/blob/${ENGINE_REVISION}/swehouse.c`,binary:{sourceUrl:`https://raw.githubusercontent.com/aloistr/swisseph/${ENGINE_REVISION}/windows/programs/swetest.exe`,sha256:binarySha256},dataFiles:EPHEMERIS_FILES,time:'UTC via -utc; explicit DE431 tidal acceleration -tidacc-25.8',orientation:'Owned Swiss WASM true obliquity and apparent GAST; independently native-validated calculation model. Native house ARMC and cusps are direct executable output.',purpose:'Integration reference against the same pinned Swiss model, not an independent astronomical model.',polarPolicy:'Native Porphyry substitutes are discarded and requested systems remain undefined.'},cases};
await writeFile('tests/fixtures/construction-native.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Generated ${cases.length} cases and ${cases.length*HOUSE_SYSTEMS.length} native construction results.`);
