import {expect,it} from 'vitest';
import {firefoxSoftwareLaunchOptions} from '../../scripts/browser-launch.mjs';
it('only enables the explicitly requested Linux software test profile and requires a local X display',()=>{
  expect(firefoxSoftwareLaunchOptions('linux',{})).toBeUndefined();expect(firefoxSoftwareLaunchOptions('win32',{})).toBeUndefined();expect(()=>firefoxSoftwareLaunchOptions('win32',{BROWSER_SOFTWARE_WEBGL:'1',DISPLAY:':99'})).toThrow('requires Linux');for(const display of [undefined,'','remote.example:0'])expect(()=>firefoxSoftwareLaunchOptions('linux',{BROWSER_SOFTWARE_WEBGL:'1',DISPLAY:display})).toThrow('DISPLAY');
  const options=firefoxSoftwareLaunchOptions('linux',{BROWSER_SOFTWARE_WEBGL:'1',DISPLAY:':99',XAUTHORITY:'/tmp/test-authority'});expect(options?.headless).toBe(false);expect(options?.firefoxUserPrefs).toMatchObject({'webgl.force-enabled':true,'webgl.enable-webgl2':true,'webgl.disabled':false,'webgl.forbid-software':false});expect(options?.env).toMatchObject({DISPLAY:':99',XAUTHORITY:'/tmp/test-authority',LIBGL_ALWAYS_SOFTWARE:'true',GALLIUM_DRIVER:'llvmpipe',GDK_BACKEND:'x11',MOZ_ENABLE_WAYLAND:'0'});
});
