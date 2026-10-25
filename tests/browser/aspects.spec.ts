import {expect,test,type Page} from '@playwright/test';

async function example(page:Page){
  await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
}
test('measures a pair, retains outside-orb selection, and preserves body coordinates',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await example(page);
  await page.locator('.object-list').getByRole('button',{name:/^Moon/}).click();
  const coordinates=await page.locator('#inspector .data-list').first().locator('dd').allTextContents();
  const pair=page.getByRole('button',{name:'Inspect Sun sextile Moon',exact:true});
  await pair.click();
  await expect(page.locator('#inspector .aspect-measurement')).toContainText('Within orb');
  await expect(page.locator('#inspector .aspect-measurement')).toContainText('Actual 3D sky angle');
  await expect(page.locator('[data-content-id="aspect-type:sextile"]')).toContainText('Traditional interpretation');
  await page.getByRole('button',{name:'Focus aspect F',exact:true}).click();
  await expect(page.locator('.aspect-key')).toContainText('longitude separation');
  await page.getByText('Orbs and appearance',{exact:true}).click();
  await page.getByLabel('Sextile orb',{exact:true}).fill('1');
  await page.getByRole('button',{name:'Apply orb settings',exact:true}).click();
  await expect(page.locator('#inspector .aspect-warning')).toContainText('Outside configured orb');
  await expect(pair).toHaveCount(0);
  await expect(page.locator('#inspector .aspect-measurement')).toContainText('Longitude separation');
  await page.getByRole('button',{name:'Reset 6° preset',exact:true}).click();
  await expect(pair).toHaveAttribute('aria-pressed','true');
  await page.getByLabel('Show aspect strands',{exact:true}).uncheck();
  await expect(page.locator('#inspector')).toContainText('hidden by the current layer or type filter');
  await page.locator('.object-list').getByRole('button',{name:/^Moon/}).click();
  expect(await page.locator('#inspector .data-list').first().locator('dd').allTextContents()).toEqual(coordinates);
  expect(errors).toEqual([]);
});

test('filters selected-body pairs and shows sourced placements with separate claim roles',async({page})=>{
  await example(page);
  await page.getByLabel('Aspect scope',{exact:true}).selectOption('selected');
  await expect(page.locator('.aspect-pair-list button')).toHaveCount(0);
  await page.locator('.object-list').getByRole('button',{name:/^Moon/}).click();
  const labels=await page.locator('.aspect-pair-list button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-label')));
  expect(labels.length).toBeGreaterThan(0);expect(labels.every(label=>label?.includes('Moon'))).toBe(true);
  await expect(page.locator('[data-content-id="body:moon"] [data-claim-role="astronomy"]')).toBeVisible();
  await expect(page.locator('[data-content-id="body:moon"] [data-claim-role="tradition"]')).toBeVisible();
  await expect(page.locator('[data-content-id="body-in-sign:moon:scorpio"]')).toContainText('Moon in Scorpio');
  await expect(page.locator('[data-content-id="body-in-house:moon:8"]')).toContainText('Moon in house 8');
  await page.getByRole('button',{name:'Evidence & sources',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Carlson');
  await expect(page.getByRole('dialog')).toContainText('under its tested conditions');
  await page.getByRole('button',{name:'Close evidence explanation',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
