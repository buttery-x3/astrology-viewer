import {expect,test} from '@playwright/test';

test('chooses a named place and preserves the exploration instant on a location edit',async({page})=>{
  const requests:string[]=[];
  await page.route('**/api/places?*',async route=>{
    const url=new URL(route.request().url()); requests.push(url.search);
    await route.fulfill({json:{results:[{id:'sydney',name:'Sydney',label:'Sydney, New South Wales, Australia',latitudeDeg:-33.8688,longitudeDeg:151.2093,timezone:'Australia/Sydney'}],provider:'Open-Meteo / GeoNames',attribution:'Test fixture'}});
  });
  await page.route('**/api/timezone?*',async route=>{
    const url=new URL(route.request().url()); requests.push(url.search);
    await route.fulfill({json:{zones:['Australia/Sydney'],dataset:'geo-tz/all@8.1.10',attribution:'Test fixture'}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Change observer ↗',exact:true}).click();
  await page.getByLabel('Search for a city or place').fill('Sydney');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByRole('button',{name:/Sydney, New South Wales, Australia/}).click();
  await expect(page.getByLabel('IANA time zone',{exact:true})).toHaveValue('Australia/Sydney');
  await expect(page.getByLabel('Time (local)',{exact:true})).toHaveValue('23:00:00');
  await page.getByRole('button',{name:/Apply exploration/}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.context-details')).toContainText('12:00:00 UTC');
  await expect(page.locator('.context-details')).toContainText('Australia/Sydney');
  await expect(page.locator('.birth-anchor-section')).toContainText('Greenwich');
  expect(requests).toHaveLength(2);
  expect(requests.every(query=>!query.includes('2000')&&!query.includes('birth'))).toBe(true);
  await page.getByRole('button',{name:/Restore birth context/}).click();
  await expect(page.locator('.context-details')).toContainText('Europe/London');
});

test('the local API serves comprehensive zones and rejects personal query fields',async({request})=>{
  const zone=await request.get('/api/timezone?latitude=12.7855&longitude=45.0187');
  expect(zone.status()).toBe(200);
  expect((await zone.json()).zones).toContain('Asia/Aden');
  const rejected=await request.get('/api/timezone?latitude=0&longitude=0&birthDate=2000-01-01');
  expect(rejected.status()).toBe(400);
});
