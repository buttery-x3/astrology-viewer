import { afterEach,describe,expect,it,vi } from 'vitest';
import { boundedFetch,boundedJsonFetch,BoundedFetchError } from '../../src/lib/net/bounded-fetch';
import { fetchEngineAssets,EPHEMERIS_FILES } from '../../src/lib/astronomy/ephemeris';
import { createLocationClient } from '../../src/lib/services/locations';
import { createLocationRouter } from '../../api/location-handler';
import { placeQuerySchema,coordinateLookupSchema,coordinateQuerySchema,placeResponseSchema,timezoneResponseSchema } from '../../src/lib/services/location-schema';

afterEach(()=>{vi.useRealTimers();});
const encoder=new TextEncoder(),options={maxBytes:64,timeoutMs:100};
const place={results:[{id:'1',name:'Sydney',label:'Sydney, Australia',latitudeDeg:-33.86,longitudeDeg:151.21,timezone:'Australia/Sydney'}],provider:'Test geographic provider',attribution:'Test attribution'};
const zones={zones:['Australia/Sydney'],dataset:'geo-tz/all@8.1.10',attribution:'Test boundary attribution'};
function json(data:unknown){return new Response(JSON.stringify(data),{status:200});}

describe('bounded streaming network recovery',()=>{
  it('assembles chunked UTF-8 bytes within the cap and clears its deadline after success',async()=>{
    vi.useFakeTimers();const bytes=encoder.encode('{"place":"São Paulo"}');
    const fetcher=vi.fn(async()=>new Response(new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes.slice(0,12));controller.enqueue(bytes.slice(12));controller.close();}})));
    expect(await boundedJsonFetch('/resource',{...options,fetch:fetcher as typeof fetch})).toEqual({place:'São Paulo'});expect(vi.getTimerCount()).toBe(0);
    const init=fetcher.mock.calls[0]as unknown as[string,RequestInit];expect(init[1]).toMatchObject({credentials:'omit',referrerPolicy:'no-referrer',cache:'default'});
  });
  it('rejects an oversized declared body before reading and cancels the resource',async()=>{
    let cancelled=false;const body=new ReadableStream<Uint8Array>({cancel(){cancelled=true;}});
    await expect(boundedFetch('/resource',{...options,fetch:async()=>new Response(body,{headers:{'Content-Length':'1000'}})})).rejects.toMatchObject({code:'too-large'});expect(cancelled).toBe(true);
  });
  it('counts actual bytes when Content-Length is missing or dishonest',async()=>{
    for(const headers of [new Headers(),new Headers({'Content-Length':'1'})]){
      let cancelled=false;const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(40));controller.enqueue(new Uint8Array(40));},cancel(){cancelled=true;}});
      await expect(boundedFetch('/resource',{...options,fetch:async()=>new Response(body,{headers})})).rejects.toMatchObject({code:'too-large'});expect(cancelled).toBe(true);
    }
  });
  it('times out a stalled body, cancels its reader and never exposes a partial payload',async()=>{
    vi.useFakeTimers();let cancelled=false;let signal:AbortSignal|undefined;
    const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(encoder.encode('private partial payload'));},cancel(){cancelled=true;}});
    const pending=boundedFetch('/resource',{...options,timeoutMs:25,fetch:async(_url,init)=>{signal=init?.signal??undefined;return new Response(body);}});
    const assertion=expect(pending).rejects.toMatchObject({code:'timeout'});await vi.advanceTimersByTimeAsync(26);await assertion;expect(cancelled).toBe(true);expect(signal?.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds a non-cooperating fetch promise and cancels a response that resolves after timeout',async()=>{
    vi.useFakeTimers();let resolveResponse!:(response:Response)=>void,cancelled=false;
    const pending=boundedFetch('/resource',{...options,timeoutMs:10,fetch:()=>new Promise(resolve=>{resolveResponse=resolve;})});
    const assertion=expect(pending).rejects.toMatchObject({code:'timeout'});await vi.advanceTimersByTimeAsync(11);await assertion;
    resolveResponse(new Response(new ReadableStream({cancel(){cancelled=true;}})));await vi.advanceTimersByTimeAsync(0);expect(cancelled).toBe(true);
  });
  it('honours caller cancellation before and during loading without echoing its private reason',async()=>{
    const pre=new AbortController();pre.abort('birthDate=2000-01-01');const fetcher=vi.fn();await expect(boundedFetch('/resource',{...options,signal:pre.signal,fetch:fetcher})).rejects.toMatchObject({name:'AbortError',message:'Request cancelled.'});expect(fetcher).not.toHaveBeenCalled();
    vi.useFakeTimers();const controller=new AbortController();const pending=boundedFetch('/resource',{...options,signal:controller.signal,fetch:()=>new Promise(()=>{})});const assertion=expect(pending).rejects.toMatchObject({name:'AbortError',message:'Request cancelled.'});controller.abort('private chart');await assertion;expect(vi.getTimerCount()).toBe(0);
  });
  it('returns sanitized HTTP/network/JSON errors and validates bounded-request options',async()=>{
    await expect(boundedFetch('/resource',{...options,fetch:async()=>new Response('private body',{status:429})})).rejects.toMatchObject({code:'http',status:429,message:'The requested resource is unavailable.'});
    await expect(boundedFetch('/resource?q=private',{...options,fetch:async()=>{throw new Error('private birth details');}})).rejects.toMatchObject({code:'network',message:'The network request failed. Retry when the connection is available.'});
    for(const bytes of [encoder.encode('not JSON'),new Uint8Array([0xff])])await expect(boundedJsonFetch('/resource',{...options,fetch:async()=>new Response(bytes)})).rejects.toMatchObject({code:'invalid-json'});
    await expect(boundedFetch('/resource',{maxBytes:Infinity,timeoutMs:100})).rejects.toThrow(RangeError);await expect(boundedFetch('/resource',{maxBytes:1,timeoutMs:0})).rejects.toThrow(RangeError);
  });
  it('removes external abort listeners and timers on successful or failed reads',async()=>{
    vi.useFakeTimers();const controller=new AbortController(),add=vi.spyOn(controller.signal,'addEventListener'),remove=vi.spyOn(controller.signal,'removeEventListener');
    await boundedFetch('/resource',{...options,signal:controller.signal,fetch:async()=>new Response('okay')});expect(add).toHaveBeenCalledTimes(1);expect(remove).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  });
});

describe('bounded calculation-asset loading',()=>{
  it('requests only the three numerical assets and preserves checked model names',async()=>{
    const fetcher=vi.fn(async()=>new Response(new Uint8Array([1,2,3])));const assets=await fetchEngineAssets('',{fetch:fetcher as typeof fetch});expect(assets.wasmBinary).toEqual(new Uint8Array([1,2,3]));expect([...assets.files.keys()]).toEqual(EPHEMERIS_FILES.map(file=>file.name));expect(fetcher).toHaveBeenCalledTimes(3);
    for(const call of fetcher.mock.calls as unknown as[string,RequestInit][]){expect(String(call[0])).not.toMatch(/birth|instant|observer|chart/);expect(call[1].credentials).toBe('omit');}
  });
  it('rejects any asset above2MiB and aborts sibling downloads',async()=>{
    const signals:AbortSignal[]=[];let calls=0;
    const fetcher:typeof fetch=async(_url,init)=>{signals.push(init!.signal!);if(++calls===1)return new Response(new Uint8Array(),{headers:{'Content-Length':String(2*1024*1024+1)}});return new Promise(()=>{});};
    await expect(fetchEngineAssets('',{fetch:fetcher})).rejects.toMatchObject({code:'too-large'});expect(signals).toHaveLength(3);expect(signals.slice(1).every(signal=>signal.aborted)).toBe(true);
  });
  it('times out or externally aborts an entire asset group with no hanging siblings',async()=>{
    vi.useFakeTimers();const pending=fetchEngineAssets('',{timeoutMs:15,fetch:()=>new Promise(()=>{})});const assertion=expect(pending).rejects.toBeInstanceOf(BoundedFetchError);await vi.advanceTimersByTimeAsync(16);await assertion;expect(vi.getTimerCount()).toBe(0);
    const controller=new AbortController(),cancelled=fetchEngineAssets('',{signal:controller.signal,fetch:()=>new Promise(()=>{})}),cancelAssertion=expect(cancelled).rejects.toMatchObject({name:'AbortError'});controller.abort();await cancelAssertion;expect(vi.getTimerCount()).toBe(0);
  });
});

describe('geographic lookup privacy and bounded recovery',()=>{
  it('sends exactly place text or numeric coordinates, omits credentials/referrers, and never caches them persistently',async()=>{
    const requests:{url:URL;init:RequestInit}[]=[];const client=createLocationClient({baseUrl:'https://lookup.example',fetch:async(url,init)=>{requests.push({url:new URL(String(url)),init:init!});return json(String(url).includes('/places')?place:zones);}});
    expect(await client.searchPlaces(' A&B? C#D ')).toHaveLength(1);expect(await client.lookupTimezones(-33.86,151.21)).toEqual(['Australia/Sydney']);expect([...requests[0]!.url.searchParams.entries()]).toEqual([['q','A&B? C#D']]);expect(requests[0]!.url.hash).toBe('');expect([...requests[1]!.url.searchParams.entries()]).toEqual([['latitude','-33.86'],['longitude','151.21']]);
    for(const {init}of requests)expect(init).toMatchObject({credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
    const fetcher=vi.fn();const invalid=createLocationClient({fetch:fetcher});await expect(invalid.searchPlaces('X')).rejects.toThrow();await expect(invalid.searchPlaces('Paris\nLondon')).rejects.toThrow();await expect(invalid.lookupTimezones(NaN,0)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects personal fields, duplicate/invalid coordinates and oversized or malformed response strings',()=>{
    for(const key of ['instantMs','birthDate','time','chart','houseSystem','snapshot']){expect(placeQuerySchema.safeParse({q:'Sydney',[key]:'private'}).success).toBe(false);expect(coordinateLookupSchema.safeParse({latitude:0,longitude:0,[key]:'private'}).success).toBe(false);}
    expect(coordinateQuerySchema.safeParse({latitude:'0x20',longitude:'0'}).success).toBe(false);expect(coordinateQuerySchema.safeParse({latitude:'',longitude:'0'}).success).toBe(false);expect(coordinateQuerySchema.safeParse({latitude:'1e-7',longitude:'-180'}).success).toBe(true);
    expect(placeResponseSchema.safeParse({...place,results:[{...place.results[0],name:'a'.repeat(201)}]}).success).toBe(false);expect(placeResponseSchema.safeParse({...place,birthDate:'private'}).success).toBe(false);expect(timezoneResponseSchema.safeParse({...zones,zones:['Europe/London?birth=private']}).success).toBe(false);expect(timezoneResponseSchema.safeParse({...zones,zones:['UTC','UTC']}).success).toBe(false);
  });
  it('limits lookup JSON to64KiB and gives recoverable timeout/rate-limit/malformed-data explanations',async()=>{
    const oversized=createLocationClient({fetch:async()=>new Response('x'.repeat(65537))});await expect(oversized.searchPlaces('Paris')).rejects.toThrow('manually');
    const busy=createLocationClient({fetch:async()=>new Response('',{status:429})});await expect(busy.searchPlaces('Paris')).rejects.toThrow('busy');
    const malformed=createLocationClient({fetch:async()=>json({results:[],birthDate:'private'})});await expect(malformed.searchPlaces('Paris')).rejects.toThrow('manually');
    vi.useFakeTimers();const timed=createLocationClient({timeoutMs:10,fetch:()=>new Promise(()=>{})}),pending=timed.searchPlaces('Paris'),assertion=expect(pending).rejects.toThrow('timed out');await vi.advanceTimersByTimeAsync(11);await assertion;
  });
  it('does not accept query strings, credentials or fragments in a configured lookup base',()=>{
    for(const baseUrl of ['https://lookup.example?birth=private','https://lookup.example/#private','https://user:secret@lookup.example','data:text/plain,private'])expect(()=>createLocationClient({baseUrl})).toThrow();
  });
  it('bounds upstream bodies and deadlines on the server and refuses extra personal fields before any external request',async()=>{
    const fetcher=vi.fn(async()=>new Response('x'.repeat(65537))),route=createLocationRouter({fetch:fetcher as typeof fetch});expect((await route(new URL('http://local/api/places?q=Paris&instantMs=123')))?.status).toBe(400);expect(fetcher).not.toHaveBeenCalled();expect((await route(new URL('http://local/api/places?q=Paris')))?.status).toBe(503);
    vi.useFakeTimers();const timed=createLocationRouter({fetch:()=>new Promise(()=>{})}),pending=timed(new URL('http://local/api/places?q=Paris'));await vi.advanceTimersByTimeAsync(6001);expect((await pending)?.status).toBe(503);expect(vi.getTimerCount()).toBe(0);
  });
});
