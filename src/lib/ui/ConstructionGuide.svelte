<script lang="ts">
  import { HOUSE_SYSTEMS, type EphemerisSnapshot } from '../astronomy/ephemeris';
  import { buildHouseConstruction, type ConstructionSettings } from '../domain/house-construction';
  import ContentCard from './ContentCard.svelte';

  let { snapshot, settings, onChange, onSelect, onFocus }: {
    snapshot: EphemerisSnapshot | null;
    settings: ConstructionSettings;
    onChange: (patch: Partial<ConstructionSettings>) => void;
    onSelect: (id: string) => void;
    onFocus: () => void;
  } = $props();
  const uid = $props.id();
  const houseNumbers = Array.from({ length: 12 }, (_, index) => index + 1);
  const primary = $derived(snapshot?.houses[0]);
  const guide = $derived(snapshot && primary ? buildHouseConstruction(snapshot, primary, settings) : null);
  const step = $derived(guide?.steps[settings.stage]);
  const systemName = $derived(primary ? HOUSE_SYSTEMS.find(item => item.id === primary.system)?.name ?? primary.system : null);
  const sources = $derived([...new Map((guide?.sources ?? []).map(source => [`${source.url}|${source.section}`, source])).values()]);
  const degrees = (value: number | null | undefined, digits = 6) => value === null || value === undefined ? 'Unavailable' : `${value.toFixed(digits)}°`;
  function chooseBoundary(house: number) {
    onChange({ boundaryHouse: house });
    onSelect(`boundary:${house}`);
  }
</script>

<section class="dock-section construction-guide" aria-labelledby={`${uid}-heading`}>
  <div class="guide-heading"><h2 id={`${uid}-heading`}>How this cusp is built</h2>{#if systemName}<span>{systemName}</span>{/if}</div>
  <p class="guide-intro">Explore the selected method’s construction for the displayed moment and observer.</p>
  <label class="guide-check"><input type="checkbox" checked={settings.enabled} onchange={event => onChange({ enabled: event.currentTarget.checked })} /><span>Show construction guide</span></label>
  <label class="guide-label" for={`${uid}-boundary`}>Construction boundary</label>
  <select id={`${uid}-boundary`} value={settings.boundaryHouse} onchange={event => chooseBoundary(Number(event.currentTarget.value))}>
    {#each houseNumbers as house (house)}<option value={house}>C{house} · begins house {house}</option>{/each}
  </select>

  {#if guide}
    <nav class="guide-stages" aria-label="Construction stages">
      {#each guide.steps as item, index (index)}
        <button class:active={settings.stage === index} aria-current={settings.stage === index ? 'step' : undefined} aria-label={`Stage ${index + 1}: ${item.title}`} onclick={() => onChange({ stage: index })}><span class="step-number" aria-hidden="true">{index + 1}</span><span>{item.title}</span></button>
      {/each}
    </nav>
    {#if step}
      <div class="step-explanation"><h3>{step.title}</h3><p>{step.explanation}</p></div>
    {/if}
    {#if guide.status === 'undefined'}
      <div class="guide-warning" role="status"><strong>Construction undefined here</strong><p>The selected method has no valid construction for this snapshot. No substitute guide is drawn.</p></div>
    {:else if guide.status === 'incomplete'}
      <div class="guide-warning" role="status"><strong>Construction not validated</strong><p>The reconstructed cusps do not meet the 0.01° agreement threshold. Treat this guide as incomplete.</p></div>
    {/if}
    {#if guide.notes.length}
      <div class="guide-notes">{#each guide.notes as note (note)}<p>{note}</p>{/each}</div>
    {/if}

    {#if guide.status === 'valid'}
      <label class="sweep-label" for={`${uid}-sweep`}><span>Construction sweep</span><output for={`${uid}-sweep`}>{Math.round(settings.progress * 100)}%</output></label>
      <input id={`${uid}-sweep`} class="guide-range" type="range" aria-label="Construction sweep" min="0" max="1" step="0.01" value={settings.progress} oninput={event => onChange({ progress: Number(event.currentTarget.value) })} />
      <p class="guide-note">The sweep illustrates this construction. It never edits chart time, the observer or calculated cusps.</p>
    {/if}

    {#if guide.nativeCuspDeg !== null || guide.computedCuspDeg !== null}
      <details class="validation-details" open>
        <summary>Cusp agreement check</summary>
        <dl class="guide-data">
          <div><dt>Engine cusp C{settings.boundaryHouse}</dt><dd>{degrees(guide.nativeCuspDeg)}</dd></div>
          <div><dt>Reconstructed cusp</dt><dd>{degrees(guide.computedCuspDeg)}</dd></div>
          <div><dt>Absolute residual</dt><dd>{degrees(guide.residualDeg === null ? null : Math.abs(guide.residualDeg))}</dd></div>
          <div><dt>Largest of all 12 residuals</dt><dd>{degrees(guide.maxResidualDeg)}</dd></div>
          <div><dt>Required agreement</dt><dd>≤ 0.01°</dd></div>
        </dl>
        <p class="guide-note">These values describe the final construction, including while the sweep is partway through.</p>
      </details>
    {/if}

    {#if guide.timing && Object.values(guide.timing).some(value => value !== undefined)}
      <details class="timing-details" open>
        <summary>Timing and angular units</summary>
        <dl class="guide-data">
          {#if guide.timing.declinationDeg !== undefined}<div><dt>{guide.system === 'K' ? 'MC degree declination' : 'Cusp point declination'}</dt><dd>{degrees(guide.timing.declinationDeg, 3)}</dd></div>{/if}
          {#if guide.timing.hourAngleDeg !== undefined}<div><dt>Hour angle</dt><dd>{degrees(guide.timing.hourAngleDeg, 3)}</dd></div>{/if}
          {#if guide.timing.semiDiurnalArcDeg !== undefined}<div><dt>Semi-diurnal arc</dt><dd>{degrees(guide.timing.semiDiurnalArcDeg, 3)}</dd></div>{/if}
          {#if guide.timing.semiNocturnalArcDeg !== undefined}<div><dt>Semi-nocturnal arc</dt><dd>{degrees(guide.timing.semiNocturnalArcDeg, 3)}</dd></div>{/if}
          {#if guide.timing.siderealOffsetDeg !== undefined && guide.system !== 'P'}<div><dt>Final sidereal offset</dt><dd>{degrees(guide.timing.siderealOffsetDeg, 3)}</dd></div>{/if}
          {#if guide.timing.siderealHours !== undefined}<div><dt>{guide.system === 'P' ? 'Hour angle · sidereal h' : 'Final sidereal interval'}</dt><dd>{guide.timing.siderealHours.toFixed(6)} h</dd></div>{/if}
          {#if guide.timing.sweepSiderealOffsetDeg !== undefined}<div><dt>Sweep offset now</dt><dd>{degrees(guide.timing.sweepSiderealOffsetDeg, 3)}<small>{(guide.timing.sweepSiderealOffsetDeg / 15).toFixed(6)} sidereal h</small></dd></div>{/if}
          {#if guide.timing.fraction !== undefined}<div><dt>{guide.system === 'K' ? 'Signed MC arc fraction' : 'Semi-arc fraction'}</dt><dd>{(guide.timing.fraction * 100).toFixed(2)}%</dd></div>{/if}
        </dl>
        <p class="guide-note">Angular quantities are degrees. One sidereal hour corresponds to 15° of rotation; these are not civil clock hours.</p>
      </details>
    {/if}

    <div class="guide-actions">
      <button class="text-button" onclick={() => onSelect(`boundary:${settings.boundaryHouse}`)}>Inspect cusp C{settings.boundaryHouse} →</button>
      {#if settings.enabled && guide.status === 'valid'}<button class="text-button" onclick={onFocus}>Focus construction <kbd>F</kbd></button>{/if}
    </div>
    {#if sources.length}
      <details class="guide-sources">
        <summary>Construction sources</summary>
        {#each sources as source (`${source.url}|${source.section}`)}<a href={source.url} target="_blank" rel="noreferrer"><span>{source.title} ↗</span><small>{source.section}</small></a>{/each}
      </details>
    {/if}
    <ContentCard id={`system:${guide.system}`} compact />
  {:else}
    <p class="guide-note">A calculated chart is needed to inspect this method’s rule and cusp agreement.</p>
  {/if}
</section>

<style>
  .construction-guide{flex-shrink:0;color:var(--text)}
  .guide-heading{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}.guide-heading h2{margin:0}.guide-heading>span{font-size:10px;color:var(--gold)}
  .guide-intro{color:#a7b8ce;font-size:11px;line-height:1.7;margin:10px 0 14px}
  .guide-check{display:flex;gap:9px;align-items:flex-start;color:#c5d7e5;font-size:11px;line-height:1.6;cursor:pointer;margin:12px 0 15px}.guide-check input{accent-color:var(--cyan);width:13px;height:13px;flex-shrink:0;margin:2px 0 0}
  .guide-label{display:block;color:#bccde3;font-size:11px;margin-bottom:7px}.construction-guide select{font-size:11px;width:100%;min-width:0}
  .guide-stages{display:grid;gap:5px;margin:15px 0 12px}.guide-stages button{display:flex;align-items:center;gap:9px;text-align:left;border:1px solid #2d405a;border-radius:5px;padding:9px 8px;color:#a9bbd2;font-size:11px;line-height:1.5;background:#111e31}.guide-stages button:hover{background:#1c3048;border-color:#547390}.guide-stages button.active{border-color:#688687;background:#1b343e;color:#d8ece8}.step-number{display:flex;justify-content:center;align-items:center;border:1px solid #4a607e;border-radius:50%;width:19px;height:19px;flex-shrink:0;font-size:10px;color:#c9d9eb}.active .step-number{border-color:#8ebebd;color:#bde6e2}
  .step-explanation{border-left:2px solid #5b8e98;padding-left:11px;margin:13px 0}.step-explanation h3{font-size:11px;font-weight:500;color:#d5e2eb;margin:0 0 6px}.step-explanation p{font-size:11px;line-height:1.7;color:#b2c4d9;margin:0}
  .guide-note{font-size:10px;color:#91a7bf;line-height:1.7;margin:8px 0}.guide-notes{margin:12px 0}.guide-notes p{font-size:10px;line-height:1.75;color:#c8bd9f;margin:7px 0}
  .guide-warning{padding:10px 11px;margin:12px 0;background:#302936;border:1px solid #79623e;border-radius:5px;color:#d1bea2;font-size:10px;line-height:1.7}.guide-warning strong{font-size:11px;color:#e7c797}.guide-warning p{margin:5px 0 0}
  .sweep-label{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#c2d2e5;margin:15px 0 7px}.sweep-label output{color:var(--cyan);font-variant-numeric:tabular-nums}.guide-range{display:block;width:100%;padding:0;height:22px;accent-color:var(--cyan);cursor:pointer}
  .validation-details,.timing-details,.guide-sources{border-top:1px solid #2c3c52;margin-top:15px;padding-top:12px}.construction-guide summary{color:#c9d8ea;font-size:11px;line-height:1.6;cursor:pointer}
  .guide-data{display:grid;gap:9px;margin:12px 0 0}.guide-data>div{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.guide-data dt{font-size:10px;color:#91a7c0;line-height:1.5}.guide-data dd{font-size:10px;color:#d4deed;font-variant-numeric:tabular-nums;margin:0;text-align:right;line-height:1.5;flex-shrink:0}
  .guide-data dd small{display:block;font-size:9px;color:#a9cbd4;margin-top:3px}
  .guide-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.guide-actions .text-button{font-size:10px;color:#9fd4d8;line-height:1.7}.guide-actions kbd{font-size:9px}
  .guide-sources a{display:grid;gap:4px;color:#9bcfd4;font-size:11px;line-height:1.6;overflow-wrap:anywhere;margin-top:11px}.guide-sources small{font-size:9px;line-height:1.6;color:#9eafc7}
</style>
