import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import os from 'node:os';
import ts from 'typescript';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://127.0.0.1:5196' },
    'source-root': { type: 'string', default: process.cwd() },
    output: { type: 'string', default: '.cache/m10-performance/report.json' },
    hardware: { type: 'boolean', default: false },
    quick: { type: 'boolean', default: false },
  },
});
const origin = new URL(values.url).origin,
  sourceRoot = resolve(values['source-root']),
  output = resolve(values.output);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname))
  throw new Error('This source-instrumentation harness requires a loopback origin.');
await mkdir(dirname(output), { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(sourceRoot, '.cache/playwright');
const { chromium } = await import('playwright');
const launchArgs = values.hardware
  ? process.platform === 'win32'
    ? ['--use-angle=d3d11', '--enable-gpu', '--disable-software-rasterizer']
    : ['--enable-gpu', '--disable-software-rasterizer']
  : [];
const sourcePaths = [
  'package-lock.json',
  ...(await readdir(resolve(sourceRoot, 'src'), { recursive: true }))
    .filter((path) => /\.(?:ts|js|json|svelte|css|wasm)$/.test(path))
    .map((path) => `src/${path.replaceAll('\\', '/')}`),
].sort();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      sourcePaths.map(async (path) => {
        const bytes = await readFile(resolve(sourceRoot, path));
        return [
          path,
          sha(path.endsWith('.wasm') ? bytes : bytes.toString('utf8').replaceAll('\r\n', '\n')),
        ];
      }),
    ),
  );
const beforeHashes = await sourceHashes();
const sourceGit = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim(),
  dirty:
    execFileSync('git', ['status', '--porcelain'], { cwd: sourceRoot, encoding: 'utf8' }).trim() !==
    '',
};
const servedModules = [];

/** Test-only wrappers leave the original function bodies unchanged, including every early return. */
function instrumentRuntime(source, url) {
  const ast = ts.createSourceFile(
      'runtime.js',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    ),
    changes = [];
  let picked = 0,
    mounted = 0;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'entityAt' && node.body) {
      const start = node.body.getStart(ast),
        end = node.body.end,
        body = source.slice(start + 1, end - 1);
      changes.push({
        start,
        end,
        text: `{const __m10_started=performance.now();try{${body}}finally{const __m10_p=globalThis.__m10;if(__m10_p&&__m10_p.picking.length<20000)__m10_p.picking.push({phase:__m10_p.phase,ms:performance.now()-__m10_started});}}`,
      });
      picked++;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'mountScene' && node.body) {
      const returned = node.body.statements
        .filter(ts.isReturnStatement)
        .filter(
          (statement) => statement.expression && ts.isObjectLiteralExpression(statement.expression),
        );
      if (returned.length !== 1)
        throw new Error('Expected exactly one public runtime return value.');
      const statement = returned[0];
      changes.push({
        start: statement.getStart(ast),
        end: statement.end,
        text: `const __m10_public=${statement.expression.getText(ast)};if(globalThis.__m10)globalThis.__m10.runtime=__m10_public;return __m10_public;`,
      });
      mounted++;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (picked !== 1 || mounted !== 1)
    throw new Error(`Unexpected runtime shape (${picked} picking/${mounted} mount).`);
  let result = source;
  for (const change of changes.sort((a, b) => b.start - a.start))
    result = result.slice(0, change.start) + change.text + result.slice(change.end);
  const mapSource = source.match(
    /sourceMappingURL=data:application\/json(?:;charset=utf-8)?;base64,([^\s]+)/,
  )?.[1];
  const original = mapSource
    ? JSON.parse(Buffer.from(mapSource, 'base64').toString('utf8')).sourcesContent?.[0]
    : null;
  servedModules.push({
    url,
    originalSha256: sha(source),
    originalSourceSha256: original ? sha(original.replaceAll('\r\n', '\n')) : null,
    instrumentedSha256: sha(result),
    wrappers: [
      'entityAt: whole original body try/finally',
      'mountScene: capture existing public return value',
    ],
  });
  return result;
}

const browser = await chromium.launch({ headless: true, args: launchArgs });
try {
  const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    }),
    errors = [],
    hmrMessages = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.text().includes('[vite]')) hmrMessages.push(message.text());
  });
  await page.addInitScript(() => {
    const p = (window.__m10 = {
      phase: 'startup',
      phaseWindows: [{ phase: 'startup', startMs: 0 }],
      runtime: null,
      picking: [],
      cpu: [],
      gpu: [],
      longtasks: [],
      reveals: [],
      workerMessages: [],
      maxGlints: 0,
      draws: 0,
      pending: [],
      active: null,
      timerEnabled: true,
      arm: null,
      gl: null,
    });
    const append = (array, item) => {
      if (array.length < 20000) array.push(item);
    };
    p.setPhase = (name) => {
      p.phase = name;
      append(p.phaseWindows, { phase: name, startMs: performance.now() });
    };
    const workerPost = window.Worker.prototype.postMessage;
    window.Worker.prototype.postMessage = function (message, ...args) {
      append(p.workerMessages, { phase: p.phase, type: message?.type ?? 'unknown' });
      return Reflect.apply(workerPost, this, [message, ...args]);
    };
    try {
      new window.PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          append(p.longtasks, {
            phase: p.phase,
            startMs: entry.startTime,
            durationMs: entry.duration,
          });
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      p.longTaskObserverUnsupported = true;
    }
    const nativeTimeout = window.setTimeout.bind(window);
    window.setTimeout = function (handler, delay, ...args) {
      if (
        p.arm &&
        delay === 300 &&
        typeof handler === 'function' &&
        String(handler).includes('reveal')
      )
        p.arm.eligibleAt = performance.now() + 300;
      return nativeTimeout(handler, delay, ...args);
    };
    new window.MutationObserver(() => {
      p.maxGlints = Math.max(p.maxGlints, document.querySelectorAll('.glint').length);
      const arm = p.arm,
        card = document.querySelector('[data-testid="hover-card"]');
      if (
        !arm ||
        arm.eligibleAt === null ||
        !card ||
        card.querySelector('h2')?.textContent.trim() !== arm.title
      )
        return;
      p.arm = null;
      const domReady = performance.now();
      window.requestAnimationFrame(() =>
        append(p.reveals, {
          title: arm.title,
          totalMs: performance.now() - arm.started,
          afterEligibilityMs: performance.now() - arm.eligibleAt,
          domAfterEligibilityMs: domReady - arm.eligibleAt,
        }),
      );
    }).observe(document, { childList: true, subtree: true, characterData: true });
    const originalGet = window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      const gl = Reflect.apply(originalGet, this, [kind, ...args]);
      if (kind !== 'webgl2' || !gl || gl.__m10Tracked) return gl;
      gl.__m10Tracked = true;
      p.gl = gl;
      const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2'),
        clear = gl.clear.bind(gl);
      gl.clear = (...args) => {
        if (p.timerEnabled && timer && !p.active && !gl.isContextLost() && p.pending.length < 128) {
          const query = gl.createQuery();
          if (query) {
            const item = { query, phase: p.phase };
            p.active = item;
            gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
            window.queueMicrotask(() => {
              if (p.active === item) {
                gl.endQuery(timer.TIME_ELAPSED_EXT);
                p.pending.push(item);
                p.active = null;
              }
            });
          }
        }
        return clear(...args);
      };
      for (const name of [
        'drawElements',
        'drawArrays',
        'drawElementsInstanced',
        'drawArraysInstanced',
      ]) {
        const native = gl[name].bind(gl);
        gl[name] = (...args) => {
          p.draws++;
          return native(...args);
        };
      }
      p.collect = () => {
        if (!timer || !p.timerEnabled) return;
        const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
        for (let i = p.pending.length - 1; i >= 0; i--) {
          const item = p.pending[i];
          if (disjoint || gl.getQueryParameter(item.query, gl.QUERY_RESULT_AVAILABLE)) {
            if (!disjoint)
              append(p.gpu, {
                phase: item.phase,
                ms: gl.getQueryParameter(item.query, gl.QUERY_RESULT) / 1e6,
              });
            gl.deleteQuery(item.query);
            p.pending.splice(i, 1);
          }
        }
      };
      return gl;
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => {
        const started = performance.now(),
          count = p.draws,
          phase = p.phase;
        callback(time);
        if (p.draws > count) append(p.cpu, { phase, ms: performance.now() - started });
        p.collect?.();
      });
  });
  await page.route('**/src/lib/scene/runtime.ts*', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: instrumentRuntime(source, route.request().url()) });
  });
  await page.goto(origin);
  await page.getByRole('button', { name: /Explore example/ }).click();
  await page.getByText('Moment calculated', { exact: true }).waitFor();
  await page.waitForFunction(() => window.__m10.runtime?.getDiagnostics().drawCalls > 0);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(500);
  const driver = await page.evaluate(() => {
    const gl = window.__m10.gl,
      debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      viewport: [window.innerWidth, window.innerHeight],
      devicePixelRatio: window.devicePixelRatio,
      timerQuerySupported: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    };
  });
  console.log(JSON.stringify({ phase: 'initialized', driver }));
  const group = async (id) => {
    const item = page.locator(`details[data-control-group="${id}"]`);
    if (!(await item.evaluate((node) => node.open))) await item.locator(':scope > summary').click();
  };
  const phase = async (name) =>
    page.evaluate((name) => {
      window.__m10.setPhase(name);
    }, name);
  const diagnostics = async () =>
    page.evaluate(() => ({
      ...window.__m10.runtime.getDiagnostics(),
      cardNodes: document.querySelectorAll('[data-testid="hover-card"]').length,
      glintNodes: document.querySelectorAll('.glint').length,
      runningGlints: document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === 'running' &&
            animation.effect?.target?.classList?.contains('glint'),
        ).length,
    }));
  const revealCount = values.quick ? 8 : 36;
  await phase('card-reveal');
  for (let i = 0; i < revealCount; i++) {
    const title = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter'][i % 6],
      before = await page.evaluate(() => window.__m10.reveals.length);
    await page.evaluate((title) => {
      const button = [...document.querySelectorAll('.object-list button')].find(
        (node) => node.querySelector('span:nth-child(2)')?.textContent.trim() === title,
      );
      window.__m10.arm = { title, started: performance.now(), eligibleAt: null };
      button.focus();
    }, title);
    await page.waitForFunction((before) => window.__m10.reveals.length > before, before);
  }
  async function cameraWork(name, count) {
    await phase(name);
    return page.evaluate(async (count) => {
      const canvas = document.querySelector('.scene-canvas canvas'),
        intervals = [];
      let last = null;
      for (let i = 0; i < count; i++) {
        await new Promise((resolve) =>
          window.requestAnimationFrame((time) => {
            if (last !== null) intervals.push(time - last);
            last = time;
            canvas.dispatchEvent(
              new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
            );
            resolve();
          }),
        );
      }
      await new Promise((resolve) =>
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
      );
      window.__m10.setPhase('setup');
      return intervals;
    }, count);
  }
  async function pickingWork(name, count) {
    await phase(name);
    await page.evaluate(async (count) => {
      const canvas = document.querySelector('.scene-canvas canvas'),
        box = canvas.getBoundingClientRect();
      for (let i = 0; i < count; i++) {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        const col = i % 17,
          row = Math.floor(i / 17) % 11;
        canvas.dispatchEvent(
          new window.PointerEvent('pointermove', {
            clientX: box.x + box.width * (0.15 + (0.7 * col) / 16),
            clientY: box.y + box.height * (0.15 + (0.7 * row) / 10),
            pointerId: 1,
            pointerType: 'mouse',
            bubbles: true,
          }),
        );
      }
      canvas.dispatchEvent(new window.PointerEvent('pointerleave'));
      await new Promise((resolve) =>
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
      );
      window.__m10.setPhase('setup');
    }, count);
    console.log(
      JSON.stringify({
        phase: name,
        ...(await page.evaluate((name) => {
          const times = window.__m10.picking
            .filter((item) => item.phase === name)
            .map((item) => item.ms)
            .sort((a, b) => a - b);
          return {
            count: times.length,
            p95Ms: times[Math.min(times.length - 1, Math.floor(times.length * 0.95))],
            maxMs: times.at(-1),
          };
        }, name)),
      }),
    );
  }
  async function sparkleIdle(name) {
    await phase(name);
    await page.waitForTimeout(400);
    const before = await diagnostics();
    await page.waitForTimeout(values.quick ? 600 : 2000);
    const after = await diagnostics();
    await phase('setup');
    return {
      before,
      after,
      renderDelta: after.renderCount - before.renderCount,
      glintNodes: after.glintNodes,
      runningGlints: after.runningGlints,
    };
  }
  await group('display');
  await page.getByLabel('Motion preference', { exact: true }).selectOption('full');
  await page.getByLabel('Card sparkles', { exact: true }).selectOption('on');
  await group('aspects');
  await page.getByRole('button', { name: 'Earth overview', exact: true }).click();
  await page.locator('.aspect-pair-list button').first().focus();
  await page.locator('[data-testid="hover-card"][data-feature-kind="aspect"]').waitFor();
  const sparklesOn = await sparkleIdle('sparkles-on-idle');
  const sparkleOnInteraction = await cameraWork('sparkles-on-camera', values.quick ? 20 : 90);
  await page.getByLabel('Card sparkles', { exact: true }).selectOption('off');
  await page.getByRole('button', { name: 'Earth overview', exact: true }).click();
  await page.locator('.aspect-pair-list button').first().focus();
  await page.locator('[data-testid="hover-card"][data-feature-kind="aspect"]').waitFor();
  const sparklesOff = await sparkleIdle('sparkles-off-idle');
  const sparkleOffInteraction = await cameraWork('sparkles-off-camera', values.quick ? 20 : 90);
  await page.keyboard.press('Escape');
  await page.mouse.move(10, 10);
  await page.getByRole('button', { name: 'Earth overview', exact: true }).click();
  const earthCamera = await cameraWork('earth-default-camera', values.quick ? 20 : 90);
  await pickingWork('earth-all40-houses-picking', values.quick ? 40 : 204);
  await group('layers');
  await page.getByLabel('Constellation asterisms', { exact: true }).check();
  const figuresCamera = await cameraWork('earth-with-figures-camera', values.quick ? 20 : 90);
  await pickingWork('earth-with-figures-picking', values.quick ? 40 : 204);
  await page.getByRole('button', { name: 'Outside sphere', exact: true }).click();
  for (const label of [
    'Celestial equator',
    'Local meridian',
    'Prime vertical',
    'Constellation regions',
  ])
    await page.getByLabel(label, { exact: true }).check();
  await group('houses');
  await page.getByRole('radio', { name: 'Layered shells', exact: true }).check();
  await page.locator('.object-list').getByRole('button', { name: /^Moon/ }).click();
  await group('trails');
  await page.getByLabel('Trail window', { exact: true }).selectOption(String(3652.5 * 86400000));
  await page.getByLabel('Show selected body trail', { exact: true }).check();
  await page.waitForFunction(
    () =>
      /Trail ready|Limited trail interval/.test(
        document.querySelector('[aria-label="Trail sampling status"]')?.textContent ?? '',
      ),
    null,
    { timeout: 15000 },
  );
  const trailStatus = await page.getByLabel('Trail sampling status', { exact: true }).innerText();
  const denseCamera = await cameraWork('dense-sky-camera', values.quick ? 20 : 90);
  await pickingWork('dense-sky-picking', values.quick ? 40 : 204);
  const denseResources = await diagnostics();
  await page.getByLabel('Show selected body trail', { exact: true }).uncheck();
  await page.getByLabel('Step unit', { exact: true }).selectOption('hour');
  const resourcePasses = [];
  async function stepHour(direction) {
    const before = await page.getByTestId('displayed-utc-moment').innerText();
    await page.getByRole('button', { name: `${direction} hour`, exact: true }).click();
    await page.waitForFunction(
      (before) =>
        document.querySelector('[data-testid="displayed-utc-moment"]')?.textContent !== before &&
        document.querySelector('.app-status [role="status"]')?.textContent.trim() ===
          'Moment calculated',
      before,
    );
  }
  for (let pass = 0; pass < (values.quick ? 2 : 4); pass++) {
    await phase(`resource-pass-${pass}`);
    for (const view of ['Observer sky', 'Outside sphere', 'Earth overview'])
      await page.getByRole('button', { name: view, exact: true }).click();
    for (const state of [false, true]) {
      await page.getByLabel('Constellation asterisms', { exact: true }).setChecked(state);
      await page.getByLabel('Constellation regions', { exact: true }).setChecked(state);
    }
    for (const mode of ['Volumes / wedges', 'Boundary arcs', 'Layered shells'])
      await page.getByRole('radio', { name: mode, exact: true }).check();
    for (let i = 0; i < (values.quick ? 1 : 4); i++) await stepHour('Next');
    for (let i = 0; i < (values.quick ? 1 : 4); i++) await stepHour('Previous');
    await page.getByRole('button', { name: 'Earth overview', exact: true }).click();
    for (const name of ['Sun', 'Moon', 'Mars', 'Venus']) {
      await page
        .locator('.object-list')
        .getByRole('button', { name: new RegExp(`^${name}`) })
        .focus();
      await page.waitForTimeout(320);
    }
    await page.keyboard.press('Escape');
    await page.mouse.move(10, 10);
    await page.waitForTimeout(400);
    resourcePasses.push(await diagnostics());
  }
  // A date commit intentionally keeps the old default-overview pose. Recovery
  // must preserve it too, rather than reapplying a newly time-rotated view preset.
  await stepHour('Next');
  await phase('context-recovery');
  const recovery = await page.evaluate(async () => {
    const p = window.__m10,
      extension = p.gl.getExtension('WEBGL_lose_context'),
      before = p.runtime.getDiagnostics();
    if (!extension) return { supported: false, before };
    p.timerEnabled = false;
    for (const pending of p.pending) p.gl.deleteQuery(pending.query);
    p.pending = [];
    extension.loseContext();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const lost = p.runtime.getDiagnostics();
    extension.restoreContext();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const restored = p.runtime.getDiagnostics();
    return { supported: true, before, lost, restored, error: p.gl.getError() };
  });
  await phase('final-idle');
  await page.mouse.move(10, 10);
  await page.waitForTimeout(500);
  const finalBefore = await diagnostics();
  await page.waitForTimeout(800);
  const finalAfter = await diagnostics();
  await page.screenshot({ path: output.replace(/\.json$/, '') + '.png' });
  const data = await page.evaluate(() => {
    const p = window.__m10;
    return {
      picking: p.picking,
      cpu: p.cpu,
      gpu: p.gpu,
      longtasks: p.longtasks.map((task) => ({
        ...task,
        phase:
          [...p.phaseWindows].reverse().find((window) => window.startMs <= task.startMs)?.phase ??
          'startup',
      })),
      phaseWindows: p.phaseWindows,
      reveals: p.reveals,
      workerMessages: p.workerMessages,
      maxGlints: p.maxGlints,
      pendingGpuQueries: p.pending.length,
      longTaskObserverUnsupported: !!p.longTaskObserverUnsupported,
      glError: p.gl.getError(),
    };
  });
  const disposal = await page.evaluate(() => {
    const p = window.__m10;
    p.runtime.dispose();
    const result = p.runtime.getDiagnostics();
    p.runtime.zoom(1);
    p.runtime.focusSelection();
    p.runtime.returnToObserver();
    return { diagnostics: result, canvasRemoved: !document.querySelector('.scene-canvas canvas') };
  });
  const summarize = (samples) => {
    const sorted = [...samples].sort((a, b) => a - b);
    return {
      count: sorted.length,
      medianMs: sorted[Math.floor(sorted.length * 0.5)] ?? null,
      p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? null,
      maxMs: sorted.at(-1) ?? null,
    };
  };
  const byPhase = (items) =>
    Object.fromEntries(
      [...new Set(items.map((item) => item.phase))].map((phase) => [
        phase,
        summarize(items.filter((item) => item.phase === phase).map((item) => item.ms)),
      ]),
    );
  const afterHashes = await sourceHashes();
  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrl: origin,
    sourceGit,
    sourceHashMethod:
      'SHA-256 of UTF-8 sources with LF-normalized line endings; WASM hashes use exact binary bytes.',
    sourceTreeSha256: sha(JSON.stringify(beforeHashes)),
    sourceFileCount: sourcePaths.length,
    harnessSha256: sha(await readFile(new URL(import.meta.url))),
    sourceHashes: beforeHashes,
    sourceHashesAfter: afterHashes,
    sourceUnchanged: JSON.stringify(beforeHashes) === JSON.stringify(afterHashes),
    servedModules,
    hmrMessages,
    browserVersion: browser.version(),
    launchArgs,
    host: {
      platform: process.platform,
      osRelease: os.release(),
      cpu: os.cpus()[0]?.model,
      ramBytes: os.totalmem(),
    },
    driver,
    quick: values.quick,
    method: {
      picking:
        'Entire entityAt body including star raycast, Earth/house clipping, ordering and optional constellation background classification; test-only try/finally timing adds small overhead.',
      reveal:
        'Native object-button focus to existing300ms reveal timer; eligible time captured when that exact callback is scheduled; matching card DOM plus next rAF is UI-ready, not physical scanout.',
      cpu: 'rAF callback CPU duration only when that callback submits actual GL draw calls; includes scene hover/layout work.',
      gpu: 'Completed non-disjoint EXT_disjoint_timer_query_webgl2 query around renderer commands; excludes compositor/display.',
      input:
        'Synthetic pointermove and ArrowRight dispatched to the real canvas once per rAF; all geometry is the actual App scene.',
      resourcePasses:
        'Same final enabled layers/mode after each pass; pass0 warms lazy resources; next3 passes repeat hovers, views, dates, layer/mode switches.',
    },
    summary: {
      revealAfterEligibility: summarize(data.reveals.map((item) => item.afterEligibilityMs)),
      picking: byPhase(data.picking),
      cpu: byPhase(data.cpu),
      gpu: byPhase(data.gpu),
      deliveredRaf: Object.fromEntries(
        Object.entries({
          sparkleOnInteraction,
          sparkleOffInteraction,
          earthCamera,
          figuresCamera,
          denseCamera,
        }).map(([key, value]) => [key, summarize(value)]),
      ),
    },
    sparkles: { on: sparklesOn, off: sparklesOff },
    trailStatus,
    denseResources,
    resourcePasses,
    recovery,
    finalIdleRenderDelta: finalAfter.renderCount - finalBefore.renderCount,
    disposal,
    data,
    errors,
    limits: [
      'Source-development evidence; Vite/HMR may add noise. Exact served module and source file hashes bind results; dirtyGitHEAD is not an exact tested release.',
      'Measured hardware is recorded; an RTX desktop does not validate integrated-laptop performance.',
      'UI-ready rAF, CPU submission and GPU elapsed intervals are separate quantities; none establishes physical display presentation.',
      'Synthetic input uses real App handlers but excludes OS input delivery latency.',
    ],
  };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  // Review images run after every timing/resource/recovery measurement, in
  // separate contexts without the test timing wrappers.
  const visuals=[];
  for(const viewport of [{width:1440,height:900},{width:1024,height:768}]){
    const visual=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
    try{
      await visual.goto(origin);await visual.getByRole('button',{name:/Explore example/}).click();await visual.getByText('Moment calculated',{exact:true}).waitFor();
      const aspects=visual.locator('details[data-control-group="aspects"]');await aspects.locator(':scope > summary').click();
      await visual.locator('.aspect-pair-list button').first().click();
      for(const [id,name] of [['earth','Earth overview'],['outside','Outside sphere']]){
        await visual.getByRole('button',{name,exact:true}).click();await visual.locator('.aspect-pair-list button').first().hover();
        await visual.locator('[data-testid="hover-card"][data-feature-kind="aspect"]').waitFor();await visual.waitForTimeout(250);
        const path=output.replace(/\.json$/,'')+`-${viewport.width}-${id}.png`;
        await visual.screenshot({path});
        const metadata=await visual.evaluate(()=>{const box=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {card:box(document.querySelector('[data-testid="hover-card"]')),title:document.querySelector('[data-testid="hover-card"] h2')?.textContent,panels:[...document.querySelectorAll('#explorer-dock,#inspector')].map(element=>({id:element.id,inert:element.inert,box:box(element)}))};});
        visuals.push({viewport,view:id,path,...metadata});
      }
    }finally{await visual.close();}
  }
  report.visuals=visuals;
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      output,
      browserVersion: report.browserVersion,
      driver,
      sourceUnchanged: report.sourceUnchanged,
      summary: report.summary,
      resources: resourcePasses.map(({ geometries, textures, programs }) => ({
        geometries,
        textures,
        programs,
      })),
      sparkleIdle: [sparklesOn.renderDelta, sparklesOff.renderDelta],
      finalIdle: report.finalIdleRenderDelta,
      errors,
    }),
  );
} finally {
  await browser.close();
}
