/** Ordinary development builds identify their base revision; release builds serve an exact local archive. */
import { SOURCE_BASE_REVISION } from './build-base';
export const BUILD_REVISION=import.meta.env.VITE_BUILD_REVISION??SOURCE_BASE_REVISION;
if(!/^[a-f0-9]{40}$/.test(BUILD_REVISION))throw new Error('The build source revision is invalid.');
export const SOURCE_HREF=import.meta.env.VITE_LOCAL_SOURCE==='true'?'/source':`https://github.com/buttery-x3/astrology-viewer/tree/${BUILD_REVISION}`;
