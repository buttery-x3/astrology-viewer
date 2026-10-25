import {openControlGroups} from './helpers';
import { expect, test, type Page } from '@playwright/test';

async function loadExample(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible({ timeout: 20000 });await openControlGroups(page);
}

async function enterGlobePicker(page: Page) {
  await page.getByRole('button', { name: 'Edit moment', exact: true }).click();
  await page.getByRole('button', { name: 'Pick on globe', exact: true }).click();
  await expect(page.locator('.globe-pick-banner')).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

async function dragCanvas(page: Page) {
  const box = await page.locator('.scene-canvas canvas').boundingBox();
  if (!box) throw new Error('Expected a visible scene canvas.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 20, { steps: 8 });
  await page.mouse.up();
}

test('ordinary scene orbiting cannot change observer coordinates', async ({ page }) => {
  await loadExample(page);
  const context = await page.locator('.context-details').innerText();
  await dragCanvas(page);
  await page.locator('.scene-canvas canvas').click();
  await expect(page.locator('.globe-pick-banner')).not.toBeVisible();
  expect(await page.locator('.context-details').innerText()).toBe(context);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('a deliberate globe click proposes coordinates and keeps the chart unchanged until Apply', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await loadExample(page);
  const context = await page.locator('.context-details').innerText();
  await enterGlobePicker(page);
  await dragCanvas(page);
  // A drag rotates the globe; it must not become a location click on pointer-up.
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.globe-pick-banner')).toBeVisible();
  expect(await page.locator('.context-details').innerText()).toBe(context);
  await page.locator('.globe-pick-banner').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.globe-pick-banner')).not.toBeVisible();

  // Re-entering intentionally focuses Earth at the original chart observer.
  await enterGlobePicker(page);
  const canvas = page.locator('.scene-canvas canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Expected a visible globe.');
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByRole('dialog')).toBeVisible();
  // Real pointer coordinates are quantized to CSS pixels. Exact inverse/frame
  // precision is covered separately by known-answer coordinate tests.
  expect(Number(await page.getByLabel('Latitude · north positive').inputValue())).toBeCloseTo(51.5, 1);
  expect(Number(await page.getByLabel('Longitude · east positive').inputValue())).toBeCloseTo(0, 1);
  expect(await page.locator('.context-details').innerText()).toBe(context);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.locator('.context-details').innerText()).toBe(context);
  expect(errors).toEqual([]);
});
