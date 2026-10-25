# M8 scene accessibility, recovery and resource evidence

## Implemented behaviour

- Auto/Low/High cap the device pixel ratio at 1.5/1/2. Low removes decorative aspect glow and the faint coordinate graticule; calculated body markers, chart reference lines, house geometry and aspect cores stay available.
- Scene label size affects the minimum readable text size and collision rectangles. Body/angle/reference marker captions can move to a clear screen position. Pooled leaders connect the displayed caption to the actual marker; marker positions do not move. Textures measure complete text and stay within 2048 pixels in width.
- A selected body's linked tropical-sign glyph remains a high-priority foreground label when the exterior camera sees the marker on the far half of the sky. Actual Earth occlusion still applies. Body hover identities include the calculated tropical sign and degree, and re-test a stationary pointer after snapshot changes so the text refreshes or clears against the new geometry.
- A translucent Earth renders with matching depth, label-occlusion and pointer-picking rules. The explicit observer-on-globe draft picker temporarily uses a solid Earth. Opacity never changes the observer or calculation.
- Native buttons provide zoom, focus and return to observer. The visible HUD identifies the viewpoint and camera look azimuth/altitude. A keyboard-help disclosure accompanies the canvas. Close physical point/endpoint hits offer a native-button chooser; ordinary line/plane crossings retain their existing picking order. Arrow keys and Home/End navigate choices, Enter activates the native button, and Choice/Escape restore canvas focus.
- The application's resolved reduced-motion boolean controls damping, including an explicit Full preference. A direct runtime caller without display settings inherits the system preference.
- `SceneRuntime.getDiagnostics()` supplies read-only counters and camera pose for local tests. No debug panel, network endpoint or production global is added.

## Durable automated checks

`tests/scene/display-policy.test.ts`: 6 passing cases cover the three DPR caps, matching opaque/transparent picking policy, close-point candidate filtering, label movement without changing anchors, viewport bounds and collision culling.

`tests/browser/scene-display.spec.ts`: 4 passing Chromium workflows, run with device DPR 2:

1. Zoom, keyboard view movement, orientation, Low quality and context restoration preserve numerical chart coordinates. The restored canvas retains the Low DPR cap and native view controls recover.
2. The actual 2024-04-08T18:17Z Sun–Moon eclipse overlap offers both identities. Keyboard choice selects the Moon, closes the chooser and returns focus without changing the moment.
3. A real calculated Sun-nadir observer location places the geocentric Sun behind Earth. The opaque globe blocks that choice; after making Earth translucent, the Sun can be chosen through it. Chart context remains unchanged.
4. The reported Melbourne input, 27 April 1987 at 02:00 local, converts to 26 April 16:00 UTC. The actual native Sun longitude is 35.8919928314° (Taurus 5.89°). A test-only WebGL observer verifies that the Taurus glyph is really drawn and reconstructs its model-view matrix to confirm the fixed-world anchor matches native-frame ecliptic longitude 45° / latitude 5°. The old exterior-hemisphere culling suppressed that glyph. The same workflow verifies the unselected Sun's placement tooltip, changes the snapshot by keyboard with a stationary pointer to confirm fresh degree text, and hides the body layer to confirm clearing. No production debug global is used.

This report does not claim a numerical Sun-placement bug was reproduced. The exact-input scene audit found the actual Sun marker and Taurus band correct, including repeated Sagittarius-season↔April transitions. The verified defect was missing far-side linked-label context. The fix changes label visibility/identity only; body and zodiac geometry retain their calculated positions.

These complement the existing lifecycle, reference geometry, house, construction, aspect and trail tests. Whole-project TypeScript and scoped scene/UI lint passed during this work; the milestone's full-suite result is recorded separately by the main M8 report.

## Measured local environment

The isolated local probe used the actual WebGL renderer and pinned Swiss Ephemeris assets. A fulfilled blank same-origin HTML document started the scene without the application, its worker or the Vite hot-reload client; those isolation checks were recorded explicitly. An earlier contended draft run was discarded after its screenshot revealed application hot-reload activity.

| Property | Observed value |
| --- | --- |
| Three.js | 0.186.1 |
| Browser/graphics | Headless Chromium; WebGL 2/OpenGL ES 3 through ANGLE |
| Driver | Google Vulkan SwiftShader Device (Subzero), software rendering |
| Viewport | 1280×800 CSS pixels |
| Device DPR | 2 |
| Effective DPR | Default Auto 1.5; stress switches 1/1.5/2 |
| Maximum texture size | 8192; application label textures capped at 2048 |
| Completed GPU timer query | Unavailable (`EXT_disjoint_timer_query_webgl2` absent) |

The local raw probe/report/screenshot are `.cache/m8-scene-stress.mjs`, `.cache/m8-scene-stress.json` and `.cache/m8-scene-stress.png`. They are exploratory workspace artifacts; the durable acceptance tests above are committed.

## Timing and idle behaviour

The CPU measurement wraps label layout plus `renderer.render()`. It measures CPU wall time, including any driver submission wait. It does **not** measure completed GPU frame time or establish a physical laptop's frame rate.

These exploratory timing/resource samples preceded the final narrowly scoped linked-sign/hover hardening described above. The final four-workflow browser run covers that hardening. It introduces no new geometry/texture pools, but the exact final build's timing and physical-GPU gate still require their own measurement.

| Workload | CPU submission p95 | Draw calls in last measured state |
| --- | --- | --- |
| Default scene; 40 selected-body updates | 2.9 ms | 139 |
| First mixed stress warmup | 9.7 ms | 304 |
| Repeated warmed stress | 7.3 ms | 304 |

The 42-state stress sequence cycles real native snapshots and all seven primary systems, all three house displays, selected constructions, both trail references, boundary history, catalogue stars/constellation regions, all reference layers, scaled labels, three quality modes, Earth opacity and exterior/observer views. The same sequence was repeated three times. The warmed p95 uses a bounded rolling 120-render sample.

After default and stress work, each 400 ms idle check observed **zero additional renders**. The default harness deliberately awaited two animation frames between changes; their elapsed intervals had a 50 ms median and 56 ms p95 on this software driver. These delivery intervals must not be reported as 60 fps validation. Reference-hardware GPU performance and manual Safari behaviour have not been validated by this probe.

## Resource stability and graphics recovery

Counters below are Three's uploaded WebGL resources, rather than the total JavaScript object count.

| Point in repeated 42-state sequence | Geometries | Textures | Programs |
| --- | --- | --- | --- |
| First warmup | 276 | 85 | 14 |
| Second sequence | 276 | 87 | 14 |
| Third identical sequence | 276 | 87 | 14 |

The small first-to-second texture warmup plateaued; there was no continuing growth in the next identical sequence. The default scene before stress used 87 geometries, 22 textures and 11 programs. Label leaders, trail/history strokes and display-mode switches reuse their pools.

Actual `WEBGL_lose_context` loss/restoration succeeded with no page errors. The camera pose and visible entity-label IDs matched across restoration. Only the current view is immediately reuploaded, so the restored counter was 236 geometries/28 textures/13 programs; other pooled resources remain available for later views. The probe reported `gl.getError() === 0` before recovery.

Teardown removed the canvas, disposed all scene-owned geometries/materials/textures and renderer programs, and forced context loss. Final counters were 0 geometries, 1 texture, 0 programs. The remaining texture counter is Three's internal module-global 16×16 `DFG_LUT`, not a retained scene sprite texture:

- Pinned dependency source `node_modules/three/src/renderers/shaders/DFGLUTData.js` creates that singleton `DataTexture` for physically based lighting.
- `node_modules/three/src/renderers/WebGLRenderer.js`, around lines 2742–2745, assigns it internally to physically based material uniforms.
- It is not an owned scene-material map. The application does not dispose another renderer's shared singleton. Forced context loss releases the destroyed context's GPU storage.

Late update/focus/return/zoom calls after disposal are inert. The probe recorded no JavaScript page errors. This evidence supports stable local resource use and context recovery; it does not replace the unperformed reference-hardware or manual cross-browser checks.
