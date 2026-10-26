<script lang="ts">
  import { MAX_INSTANT, MIN_INSTANT, TIMELINE_PRESETS, type InstantWindow, type StepUnit, type TimelinePreset } from '../domain/timeline';

  let {
    displayedInstantMs, requestedInstantMs, birthInstantMs, window, preset, stepUnit, direction, speed,
    playing, busy, pauseReason, onSeek, onStep, onPresetChange, onZoom, onPlayPause, onDirectionChange,
    onSpeedChange, onStepUnitChange, onReturnBirth, onEditMoment,
  }: {
    displayedInstantMs: number; requestedInstantMs: number; birthInstantMs: number; window: InstantWindow;
    preset: TimelinePreset; stepUnit: StepUnit; direction: 1 | -1; speed: number; playing: boolean;
    busy: boolean; pauseReason: string | null;
    onSeek: (instantMs: number) => void; onStep: (direction: 1 | -1, count?: number) => void;
    onPresetChange: (preset: Exclude<TimelinePreset, 'custom'>) => void; onZoom: (factor: 0.5 | 2) => void;
    onPlayPause: () => void; onDirectionChange: (direction: 1 | -1) => void; onSpeedChange: (speed: number) => void;
    onStepUnitChange: (unit: StepUnit) => void; onReturnBirth: () => void; onEditMoment: () => void;
  } = $props();
  const uid = $props.id();
  const presets = Object.keys(TIMELINE_PRESETS) as Exclude<TimelinePreset, 'custom'>[];
  const presetLabels: Record<Exclude<TimelinePreset, 'custom'>, string> = { '1h': '1 hour', '1d': '1 day', '1w': '1 week', '1mo': '30 days', '1y': '365 days', '10y': 'About 10 years' };
  const units: StepUnit[] = ['minute', 'hour', 'day', 'month', 'year'];
  const speedOptions = [
    { value: 60000, label: '1 minute / real second' }, { value: 3600000, label: '1 hour / real second' },
    { value: 86400000, label: '1 day / real second' }, { value: 30 * 86400000, label: '30 days / real second' },
    { value: 365 * 86400000, label: '365 days / real second' },
  ];
  const duration = $derived(Math.max(1, window.endMs - window.startMs));
  const requestedInWindow = $derived(requestedInstantMs >= window.startMs && requestedInstantMs <= window.endMs);
  const displayedInWindow = $derived(displayedInstantMs >= window.startMs && displayedInstantMs <= window.endMs);
  const birthInWindow = $derived(birthInstantMs >= window.startMs && birthInstantMs <= window.endMs);
  const scrubValue = $derived(Math.max(window.startMs, Math.min(window.endMs, requestedInstantMs)));
  const requestedDiffers = $derived(displayedInstantMs !== requestedInstantMs);
  const position = (instantMs: number) => Math.max(0, Math.min(100, (instantMs - window.startMs) / duration * 100));
  const format = (instantMs: number) => new Date(instantMs).toISOString().replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC');
  const shortDate = (instantMs: number) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(instantMs);
  const speedLabel = $derived(speedOptions.find(item => item.value === speed)?.label ?? `${(speed / 1000).toLocaleString('en-GB')} simulated seconds / real second`);
  const scrubText = $derived(requestedInWindow ? `Requested ${format(requestedInstantMs)}${requestedDiffers ? `; displayed ${format(displayedInstantMs)}` : ''}` : `Window edge ${format(scrubValue)}; requested moment ${format(requestedInstantMs)} is outside this window`);

  function scrubKey(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Space') { event.preventDefault(); event.stopPropagation(); onPlayPause(); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation(); onStep(event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1, event.shiftKey ? 10 : 1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); event.stopPropagation(); onSeek(event.key === 'Home' ? window.startMs : window.endMs);
    }
  }
</script>

<footer class="timeline explorer-timeline" aria-label="Timeline controls">
  <div class="transport-row">
    <div class="transport-buttons" role="group" aria-label="Time transport">
      <button class="step-button" onclick={() => onStep(-1)} aria-label={`Previous ${stepUnit}`} title={`Previous ${stepUnit}`} disabled={requestedInstantMs <= MIN_INSTANT}>‹</button>
      <button class="play-button" class:playing onclick={onPlayPause} aria-label={playing ? 'Pause playback' : 'Play playback'} disabled={busy && !playing}><span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span><span>{playing ? 'Pause' : 'Play'}</span></button>
      <button class="step-button" onclick={() => onStep(1)} aria-label={`Next ${stepUnit}`} title={`Next ${stepUnit}`} disabled={requestedInstantMs >= MAX_INSTANT}>›</button>
    </div>
    <label class="transport-field"><span>Step</span><select aria-label="Step unit" value={stepUnit} onchange={event => onStepUnitChange(event.currentTarget.value as StepUnit)}>{#each units as unit (unit)}<option value={unit}>{unit === 'month' || unit === 'year' ? `Calendar ${unit}` : `1 ${unit}`}</option>{/each}</select></label>
    <label class="transport-field"><span>Direction</span><select aria-label="Playback direction" value={direction} onchange={event => onDirectionChange(Number(event.currentTarget.value) as 1 | -1)}><option value={1}>Forward →</option><option value={-1}>← Backward</option></select></label>
    <label class="transport-field speed-field"><span>Speed</span><select aria-label="Playback speed" value={speed} onchange={event => onSpeedChange(Number(event.currentTarget.value))}>{#if !speedOptions.some(item => item.value === speed)}<option value={speed}>{speedLabel}</option>{/if}{#each speedOptions as item (item.value)}<option value={item.value}>{item.label}</option>{/each}</select></label>
    <label class="transport-field window-field"><span>Window</span><select aria-label="Timeline window" value={preset} onchange={event => { if (event.currentTarget.value !== 'custom') onPresetChange(event.currentTarget.value as Exclude<TimelinePreset, 'custom'>); }}><option value="custom" disabled>Custom window</option>{#each presets as item (item)}<option value={item}>{presetLabels[item]}</option>{/each}</select></label>
    <div class="zoom-buttons" role="group" aria-label="Timeline window zoom"><button onclick={() => onZoom(0.5)} aria-label="Zoom timeline in" title="Zoom timeline in">＋</button><button onclick={() => onZoom(2)} aria-label="Zoom timeline out" title="Zoom timeline out">−</button></div>
    <div class="timeline-actions"><button onclick={onReturnBirth} class="return-birth" title="Return to the birth instant at the current observer location">↺ Return to birth instant</button><button onclick={onEditMoment}>Edit moment ↗</button></div>
  </div>
  <div class="scrubber-row">
    <div class="moment-status"><strong>Displayed <time>{format(displayedInstantMs)}</time></strong>{#if requestedDiffers}<span class="requested-note">Requested {format(requestedInstantMs)}{busy ? ' · calculating' : ' · not displayed'}</span>{:else}<span>{playing ? `${direction === 1 ? 'Forward' : 'Backward'} · ${speedLabel}` : 'Paused'}</span>{/if}</div>
    <div class="scrub-track">
      <input type="range" min={window.startMs} max={window.endMs} step="1" value={scrubValue} aria-label="Exploration time" aria-valuetext={scrubText} aria-describedby={`${uid}-timeline-help`} oninput={event => onSeek(Number(event.currentTarget.value))} onkeydown={scrubKey} />
      {#if displayedInWindow}<span class="displayed-marker" style:left={`${position(displayedInstantMs)}%`} title={`Displayed ${format(displayedInstantMs)}`} aria-hidden="true"></span>{/if}
      {#if birthInWindow}<span class="birth-marker" style:left={`${position(birthInstantMs)}%`} title={`Birth ${format(birthInstantMs)}`} aria-hidden="true"><i></i></span>{/if}
    </div>
    <div class="window-labels"><span>{shortDate(window.startMs)} UTC</span><span class="birth-location">{birthInWindow ? '◆ Birth marker' : `◆ Birth ${birthInstantMs < window.startMs ? 'before' : 'after'} window`}</span><span>{shortDate(window.endMs)} UTC</span></div>
    <div id={`${uid}-timeline-help`} class="timeline-help"><span>Thumb: requested · line: displayed · arrows: step · Shift+arrow: 10 steps · Space: play/pause</span><span>{stepUnit === 'month' || stepUnit === 'year' ? 'Gregorian UTC calendar steps clamp to the last valid day.' : stepUnit === 'day' ? 'Day step = 24 elapsed hours; the local clock can shift at DST.' : 'Steps use elapsed time on the UTC axis.'}</span></div>
    {#if !requestedInWindow || !displayedInWindow}<p class="window-note">{!requestedInWindow ? 'The requested moment is outside the visible window. ' : ''}{!displayedInWindow ? 'The displayed moment is outside the visible window. ' : ''}Choose a window preset to center on the current moment.</p>{/if}
    {#if requestedInstantMs <= MIN_INSTANT || requestedInstantMs >= MAX_INSTANT}<p class="window-note">At the {requestedInstantMs <= MIN_INSTANT ? 'start' : 'end'} of the supported UTC range.</p>{/if}
    {#if pauseReason}<p class="pause-reason" role="status">{pauseReason}</p>{/if}
  </div>
</footer>

<style>
  .timeline.explorer-timeline{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;align-content:center;height:100%;min-height:144px;padding:10px 24px 9px;background:#111b2c;border-top:1px solid #334159}
  .transport-row{display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap}.transport-buttons{display:flex;align-items:center;gap:4px;flex-shrink:0}.step-button{font-size:1.5625rem;color:#bad0e7;width:24px;height:30px}.play-button{display:flex;gap:7px;align-items:center;border:1px solid #4e697d;background:#203749;color:#c8e5e6;border-radius:5px;padding:6px 10px;font-size:0.75rem;line-height:1.5;min-width:65px;justify-content:center}.play-button.playing{border-color:#a49b73;color:#e9d3a7}.play-button:hover{background:#2c485c}
  .transport-field{display:flex;align-items:center;gap:6px;font-size:0.75rem;color:#93a9c3;min-width:0}.transport-field select{font-size:0.75rem;padding:6px 7px;min-width:0;width:auto;max-width:120px;height:30px;background:#152236}.speed-field select{max-width:178px}.window-field select{max-width:115px}.zoom-buttons{display:flex;gap:3px}.zoom-buttons button{height:29px;width:26px;border:1px solid #334b64;border-radius:5px;color:#aecfda;font-size:1rem}.zoom-buttons button:hover{background:#263e55}.timeline-actions{display:flex;gap:14px;margin-left:auto;align-items:center}.timeline-actions button{font-size:0.75rem;line-height:1.6;padding:5px 0;color:#a5c8d6;white-space:nowrap}
  .scrubber-row{min-width:0;position:relative}.moment-status{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:0.75rem;line-height:1.6;color:#93aac7;margin-bottom:3px}.moment-status strong{font-weight:500;color:#c8d8eb;font-variant-numeric:tabular-nums}.moment-status time{margin-left:5px}.moment-status .requested-note{color:#d9c492;font-variant-numeric:tabular-nums}
  .scrub-track{height:23px;position:relative;margin:0 7px}.scrub-track input{display:block;width:calc(100% + 14px);margin:0 -7px;padding:0;height:23px;accent-color:#9ddce3;cursor:ew-resize;background:transparent;border:0}.displayed-marker{position:absolute;top:2px;height:20px;width:2px;background:#e7edf6;pointer-events:none;transform:translateX(-1px);box-shadow:0 0 4px #10253b}.birth-marker{position:absolute;top:20px;height:9px;pointer-events:none;transform:translateX(-3px)}.birth-marker i{display:block;width:6px;height:6px;background:#dfbc7b;transform:rotate(45deg)}
  .window-labels{display:flex;justify-content:space-between;align-items:center;gap:10px;color:#829ab9;font-size:0.6875rem;line-height:1.7;margin-top:6px;font-variant-numeric:tabular-nums}.window-labels .birth-location{color:#d4bb8c}.timeline-help{display:flex;justify-content:space-between;gap:13px;flex-wrap:wrap;font-size:0.6875rem;line-height:1.6;color:#7f97b5;margin-top:3px}.pause-reason,.window-note{font-size:0.75rem;line-height:1.6;color:#ddc59a;margin-top:4px}
  @media(max-width:1180px){.timeline.explorer-timeline{padding-right:18px;padding-left:18px}.transport-row{gap:7px}.transport-field{gap:4px}.timeline-actions{gap:10px}.speed-field select{max-width:154px}.transport-field>span{display:none}.moment-status{font-size:0.6875rem}}
  @media(max-width:790px){.timeline.explorer-timeline{min-height:184px;padding:10px 16px}.transport-row{row-gap:7px}.timeline-actions{margin-left:auto}.moment-status{flex-wrap:wrap;gap:2px}.window-labels{font-size:0.6875rem}.timeline-help{font-size:0.6875rem;gap:3px}.timeline-help span{flex-basis:100%}}
</style>
