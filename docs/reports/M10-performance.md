# M10 performance and scene recovery

Measured 26 October 2026 at 03:33 UTC against the complete development application served at `http://127.0.0.1:5196`. The measured source was clean commit `dc1b8469141c3521ebf84a226b37880563fdfcea`. This is physical Windows desktop evidence from the actual App, including its controls, worker and hover cards. It is not a packaged-release, integrated-GPU laptop, Safari, screen-reader or usability result.

The final run meets the M10 card-processing and picking targets on this host. The scene stayed idle while card sparkles animated, and repeated scene operations reached a stable resource plateau.

## Tested configuration and identity

| Item | Observed value |
|---|---|
| Browser | Playwright Chromium 156.0.8078.4 |
| Graphics adapter | ANGLE NVIDIA GeForce RTX 3060, Direct3D 11; physical adapter, not SwiftShader |
| Driver | Windows driver 32.0.16.1088, dated 22 July 2026; read with `Get-CimInstance Win32_VideoController` |
| Host | Windows 10.0.26300; AMD Ryzen 5 5600X; 34,301,444,096 bytes RAM |
| Viewport | 1920×1080 CSS pixels, device pixel ratio 1; actual scene width varies with the inspector |
| Launch arguments | `--use-angle=d3d11 --enable-gpu --disable-software-rasterizer` |
| GPU timing | `EXT_disjoint_timer_query_webgl2` available; completed, non-disjoint results retained |
| Raw evidence | `.cache/m10-performance/validated-hardware.json` |
| Raw SHA-256 | `50bf2b75bd306da7fdec038788dc694b053337f6e93e1248380e918091dcb856` |

All 106 source/data/style/WASM files under `src`, plus the lockfile in that count, were hashed before and after the run. Text hashes normalize CRLF to LF; WASM uses exact bytes. Hashes did not change, and Vite reported no hot updates. A separate `git show` comparison verified **all 106 hashes against the committed blobs**, with no mismatches. The development footer's server-start revision is not used as source identity.

| Binding | SHA-256 |
|---|---|
| Sorted source-hash manifest | `bd4e6b5b95dd4add177dd8aa4e57f7a02a274cbe63ad2b1909cf1c35d947301e` |
| `src/lib/scene/runtime.ts` | `7615ec24665101f38c1266a0438f5c8e3f4742ab52ece8d5362990060c8ecc94` |
| `src/lib/scene/wide-line-buffer.ts` | `e51e45ccc94b4f17757db99a0eba7706394093651c359f9270564bbe2447f7f1` |
| `src/App.svelte` | `4fe89822b4baf1336f32707a3f44e6d6031be8c25c80c0e6264d7eb237aaaafb` |
| `src/lib/ui/FeaturePreview.svelte` | `56dd7074bde4e17a3aad62248c8ac11f9eb1e170b6005cb3003eb41ff6c38efb` |
| Measurement script | `a00368ecc015cabe4251ab5d1919535a237ac0ee7b9a3d3acc5a13085af3aead` |

## Measurement method

Run [m10-performance.mjs](../../scripts/m10-performance.mjs) against a running local Vite server:

```powershell
node scripts/m10-performance.mjs --url http://127.0.0.1:5196 --hardware --output .cache/m10-performance/validated-hardware.json
```

For a server using another checkout, provide `--source-root` with that checkout's absolute path. The harness rejects non-loopback origins. It records actual adapter information and does not infer hardware acceleration from launch arguments.

Test-only response instrumentation parses the served runtime module, wraps the complete unchanged `entityAt` body in `try/finally`, and captures its existing public runtime return value. The served module's original and instrumented hashes are recorded; its original sourcemap source matches the committed runtime hash above. No production timing global, runtime modification or alternative picker is shipped. Arrays are capped at 20,000 samples.

Picking therefore includes raycasts, indexed stars, candidate ordering, Earth/house clipping and background constellation classification. The timing wrapper adds a small overhead. Pointer events are delivered to the real canvas handler once per requested animation frame; this measures handler work and excludes OS input delivery. CPU samples cover synchronous animation callbacks that submit real GL draws. GPU queries cover renderer commands, excluding CSS compositing and display scanout. Delivered rAF intervals, CPU submission and GPU elapsed time are reported separately.

Card eligibility is the scheduled end of the actual 300ms reveal timer. Native object-button focus triggers the normal preview workflow; a matching card's DOM update plus its next rAF provides the UI-ready timestamp. This does not measure physical presentation or wait for the permitted entrance transition to finish. Subsequent control setup has a separate phase and is excluded from interaction-phase summaries.

## Final measurements

| Measurement | Samples | Median | p95 | Maximum |
|---|---:|---:|---:|---:|
| Card after eligibility | 36 | 14.8ms | **31.4ms** | 31.4ms |
| Whole pick: Earth, all 40 lines and houses | 203 | 1.3ms | **2.3ms** | 5.7ms |
| Whole pick: Earth plus 88 figures | 203 | 1.4ms | **2.2ms** | 3.2ms |
| Whole pick: dense Outside sky | 203 | 1.1ms | **1.7ms** | 2.5ms |

The targets are ≤50ms p95 after card eligibility and ≤4ms p95 picking. They are percentile targets: the 5.7ms maximum Earth pick is retained, not hidden. Measured card and picking phases sent **zero worker messages**, so hovering/focusing did not launch calculation jobs.

| Camera workload | CPU callback p95 | GPU elapsed p95 | Delivered rAF p95 |
|---|---:|---:|---:|
| Default close Earth; all geographic lines/houses | 2.3ms | 4.51ms | 16.7ms |
| Earth with constellation figures | 3.7ms | 8.95ms | 16.8ms |
| Dense Outside sky | 6.6ms | 7.50ms | 16.8ms |
| Aspect card sparkles On | 3.0ms | 7.20ms | 16.7ms |
| Same camera path, sparkles Off | 2.6ms | 3.27ms | 16.7ms |

Each camera run dispatched 90 ArrowRight inputs from the same scene handler; the On/Off comparison resets to the same Earth pose. The figures run had one 33.4ms delivered interval and a 47.5ms CPU maximum. These samples do not establish a universal 60fps guarantee.

The dense case enabled sky houses, all reference circles, signs, stars, constellation regions and figures, selected Moon and an actual long trail. The ten-year request honestly reached its three-second sampling limit: **796 points**, covering 24 September 1999 to 9 April 2000, were shown. It is not represented as a 2,000-point capacity measurement; the earlier M9 capacity stress remains separate.

No ≥50ms main-thread long tasks were recorded in either sparkle idle/camera phase, the reveal phase, or the measured picking phases. Long tasks were retained for startup (four), first resource warmup (54ms), and context restoration (81ms). The comparison shows a bounded measured cost, not a claim that CSS animation is free.

## Idle, resource plateau and recovery

Sparkles On exposed 12 running decorative glints. Off left the static design with no running glint animation. Both two-second idle windows produced **zero additional scene renders**, and the final no-card idle window also produced zero renders. Decorative DOM never exceeded 12 glints; dismissed cards left no card or glint nodes.

Four identical passes exercised view entry, independent layer toggles, all three house modes, repeated body previews, four successive hourly chart updates and four reverse updates to the same instant. Counters after every pass were identical:

| Pass | Geometries | Textures | Programs |
|---|---:|---:|---:|
| Warmup | 538 | 230 | 16 |
| Repeat 1 | 538 | 230 | 16 |
| Repeat 2 | 538 | 230 | 16 |
| Repeat 3 | 538 | 230 | 16 |

Actual `WEBGL_lose_context` loss/restoration succeeded. The test deliberately advanced the moment after entering default Earth overview, then checked restoration: camera position, up, target, FOV and aspect were **exactly equal** before and after recovery. `gl.getError()` was zero and rendering resumed.

Disposal removed the canvas and left zero geometries and programs. The remaining one-texture bookkeeping entry is Three's shared internal DFG lookup, documented in the [earlier ownership audit](M8-scene.md); forced context loss releases its GL storage. Late focus, return and zoom calls completed without errors. There were no page errors.

Earlier exploratory runs identified expensive projected-section triangle picking and full-sky bounds on small figure paths. The integrated analytic shared-partition lookup and active-point wide-line bounds are present in this measured source. The bounds preserve Float32 rounding, empty/single-path handling, pooled shrink/reuse and real Line2 stroke-edge picking under transformed parents; the focused renderer checks passed before measurement.

## Post-measurement visual review

Four separate, uninstrumented contexts captured the selected Sun–Moon sextile over close Earth and Outside sphere at 1440×900 and 1024×768, with both explorer and inspector panels open. Files are adjacent to the raw report, named `validated-hardware-{1440,1024}-{earth,outside}.png`.

The actual pixels show distinct close-Earth/full-sky compositions, explicit Sun/Moon names and placements, readable dark interpretation panels, and both sidebars retained. Cards remain inside the viewport; the shorter 1024 layout scrolls its contents. These static reduced-motion captures supplement the [five-theme and contrast review](M10-hover-design.md); they do not claim native 200% browser zoom or close the external accessibility gates.

The tested RTX 3060 desktop is useful physical-device evidence. Integrated-GPU laptop performance, actual Safari, manual screen-reader review, moderated usability and human editorial review remain open as stated in the approved plan.
