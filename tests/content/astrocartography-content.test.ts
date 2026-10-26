import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {BODY_IDS} from '../../src/lib/astronomy/ephemeris';
import {CONTENT_CATALOGUE,CONTENT_VALIDATION,getContent,getClaimSources,getSupplementalClaim,validateContentCatalogue} from '../../src/lib/content';
import {getProjectExplanation,PROJECT_EXPLANATIONS} from '../../src/lib/content/project-explanations';
import rawCatalogue from '../../src/lib/content/data/catalogue.json';
import sources from '../../src/lib/content/data/sources.json';

describe('M10 static geographic interpretations and original feature explanations',()=>{
  it('retains every original 305 card title and claim unchanged',()=>{
    const original=rawCatalogue.filter(entry=>!entry.id.startsWith('astro:')).map(({id,title,summary,claims})=>({id,title,summary,claims})).sort((a,b)=>a.id.localeCompare(b.id,'en'));
    expect(original).toHaveLength(305);expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe('4bb6fa0c4329ce21bb9bc8c0814ebf62640248394c671fe94f4d03e60623775b');
  });
  it('supplies sourced themes for all 40 body/angle combinations without synthesized predictions',()=>{
    expect(CONTENT_CATALOGUE.filter(entry=>entry.kind==='astrocartography')).toHaveLength(15);
    for(const body of BODY_IDS)for(const angle of ['ac','dc','mc','ic']){
      const entries=[getContent('astro:overview')!,getContent(`astro:body:${body}`)!,getContent(`astro:angle:${angle}`)!];
      for(const entry of entries){expect(entry.kind).toBe('astrocartography');expect(entry.claims.every(claim=>claim.role==='tradition')).toBe(true);for(const claim of entry.claims){const [source]=getClaimSources(claim);expect(source!.id).toBe('almanac-astrocartography');expect(source!.author).toBe('Theresa Reed');expect(claim.section).toBeTruthy();}}
    }
    const budget=CONTENT_VALIDATION.budgets.find(page=>page.canonicalUrl.includes('almanac.com/astrocartography'))!;expect(budget.derivedWords).toBe(154);expect(budget.derivedWords).toBeLessThanOrEqual(180);
  });
  it('validates body/angle identity rather than silently serving a different theme',()=>{
    const changed=structuredClone(rawCatalogue);changed.find(entry=>entry.id==='astro:angle:ac')!.angleId='mc';expect(validateContentCatalogue(changed,sources).issues.join(' ')).toContain('metadata disagrees');
  });
  it('binds every original hover explanation to its exact registered immutable claim',()=>{
    for(const explanation of PROJECT_EXPLANATIONS){const registered=getSupplementalClaim(explanation.id)!;expect(registered.text).toBe(explanation.text);expect(registered.role).toBe('project-convention');expect(getProjectExplanation(explanation.id)).toBe(explanation);expect(()=>{(explanation as {text:string}).text='changed';}).toThrow(TypeError);}
    expect(getProjectExplanation('missing')).toBeUndefined();expect(getSupplementalClaim('missing')).toBeUndefined();expect(getSupplementalClaim('construction:W:0')).toBeDefined();
  });
});
