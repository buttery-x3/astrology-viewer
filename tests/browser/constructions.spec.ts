import {openControlGroups} from './helpers';
import {expect,test,type Page} from '@playwright/test';

async function example(page:Page){await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();await openControlGroups(page);}
async function coordinates(page:Page){await page.getByRole('button',{name:/^Moon/}).click();return page.locator('#inspector .data-list').first().locator('dd').allTextContents().then(v=>v.slice(0,2));}

test('all seven methods expose validated actual constructions without changing the chart',async({page})=>{
  // Seven independent systems and their staged range-key interactions form one
  // aggregate workflow; software WebKit needs more than a single-case budget.
  test.setTimeout(120_000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await example(page);
  const initial=await coordinates(page),context=await page.locator('.context-details > span > strong').innerText();
  for(const system of ['W','E','O','P','K','R','C']){
    await page.getByLabel('House system',{exact:true}).selectOption(system);
    await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();await openControlGroups(page);
    await page.locator('.house-controls').getByRole('button',{name:'Show construction →',exact:true}).click();
    await page.getByLabel('Construction boundary',{exact:true}).selectOption('11');
    const guide=page.locator('.construction-guide');
    await expect(guide.getByText('Construction not validated',{exact:true})).not.toBeVisible();
    await expect(guide.getByText('Construction undefined here',{exact:true})).not.toBeVisible();
    const residual=await guide.locator('dt').filter({hasText:'Largest of all 12 residuals'}).locator('..').locator('dd').innerText();
    expect(parseFloat(residual)).toBeLessThanOrEqual(.01);
    const values=await guide.locator('.validation-details').innerText();
    for(const stage of [1,2,3]){
      const button=guide.getByRole('button',{name:new RegExp(`^Stage ${stage}:`)});await button.click();await expect(button).toHaveAttribute('aria-current','step');
    }
    const sweep=page.getByLabel('Construction sweep',{exact:true});await sweep.focus();await sweep.press('Home');await sweep.press('ArrowRight');
    expect(await guide.locator('.validation-details').innerText()).toBe(values);
    expect(await page.locator('.context-details > span > strong').innerText()).toBe(context);
    expect(await coordinates(page)).toEqual(initial);
    await guide.getByRole('button',{name:/Focus construction/}).click();
    await expect(page.locator('#inspector').getByRole('heading',{name:'Boundary 11',exact:true})).toBeVisible();
    await sweep.focus();await sweep.press('End');
  }
  expect(errors).toEqual([]);
});

test('a time-based construction becomes honestly undefined at a polar input',async({page})=>{
  await example(page);await page.getByLabel('House system',{exact:true}).selectOption('P');
  await page.locator('.house-controls').getByRole('button',{name:'Show construction →',exact:true}).click();
  await expect(page.getByLabel('Construction boundary',{exact:true})).toHaveValue('11');
  await page.getByRole('button',{name:'Edit moment',exact:true}).click();
  await page.getByLabel('Latitude · north positive').fill('80');await page.getByLabel('Longitude · east positive').fill('0');
  await page.getByLabel('Override with an explicit UTC offset').check();await page.getByLabel('Offset minutes east of UTC').fill('0');
  await page.getByRole('button',{name:/Apply exploration/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();await openControlGroups(page);
  await expect(page.locator('.construction-guide')).toContainText('Construction undefined here');
  await expect(page.getByLabel('Construction sweep',{exact:true})).not.toBeVisible();
  await page.getByLabel('House system',{exact:true}).selectOption('C');
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();await openControlGroups(page);
  await expect(page.locator('.construction-guide')).not.toContainText('Construction undefined here');
  await expect(page.getByLabel('Construction sweep',{exact:true})).toBeVisible();
});
