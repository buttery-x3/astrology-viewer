import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {EphemerisEngine,EPHEMERIS_FILES,ENGINE_REVISION} from '../src/lib/astronomy/ephemeris';
const bytes=async(path:string)=>new Uint8Array(await readFile(path));
const engine=await EphemerisEngine.create({
  wasmBinary:await bytes('src/lib/astronomy/generated/spatial-ephemeris.wasm'),
  files:new Map(await Promise.all(EPHEMERIS_FILES.map(async file=>[file.name,await bytes(`public/data/ephemeris/${file.name}`)] as const))),
});
try{
  const dates=['1900-01-01T00:00:00.000Z','2000-01-01T12:00:00.000Z','2026-10-25T00:00:00.000Z','2100-01-01T00:00:00.000Z'];
  const epochs=dates.map(iso=>{const snapshot=engine.calculate(Date.parse(iso),{latitudeDeg:0,longitudeDeg:0},['W']);return {iso,instantMs:snapshot.instantMs,inputJulianDate:snapshot.time.inputJulianDate,time:snapshot.time,bodies:snapshot.bodies};});
  await mkdir('.cache/horizons-refresh',{recursive:true});
  await writeFile('.cache/horizons-refresh/engine-snapshots.json',JSON.stringify({engine:engine.version,revision:ENGINE_REVISION,assets:EPHEMERIS_FILES,epochs},null,2)+'\n');
  console.log(JSON.stringify(epochs.map(epoch=>({iso:epoch.iso,tt:epoch.time.julianDateTt,interpretation:epoch.time.interpretation,deltaT:epoch.time.deltaTSeconds})),null,2));
}finally{engine.close();}
