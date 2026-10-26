import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { openControlGroup } from './helpers';
import { captureSceneFrame, installSceneFrameCapture, sceneDrawCount } from './scene-frame';

test('63 system, house display and viewpoint combinations retain the same sky', async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await installSceneFrameCapture(page);
  await page.goto('/'); await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
  await openControlGroup(page, 'houses');
  await openControlGroup(page, 'view');
  await page.getByLabel('Show contextual fill', { exact: true }).check();
  await page.locator('.object-list').getByRole('button', { name: /^Moon/ }).click();
  const coordinates = (await page.locator('#inspector .data-list').first().locator('dd').allTextContents()).slice(0, 2);
  const moment = await page.locator('.context-details > span > strong').innerText();
  const observer = await page.locator('.context-location').innerText();
  const entries: { system: string; mode: string; viewpoint: string; draws: number; frameSha256: string; compositorSha256: string; uniqueColours: number; nonBackgroundSamples: number }[] = [];
  const canvas = page.locator('.scene-canvas canvas');
  const graphics = await canvas.evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2')!, debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) as string, vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR) as string, devicePixelRatio: window.devicePixelRatio };
  });
  for (const system of ['W', 'E', 'O', 'P', 'K', 'R', 'C']) {
    await page.getByLabel('House system', { exact: true }).selectOption(system);
    await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
    await openControlGroup(page, 'houses');
    await page.locator('.object-list').getByRole('button', { name: /^Moon/ }).click();
    for (const mode of ['Volumes / wedges', 'Boundary arcs', 'Layered shells']) {
      await page.getByRole('radio', { name: mode, exact: true }).check();
      for (const viewpoint of ['Earth overview', 'Observer sky', 'Outside sphere']) {
        const before = await sceneDrawCount(page);
        await page.getByRole('button', { name: viewpoint, exact: true }).click();
        // The first button may already be active. A focused-canvas key produces
        // a real draw in every case and exercises the viewpoint's keyboard route.
        await canvas.focus(); await page.keyboard.press('ArrowRight');
        await expect.poll(() => sceneDrawCount(page)).toBeGreaterThan(before);
        expect((await page.locator('#inspector .data-list').first().locator('dd').allTextContents()).slice(0, 2)).toEqual(coordinates);
        expect(await page.locator('.context-details > span > strong').innerText()).toBe(moment);
        expect(await page.locator('.context-location').innerText()).toBe(observer);
        const glError = await canvas.evaluate(async element => {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return (element as HTMLCanvasElement).getContext('webgl2')!.getError();
        });
        expect(glError).toBe(0);
        const frame = await captureSceneFrame(page), compositor = await canvas.screenshot();
        expect(frame.uniqueColours, `${system}/${mode}/${viewpoint}: nonblank saved frame`).toBeGreaterThan(8);
        expect(frame.nonBackgroundSamples, `${system}/${mode}/${viewpoint}: actual sky pixels`).toBeGreaterThan(4);
        if (process.env.MATRIX_SCREENSHOTS === '1') {
          const name = `${system}-${mode.replaceAll(/[^a-z]/gi, '-')}-${viewpoint.replaceAll(' ', '-')}`;
          await testInfo.attach(`frame-${name}`, { body: frame.png, contentType: 'image/png' });
          if (system === 'W' && viewpoint === 'Outside sphere') await testInfo.attach(`compositor-${name}`, { body: compositor, contentType: 'image/png' });
        }
        entries.push({ system, mode, viewpoint, draws: await sceneDrawCount(page) - before, frameSha256: createHash('sha256').update(frame.png).digest('hex'), compositorSha256: createHash('sha256').update(compositor).digest('hex'), uniqueColours: frame.uniqueColours, nonBackgroundSamples: frame.nonBackgroundSamples });
      }
    }
  }
  await testInfo.attach('63-view-matrix', { body: JSON.stringify({ browser: testInfo.project.name, browserVersion: browser.version(), graphics, viewport: testInfo.project.use.viewport, captureMethod: 'canvas.toDataURL synchronously after actual render, before the native requestAnimationFrame callback returns; decoded PNG pixels checked', entries }, null, 2), contentType: 'application/json' });
  expect(entries).toHaveLength(63);
  for (const system of ['W', 'E', 'O', 'P', 'K', 'R', 'C']) {
    const outside = entries.filter(entry => entry.system === system && entry.viewpoint === 'Outside sphere');
    expect(new Set(outside.map(entry => entry.frameSha256)).size, `${system}: three actual house presentations`).toBe(3);
  }
  expect(errors).toEqual([]);
});
