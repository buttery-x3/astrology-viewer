import { EphemerisEngine, fetchEngineAssets, type HouseSystemId } from '../astronomy/ephemeris';
import type { ObserverCoordinates } from '../astronomy/coordinates';

export type CalculationMessage = { type:'init'; revision:number } | {
  type:'calculate'; revision:number; instantMs:number; observer:ObserverCoordinates; systems?:HouseSystemId[];
};
let enginePromise: Promise<EphemerisEngine> | undefined;
const getEngine = () => enginePromise ??= fetchEngineAssets().then(EphemerisEngine.create).catch(error => {enginePromise=undefined;throw error;});
self.onmessage = async (event:MessageEvent<CalculationMessage>) => {
  const message = event.data;
  try {
    if (!message || !Number.isSafeInteger(message.revision)) throw new Error('Invalid calculation request.');
    const engine = await getEngine();
    if (message.type === 'init') self.postMessage({type:'ready',revision:message.revision,version:engine.version,heapBytes:engine.heapBytes});
    else if (message.type === 'calculate') {
      const started=performance.now();
      const snapshot=engine.calculate(message.instantMs,message.observer,message.systems);
      self.postMessage({type:'result',revision:message.revision,snapshot,calculationMs:performance.now()-started,heapBytes:engine.heapBytes});
    } else throw new Error('Unknown calculation request.');
  } catch(error) {
    self.postMessage({type:'error',revision:message?.revision,error:error instanceof Error?error.message:'Calculation failed.'});
  }
};
