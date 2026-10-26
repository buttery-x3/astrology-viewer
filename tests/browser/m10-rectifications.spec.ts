import {expect,test} from '@playwright/test';
import {openControlGroup} from './helpers';

test('each view restores its own layer choices from independent M10 defaults',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Outside sphere',exact:true})).toHaveAttribute('aria-pressed','true');
  await openControlGroup(page,'aspects');
  const strands=page.getByRole('checkbox',{name:'Show aspect strands',exact:true});
  await expect(strands).toBeChecked();
  await page.getByRole('button',{name:'Earth overview',exact:true}).click();
  await expect(strands).not.toBeChecked();await openControlGroup(page,'earth');
  await expect(page.getByLabel('Earth projections',{exact:true})).toBeChecked();
  await expect(page.getByLabel('Projected house sections',{exact:true})).not.toBeChecked();
  await expect(page.getByLabel('Astrocartography lines',{exact:true})).toBeChecked();
  const opacity=page.getByLabel('Geographic line opacity',{exact:true});
  await expect(opacity).toHaveValue('0.75');await opacity.fill('0.61');
  await page.getByLabel('Projected house sections',{exact:true}).check();await strands.check();
  await page.getByRole('button',{name:'Earth overview',exact:true}).click();
  await expect(strands).toBeChecked();await expect(page.getByLabel('Projected house sections',{exact:true})).toBeChecked();
  await expect(opacity).toHaveValue('0.61');
  await page.getByRole('button',{name:'Observer sky',exact:true}).click();
  await openControlGroup(page,'layers');
  const figures=page.getByRole('checkbox',{name:'Constellation asterisms',exact:true});
  await expect(figures).toBeChecked();await expect(strands).not.toBeChecked();
  await expect(page.getByLabel('Earth projections',{exact:true})).not.toBeChecked();
  await figures.uncheck();await strands.check();
  await page.getByRole('button',{name:'Observer sky',exact:true}).click();
  await expect(figures).not.toBeChecked();await expect(strands).toBeChecked();
  await page.getByRole('button',{name:'Outside sphere',exact:true}).click();
  await expect(strands).toBeChecked();await expect(figures).not.toBeChecked();
  await expect(page.getByLabel('Earth projections',{exact:true})).not.toBeChecked();
  await expect(opacity).toHaveValue('0.61');
  await page.getByRole('button',{name:'Earth overview',exact:true}).click();
  await expect(page.getByLabel('Projected house sections',{exact:true})).toBeChecked();await expect(strands).toBeChecked();
  await expect(figures).not.toBeChecked();
  await page.getByRole('button',{name:'Observer sky',exact:true}).click();
  await expect(figures).not.toBeChecked();await expect(strands).toBeChecked();
});

test('opening a geographic target from Observer preserves a manual aspect override',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Observer sky',exact:true}).click();
  await openControlGroup(page,'aspects');
  const strands=page.getByRole('checkbox',{name:'Show aspect strands',exact:true});await strands.check();
  await openControlGroup(page,'references');await page.getByLabel('Feature category',{exact:true}).selectOption('astro');
  await page.getByLabel('Search additional features',{exact:true}).fill('Venus MC');
  await page.locator('.feature-navigation [data-feature-id="astro:venus:mc"]').click();
  await expect(page.getByRole('button',{name:'Earth overview',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(strands).toBeChecked();await openControlGroup(page,'earth');
  await expect(page.getByLabel('Earth projections',{exact:true})).toBeChecked();
  await expect(page.getByLabel('Projected house sections',{exact:true})).not.toBeChecked();
  // The carried Observer aspect override must not overwrite Earth's saved profile.
  await page.getByRole('button',{name:'Outside sphere',exact:true}).click();
  await page.getByRole('button',{name:'Earth overview',exact:true}).click();
  await expect(strands).not.toBeChecked();
});
