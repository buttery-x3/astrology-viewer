import createSpatialEphemeris, { type EmscriptenModule } from './generated/spatial-ephemeris.js';
import { boundedFetch } from '../net/bounded-fetch';
import {
  createEquatorialFrameTransform, equatorialToHorizon,
  type EquatorialFrameTransform, type ObserverCoordinates, type Matrix3,
} from './coordinates';

export const ENGINE_REVISION = 'f4dcd18e8005dde95fd8a8d2312ed12f9accd1b0';
export const BODY_IDS = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'] as const;
export type BodyId = typeof BODY_IDS[number];
export const HOUSE_SYSTEMS = [
  { id: 'W', name: 'Whole Sign' }, { id: 'E', name: 'Equal' }, { id: 'O', name: 'Porphyry' },
  { id: 'P', name: 'Placidus' }, { id: 'K', name: 'Koch' },
  { id: 'R', name: 'Regiomontanus' }, { id: 'C', name: 'Campanus' },
] as const;
export type HouseSystemId = typeof HOUSE_SYSTEMS[number]['id'];
export const EPHEMERIS_FILES = [
  { name: 'sepl_18.se1', sha256: 'ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66' },
  { name: 'semo_18.se1', sha256: '1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7' },
] as const;

export interface EngineAssets { wasmBinary: Uint8Array; files: ReadonlyMap<string, Uint8Array> }
export interface BodyPosition {
  id: BodyId; longitudeDeg: number; latitudeDeg: number; distanceAu: number;
  longitudeSpeedDegPerDay: number; effectiveFlags: number;
  equatorial: { rightAscensionDeg: number; declinationDeg: number };
  fixedEquatorial: { rightAscensionDeg: number; declinationDeg: number };
  horizon: ReturnType<typeof equatorialToHorizon>;
}
export type HouseResult = {
  system: HouseSystemId; status: 'valid'; cusps: number[];
  ascendantDeg: number; midheavenDeg: number; armcDeg: number;
} | { system: HouseSystemId; status: 'undefined'; reason: string };
export interface EngineTime {
  julianDateTt: number; julianDateUt1: number; inputJulianDate: number;
  interpretation: 'historical-ut1' | 'utc-leap-table' | 'future-ut1-assumption';
  deltaTSeconds: number;
  tidalAcceleration: -25.8;
}
export interface EphemerisSnapshot {
  instantMs: number; observer: ObserverCoordinates; time: EngineTime;
  greenwichSiderealTimeDeg: number; trueObliquityDeg: number;
  frame: EquatorialFrameTransform; bodies: BodyPosition[]; houses: HouseResult[];
  provenance: { engine: string; revision: string; calculation: string; data: typeof EPHEMERIS_FILES };
}

function assertInstant(ms: number): void {
  if (!Number.isFinite(ms) || ms < Date.UTC(1900,0,1) || ms >= Date.UTC(2101,0,1))
    throw new RangeError('Supported instants are 1900-01-01 through 2100-12-31 UTC.');
}

export async function verifyEphemerisFile(name: string, bytes: Uint8Array): Promise<void> {
  const expected = EPHEMERIS_FILES.find(file => file.name === name);
  if (!expected) throw new Error(`Unexpected ephemeris file: ${name}`);
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  const actual = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
  if (actual !== expected.sha256) throw new Error(`Ephemeris checksum mismatch: ${name}`);
}

export interface EngineAssetFetchOptions{signal?:AbortSignal;fetch?:typeof fetch;timeoutMs?:number}
export async function fetchEngineAssets(base = '',options:EngineAssetFetchOptions={}): Promise<EngineAssets> {
  const controller=new AbortController(),abort=()=>controller.abort();
  options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
  const read=(url:string)=>boundedFetch(url,{maxBytes:2*1024*1024,timeoutMs:options.timeoutMs??20000,signal:controller.signal,fetch:options.fetch});
  try{
    const [wasmBinary, ...files] = await Promise.all([
      read(new URL('./generated/spatial-ephemeris.wasm', import.meta.url).href),
      ...EPHEMERIS_FILES.map(file => read(`${base}/data/ephemeris/${file.name}?sha256=${file.sha256}`)),
    ]);
    return { wasmBinary: wasmBinary!, files: new Map(EPHEMERIS_FILES.map((file,i) => [file.name, files[i]!])) };
  }catch(error){controller.abort();throw error;}
  finally{options.signal?.removeEventListener('abort',abort);}
}

/** One worker owns one instance; all C calls are synchronous and serial. */
export class EphemerisEngine {
  // Only the most recent instant is retained. Observer/system edits reuse the
  // geocentric calculation; callers receive copies so they cannot poison it.
  private cachedSky: {
    instantMs: number; time: EngineTime; sidereal: number; trueObliquityDeg: number;
    frame: EquatorialFrameTransform; bodies: Omit<BodyPosition, 'horizon'>[];
  } | undefined;
  private constructor(private readonly module: EmscriptenModule) {}
  static async create(assets: EngineAssets): Promise<EphemerisEngine> {
    if ([...assets.files.keys()].some(name => !EPHEMERIS_FILES.some(file => file.name === name)))
      throw new Error('Unverified calculation-model files are not permitted.');
    for (const expected of EPHEMERIS_FILES) {
      const bytes = assets.files.get(expected.name);
      if (!bytes) throw new Error(`Required Swiss ephemeris file missing: ${expected.name}`);
      await verifyEphemerisFile(expected.name, bytes);
    }
    const module = await createSpatialEphemeris({ wasmBinary: assets.wasmBinary, printErr: () => {} });
    module.FS.mkdir('/ephe');
    for (const expected of EPHEMERIS_FILES) module.FS.writeFile(`/ephe/${expected.name}`, assets.files.get(expected.name)!);
    module.ccall('sa_init', null, ['string'], ['/ephe']);
    return new EphemerisEngine(module);
  }
  get version(): string { return this.module.ccall('sa_version','string',[],[]) as string; }
  get heapBytes(): number { return this.module.HEAPU8.byteLength; }
  close(): void { this.cachedSky = undefined; this.module.ccall('sa_close',null,[],[]); }

  private call(name: string, args: number[], lengths: number[]): { status: number; arrays: number[][]; error: string } {
    const pointers = lengths.map(length => this.module._malloc(length * 8));
    const error = this.module._malloc(256);
    try {
      this.module.HEAPU8.fill(0,error,error+256);
      const values = [...args,...pointers,error];
      const status = this.module.ccall(name,'number',values.map(() => 'number'),values) as number;
      // Refresh views after calls: ALLOW_MEMORY_GROWTH may have replaced them.
      return { status, arrays: pointers.map((p,i) => Array.from(this.module.HEAPF64.subarray(p/8,p/8+lengths[i]!))), error: this.module.UTF8ToString(error) };
    } finally { pointers.forEach(p => this.module._free(p)); this.module._free(error); }
  }
  resolveTime(instantMs: number): EngineTime {
    assertInstant(instantMs);
    const d = new Date(instantMs);
    const result = this.call('sa_time', [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()+d.getUTCMilliseconds()/1000],[3]);
    if (result.status < 0) throw new Error(result.error || 'Time-scale conversion failed.');
    const [julianDateTt,julianDateUt1] = result.arrays[0]!;
    const inputJulianDate = instantMs / 86400000 + 2440587.5;
    return {
      julianDateTt: julianDateTt!, julianDateUt1: julianDateUt1!, inputJulianDate,
      interpretation: (['historical-ut1','utc-leap-table','future-ut1-assumption'] as const)[result.arrays[0]![2]!]!,
      deltaTSeconds: this.module.ccall('sa_delta_t','number',['number'],[julianDateUt1!]) as number,
      tidalAcceleration: -25.8,
    };
  }
  private position(jdTt: number, body: number, flags: number): { values: number[]; flags: number } {
    const result = this.call('sa_body',[jdTt,body,flags],[6]);
    if (result.status < 0) throw new Error(result.error || `Calculation failed for body ${body}.`);
    if (body >= 0 && (result.status & 7) !== 2)
      throw new Error(`Swiss ephemeris unavailable for body ${body}; refusing fallback (flags ${result.status}).`);
    return { values: result.arrays[0]!, flags: result.status };
  }
  private geocentricSky(instantMs: number) {
    if (this.cachedSky?.instantMs === instantMs) return this.cachedSky;
    const time = this.resolveTime(instantMs);
    const sidereal = this.module.ccall('sa_sidereal','number',['number'],[time.julianDateUt1]) as number;
    const bodies = BODY_IDS.map((id,index): Omit<BodyPosition, 'horizon'> => {
      const ecl = this.position(time.julianDateTt,index,258);
      const eq = this.position(time.julianDateTt,index,2306).values;
      const fixed = this.position(time.julianDateTt,index,2338).values;
      const equatorial = { rightAscensionDeg: eq[0]!, declinationDeg: eq[1]! };
      return { id,longitudeDeg:ecl.values[0]!,latitudeDeg:ecl.values[1]!,distanceAu:ecl.values[2]!,longitudeSpeedDegPerDay:ecl.values[3]!,effectiveFlags:ecl.flags,
        equatorial,fixedEquatorial:{rightAscensionDeg:fixed[0]!,declinationDeg:fixed[1]!} };
    });
    const nutation = this.position(time.julianDateTt,-1,0).values;
    const frameResult = this.call('sa_frame',[time.julianDateTt],[9]);
    if (frameResult.status < 0) throw new Error(frameResult.error || 'Frame rotation failed.');
    const frame = createEquatorialFrameTransform({julianDateTt:time.julianDateTt,ofDateKind:'true',source:`Swiss Ephemeris ${this.version}`,rotation:frameResult.arrays[0]! as unknown as Matrix3});
    this.cachedSky = { instantMs, time, sidereal, trueObliquityDeg: nutation[0]!, frame, bodies };
    return this.cachedSky;
  }
  calculate(instantMs: number, observer: ObserverCoordinates, systems: readonly HouseSystemId[] = HOUSE_SYSTEMS.map(s => s.id)): EphemerisSnapshot {
    if (!Number.isFinite(observer.latitudeDeg) || Math.abs(observer.latitudeDeg)>90 || !Number.isFinite(observer.longitudeDeg) || Math.abs(observer.longitudeDeg)>180)
      throw new RangeError('Observer coordinates are outside their valid range.');
    const sky = structuredClone(this.geocentricSky(instantMs));
    const { time, sidereal, frame } = sky;
    const bodies = sky.bodies.map(body => ({ ...body, horizon: equatorialToHorizon(body.equatorial, observer, sidereal) }));
    const houses = systems.map((system): HouseResult => {
      if (!HOUSE_SYSTEMS.some(s => s.id === system)) throw new Error('Unsupported house system.');
      if (Math.abs(observer.latitudeDeg) === 90) return {system,status:'undefined',reason:'The geographic pole has no unique local east–west horizon orientation.'};
      const r = this.call('sa_houses',[time.julianDateUt1,observer.latitudeDeg,observer.longitudeDeg,system.charCodeAt(0)],[13,10]);
      if (r.status < 0) return {system,status:'undefined',reason:r.error || `${system} construction is undefined at this latitude; substitute cusps were discarded.`};
      const angles = r.arrays[1]!;
      return {system,status:'valid',cusps:r.arrays[0]!.slice(1,13),ascendantDeg:angles[0]!,midheavenDeg:angles[1]!,armcDeg:angles[2]!};
    });
    return {instantMs,observer:{...observer},time,greenwichSiderealTimeDeg:sidereal,trueObliquityDeg:sky.trueObliquityDeg,frame,bodies,houses,
      provenance:{engine:this.version,revision:ENGINE_REVISION,calculation:'apparent geocentric; tropical of date; geometric horizon; longitude houses',data:EPHEMERIS_FILES}};
  }
}
