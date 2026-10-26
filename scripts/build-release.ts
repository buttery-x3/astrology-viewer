import { build,loadEnv,type Rollup } from 'vite';
import { execFileSync } from 'node:child_process';
import { cp,mkdir,readFile,writeFile,mkdtemp,stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectReleaseFiles,retainDependencyNotices } from './release-files';
import { hash,inside,releaseManifestSchema,verifyRelease,type ReleaseManifest } from '../server/manifest';

export interface SourceIdentity{revision:string;tree:string;createdAt:string}
function git(root:string,args:string[]):Buffer{return execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});}
export function cleanSourceIdentity(root:string):SourceIdentity{
  if(git(root,['status','--porcelain','--untracked-files=all']).toString().trim())throw new Error('Release packaging requires a clean committed source tree. Commit reviewed changes first.');
  const revision=git(root,['rev-parse','HEAD']).toString().trim(),tree=git(root,['rev-parse','HEAD^{tree}']).toString().trim(),seconds=Number(git(root,['show','-s','--format=%ct','HEAD']).toString().trim());
  if(!/^[a-f0-9]{40}$/.test(revision)||!/^[a-f0-9]{40}$/.test(tree)||!Number.isSafeInteger(seconds))throw new Error('Unable to identify the exact release source.');
  return{revision,tree,createdAt:new Date(seconds*1000).toISOString()};
}
const identityFiles={engineManifest:'src/lib/astronomy/generated/build-manifest.json',ephemerisManifest:'public/data/ephemeris/manifest.json',timezoneManifest:'src/lib/time/data/manifest.json',skyManifest:'src/lib/scene/data/sky-data-manifest.json',coastlineManifest:'src/lib/scene/data/coastline-manifest.json',contentManifest:'src/lib/content/data/manifest.json',geographyManifest:'api/data-manifest.json',packageLock:'package-lock.json'}as const;
export interface PackageReleaseOptions{projectRoot:string;outputRoot:string;appDirectory:string;serverFile:string;sourceArchive:Uint8Array;identity:SourceIdentity;immutableAssets?:ReadonlySet<string>;lookupOrigin?:string|null}
/** Pure packaging boundary is injectable for tests; the CLI obtains identity/archive from a clean Git tree only. */
export async function packageRelease(options:PackageReleaseOptions):Promise<ReleaseManifest>{
  const root=path.resolve(options.projectRoot),output=path.resolve(options.outputRoot);
  if(!inside(path.join(root,'.cache/releases'),output)||output===path.join(root,'.cache/releases'))throw new Error('Release output must be a new directory below .cache/releases.');
  try{await stat(output);throw new Error('Release output already exists; each source revision is packaged once.');}catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='ENOENT'))throw error;}
  await mkdir(output,{recursive:true});await cp(options.appDirectory,path.join(output,'app'),{recursive:true,errorOnExist:true,force:false});await cp(options.serverFile,path.join(output,'server.mjs'),{errorOnExist:true,force:false});
  const sourcePath=`source/source-${options.identity.revision}.tar.gz`;await mkdir(path.join(output,'source'));await writeFile(path.join(output,sourcePath),options.sourceArchive);
  const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'))as{name:string;version:string;scripts:Record<string,string>};
  await writeFile(path.join(output,'package.json'),JSON.stringify({...pkg,scripts:{start:'node server.mjs'}},null,2)+'\n');await cp(path.join(root,'package-lock.json'),path.join(output,'package-lock.json'));
  await mkdir(path.join(output,'licences'),{recursive:true});await cp(path.join(root,'LICENSE'),path.join(output,'licences/LICENSE'));
  await cp(path.join(root,'vendor/swisseph'),path.join(output,'licences/swiss-source-notices'),{recursive:true,filter:source=>!path.extname(source)||/LICENSE|agpl-3\.0\.txt$/i.test(source)});
  await cp(path.join(root,'vendor/emscripten'),path.join(output,'licences/emscripten'),{recursive:true});await cp(path.join(root,'vendor/notices'),path.join(output,'licences/data-terms'),{recursive:true});
  await cp(path.join(root,'docs/data-and-licensing.md'),path.join(output,'licences/data-and-licensing.md'));
  const dependencies=await retainDependencyNotices(root,output);await writeFile(path.join(output,'licences/dependency-notices.json'),JSON.stringify({schemaVersion:1,packages:dependencies},null,2)+'\n');
  const identities={}as ReleaseManifest['identities'];for(const [name,file]of Object.entries(identityFiles))identities[name as keyof typeof identityFiles]=hash(await readFile(path.join(root,file)));
  for(const [name,file]of Object.entries(identityFiles)){await mkdir(path.join(output,'licences/manifests'),{recursive:true});await cp(path.join(root,file),path.join(output,'licences/manifests',name+'.json'));}
  await cp(path.join(root,'docs/deployment.md'),path.join(output,'DEPLOYMENT.md'));
  const files=await collectReleaseFiles(output,options.immutableAssets),manifest=releaseManifestSchema.parse({schemaVersion:1,application:'Spatial Astrology Explorer',version:pkg.version,...options.identity,source:{path:sourcePath,sha256:hash(options.sourceArchive),url:`https://github.com/buttery-x3/astrology-viewer/tree/${options.identity.revision}`},lookupOrigin:options.lookupOrigin??null,identities,files});
  await writeFile(path.join(output,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');await verifyRelease(output);return manifest;
}
export async function buildRelease(projectRoot=process.cwd()):Promise<string>{
  const root=path.resolve(projectRoot),identity=cleanSourceIdentity(root);
  const [major,minor]=process.versions.node.split('.').map(Number);if(major!==24||minor!<15)throw new Error('Release builds require Node24.15 or later within major24.');
  execFileSync(process.execPath,['scripts/verify-assets.mjs'],{cwd:root,stdio:'inherit'});
  execFileSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/validate-content.ts'],{cwd:root,stdio:'inherit'});
  await mkdir(path.join(root,'.cache/releases'),{recursive:true});const temporary=await mkdtemp(path.join(root,'.cache/releases/build-'));
  const appDirectory=path.join(temporary,'app-build'),serverDirectory=path.join(temporary,'server-build');
  const lookupBase=process.env.VITE_LOOKUP_BASE_URL??loadEnv('production',root,'VITE_').VITE_LOOKUP_BASE_URL??'';let lookupOrigin:string|null=null;
  if(lookupBase){const url=new URL(lookupBase,'https://release.invalid');if(url.search||url.hash||url.username||url.password||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!/^https?:\/\//.test(lookupBase)&&(!lookupBase.startsWith('/')||lookupBase.startsWith('//')))throw new Error('Lookup build configuration must be a clean HTTPS origin/path or same-origin path (loopback HTTP is supported).');if(/^https?:\/\//.test(lookupBase))lookupOrigin=url.origin;}
  const built=await build({root,configFile:path.join(root,'vite.config.ts'),define:{'import.meta.env.VITE_LOCAL_SOURCE':JSON.stringify('true'),'import.meta.env.VITE_BUILD_REVISION':JSON.stringify(identity.revision),'import.meta.env.VITE_LOOKUP_BASE_URL':JSON.stringify(lookupBase)},build:{outDir:appDirectory,emptyOutDir:false}});
  const immutable=new Set<string>();for(const output of (Array.isArray(built)?built:[built])as Rollup.RollupOutput[])for(const entry of output.output)if(entry.fileName.startsWith('assets/'))immutable.add(`app/${entry.fileName}`);
  await build({root,configFile:false,build:{ssr:path.join(root,'server/production.ts'),target:'node24',outDir:serverDirectory,emptyOutDir:false,rollupOptions:{output:{entryFileNames:'server.mjs'}}}});
  // Recheck after build hooks: the archive and compiled source must be the same committed tree.
  const after=cleanSourceIdentity(root);if(after.revision!==identity.revision||after.tree!==identity.tree)throw new Error('Source changed during release construction.');
  const sourceArchive=git(root,['archive','--format=tar.gz',`--prefix=spatial-astrology-${identity.revision}/`,identity.revision]),outputRoot=path.join(root,'.cache/releases',identity.revision);
  await packageRelease({projectRoot:root,outputRoot,appDirectory,serverFile:path.join(serverDirectory,'server.mjs'),sourceArchive,identity,immutableAssets:immutable,lookupOrigin});
  await writeFile(path.join(root,'.cache/releases/latest.json'),JSON.stringify({revision:identity.revision,directory:path.relative(root,outputRoot).split(path.sep).join('/')},null,2)+'\n');return outputRoot;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){console.log(await buildRelease());}
