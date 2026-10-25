import { expect, type Page } from '@playwright/test';

/** Regression suites exercise features explicitly after opening their real controls. */
export async function openControlGroup(page: Page, id: string): Promise<void> {
  const group = page.locator(`details[data-control-group="${id}"]`);
  await expect(group).toHaveCount(1);
  if (!(await group.evaluate(element => (element as HTMLDetailsElement).open))) {
    await group.locator(':scope > summary').click();
  }
  await expect(group).toHaveAttribute('open', '');
}

export async function openControlGroups(page: Page): Promise<void> {
  const groups = page.locator('details[data-control-group]');
  for (let index = 0; index < await groups.count(); index++) {
    const group = groups.nth(index);
    if (!(await group.evaluate(element => (element as HTMLDetailsElement).open))) {
      await group.locator(':scope > summary').click();
    }
  }
}
