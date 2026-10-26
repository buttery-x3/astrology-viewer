import { EphemerisEngine, fetchEngineAssets } from '../astronomy/ephemeris';
import { calculationRequestSchema, type CalculationResponse } from './protocol';
export type { CalculationMessage } from './protocol';

let enginePromise: Promise<EphemerisEngine> | undefined;
const getEngine = () => enginePromise ??= fetchEngineAssets().then(EphemerisEngine.create).catch(error => {enginePromise=undefined;throw error;});
const respond = (message: CalculationResponse) => self.postMessage(message);
self.onmessage = async (event:MessageEvent<unknown>) => {
  const parsed = calculationRequestSchema.safeParse(event.data);
  if (!parsed.success) {
    const revision = typeof event.data === 'object' && event.data !== null && 'revision' in event.data
      && typeof event.data.revision === 'number' && Number.isSafeInteger(event.data.revision) && event.data.revision >= 0 ? event.data.revision : 0;
    respond({ type: 'error', revision, error: 'Invalid calculation request. Check the supported date, observer coordinates, and house systems.' });
    return;
  }
  const message = parsed.data;
  try {
    const engine = await getEngine();
    if (message.type === 'init') respond({type:'ready',revision:message.revision,version:engine.version,heapBytes:engine.heapBytes});
    else if (message.type === 'calculate') {
      const started=performance.now();
      const snapshot=engine.calculate(message.instantMs,message.observer,message.systems);
      respond({type:'result',revision:message.revision,snapshot,calculationMs:performance.now()-started,heapBytes:engine.heapBytes});
    }
  } catch(error) {
    respond({type:'error',revision:message.revision,error:error instanceof Error?error.message:'Calculation failed.'});
  }
};
