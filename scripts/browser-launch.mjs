/** Explicit test-only profile. Default desktop and product rendering settings stay unchanged. */
export function firefoxSoftwareLaunchOptions(platform=process.platform,env=process.env){
  if(env.BROWSER_SOFTWARE_WEBGL!=='1')return undefined;
  if(platform!=='linux')throw new Error('BROWSER_SOFTWARE_WEBGL=1 requires Linux with an Xvfb display.');
  if(!/^:\d+(?:\.\d+)?$/.test(env.DISPLAY??''))throw new Error('The Linux software WebGL profile requires a local DISPLAY from xvfb-run.');
  return{
    headless:false,
    firefoxUserPrefs:{'webgl.disabled':false,'webgl.enable-webgl2':true,'webgl.force-enabled':true,'webgl.forbid-software':false},
    env:{...env,LIBGL_ALWAYS_SOFTWARE:'true',GALLIUM_DRIVER:'llvmpipe',GDK_BACKEND:'x11',MOZ_ENABLE_WAYLAND:'0'},
  };
}
