import { expect, test } from '@playwright/test';

test('concept overviews stay separate from attributed claims and use fixed article links',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await page.locator('.object-list').getByRole('button',{name:/^Sun/}).click();
  const body=page.locator('[data-content-id="body:sun"]');
  await expect(body.locator('[data-claim-role="astronomy"]')).toBeVisible();
  await expect(body.locator('[data-claim-role="tradition"]')).toBeVisible();
  const overview=body.locator('[data-overview-id="body:sun"]');
  await expect(overview).toContainText('Wikipedia concept overview');
  await expect(overview.getByRole('link',{name:'Wikipedia overview: Sun (opens in a new tab)',exact:true})).toHaveAttribute('href','https://en.wikipedia.org/wiki/Sun');
  await expect(page.locator('[data-content-id="body-in-sign:sun:capricorn"] [data-overview-id]')).toHaveCount(0);
  await page.locator('#inspector').getByRole('button',{name:'Explore Capricorn →',exact:true}).click();
  const sign=page.locator('[data-overview-id="sign:capricorn"]');
  await expect(sign.getByRole('link',{name:/Wikipedia overview: Capricorn/})).toHaveAttribute('href','https://en.wikipedia.org/wiki/Capricorn_(astrology)');
  await expect(page.locator('#inspector').getByRole('link',{name:/Explorer convention — tropical sign membership/})).toHaveAttribute('href',/\/blob\/0ea709fdff33ac11aed696fcb0b60f17e0fad477\/src\/lib\/domain\/chart\.ts$/);
});
