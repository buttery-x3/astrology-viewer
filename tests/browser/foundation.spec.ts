import {openControlGroups} from './helpers';
import { expect, test } from '@playwright/test';

test('loads the real example, selects a body, changes viewpoint and returns to its anchor',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/See the chart/})).toBeVisible();
  await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible({timeout:20000});await openControlGroups(page);
  await expect(page.locator('.scene-canvas canvas')).toHaveCount(1);
  await page.getByRole('button',{name:/^Mars/}).click();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Mars',exact:true})).toBeVisible();
  await expect(page.locator('#inspector')).toContainText('Ecliptic longitude');
  await page.getByRole('button',{name:'Observer sky',exact:true}).click();
  await expect(page.getByRole('button',{name:'Observer sky',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Next day',exact:true}).click();
  await expect(page.locator('.context-details')).toContainText('02 Jan 2000');
  await page.getByRole('button',{name:/Return to birth instant/}).click();
  await expect(page.locator('.context-details')).toContainText('01 Jan 2000');
  expect(errors).toEqual([]);
});

test('preserves numerical exploration while the graphics context recovers',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible({timeout:20000});await openControlGroups(page);
  const supported=await page.evaluate(()=>{
    const canvas=document.querySelector('.scene-canvas canvas') as HTMLCanvasElement;
    const extension=canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    (window as any).contextRecoveryExtension=extension;
    extension?.loseContext();
    return Boolean(extension);
  });
  test.skip(!supported,'The test graphics driver does not provide context-loss simulation.');
  await expect(page.getByText(/paused while the browser restores its graphics context/)).toBeVisible();
  await page.getByRole('button',{name:/^Moon/}).click();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Moon',exact:true})).toBeVisible();
  await page.evaluate(()=>(window as any).contextRecoveryExtension.restoreContext());
  await expect(page.getByText(/paused while the browser restores its graphics context/)).not.toBeVisible();
  await expect(page.locator('.scene-canvas canvas')).toHaveCount(1);
});

test('commits an explicit offset and coordinates through the birth form',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/Enter a birth moment/}).click();
  await page.getByLabel('Gregorian date (local)').fill('2000-06-15');
  await page.getByLabel('Time (local)',{exact:true}).fill('06:30:00');
  await page.getByLabel('Latitude · north positive').fill('-33.8688');
  await page.getByLabel('Longitude · east positive').fill('151.2093');
  await page.getByLabel('Override with an explicit UTC offset').check();
  await page.getByLabel('Offset minutes east of UTC').fill('600');
  await expect(page.getByText('2000-06-14 · 20:30:00 UTC',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Set birth anchor/}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.context-details')).toContainText('14 Jun 2000');
  await expect(page.locator('.context-details')).toContainText('33.87° S');
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible({timeout:20000});await openControlGroups(page);
});

test('requires a fold choice and keeps the birth anchor when exploring another moment',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/Enter a birth moment/}).click();
  await page.getByLabel('IANA time zone',{exact:true}).fill('America/New_York');
  await page.getByLabel('Confirm this time zone for the entered coordinates').check();
  await page.getByLabel('Gregorian date (local)').fill('2024-11-03');
  await page.getByLabel('Time (local)',{exact:true}).fill('01:30:00');
  await expect(page.getByRole('button',{name:/Set birth anchor/})).toBeDisabled();
  await page.getByRole('radio',{name:/Later occurrence/}).check();
  await page.getByRole('button',{name:/Set birth anchor/}).click();
  await expect(page.locator('.context-details')).toContainText('06:30:00');
  const anchor = await page.locator('.birth-anchor-section').innerText();
  await page.getByRole('button',{name:'Next day',exact:true}).click();
  await expect(page.locator('.context-details')).toContainText('04 Nov 2024');
  expect(await page.locator('.birth-anchor-section').innerText()).toBe(anchor);
  await page.getByRole('button',{name:/Return to birth instant/}).click();
  await expect(page.locator('.context-details')).toContainText('03 Nov 2024');
});
