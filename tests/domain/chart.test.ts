import {describe,expect,it} from 'vitest';
import {calculateAspects,classifyLongitude,housePartition,longitudeSeparation,zodiacSign,ASPECT_TYPES,DEFAULT_ORBS} from '../../src/lib/domain/chart';
import type {HouseResult} from '../../src/lib/astronomy/ephemeris';
import reference from '../fixtures/native-swiss.json';

describe('longitude classification preserves house identity',()=>{
  it('uses tropical30degree divisions and exact normalized boundaries',()=>{
    expect(zodiacSign(0)).toMatchObject({name:'Aries',degree:0});
    expect(zodiacSign(30)).toMatchObject({name:'Taurus',degree:0});
    expect(zodiacSign(360)).toMatchObject({name:'Aries',degree:0});
    expect(zodiacSign(-1)).toMatchObject({name:'Pisces',degree:29});
  });
  it('classifies every native interval midpoint and exact cusp, including reversed polar systems',()=>{
    const normal=reference.cases.flatMap(c=>c.observers.flatMap(o=>o.houses));
    for(const fixture of [...normal,...reference.polarCase.houses]){
      const house=fixture as HouseResult,partition=housePartition(house);
      if(house.status==='undefined'){expect(partition.status).toBe('undefined');continue;}
      expect(partition.status).toBe('valid');
      if(partition.status!=='valid')throw new Error('Unexpected invalid fixture partition.');
      for(const interval of partition.intervals){
        expect(classifyLongitude(house,interval.startDeg)).toEqual({status:'valid',house:interval.house});
        expect(classifyLongitude(house,interval.startDeg+interval.direction*interval.widthDeg/2)).toEqual({status:'valid',house:interval.house});
      }
    }
  });
  it('rejects degenerate or inconsistent indexed boundaries',()=>{
    const invalid:HouseResult={system:'E',status:'valid',cusps:Array(12).fill(10),ascendantDeg:10,midheavenDeg:280,armcDeg:280};
    expect(classifyLongitude(invalid,30).status).toBe('undefined');
  });
});

describe('major longitude aspects',()=>{
  it('measures shortest longitude separation through0degrees',()=>{
    expect(longitudeSeparation(359,1)).toBe(2);
    expect(longitudeSeparation(-1,181)).toBe(178);
  });
  for(const type of ASPECT_TYPES){
    it(`recognises ${type.id}, its orb edge and eligibility`,()=>{
      const pair=[{id:'sun' as const,longitudeDeg:0},{id:'moon' as const,longitudeDeg:type.angleDeg}];
      expect(calculateAspects(pair).find(a=>a.type===type.id)).toMatchObject({departureDeg:0,orbDeg:6,closeness:1});
      const edge=type.angleDeg===180?174:type.angleDeg+6;
      expect(calculateAspects([{...pair[0]!},{...pair[1]!,longitudeDeg:edge}]).some(a=>a.type===type.id)).toBe(true);
      const outside=type.angleDeg===180?173.9:type.angleDeg+6.1;
      expect(calculateAspects([{...pair[0]!},{...pair[1]!,longitudeDeg:outside}]).some(a=>a.type===type.id)).toBe(false);
    });
  }
  it('allows exact-only orbs and forbids overlapping or invalid tolerances',()=>{
    expect(calculateAspects([{id:'sun',longitudeDeg:0},{id:'moon',longitudeDeg:90}],{...DEFAULT_ORBS,square:0})[0]?.closeness).toBe(1);
    expect(()=>calculateAspects([],{...DEFAULT_ORBS,square:15})).toThrow('orbs');
    expect(()=>calculateAspects([{id:'sun',longitudeDeg:0},{id:'sun',longitudeDeg:90}])).toThrow('unique');
  });
});
