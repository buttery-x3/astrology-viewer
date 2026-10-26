<script lang="ts">
  import type { BodyId } from '../astronomy/ephemeris';
  import type { BoundaryHistorySettings, TrailDisplaySettings } from '../domain/trails';
  import type { TrailServiceState } from '../services/trails';
  import ContentCard from './ContentCard.svelte';

  let { settings, historySettings, bodyId, boundaryHouse, state, onChange, onHistoryChange, onRetry, onRetryHistory, onCancel, onCancelHistory }: {
    settings: TrailDisplaySettings; historySettings: BoundaryHistorySettings;
    bodyId: BodyId | null; boundaryHouse: number | null; state: TrailServiceState;
    onChange: (patch: Partial<TrailDisplaySettings>) => void;
    onHistoryChange: (patch: Partial<BoundaryHistorySettings>) => void;
    onRetry: () => void; onRetryHistory?: () => void; onCancel?: () => void; onCancelHistory?: () => void;
  } = $props();
  const uid = $props.id();
  const windows = [
    { ms: 3600000, label: '1 hour' }, { ms: 86400000, label: '1 day' }, { ms: 7 * 86400000, label: '1 week' },
    { ms: 30 * 86400000, label: '30 days' }, { ms: 365 * 86400000, label: '365 days' }, { ms: 3652.5 * 86400000, label: 'About 10 years' },
  ];
  const historyWindows = [{ ms: 3600000, label: '1 hour' }, { ms: 6 * 3600000, label: '6 hours' }, { ms: 12 * 3600000, label: '12 hours' }, { ms: 86400000, label: '24 hours' }];
  const counts = [1, 2, 3, 4, 5, 6, 7];
  const trailJob = $derived(state.trail);
  const historyJob = $derived(state.history);
  const result = $derived(trailJob.result?.bodyId === bodyId && trailJob.result?.frame === settings.frame ? trailJob.result : null);
  const history = $derived(historyJob.result?.house === boundaryHouse ? historyJob.result : null);
  const definedGhosts = $derived(history?.samples.filter(sample => sample.status !== 'undefined').length ?? 0);
  const undefinedGhosts = $derived(history?.samples.filter(sample => sample.status === 'undefined') ?? []);
  const jumpGhosts = $derived(history?.samples.filter(sample => sample.status === 'jump').length ?? 0);
  const historyStart = $derived(history?.samples[0]?.instantMs ?? history?.startMs);
  const historyEnd = $derived(history?.samples.at(-1)?.instantMs ?? history?.endMs);
  const bodyName = $derived(bodyId ? bodyId.charAt(0).toUpperCase() + bodyId.slice(1) : null);
  const format = (instantMs: number) => new Date(instantMs).toISOString().replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC');
  const frameName = $derived(settings.frame === 'stars' ? 'Relative to the stars' : 'Relative to the local horizon');
  const trailStatus = $derived(trailJob.status === 'loading' ? 'Loading trail samples' : trailJob.status === 'partial' ? 'Refining sampled interval' : trailJob.status === 'error' ? 'Trail needs attention' : trailJob.status === 'ready' ? result?.status === 'limited' ? 'Limited trail interval' : 'Trail ready' : 'Trail idle');

  function toggleTrail(enabled: boolean) { if (!enabled) onCancel?.(); onChange({ enabled }); }
  function toggleHistory(enabled: boolean) { if (!enabled) onCancelHistory?.(); onHistoryChange({ enabled }); }
</script>

<section class="dock-section trail-controls" aria-labelledby={`${uid}-heading`}>
  <h2 id={`${uid}-heading`}>Trails & boundary history</h2>
  <label class="trail-check" data-feature-id="layer:trails"><input type="checkbox" checked={settings.enabled} onchange={event => toggleTrail(event.currentTarget.checked)} /><span>Show selected body trail</span></label>
  <p class="target-note">{bodyName ? `Tracing ${bodyName}` : 'Select a celestial body to trace its motion.'}</p>
  <label class="trail-field" for={`${uid}-reference`}>Trail reference<select id={`${uid}-reference`} aria-label="Trail reference" value={settings.frame} onchange={event => onChange({ frame: event.currentTarget.value as TrailDisplaySettings['frame'] })}><option value="stars">Relative to the stars</option><option value="horizon">Relative to the local horizon</option></select></label>
  <label class="trail-field" for={`${uid}-window`}>Trail window<select id={`${uid}-window`} aria-label="Trail window" value={settings.windowMs} onchange={event => onChange({ windowMs: Number(event.currentTarget.value) })}>{#if !windows.some(item => item.ms === settings.windowMs)}<option value={settings.windowMs}>Custom interval</option>{/if}{#each windows as item (item.ms)}<option value={item.ms}>{item.label}</option>{/each}</select></label>
  <p class="trail-note">Past: fading solid · future: dashed. Ticks label time; arrows show direction.</p>
  {#if settings.enabled && bodyId}
    <div class="sampling-status" aria-label="Trail sampling status">
      <p class="status-title" role="status">{trailStatus}</p>
      <p class="trail-note">{frameName}</p>
      {#if trailJob.status === 'loading'}<progress max="1" aria-label="Loading trail samples"></progress>{:else if trailJob.status === 'partial'}<progress max="1" value={trailJob.progress} aria-label="Requested trail interval covered"></progress><p class="trail-note">{Math.round(trailJob.progress * 100)}% of the requested interval covered so far.</p>{/if}
      {#if trailJob.error}<p class="sampling-warning" role="alert">{trailJob.error}</p><button class="text-button" onclick={onRetry}>Retry trail sampling</button>{/if}
      {#if result}
        <dl class="sampling-data"><div><dt>Sampled points</dt><dd>{result.samples.length.toLocaleString('en-GB')}</dd></div><div><dt>Point budget</dt><dd>{settings.maxVertices.toLocaleString('en-GB')}</dd></div></dl>
        <div class="sample-interval"><strong>Shown sampled interval</strong><time>{format(result.startMs)}</time><time>{format(result.endMs)}</time></div>
        {#if result.startMs !== result.requestedStartMs || result.endMs !== result.requestedEndMs}<details class="interval-request"><summary>Requested interval</summary><time>{format(result.requestedStartMs)}</time><time>{format(result.requestedEndMs)}</time></details>{/if}
        {#if result.limits.length}<div class="sampling-limits"><strong>Sampling limits</strong>{#each result.limits as limit (limit)}<p>{limit}</p>{/each}</div>{/if}
      {:else if trailJob.status === 'idle'}<p class="trail-note">Waiting for a calculated snapshot and a trail request.</p>{/if}
    </div>
  {/if}

  <details class="trail-explanation"><summary>How trail references differ</summary><ContentCard id="concept:trails" compact heading={false} /><ContentCard id="concept:retrograde" compact /></details>

  <div class="boundary-history-controls">
    <h3>Selected boundary history</h3>
    <label class="trail-check" data-feature-id="layer:history"><input type="checkbox" checked={historySettings.enabled} onchange={event => toggleHistory(event.currentTarget.checked)} /><span>Show selected boundary history</span></label>
    <p class="target-note">{boundaryHouse ? `C${boundaryHouse} · discrete celestial-reference ghosts` : 'Select an indexed house boundary to inspect its history.'}</p>
    <label class="trail-field" for={`${uid}-history-window`}>History window<select id={`${uid}-history-window`} aria-label="History window" value={historySettings.windowMs} onchange={event => onHistoryChange({ windowMs: Number(event.currentTarget.value) })}>{#if !historyWindows.some(item => item.ms === historySettings.windowMs)}<option value={historySettings.windowMs}>Custom short interval</option>{/if}{#each historyWindows as item (item.ms)}<option value={item.ms}>{item.label}</option>{/each}</select></label>
    <label class="trail-field" for={`${uid}-history-count`}>History sample count<select id={`${uid}-history-count`} aria-label="History sample count" value={historySettings.count} onchange={event => onHistoryChange({ count: Number(event.currentTarget.value) })}>{#each counts as count (count)}<option value={count}>{count} {count === 1 ? 'sample' : 'samples'}</option>{/each}</select></label>
    <p class="trail-note">At most seven labelled ghosts. Whole Sign jumps stay discrete; undefined samples leave gaps.</p>
    {#if historySettings.enabled && boundaryHouse}
      <div class="sampling-status" aria-label="Boundary history status">
        <p class="status-title" role="status">{historyJob.status === 'loading' ? 'Loading boundary history' : historyJob.status === 'partial' ? 'Sampling boundary history' : historyJob.status === 'error' ? 'Boundary history needs attention' : historyJob.status === 'ready' ? history?.status === 'limited' ? 'Limited boundary history' : 'Boundary history ready' : 'Boundary history idle'}</p>
        {#if historyJob.status === 'loading' || historyJob.status === 'partial'}<progress max="1" value={historyJob.progress} aria-label="Boundary history sampling progress"></progress>{/if}
        {#if historyJob.error}<p class="sampling-warning" role="alert">{historyJob.error}</p><button class="text-button" onclick={() => (onRetryHistory ?? onRetry)()}>Retry boundary history</button>{/if}
        {#if history}
          <dl class="sampling-data"><div><dt>Defined ghosts</dt><dd>{definedGhosts} / {history.samples.length}</dd></div>{#if jumpGhosts}<div><dt>Discrete jump samples</dt><dd>{jumpGhosts}</dd></div>{/if}</dl>
          {#if historyStart !== undefined && historyEnd !== undefined}<div class="sample-interval"><strong>Sampled history interval</strong><time>{format(historyStart)}</time><time>{format(historyEnd)}</time></div>{/if}
          {#if history.limits.length}<div class="sampling-limits"><strong>History limits</strong>{#each history.limits as limit (limit)}<p>{limit}</p>{/each}</div>{/if}
          {#if undefinedGhosts.length}<details class="undefined-samples"><summary>Unavailable samples · {undefinedGhosts.length}</summary>{#each undefinedGhosts as sample (sample.instantMs)}<p><time>{format(sample.instantMs)}</time>{sample.reason}</p>{/each}</details>{/if}
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .trail-controls{flex-shrink:0}.trail-check{display:flex;align-items:flex-start;gap:9px;font-size:0.8125rem;line-height:1.65;color:#bdd0e2;cursor:pointer;margin:12px 0 8px}.trail-check input{accent-color:var(--cyan);width:13px;height:13px;flex-shrink:0;margin:2px 0 0}.target-note{font-size:0.75rem;line-height:1.7;color:#cbb98f;margin:7px 0 13px}.trail-field{display:grid;gap:7px;font-size:0.8125rem;line-height:1.6;color:#b6cae0;margin:13px 0}.trail-field select{min-width:0;font-size:0.8125rem}.trail-note{font-size:0.75rem;line-height:1.75;color:#96acc5;margin:8px 0}.sampling-status{border:1px solid #344c63;border-radius:6px;background:#122238;padding:11px;margin-top:14px}.status-title{font-size:0.8125rem;line-height:1.7;color:#bed8de}.sampling-status progress{display:block;width:100%;height:6px;accent-color:#8bbfc8;margin:12px 0}.sampling-status .text-button{font-size:0.8125rem;color:#b8dce2;line-height:1.7}.sampling-warning{font-size:0.75rem;line-height:1.75;color:#e5c098;margin:8px 0}
  .sampling-data{display:grid;gap:9px;margin:11px 0}.sampling-data>div{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.sampling-data dt{font-size:0.75rem;color:#9ab1cc;line-height:1.6}.sampling-data dd{font-size:0.75rem;color:#caddeb;font-variant-numeric:tabular-nums;margin:0;line-height:1.6}.sample-interval{display:grid;gap:4px;margin:12px 0;font-size:0.6875rem;line-height:1.7;color:#b6c9dd;font-variant-numeric:tabular-nums}.sample-interval strong{font-size:0.75rem;color:#9db8d0;font-weight:500}.sample-interval time{display:block;overflow-wrap:anywhere}.sampling-limits{font-size:0.75rem;line-height:1.7;border-top:1px solid #566078;padding-top:10px;margin-top:10px;color:#d6bd96}.sampling-limits strong{font-size:0.75rem;font-weight:500;color:#e2c89d}.sampling-limits p{margin-top:6px}.trail-controls summary{font-size:0.75rem;line-height:1.7;color:#abc5d5;cursor:pointer}.interval-request{margin-top:10px}.interval-request time{display:block;font-size:0.6875rem;color:#9bb1cb;line-height:1.7;margin-top:5px}.trail-explanation{border-top:1px solid #30435a;margin-top:17px;padding-top:12px}.boundary-history-controls{border-top:1px solid #30435a;margin-top:19px;padding-top:16px}.boundary-history-controls h3{font-size:0.8125rem;font-weight:500;color:#cad9e9;margin:0 0 9px}.undefined-samples{margin-top:12px}.undefined-samples p{font-size:0.75rem;color:#c7b79d;line-height:1.7;margin-top:8px}.undefined-samples time{display:block;font-size:0.6875rem;color:#a7b7cc;font-variant-numeric:tabular-nums}
</style>
