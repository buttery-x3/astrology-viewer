import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { createExplorerStore, type CalculationWorker } from '../../src/lib/state/explorer';
import { bodyIdSchema, type CalculationRequest } from '../../src/lib/workers/protocol';
import { IDENTITY_MATRIX3 } from '../../src/lib/astronomy/coordinates';
import { EPHEMERIS_FILES, type EphemerisSnapshot } from '../../src/lib/astronomy/ephemeris';

type ChartRequest = Extract<CalculationRequest, { type: 'calculate' }>;
class FakeWorker extends EventTarget implements CalculationWorker {
  sent: CalculationRequest[] = [];
  terminated = false;
  listeners = new Set<EventListenerOrEventListenerObject>();
  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    if (callback) this.listeners.add(callback);
    super.addEventListener(type, callback, options);
  }
  override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    if (callback) this.listeners.delete(callback);
    super.removeEventListener(type, callback, options);
  }
  postMessage(message: CalculationRequest) { this.sent.push(structuredClone(message)); }
  terminate() { this.terminated = true; }
  respond(data: unknown) { this.dispatchEvent(new MessageEvent('message', { data })); }
  ready() {
    const init = this.sent.find((message) => message.type === 'init');
    if (!init) throw new Error('No init message');
    this.respond({ type: 'ready', revision: init.revision, version: '2.10.03', heapBytes: 1_048_576 });
  }
  latestRequest(): ChartRequest {
    const latest = [...this.sent].reverse().find((message) => message.type === 'calculate');
    if (!latest || latest.type !== 'calculate') throw new Error('No chart request');
    return latest;
  }
  complete(request = this.latestRequest(), snapshot = makeSnapshot(request)) {
    this.respond({ type: 'result', revision: request.revision, snapshot, calculationMs: 2, heapBytes: 1_048_576 });
  }
}

function makeSnapshot(request: ChartRequest): EphemerisSnapshot {
  return {
    instantMs: request.instantMs, observer: { ...request.observer },
    time: { julianDateTt: 2451545.1, julianDateUt1: 2451545, inputJulianDate: 2451545, interpretation: 'utc-leap-table', deltaTSeconds: 64, tidalAcceleration: -25.8 },
    greenwichSiderealTimeDeg: 280, trueObliquityDeg: 23.4,
    frame: { from: 'equatorial-of-date', to: 'equatorial-j2000', julianDateTt: 2451545.1, ofDateKind: 'true', source: 'test', rotation: IDENTITY_MATRIX3 },
    bodies: bodyIdSchema.options.map((id, index) => ({
      id, longitudeDeg: index * 30, latitudeDeg: 0, distanceAu: 1, longitudeSpeedDegPerDay: 1, effectiveFlags: 258,
      equatorial: { rightAscensionDeg: index * 30, declinationDeg: 0 }, fixedEquatorial: { rightAscensionDeg: index * 30, declinationDeg: 0 },
      horizon: { east: 0, north: 1, up: 0, altitudeDeg: 0, azimuthDeg: 0 },
    })),
    houses: (request.systems ?? ['W']).map((system) => ({ system, status: 'valid', cusps: Array.from({ length: 12 }, (_, index) => index * 30), ascendantDeg: 0, midheavenDeg: 270, armcDeg: 270 })),
    provenance: { engine: '2.10.03', revision: 'test', calculation: 'test', data: EPHEMERIS_FILES },
  };
}
function setup() {
  const workers: FakeWorker[] = [];
  const store = createExplorerStore({ workerFactory: () => { const worker = new FakeWorker(); workers.push(worker); return worker; } });
  const start = () => { store.init(); workers[0]!.ready(); workers[0]!.complete(); return workers[0]!; };
  return { store, workers, start };
}

describe('exploration state and worker coordination', () => {
  it('starts each view with its own defaults and restores independent layer choices', () => {
    const {store}=setup();
    const revision=get(store).revision;
    expect(get(store).layers).toMatchObject({asterisms:false,aspects:true,earthProjections:false});
    store.setLayer('stars',false);store.setLayer('equator',true);
    store.setViewpoint('overview');
    expect(get(store)).toMatchObject({revision,viewRevision:1,layers:{earthProjections:true,earthHouses:false,astrocartography:true,aspects:false,asterisms:false,stars:true,equator:false}});
    store.setLayer('earthHouses',true);store.setLayer('aspects',true);
    store.setViewpoint('overview');
    expect(get(store).layers).toMatchObject({earthHouses:true,aspects:true});
    store.setViewpoint('observer');expect(get(store).layers).toMatchObject({earthProjections:false,aspects:false,asterisms:true});
    store.setLayer('horizon',false);
    store.setViewpoint('outside');
    expect(get(store).layers).toMatchObject({asterisms:false,aspects:true,earthProjections:false,stars:false,equator:true,horizon:true});
    store.setViewpoint('overview');
    expect(get(store).layers).toMatchObject({asterisms:false,aspects:true,earthHouses:true,stars:true,equator:false,horizon:true});
    store.setViewpoint('observer');
    expect(get(store).layers).toMatchObject({asterisms:true,aspects:false,horizon:false});
    store.destroy();
  });
  it('temporary camera transitions do not copy carried layers into another view memory', () => {
    const {store}=setup();
    const outside=get(store).layers;
    store.setViewpoint('observer');store.setLayer('aspects',true);
    const observer=get(store).layers,viewRevision=get(store).viewRevision;
    store.setViewpoint('overview',false);
    expect(get(store).layers).toBe(observer);
    expect(get(store).viewRevision).toBe(viewRevision);
    // A focused geographic feature enables its own layer, not every carried bit.
    store.setLayer('earthProjections',true);store.setLayer('astrocartography',true);
    store.setViewpoint('outside');expect(get(store).layers).toEqual(outside);
    store.setViewpoint('overview');
    expect(get(store).layers).toMatchObject({earthProjections:true,earthHouses:false,aspects:false,asterisms:false});
    store.setViewpoint('observer');expect(get(store).layers).toEqual(observer);
    store.destroy();
  });
  it('snapshot updates preserve layer memories without requesting calculations for view switches', () => {
    const {store,start}=setup();const worker=start();
    store.setLayer('asterisms',true);store.setLayer('horizon',false);
    const outside=get(store).layers,count=worker.sent.length;
    store.setViewpoint('observer');store.setLayer('asterisms',false);
    store.setViewpoint('overview');store.setViewpoint('outside');
    expect(get(store).layers).toEqual(outside);expect(worker.sent).toHaveLength(count);
    store.requestChart({instantMs:Date.UTC(2000,0,2,12)});worker.complete();
    expect(get(store).layers).toEqual(outside);
    store.setViewpoint('observer');expect(get(store).layers.asterisms).toBe(false);
    store.destroy();
  });
  it('provides a synchronous Svelte readable and loads the deterministic example once', () => {
    const { store, workers } = setup();
    expect(get(store)).toMatchObject({ status: 'loading', revision: 0, snapshot: null, error: null, viewpoint:'outside', layers:{aspects:true,earthProjections:false,earthHouses:false,asterisms:false}, input: { instantMs: Date.UTC(2000, 0, 1, 12), observer: { latitudeDeg: 51.5, longitudeDeg: 0 }, system: 'W' } });
    expect(workers).toHaveLength(0);
    store.init(); store.init();
    expect(workers).toHaveLength(1);
    expect(workers[0]!.sent).toEqual([{ type: 'init', revision: 0 }]);
    workers[0]!.ready(); workers[0]!.complete();
    expect(get(store)).toMatchObject({ status: 'ready', revision: 0, error: null });
    expect(get(store).snapshot?.bodies).toHaveLength(10);
    store.destroy();
  });

  it('retains a labelled previous snapshot and ignores superseded results and errors', () => {
    const { store, start } = setup();
    const worker = start();
    const previous = get(store).snapshot;
    const oldRequest = worker.latestRequest();
    const nextInstant = oldRequest.instantMs + 86_400_000;
    store.requestChart({ instantMs: nextInstant, observer: { longitudeDeg: 151.2093 } });
    const pending = get(store);
    expect(pending.status).toBe('pending');
    expect(pending.revision).toBe(1);
    expect(pending.input.observer).toEqual({ latitudeDeg: 51.5, longitudeDeg: 151.2093 });
    expect(pending.snapshot).toBe(previous);
    expect(pending.snapshot?.instantMs).toBe(oldRequest.instantMs);
    worker.complete(oldRequest);
    worker.respond({ type: 'result', revision: 0, snapshot: 'malformed stale response' });
    worker.respond({ type: 'error', revision: 0, error: 'stale failure' });
    expect(get(store).status).toBe('pending');
    expect(get(store).snapshot).toBe(previous);
    worker.complete();
    expect(get(store)).toMatchObject({ status: 'ready', error: null, snapshot: { instantMs: nextInstant } });
    expect(Object.isFrozen(get(store).snapshot?.bodies)).toBe(true);
    store.destroy();
  });

  it('coalesces changes during startup and calculates the latest input after ready', () => {
    const { store, workers } = setup();
    store.init();
    store.requestChart({ system: 'C' });
    store.requestChart({ instantMs: Date.UTC(2026, 9, 25), observer: { latitudeDeg: -33.8688, longitudeDeg: 151.2093 } });
    expect(workers[0]!.sent).toHaveLength(1);
    workers[0]!.ready();
    expect(workers[0]!.latestRequest()).toMatchObject({ revision: 2, systems: ['C'], instantMs: Date.UTC(2026, 9, 25) });
    workers[0]!.complete();
    expect(get(store).status).toBe('ready');
    store.destroy();
  });

  it('presentation commands preserve the calculation revision and never send work', () => {
    const { store, start } = setup();
    const worker = start();
    const snapshot = get(store).snapshot;
    const count = worker.sent.length;
    store.select('body:mars'); store.setViewpoint('observer'); store.setLayer('horizon', false); store.setLayer('stars', false);
    store.requestChart({ system: 'W' });
    expect(worker.sent).toHaveLength(count);
    expect(get(store)).toMatchObject({ revision: 0, selectedId: 'body:mars', viewpoint: 'observer', layers: { horizon: false, stars: false } });
    expect(get(store).snapshot).toBe(snapshot);
    store.select(null);
    expect(get(store).selectedId).toBeNull();
    store.destroy();
  });

  it('calculates two distinct systems atomically and retains comparison during time edits',()=>{
    const {store,start}=setup();const worker=start();
    const original=get(store).snapshot;
    store.requestChart({comparisonSystem:'P'});
    expect(worker.latestRequest().systems).toEqual(['W','P']);
    expect(get(store).snapshot).toBe(original);
    worker.complete();
    expect(get(store).snapshot?.houses.map(h=>h.system)).toEqual(['W','P']);
    const bodies=get(store).snapshot?.bodies;
    store.requestChart({instantMs:Date.UTC(2000,0,2,12)});
    expect(worker.latestRequest().systems).toEqual(['W','P']);
    worker.complete();
    expect(get(store).input.comparisonSystem).toBe('P');
    store.requestChart({comparisonSystem:null});worker.complete();
    expect(get(store).snapshot?.houses).toHaveLength(1);
    expect(get(store).snapshot?.bodies).toEqual(bodies);
    store.destroy();
  });

  it('rejects swapped or missing comparison results instead of publishing misleading labels',()=>{
    const {store,start}=setup();const worker=start();const prior=get(store).snapshot;
    store.requestChart({comparisonSystem:'P'});const req=worker.latestRequest();
    const wrong=makeSnapshot(req);wrong.houses.reverse();worker.complete(req,wrong);
    expect(get(store).snapshot).toBe(prior);expect(get(store).error).toMatch(/does not match/);
    store.destroy();
  });

  it('prevents subscribers from mutating committed input or computed snapshot fields', () => {
    const { store, start } = setup();
    start();
    const published = get(store);
    expect(Object.isFrozen(published)).toBe(true);
    expect(Object.isFrozen(published.input.observer)).toBe(true);
    expect(Object.isFrozen(published.layers)).toBe(true);
    expect(Object.isFrozen(published.snapshot?.bodies[0]?.equatorial)).toBe(true);
    const originalLongitude = published.snapshot!.bodies[0]!.longitudeDeg;
    expect(() => { published.input.observer.latitudeDeg = -80; }).toThrow(TypeError);
    expect(() => { published.snapshot!.bodies[0]!.longitudeDeg = 123; }).toThrow(TypeError);
    expect(() => { published.snapshot!.houses.length = 0; }).toThrow(TypeError);
    expect(get(store).input.observer.latitudeDeg).toBe(51.5);
    expect(get(store).snapshot!.bodies[0]!.longitudeDeg).toBe(originalLongitude);
    expect(get(store).snapshot!.houses).toHaveLength(1);
    store.requestChart({ observer: { latitudeDeg: -33.8688 } });
    expect(get(store).input.observer.latitudeDeg).toBe(-33.8688);
    store.destroy();
  });

  it('replaces a failed worker on retry and rejects the old worker generation', () => {
    const { store, workers, start } = setup();
    const first = start();
    const previous = get(store).snapshot;
    store.select('body:moon');
    store.requestChart({ instantMs: Date.UTC(2001, 0, 1) });
    first.dispatchEvent(new Event('error', { cancelable: true }));
    expect(get(store)).toMatchObject({ status: 'error', snapshot: previous });
    expect(first.terminated).toBe(true);
    expect(first.listeners.size).toBe(0);
    store.retry();
    expect(workers).toHaveLength(2);
    expect(get(store)).toMatchObject({ status: 'pending', revision: 2, error: null });
    first.respond({ type: 'error', revision: 2, error: 'old worker tried to interfere' });
    expect(get(store).status).toBe('pending');
    workers[1]!.ready(); workers[1]!.complete();
    expect(get(store)).toMatchObject({ status: 'ready', selectedId: 'body:moon', revision: 2 });
    store.destroy();
  });

  it('handles initialization failure even when the requested revision advanced', () => {
    const { store, workers } = setup();
    store.init(); store.requestChart({ system: 'P' });
    workers[0]!.respond({ type: 'error', revision: 0, error: 'Data download failed.' });
    expect(get(store)).toMatchObject({ status: 'error', revision: 1, error: 'Data download failed.', snapshot: null });
    expect(workers[0]!.terminated).toBe(true);
    store.destroy();
  });

  it('rejects invalid draft input without committing it or dispatching calculations', () => {
    const { store, start } = setup();
    const worker = start();
    const prior = get(store);
    const sent = worker.sent.length;
    store.requestChart({ observer: { latitudeDeg: Number.NaN } });
    expect(get(store)).toMatchObject({ status: 'error', revision: 0, input: prior.input, snapshot: prior.snapshot });
    expect(worker.sent).toHaveLength(sent);
    store.requestChart({ observer: { latitudeDeg: 51.5 } });
    expect(get(store)).toMatchObject({ status: 'ready', error: null, revision: 0 });
    store.requestChart(null as never);
    expect(get(store).status).toBe('error');
    expect(worker.sent).toHaveLength(sent);
    store.destroy();
  });

  it('does not erase a draft validation error when an in-flight valid snapshot arrives', () => {
    const { store, start } = setup();
    const worker = start();
    store.requestChart({ system: 'R' });
    store.requestChart({ instantMs: Date.UTC(2101, 0, 1) });
    worker.complete();
    expect(get(store)).toMatchObject({ status: 'error', revision: 1, input: { system: 'R' } });
    expect(get(store).snapshot?.houses[0]?.system).toBe('R');
    store.requestChart({ system: 'R' });
    expect(get(store).status).toBe('ready');
    store.destroy();
  });

  it('rejects a current snapshot with mismatched inputs instead of displaying it', () => {
    const { store, start } = setup();
    const worker = start();
    const previous = get(store).snapshot;
    store.requestChart({ system: 'K' });
    const request = worker.latestRequest();
    worker.complete(request, { ...makeSnapshot(request), instantMs: request.instantMs + 1000 });
    expect(get(store)).toMatchObject({ status: 'error', snapshot: previous });
    expect(get(store).error).toMatch(/does not match/);
    store.destroy();
  });

  it('validates response payloads and handles unreadable messages', () => {
    const first = setup();
    first.store.init();
    first.workers[0]!.respond({ type: 'ready', revision: 0, version: '2.10.03', heapBytes: -1 });
    expect(get(first.store).error).toMatch(/invalid response/);
    expect(first.workers[0]!.terminated).toBe(true);
    first.store.destroy();
    const second = setup();
    second.store.init();
    second.workers[0]!.dispatchEvent(new Event('messageerror'));
    expect(get(second.store).error).toMatch(/could not be read/);
    second.store.destroy();
  });

  it('reports malformed revision identifiers instead of leaving loading unresolved', () => {
    const { store, workers } = setup();
    store.init();
    workers[0]!.respond({ type: 'result', revision: '0', snapshot: {} });
    expect(get(store).status).toBe('error');
    expect(get(store).error).toMatch(/invalid response/);
    store.destroy();
  });

  it('recovers from a synchronous startup exception and disposes every worker listener', () => {
    let calls = 0;
    const worker = new FakeWorker();
    const store = createExplorerStore({ workerFactory: () => { calls += 1; if (calls === 1) throw new Error('unsupported'); return worker; } });
    store.init();
    expect(get(store).status).toBe('error');
    store.retry(); worker.ready(); worker.complete();
    expect(get(store).status).toBe('ready');
    const final = get(store);
    store.destroy(); store.destroy();
    expect(worker.terminated).toBe(true);
    expect(worker.listeners.size).toBe(0);
    worker.complete();
    store.init(); store.retry(); store.requestChart({ system: 'C' }); store.select('body:mars'); store.setLayer('bodies', false);
    expect(calls).toBe(2);
    expect(get(store)).toBe(final);
  });
});
