import {expect,test,type Page} from '@playwright/test';
async function example(page:Page){await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();}

test('rebuilds selected trails in both frames, reports budget limits and leaves the birth anchor fixed',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await example(page);const anchor=await page.locator('.birth-anchor-section').innerText();
  await page.locator('.object-list').getByRole('button',{name:/^Moon/}).click();
  await page.getByLabel('Show selected body trail',{exact:true}).check();
  const status=page.getByLabel('Trail sampling status',{exact:true});
  await expect(status).toContainText('Trail ready',{timeout:20000});
  await expect(page.getByLabel('Motion history legend',{exact:true})).toContainText('Relative to the stars');
  await page.getByLabel('Trail reference',{exact:true}).selectOption('horizon');
  await expect(status).toContainText('Trail ready',{timeout:20000});
  await expect(page.getByLabel('Motion history legend',{exact:true})).toContainText('Relative to the local horizon');
  await page.getByLabel('Trail window',{exact:true}).selectOption(String(3652.5*86400000));
  await expect(status).toContainText('Limited trail interval',{timeout:20000});
  await expect(status).toContainText('Sampling limits');
  await page.getByLabel('Step unit',{exact:true}).selectOption('hour');
  await page.getByRole('button',{name:'Next hour',exact:true}).click();
  await expect(page.locator('.context-details')).toContainText('13:00:00');
  expect(await page.locator('.birth-anchor-section').innerText()).toBe(anchor);
  await page.locator('.object-list').getByRole('button',{name:/^Mars/}).click();
  await expect(page.locator('.trail-controls .target-note').first()).toHaveText('Tracing Mars');
  await page.getByLabel('Trail window',{exact:true}).selectOption('86400000');
  await expect(status).toContainText('Trail ready',{timeout:20000});
  await expect(page.getByLabel('Motion history legend',{exact:true})).toContainText('Mars');
  expect(errors).toEqual([]);
});

test('shows only the selected boundary history and keeps whole-sign jumps discrete',async({page})=>{
  await example(page);
  await page.getByRole('button',{name:/^Boundary 1,/}).click();
  await page.getByLabel('Show selected boundary history',{exact:true}).check();
  const status=page.getByLabel('Boundary history status',{exact:true});
  await expect(status).toContainText('Boundary history ready',{timeout:20000});
  await expect(status).toContainText('Discrete jump samples');
  await expect(page.getByLabel('Motion history legend',{exact:true})).toContainText('C1');
  await page.getByLabel('History sample count',{exact:true}).selectOption('3');
  await expect(status).toContainText('3 / 3',{timeout:20000});
  await page.getByRole('button',{name:/^Boundary 12,/}).click();
  await expect(page.getByLabel('Motion history legend',{exact:true})).toContainText('C12',{timeout:20000});
  await page.getByLabel('Show selected boundary history',{exact:true}).uncheck();
  await expect(page.getByLabel('Motion history legend',{exact:true})).toHaveCount(0);
});
