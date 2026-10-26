import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import os from 'node:os';

const { values } = parseArgs({ options: {
  'source-url': { type: 'string', default: 'http://127.0.0.1:5196' },
  output: { type: 'string', default: '.cache/scene-performance/report.json' },
  hardware: { type: 'boolean', default: false },
} });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.cache/playwright');
const { chromium } = await import('playwright');
const args = values.hardware ? ['--use-angle=d3d11', '--enable-gpu', '--disable-software-rasterizer'] : [];
const sourcePaths = ['src/lib/scene/runtime.ts','src/lib/scene/house-renderer.ts','src/lib/scene/aspect-renderer.ts','src/lib/scene/construction-renderer.ts','src/lib/scene/trail-renderer.ts'];
const hashSources = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const sourceHashes = await hashSources();
const browser = await chromium.launch({ headless: true, args });
const output = resolve(values.output);
await mkdir(dirname(output), { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const origin = new URL(values['source-url']).origin;
  // Isolate the real scene source from App and Vite HMR; no duplicate renderer.
  await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><title>Scene performance harness</title></head><body></body></html>' }));
  await page.goto(`${origin}/`);
  const initialization = await page.evaluate(async () => {
    const { mountScene } = await import('/src/lib/scene/runtime.ts');
    const { EphemerisEngine, fetchEngineAssets } = await import('/src/lib/astronomy/ephemeris.ts');
    const { DEFAULT_HOUSE_DISPLAY } = await import('/src/lib/domain/house-geometry.ts');
    const { DEFAULT_CONSTRUCTION } = await import('/src/lib/domain/house-construction.ts');
    const { DEFAULT_ASPECT_DISPLAY } = await import('/src/lib/domain/aspect-presentation.ts');
    const { DEFAULT_SCENE_DISPLAY } = await import('/src/lib/domain/display-settings.ts');
    const trail = await import('/src/lib/domain/trails.ts');
    const container = document.createElement('div'); container.style.cssText = 'position:fixed;inset:0;background:#070d17'; document.body.append(container);
    const engine = await EphemerisEngine.create(await fetchEngineAssets());
    const observer = { latitudeDeg: 51.5, longitudeDeg: 0 }, anchor = Date.UTC(2000, 0, 1, 12);
    const snapshots = Array.from({ length: 14 }, (_, index) => engine.calculate(anchor + index * 30 * 86400000, observer));
    const base = { viewpoint: 'outside', selectedId: null, layers: { bodies: true, horizon: true, ecliptic: true, houses: false, stars: true, signs: true, angles: true, equator: false, meridian: false, primeVertical: false, constellations: false }, houseDisplay: { ...DEFAULT_HOUSE_DISPLAY }, construction: { ...DEFAULT_CONSTRUCTION }, aspects: { ...DEFAULT_ASPECT_DISPLAY }, trails: { ...trail.DEFAULT_TRAIL_DISPLAY }, trailResult: null, history: { ...trail.DEFAULT_BOUNDARY_HISTORY }, historyResult: null, display: { ...DEFAULT_SCENE_DISPLAY, reducedMotion: true } };
    const runtime = mountScene(container), frame = () => new Promise(resolve => window.requestAnimationFrame(resolve));
    runtime.update(snapshots[0], base); await frame(); await frame();
    const gl = container.querySelector('canvas').getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info'), timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const driver = { renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER), vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR), version: gl.getParameter(gl.VERSION), viewport: [window.innerWidth, window.innerHeight], devicePixelRatio: window.devicePixelRatio, maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE), timerQuerySupported: !!timer };
    const probe = { enabled: true, phase: 'warmup', quality: 'auto', gpu: [], cpu: [], pending: [], active: null, draws: 0, disjoint: 0 };
    const originalClear = gl.clear.bind(gl);
    gl.clear = function (...args) {
      if (probe.enabled && timer && !probe.active && probe.pending.length < 128 && !gl.isContextLost()) {
        const query = gl.createQuery();
        if (query) {
          const item = { query, phase: probe.phase, quality: probe.quality }; probe.active = item;
          gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
          // Renderer submission is synchronous. End after its complete call,
          // then consume asynchronously: no gl.finish or blocking query reads.
          window.queueMicrotask(() => {
            if (probe.active === item) { gl.endQuery(timer.TIME_ELAPSED_EXT); probe.pending.push(item); probe.active = null; }
          });
        }
      }
      return originalClear(...args);
    };
    for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = gl[method].bind(gl); gl[method] = (...args) => { probe.draws++; return original(...args); };
    }
    const originalRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => originalRAF(timestamp => {
      const count = probe.draws, started = performance.now(), phase = probe.phase, quality = probe.quality;
      callback(timestamp);
      if (probe.draws > count) probe.cpu.push({ phase, quality, ms: performance.now() - started });
    });
    const collectQueries = () => {
      if (!timer) return;
      const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
      for (let index = probe.pending.length - 1; index >= 0; index--) {
        const item = probe.pending[index];
        if (disjoint || gl.getQueryParameter(item.query, gl.QUERY_RESULT_AVAILABLE)) {
          if (disjoint) probe.disjoint++;
          else probe.gpu.push({ phase: item.phase, quality: item.quality, ms: gl.getQueryParameter(item.query, gl.QUERY_RESULT) / 1e6 });
          gl.deleteQuery(item.query); probe.pending.splice(index, 1);
        }
      }
    };
    const star = await trail.sampleTrail({ jobId: 1, bodyId: 'moon', frame: 'stars', observer, anchorMs: anchor, startMs: anchor - 86400000, endMs: anchor + 86400000 }, ms => trail.makeTrailSample(engine.calculate(ms, observer), 'moon'));
    const horizon = await trail.sampleTrail({ jobId: 2, bodyId: 'moon', frame: 'horizon', observer, anchorMs: anchor, startMs: anchor - 86400000, endMs: anchor + 86400000 }, ms => trail.makeTrailSample(engine.calculate(ms, observer), 'moon'));
    const history = await trail.sampleBoundaryHistory({ jobId: 3, system: 'W', house: 1, observer, anchorMs: anchor, startMs: anchor - 43200000, endMs: anchor + 43200000, count: 7 }, ms => engine.calculate(ms, observer));
    // A separate ten-second preparation budget reaches the vertex cap. This
    // is renderer-capacity stress, not the default trail first-feedback test.
    const dense = await trail.sampleTrail({ jobId: 4, bodyId: 'moon', frame: 'stars', observer, anchorMs: anchor, startMs: anchor - 5 * 365.25 * 86400000, endMs: anchor + 5 * 365.25 * 86400000, toleranceDeg: 0.01, maxComputeMs: 10000 }, ms => trail.makeTrailSample(engine.calculate(ms, observer, []), 'moon'));
    const denseSnapshots = Array.from({ length: 60 }, (_, index) => engine.calculate(anchor + (index + 1) * 60000, observer));
    const denseDisplayedVertices = trail.projectTrail(dense, denseSnapshots[0]).samples.length;
    window.scenePerformanceHarness = { runtime, engine, snapshots, base, frame, star, horizon, history, dense, denseSnapshots, denseDisplayedVertices, gl, container, probe, collectQueries };
    return { driver, applicationPresent: !!document.querySelector('.observatory'), viteClientPresent: performance.getEntriesByType('resource').some(item => item.name.includes('/@vite/client')) };
  });
  console.log(JSON.stringify({ phase: 'initialized', ...initialization }));
  const measurements = await page.evaluate(async () => {
    const p = window.scenePerformanceHarness;
    const summary = values => { const sorted = values.slice().sort((a,b) => a-b); return { count: sorted.length, medianMs: sorted[Math.floor(sorted.length * 0.5)] ?? null, p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? null, maxMs: sorted.at(-1) ?? null }; };
    const run = async (phase, count, update) => {
      p.probe.phase = phase; p.probe.quality = phase === 'camera-low' ? 'low' : 'auto'; const intervals = []; let last = null;
      for (let index = 0; index < count; index++) {
        update(index); const now = await p.frame();
        if (last !== null) intervals.push(now - last); last = now; p.collectQueries();
      }
      const resources = p.runtime.getDiagnostics();
      // Drain only completed queries during subsequent non-blocking frames.
      for (let index = 0; index < 12 && p.probe.pending.length; index++) { await p.frame(); p.collectQueries(); }
      await new Promise(resolve => setTimeout(resolve, 400));
      const cpu = p.probe.cpu.filter(item => item.phase === phase), gpu = p.probe.gpu.filter(item => item.phase === phase);
      return { deliveredRAF: summary(intervals), cpuSubmission: summary(cpu.map(item => item.ms)), completedGPU: summary(gpu.map(item => item.ms)), byQuality: Object.fromEntries(['low','auto','high'].map(quality => [quality, { cpuSubmission: summary(cpu.filter(item => item.quality === quality).map(item => item.ms)), completedGPU: summary(gpu.filter(item => item.quality === quality).map(item => item.ms)) }])), idleRenderDelta: p.runtime.getDiagnostics().renderCount - resources.renderCount, resources };
    };
    const defaults = await run('default', 120, index => p.runtime.update(p.snapshots[0], { ...p.base, selectedId: index % 2 ? 'body:moon' : 'body:mars' }));
    p.runtime.update(p.snapshots[0], p.base); await p.frame();
    const orbit = () => p.container.querySelector('canvas').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const cameraAuto = await run('camera-auto', 120, orbit);
    p.runtime.update(p.snapshots[0], { ...p.base, display: { ...p.base.display, quality: 'low' } }); await p.frame();
    const cameraLow = await run('camera-low', 120, orbit);
    const stressUpdate = index => {
      const original = p.snapshots[index % p.snapshots.length], system = ['W','E','O','P','K','R','C'][index % 7];
      const snapshot = { ...original, houses: [original.houses.find(item => item.system === system), ...original.houses.filter(item => item.system !== system).slice(0, 1)] };
      const body = index % 3 === 0, useHorizon = index % 2 === 0;
      p.probe.quality = index % 3 === 0 ? 'low' : index % 3 === 1 ? 'auto' : 'high';
      p.runtime.update(snapshot, { ...p.base, selectedId: body ? 'body:moon' : 'boundary:1', viewpoint: index % 8 === 0 ? 'observer' : 'outside',
        layers: { ...p.base.layers, houses: true, equator: true, meridian: true, primeVertical: true, constellations: true },
        display: { quality: p.probe.quality, reducedMotion: true, labelScale: 1.5, earthOpacity: index % 2 ? 1 : 0.3 },
        houseDisplay: { ...p.base.houseDisplay, mode: ['volumes','arcs','shells'][index % 3], contextFill: true, shellSeparation: 0.15 },
        construction: { ...p.base.construction, enabled: !body, boundaryHouse: 1 },
        trails: { ...p.base.trails, enabled: body, frame: useHorizon ? 'horizon' : 'stars' }, trailResult: useHorizon ? p.horizon : p.star,
        history: { ...p.base.history, enabled: !body }, historyResult: p.history });
    };
    const warm = await run('stress-warm', 42, stressUpdate), first = await run('stress-first', 42, stressUpdate), second = await run('stress-second', 42, stressUpdate);
    const denseTrail = await run('dense-trail', 60, index => p.runtime.update(p.denseSnapshots[index], { ...p.base, selectedId: 'body:moon', trails: { ...p.base.trails, enabled: true }, trailResult: p.dense }));
    return { defaults, cameraAuto, cameraLow, stress: { warm, first, second }, denseTrail: { ...denseTrail, preparationBudgetMs: 10000, sampledVertices: p.dense.samples.length, displayedVertices: p.denseDisplayedVertices, status: p.dense.status, limits: p.dense.limits }, raw: { cpu: p.probe.cpu, gpu: p.probe.gpu }, disjointQueries: p.probe.disjoint, pendingQueries: p.probe.pending.length, glError: p.gl.getError() };
  });
  await page.screenshot({ path: output.replace(/\.json$/, '') + '.png' });
  const recovery = await page.evaluate(async () => {
    const p = window.scenePerformanceHarness, extension = p.gl.getExtension('WEBGL_lose_context');
    const before = p.runtime.getDiagnostics();
    if (!extension) return { supported: false, before };
    // Timer extensions are context-scoped. Recovery is tested without creating
    // new timing queries through the pre-loss extension object.
    p.probe.enabled = false;
    extension.loseContext(); await new Promise(resolve => setTimeout(resolve, 100)); const lost = p.runtime.getDiagnostics();
    extension.restoreContext(); await new Promise(resolve => setTimeout(resolve, 250)); await p.frame(); const restored = p.runtime.getDiagnostics(), glErrorAfterRestore = p.gl.getError();
    p.runtime.dispose(); const disposed = p.runtime.getDiagnostics();
    p.runtime.zoom(1); p.runtime.focusSelection(); p.runtime.returnToObserver(); p.runtime.update(p.snapshots[0], p.base); p.engine.close();
    return { supported: true, before, lost, restored, glErrorAfterRestore, disposed, canvasRemoved: !p.container.querySelector('canvas') };
  });
  const sourceHashesAfter = await hashSources();
  const report = { generatedAt: new Date().toISOString(), browserVersion: browser.version(), launchArgs: args, host: { platform: process.platform, osRelease: os.release(), cpu: os.cpus()[0]?.model, ramBytes: os.totalmem() }, workload: { reducedMotion: true, cameraInput: 'One canvas ArrowRight key activation per consecutive requestAnimationFrame', normalFrames: 120, mixedStressPasses: 3, casesPerStressPass: 42, denseTrailFrames: 60 }, sourceHashes, sourceUnchanged: JSON.stringify(sourceHashes) === JSON.stringify(sourceHashesAfter), sourceHashesAfter, ...initialization, measurements, recovery, errors, limits: ['RTX3060 desktop evidence does not establish integrated-laptop performance.', 'rAF intervals measure delivered callbacks, not physical display presentation.', 'GPU elapsed queries cover renderer commands, excluding compositor and display.', 'Source harness excludes App UI and worker; measure end-to-end release workflows separately.'] };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ phase: 'complete', output, default: measurements.defaults, stress: measurements.stress.second, errors }));
} finally { await browser.close(); }
