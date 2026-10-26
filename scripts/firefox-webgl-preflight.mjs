import { mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { firefoxSoftwareLaunchOptions } from './browser-launch.mjs';

const {values}=parseArgs({options:{output:{type:'string',default:'.cache/browser-environment/firefox-webgl-environment.json'}}});
const launchOptions=firefoxSoftwareLaunchOptions();
if(!launchOptions)throw new Error('WebGL preflight requires the explicit Linux BROWSER_SOFTWARE_WEBGL=1 test profile.');
process.env.PLAYWRIGHT_BROWSERS_PATH??=resolve('.cache/playwright');
const {firefox}=await import('playwright'),browser=await firefox.launch({...launchOptions,timeout:30000});
let result;
try{
  const context=await browser.newContext();await context.route('**/*',route=>route.abort('blockedbyclient'));const page=await context.newPage();
  result=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=4;canvas.height=4;document.body.append(canvas);
    const failures=[];canvas.addEventListener('webglcontextcreationerror',event=>failures.push(event.statusMessage));
    const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true});
    if(!gl)return{webgl2:false,failures};
    const debug=gl.getExtension('WEBGL_debug_renderer_info'),driver={renderer:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER),vendor:gl.getParameter(debug?debug.UNMASKED_VENDOR_WEBGL:gl.VENDOR),version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION)};
    const shader=(type,source)=>{const compiled=gl.createShader(type);gl.shaderSource(compiled,source);gl.compileShader(compiled);if(!gl.getShaderParameter(compiled,gl.COMPILE_STATUS))throw new Error('WebGL2 preflight shader compilation failed: '+gl.getShaderInfoLog(compiled));return compiled;};
    const vertex=shader(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}');
    const fragment=shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.25,0.5,0.75,1.0);}');
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('WebGL2 preflight linking failed: '+gl.getProgramInfoLog(program));
    gl.disable(gl.DITHER);gl.viewport(0,0,4,4);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.drawArrays(gl.TRIANGLES,0,3);const pixel=new Uint8Array(4);gl.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);const error=gl.getError();gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
    return{webgl2:true,driver,pixel:Array.from(pixel),error,contextLost:gl.isContextLost(),contextLossSimulation:!!gl.getExtension('WEBGL_lose_context'),failures};
  });
}finally{await browser.close();}
const expected=[64,128,191,255],readback=result.webgl2&&result.error===0&&!result.contextLost&&result.pixel.every((value,index)=>Math.abs(value-expected[index])<=1),software=result.webgl2&&/llvmpipe/i.test(result.driver.renderer);
const report={generatedAt:new Date().toISOString(),platform:process.platform,browserVersion:browser.version(),profile:'Linux Xvfb / Mesa llvmpipe / headed Firefox',display:process.env.DISPLAY,webglForceEnabled:true,...result,readbackPassed:!!readback,softwareRendererConfirmed:!!software};
const output=resolve(values.output);await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log('FIREFOX_WEBGL_PREFLIGHT',JSON.stringify(report));
if(!readback||!software)throw new Error('Firefox CI environment did not provide real Mesa llvmpipe WebGL2 shader draw/readback. See the saved preflight report.');
