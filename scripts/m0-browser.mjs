import { mkdirSync,writeFileSync } from 'node:fs';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve('.cache/playwright');
const { chromium } = await import('@playwright/test');
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  page.on('pageerror',error=>console.error(error));
  await page.goto(`${process.env.PROBE_URL??'http://127.0.0.1:5173'}/m0.html`);
  await page.waitForFunction(()=>window.m0Report||window.m0Error,{},{timeout:60000});
  const result=await page.evaluate(()=>({report:window.m0Report,error:window.m0Error}));
  if(result.error)throw new Error(result.error);
  if(result.report.bodyCount!==10||result.report.houseCount!==7)throw new Error('Incomplete chart.');
  for(const system of ['P','K'])if(result.report.polarStatuses.find(h=>h.system===system)?.status!=='undefined')throw new Error('Polar fallback not rejected.');
  mkdirSync('docs/reports',{recursive:true});
  writeFileSync('docs/reports/m0-browser.json',JSON.stringify(result.report,null,2)+'\n');
  console.log(JSON.stringify(result.report,null,2));
}finally{await browser.close();}
