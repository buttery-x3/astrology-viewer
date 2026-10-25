# Repeatable scene validation

Use Node and browser versions pinned by the lockfile. Install Playwright's Chromium, Firefox and WebKit under `.cache/playwright` before running the cross-browser suite. Browser output belongs in ignored `.cache` directories; retain report JSON and selected screenshots with the release evidence.

```powershell
npm run build
node scripts/run-browser-tests.mjs --config playwright.cross-browser.config.ts
```

The cross-browser configuration runs the same workflows in all three desktop engines, with a general 60-second per-workflow limit. The aggregate seven-method construction test has an explicit 120-second allowance; the 63-view matrix has 180 seconds. These functional test limits are not product latency budgets. Playwright WebKit does not replace manual Safari validation on macOS.

`playwright.installed.config.ts` optionally runs the same workflows in already installed Chrome and Edge channels. It does not download browsers. Record the versions actually launched; an older installed Edge version is evidence for that version, not proof of the current or previous major release.

To test the packaged server, start its `server.mjs` as documented in the release guide and set `RELEASE_BASE_URL` to its loopback URL. This skips Vite preview. Use `BROWSER_OUTPUT_DIR` and `BROWSER_REPORT_FILE` for separate concurrent artifacts. Browser version, release revision and server invocation belong in the resulting report.

The 63-view workflow checks all seven systems, all three house displays, and all three viewpoints. It verifies committed body measurements and moment invariance, actual WebGL draw submissions and absence of GL/page errors. Set `MATRIX_SCREENSHOTS=1` to retain all 63 canvas images per browser. They are review artifacts, not unreviewed pixel-golden acceptance baselines.

```powershell
$env:MATRIX_SCREENSHOTS='1'
node scripts/run-browser-tests.mjs --config playwright.cross-browser.config.ts --grep '63 system'
```

The isolated scene performance harness imports the actual scene modules from a running Vite development server. It substitutes a blank same-origin document, so neither App nor Vite's HMR client creates another renderer. It records source hashes and verifies that isolation. The normal orbit workloads use 120 consecutive animation frames; a separate three-pass stress workload switches every system, display, viewpoint, construction, comparison and sampled-history overlay.

```powershell
node scripts/scene-performance.mjs --source-url http://127.0.0.1:5196 --hardware --output .cache/scene-performance/report.json
```

`--hardware` explicitly requests Chromium ANGLE D3D11 and disables the software rasterizer. Read the reported renderer: a flag alone does not establish hardware rendering. Completed asynchronous GPU timer queries exclude compositor/display work; disjoint queries are discarded. CPU submission and delivered animation-callback intervals are separate metrics. The harness does not call `gl.finish` or block on unavailable query results. Resource counts must plateau after repeated identical passes; verify zero idle renders, context recovery, and disposal. Three's module-global DFG texture may remain in renderer bookkeeping after disposal; the destroyed GL context releases its device storage.

Measure end-to-end UI and worker latency separately against the packaged app:

```powershell
node scripts/release-performance.mjs --url http://127.0.0.1:8080 --hardware --output .cache/release-performance/report.json
```

That probe records 30 selection updates, 30 warm chart steps and first usable points for a default one-day Moon trail. Intervals begin at page-local button activation and end at committed matching UI plus the next animation callback. They exclude Playwright protocol delay, but do not prove physical scanout. Cold loading at a documented 20 Mbps needs a separate throttled, empty-cache run.

A discrete desktop GPU run provides evidence only for that documented host. The plan's integrated-GPU laptop, manual Safari, manual screen-reader and participant acceptance gates require their own evidence.
