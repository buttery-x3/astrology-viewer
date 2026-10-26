import {describe,expect,it,vi} from 'vitest';
import {createLocationRouter} from '../../api/location-handler';

describe('geographic lookup and privacy boundary',()=>{
  it('returns comprehensive geographic identifiers including historical identities',async()=>{
    const route=createLocationRouter();
    for(const [latitude,longitude,zone] of [[51.5,0,'Europe/London'],[-33.8688,151.2093,'Australia/Sydney'],[12.826174,45.036933,'Asia/Aden']] as const){
      const response=await route(new URL(`http://local/api/timezone?latitude=${latitude}&longitude=${longitude}`));
      expect(response?.status).toBe(200);
      expect(response?.body).toMatchObject({zones:[zone],dataset:'geo-tz/all@8.1.10'});
    }
  });
  it('does not collapse ambiguous geographic zones',async()=>{
    const route=createLocationRouter({find:()=>['Asia/Shanghai','Asia/Urumqi']});
    expect((await route(new URL('http://local/api/timezone?latitude=43.8&longitude=87.5')))?.body).toMatchObject({zones:['Asia/Shanghai','Asia/Urumqi']});
  });
  it('rejects extra personal fields, blank/invalid coordinates, duplicate query fields and non-GET methods',async()=>{
    const route=createLocationRouter();
    for(const path of ['/api/places?q=Sydney&birthDate=2000-01-01','/api/timezone?latitude=&longitude=0','/api/timezone?latitude=91&longitude=0','/api/places?q=London&q=Sydney'])
      expect((await route(new URL(`http://local${path}`)))?.status).toBe(400);
    expect((await route(new URL('http://local/api/places?q=Sydney'),'POST'))?.status).toBe(405);
  });
  it('forwards only place text, returns disambiguating context and caches repeat searches',async()=>{
    const mock=vi.fn(async()=>new Response(JSON.stringify({results:[{id:1,name:'Sydney',admin1:'New South Wales',country:'Australia',latitude:-33.8688,longitude:151.2093,timezone:'Australia/Sydney'}]}),{status:200}));
    const route=createLocationRouter({fetch:mock as typeof fetch});
    const url=new URL('http://local/api/places?q=Sydney');
    expect((await route(url))?.body).toMatchObject({results:[{label:'Sydney, New South Wales, Australia'}]});
    await route(url);expect(mock).toHaveBeenCalledTimes(1);
    const outgoing=mock.mock.calls[0] as unknown as [URL];
    expect([...outgoing[0].searchParams.keys()]).toEqual(['name','count','language','format']);
  });
  it('provides recoverable failure instead of stale search results',async()=>{
    const route=createLocationRouter({fetch:vi.fn(async()=>new Response('unavailable',{status:503})) as typeof fetch});
    expect((await route(new URL('http://local/api/places?q=Paris')))?.status).toBe(503);
  });
});
