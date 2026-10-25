import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openControlGroup } from './helpers';

async function example(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
}

async function accessible(page: Page, state: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect.soft(result.violations.map(violation => ({
    id: violation.id, impact: violation.impact, description: violation.description,
    nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
  })), `${state}: automated accessibility findings`).toEqual([]);
}

test('welcome and collapsed desktop defaults have accessible names and contrast', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /See the chart/ })).toBeVisible();
  await accessible(page, 'welcome');
  await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
  const groups = page.locator('details[data-control-group]');
  expect(await groups.count()).toBeGreaterThanOrEqual(7);
  for (const id of ['layers', 'houses', 'aspects', 'trails', 'references', 'display']) {
    await expect(page.locator(`details[data-control-group="${id}"]`)).not.toHaveAttribute('open', '');
  }
  await expect(page.locator('details[data-control-group="view"]')).toHaveAttribute('open', '');
  await expect(page.locator('.object-list').getByRole('button', { name: /^Moon/ })).toBeVisible();
  const workspace = await page.locator('.workspace').boundingBox(), scene = await page.locator('.scene-stage').boundingBox();
  expect(scene?.height ?? 0).toBeGreaterThanOrEqual((workspace?.height ?? 1) - 1);
  await accessible(page, 'collapsed desktop');
});

test('collapsing panels restores keyboard focus and pinning keeps a cleared inspector available', async ({ page }) => {
  await example(page);
  const moon = page.locator('.object-list').getByRole('button', { name: /^Moon/ });
  await moon.focus(); await page.keyboard.press('Enter');
  const collapse = page.getByRole('button', { name: 'Collapse inspector', exact: true });
  await collapse.focus(); await page.keyboard.press('Enter');
  const expand = page.getByRole('button', { name: 'Expand inspector', exact: true });
  await expect(expand).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector')).not.toHaveAttribute('inert', '');
  const pin = page.getByRole('button', { name: 'Pin inspector', exact: true });
  await pin.focus(); await page.keyboard.press('Enter');
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Clear selection', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector')).not.toHaveAttribute('inert', '');
  await expect(moon).toHaveAttribute('aria-pressed', 'false');
  const collapseExplorer = page.getByRole('button', { name: 'Collapse explorer panel', exact: true });
  await collapseExplorer.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('button[aria-controls="explorer-dock"]')).toBeFocused();
});

test('native group summaries and object selection work with the keyboard', async ({ page }) => {
  await example(page);
  const houses = page.locator('details[data-control-group="houses"]');
  const summary = houses.locator(':scope > summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(houses).toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(houses).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  const moon = page.locator('.object-list').getByRole('button', { name: /^Moon/ });
  await moon.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#inspector').getByRole('heading', { name: 'Moon', exact: true })).toBeVisible();
  await expect(moon).toHaveAttribute('aria-pressed', 'true');
  await expect(moon).toBeFocused();
  await expect(page.getByTestId('exploration-announcement')).toContainText('Selected Moon');
  await accessible(page, 'keyboard-selected body');
  await page.getByRole('button', { name: 'Clear selection', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(moon).toHaveAttribute('aria-pressed', 'false');
});

test('the find shortcut searches core bodies as well as geometry', async ({ page }) => {
  await example(page);
  await page.keyboard.press('/');
  const search = page.getByLabel('Find a body, sign, angle or region', { exact: true });
  await expect(search).toBeFocused();
  await page.keyboard.type('Moon');
  const result = page.getByRole('button', { name: 'Inspect Moon body', exact: true });
  await expect(result).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(result).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector').getByRole('heading', { name: 'Moon', exact: true })).toBeVisible();
  await expect(result).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('exploration-announcement')).toContainText(/Selected Moon|Selected moon/);
  await accessible(page, 'body search result');
});

test('compact keyboard selection transfers focus to the inspector and Escape restores the drawer opener', async ({ page }) => {
  await page.setViewportSize({width:720,height:768});
  await example(page);
  const opener=page.getByRole('button',{name:'☷ Explore',exact:true});
  await opener.focus();await page.keyboard.press('Enter');
  const moon=page.locator('.object-list').getByRole('button',{name:/^Moon/});
  await moon.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#inspector')).toBeFocused();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Moon',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Expand inspector',exact:true})).toBeFocused();
  await page.keyboard.press('/');
  const search=page.getByLabel('Find a body, sign, angle or region',{exact:true});
  await expect(search).toBeFocused();await search.fill('Taurus');
  const taurus=page.getByRole('button',{name:'Taurus 30° sector',exact:true});
  await taurus.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#inspector')).toBeFocused();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Taurus',exact:true})).toBeVisible();
  await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await page.keyboard.press('Tab');await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
});

test('selected houses, constructions, aspects and sampled trails retain semantic access', async ({ page }) => {
  test.setTimeout(60000);
  await example(page);
  await openControlGroup(page, 'houses');
  await page.getByRole('button', { name: 'House 1', exact: true }).click();
  await accessible(page, 'selected house');
  await page.locator('.house-controls').getByRole('button', { name: 'Show construction →', exact: true }).click();
  await expect(page.getByLabel('Construction sweep', { exact: true })).toBeVisible();
  await accessible(page, 'construction guide');
  await page.locator('.object-list').getByRole('button', { name: /^Moon/ }).click();
  await openControlGroup(page, 'aspects');
  await page.getByRole('button', { name: 'Inspect Sun sextile Moon', exact: true }).click();
  await accessible(page, 'selected aspect');
  await page.locator('.object-list').getByRole('button', { name: /^Moon/ }).click();
  await openControlGroup(page, 'trails');
  await page.getByLabel('Show selected body trail', { exact: true }).check();
  await expect(page.getByLabel('Trail sampling status', { exact: true })).toContainText('Trail ready', { timeout: 20000 });
  await accessible(page, 'sampled trail');
});

test('dialogs keep labelled fields, scroll, and restore their opener on Escape', async ({ page }) => {
  await example(page);
  const edit = page.getByRole('button', { name: 'Edit moment', exact: true });
  await edit.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await accessible(page, 'moment dialog');
  await page.keyboard.press('Escape');
  await expect(edit).toBeFocused();
  const evidence = page.getByRole('button', { name: 'Evidence & sources', exact: true });
  await evidence.focus(); await page.keyboard.press('Enter');
  await accessible(page, 'evidence dialog');
  await page.keyboard.press('Escape');
  await expect(evidence).toBeFocused();
});

test('large text reflows at desktop and 200 percent equivalent widths without hiding controls', async ({ page }) => {
  await example(page);
  await openControlGroup(page, 'display');
  await page.getByLabel('Interface text size', { exact: true }).selectOption('large');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('18px');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 900, height: 768 }, { width: 720, height: 450 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${viewport.width}px horizontal reflow`).toBe(true);
    const play = page.getByRole('button', { name: 'Play playback', exact: true });
    await play.scrollIntoViewIfNeeded();
    await expect(play).toBeInViewport();
    await page.getByLabel('Exploration time', { exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
    await accessible(page, `large text ${viewport.width}×${viewport.height} CSS viewport`);
  }
});
