import { readFile,readdir,stat,mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync,brotliCompressSync,constants } from 'node:zlib';
import { hash,type ReleaseFile } from '../server/manifest';

export function releaseMime(name:string):string{
  const extension=path.extname(name).toLowerCase();
  return extension==='.html'?'text/html; charset=utf-8':extension==='.js'||extension==='.mjs'?'text/javascript; charset=utf-8':extension==='.css'?'text/css; charset=utf-8':extension==='.json'?'application/json; charset=utf-8':extension==='.wasm'?'application/wasm':extension==='.gz'?'application/gzip':extension==='.svg'?'image/svg+xml':extension==='.png'?'image/png':extension==='.ico'?'image/x-icon':extension==='.se1'?'application/octet-stream':'text/plain; charset=utf-8';
}
export async function listReleaseFiles(root:string,prefix=''):Promise<string[]>{
  const found:string[]=[];
  for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){
    const name=prefix?`${prefix}/${entry.name}`:entry.name;
    if(entry.isSymbolicLink())throw new Error('Release inputs cannot contain symbolic links.');
    if(entry.isDirectory())found.push(...await listReleaseFiles(root,name));else if(entry.isFile())found.push(name);else throw new Error('Release inputs must be ordinary files.');
  }
  return found.sort();
}
/** Encode before recording any manifest hashes. Encoded representations never mutate afterwards. */
export async function collectReleaseFiles(root:string,immutableAssets:ReadonlySet<string>=new Set()):Promise<ReleaseFile[]>{
  const result:ReleaseFile[]=[];
  for(const name of await listReleaseFiles(root)){
    if(name==='release-manifest.json')throw new Error('Build the release manifest after collecting original files.');
    const bytes=await readFile(path.join(root,name));
    const file:ReleaseFile={path:name,bytes:bytes.length,sha256:hash(bytes),mime:releaseMime(name),immutable:immutableAssets.has(name)||/^source\/source-[a-f0-9]{40}\.tar\.gz$/.test(name)};
    if(bytes.length>=1024&&/^app\/.+\.(html|js|css|json|wasm|se1|svg)$/.test(name)){
      const encoded={gzip:gzipSync(bytes,{level:9}),br:brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:11}})};
      for(const kind of ['gzip','br']as const)if(encoded[kind].length<bytes.length){
        const filename=`${name}.${kind==='gzip'?'gz':'br'}`;await writeFile(path.join(root,filename),encoded[kind]);file.encodings??={};file.encodings[kind]={path:filename,bytes:encoded[kind].length,sha256:hash(encoded[kind])};
      }
    }
    result.push(file);
  }
  return result;
}

interface LockEntry{version?:string;dev?:boolean;optional?:boolean;resolved?:string;integrity?:string}
interface PackageNotice{name:string;version:string;license:unknown;author:unknown;source:string|null;integrity:string|null;repository:unknown;noticeFiles:string[];noticeBasis:'distributed-notice'|'distributed-metadata-and-readme'}
/** Retain every notice distributed by the installed production dependency set. */
export async function retainDependencyNotices(projectRoot:string,releaseRoot:string):Promise<PackageNotice[]>{
  const lock=JSON.parse(await readFile(path.join(projectRoot,'package-lock.json'),'utf8'))as{packages:Record<string,LockEntry>};
  const result:PackageNotice[]=[];
  for(const [location,entry]of Object.entries(lock.packages).sort(([a],[b])=>a.localeCompare(b))){
    if(!location||entry.dev)continue;
    const directory=path.join(projectRoot,location);let pkg:Record<string,unknown>;
    try{pkg=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'))as Record<string,unknown>;}catch(error){if(entry.optional)continue;throw new Error('A production dependency is missing. Run npm ci before packaging.',{cause:error});}
    if(typeof pkg.name!=='string'||typeof pkg.version!=='string'||pkg.version!==entry.version||!pkg.license)throw new Error('A production dependency differs from its locked version/licence metadata.');
    const slug=`${pkg.name.replaceAll('@','').replaceAll('/','__')}-${pkg.version}`;
    const names=(await readdir(directory)).filter(name=>/^(licen[sc]e|copying|copyright|notice)(?:[._-].*)?$/i.test(name));
    const originalNotice=names.length>0;if(!originalNotice)names.push('package.json',...(await readdir(directory)).filter(name=>/^readme(?:\..+)?$/i.test(name)));
    const noticeFiles:string[]=[];
    for(const name of names){
      const input=path.join(directory,name);if(!(await stat(input)).isFile())continue;const bytes=await readFile(input);if(bytes.length>256*1024)throw new Error('A dependency notice exceeds its expected bound.');
      const output=`licences/dependencies/${slug}/${name.replace(/[^A-Za-z0-9_.-]/g,'_')}`;await mkdir(path.dirname(path.join(releaseRoot,output)),{recursive:true});await writeFile(path.join(releaseRoot,output),bytes);noticeFiles.push(output);
    }
    result.push({name:pkg.name,version:pkg.version,license:pkg.license,author:pkg.author??null,source:entry.resolved??null,integrity:entry.integrity??null,repository:pkg.repository??null,noticeFiles,noticeBasis:originalNotice?'distributed-notice':'distributed-metadata-and-readme'});
  }
  return result;
}
