import { createHash } from 'node:crypto';
import { expect,test } from '@playwright/test';
import { releaseManifestSchema } from '../../server/manifest';
import { sourceArchiveText } from '../helpers/source-archive';

test('compiled release footer offers its exact served source archive and revision',async({page})=>{
  test.skip(!process.env.RELEASE_BASE_URL,'Source identity requires an actual packaged release; Vite preview is not release evidence.');
  const cspErrors:string[]=[];
  const isCspError=(message:string)=>/content[- ]security[- ]policy|\bCSP\b|unsafe-eval|refused to (?:evaluate|execute|load)/i.test(message);
  page.on('pageerror',error=>{if(isCspError(error.message))cspErrors.push(error.message);});
  page.on('console',message=>{if(message.type()==='error'&&isCspError(message.text()))cspErrors.push(message.text());});
  await page.addInitScript(()=>{
    const violations:{directive:string;blocked:string;disposition:string}[]=[];
    (window as any).releaseCspViolations=violations;
    document.addEventListener('securitypolicyviolation',event=>violations.push({directive:event.effectiveDirective,blocked:event.blockedURI,disposition:event.disposition}));
  });
  const response=await page.request.get('/release-manifest.json');
  expect(response.status()).toBe(200);
  const manifest=releaseManifestSchema.parse(await response.json());
  const welcome=await page.goto('/');
  const policy=welcome?.headers()['content-security-policy'];
  expect(policy).toContain("default-src 'none'");
  expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy?.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1]).not.toContain("'unsafe-inline'");
  await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(await page.evaluate(()=>(window as any).releaseCspViolations)).toEqual([]);
  expect(cspErrors).toEqual([]);
  const footer=page.locator('.app-status .status-links');
  await expect(footer).toContainText(`Build ${manifest.revision.slice(0,7)}`);
  await expect(footer.getByRole('link',{name:/Source & licences/})).toHaveAttribute('href','/source');

  await page.goto('/source');
  await expect(page.getByRole('heading',{name:'Source and licences',exact:true})).toBeVisible();
  await expect(page.getByText(manifest.revision,{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Browse this exact Git commit',exact:true})).toHaveAttribute('href',manifest.source.url);
  await expect(page.getByRole('link',{name:'Download the exact release source (.tar.gz)',exact:true})).toHaveAttribute('href',`/${manifest.source.path}`);
  expect(await page.evaluate(()=>(window as any).releaseCspViolations)).toEqual([]);
  expect(cspErrors).toEqual([]);

  const file=manifest.files.find(entry=>entry.path===manifest.source.path)!;
  const archiveResponse=await page.request.get(`/${manifest.source.path}`);
  expect(archiveResponse.status()).toBe(200);
  expect(archiveResponse.headers()['content-type']).toBe('application/gzip');
  expect(archiveResponse.headers()['content-encoding']).toBeUndefined();
  expect(Number(archiveResponse.headers()['content-length'])).toBe(file.bytes);
  expect(file.bytes).toBeLessThanOrEqual(100*1024*1024);
  const archive=await archiveResponse.body();
  expect(archive.length).toBe(file.bytes);
  expect(createHash('sha256').update(archive).digest('hex')).toBe(manifest.source.sha256);
  const identity=sourceArchiveText(archive,`spatial-astrology-${manifest.revision}/source-revision.txt`);
  expect(identity.trim()).toBe(manifest.revision);
});
