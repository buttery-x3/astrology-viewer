import {expect,test,type Page} from '@playwright/test';
import {openControlGroup} from './helpers';
async function example(page:Page){await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();}

test('cold data failure is actionable and a fresh worker recovers after retry',async({page})=>{
  await page.route('**/data/ephemeris/semo_18.se1',route=>route.abort('failed'));
  await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.locator('.error-toast')).toBeVisible({timeout:20000});
  await expect(page.locator('.error-toast')).not.toContainText('2000-01-01');
  await expect(page.locator('.object-list').getByRole('button',{name:/^Moon/})).toBeEnabled();
  await page.unroute('**/data/ephemeris/semo_18.se1');
  await page.getByRole('button',{name:'Retry calculation',exact:true}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible({timeout:20000});
  await expect(page.locator('.error-toast')).toHaveCount(0);
});

test('persists display choices while personal context stays in session memory',async({page})=>{
  await example(page);await openControlGroup(page,'display');
  await page.getByLabel('Rendering quality',{exact:true}).selectOption('low');
  await page.getByLabel('Motion preference',{exact:true}).selectOption('reduced');
  await page.getByLabel('Interface text size',{exact:true}).selectOption('large');
  await page.getByRole('button',{name:'Edit moment',exact:true}).click();
  await page.getByLabel('Gregorian date (local)').fill('2034-06-15');
  await page.getByRole('button',{name:/Apply exploration/}).click();
  await expect(page.locator('.context-details')).toContainText('15 Jun 2034');
  const stored=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
  expect(Object.keys(stored)).toEqual(['spatial.display-preferences.v1']);
  const preferences=JSON.parse(stored['spatial.display-preferences.v1']!);
  expect(preferences).toMatchObject({quality:'low',motion:'reduced',textSize:'large'});
  expect(Object.keys(preferences).sort()).toEqual(['version','quality','labelScale','earthOpacity','motion','textSize','houseMode'].sort());
  await page.reload();await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.locator('.context-details')).toContainText('01 Jan 2000');
  await expect(page.locator('.demo-badge')).toContainText('not your birth chart');
  await openControlGroup(page,'display');
  await expect(page.getByLabel('Rendering quality',{exact:true})).toHaveValue('low');
  await expect(page.getByLabel('Motion preference',{exact:true})).toHaveValue('reduced');
  await expect(page.getByLabel('Interface text size',{exact:true})).toHaveValue('large');
});

test('hidden-tab lifecycle pauses playback without background catch-up',async({page})=>{
  await example(page);await page.getByRole('button',{name:'Play playback',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause playback',exact:true})).toBeVisible();
  // Deterministically exercise the browser lifecycle handler; this does not
  // substitute for manual browser/background scheduling measurements.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByRole('button',{name:'Play playback',exact:true})).toBeVisible();
  await expect(page.locator('.pause-reason')).toContainText('tab was hidden');
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  const instant=await page.locator('.context-details > span > strong').innerText();
  await page.evaluate(()=>{delete (document as unknown as Record<string,unknown>).hidden;document.dispatchEvent(new Event('visibilitychange'));});
  expect(await page.locator('.context-details > span > strong').innerText()).toBe(instant);
});

test('lookup outage preserves manual coordinate and offset entry',async({page})=>{
  await example(page);await page.route('**/api/places?*',route=>route.fulfill({status:503,json:{error:'Lookup temporarily unavailable.'}}));
  await page.getByRole('button',{name:'Edit moment',exact:true}).click();
  await page.getByLabel('Search for a city or place').fill('Example place');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.lookup-status').first()).toContainText('Enter coordinates and an IANA zone manually');
  await page.getByLabel('Latitude · north positive').fill('-33');
  await page.getByLabel('Longitude · east positive').fill('151');
  await page.getByLabel('Override with an explicit UTC offset').check();
  await page.getByLabel('Offset minutes east of UTC').fill('0');
  await page.getByRole('button',{name:/Apply exploration/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await expect(page.locator('.context-details')).toContainText('33.00° S');
});
