import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import moment from 'moment-timezone';
import { EphemerisEngine,EPHEMERIS_FILES,ENGINE_REVISION } from '../src/lib/astronomy/ephemeris';

const bytes=async(path:string)=>new Uint8Array(await readFile(path));
const started=performance.now();
const wasmBinary=await bytes('src/lib/astronomy/generated/spatial-ephemeris.wasm');
const files=new Map(await Promise.all(EPHEMERIS_FILES.map(async file=>[file.name,await bytes(`public/data/ephemeris/${file.name}`)] as const)));
const engine=await EphemerisEngine.create({wasmBinary,files});
const coldStartMs=performance.now()-started;
const times:number[]=[];
for(let i=0;i<1000;i++){
  const start=performance.now();
  engine.calculate(Date.UTC(2000,0,1,12)+i*86400000,{latitudeDeg:-33.8688,longitudeDeg:151.2093});
  times.push(performance.now()-start);
}
times.sort((a,b)=>a-b);
const packed=await readFile('node_modules/moment-timezone/data/packed/latest.json');
const assetRecords=[];
for(const file of EPHEMERIS_FILES){
  const data=files.get(file.name)!;
  assetRecords.push({...file,bytes:data.length,gzipBytes:gzipSync(data).length,
    source:`https://raw.githubusercontent.com/aloistr/swisseph/${ENGINE_REVISION}/ephe/${file.name}`,
    coverage:'1800–2399; product input restricted to1900–2100',licence:'Swiss Ephemeris AGPL route; see vendor/swisseph/LICENSE'});
}
await mkdir('docs/reports',{recursive:true});
await writeFile('public/data/ephemeris/manifest.json',JSON.stringify({revision:ENGINE_REVISION,files:assetRecords},null,2)+'\n');
const report={node:process.version,platform:process.platform,architecture:process.arch,engine:engine.version,
  revision:ENGINE_REVISION,coldStartMs,batchCount:times.length,medianCalculationMs:times[500],p95CalculationMs:times[950],
  wasmHeapBytes:engine.heapBytes,wasmBytes:wasmBinary.length,wasmGzipBytes:gzipSync(wasmBinary).length,assets:assetRecords,
  timezone:{packageVersion:moment.tz.version,dataVersion:moment.tz.dataVersion,packedBytes:packed.length,
    sha256:createHash('sha256').update(packed).digest('hex'),coverage:'full packaged rule data; pre1970 histories may be merged'},
  memoryMethod:'Allocated WASM linear memory; excludes Node/JS/GPU and peak memory.'};
await writeFile('docs/reports/m0-node.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
engine.close();
