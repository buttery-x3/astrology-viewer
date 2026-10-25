import { describe, expect, it } from 'vitest';
import { REQUIRED_CONTENT_IDS } from '../../src/lib/content/validation';
import { WIKIPEDIA_OVERVIEWS, getWikipediaOverviews } from '../../src/lib/content/wikipedia';

describe('Wikipedia concept navigation, distinct from claim citations',()=>{
  it('covers all65required base concepts without inventing Wikipedia placement support',()=>{
    const concepts=REQUIRED_CONTENT_IDS.filter(id=>!id.startsWith('body-in-'));
    expect(concepts).toHaveLength(65);
    for(const id of concepts)expect(getWikipediaOverviews(id).length,id).toBeGreaterThan(0);
    for(const id of REQUIRED_CONTENT_IDS.filter(id=>id.startsWith('body-in-')))expect(getWikipediaOverviews(id),id).toEqual([]);
  });
  it('uses fixed HTTPS Wikipedia article links without credentials, search payloads or external scripts',()=>{
    for(const links of Object.values(WIKIPEDIA_OVERVIEWS))for(const link of links){
      const url=new URL(link.url);
      expect(url.origin).toBe('https://en.wikipedia.org');expect(url.pathname).toMatch(/^\/wiki\//);
      expect(url.username+url.password+url.search).toBe('');expect(link.title.trim()).not.toBe('');
    }
  });
  it('includes noncatalogue Earth/observer/constellation overviews and stays empty for unknown features',()=>{
    expect(getWikipediaOverviews('reference:earth')[0]?.title).toBe('Earth');
    expect(getWikipediaOverviews('reference:observer')[0]?.title).toBe('Geographic coordinate system');
    expect(getWikipediaOverviews('constellation:ori')[0]?.title).toBe('IAU designated constellations');
    expect(getWikipediaOverviews('unsupported:feature')).toEqual([]);
  });
});
