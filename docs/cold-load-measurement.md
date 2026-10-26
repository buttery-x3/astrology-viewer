# Cold-load measurement method

Run the packaged production server first, then:

```sh
node scripts/cold-load-performance.mjs --url http://127.0.0.1:8080 --hardware --output .cache/cold-load-performance/report.json
```

The harness checks the release manifest and records its commit, tree, source-archive hash and served-manifest hash. It performs exactly three runs in fresh isolated Chromium contexts at 1920×1080, DPR1, using the fixed Greenwich 2000-01-01 12:00 UTC example. Request interception disables HTTP caching; service workers are blocked. It identifies the actual WebGL renderer, vendor and version rather than inferring hardware from a launch flag. On Windows, `--hardware` requests ANGLE D3D11 and disables software rasterization. The saved driver remains the evidence of what actually ran.

A new loopback proxy per run forwards only release asset paths to the supplied local artifact origin. It blocks API, external-origin, credential and user-data requests. **Raw `node:http.request` / `node:https.request` responses retain gzip/Brotli bytes**. The proxy does not use fetch, whose decoded bodies would invalidate encoded-transfer accounting.

All page and dedicated-worker asset responses share **one FIFO body-serialization clock at 2,500,000 bytes/second (20 megabits/second)**. Each response receives **40ms additional delay before its headers**. A stream awaits each bounded chunk, so concurrent workers and the page cannot each obtain a separate bandwidth allowance. Idle time grants no burst credit. Timer granularity, backpressure, HTTP overhead and browser/CPU scheduling can make observed delivery slower than the nominal body rate. The profile is not an operating-system packet shaper or a real internet connection: upload rate, TCP/TLS handshakes, loss and last-mile contention are not simulated.

The report retains each resource's actual encoded body byte count, content encoding, declared length, status and proxy-relative header/body/completion times. It verifies the calculation worker, WASM and both ephemeris files were observed. Total encoded bytes exclude HTTP/TLS headers and framing. Code bytes sum the actual transferred JS/CSS bodies. Navigation, automatic example-click, numerical/chart readiness and first usability are separate page-clock phases. First usability means committed “Moment calculated” UI, an available canvas with enabled graphics controls, then two animation-frame callbacks; WebGL context availability is checked. It does not measure physical scanout.

The reported p95 uses nearest rank. With only three runs it equals the maximum and does not establish a population percentile. Browser-process, filesystem and GPU-driver caches outside the fresh contexts may remain warm. Run during a documented quiet CPU/GPU window and preserve the environment/driver details with the report. This is a reproducible instrumented application-layer cold-load test; compare its result to the five-second target using that stated scope.

The pure scheduler and raw HTTP proxy have regression tests for shared aggregate pacing, idle credit, cancellation, actual compressed bytes, blocked private/API traffic and small-sample summaries. The harness rejects upstream bodies above8MiB, total received bodies above16MiB, more than64 requests or16 concurrent streams, and navigation/worker startup exceeding30seconds. These are benchmark bounds and do not alter product behavior.
