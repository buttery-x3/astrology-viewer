# Linux rendering CI

The initial Ubuntu 24.04 CI run launched Firefox with `-headless` and failed before scene creation with `AllowWebgl2:false restricts context creation on this system.` This was a browser graphics environment failure: numerical/browser fallback workflows continued, while rendering workflows correctly failed. It is not evidence that Firefox rendered the scene.

The opt-in `BROWSER_SOFTWARE_WEBGL=1` profile gives **only Linux Firefox** a headed X11 session using Mesa llvmpipe. CI must install Xvfb, xauth, Mesa DRI/EGL libraries and diagnostic utilities, then run the existing full release-verification command under `xvfb-run`. Chromium and WebKit keep their existing headless launch options. No rendering test is removed or conditionally skipped by this profile.

The Firefox profile requests `webgl.disabled=false`, `webgl.enable-webgl2=true`, `webgl.force-enabled=true` and `webgl.forbid-software=false`, and uses `LIBGL_ALWAYS_SOFTWARE=true`, `GALLIUM_DRIVER=llvmpipe`, `GDK_BACKEND=x11`, `MOZ_ENABLE_WAYLAND=0`. It requires a local Xvfb `DISPLAY`. These are test settings; the application and deployed server do not change users' browser preferences.

The isolated verifier forwards only the explicit X-display/authority and graphics variables to its browser processes, alongside its existing test allowlist. Its production listener still receives no graphics settings or provider secrets. Before the full browser suite, a separate Firefox preflight compiles GLSL ES3 shaders, draws a triangle, reads the actual pixel, checks WebGL errors and identifies the actual renderer. It fails unless real WebGL2 draw/readback succeeds and the renderer identifies llvmpipe. Its bounded report is saved at `.cache/browser-environment/firefox-webgl-environment.json`, outside the test output directory that Playwright clears at startup. This fails early on an unusable environment and does not replace the product rendering tests.

Primary evidence:

- [Playwright CI: Running headed](https://playwright.dev/docs/ci#running-headed) documents Xvfb for headed execution on Linux and the `xvfb-run` wrapper.
- [Playwright launch options](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-firefox-user-prefs) supports Firefox user preferences; the installed Playwright1.64.1 implementation adds `-headless` only when its launch option is true.
- [Mozilla WebGLContext::CreateAndInitGL](https://github.com/mozilla/gecko-dev/blob/master/dom/canvas/WebGLContext.cpp#L246) checks `AllowWebgl2` when WebGL is not force-enabled. [WebGLContext::Create](https://github.com/mozilla/gecko-dev/blob/master/dom/canvas/WebGLContext.cpp#L492) reads the force-enabled preference before creating the context. This supports the CI-only preference choice; it does not guarantee a usable GL driver by itself.
- [Mesa environment variables](https://docs.mesa3d.org/envvars.html#libgl-environment-variables) documents forcing software rendering, and [Gallium variables](https://docs.mesa3d.org/envvars.html#gallium-environment-variables) documents choosing llvmpipe. No GL version or extension support is fabricated with override variables.

Local checks can validate profile selection, launch configuration and environment forwarding. This Windows workspace has no running general-purpose Linux environment, so the actual Ubuntu job must still confirm the preflight's llvmpipe identity/readback and then pass every rendering workflow. Software CI results are functional compatibility evidence, separate from the quiet RTX performance measurements.
