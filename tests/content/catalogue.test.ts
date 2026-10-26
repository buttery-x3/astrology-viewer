import { describe,expect,it } from 'vitest';
import catalogue from '../../src/lib/content/data/catalogue.json';
import sources from '../../src/lib/content/data/sources.json';
import supplemental from '../../src/lib/content/data/supplemental-claims.json';
import { BODY_IDS,type HouseResult } from '../../src/lib/astronomy/ephemeris';
import { CONTENT_CATALOGUE,CONTENT_SOURCES,CONTENT_VALIDATION,CONTENT_MANIFEST,REQUIRED_CONTENT_IDS,getContent,getSource,getClaimSources,resolveBodyContent,validateContentCatalogue,canonicalSourceUrl } from '../../src/lib/content';

describe('versioned static reviewed content',()=>{
  it('contains exactly 320 required concepts/placements and 90 attributed reviewed sources',()=>{
    expect(CONTENT_CATALOGUE).toHaveLength(320);expect(CONTENT_SOURCES).toHaveLength(90);
    expect(new Set(CONTENT_CATALOGUE.map((entry)=>entry.id))).toEqual(new Set(REQUIRED_CONTENT_IDS));
    expect(CONTENT_VALIDATION.valid).toBe(true);expect(CONTENT_MANIFEST.entryCount).toBe(320);
    expect(CONTENT_CATALOGUE.filter((entry)=>entry.kind==='body-in-sign')).toHaveLength(120);
    expect(CONTENT_CATALOGUE.filter((entry)=>entry.kind==='body-in-house')).toHaveLength(120);
    for(const entry of CONTENT_CATALOGUE){
      expect(entry.reviewStatus).toBe('reviewed');expect(entry.reviewedAt).toBe(entry.id.startsWith('astro:')?'2026-10-26':'2026-10-25');
      for(const claim of entry.claims){
        expect(claim.section.length).toBeGreaterThan(0);
        const resolved=getClaimSources(claim);expect(resolved).toHaveLength(claim.sourceIds.length);
        for(const source of resolved){expect(source.role).toBe(claim.role);expect(source.author).toBeTruthy();expect(new URL(source.url).protocol).toBe('https:');}
      }
    }
  });
  it('separates physical astronomy, tradition and product conventions at claim level',()=>{
    expect(getContent('body:sun')!.claims.map((claim)=>claim.role)).toEqual(['astronomy','tradition']);
    expect(getContent('sign:aries')!.claims.map((claim)=>claim.role)).toEqual(['project-convention','tradition']);
    expect(getContent('concept:evidence')!.claims.map((claim)=>claim.role)).toEqual(['evidence','project-convention']);
    expect(getContent('body-in-house:pluto:7')!.claims.every((claim)=>claim.role==='tradition')).toBe(true);
    expect(getContent('unknown')).toBeUndefined();expect(getSource('unknown')).toBeUndefined();
  });
  it('exposes immutable reviewed entries and source records',()=>{
    const card=getContent('body:sun')!;
    expect(()=>{card.title='Changed';}).toThrow(TypeError);
    expect(()=>{card.claims[0]!.sourceIds.push('invented');}).toThrow(TypeError);
    expect(()=>{getSource(card.claims[0]!.sourceIds[0]!)!.author='Changed';}).toThrow(TypeError);
    expect(getContent('body:sun')!.title).toBe('Sun');
  });
  it('resolves all ten bodies through every sign and house without synthesized text',()=>{
    for(const bodyId of BODY_IDS)for(let index=0;index<12;index++){
      const houses:HouseResult={system:'E',status:'valid',cusps:Array.from({length:12},(_,house)=>house*30),ascendantDeg:0,midheavenDeg:270,armcDeg:270};
      const result=resolveBodyContent({id:bodyId,longitudeDeg:index*30},houses,true);
      expect(result.bodyInSign).toBe(getContent(`body-in-sign:${bodyId}:${result.sign.signId}`));
      expect(result.houseNumber).toBe(index+1);expect(result.bodyInHouse).toBe(getContent(`body-in-house:${bodyId}:${index+1}`));
      expect(result.provisional).toBe(true);expect(result.qualification).toContain('provisional');
    }
  });
  it('retains body/sign interpretations with explicit undefined house state',()=>{
    const result=resolveBodyContent({id:'moon',longitudeDeg:359},{system:'P',status:'undefined',reason:'Requested polar construction failed.'});
    expect(result).toMatchObject({houseStatus:'undefined',house:null,bodyInHouse:null,houseNumber:null,houseReason:'Requested polar construction failed.',provisional:false,qualification:null});
    expect(result.bodyInSign.id).toBe('body-in-sign:moon:pisces');
    expect(resolveBodyContent({id:'sun',longitudeDeg:0},undefined).houseStatus).toBe('undefined');
  });
});

describe('coverage and canonical-source editorial gates',()=>{
  it('rejects missing/duplicate IDs, false review status and incorrect placement identity',()=>{
    expect(validateContentCatalogue(catalogue.slice(1),sources).valid).toBe(false);
    const duplicate=structuredClone(catalogue);duplicate[1]=duplicate[0]!;
    expect(validateContentCatalogue(duplicate,sources).issues.join(' ')).toContain('unique');
    const changed=structuredClone(catalogue) as any[];changed.find((entry)=>entry.id==='body-in-sign:moon:aries').kind='body';
    expect(validateContentCatalogue(changed,sources).issues.join(' ')).toContain('kind');
    changed[0].reviewStatus='draft';expect(validateContentCatalogue(changed,sources).valid).toBe(false);
  });
  it('rejects unknown sources, unsupported prose, missing attribution and role mismatches',()=>{
    const changed=structuredClone(catalogue);changed[0]!.claims[0]!.sourceIds=['invented'];
    expect(validateContentCatalogue(changed,sources).issues.join(' ')).toContain('Unresolved');
    changed[0]!.claims[0]!.sourceIds=catalogue[0]!.claims[0]!.sourceIds;changed[0]!.summary+=' Unsupported sentence.';
    expect(validateContentCatalogue(changed,sources).issues.join(' ')).toContain('unsupported');
    const changedSources=structuredClone(sources);changedSources[0]!.author='';expect(validateContentCatalogue(catalogue,changedSources).valid).toBe(false);
    changedSources[0]!.author='Author';changedSources[0]!.role='astronomy';expect(validateContentCatalogue(catalogue,changedSources).issues.join(' ')).toContain('role mismatch');
  });
  it('combines canonical aliases, budgets summary once and includes shared M5 prose',()=>{
    expect(canonicalSourceUrl('https://direct.skyscript.co.uk/temples/h10.html?tracking=yes#heading')).toBe('https://www.skyscript.co.uk/10.html');
    const validation=validateContentCatalogue(catalogue,sources,supplemental);
    expect(validation.valid).toBe(true);
    const swiss=validation.budgets.find((page)=>page.canonicalUrl.endsWith('/swehouse.c'))!;
    expect(swiss.derivedWords).toBeGreaterThan(150);expect(swiss.derivedWords).toBeLessThanOrEqual(180);
    const body=getContent('body:sun')!,source=getClaimSources(body.claims[0]!)[0]!;
    expect(validation.budgets.find((page)=>page.canonicalUrl===source.url)!.derivedWords).toBe(body.claims[0]!.text.split(/\s+/).length);
    const extra=[...supplemental,{id:'over-budget',text:Array(201).fill('word').join(' '),role:'method',sourceUrls:[source.url],section:'Added claim',sourceCode:'test'}];
    expect(validateContentCatalogue(catalogue,sources,extra).issues.join(' ')).toContain('exceeds');
  });
});
