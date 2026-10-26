import { expect, test } from '@playwright/test';
import { getClaimSources, getContent } from '../../src/lib/content';
import { openControlGroup } from './helpers';

for (const [angle, theme, name] of [
  ['asc', 'ac', 'Ascendant'],
  ['dsc', 'dc', 'Descendant'],
  ['mc', 'mc', 'Midheaven'],
  ['ic', 'ic', 'Imum Coeli'],
] as const) {
  test(`${name} retains its hover theme and inspectable attribution after keyboard selection`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Explore example/ }).click();
    await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
    await openControlGroup(page, 'references');
    await page.getByLabel('Find a body, sign, angle or region', { exact: true }).fill(name);
    const target = page.locator(`.feature-list [data-feature-id="angle:${angle}"]`);
    await target.focus();
    const entry = getContent(`astro:angle:${theme}`)!;
    const claim = entry.claims[0]!;
    const source = getClaimSources(claim)[0]!;
    const card = page.getByTestId('hover-card');
    await expect(card).toContainText(claim.text);
    await expect(card.locator('a')).toHaveCount(0);
    await page.keyboard.press('Enter');
    const definition = page.locator(`#inspector [data-content-id="angle:${angle}"]`);
    const interpretation = page.locator(`#inspector [data-content-id="astro:angle:${theme}"]`);
    await expect(definition).toBeVisible();
    await expect(interpretation.locator('[data-claim-role="tradition"] .claim-text')).toHaveText(claim.text);
    await expect(interpretation.locator('.claim-source > a')).toHaveAttribute('href', source.url);
    await expect(interpretation).toContainText(source.author);
    await interpretation.getByText('Source passage and reuse', { exact: true }).click();
    await expect(interpretation.locator('details')).toContainText(claim.section);
    await expect(interpretation.locator('details')).toContainText(source.title);
  });
}
