import { readFile, writeFile } from 'node:fs/promises';
import { EphemerisEngine, EPHEMERIS_FILES, ENGINE_REVISION } from '../src/lib/astronomy/ephemeris';
import { loadHorizonsReference, compareHorizonsSample, summarizeHorizonsComparisons, HORIZONS_TOLERANCE_ARCSEC } from './horizons-reference';

const directory='tests/fixtures/horizons';
const references=await loadHorizonsReference(directory);
const bytes=async(path:string)=>new Uint8Array(await readFile(path));
const engine=await EphemerisEngine.create({
  wasmBinary:await bytes('src/lib/astronomy/generated/spatial-ephemeris.wasm'),
  files:new Map(await Promise.all(EPHEMERIS_FILES.map(async file=>[file.name,await bytes(`public/data/ephemeris/${file.name}`)]as const))),
});
try{
  const results=references.map(reference=>compareHorizonsSample(engine,reference));
  const summary=summarizeHorizonsComparisons(results);
  const report={engine:engine.version,engineRevision:ENGINE_REVISION,angularToleranceArcsec:HORIZONS_TOLERANCE_ARCSEC,summary,results};
  const reportIndex=process.argv.indexOf('--report');
  if(reportIndex>=0){const path=process.argv[reportIndex+1];if(!path)throw new Error('--report requires an output path.');await writeFile(path,`${JSON.stringify(report,null,2)}\n`);}
  console.log(JSON.stringify(summary,null,2));
  if(summary.some(mode=>!mode.allWithinTolerance))throw new Error('A fresh-engine comparison exceeded the reviewed 60 arcsecond tolerance. Inspect the report before changing any expected reference.');
}finally{engine.close();}
