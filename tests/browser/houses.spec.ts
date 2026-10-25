import {openControlGroups} from './helpers';
import {expect,test,type Page} from '@playwright/test';

async function example(page:Page){
  await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();await openControlGroups(page);
}
async function bodyCoordinates(page:Page){
  return page.locator('#inspector .data-list').first().locator('dd').allTextContents().then(values=>values.slice(0,2));
}

test('all 21 house system/display combinations preserve membership and body directions',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await example(page);const instant=await page.locator('.context-details > span > strong').innerText();
  await page.getByRole('button',{name:/^Moon/}).click();const coordinates=await bodyCoordinates(page);
  for(const system of ['W','E','O','P','K','R','C']){
    await page.getByLabel('House system',{exact:true}).selectOption(system);
    await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();await openControlGroups(page);
    await page.getByRole('button',{name:/^Moon/}).click();
    const assignment=await page.locator('#inspector .data-list').first().innerText();
    for(const mode of ['Volumes / wedges','Boundary arcs','Layered shells']){
      await page.getByRole('radio',{name:mode,exact:true}).check();
      expect(await page.locator('#inspector .data-list').first().innerText()).toBe(assignment);
      expect(await bodyCoordinates(page)).toEqual(coordinates);
      expect(await page.locator('.context-details > span > strong').innerText()).toBe(instant);
    }
  }
  await page.getByRole('button',{name:'House 1',exact:true}).click();
  await expect(page.locator('#inspector').getByRole('heading',{name:'House 1',exact:true})).toBeVisible();
  await page.locator('#inspector').getByRole('button',{name:/Focus in the scene/}).click();
  await page.getByRole('radio',{name:'Boundary arcs',exact:true}).check();
  await expect(page.getByRole('button',{name:'House 1',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.locator('.scene-canvas canvas').click();
  await expect(page.locator('#inspector').getByRole('heading',{name:'House 1',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('comparison changes classifications while keeping one moment and geocentric body positions',async({page})=>{
  await example(page);
  await page.getByRole('button',{name:/^Moon/}).click();const before=await bodyCoordinates(page);
  await page.getByLabel('Compare house system',{exact:true}).selectOption('P');
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();await openControlGroups(page);
  const change=page.getByRole('button',{name:'Moon, house 8 in Whole Sign, house 7 in Placidus',exact:true});
  await expect(change).toBeVisible();await change.click();
  expect(await bodyCoordinates(page)).toEqual(before);
  await expect(page.locator('#inspector .data-list').first()).toContainText('House · Whole Sign');
  await expect(page.locator('#inspector .data-list').first()).toContainText('House · Placidus');
  await page.getByLabel('Show changed regions and assignments only').uncheck();
  await expect(page.locator('.assignment-links button')).toHaveCount(10);
  await page.getByLabel('Compare house system',{exact:true}).selectOption('');
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();await openControlGroups(page);
  await expect(page.locator('#inspector .data-list').first()).not.toContainText('Placidus');
});

test('undefined polar houses retain bodies and literal reference angles without substitutes',async({page})=>{
  await example(page);
  await page.getByRole('button',{name:'Edit moment',exact:true}).click();
  await page.getByLabel('Latitude · north positive').fill('80');
  await page.getByLabel('Longitude · east positive').fill('0');
  await page.getByLabel('Override with an explicit UTC offset').check();
  await page.getByLabel('Offset minutes east of UTC').fill('0');
  await page.getByRole('button',{name:/Apply exploration/}).click();
  await page.getByLabel('House system',{exact:true}).selectOption('P');
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();await openControlGroups(page);
  await expect(page.locator('.house-warning')).toContainText('Placidus unavailable');
  await page.getByRole('radio',{name:'Volumes / wedges',exact:true}).check();
  await page.getByRole('button',{name:'House 1',exact:true}).click();
  await expect(page.locator('#inspector')).toContainText('House geometry unavailable');
  await page.getByRole('button',{name:/^Moon/}).click();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Moon',exact:true})).toBeVisible();
  await expect(page.locator('#inspector .data-list').first()).toContainText('Unavailable');
  await page.getByLabel('Find a body, sign, angle or region').fill('Ascendant');
  await page.getByRole('button',{name:/^Ascendant/}).click();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Ascendant · ASC',exact:true})).toBeVisible();
  await expect(page.locator('#inspector')).not.toContainText('Undefined at this input');
});
