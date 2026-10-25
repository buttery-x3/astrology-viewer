import { describe,expect,it } from 'vitest';
import { ASPECT_TYPES,DEFAULT_ORBS } from '../../src/lib/domain/chart';
import { DEFAULT_ASPECT_DISPLAY,getAspectDetails,getVisibleAspects } from '../../src/lib/domain/aspect-presentation';
const bodies=[{id:'sun' as const,longitudeDeg:0,latitudeDeg:10},{id:'moon' as const,longitudeDeg:180,latitudeDeg:10},{id:'mars' as const,longitudeDeg:90,latitudeDeg:0}];
describe('retained aspect selection and display eligibility',()=>{
  for(const type of ASPECT_TYPES)it(`retains ${type.id} numerical details at and outside its orb`,()=>{
    const id=`aspect:sun-moon:${type.id}`;
    const pair=[{id:'sun' as const,longitudeDeg:0},{id:'moon' as const,longitudeDeg:type.angleDeg}];
    expect(getAspectDetails(pair,id)).toMatchObject({withinOrb:true,departureDeg:0,closeness:1});
    pair[1]!.longitudeDeg=type.angleDeg===180?173.9:type.angleDeg+6.1;
    expect(getAspectDetails(pair,id)).toMatchObject({id,withinOrb:false,closeness:0});
    expect(getVisibleAspects(pair,{...DEFAULT_ASPECT_DISPLAY,scope:'selected'},id)).toEqual([]);
  });
  it('distinguishes longitude eligibility from actual off-ecliptic sky separation',()=>{
    const result=getAspectDetails(bodies,'aspect:sun-moon:opposition')!;
    expect(result.withinOrb).toBe(true);expect(result.separationDeg).toBe(180);expect(result.actualSkySeparationDeg).toBeCloseTo(160,10);
    expect(getAspectDetails([{id:'sun',longitudeDeg:359},{id:'moon',longitudeDeg:1}],'aspect:sun-moon:conjunction')).toMatchObject({withinOrb:true,separationDeg:2,longitudeADeg:359,longitudeBDeg:1});
  });
  it('filters by enabled/type and explicit selected body/pair scope',()=>{
    const selected={...DEFAULT_ASPECT_DISPLAY,scope:'selected' as const};
    expect(getVisibleAspects(bodies,selected,null)).toEqual([]);expect(getVisibleAspects(bodies,selected,'house:1')).toEqual([]);
    expect(getVisibleAspects(bodies,selected,'body:mars')).toHaveLength(2);
    expect(getVisibleAspects(bodies,selected,'aspect:sun-moon:opposition')).toHaveLength(1);
    expect(getVisibleAspects(bodies,{...selected,enabled:false},'body:mars')).toEqual([]);
    expect(getVisibleAspects(bodies,{...selected,types:{...selected.types,square:false}},'body:mars')).toEqual([]);
  });
  it('rejects invalid or missing stable pairs and invalid orb settings',()=>{
    for(const id of ['aspect:moon-sun:opposition','aspect:sun-sun:conjunction','aspect:sun-pluto:trine','body:sun','aspect:sun-moon:unknown'])expect(getAspectDetails(bodies,id)).toBeNull();
    expect(()=>getAspectDetails(bodies,'aspect:sun-moon:opposition',{...DEFAULT_ORBS,opposition:15})).toThrow(RangeError);
    expect(getAspectDetails(bodies,'aspect:sun-moon:opposition',{...DEFAULT_ORBS,opposition:0})).toMatchObject({withinOrb:true,closeness:1});
    expect(Object.isFrozen(DEFAULT_ASPECT_DISPLAY.orbs)).toBe(true);
  });
});
