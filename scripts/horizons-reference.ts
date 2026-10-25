import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { BodyId, EphemerisEngine } from '../src/lib/astronomy/ephemeris';

export const HORIZONS_EPOCHS = ['1900-01-01T00:00:00.000Z', '2000-01-01T12:00:00.000Z', '2026-10-25T00:00:00.000Z', '2100-01-01T00:00:00.000Z'] as const;
export const HORIZONS_TARGETS = { sun:10, moon:301, mercury:199, venus:299, mars:499, jupiter:599, saturn:699, uranus:799, neptune:899, pluto:999 } as const;
export const HORIZONS_TOLERANCE_ARCSEC = 60;
const signatureSchema = z.object({ source:z.literal('NASA/JPL Horizons API'), version:z.literal('1.2') }).strict();
const requestSchema = z.object({
  bodyId:z.enum(['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto']),
  target:z.number().int(), timeType:z.enum(['UT','TT']), parameters:z.record(z.string(),z.string()),
  requestUrl:z.string().url(), retrievedAt:z.string().datetime(), httpStatus:z.literal(200),
  rawPath:z.string().regex(/^raw\/(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto)-(?:ut|tt)\.json$/),
  sha256:z.string().regex(/^[a-f0-9]{64}$/), bytes:z.number().int().positive(), signature:signatureSchema,
}).strict();
const payloadSchema = z.object({ result:z.string().min(1), signature:signatureSchema }).strict();
const requestSidecarSchema=requestSchema.omit({sha256:true,bytes:true,signature:true});
export interface HorizonsSample {
  bodyId:BodyId; target:number; timeType:'UT'|'TT'; iso:string; instantMs:number;
  requestedJulianDate:number; julianDate:number; longitudeDeg:number; latitudeDeg:number; tdbMinusUtSeconds:number;
  rawPath:string; rawSha256:string; requestUrl:string; retrievedAt:string;
  targetHeader:string; centerHeader:string; siteHeader:string; eopHeader:string;
}
export interface HorizonsComparison extends HorizonsSample {
  engineJulianDateTt:number; engineInputInterpretation:string;
  engineLongitudeDeg:number; engineLatitudeDeg:number;
  longitudeDifferenceArcsec:number; latitudeDifferenceArcsec:number; angularSeparationArcsec:number;
}
const fixedParameters = { format:'json',OBJ_DATA:"'YES'",MAKE_EPHEM:"'YES'",EPHEM_TYPE:"'OBSERVER'",CENTER:"'500@399'",TLIST_TYPE:"'JD'",QUANTITIES:"'30,31'",CAL_FORMAT:"'JD'",CAL_TYPE:"'GREGORIAN'",TIME_DIGITS:"'FRACSEC'",ANG_FORMAT:"'DEG'",APPARENT:"'AIRLESS'",REF_SYSTEM:"'ICRF'",CSV_FORMAT:"'YES'",EXTRA_PREC:"'YES'" } as const;

/** Read reviewed immutable responses only. This function never makes a network request. */
export async function loadHorizonsReference(directory:string):Promise<readonly HorizonsSample[]> {
  const requests=z.array(requestSchema).length(20).parse(JSON.parse(await readFile(join(directory,'requests.json'),'utf8')));
  const samples:HorizonsSample[]=[], identities=new Set<string>();
  for(const request of requests){
    const identity=`${request.bodyId}:${request.timeType}`;
    if(identities.has(identity)||request.target!==HORIZONS_TARGETS[request.bodyId]||request.rawPath!==`raw/${request.bodyId}-${request.timeType.toLowerCase()}.json`)throw new Error(`Horizons target/identity mismatch: ${identity}`);
    identities.add(identity);
    const expected={...fixedParameters,COMMAND:`'${request.target}'`,TIME_TYPE:`'${request.timeType}'`,TLIST:request.parameters.TLIST};
    if(Object.keys(request.parameters).length!==Object.keys(expected).length||Object.entries(expected).some(([key,value])=>request.parameters[key]!==value))throw new Error(`Unreviewed Horizons parameters: ${identity}`);
    const url=new URL(request.requestUrl);
    if(url.origin!=='https://ssd.jpl.nasa.gov'||url.pathname!=='/api/horizons.api'||url.hash||url.username||url.password||[...url.searchParams].length!==Object.keys(expected).length||Object.entries(expected).some(([key,value])=>url.searchParams.get(key)!==value))throw new Error(`Horizons URL/parameter mismatch: ${identity}`);
    const requestedDates=[...(request.parameters.TLIST??'').matchAll(/'(\d+(?:\.\d+)?)'/g)].map(match=>Number(match[1]));
    if(!/^'\d+(?:\.\d+)?'(?: '\d+(?:\.\d+)?'){3}$/.test(request.parameters.TLIST??'')||requestedDates.length!==4||requestedDates.some(value=>!Number.isFinite(value)))throw new Error(`Horizons date list mismatch: ${identity}`);
    const sidecar=requestSidecarSchema.parse(JSON.parse(await readFile(join(directory,request.rawPath.replace(/\.json$/,'.request.json')),'utf8')));
    const expectedSidecar=requestSidecarSchema.strip().parse(request);
    if(Object.entries(expectedSidecar).some(([key,value])=>JSON.stringify(sidecar[key as keyof typeof sidecar])!==JSON.stringify(value)))throw new Error(`Horizons sidecar/manifest mismatch: ${identity}`);
    const bytes=await readFile(join(directory,request.rawPath));
    if(bytes.length!==request.bytes||createHash('sha256').update(bytes).digest('hex')!==request.sha256)throw new Error(`Horizons raw checksum mismatch: ${request.rawPath}`);
    const payload=payloadSchema.parse(JSON.parse(bytes.toString('utf8'))), lines=payload.result.split(/\r?\n/);
    const header=(prefix:string)=>{const line=lines.find(value=>value.startsWith(prefix));if(!line)throw new Error(`Missing Horizons header ${prefix}: ${identity}`);return line;};
    const targetHeader=header('Target body name:'),centerHeader=header('Center body name:'),siteHeader=header('Center-site name:'),eopHeader=header('EOP file');
    if(!targetHeader.includes(`(${request.target})`)||!centerHeader.includes('Earth (399)')||!siteHeader.includes('GEOCENTRIC')||!payload.result.includes('NO (AIRLESS)'))throw new Error(`Horizons observer/correction mismatch: ${identity}`);
    const columnLine=lines.find(line=>line.includes('ObsEcLon')&&line.includes('ObsEcLat')&&line.includes('Date_'));
    if(!columnLine)throw new Error(`Missing Horizons observer labels: ${identity}`);
    const columns=columnLine.split(',').map(value=>value.trim());
    const column=(name:string)=>{const index=columns.indexOf(name);if(index<0)throw new Error(`Missing Horizons column ${name}: ${identity}`);return index;};
    const longitude=column('ObsEcLon'),latitude=column('ObsEcLat'),delta=column('TDB-UT');
    const table=payload.result.split('$$SOE')[1]?.split('$$EOE')[0]?.trim();
    if(!table)throw new Error(`Missing Horizons observer table: ${identity}`);
    const rows=table.split(/\r?\n/).map(line=>line.split(',').map(value=>value.trim()));
    if(rows.length!==4)throw new Error(`Horizons row count mismatch: ${identity}`);
    rows.forEach((row,index)=>{
      const iso=HORIZONS_EPOCHS[index]!,instantMs=Date.parse(iso),requestedJulianDate=requestedDates[index]!;
      if([0,longitude,latitude,delta].some(column=>!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(row[column]??'')))throw new Error(`Horizons numeric field missing or malformed: ${identity}:${index}`);
      const julianDate=Number(row[0]),longitudeDeg=Number(row[longitude]),latitudeDeg=Number(row[latitude]),tdbMinusUtSeconds=Number(row[delta]);
      if([julianDate,longitudeDeg,latitudeDeg,tdbMinusUtSeconds].some(value=>!Number.isFinite(value))||longitudeDeg<0||longitudeDeg>=360||Math.abs(latitudeDeg)>90||Math.abs(julianDate-requestedJulianDate)>1e-8)throw new Error(`Horizons numeric/time bounds mismatch: ${identity}:${index}`);
      if(request.timeType==='UT'&&Math.abs(requestedJulianDate-(instantMs/86400000+2440587.5))>1e-8)throw new Error(`Horizons UT input epoch mismatch: ${identity}:${index}`);
      samples.push({bodyId:request.bodyId,target:request.target,timeType:request.timeType,iso,instantMs,requestedJulianDate,julianDate,longitudeDeg,latitudeDeg,tdbMinusUtSeconds,rawPath:request.rawPath,rawSha256:request.sha256,requestUrl:request.requestUrl,retrievedAt:request.retrievedAt,targetHeader,centerHeader,siteHeader,eopHeader});
    });
  }
  if(samples.length!==80||identities.size!==20)throw new Error('Horizons reference requires 10 bodies × 4 epochs × 2 time modes.');
  return samples;
}

export function angularSeparationArcsec(a:{longitudeDeg:number;latitudeDeg:number},b:{longitudeDeg:number;latitudeDeg:number}):number {
  const radians=Math.PI/180,dLatitude=(a.latitudeDeg-b.latitudeDeg)*radians,dLongitude=(a.longitudeDeg-b.longitudeDeg)*radians;
  const half=Math.sin(dLatitude/2)**2+Math.cos(a.latitudeDeg*radians)*Math.cos(b.latitudeDeg*radians)*Math.sin(dLongitude/2)**2;
  return 2*Math.asin(Math.min(1,Math.sqrt(half)))/radians*3600;
}

/** Compare a newly calculated owned-engine snapshot, never stored historical engine values. */
export function compareHorizonsSample(engine:EphemerisEngine,reference:HorizonsSample):HorizonsComparison {
  const snapshot=engine.calculate(reference.instantMs,{latitudeDeg:0,longitudeDeg:0},['W']);
  if(reference.timeType==='TT'&&Math.abs(snapshot.time.julianDateTt-reference.requestedJulianDate)>1e-8)throw new Error(`Horizons TT epoch no longer matches the active engine model: ${reference.iso}. Review time assumptions before refreshing reference data.`);
  const body=snapshot.bodies.find(value=>value.id===reference.bodyId);
  if(!body)throw new Error(`Fresh engine omitted body ${reference.bodyId}.`);
  return {...reference,engineJulianDateTt:snapshot.time.julianDateTt,engineInputInterpretation:snapshot.time.interpretation,engineLongitudeDeg:body.longitudeDeg,engineLatitudeDeg:body.latitudeDeg,longitudeDifferenceArcsec:(((body.longitudeDeg-reference.longitudeDeg+540)%360)-180)*3600,latitudeDifferenceArcsec:(body.latitudeDeg-reference.latitudeDeg)*3600,angularSeparationArcsec:angularSeparationArcsec(body,reference)};
}

export function summarizeHorizonsComparisons(comparisons:readonly HorizonsComparison[]) {
  return (['UT','TT']as const).map(timeType=>{
    const rows=comparisons.filter(row=>row.timeType===timeType);
    if(rows.length!==40)throw new Error('Each Horizons time mode requires 40 comparisons.');
    const worst=rows.reduce((first,second)=>first.angularSeparationArcsec>second.angularSeparationArcsec?first:second);
    return {
      timeType, comparisons:rows.length,
      allWithinTolerance:rows.every(row=>row.angularSeparationArcsec<HORIZONS_TOLERANCE_ARCSEC),
      maximumAngularSeparationArcsec:worst.angularSeparationArcsec,
      worst:{bodyId:worst.bodyId,iso:worst.iso},
      byEpoch:HORIZONS_EPOCHS.map(iso=>({
        iso,maximumAngularSeparationArcsec:Math.max(...rows.filter(row=>row.iso===iso).map(row=>row.angularSeparationArcsec)),
      })),
    };
  });
}
