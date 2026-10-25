import {expect,test} from '@playwright/test';

test('keyboard users inspect signs, reference angles and real constellation regions in one sky',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Libra 30° sector',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector').getByRole('heading',{name:'Libra',exact:true})).toBeVisible();
  await expect(page.locator('#inspector')).toContainText('180°–210°');
  await expect(page.locator('#inspector')).toContainText('different, unequal sky region');
  await page.locator('#inspector').getByRole('button',{name:/Focus in the scene/}).click();
  await page.getByLabel('Find a sign, angle or region').fill('Ascendant');
  await page.getByRole('button',{name:/^Ascendant/}).click();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Ascendant · ASC',exact:true})).toBeVisible();
  const instant=await page.locator('.context-details').innerText();
  for(const name of ['Observer sky','Outside sphere','Earth overview']){
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.locator('#inspector').getByRole('heading',{name:'Ascendant · ASC',exact:true})).toBeVisible();
    expect(await page.locator('.context-details').innerText()).toBe(instant);
  }
  await page.getByLabel('Find a sign, angle or region').fill('Orion');
  await page.getByRole('button',{name:/^Orion/}).click();
  await expect(page.getByLabel('Constellation regions',{exact:true})).toBeChecked();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Orion',exact:true})).toBeVisible();
  await expect(page.locator('#inspector')).toContainText('B1875');
  await page.locator('.scene-canvas canvas').focus();await page.keyboard.press('f');
  await expect(page.locator('#inspector').getByRole('heading',{name:'Orion',exact:true})).toBeVisible();
  await page.getByLabel('Horizon & compass',{exact:true}).uncheck();
  await page.getByLabel('Find a sign, angle or region').fill('Zenith');
  await page.getByRole('button',{name:/^Zenith/}).click();
  await expect(page.getByLabel('Horizon & compass',{exact:true})).toBeChecked();
  await page.getByLabel('Find a sign, angle or region').fill('North celestial pole');
  await page.getByRole('button',{name:/^North celestial pole/}).click();
  await expect(page.getByLabel('Celestial equator',{exact:true})).toBeChecked();
  expect(errors).toEqual([]);
});

test('an ordinary Earth click inspects the globe and focus does not edit the observer',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  const context=await page.locator('.context-details').innerText();
  await page.getByRole('button',{name:'Earth Direction origin',exact:true}).click();
  await page.locator('#inspector').getByRole('button',{name:/Focus in the scene/}).click();
  const canvas=page.locator('.scene-canvas canvas'),box=await canvas.boundingBox();
  if(!box)throw new Error('Scene canvas is missing.');
  await canvas.click({position:{x:box.width/2+50,y:box.height/2}});
  await expect(page.locator('#inspector').getByRole('heading',{name:'Earth',exact:true})).toBeVisible();
  await canvas.click();
  await expect(page.locator('#inspector').getByRole('heading',{name:'Observer location',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.globe-pick-banner')).not.toBeVisible();
  expect(await page.locator('.context-details').innerText()).toBe(context);
});

test('camera and reference layers leave body measurements unchanged',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/^Moon/}).click();
  const values=await page.locator('#inspector .data-list').allTextContents();
  for(const label of ['Ecliptic','Horizon & compass','Celestial equator','Tropical signs'])await page.getByLabel(label,{exact:true}).click();
  await page.getByRole('button',{name:'Observer sky',exact:true}).click();
  expect(await page.locator('#inspector .data-list').allTextContents()).toEqual(values);
  await expect(page.getByText('Schematic sky · distances not to scale',{exact:true})).toBeVisible();
});
