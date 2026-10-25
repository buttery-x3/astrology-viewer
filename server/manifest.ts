import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile,stat,realpath } from 'node:fs/promises';
import path from 'node:path';
const sha=z.string().regex(/^[a-f0-9]{64}$/),revision=z.string().regex(/^[a-f0-9]{40}$/);
const safePath=z.string().min(1).max(240).refine(value=>!value.includes('\\')&&!value.includes('..')&&!value.includes('%')&&!value.startsWith('/')&&value.split('/').every(part=>part.length>0&&!part.startsWith('.'))&&/^[A-Za-z0-9_.$@+/-]+$/.test(value));
const encoding=z.object({path:safePath,sha256:sha,bytes:z.number().int().positive().max(100*1024*1024)}).strict();
export const releaseFileSchema=z.object({path:safePath,sha256:sha,bytes:z.number().int().nonnegative().max(100*1024*1024),mime:z.string().min(1).max(100).regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+(?:; charset=utf-8)?$/),immutable:z.boolean(),encodings:z.object({br:encoding.optional(),gzip:encoding.optional()}).strict().optional()}).strict();
const identities=z.object({engineManifest:sha,ephemerisManifest:sha,timezoneManifest:sha,skyManifest:sha,coastlineManifest:sha,contentManifest:sha,geographyManifest:sha,packageLock:sha}).strict();
const lookupOrigin=z.string().url().max(200).refine(value=>{const url=new URL(value);return url.origin===value&&(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname));});
export const releaseManifestSchema=z.object({schemaVersion:z.literal(1),application:z.literal('Spatial Astrology Explorer'),version:z.string().min(1).max(50),revision,tree:revision,createdAt:z.string().datetime(),source:z.object({path:safePath,sha256:sha,url:z.string().url().max(300)}).strict(),lookupOrigin:lookupOrigin.nullable(),identities,files:z.array(releaseFileSchema).min(3).max(10000)}).strict().superRefine((value,ctx)=>{
  const names=value.files.map(file=>file.path);if(new Set(names).size!==names.length)ctx.addIssue({code:'custom',message:'Release paths must be unique.'});
  if(!names.includes('app/index.html')||!names.includes('server.mjs')||!names.includes(value.source.path))ctx.addIssue({code:'custom',message:'Release is missing its app, server or exact source archive.'});
  if(!value.source.path.endsWith(`${value.revision}.tar.gz`)||value.source.url!==`https://github.com/buttery-x3/astrology-viewer/tree/${value.revision}`)ctx.addIssue({code:'custom',message:'Source offer must identify this exact revision.'});
  if(value.files.find(file=>file.path===value.source.path)?.sha256!==value.source.sha256)ctx.addIssue({code:'custom',message:'Source archive hash must match the release file record.'});
  for(const file of value.files){for(const [name,encoded]of Object.entries(file.encodings??{}))if(encoded.path!==`${file.path}.${name==='gzip'?'gz':'br'}`)ctx.addIssue({code:'custom',message:'Encoded file paths must belong to their original representation.'});}
});
export type ReleaseManifest=z.infer<typeof releaseManifestSchema>;
export type ReleaseFile=z.infer<typeof releaseFileSchema>;
export const hash=(data:Uint8Array|string)=>createHash('sha256').update(data).digest('hex');
export function inside(root:string,target:string):boolean{const relative=path.relative(root,target);return relative===''||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
export async function verifyRelease(root:string):Promise<ReleaseManifest>{
  const base=await realpath(root),manifestPath=path.join(base,'release-manifest.json');
  if((await stat(manifestPath)).size>2*1024*1024)throw new Error('Release manifest exceeds its permitted size.');
  const manifest=releaseManifestSchema.parse(JSON.parse(await readFile(manifestPath,'utf8')));
  for(const entry of manifest.files){
    for(const file of [entry,...Object.values(entry.encodings??{})]){
      const target=await realpath(path.join(base,file.path));if(!inside(base,target))throw new Error('A release asset escaped its release directory.');
      const metadata=await stat(target);if(!metadata.isFile()||metadata.size!==file.bytes||hash(await readFile(target))!==file.sha256)throw new Error('A release asset does not match its manifest.');
    }
  }
  return manifest;
}
