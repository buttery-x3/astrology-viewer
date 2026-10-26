import { expect, test, type Page } from '@playwright/test';
import { openControlGroup } from './helpers';
import { captureSceneFrame, installSceneFrameCapture } from './scene-frame';

const card = (page: Page) => page.getByTestId('hover-card');
async function example(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible({
    timeout: 20000,
  });
}
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test('a stale historical trail selection never falls back to current body placements', async ({
  page,
}) => {
  await example(page);
  await page.locator('.object-list [data-feature-id="body:moon"]').click();
  await openControlGroup(page, 'trails');
  await page.getByLabel('Show selected body trail', { exact: true }).check();
  await expect(page.getByLabel('Trail sampling status', { exact: true })).toContainText(
    'Trail ready',
    { timeout: 20000 },
  );
  await openControlGroup(page, 'references');
  await page.locator('.feature-navigation .sample-navigation').first().locator('summary').click();
  await page.getByRole('button', { name: 'Inspect trail sample', exact: true }).click();
  await expect(page.locator('#inspector .feature-reading')).toContainText('Sample time');
  await expect(page.locator('#inspector .selected-heading h2')).toHaveText('Moon trail');
  await page.getByLabel('Trail reference', { exact: true }).selectOption('horizon');
  await expect(page.getByLabel('Trail sampling status', { exact: true })).toContainText(
    'Trail ready',
    { timeout: 20000 },
  );
  await expect(
    page.locator('#inspector .selected-heading').filter({ hasText: 'CELESTIAL BODY' }),
  ).toHaveCount(0);
  await expect(page.locator('#inspector')).toContainText(
    /unavailable|no longer|different frame|stale/i,
  );
});

test('an explicit keyboard viewpoint change dismisses a card even while its pointer remains inside', async ({
  page,
}) => {
  await example(page);
  await page.locator('.object-list [data-feature-id="body:sun"]').hover();
  await expect(card(page)).toBeVisible();
  await card(page).hover();
  await page.getByRole('button', { name: 'Observer sky', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Observer sky', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(card(page)).toHaveCount(0);
  await page.waitForTimeout(550);
  await expect(card(page)).toHaveCount(0);
});

test('a real canvas preview clears on graphics-context loss while the pointer reads its card', async ({
  page,
}) => {
  await example(page);
  await page.getByRole('button', { name: 'Earth overview', exact: true }).click();
  const canvas = page.locator('.scene-canvas canvas'),
    box = (await canvas.boundingBox())!;
  await canvas.hover({ position: { x: box.width / 2 + 50, y: box.height / 2 } });
  await expect(card(page)).toBeVisible();
  await card(page).hover();
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas canvas')!;
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(page.locator('.scene-notice')).toContainText('restores its graphics context');
  await expect(card(page)).toHaveCount(0);
});

test('Earth overview keeps the actual GPU camera pose across hour stepping and context restoration', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const probe = { view: [] as number[], projection: [] as number[], updates: 0 };
    (window as any).__m10CameraProbe = probe;
    const names = new WeakMap<WebGLUniformLocation, string>(),
      get = WebGL2RenderingContext.prototype.getUniformLocation,
      upload = WebGL2RenderingContext.prototype.uniformMatrix4fv;
    WebGL2RenderingContext.prototype.getUniformLocation = function (program, name) {
      const location = get.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    WebGL2RenderingContext.prototype.uniformMatrix4fv = function (
      location,
      transpose,
      value,
      ...rest
    ) {
      const name = location ? names.get(location) : undefined;
      if (name === 'viewMatrix') {
        probe.view = Array.from(value).slice(0, 16);
        probe.updates++;
      }
      if (name === 'projectionMatrix') probe.projection = Array.from(value).slice(0, 16);
      return Reflect.apply(upload, this, [location, transpose, value, ...rest]);
    };
  });
  await example(page);
  await page.getByRole('button', { name: 'Earth overview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Earth overview', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await frames(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).__m10CameraProbe.view.length))
    .toBe(16);
  const before = await page.evaluate(() => (window as any).__m10CameraProbe);
  await page.getByLabel('Step unit', { exact: true }).selectOption('hour');
  await page.getByRole('button', { name: 'Next hour', exact: true }).click();
  await expect(page.locator('.context-details')).toContainText('13:00:00');
  await frames(page);
  const stepped = await page.evaluate(() => (window as any).__m10CameraProbe);
  for (let index = 0; index < 16; index++)
    expect(stepped.view[index]).toBeCloseTo(before.view[index], 6);
  const available = await page.evaluate(() => {
    const extension = document
      .querySelector<HTMLCanvasElement>('.scene-canvas canvas')!
      .getContext('webgl2')!
      .getExtension('WEBGL_lose_context');
    (window as any).__m10ContextExtension = extension;
    extension?.loseContext();
    return !!extension;
  });
  expect(
    available,
    'The actual graphics driver must expose context-loss recovery for this test.',
  ).toBe(true);
  await expect(page.locator('.scene-notice')).toContainText('restores its graphics context');
  await page.evaluate(() => (window as any).__m10ContextExtension.restoreContext());
  await expect(page.locator('.scene-notice')).toHaveCount(0);
  await frames(page);
  const restored = await page.evaluate(() => (window as any).__m10CameraProbe);
  expect(restored.updates).toBeGreaterThan(stepped.updates);
  for (let index = 0; index < 16; index++) {
    expect(restored.view[index]).toBeCloseTo(before.view[index], 6);
    expect(restored.projection[index]).toBeCloseTo(before.projection[index], 6);
  }
});

test('choosing the Equal C1 guide from a real ASC overlap preserves its construction meaning', async ({
  page,
}) => {
  await example(page);
  await openControlGroup(page, 'houses');
  await page.getByLabel('House system', { exact: true }).selectOption('E');
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Boundary 1,/ }).click();
  await page.getByRole('button', { name: 'Show construction →', exact: true }).click();
  await page.getByRole('button', { name: 'Observer sky', exact: true }).click();
  const canvas = page.locator('.scene-canvas canvas');
  await canvas.focus();
  await page.keyboard.press('f');
  await frames(page);
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  const chooser = page.locator('.overlap-chooser');
  await expect(chooser).toBeVisible();
  await chooser.getByRole('button').filter({ hasText: /Equal/ }).first().click();
  await expect(page.locator('#inspector .feature-reading')).toContainText('Construction rule');
  await expect(page.locator('#inspector .feature-reading')).toContainText('Stage');
  await expect(page.locator('#inspector .feature-reading')).toContainText(
    'The resulting longitude defines the cusp.',
  );
});

test('actual indexed catalogue points choose Mizar and Alcor exactly at the Observer centre ray', async ({
  page,
}, testInfo) => {
  await installSceneFrameCapture(page);
  await example(page);
  // Configure the Observer profile after entering it; other views keep their own layers.
  await page.getByRole('button', { name: 'Observer sky', exact: true }).click();
  await openControlGroup(page, 'display');
  await page.getByLabel('Rendering quality', { exact: true }).selectOption('low');
  await openControlGroup(page, 'aspects');
  await page.getByLabel('Show aspect strands', { exact: true }).uncheck();
  await openControlGroup(page, 'layers');
  const layers = page.locator('.layer-options [data-feature-id]');
  for (let index = 0; index < (await layers.count()); index++) {
    const target = layers.nth(index);
    if ((await target.getAttribute('data-feature-id')) !== 'layer:stars')
      await target.locator('input').uncheck();
  }
  await openControlGroup(page, 'references');
  const canvas = page.locator('.scene-canvas canvas'),
    records: { hygId: number; name: string; choices: string[] }[] = [];
  for (const [id, name] of [
    [65173, 'Mizar'],
    [65272, 'Alcor'],
  ] as const) {
    await page.getByLabel('Search additional features', { exact: true }).fill(name);
    await page.locator(`.feature-navigation [data-feature-id="star:hyg:${id}"]`).click();
    await canvas.focus();
    await page.keyboard.press('f');
    await frames(page);
    const box = (await canvas.boundingBox())!,
      centre = { x: box.width / 2, y: box.height / 2 };
    await canvas.hover({ position: centre });
    await expect(card(page)).toHaveAttribute('data-feature-kind', 'star');
    await expect(card(page).getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(card(page)).toContainText(`HYG ${id}`);
    await canvas.click({ position: centre });
    const chooser = page.locator('.overlap-chooser');
    await expect(chooser).toBeVisible();
    const choices = await chooser.getByRole('button').allTextContents();
    expect(choices[0]).toBe(name);
    expect(choices).toEqual(expect.arrayContaining(['Mizar', 'Alcor']));
    records.push({ hygId: id, name, choices });
    await chooser.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('#inspector .feature-reading')).toContainText(`HYG ${id}`);
  }
  const frame = await captureSceneFrame(page);
  expect(frame.uniqueColours).toBeGreaterThan(10);
  await testInfo.attach('actual-mizar-alcor-star-field', {
    body: frame.png,
    contentType: 'image/png',
  });
  await testInfo.attach('actual-point-index-picking', {
    body: JSON.stringify(records, null, 2),
    contentType: 'application/json',
  });
});
