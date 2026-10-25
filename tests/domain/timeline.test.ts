import {describe,expect,it} from 'vitest';
import {MAX_INSTANT,MIN_INSTANT,PlaybackClock,explorationOffset,stepInstant,timelineWindow,TIMELINE_PRESETS} from '../../src/lib/domain/timeline';

describe('uniform timeline and explicit Gregorian UTC steps',()=>{
  it('clamps month/year ends without silently rolling into another month',()=>{
    expect(new Date(stepInstant(Date.UTC(2000,0,31,12,34,56),'month',1)).toISOString()).toBe('2000-02-29T12:34:56.000Z');
    expect(new Date(stepInstant(Date.UTC(2000,1,29,12),'year',1)).toISOString()).toBe('2001-02-28T12:00:00.000Z');
    expect(new Date(stepInstant(Date.UTC(2000,2,31),'month',-1)).toISOString()).toBe('2000-02-29T00:00:00.000Z');
    expect(new Date(stepInstant(Date.UTC(2100,0,31),'month',1)).toISOString()).toBe('2100-02-28T00:00:00.000Z');
    expect(new Date(stepInstant(Date.UTC(1900,0,31),'month',1)).toISOString()).toBe('1900-02-28T00:00:00.000Z');
  });
  it('uses elapsed 24-hour days across civil DST and clamps entire instants',()=>{
    const before=Date.UTC(2024,2,10,6,30);expect(stepInstant(before,'day',1)-before).toBe(86400000);
    expect(stepInstant(MIN_INSTANT,'minute',-1)).toBe(MIN_INSTANT);expect(stepInstant(MAX_INSTANT,'year',1)).toBe(MAX_INSTANT);
    expect(explorationOffset(before+7200000,before)).toBe('Exploring: +2 hours');expect(explorationOffset(before,before)).toBe('Birth moment');
  });
  it('window/zoom preserves current instant at both range ends and every preset',()=>{
    for(const center of [MIN_INSTANT,Date.UTC(2000,0,1),MAX_INSTANT])for(const duration of Object.values(TIMELINE_PRESETS)){
      const window=timelineWindow(center,duration);expect(window.startMs).toBeLessThanOrEqual(center);expect(window.endMs).toBeGreaterThanOrEqual(center);
      expect(window.startMs).toBeGreaterThanOrEqual(MIN_INSTANT);expect(window.endMs).toBeLessThanOrEqual(MAX_INSTANT);expect(window.endMs-window.startMs).toBe(duration);
    }
    expect(()=>timelineWindow(0,NaN)).toThrow();expect(()=>stepInstant(NaN,'day',1)).toThrow();
  });
});
describe('monotonic exact-snapshot playback',()=>{
  const instant=Date.UTC(2000,0,1);
  it('integrates elapsed clock time rather than frame count, in either direction',()=>{
    for(const direction of [1,-1]as const){const clock=new PlaybackClock(86400000,direction);clock.start(instant,100);
      expect(clock.tick(180,true)).toEqual({type:'request',instantMs:instant+direction*6912000});
      expect(clock.tick(350,true)).toEqual({type:'request',instantMs:instant+direction*21600000});
      expect(clock.tick(600,true)).toEqual({type:'request',instantMs:instant+direction*43200000});
    }
  });
  it('waits for a coherent calculation and pauses on sustained backpressure',()=>{
    const clock=new PlaybackClock(3600000,1);clock.start(instant,0);
    expect(clock.tick(80,false)).toEqual({type:'wait'});expect(clock.tick(200,false)).toEqual({type:'wait'});
    expect(clock.tick(600,false).type).toBe('pause');
  });
  it('does not catch up across clock interruption, resumption or a range boundary',()=>{
    const clock=new PlaybackClock(86400000,1);clock.start(instant,0);expect(clock.tick(2000,true).type).toBe('pause');
    clock.start(instant,3000);expect(clock.tick(3100,true)).toEqual({type:'request',instantMs:instant+8640000});
    clock.start(MAX_INSTANT-1000,0);expect(clock.tick(80,true)).toMatchObject({type:'pause',instantMs:MAX_INSTANT});
    clock.start(instant,100);expect(clock.tick(50,true).type).toBe('pause');
  });
});
