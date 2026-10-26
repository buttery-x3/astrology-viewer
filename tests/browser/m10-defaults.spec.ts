import { expect, test } from '@playwright/test';
import { openControlGroup } from './helpers';

test('new and reset house displays use layered shells at zero lift', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
  await openControlGroup(page, 'houses');
  await expect(page.getByRole('radio', { name: 'Layered shells', exact: true })).toBeChecked();
  await expect(page.getByLabel('Shell separation', { exact: true })).toHaveValue('0');
  await page.getByLabel('Shell separation', { exact: true }).fill('0.12');
  await page.getByRole('radio', { name: 'Boundary arcs', exact: true }).check();
  await page.getByRole('button', { name: 'Reset house display', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Layered shells', exact: true })).toBeChecked();
  await expect(page.getByLabel('Shell separation', { exact: true })).toHaveValue('0');
});

test('legacy display choices migrate without overwriting an explicit house mode', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spatial.display-preferences.v1', JSON.stringify({
    version: 1, quality: 'low', labelScale: 1.3, earthOpacity: 0.8, motion: 'reduced', textSize: 'standard', houseMode: 'volumes',
  })));
  await page.goto('/');
  await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
  await openControlGroup(page, 'houses');
  await expect(page.getByRole('radio', { name: 'Volumes / wedges', exact: true })).toBeChecked();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('spatial.display-preferences.v2')!));
  expect(saved).toMatchObject({ version: 2, houseMode: 'volumes', quality: 'low', cardSparkles: true });
  expect(saved).not.toHaveProperty('observer');
});
