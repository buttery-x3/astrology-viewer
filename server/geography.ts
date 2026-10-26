import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import geography from '../api/data-manifest.json';

/** Verify the exact external server geography before serving coordinate answers. */
export async function verifyServerGeography():Promise<void>{
  const require=createRequire(import.meta.url),entry=require.resolve('geo-tz/all'),base=path.resolve(path.dirname(entry),'../data');
  for(const file of geography.files){
    const target=path.join(base,file.name),metadata=await stat(target);
    if(metadata.size!==file.bytes)throw new Error('Installed server geography differs from its pinned manifest.');
    const digest=createHash('sha256');await pipeline(createReadStream(target),digest);
    if(digest.digest('hex')!==file.sha256)throw new Error('Installed server geography differs from its pinned manifest.');
  }
}
