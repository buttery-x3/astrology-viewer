import path from 'node:path';
import { mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';

const args = new Set(process.argv.slice(2));
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceStatus = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim();
const sourcePaths = ['src/App.svelte', 'src/app.css', 'src/lib/ui/HoverCard.svelte', 'src/lib/ui/FeaturePreview.svelte', 'src/lib/ui/AspectControls.svelte', 'src/lib/domain/hover-card.ts', 'src/lib/domain/hover-preview.ts', 'src/lib/domain/hover-card-themes.ts', 'src/lib/content/data/catalogue.json', 'src/lib/content/data/supplemental-claims.json'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, hash(await readFile(file))])));
const parent = path.resolve(process.env.NATIVE_ZOOM_OUTPUT_ROOT ?? '.cache/m10-native-zoom-rectified');
await mkdir(parent, { recursive: true });
const expectedRevisionArg = [...args].find(arg => arg.startsWith('--expected-revision='));
const expectedRevision = expectedRevisionArg?.slice('--expected-revision='.length);
const nativeCase = [...args].find(arg => arg.startsWith('--native-case='))?.slice('--native-case='.length);
if (nativeCase && !['1024x768-large-earth', '1024x768-large'].includes(nativeCase)) throw new Error('Only the explicit 1024x768-large-earth or 1024x768-large focused native cases are supported.');
const expectedStates = nativeCase === '1024x768-large-earth' ? 1 : nativeCase ? 2 : 8;
if (expectedRevision && sourceRevision !== expectedRevision) throw new Error(`Expected source ${expectedRevision}, found ${sourceRevision}; no browser was launched.`);

if (!args.has('--run-after-gpu-clearance')) {
  const prepared = { status: 'PREPARED_ONLY_NO_BROWSER_LAUNCHED', preparedAt: new Date().toISOString(), sourceRevision, sourceStatus, sourceFiles, nativeWindows: [{ width: 1440, height: 900 }, { width: 1024, height: 768 }], pageZoom: 'Actual Chrome Appearance / Page zoom / 200%', views: ['Earth overview', 'Outside sphere'], textSizes: ['standard', 'large'], previewTargets: ['Sun body', 'Sun sextile Moon', 'Venus AC geographic line'], checks: ['DPR doubles with fixed outer window', 'full registered prose remains visible', 'no card/wrapper scroll or clipping', 'no measurement/time/role footer or F2 tab stop', 'hover text can be selected', 'keyboard origin retains focus and aria-describedby', 'Escape dismisses without reopening', 'compact header/reflow/Inspector fit'], launchInstruction: 'Wait for the root task to confirm the GPU window, then run node .cache/m10-native-zoom.mjs --run-after-gpu-clearance --expected-revision=<full approved revision>' };
  await writeFile(path.join(parent, 'preparation.json'), JSON.stringify(prepared, null, 2));
  console.log(JSON.stringify(prepared, null, 2));
  process.exit(0);
}
if (sourceStatus) throw new Error(`Native final validation requires a clean recorded source revision; found ${sourceStatus}. No browser was launched.`);

const runId = `${sourceRevision.slice(0, 8)}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const dir = path.join(parent, runId);
await mkdir(dir, { recursive: true });
const profile = path.join(dir, 'owned-native-chrome-profile');
const catalogue = JSON.parse(await readFile('src/lib/content/data/catalogue.json', 'utf8'));
const supplemental = JSON.parse(await readFile('src/lib/content/data/supplemental-claims.json', 'utf8'));
const claims = new Map([...catalogue.flatMap(entry => entry.claims.map((claim, index) => [entry.existingClaimId ?? `${entry.id}:${index}`, claim.text])), ...supplemental.map(claim => [claim.id, claim.text])]);
const report = { startedAt: new Date().toISOString(), sourceRevision, sourceStatus, sourceFiles, nativeCase: nativeCase ?? 'full-eight-state-matrix', baseURL: process.env.NATIVE_ZOOM_BASE_URL ?? 'http://127.0.0.1:5196/', contract: 'M10 rectified compact previews: complete unchanged prose, no scrolling or clipping', browser: { channel: 'chrome', headless: false, viewport: null, profile }, method: 'Actual chrome://settings/appearance Page zoom combobox selectOption(label=200%); CDP Browser window bounds only; no emulated viewport, device scale, CSS zoom or pinch zoom.', cases: [], screenshots: [], errors: [], cleanup: [] };
let context;
async function save() { await writeFile(path.join(dir, 'native-zoom-report.json'), JSON.stringify(report, null, 2)); }
async function captureScreen(page, filename) {
  const session = await context.newCDPSession(page);
  try {
    const result = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const bytes = Buffer.from(result.data, 'base64');
    await writeFile(path.join(dir, filename), bytes);
    report.screenshots.push({ file: filename, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: hash(bytes) });
  } finally { await session.detach(); }
}
async function metrics(page) {
  return page.evaluate(() => ({ dpr: devicePixelRatio, innerWidth, innerHeight, outerWidth, outerHeight, visualViewportScale: visualViewport?.scale, visualViewportWidth: visualViewport?.width, visualViewportHeight: visualViewport?.height, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight, rootFont: getComputedStyle(document.documentElement).fontSize, compact: matchMedia('(max-width: 1000px)').matches, buildText: document.querySelector('.app-status')?.textContent }));
}
async function clearPreview(page) {
  if (await page.getByTestId('hover-card').count()) { await page.keyboard.press('Escape'); await expect(page.getByTestId('hover-card')).toHaveCount(0); }
  await page.mouse.move(5, 5);
}
async function ensureExplore(page) {
  await clearPreview(page);
  const toggle = page.locator('.left-toggle');
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(page.locator('#explorer-dock')).toBeVisible();
}
async function group(page, id, open = true) {
  const element = page.locator(`details[data-control-group="${id}"]`);
  if (await element.evaluate(e => e.open) !== open) await element.locator(':scope > summary').click();
}
async function setView(page, label) {
  await ensureExplore(page); await group(page, 'view');
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await group(page, 'view', false); await clearPreview(page);
}
async function setText(page, value) {
  await ensureExplore(page); await group(page, 'display');
  await page.getByLabel('Interface text size', { exact: true }).selectOption(value);
  await group(page, 'display', false);
}
async function cardStats(page) {
  return page.getByTestId('hover-card').evaluate(element => {
    const wrapper = element.closest('[data-feature-preview]');
    const bounds = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const r = bounds(element), w = bounds(wrapper), tolerance = 1;
    const withinViewport = b => b.x >= -tolerance && b.y >= -tolerance && b.right <= innerWidth + tolerance && b.bottom <= innerHeight + tolerance;
    const surface = e => { const style = getComputedStyle(e); return { bounds: bounds(e), clientHeight: e.clientHeight, scrollHeight: e.scrollHeight, clientWidth: e.clientWidth, scrollWidth: e.scrollWidth, scrollTop: e.scrollTop, overflowX: style.overflowX, overflowY: style.overflowY, contentFits: e.scrollHeight <= e.clientHeight + tolerance && e.scrollWidth <= e.clientWidth + tolerance, noScrollOrClipStyle: !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX) && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY) }; };
    const paragraphs = [...element.querySelectorAll('[data-claim-id]')].map(p => {
      const rectangles = [...p.getClientRects()].map(rect => ({ x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }));
      const clipAncestors = []; let ancestor = p.parentElement;
      while (ancestor) {
        const s = getComputedStyle(ancestor);
        if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX) || ['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowY)) clipAncestors.push({ className: ancestor.className, overflowX: s.overflowX, overflowY: s.overflowY });
        if (ancestor === wrapper) break; ancestor = ancestor.parentElement;
      }
      return { claimId: p.dataset.claimId, sectionId: p.closest('[data-claim-section]')?.dataset.claimSection, role: p.dataset.claimRole, text: p.textContent, font: getComputedStyle(p).fontSize, display: getComputedStyle(p).display, visibility: getComputedStyle(p).visibility, rectangles, allTextWithinCardAndViewport: rectangles.length > 0 && rectangles.every(b => withinViewport(b) && b.x >= r.x - tolerance && b.y >= r.y - tolerance && b.right <= r.right + tolerance && b.bottom <= r.bottom + tolerance), clipAncestors };
    });
    const text = element.textContent;
    return { kind: element.dataset.featureKind, aspectType: element.dataset.aspectType, theme: element.dataset.theme, bounds: r, wrapperBounds: w, viewport: { width: innerWidth, height: innerHeight, visualWidth: visualViewport?.width, visualHeight: visualViewport?.height }, fitsViewport: withinViewport(r) && withinViewport(w), card: surface(element), wrapper: surface(wrapper), paragraphs, sections: [...element.querySelectorAll('section[data-claim-section]')].map(section => section.dataset.claimSection), noHiddenText: paragraphs.every(p => p.allTextWithinCardAndViewport && p.clipAncestors.length === 0 && p.display !== 'none' && p.visibility === 'visible'), noTechnicalFooter: !element.querySelector('.measurements') && !/Actual sky angle|Longitude separation|Configured orb|Displayed moment|Feature role|Aspect symbol caption|F2:/.test(text), noScrollFocusControl: !element.hasAttribute('tabindex') && !element.hasAttribute('aria-keyshortcuts'), selectable: getComputedStyle(element).userSelect !== 'none', notices: [...element.querySelectorAll('.context-notices span')].map(e => e.textContent), text };
  });
}
function completeRegisteredText(stats) {
  return stats.paragraphs.length > 0 && stats.paragraphs.every(p => claims.has(p.claimId) && claims.get(p.claimId) === p.text);
}
function fitsComplete(stats) {
  return stats.fitsViewport && stats.card.contentFits && stats.wrapper.contentFits && stats.card.noScrollOrClipStyle && stats.wrapper.noScrollOrClipStyle && stats.noHiddenText && stats.noTechnicalFooter && stats.noScrollFocusControl && stats.selectable && completeRegisteredText(stats);
}
async function capturePreview(page, target, kind, slug) {
  await clearPreview(page); await target.hover();
  const card = page.getByTestId('hover-card');
  await expect(card).toHaveAttribute('data-feature-kind', kind); await page.waitForTimeout(250);
  const hover = await cardStats(page);
  const hoverImage = `${slug}-hover.png`; await captureScreen(page, hoverImage);
  await card.hover(); await page.waitForTimeout(350);
  const pointerRetained = await cardStats(page);
  const textSelection = await card.evaluate(element => { const paragraph = element.querySelector('[data-claim-id]'), range = document.createRange(); range.selectNodeContents(paragraph); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); const result = { selectedText: selection.toString(), paragraphText: paragraph.textContent }; selection.removeAllRanges(); return result; });
  await clearPreview(page); await page.locator('.left-toggle').focus();
  const originalDescription = await target.getAttribute('aria-describedby');
  await target.focus(); await expect(card).toHaveAttribute('data-feature-kind', kind); await page.waitForTimeout(250);
  await expect(target).toBeFocused(); await expect(target).toHaveAttribute('aria-describedby', /feature-preview-card/);
  const keyboard = await cardStats(page);
  const keyboardImage = `${slug}-keyboard.png`; await captureScreen(page, keyboardImage);
  await page.keyboard.press('Escape'); await expect(card).toHaveCount(0); await expect(target).toBeFocused();
  const restoredDescription = await target.getAttribute('aria-describedby');
  await page.waitForTimeout(400); const staysClosed = await card.count() === 0;
  const sectionsCorrect = kind === 'body' ? hover.sections.includes('body:sun') && hover.sections.includes('body-in-sign:sun:capricorn') && hover.sections.some(id => id.startsWith('body-in-house:sun:')) : kind === 'aspect' ? hover.sections.includes('aspect-type:sextile') && hover.sections.includes('body-in-sign:sun:capricorn') && hover.sections.includes('body-in-sign:moon:scorpio') : hover.sections.includes('astro:body:venus') && hover.sections.includes('astro:angle:ac') && !hover.sections.includes('astro:overview');
  const result = { kind, hover, pointerRetained, keyboard, sameFeatureRetained: hover.text === pointerRetained.text && hover.text === keyboard.text, registeredProseUnchanged: [hover, pointerRetained, keyboard].every(completeRegisteredText), completeFits: [hover, pointerRetained, keyboard].every(fitsComplete), sectionsCorrect, textSelectionWorks: textSelection.selectedText === textSelection.paragraphText && textSelection.selectedText.length > 0, originalDescription, restoredDescription, descriptionRestored: restoredDescription === originalDescription, originStillFocused: await target.evaluate(e => document.activeElement === e), staysClosed, images: [hoverImage, keyboardImage] };
  result.passed = result.completeFits && result.sameFeatureRetained && result.sectionsCorrect && result.textSelectionWorks && result.descriptionRestored && result.originStillFocused && result.staysClosed;
  return result;
}
async function captureCards(page, slug) {
  const results = {};
  await ensureExplore(page);
  results.body = await capturePreview(page, page.locator('.object-list [data-feature-id="body:sun"]'), 'body', `${slug}-body`);
  await ensureExplore(page); await group(page, 'aspects');
  const strands = page.getByLabel('Show aspect strands', { exact: true });
  const originallyEnabled = await strands.isChecked();
  if (!originallyEnabled) await strands.check();
  try { results.aspect = await capturePreview(page, page.getByRole('button', { name: 'Inspect Sun sextile Moon', exact: true }), 'aspect', `${slug}-aspect`); }
  finally { await clearPreview(page); if (!originallyEnabled) await strands.uncheck(); }
  results.aspect.strandsEnabledForControlPreview = !originallyEnabled;
  await group(page, 'aspects', false);
  await ensureExplore(page); await group(page, 'references');
  await page.getByLabel('Feature category', { exact: true }).selectOption('astro');
  await page.getByLabel('Search additional features', { exact: true }).fill('Venus AC');
  results.geographic = await capturePreview(page, page.locator('.feature-navigation [data-feature-id="astro:venus:ac"]'), 'astro-line', `${slug}-geographic`);
  await page.getByLabel('Search additional features', { exact: true }).fill('');
  await group(page, 'references', false);
  return results;
}
async function compactLayout(page, slug) {
  await page.evaluate(() => scrollTo(0, 0));
  const result = await page.evaluate(() => {
    const width = visualViewport?.width ?? innerWidth;
    const bounds = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, text: e.textContent }; };
    const header = document.querySelector('.context-bar'), children = [...header.children].filter(e => getComputedStyle(e).display !== 'none').map(e => ({ className: e.className, ...bounds(e) }));
    const overlaps = [];
    for (let i = 0; i < children.length; i++) for (let j = i + 1; j < children.length; j++) { const a = children[i], b = children[j]; if (Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1) overlaps.push([i, j]); }
    const toggle = bounds(document.querySelector('.right-toggle'));
    return { viewport: { width: innerWidth, height: innerHeight, visualWidth: width }, documentWidth: document.documentElement.scrollWidth, noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth, header: bounds(header), headerChildren: children, headerChildrenWithinViewport: children.every(r => r.x >= -1 && r.right <= width + 1), headerOverlaps: overlaps, inspectorToggle: toggle, inspectorToggleWithinViewport: toggle.x >= 0 && toggle.right <= width + 1 };
  });
  await page.locator('.right-toggle').click(); await expect(page.locator('#inspector')).toBeVisible();
  result.openInspector = await page.locator('#inspector').evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.x, width: r.width, right: r.right, viewportWidth: innerWidth, fitsHorizontally: r.x >= 0 && r.right <= innerWidth + 1 }; });
  result.inspectorImage = `${slug}-inspector.png`; await captureScreen(page, result.inspectorImage);
  await page.getByRole('button', { name: 'Collapse inspector', exact: true }).click(); await expect(page.locator('#inspector')).not.toBeVisible();
  result.passed = result.noHorizontalOverflow && result.headerChildrenWithinViewport && result.headerOverlaps.length === 0 && result.inspectorToggleWithinViewport && result.openInspector.fitsHorizontally;
  return result;
}
async function verifyServedSource() {
  report.servedSource = {};
  for (const file of sourcePaths.filter(file => !file.includes('/content/data/'))) {
    const response = await context.request.get(`${report.baseURL}${file}?raw`), source = await response.text();
    const firstLine = source.split('\n')[0].replace(/;\s*$/, '');
    let servedHash = null;
    if (firstLine.startsWith('export default ')) { try { servedHash = hash(JSON.parse(firstLine.slice('export default '.length))); } catch { /* Keep the raw response for review. */ } }
    const filename = `served-${file.replaceAll('/', '_')}.txt`; await writeFile(path.join(dir, filename), source);
    report.servedSource[file] = { status: response.status(), responseSHA256: hash(source), decodedSourceSHA256: servedHash, matchesDisk: servedHash === sourceFiles[file], file: filename };
  }
}
try {
  context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: false, viewport: null, args: ['--window-size=1440,900', '--window-position=0,0', '--no-first-run', '--no-default-browser-check'] });
  report.browser.version = context.browser()?.version(); console.log('NATIVE_CHROME_STARTED', report.browser.version, dir);
  const page = context.pages()[0] ?? await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  report.navigations = [];
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) report.navigations.push({ at: new Date().toISOString(), url: frame.url() }); });
  await verifyServedSource();
  const cdp = await context.newCDPSession(page), { windowId } = await cdp.send('Browser.getWindowForTarget');
  const settings = await context.newPage(); await settings.goto('chrome://settings/appearance');
  const zoom = settings.getByRole('combobox', { name: 'Page zoom', exact: true }); await expect(zoom).toBeVisible();
  report.zoomControl = { initialValue: await zoom.inputValue(), options: await zoom.locator('option').allTextContents() };
  for (const size of (nativeCase ? [{ width: 1024, height: 768 }] : [{ width: 1440, height: 900 }, { width: 1024, height: 768 }])) {
    const entry = { targetNativeWindow: size, states: [] }; report.cases.push(entry);
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: 0, top: 0, width: size.width, height: size.height } });
    await settings.bringToFront(); await zoom.selectOption({ label: '100%' });
    await page.goto(report.baseURL); await page.bringToFront();
    const explore = page.getByRole('button', { name: /Explore example/ }); if (await explore.isVisible()) await explore.click();
    await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible({ timeout: 30000 });
    entry.before = await metrics(page); entry.nativeBoundsBefore = await cdp.send('Browser.getWindowBounds', { windowId });
    await settings.bringToFront(); await zoom.selectOption({ label: '200%' }); await expect(zoom).toHaveValue('2');
    entry.zoomSettingsImage = `settings-200-${size.width}.png`; await zoom.scrollIntoViewIfNeeded(); await captureScreen(settings, entry.zoomSettingsImage);
    await page.bringToFront(); await page.reload(); await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible({ timeout: 30000 });
    if (await explore.isVisible()) await explore.click();
    await expect.poll(async () => (await metrics(page)).dpr / entry.before.dpr).toBe(2);
    entry.after = await metrics(page); entry.zoomRatio = entry.after.dpr / entry.before.dpr; entry.widthRatio = entry.before.innerWidth / entry.after.innerWidth; entry.nativeBoundsAfter = await cdp.send('Browser.getWindowBounds', { windowId });
    console.log('REAL_ZOOM_ESTABLISHED', JSON.stringify({ size, ratio: entry.zoomRatio, widthRatio: entry.widthRatio, before: entry.before, after: entry.after }));
    for (const textSize of (nativeCase ? ['large'] : ['standard', 'large'])) {
      await setText(page, textSize);
      for (const [view, label] of (nativeCase === '1024x768-large-earth' ? [['earth', 'Earth overview']] : [['earth', 'Earth overview'], ['outside', 'Outside sphere']])) {
        await setView(page, label);
        const slug = `${size.width}x${size.height}-200-${textSize}-${view}`;
        const state = { textSize, view, metrics: await metrics(page) }; entry.states.push(state);
        state.cards = await captureCards(page, slug);
        await clearPreview(page); await page.getByRole('button', { name: 'Collapse explorer panel', exact: true }).click(); await expect(page.locator('#explorer-dock')).not.toBeVisible();
        await page.evaluate(() => scrollTo(0, 0)); state.sceneImage = `${slug}-scene.png`; await captureScreen(page, state.sceneImage);
        state.compactLayout = await compactLayout(page, slug);
        state.passed = Object.values(state.cards).every(card => card.passed) && state.compactLayout.passed;
        console.log('CAPTURED_COMPACT_STATE', slug, JSON.stringify({ passed: state.passed, cards: Object.fromEntries(Object.entries(state.cards).map(([key, value]) => [key, { passed: value.passed, bounds: value.hover.bounds, font: value.hover.paragraphs[0]?.font }])), reflow: state.compactLayout.passed }));
        await save();
      }
    }
  }
  report.finalSourceFiles = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, hash(await readFile(file))])));
  report.finalSourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  report.sourceRevisionChanged = sourceRevision !== report.finalSourceRevision;
  report.sourceUnchanged = Object.entries(sourceFiles).every(([file, value]) => report.finalSourceFiles[file] === value);
  report.summary = { native200Proven: report.cases.every(c => c.zoomRatio === 2 && c.widthRatio === 2 && c.before.outerWidth === c.after.outerWidth && c.before.outerHeight === c.after.outerHeight && c.after.visualViewportScale === 1), stateCount: report.cases.reduce((n, c) => n + c.states.length, 0), expectedStates, allExpectedStatesPass: report.cases.reduce((n, c) => n + c.states.length, 0) === expectedStates && report.cases.every(c => c.states.every(state => state.passed)), servedSourceMatches: Object.values(report.servedSource).every(source => source.matchesDisk), sourceUnchanged: report.sourceUnchanged, pageErrors: report.errors.length };
  report.summary.allEightStatesPass = !nativeCase && report.summary.allExpectedStatesPass;
  report.summary.passed = report.summary.native200Proven && report.summary.allExpectedStatesPass && report.summary.servedSourceMatches && report.summary.sourceUnchanged && report.errors.length === 0;
  if (!report.summary.passed) process.exitCode = 1;
  report.completedAt = new Date().toISOString();
} catch (error) { report.failure = { message: error.message, stack: error.stack }; console.error('VALIDATION_FAILURE', error.message); process.exitCode = 1; }
finally {
  if (context) { await context.close(); report.browser.closed = true; console.log('NATIVE_CHROME_CLOSED'); }
  try {
    const actualParent = await realpath(dir), actualProfile = await realpath(profile);
    if (path.dirname(actualProfile) !== actualParent || path.basename(actualProfile) !== 'owned-native-chrome-profile') throw new Error('Owned profile cleanup containment failed');
    await rm(actualProfile, { recursive: true, force: true }); report.cleanup.push({ path: actualProfile, removed: true });
  } catch (error) { report.cleanup.push({ path: profile, ...(error.code === 'ENOENT' ? { alreadyAbsent: true } : { error: error.message }) }); }
  await save(); console.log('REPORT', path.join(dir, 'native-zoom-report.json')); if (report.summary) console.log('SUMMARY', JSON.stringify(report.summary));
}
