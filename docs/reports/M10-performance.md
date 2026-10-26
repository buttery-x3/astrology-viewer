# M10 final performance and recovery

The measured candidate passes the card-reveal and whole-picking budgets on this physical RTX 3060 desktop. The measured clean commit is `a2ef959acc4cf42526245ef0362b70ac5e2f4056`; all **111 source/data/style/WASM and lockfile hashes** match its exact Git blobs. This is source-development evidence from the actual App, not an integrated-GPU laptop or packaged-runtime timing claim.

Final candidate `6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd` has the same 110 other measured files, including picker/controller code, and an identical HoverCard script/template. Only that component's terminal `.full-width-placements` aspect CSS changed. It cannot apply to the measured Sun/body-card composition at 1920×1080. The [binding record](M10-performance-binding.json) retains this exact delta; the [headroom amendment](M10-native-zoom-headroom-amendment.md) records its focused three-engine and native zoom checks. No later physical timing run is claimed.

Measured 2026-10-26T06:25:12.392Z in Chromium 156.0.8078.4, ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002487) Direct3D11 vs_5_0 ps_5_0, D3D11), Windows 10.0.26300, AMD Ryzen 5 5600X 6-Core Processor, at 1920×1080 CSS pixels/DPR1. The real GPU timer extension was available. Source hashes stayed unchanged; no Vite hot update occurred. The footer's old server-start revision is not used as source identity.

[Raw samples](M10-performance.json), [independent Git binding and assertions](M10-performance-binding.json). Raw SHA256: `11081ecabca29f00182760e7a780f10b261cfeedd15276fd98aa37382d3cc659`; normalized source manifest: `189fd1917261f1776e3c1e51e120cb05154db81874276c34b7e13834a16ec934`.

## Measurement and workload

Command: `node scripts/m10-performance.mjs --url http://127.0.0.1:5196 --hardware --host-cpu --no-visuals --output .cache/m10-performance/current-candidate.json`. The harness records and asserts actual layer/filter/view/house-mode states. Earth default is distinct from all 40 geographic lines plus projected houses; dense Outside explicitly enables every reference layer and aspects, respecting independent view memory. Sparkles On/Off use the same actual Sun card and camera path.

The complete unchanged entityAt body is timed through a test-only try/finally wrapper, including indexed stars, clipping, ordering and constellation background classification. Served original/instrumented module hashes are retained. No alternative picker or timing global is shipped. Reveal time starts at eligibility after the normal 300ms dwell and ends at matching card DOM plus next rAF. It excludes physical input delivery/scanout and entrance completion. CPU submission, GPU elapsed and delivered rAF are distinct measurements.

| Measurement | Samples | Median | p95 | Maximum |
|---|---:|---:|---:|---:|
| Card after eligibility (budget 50ms p95) | 36 | 14.70ms | **29.70ms** | 30.40ms |
| earth-default-picking (budget 4ms p95) | 203 | 1.30ms | **2.10ms** | 4.80ms |
| earth-all 40-houses-picking (budget 4ms p95) | 203 | 1.30ms | **2.10ms** | 2.70ms |
| earth-with-figures-picking (budget 4ms p95) | 203 | 1.40ms | **2.10ms** | 3.00ms |
| dense-sky-picking (budget 4ms p95) | 203 | 1.30ms | **2.00ms** | 2.70ms |

All measured reveal, sparkle and picking phases sent zero worker messages and recorded no main-thread tasks ≥50ms. Percentile targets do not hide maximum samples above4ms.

| Camera workload | CPU callback p95 | GPU elapsed p95 |
|---|---:|---:|
| Default Earth (houses/aspects off) | 2.60ms | 0.93ms |
| Earth, all 40 lines plus houses | 2.90ms | 3.19ms |
| Earth plus figures | 3.80ms | 10.17ms |
| Dense Outside | 5.40ms | 7.55ms |
| Sun card sparkles On | 2.90ms | 9.74ms |
| Same Sun card sparkles Off | 2.60ms | 2.88ms |

Delivered rAF p95 was16.70–16.80ms for all six camera workloads; the maximum interval was33.20ms. These measurements do not establish universal 60 fps. The dense ten-year trail request recorded the following status: Limited trail interval Relative to the stars Sampled points 1,996 Point budget 2,000 Shown sampled interval 1999-04-27 00:00:00 UTC 2000-09-06 18:00:00 UTC Requested interval Sampling limits Computation budget reached; only the sampled interval is shown.. No full-capacity trail measurement is claimed. Startup, first resource passes and context restoration long tasks remain in the raw report.

## Idle, resources and recovery

Sparkles On had 12 running decorative glints; Off had zero running glints. Both 2-second idle windows and final no-card idle produced zero additional canvas renders. Glints remained bounded at 12.

| Pass | Geometries | Textures | Programs |
|---|---:|---:|---:|
| Warmup | 537 | 329 | 15 |
| Repeat 1 | 537 | 331 | 15 |
| Repeat 2 | 537 | 331 | 15 |
| Repeat 3 | 537 | 331 | 15 |

The three repeat snapshots are identical after initial warmup. Each pass repeats independent view profiles, layer toggles, all house modes, body previews and four hourly forward/reverse updates. Actual WebGL context loss/restoration preserved camera position/up/target/FOV/aspect exactly and resumed rendering with GL error 0. Disposal removed the canvas and left 0 geometries/programs. The single remaining shared internal DFG texture bookkeeping entry is documented in the [earlier ownership audit](M8-scene.md); context loss releases its GL storage. No page errors occurred. The owned hidden host sampler completed normally without forced termination; its data does not establish the cause of earlier timing variation.

## Scope and history

Earlier dc1b846 and a2ac392 runs remain historical. The latter exceeded the picking target; this fresh run does not retrospectively explain its cause or relabel it a pass. The initially interrupted current run stopped on an ambiguous Catalogue stars test locator; exact checkbox roles repaired the harness, without altering workload or budgets. This complete run is the acceptance evidence.

Current visual evidence is recorded separately in the [compact-card review](M10-rectification-visual-review.md) and [current native-zoom report](M10-native-zoom-headroom-amendment.md); historical scrolling-card screenshots are not current UI proof. Actual Safari, desktop screen reader, integrated-GPU laptop, moderated users and human editorial review remain external gates.
