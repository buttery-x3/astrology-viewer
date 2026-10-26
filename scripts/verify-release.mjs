import { spawn } from 'node:child_process';
import { cp,mkdtemp,readFile,realpath,rm,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Only OS/runtime and browser-test settings are inherited by the served artifact.
// In particular NODE_PATH/NODE_OPTIONS and host/provider/VITE secrets cannot affect it.
const permitted=/^(?:path|systemroot|windir|comspec|pathext|temp|tmp|home|userprofile|appdata|localappdata|xdg_cache_home|http_proxy|https_proxy|no_proxy|npm_config_cache)$/i;
const runtimeEnv=Object.fromEntries(Object.entries(process.env).filter(([name])=>permitted.test(name)));
const root=process.cwd(),args=process.argv.slice(2),explicit=args[0]&&!args[0].startsWith('-')?args.shift():null;
const probes=['--latency-probe','--cold-load-probe'].filter(flag=>args.includes(flag));
if(probes.length>1)throw new Error('Choose one release measurement probe.');
const probe=probes[0];if(probe){args.splice(args.indexOf(probe),1);if(args.length)throw new Error('Measurement probes do not accept browser-test arguments.');}
let artifact;
if(explicit)artifact=path.resolve(explicit);
else{const latest=JSON.parse(await readFile('.cache/releases/latest.json','utf8'));if(!/^[a-f0-9]{40}$/.test(latest.revision)||latest.directory!==`.cache/releases/${latest.revision}`)throw new Error('Build an exact release before verifying it.');artifact=path.resolve(latest.directory);}
const manifest=JSON.parse(await readFile(path.join(artifact,'release-manifest.json'),'utf8'));
if(!/^[a-f0-9]{40}$/.test(manifest.revision))throw new Error('Release revision is invalid.');
const tempBase=await realpath(tmpdir()),temporary=await mkdtemp(path.join(tempBase,'spatial-astrology-release-')),isolated=path.join(temporary,'artifact');
let server,browser,installer;
function execute(executable,arguments_,options,timeoutMs,label='Standalone dependency installation'){return new Promise((resolve,reject)=>{
  const child=spawn(executable,arguments_,options);installer=child;let bytes=0,settled=false;
  const finish=(error,code)=>{if(settled)return;settled=true;installer=undefined;clearTimeout(timer);if(error)reject(error);else resolve(code);};
  // Do not echo package-manager diagnostics which can include host registry/proxy details.
  for(const stream of [child.stdout,child.stderr])stream?.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024)child.kill('SIGKILL');});
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish(new Error(label+' exceeded its time bound.'));},timeoutMs);
  child.once('error',()=>finish(new Error(label+' could not start.')));child.once('exit',code=>finish(null,code));
});}
async function stop(child){if(!child||child.exitCode!==null||child.signalCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},6000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill('SIGTERM');});}
async function cleanTemporary(){const resolved=await realpath(temporary),relative=path.relative(tempBase,resolved);if(path.isAbsolute(relative)||relative.startsWith('..')||path.dirname(resolved)!==tempBase||!path.basename(resolved).startsWith('spatial-astrology-release-'))throw new Error('Refusing unsafe standalone verification cleanup.');await rm(resolved,{recursive:true,force:true,maxRetries:4,retryDelay:100});}
const interrupt=()=>{installer?.kill('SIGTERM');browser?.kill('SIGTERM');server?.kill('SIGTERM');};process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
try{
  await cp(artifact,isolated,{recursive:true,filter:source=>!path.relative(artifact,source).split(path.sep).includes('node_modules')});
  const npm=process.env.npm_execpath??path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');if(!(await stat(npm)).isFile())throw new Error('Run this verifier through npm run release:verify.');
  console.log('Installing the artifact’s own locked production dependencies outside the repository.');
  const install=await execute(process.execPath,[npm,'ci','--omit=dev','--ignore-scripts','--prefer-offline','--no-audit','--no-fund'],{cwd:isolated,env:runtimeEnv,stdio:['ignore','pipe','pipe']},180000);if(install!==0)throw new Error('Standalone production dependency installation failed. Check local npm/network configuration.');
  server=spawn(process.execPath,['server.mjs'],{cwd:isolated,env:{...runtimeEnv,HOST:'127.0.0.1',PORT:'0',GEOCODING_MODE:'disabled'},stdio:['ignore','pipe','pipe','ipc']});
  // Startup errors remain generic; never mirror unknown release/provider diagnostics.
  server.stdout.resume();server.stderr.resume();
  const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Standalone release startup timed out.')),30000);const done=(error,value)=>{clearTimeout(timer);server.off('exit',exit);server.off('error',errorHandler);server.off('message',message);if(error)reject(error);else resolve(value);};const exit=()=>done(new Error('Standalone release failed its startup integrity/configuration checks.'));const errorHandler=()=>done(new Error('Standalone release process could not start.'));const message=value=>{if(value?.type==='ready'&&Number.isInteger(value.port)&&value.port>0&&value.port<=65535&&value.revision===manifest.revision)done(null,value.port);};server.once('exit',exit);server.once('error',errorHandler);server.on('message',message);});
  console.log('Running browser verification against the independently installed production artifact.');
  const testEnv=Object.fromEntries(Object.entries(process.env).filter(([name])=>/^(?:CI|PLAYWRIGHT_.*|BROWSER_.*|MATRIX_SCREENSHOTS|DISPLAY|XAUTHORITY|LIBGL_ALWAYS_SOFTWARE|GALLIUM_DRIVER|GDK_BACKEND|MOZ_ENABLE_WAYLAND)$/.test(name))),baseUrl=`http://127.0.0.1:${port}`;
  const browserEnv={...runtimeEnv,...testEnv,PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH??path.resolve('.cache/playwright'),RELEASE_BASE_URL:baseUrl};
  if(process.platform==='linux'&&testEnv.BROWSER_SOFTWARE_WEBGL==='1'){
    const preflight=await execute(process.execPath,['scripts/firefox-webgl-preflight.mjs','--output',path.resolve('.cache/browser-environment/firefox-webgl-environment.json')],{cwd:root,env:browserEnv,stdio:'inherit'},45000,'Firefox WebGL2 preflight');if(preflight!==0)throw new Error('Firefox WebGL2 environment preflight failed; rendering workflows were not skipped.');
  }
  const runArgs=probe?[probe==='--latency-probe'?'scripts/release-performance.mjs':'scripts/cold-load-performance.mjs','--url',baseUrl,'--output',path.resolve(process.env.BROWSER_OUTPUT_DIR??'.cache/release-probes',probe==='--latency-probe'?'latency.json':'cold-load.json'),'--hardware']:['node_modules/playwright/cli.js','test',...args];
  const code=await new Promise((resolve,reject)=>{browser=spawn(process.execPath,runArgs,{cwd:root,env:browserEnv,stdio:'inherit'});browser.once('error',()=>reject(new Error('Browser verification process could not start.')));browser.once('exit',status=>resolve(status??1));});process.exitCode=code;
}finally{
  await stop(browser);await stop(server);process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);
  await cleanTemporary();
}
