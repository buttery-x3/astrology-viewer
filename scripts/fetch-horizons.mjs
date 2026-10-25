import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(!process.argv.includes('--allow-network'))throw new Error('Reference refresh is opt-in. Pass --allow-network; only fixed educational fixtures are queried.');
const directory='.cache/horizons-refresh';
const engine=JSON.parse(await readFile(`${directory}/engine-snapshots.json`,'utf8'));
const targets={sun:10,moon:301,mercury:199,venus:299,mars:499,jupiter:599,saturn:699,uranus:799,neptune:899,pluto:999};
const expectedDates=['1900-01-01T00:00:00.000Z','2000-01-01T12:00:00.000Z','2026-10-25T00:00:00.000Z','2100-01-01T00:00:00.000Z'];
if(JSON.stringify(engine.epochs?.map(epoch=>epoch.iso))!==JSON.stringify(expectedDates))throw new Error('Only the fixed reviewed educational epochs may be sent to Horizons.');
const modes=['UT','TT'];
await mkdir(`${directory}/raw`,{recursive:true});
const requests=[];
for(const timeType of modes){
  for(const [bodyId,target] of Object.entries(targets)){
    const parameters={format:'json',COMMAND:`'${target}'`,OBJ_DATA:"'YES'",MAKE_EPHEM:"'YES'",EPHEM_TYPE:"'OBSERVER'",CENTER:"'500@399'",TIME_TYPE:`'${timeType}'`,TLIST_TYPE:"'JD'",TLIST:engine.epochs.map(epoch=>`'${(timeType==='UT'?epoch.inputJulianDate:epoch.time.julianDateTt).toFixed(10)}'`).join(' '),QUANTITIES:"'30,31'",CAL_FORMAT:"'JD'",CAL_TYPE:"'GREGORIAN'",TIME_DIGITS:"'FRACSEC'",ANG_FORMAT:"'DEG'",APPARENT:"'AIRLESS'",REF_SYSTEM:"'ICRF'",CSV_FORMAT:"'YES'",EXTRA_PREC:"'YES'"};
    const url=new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
    for(const [key,value] of Object.entries(parameters))url.searchParams.set(key,value);
    const rawPath=`raw/${bodyId}-${timeType.toLowerCase()}.json`;
    let raw,metadata,needsRequest=false;
    try{
      raw=await readFile(`${directory}/${rawPath}`,'utf8');
      metadata=JSON.parse(await readFile(`${directory}/raw/${bodyId}-${timeType.toLowerCase()}.request.json`,'utf8'));
      if(metadata.requestUrl!==url.href)throw new Error('Cached request parameters changed; preserve old fixture before requesting replacement.');
    }catch(error){
      if(error.code!=='ENOENT')throw error;
      needsRequest=true;
    }
    if(needsRequest){
      const response=await fetch(url,{signal:globalThis.AbortSignal.timeout(45000)});
      raw=await response.text();
      metadata={bodyId,target,timeType,parameters,requestUrl:url.href,retrievedAt:new Date().toISOString(),httpStatus:response.status,rawPath};
      await writeFile(`${directory}/${rawPath}`,raw);
      await writeFile(`${directory}/raw/${bodyId}-${timeType.toLowerCase()}.request.json`,JSON.stringify(metadata,null,2)+'\n');
      if(!response.ok)throw new Error(`HTTP ${response.status}: ${raw.slice(0,500)}`);
    }
    const payload=JSON.parse(raw);
    metadata={...metadata,sha256:createHash('sha256').update(raw).digest('hex'),bytes:Buffer.byteLength(raw),signature:payload.signature};
    requests.push(metadata);
    await writeFile(`${directory}/requests.json`,JSON.stringify(requests,null,2)+'\n');
    if(payload.error)throw new Error(`${bodyId} ${timeType}: ${payload.error}`);
    if(!payload.result?.includes('$$SOE')||!payload.result?.includes('ObsEcLon'))throw new Error(`${bodyId} ${timeType}: expected observer quantity31 table absent`);
    console.log(JSON.stringify({bodyId,target,timeType,bytes:metadata.bytes,signature:payload.signature}));
  }
}
