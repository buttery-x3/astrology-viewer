/** Uniform UTC axis; calendar stepping is explicitly Gregorian and UTC-based. */
export const MIN_INSTANT=Date.UTC(1900,0,1);
export const MAX_INSTANT=Date.UTC(2101,0,1)-1;
export type StepUnit='minute'|'hour'|'day'|'month'|'year';
export type TimelinePreset='1h'|'1d'|'1w'|'1mo'|'1y'|'10y'|'custom';
export interface InstantWindow {startMs:number;endMs:number}
export const TIMELINE_PRESETS:Readonly<Record<Exclude<TimelinePreset,'custom'>,number>>=Object.freeze({
  '1h':3600000,'1d':86400000,'1w':7*86400000,'1mo':30*86400000,'1y':365*86400000,'10y':3652.5*86400000,
});
export function clampInstant(value:number):number{
  if(!Number.isFinite(value))throw new RangeError('A timeline instant must be finite.');
  return Math.max(MIN_INSTANT,Math.min(MAX_INSTANT,Math.trunc(value)));
}
export function timelineWindow(centerMs:number,durationMs:number):InstantWindow{
  if(!Number.isFinite(durationMs)||durationMs<=0)throw new RangeError('A timeline duration must be positive.');
  const center=clampInstant(centerMs),duration=Math.min(MAX_INSTANT-MIN_INSTANT,Math.max(60000,Math.round(durationMs)));
  const startMs=Math.max(MIN_INSTANT,Math.min(MAX_INSTANT-duration,Math.round(center-duration/2)));
  return {startMs,endMs:startMs+duration};
}
export function stepInstant(instantMs:number,unit:StepUnit,direction:1|-1):number{
  const instant=clampInstant(instantMs);
  if(direction!==1&&direction!==-1)throw new RangeError('Step direction must be forward or backward.');
  const elapsed={minute:60000,hour:3600000,day:86400000};
  if(unit in elapsed)return clampInstant(instant+elapsed[unit as keyof typeof elapsed]*direction);
  if(unit!=='month'&&unit!=='year')throw new RangeError('Unsupported step unit.');
  const date=new Date(instant),monthIndex=date.getUTCFullYear()*12+date.getUTCMonth()+direction*(unit==='year'?12:1);
  const year=Math.floor(monthIndex/12),month=monthIndex%12;
  const lastDay=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return clampInstant(Date.UTC(year,month,Math.min(date.getUTCDate(),lastDay),date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds(),date.getUTCMilliseconds()));
}
export function explorationOffset(instantMs:number,birthInstantMs:number):string{
  const delta=instantMs-birthInstantMs;
  if(delta===0)return 'Birth moment';
  const value=Math.abs(delta),sign=delta<0?'−':'+';
  const units=[['day',86400000],['hour',3600000],['minute',60000],['second',1000]] as const;
  for(const [label,size]of units)if(value>=size){const amount=value/size;return `Exploring: ${sign}${amount.toLocaleString('en-GB',{maximumFractionDigits:2})} ${label}${amount===1?'':'s'}`;}
  return `Exploring: ${sign}${value} ms`;
}

export type PlaybackTick={type:'wait'}|{type:'request';instantMs:number}|{type:'pause';reason:string;instantMs?:number};
/** Exact-snapshot transport: no extrapolation, frame counting or background catch-up. */
export class PlaybackClock {
  private anchorInstant=0;
  private anchorClock=0;
  private lastClock=0;
  private pendingSince:number|null=null;
  private lastRequest=0;
  constructor(private readonly speed:number,private readonly direction:1|-1){
    if(!Number.isFinite(speed)||speed<=0||speed>366*86400000||![1,-1].includes(direction))throw new RangeError('Invalid playback speed or direction.');
  }
  start(instantMs:number,monotonicMs:number):void{
    if(!Number.isFinite(monotonicMs))throw new RangeError('A monotonic clock value is required.');
    this.anchorInstant=this.lastRequest=clampInstant(instantMs);this.anchorClock=this.lastClock=monotonicMs;this.pendingSince=null;
  }
  tick(monotonicMs:number,ready:boolean):PlaybackTick{
    if(!Number.isFinite(monotonicMs)||monotonicMs<this.lastClock)return {type:'pause',reason:'Playback paused because its clock changed.'};
    const gap=monotonicMs-this.lastClock;this.lastClock=monotonicMs;
    if(gap>1000)return {type:'pause',reason:'Playback paused after an interruption. Resume from the displayed moment.'};
    if(!ready){this.pendingSince??=monotonicMs;return monotonicMs-this.pendingSince>500?{type:'pause',reason:'Playback paused while calculation catches up. Try a slower speed.'}:{type:'wait'};}
    this.pendingSince=null;
    const raw=this.anchorInstant+this.direction*this.speed*(monotonicMs-this.anchorClock)/1000,instantMs=clampInstant(raw);
    if(raw<=MIN_INSTANT||raw>=MAX_INSTANT)return {type:'pause',instantMs,reason:'Playback reached the supported date boundary.'};
    if(instantMs===this.lastRequest)return {type:'wait'};
    this.lastRequest=instantMs;return {type:'request',instantMs};
  }
}
