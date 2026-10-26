import { afterEach,describe,expect,it } from 'vitest';
import { mkdtemp,mkdir,readFile,writeFile,rm,symlink } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync,brotliDecompressSync,gzipSync } from 'node:zlib';
import { collectReleaseFiles,retainDependencyNotices } from '../../scripts/release-files';
import { packageRelease } from '../../scripts/build-release';
import { hash,inside,verifyRelease } from '../../server/manifest';

const project=process.cwd(),base=path.resolve('.cache/releases'),temporary:string[]=[];
async function workspace(){await mkdir(base,{recursive:true});const directory=await mkdtemp(path.join(base,'packaging-test-'));temporary.push(directory);return directory;}
afterEach(async()=>{for(const target of temporary.splice(0)){if(!inside(base,target)||target===base)throw new Error('Unsafe release test cleanup.');await rm(target,{recursive:true,force:true});}});

describe('release compression and corresponding source packaging',()=>{
  it('records actual original/encoded hashes before freezing the manifest and retains unversioned cache policy',async()=>{
    const root=await workspace();await mkdir(path.join(root,'app/assets'),{recursive:true});const body='export const checked = "compressible application code";\n'.repeat(200);await writeFile(path.join(root,'app/assets/app-a123.js'),body);await writeFile(path.join(root,'app/index.html'),'<title>Small document</title>');
    const files=await collectReleaseFiles(root,new Set(['app/assets/app-a123.js'])),js=files.find(file=>file.path.endsWith('.js'))!;expect(js.immutable).toBe(true);expect(js.sha256).toBe(hash(body));expect(files.find(file=>file.path.endsWith('.html'))!.immutable).toBe(false);
    for(const encoding of ['gzip','br']as const){const representation=js.encodings![encoding]!,bytes=await readFile(path.join(root,representation.path));expect(bytes.length).toBe(representation.bytes);expect(bytes.length).toBeLessThan(Buffer.byteLength(body));expect(hash(bytes)).toBe(representation.sha256);expect((encoding==='gzip'?gunzipSync(bytes):brotliDecompressSync(bytes)).toString()).toBe(body);}
    await writeFile(path.join(root,'release-manifest.json'),'{}');await expect(collectReleaseFiles(root)).rejects.toThrow('after collecting');
  });

  it('packages exact source, locked identities, complete notices and no compiler/tool dependency',async()=>{
    const temporaryRoot=await workspace(),app=path.join(temporaryRoot,'input-app'),server=path.join(temporaryRoot,'input-server.mjs'),output=path.join(temporaryRoot,'artifact');await mkdir(path.join(app,'assets'),{recursive:true});await writeFile(path.join(app,'index.html'),'<title>Release package test</title>');await writeFile(path.join(app,'assets/app-example.js'),'console.log("retained app");'.repeat(200));await writeFile(server,'// bundled production entry\n');
    const revision='e'.repeat(40),source=gzipSync(Buffer.from('test-only corresponding source archive; CLI uses git archive')),manifest=await packageRelease({projectRoot:project,outputRoot:output,appDirectory:app,serverFile:server,sourceArchive:source,identity:{revision,tree:'f'.repeat(40),createdAt:'2026-10-26T00:00:00.000Z'},immutableAssets:new Set(['app/assets/app-example.js'])});
    expect(await verifyRelease(output)).toEqual(manifest);expect(manifest.source.sha256).toBe(hash(source));expect(await readFile(path.join(output,manifest.source.path))).toEqual(source);expect(manifest.source.url).toBe(`https://github.com/buttery-x3/astrology-viewer/tree/${revision}`);expect(manifest.identities.packageLock).toBe(hash(await readFile('package-lock.json')));expect(manifest.files.find(file=>file.path==='app/assets/app-example.js')!.encodings?.br).toBeDefined();
    expect(JSON.parse(await readFile(path.join(output,'package.json'),'utf8')).scripts).toEqual({start:'node server.mjs'});expect(await readFile(path.join(output,'package-lock.json'))).toEqual(await readFile('package-lock.json'));
    for(const name of ['LICENSE','emscripten/LICENSE','emscripten/AUTHORS','emscripten/musl-COPYRIGHT','emscripten/compiler-rt-LICENSE.TXT','data-terms/ODbL-1.0.txt','data-terms/CC-BY-SA-4.0.txt','data-terms/IANA-tz-2026e-LICENSE','data-terms/Stellarium-modern-NOTICE.txt'])expect(manifest.files.some(file=>file.path===`licences/${name}`)).toBe(true);
    const notices=JSON.parse(await readFile(path.join(output,'licences/dependency-notices.json'),'utf8'))as{packages:{name:string;version:string;noticeFiles:string[];noticeBasis:string}[]};expect(notices.packages.length).toBeGreaterThan(40);for(const required of ['geo-tz','svelte','three','zod','moment-timezone'])expect(notices.packages.find(item=>item.name===required)?.noticeFiles.length).toBeGreaterThan(0);for(const item of notices.packages)expect(item.noticeFiles.length).toBeGreaterThan(0);expect(notices.packages.find(item=>item.name==='is-reference')!.noticeBasis).toBe('distributed-metadata-and-readme');
    expect(manifest.files.some(file=>file.path.includes('.tools')||file.path.includes('node_modules'))).toBe(false);await expect(packageRelease({projectRoot:project,outputRoot:output,appDirectory:app,serverFile:server,sourceArchive:source,identity:{revision,tree:'f'.repeat(40),createdAt:'2026-10-26T00:00:00.000Z'}})).rejects.toThrow('already exists');
    await writeFile(path.join(output,'app/assets/app-example.js.br'),'changed after manifest');await expect(verifyRelease(output)).rejects.toThrow('manifest');
  },60000);

  it('preserves source notice bytes and pinned provenance for compiler/runtime/data terms',async()=>{
    const manifest=JSON.parse(await readFile('vendor/notices/manifest.json','utf8'))as{files:{file:string;url:string;bytes:number;sha256:string}[]};for(const entry of manifest.files){const bytes=await readFile(entry.file);expect(bytes.length).toBe(entry.bytes);expect(hash(bytes)).toBe(entry.sha256);expect(new URL(entry.url).protocol).toBe('https:');}expect(manifest.files.length).toBe(8);
  });

  it('rejects symbolic-link inputs before release assembly and bounds production notice extraction',async()=>{
    const root=await workspace(),directory=path.join(root,'real');await mkdir(directory);await writeFile(path.join(directory,'test'),'bounded');await symlink(directory,path.join(root,'linked'),'junction');await expect(collectReleaseFiles(root)).rejects.toThrow('symbolic links');
    const projectRoot=path.join(root,'fake-project');await mkdir(projectRoot);await writeFile(path.join(projectRoot,'package-lock.json'),JSON.stringify({packages:{'node_modules/missing':{version:'1.0.0'}}}));await expect(retainDependencyNotices(projectRoot,path.join(root,'output'))).rejects.toThrow('missing');
  });
});
