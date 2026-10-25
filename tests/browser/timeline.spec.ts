import {openControlGroups} from './helpers';
import {expect,test,type Page} from '@playwright/test';
async function example(page:Page){await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();await openControlGroups(page);}

test('window zoom preserves time and anchor; keyboard steps use configured units',async({page})=>{
  await example(page);const anchor=await page.locator('.birth-anchor-section').innerText();
  const displayed=await page.locator('.context-details > span > strong').innerText();
  for(const window of ['1h','1w','1mo','1y','10y']){
    await page.getByLabel('Timeline window',{exact:true}).selectOption(window);
    expect(await page.locator('.context-details > span > strong').innerText()).toBe(displayed);
  }
  await page.getByRole('button',{name:'Zoom timeline in',exact:true}).click();
  expect(await page.locator('.context-details > span > strong').innerText()).toBe(displayed);
  await page.getByLabel('Step unit',{exact:true}).selectOption('hour');
  await page.getByLabel('Exploration time',{exact:true}).focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('.context-details')).toContainText('13:00:00');
  await expect(page.locator('.exploration-badge')).toContainText('Exploring: +1 hour');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('.context-details')).toContainText('23:00:00');
  await expect(page.locator('.exploration-badge')).toContainText('Exploring: +11 hours');
  expect(await page.locator('.birth-anchor-section').innerText()).toBe(anchor);
  await page.getByRole('button',{name:/Return to birth instant/}).click();
  await expect(page.locator('.exploration-badge')).toContainText('Birth moment');
});

test('calendar month stepping clamps leap day and preserves time of day',async({page})=>{
  await example(page);await page.getByRole('button',{name:'Edit moment',exact:true}).click();
  await page.getByLabel('Gregorian date (local)').fill('2000-01-31');
  await page.getByLabel('Time (local)',{exact:true}).fill('12:34:56');
  await page.getByLabel('Override with an explicit UTC offset').check();
  await page.getByLabel('Offset minutes east of UTC').fill('0');
  await page.getByRole('button',{name:/Apply exploration/}).click();
  await page.getByLabel('Step unit',{exact:true}).selectOption('month');
  await page.getByRole('button',{name:'Next month',exact:true}).click();
  await expect(page.locator('.context-details')).toContainText('29 Feb 2000');
  await expect(page.locator('.context-details')).toContainText('12:34:56');
  await expect(page.locator('.timeline-help')).toContainText('Gregorian UTC');
});

test('reverse playback keeps coherent times and pauses before editing',async({page})=>{
  await example(page);
  await page.getByLabel('Playback direction',{exact:true}).selectOption('-1');
  await page.getByLabel('Playback speed',{exact:true}).selectOption('86400000');
  await page.getByRole('button',{name:'Play playback',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause playback',exact:true})).toBeVisible();
  await expect(page.locator('.exploration-badge')).toContainText('Exploring: −');
  await page.getByRole('button',{name:'Edit moment',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('button',{name:'Play playback',exact:true})).toBeVisible();
  await expect(page.locator('.pause-reason')).toContainText('editing');
  await page.getByRole('button',{name:/Return to birth instant/}).click();
  await expect(page.locator('.exploration-badge')).toContainText('Birth moment');
});
