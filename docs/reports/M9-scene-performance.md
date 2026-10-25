# M9 physical desktop scene measurements

The final frozen renderer was measured in headless Chromium 156.0.8078.4 on Windows 10.0.26300, Ryzen 5 5600X, 34,301,444,096 bytes RAM, NVIDIA GeForce RTX 3060. Windows reported GPU driver 32.0.16.1088 dated 2026-07-22. The actual WebGL renderer was `ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002487) Direct3D11 vs_5_0 ps_5_0, D3D11)`. No GPU memory capacity is inferred from Windows' truncated AdapterRAM field.

Launch arguments were `--use-angle=d3d11 --enable-gpu --disable-software-rasterizer`; viewport 1920×1080, devicePixelRatio 1. The source harness uses reduced motion and real canvas ArrowRight activations for orbit, with one update per consecutive animation callback. App, worker and Vite HMR were absent from this isolated renderer page. Renderer source hashes were identical before and after the measured run; runtime SHA256 was `43f82193c4b106fe32e5d72848bd7359abc27391ba33f8e8114dfaae19c1fb20`.

| Workload | Render samples | CPU submission p95 | Completed GPU elapsed p95 | Delivered rAF interval p95 |
|---|---:|---:|---:|---:|
| Default body selection |120|9.9 ms|16.17 ms|16.7 ms|
| Auto camera orbit |120|8.8 ms|6.33 ms|16.7 ms|
| Low camera orbit |120|7.4 ms|1.95 ms|16.7 ms|
| Warm mixed overlay/system switches |42|11.7 ms|39.34 ms|50.0 ms|
| Dense real Moon trail |60|8.0 ms|30.60 ms|33.4 ms|

These are separate timing scopes, not additive values. CPU samples time the rendering animation callback. GPU elapsed values come from completed, non-disjoint `EXT_disjoint_timer_query_webgl2` results around renderer command submission; they exclude compositor and physical display and can include gaps while commands are fed. Animation callback intervals do not prove physical scanout. No `gl.finish` or blocking query reads were used. There were zero disjoint or pending queries at completion, and zero page/GL errors.

The normal orbit workload maintained approximately 60 Hz callback cadence on this desktop. The deliberately heavy overlay switches and dense trail had slower cadence, as shown above; they are not reported as a 60 fps pass. Mixed stress changes dates, all seven systems, three house modes, both body trail frames, comparison boundaries, constructions, reference geometry, constellations and quality settings. Its quality tags describe different cases, not a controlled comparison of quality cost.

The dense case used real native samples, an explicitly extended 10-second preparation budget and 0.01° tolerance to reach the point limit. It stored 1999 samples and displayed 2000 points after exact-current insertion. The sampler honestly reported a limited interval. This capacity test is separate from the normal one-day trail's first-feedback and first-path latency, which the packaged-app probe measures.

Across three identical mixed passes, geometry count stayed 275 and program count 14; dynamic caption texture counts were 96, 98, 97. Texture width changes dispose and replace owned allocations, so counts are bounded rather than bit-for-bit equal. All measured default, camera, stress and dense idle windows produced zero extra scene renders. After context loss/restoration, exterior camera values matched within approximately 1e-14, visible label identities matched exactly, and `gl.getError()` was 0. Disposal removed the canvas and left 0 geometries, 0 programs and 1 texture in renderer bookkeeping: Three's shared internal DFG lookup texture, whose GL storage is released with the destroyed context.

The corrected run supersedes the discarded pre-fix context-loss measurement. Summaries, source hashes, resource counters, recovery poses and launch metadata are in [M9-scene-performance.json](M9-scene-performance.json). That file records the SHA256 and cache path of the retained raw per-frame samples, plus a 39-file dependency manifest covering local runtime/engine imports, lockfile and selected Three/native assets. All local module modification times precede measurement. The later App/worker Zod schema import change is outside this isolated graph.

The source was an uncommitted M9 checkout at measurement time. Subsequent verification against core commit `e39a1f03c0f847d198ef59ba336789c12e015548` found all 34 tracked dependency/asset blobs byte-for-byte identical to the measured hashes, plus all 5 selected installed Three files still matching their recorded bytes and the committed lockfile. There were zero mismatches and no line-ending-only equivalences. The compact JSON records this binding and the retained verification evidence hash. Reproduction commands and scope are in [scene-validation.md](../scene-validation.md).

This physical desktop evidence does not close the plan's integrated-GPU laptop gate. It also does not establish manual Safari, manual screen-reader or participant acceptance. End-to-end worker/UI and throttled cold loading require the separate packaged-server evidence.
