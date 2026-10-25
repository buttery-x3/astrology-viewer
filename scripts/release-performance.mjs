import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { artifactIdentity, validateArtifactOrigin } from './cold-load-performance.mjs';

const { values } = parseArgs({ options: {
  url: { type: 'string', default: 'http://127.0.0.1:8080' },
  output: { type: 'string', default: '.cache/release-performance/report.json' },
  hardware: { type: 'boolean', default: false },
} });
const origin = validateArtifactOrigin(values.url);
const artifact = await artifactIdentity(origin);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.cache/playwright');
const { chromium } = await import('playwright');
const args = values.hardware ? process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--disable-software-rasterizer'] : ['--enable-gpu', '--disable-software-rasterizer'] : [];
const browser = await chromium.launch({ headless: true, args });
const output = resolve(values.output); await mkdir(dirname(output), { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin); await page.getByRole('button', { name: /Explore example/ }).click();
  await page.getByText('Moment calculated', { exact: true }).waitFor();
  const glDriver = await page.locator('.scene-canvas canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER), vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR), viewport: [window.innerWidth, window.innerHeight], devicePixelRatio: window.devicePixelRatio };
  });
  // Start and stop entirely inside the page, excluding Playwright protocol
  // latency. The completion frame is UI-ready, not physical scanout timing.
  const selection = [];
  for (let index = 0; index < 30; index++) selection.push(await page.evaluate(name => new Promise((resolve, reject) => {
    const button = Array.from(document.querySelectorAll('.object-list button')).find(item => item.querySelector('span:nth-child(2)')?.textContent.trim() === name);
    const started = performance.now();
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error('Selection feedback timed out.')); }, 5000);
    const check = () => {
      if (document.querySelector('#inspector h2')?.textContent.trim() !== name) return;
      observer.disconnect(); window.requestAnimationFrame(() => { clearTimeout(timeout); resolve(performance.now() - started); });
    };
    const observer = new window.MutationObserver(check); observer.observe(document.querySelector('#inspector'), { childList: true, subtree: true, characterData: true });
    button.click(); check();
  }), index % 2 ? 'Moon' : 'Sun'));
  await page.getByLabel('Step unit', { exact: true }).selectOption('hour');
  const warmChart = [];
  for (let index = 0; index < 30; index++) warmChart.push(await page.evaluate(() => new Promise((resolve, reject) => {
    const before = document.querySelector('.context-details > span > strong').textContent;
    const button = document.querySelector('button[aria-label="Next hour"]');
    const started = performance.now();
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error('Chart update timed out.')); }, 5000);
    const check = () => {
      const complete = document.querySelector('.app-status [role="status"]')?.textContent.trim() === 'Moment calculated';
      if (!complete || document.querySelector('.context-details > span > strong').textContent === before) return;
      observer.disconnect(); window.requestAnimationFrame(() => { clearTimeout(timeout); resolve(performance.now() - started); });
    };
    const observer = new window.MutationObserver(check); observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    button.click(); check();
  })));
  const group = page.locator('details[data-control-group="trails"]');
  if (!await group.evaluate(item => item.open)) await group.locator(':scope > summary').click();
  await page.locator('.object-list').getByRole('button', { name: /^Moon/ }).click();
  const trail = await page.evaluate(() => new Promise((resolve, reject) => {
    const label = Array.from(document.querySelectorAll('label')).find(item => item.textContent.trim() === 'Show selected body trail');
    const input = label.querySelector('input'), started = performance.now(); let feedbackMs = null;
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error('Trail feedback timed out.')); }, 10000);
    const check = () => {
      const status = document.querySelector('[aria-label="Trail sampling status"]');
      if (status && feedbackMs === null) feedbackMs = performance.now() - started;
      const points = status?.querySelector('.sampling-data dd')?.textContent;
      if (!points || Number(points.replaceAll(',', '')) < 2) return;
      observer.disconnect(); window.requestAnimationFrame(() => { clearTimeout(timeout); resolve({ feedbackMs, firstUsableMs: performance.now() - started, status: status.textContent, points }); });
    };
    const observer = new window.MutationObserver(check); observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    input.click(); check();
  }));
  const summarize = samples => { const sorted = samples.slice().sort((a,b) => a-b); return { count: sorted.length, medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))], maxMs: sorted.at(-1), samples }; };
  const report = { generatedAt: new Date().toISOString(), url: origin, artifact, browserVersion: browser.version(), launchArgs: args, driver: glDriver, selection: summarize(selection), warmChart: summarize(warmChart), trail, errors, method: 'Page-local button activation to matching committed UI plus next requestAnimationFrame. Warm chart includes worker, Svelte and scene scheduling. No network/Playwright protocol in measured interval. UI-ready callback does not establish physical display presentation. Default example, one-day Moon trail.' };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally { await browser.close(); }
