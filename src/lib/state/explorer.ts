import { writable, type Readable } from 'svelte/store';
import type { EphemerisSnapshot } from '../astronomy/ephemeris';
import { calculationResponseSchema, chartInputSchema, explorerInputPatchSchema, type CalculationRequest, type ExplorerInput } from '../workers/protocol';

export type { ExplorerInput } from '../workers/protocol';
export type Viewpoint = 'overview' | 'observer' | 'outside';
export type LayerKey = 'bodies' | 'horizon' | 'ecliptic' | 'houses' | 'stars';
export type ExplorerInputPatch = Partial<Omit<ExplorerInput, 'observer'>> & { observer?: Partial<ExplorerInput['observer']> };
export interface ExplorerState {
  status: 'loading' | 'ready' | 'pending' | 'error';
  error: string | null;
  revision: number;
  /** Requested valid input. While pending, label the retained scene from snapshot. */
  input: ExplorerInput;
  snapshot: EphemerisSnapshot | null;
  selectedId: string | null;
  viewpoint: Viewpoint;
  layers: Record<LayerKey, boolean>;
}

export interface CalculationWorker {
  postMessage(message: CalculationRequest): void;
  terminate(): void;
  addEventListener(type: 'message' | 'error' | 'messageerror', listener: EventListener): void;
  removeEventListener(type: 'message' | 'error' | 'messageerror', listener: EventListener): void;
}
export interface ExplorerStoreOptions {
  workerFactory?: () => CalculationWorker;
  initialInput?: ExplorerInputPatch;
}
export interface ExplorerStore extends Readable<ExplorerState> {
  init(): void;
  requestChart(patch: ExplorerInputPatch): void;
  select(id: string | null): void;
  setViewpoint(viewpoint: Viewpoint): void;
  setLayer(key: LayerKey, visible: boolean): void;
  retry(): void;
  destroy(): void;
}

export const DEFAULT_EXPLORER_INPUT: Readonly<ExplorerInput> = Object.freeze({
  instantMs: Date.UTC(2000, 0, 1, 12),
  observer: Object.freeze({ latitudeDeg: 51.5, longitudeDeg: 0 }),
  system: 'W',
});

function mergeInput(input: ExplorerInput, patch: ExplorerInputPatch): unknown {
  return { ...input, ...patch, observer: { ...input.observer, ...patch.observer } };
}
function defaultWorkerFactory(): CalculationWorker {
  return new Worker(new URL('../workers/ephemeris-worker.ts', import.meta.url), { type: 'module', name: 'spatial-ephemeris' });
}
function sameInput(a: ExplorerInput, b: ExplorerInput): boolean {
  return a.instantMs === b.instantMs && a.system === b.system
    && a.observer.latitudeDeg === b.observer.latitudeDeg && a.observer.longitudeDeg === b.observer.longitudeDeg;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}

/** A single worker plus revision/generation guards owns atomic snapshot updates. */
export function createExplorerStore(options: ExplorerStoreOptions = {}): ExplorerStore {
  const initial = chartInputSchema.parse(mergeInput({ ...DEFAULT_EXPLORER_INPUT }, options.initialInput ?? {}));
  let state: ExplorerState = {
    status: 'loading', error: null, revision: 0, input: initial, snapshot: null, selectedId: null,
    viewpoint: 'overview', layers: { bodies: true, horizon: true, ecliptic: true, houses: true, stars: true },
  };
  const store = writable(freeze(state));
  let destroyed = false;
  let worker: CalculationWorker | null = null;
  let detach: (() => void) | null = null;
  let generation = 0;
  let workerReady = false;
  let initialized = false;
  let lastCompletedRevision = -1;
  let errorOrigin: 'validation' | 'worker' | null = null;
  const publish = (patch: Partial<ExplorerState>) => { state = freeze({ ...state, ...patch }); store.set(state); };
  const currentStatus = (): ExplorerState['status'] => lastCompletedRevision === state.revision ? 'ready' : state.snapshot ? 'pending' : 'loading';

  function stopWorker(): void {
    generation += 1;
    detach?.();
    detach = null;
    worker?.terminate();
    worker = null;
    workerReady = false;
  }
  function fail(message: string): void {
    if (destroyed) return;
    errorOrigin = 'worker';
    stopWorker();
    publish({ status: 'error', error: message });
  }
  function calculate(): void {
    if (!workerReady || !worker || destroyed) return;
    try {
      worker.postMessage({ type: 'calculate', revision: state.revision, instantMs: state.input.instantMs, observer: { ...state.input.observer }, systems: [state.input.system] });
    } catch { fail('Unable to send the chart calculation. Retry to restart the calculation worker.'); }
  }
  function startWorker(): void {
    if (destroyed || worker) return;
    const startedRevision = state.revision;
    const startedGeneration = ++generation;
    try {
      const active = (options.workerFactory ?? defaultWorkerFactory)();
      worker = active;
      const onMessage: EventListener = (event) => {
        if (destroyed || generation !== startedGeneration || worker !== active) return;
        const data: unknown = (event as MessageEvent<unknown>).data;
        // Superseded results/errors do not affect the active snapshot, even when
        // their payload is malformed. Ready is tied to the worker's init revision.
        if (typeof data === 'object' && data !== null && 'type' in data && 'revision' in data) {
          if ((data.type === 'result' || data.type === 'error') && typeof data.revision === 'number'
            && Number.isSafeInteger(data.revision) && data.revision >= 0 && data.revision < state.revision
            && !(data.type === 'error' && !workerReady && data.revision === startedRevision)) return;
        }
        const parsed = calculationResponseSchema.safeParse(data);
        if (!parsed.success) { fail('The calculation worker returned an invalid response. Retry to restart it.'); return; }
        const message = parsed.data;
        if (message.type === 'ready') {
          if (workerReady) return;
          if (message.revision !== startedRevision) { fail('The calculation worker returned an unexpected initialization response. Retry to restart it.'); return; }
          workerReady = true;
          calculate();
        } else if (message.type === 'error') {
          fail(message.error);
        } else {
          if (!workerReady || message.revision !== state.revision) { fail('The calculation worker returned an unrequested chart revision. Retry to restart it.'); return; }
          const snapshot = message.snapshot;
          if (snapshot.instantMs !== state.input.instantMs || snapshot.observer.latitudeDeg !== state.input.observer.latitudeDeg
            || snapshot.observer.longitudeDeg !== state.input.observer.longitudeDeg
            || !snapshot.houses.some((house) => house.system === state.input.system)) {
            fail('The calculation response does not match the requested chart. Retry to recalculate it.');
            return;
          }
          lastCompletedRevision = state.revision;
          publish({ snapshot, status: errorOrigin === 'validation' ? 'error' : 'ready', error: errorOrigin === 'validation' ? state.error : null });
        }
      };
      const onError: EventListener = (event) => {
        if (destroyed || generation !== startedGeneration || worker !== active) return;
        event.preventDefault();
        fail('The calculation worker stopped unexpectedly. Retry to restart it.');
      };
      const onMessageError: EventListener = () => {
        if (destroyed || generation !== startedGeneration || worker !== active) return;
        fail('The calculation response could not be read. Retry to restart the worker.');
      };
      active.addEventListener('message', onMessage);
      active.addEventListener('error', onError);
      active.addEventListener('messageerror', onMessageError);
      detach = () => {
        active.removeEventListener('message', onMessage);
        active.removeEventListener('error', onError);
        active.removeEventListener('messageerror', onMessageError);
      };
      active.postMessage({ type: 'init', revision: startedRevision });
    } catch { fail('The calculation worker could not start. Retry to load the calculation engine.'); }
  }
  function init(): void {
    if (destroyed || initialized) return;
    initialized = true;
    startWorker();
  }
  function requestChart(patch: ExplorerInputPatch): void {
    if (destroyed) return;
    const patchResult = explorerInputPatchSchema.safeParse(patch);
    const parsed = patchResult.success ? chartInputSchema.safeParse(mergeInput(state.input, patchResult.data)) : patchResult;
    if (!parsed.success) {
      errorOrigin = 'validation';
      publish({ status: 'error', error: 'Enter a UTC instant in 1900–2100, latitude between −90° and 90°, longitude between −180° and 180°, and a supported house system.' });
      return;
    }
    const changed = !sameInput(parsed.data, state.input);
    if (!changed) {
      if (errorOrigin === 'validation') { errorOrigin = null; publish({ status: currentStatus(), error: null }); }
      init();
      return;
    }
    errorOrigin = null;
    publish({ input: parsed.data, revision: state.revision + 1, error: null, status: state.snapshot ? 'pending' : 'loading' });
    if (!initialized) init();
    else if (workerReady) calculate();
    else if (!worker) startWorker();
  }
  function retry(): void {
    if (destroyed) return;
    errorOrigin = null;
    initialized = true;
    stopWorker();
    publish({ revision: state.revision + 1, error: null, status: state.snapshot ? 'pending' : 'loading' });
    startWorker();
  }

  return {
    subscribe: store.subscribe, init, requestChart, retry,
    select(id) {
      if (destroyed || (id !== null && !/^[a-z][a-z0-9]*(?::[a-z0-9_-]+)+$/.test(id))) return;
      if (state.selectedId !== id) publish({ selectedId: id });
    },
    setViewpoint(viewpoint) {
      if (destroyed || !['overview', 'observer', 'outside'].includes(viewpoint) || state.viewpoint === viewpoint) return;
      publish({ viewpoint });
    },
    setLayer(key, visible) {
      if (destroyed || !Object.hasOwn(state.layers, key) || typeof visible !== 'boolean' || state.layers[key] === visible) return;
      publish({ layers: { ...state.layers, [key]: visible } });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopWorker();
    },
  };
}
