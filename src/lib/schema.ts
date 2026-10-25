import {z} from 'zod';

// Configure before any browser/worker schemas are constructed. The production
// policy permits WASM compilation, while JavaScript eval remains disabled.
z.config({jitless:true});
export {z};
