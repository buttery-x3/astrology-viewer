import { expect, test, type Locator, type Page } from '@playwright/test';
import { openControlGroup } from './helpers';
import figureData from '../../src/lib/scene/data/constellation-figures.json' with { type: 'json' };

const tooltip = (page: Page) => page.getByTestId('hover-card');
async function example(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible({
    timeout: 20000,
  });
}
async function leavePreview(page: Page) {
  await page.keyboard.press('Escape');
  await page.mouse.move(750, 35);
  await expect(tooltip(page)).toHaveCount(0);
}
async function aspect(page: Page) {
  await openControlGroup(page, 'aspects');
  const target = page.getByRole('button', { name: 'Inspect Sun sextile Moon', exact: true });
  await target.hover();
  await expect(tooltip(page)).toHaveAttribute('data-aspect-type', 'sextile');
  return target;
}
async function animated(card: Locator) {
  return card
    .locator('.glint')
    .first()
    .evaluate((element) => getComputedStyle(element).animationName !== 'none');
}
async function expectStatic(card: Locator) {
  await expect.poll(() => animated(card)).toBe(false);
  await expect(card.locator('.medallion')).toHaveCount(2);
  await expect(card.locator('.reading-panel')).toHaveCount(3);
  expect(
    await card
      .locator('.glint')
      .evaluateAll(
        (elements) =>
          elements.filter((element) => getComputedStyle(element).display !== 'none').length,
      ),
  ).toBe(4);
}
async function fitsViewport(page: Page, card: Locator) {
  const box = await card.boundingBox(),
    viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}

test('body preview waits for dwell and composes a single source-free calculated card', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await example(page);
  await page.evaluate(() => {
    const state = { started: 0, revealed: 0 };
    (window as any).__hoverTiming = state;
    document.addEventListener(
      'pointerover',
      (event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-feature-id="body:sun"]') &&
          !state.started
        )
          state.started = performance.now();
      },
      { capture: true },
    );
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-testid="hover-card"]')) {
        state.revealed = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  await page.locator('.object-list [data-feature-id="body:sun"]').hover();
  const card = tooltip(page);
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('heading', { name: 'Sun', exact: true })).toBeVisible();
  const timing = await page.evaluate(() => (window as any).__hoverTiming);
  expect(timing.started).toBeGreaterThan(0);
  expect(timing.revealed - timing.started).toBeGreaterThanOrEqual(250);
  await expect(card.locator('[data-claim-section="body-in-sign:sun:capricorn"]')).toContainText(
    'Sun in Capricorn',
  );
  await expect(card.locator('[data-claim-section^="body-in-house:sun:"]')).toHaveCount(1);
  await expect(card.locator('a')).toHaveCount(0);
  await expect(card).not.toContainText(/Wikipedia|Cafe Astrology|Source passages|Publisher/);
  expect(await card.locator('[data-claim-id]').count()).toBeGreaterThanOrEqual(3);
  await fitsViewport(page, card);
  expect(errors).toEqual([]);
});

test('aspect preview remains readable and scrollable, and Escape preserves its selected pair', async ({
  page,
}) => {
  await example(page);
  const pair = await aspect(page);
  const card = tooltip(page);
  await expect(card).toHaveCount(1);
  await expect(card.locator('.reading-panel')).toHaveCount(3);
  await expect(card.locator('[data-claim-section="aspect-type:sextile"]')).toHaveCount(1);
  await expect(card.locator('[data-claim-section="body-in-sign:sun:capricorn"]')).toHaveCount(1);
  await expect(card.locator('[data-claim-section="body-in-sign:moon:scorpio"]')).toHaveCount(1);
  await expect(card).toContainText('Actual sky angle');
  await expect(card.locator('a')).toHaveCount(0);
  await card.hover();
  await page.mouse.wheel(0, 850);
  await expect.poll(() => card.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(card).toBeVisible();
  await leavePreview(page);
  await pair.click();
  await expect(pair).toHaveAttribute('aria-pressed', 'true');
  await pair.hover();
  await expect(card).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(pair).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(550);
  await expect(card).toHaveCount(0);
  await expect(pair).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#inspector [data-content-id="aspect-type:sextile"]')).toHaveCount(1);
  await expect(
    page.locator('#inspector [data-content-id="body-in-sign:sun:capricorn"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('#inspector [data-content-id="body-in-sign:moon:scorpio"]'),
  ).toHaveCount(1);
});

test('keyboard focus updates a hovered card and restores existing descriptions on Escape', async ({
  page,
}) => {
  await example(page);
  const sun = page.locator('.object-list [data-feature-id="body:sun"]'),
    moon = page.locator('.object-list [data-feature-id="body:moon"]');
  await moon.click();
  await sun.evaluate((element) => {
    element.setAttribute('aria-describedby', 'existing-test-help');
    const help = document.createElement('span');
    help.id = 'existing-test-help';
    help.hidden = true;
    help.textContent = 'Existing help';
    document.body.append(help);
  });
  await sun.focus();
  await expect(tooltip(page).getByRole('heading', { name: 'Sun', exact: true })).toBeVisible();
  await expect(sun).toHaveAttribute('aria-describedby', 'existing-test-help feature-preview-card');
  await tooltip(page).hover();
  await page.keyboard.press('Tab');
  await expect(moon).toBeFocused();
  await expect(tooltip(page).getByRole('heading', { name: 'Moon', exact: true })).toBeVisible();
  await expect(sun).toHaveAttribute('aria-describedby', 'existing-test-help');
  await expect(moon).toHaveAttribute('aria-describedby', 'feature-preview-card');
  await page.keyboard.press('Escape');
  await expect(tooltip(page)).toHaveCount(0);
  await expect(moon).not.toHaveAttribute('aria-describedby');
  await expect(moon).toHaveAttribute('aria-pressed', 'true');
  await expect(sun).toHaveAttribute('aria-describedby', 'existing-test-help');
  await sun.focus();
  await expect(tooltip(page).getByRole('heading', { name: 'Sun', exact: true })).toBeVisible();
  await page.locator('.object-list [data-feature-id="body:mercury"]').hover();
  await expect(tooltip(page).getByRole('heading', { name: 'Mercury', exact: true })).toBeVisible();
  await expect(sun).toBeFocused();
  await expect(sun).toHaveAttribute('aria-describedby', 'existing-test-help');
  await expect(moon).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard readers can focus and scroll a card without changing selection', async ({ page }) => {
  await page.setViewportSize({width:1440,height:700});
  await example(page);
  await openControlGroup(page,'aspects');
  const pair=page.getByRole('button',{name:'Inspect Sun sextile Moon',exact:true});
  await pair.focus();
  await page.keyboard.press('Enter');
  const card=tooltip(page);
  await expect(card).toBeVisible();
  await expect(pair).toBeFocused();
  await page.keyboard.press('F2');
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute('tabindex','0');
  expect(await card.evaluate(element=>element.scrollHeight>element.clientHeight)).toBe(true);
  await page.mouse.move(800,35);
  await page.keyboard.press('PageDown');
  await expect.poll(()=>card.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
  await page.waitForTimeout(550);
  await expect(card).toBeVisible();
  await expect(card).toBeFocused();
  await expect(pair).toHaveAttribute('aria-pressed','true');
  // While keyboard reading, moving over another real feature must neither
  // replace the reading nor reopen it after Escape restores its origin.
  await page.locator('.object-list [data-feature-id="body:sun"]').hover();
  await expect(card).toHaveAttribute('data-aspect-type','sextile');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(pair).toBeFocused();
  await expect(pair).toHaveAttribute('aria-pressed','true');
  await page.waitForTimeout(550);
  await expect(card).toHaveCount(0);
});

test('a body card stays reachable while the pointer crosses another valid target before its dwell', async ({
  page,
}) => {
  await example(page);
  await page.locator('.object-list [data-feature-id="body:sun"]').hover();
  const card = tooltip(page);
  await expect(card.getByRole('heading', { name: 'Sun', exact: true })).toBeVisible();
  const box = (await card.boundingBox())!;
  const candidates = await page.locator('.object-list [data-feature-id]').evaluateAll((elements) =>
    elements.map((element) => {
      const r = element.getBoundingClientRect();
      return {
        id: (element as HTMLElement).dataset.featureId,
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      };
    }),
  );
  const crossing = candidates.find(
    (item) =>
      item.id !== 'body:sun' &&
      (item.x < box.x ||
        item.x > box.x + box.width ||
        item.y < box.y ||
        item.y > box.y + box.height),
  );
  expect(crossing).toBeDefined();
  expect(
    await page.evaluate(
      (point) =>
        (document.elementFromPoint(point.x, point.y)?.closest('[data-feature-id]') as HTMLElement)
          ?.dataset.featureId,
      crossing!,
    ),
  ).toBe(crossing!.id);
  // Both real pointer moves are intentionally consecutive: crossing the new
  // feature must not remove the original before its 300 ms replacement dwell.
  await page.mouse.move(crossing!.x, crossing!.y);
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(200, box.height / 2));
  await expect(card.getByRole('heading', { name: 'Sun', exact: true })).toBeVisible();
  await page.waitForTimeout(550);
  await expect(card.getByRole('heading', { name: 'Sun', exact: true })).toBeVisible();
  await expect(card).toHaveCount(1);
});

test('sparkles persist and motion settings retain the complete static design', async ({ page }) => {
  test.setTimeout(60000);
  await example(page);
  await openControlGroup(page, 'display');
  await page.getByLabel('Motion preference', { exact: true }).selectOption('full');
  await page.getByLabel('Rendering quality', { exact: true }).selectOption('high');
  await page.getByLabel('Card sparkles', { exact: true }).selectOption('on');
  await aspect(page);
  await expect.poll(() => animated(tooltip(page))).toBe(true);
  await leavePreview(page);
  await openControlGroup(page, 'display');
  await page.getByLabel('Card sparkles', { exact: true }).selectOption('off');
  await aspect(page);
  await expectStatic(tooltip(page));
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('spatial.display-preferences.v2')!).cardSparkles,
    ),
  ).toBe(false);
  await page.reload();
  await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
  await openControlGroup(page, 'display');
  await expect(page.getByLabel('Card sparkles', { exact: true })).toHaveValue('off');
  await page.getByLabel('Card sparkles', { exact: true }).selectOption('on');
  await page.getByLabel('Rendering quality', { exact: true }).selectOption('low');
  await aspect(page);
  await expectStatic(tooltip(page));
  await leavePreview(page);
  await openControlGroup(page, 'display');
  await page.getByLabel('Rendering quality', { exact: true }).selectOption('high');
  await page.getByLabel('Motion preference', { exact: true }).selectOption('reduced');
  await aspect(page);
  await expectStatic(tooltip(page));
  await leavePreview(page);
  await openControlGroup(page, 'display');
  await page.getByLabel('Motion preference', { exact: true }).selectOption('full');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await aspect(page);
  await expectStatic(tooltip(page));
});

test('all five theme previews and enlarged cards fit a constrained logical zoom viewport', async ({
  page,
}, testInfo) => {
  // Fragments remain client-side; release resources reject arbitrary query fields.
  await page.goto('/#preview=aspects');
  await expect(tooltip(page)).toHaveCount(6);
  expect(
    await page
      .locator('.theme-grid .hover-card')
      .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.aspectType)),
  ).toEqual(['conjunction', 'sextile', 'square', 'trine', 'opposition']);
  expect(
    await page
      .locator('.theme-grid .reading-panel p')
      .first()
      .evaluate((element) => getComputedStyle(element).fontSize),
  ).toBe('16px');
  await testInfo.attach('five-card-preview', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await example(page);
  await openControlGroup(page, 'display');
  await page.getByLabel('Interface text size', { exact: true }).selectOption('large');
  await page.goto('/#preview=aspects');
  await expect(tooltip(page)).toHaveCount(6);
  expect(
    parseFloat(
      await page
        .locator('.theme-grid .reading-panel p')
        .first()
        .evaluate((element) => getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(20);
  await page.setViewportSize({ width: 720, height: 600 });
  await page.addStyleTag({ content: 'html{font-size:32px!important}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await example(page);
  await page.locator('.left-toggle').click();
  await page.addStyleTag({ content: 'html{font-size:32px!important}' });
  await page.locator('.object-list [data-feature-id="body:sun"]').focus();
  await expect(tooltip(page)).toBeVisible();
  await fitsViewport(page, tooltip(page));
  expect(
    parseFloat(
      await tooltip(page)
        .locator('p')
        .first()
        .evaluate((element) => getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(32);
  expect(
    await tooltip(page).evaluate((element) => element.scrollHeight > element.clientHeight),
  ).toBe(true);
  await testInfo.attach('logical-zoom-large-card', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('paginated navigation gives its newly focused star the matching accessible preview', async ({
  page,
}) => {
  await example(page);
  await openControlGroup(page, 'references');
  const navigation = page.locator('.feature-navigation');
  const buttons = navigation.locator('.navigation-results').first().locator('button');
  await expect(buttons).toHaveCount(12);
  const firstId = await buttons.first().getAttribute('data-feature-id');
  await buttons.first().focus();
  await expect(tooltip(page)).toHaveAttribute('data-feature-kind', 'star');
  await leavePreview(page);
  await page.getByRole('button', { name: 'Next feature page', exact: true }).click();
  await expect(buttons.first()).toBeFocused();
  expect(await buttons.first().getAttribute('data-feature-id')).not.toBe(firstId);
  await expect(tooltip(page)).toHaveAttribute('data-feature-kind', 'star');
  const nextHyg = (await buttons.first().getAttribute('data-feature-id'))!.split(':').at(-1);
  await expect(tooltip(page)).toContainText(`HYG ${nextHyg}`);
  await expect(buttons.first()).toHaveAttribute('aria-describedby', 'feature-preview-card');
});

test('support-star and astro-line navigation preserve their own preview and inspector metadata', async ({
  page,
}) => {
  await example(page);
  await openControlGroup(page, 'references');
  const navigation = page.locator('.feature-navigation');
  const supportId = Number(figureData.supportStars[0]![0]);
  await leavePreview(page);
  await page.getByLabel('Search additional features', { exact: true }).fill(`HYG ${supportId}`);
  const support = navigation.locator(`[data-feature-id="star:hyg:${supportId}"]`);
  await expect(support).toHaveCount(1);
  await support.focus();
  await expect(tooltip(page)).toHaveAttribute('data-feature-kind', 'star');
  await expect(tooltip(page)).toContainText(`HYG ${supportId}`);
  await support.click();
  await expect(support).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#inspector .feature-reading')).toContainText(`HYG ${supportId}`);
  await leavePreview(page);
  await page.getByLabel('Feature category', { exact: true }).selectOption('astro');
  await page.getByLabel('Search additional features', { exact: true }).fill('Venus AC');
  const line = navigation.locator('[data-feature-id="astro:venus:ac"]');
  await expect(line).toHaveCount(1);
  const metadata = JSON.parse((await line.getAttribute('data-feature-json'))!);
  expect(metadata).toMatchObject({
    id: 'astro:venus:ac',
    entityId: 'astro:venus:ac',
    kind: 'astro-line',
    representation: 'earth',
    role: 'line',
  });
  await line.focus();
  await expect(tooltip(page)).toHaveAttribute('data-feature-kind', 'astro-line');
  await expect(
    tooltip(page).getByRole('heading', { name: 'Venus · AC', exact: true }),
  ).toBeVisible();
  await expect(tooltip(page)).toContainText('Traditional body theme');
  await expect(tooltip(page)).toContainText('Traditional angle theme');
  await line.click();
  await expect(line).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#inspector .feature-reading')).toContainText('Venus · AC');
  await expect(page.locator('#inspector [data-content-id="astro:body:venus"]')).toHaveCount(1);
  await expect(page.locator('#inspector [data-content-id="astro:angle:ac"]')).toHaveCount(1);
});
