import {describe,expect,it} from 'vitest';
import {DEFAULT_PREFERENCES,LEGACY_PREFERENCES_KEY,PREFERENCES_KEY,readPreferences,writePreferences} from '../../src/lib/state/preferences';
describe('display-only preference persistence',()=>{
  it('migrates the previous display whitelist without resetting saved choices',()=>{
    const {cardSparkles: omitted,...prior}=DEFAULT_PREFERENCES;
    expect(omitted).toBe(true);
    const legacy={...prior,version:1,houseMode:'volumes',motion:'reduced',quality:'low'};
    expect(readPreferences({getItem:key=>key===LEGACY_PREFERENCES_KEY?JSON.stringify(legacy):null})).toEqual({...legacy,version:2,cardSparkles:true});
    expect(DEFAULT_PREFERENCES.houseMode).toBe('shells');
    expect(readPreferences(null).cardSparkles).toBe(true);
  });
  it('round-trips only the documented nonpersonal whitelist',()=>{
    const storage=new Map<string,string>(),adapter={getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>{storage.set(key,value);}};
    const settings={...DEFAULT_PREFERENCES,quality:'low' as const,labelScale:1.5,motion:'reduced' as const};
    expect(writePreferences(settings,adapter)).toBe(true);expect(readPreferences(adapter)).toEqual(settings);
    expect([...storage.keys()]).toEqual([PREFERENCES_KEY]);expect(Object.keys(JSON.parse(storage.get(PREFERENCES_KEY)!))).toEqual(Object.keys(DEFAULT_PREFERENCES));
    expect(writePreferences({...settings,instantMs:Date.UTC(2000,0,1),observer:{latitudeDeg:10,longitudeDeg:20}}as typeof settings,adapter)).toBe(false);
    expect(readPreferences(adapter)).toEqual(settings);
  });
  it('recovers from malformed, obsolete, out-of-range or unavailable storage',()=>{
    for(const raw of ['not json','{}',JSON.stringify({...DEFAULT_PREFERENCES,version:0}),JSON.stringify({...DEFAULT_PREFERENCES,earthOpacity:-1}),JSON.stringify({...DEFAULT_PREFERENCES,birth:'2000-01-01'})])expect(readPreferences({getItem:()=>raw})).toEqual(DEFAULT_PREFERENCES);
    expect(readPreferences({getItem:()=>{throw new Error('Unavailable');}})).toEqual(DEFAULT_PREFERENCES);
    expect(writePreferences({...DEFAULT_PREFERENCES},{setItem:()=>{throw new Error('Unavailable');}})).toBe(false);
    expect(readPreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });
});
