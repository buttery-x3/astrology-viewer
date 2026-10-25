import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { openControlGroup } from './helpers';

test('63 system, house display and viewpoint combinations retain the same sky', async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Count actual GPU submissions without exposing a production debug endpoint.
  await page.addInitScript(() => {
    const probe = { draws: 0 };
    (window as unknown as { matrixProbe: typeof probe }).matrixProbe = probe;
    for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
      const original = WebGL2RenderingContext.prototype[method];
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
          probe.draws++;
          return Reflect.apply(original, this, args);
        }, configurable: true, writable: true,
      });
    }
  });
  await page.goto('/'); await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
  await openControlGroup(page, 'houses');
  await openControlGroup(page, 'view');
  await page.getByLabel('Show contextual fill', { exact: true }).check();
  await page.locator('.object-list').getByRole('button', { name: /^Moon/ }).click();
  const coordinates = (await page.locator('#inspector .data-list').first().locator('dd').allTextContents()).slice(0, 2);
  const moment = await page.locator('.context-details > span > strong').innerText();
  const observer = await page.locator('.context-location').innerText();
  const entries: { system: string; mode: string; viewpoint: string; draws: number; screenshotSha256: string }[] = [];
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
        const before = await page.evaluate(() => (window as unknown as { matrixProbe: { draws: number } }).matrixProbe.draws);
        await page.getByRole('button', { name: viewpoint, exact: true }).click();
        // The first button may already be active. A focused-canvas key produces
        // a real draw in every case and exercises the viewpoint's keyboard route.
        await canvas.focus(); await page.keyboard.press('ArrowRight');
        await expect.poll(() => page.evaluate(() => (window as unknown as { matrixProbe: { draws: number } }).matrixProbe.draws)).toBeGreaterThan(before);
        expect((await page.locator('#inspector .data-list').first().locator('dd').allTextContents()).slice(0, 2)).toEqual(coordinates);
        expect(await page.locator('.context-details > span > strong').innerText()).toBe(moment);
        expect(await page.locator('.context-location').innerText()).toBe(observer);
        const glError = await canvas.evaluate(async element => {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return (element as HTMLCanvasElement).getContext('webgl2')!.getError();
        });
        expect(glError).toBe(0);
        const image = await canvas.screenshot();
        if (process.env.MATRIX_SCREENSHOTS === '1') await testInfo.attach(`${system}-${mode.replaceAll(/[^a-z]/gi, '-')}-${viewpoint.replaceAll(' ', '-')}`, { body: image, contentType: 'image/png' });
        entries.push({ system, mode, viewpoint, draws: await page.evaluate(() => (window as unknown as { matrixProbe: { draws: number } }).matrixProbe.draws) - before, screenshotSha256: createHash('sha256').update(image).digest('hex') });
      }
    }
  }
  expect(entries).toHaveLength(63);
  for (const system of ['W', 'E', 'O', 'P', 'K', 'R', 'C']) {
    const outside = entries.filter(entry => entry.system === system && entry.viewpoint === 'Outside sphere');
    expect(new Set(outside.map(entry => entry.screenshotSha256)).size, `${system}: three actual house presentations`).toBe(3);
  }
  expect(errors).toEqual([]);
  await testInfo.attach('63-view-matrix', { body: JSON.stringify({ browser: testInfo.project.name, browserVersion: browser.version(), graphics, viewport: testInfo.project.use.viewport, entries }, null, 2), contentType: 'application/json' });
});
