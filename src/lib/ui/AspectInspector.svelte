<script lang="ts">
  import type { EphemerisSnapshot } from '../astronomy/ephemeris';
  import { ASPECT_TYPES } from '../domain/chart';
  import { getAspectDetails, type AspectDisplaySettings } from '../domain/aspect-presentation';
  import ContentCard from './ContentCard.svelte';

  let { snapshot, selectedId, settings, onSelect, onFocus }: {
    snapshot: EphemerisSnapshot | null;
    selectedId: string;
    settings: AspectDisplaySettings;
    onSelect: (id: string) => void;
    onFocus: () => void;
  } = $props();
  const aspect = $derived(snapshot ? getAspectDetails(snapshot.bodies, selectedId, settings.orbs) : null);
  const type = $derived(ASPECT_TYPES.find(item => item.id === aspect?.type));
  const visible = $derived(Boolean(aspect?.withinOrb && settings.enabled && settings.types[aspect.type]));
  const name = (bodyId: string) => bodyId[0]!.toUpperCase() + bodyId.slice(1);
  const degrees = (value: number) => `${value.toFixed(3)}°`;
</script>

{#if aspect && type}
  <div class="selected-heading aspect-heading"><span class="eyebrow">LONGITUDE ASPECT</span><h2>{type.name}</h2><p>{name(aspect.bodyA)} · {name(aspect.bodyB)}</p></div>
  <section class="inspector-section aspect-measurement">
    <h3>Measured relationship</h3>
    <div class="pair-actions"><button onclick={() => onSelect(`body:${aspect.bodyA}`)}>{name(aspect.bodyA)} →</button><button onclick={() => onSelect(`body:${aspect.bodyB}`)}>{name(aspect.bodyB)} →</button></div>
    <dl class="data-list">
      <div><dt>{name(aspect.bodyA)} longitude</dt><dd>{degrees(aspect.longitudeADeg)}</dd></div>
      <div><dt>{name(aspect.bodyB)} longitude</dt><dd>{degrees(aspect.longitudeBDeg)}</dd></div>
      <div><dt>Longitude separation</dt><dd>{degrees(aspect.separationDeg)}</dd></div>
      <div><dt>Exact target</dt><dd>{degrees(aspect.targetDeg)}</dd></div>
      <div><dt>Departure from exact</dt><dd>{degrees(aspect.departureDeg)}</dd></div>
      <div><dt>Configured orb</dt><dd>±{degrees(aspect.orbDeg)}</dd></div>
      <div><dt>Orb status</dt><dd>{aspect.withinOrb ? 'Within orb' : 'Outside orb'}</dd></div>
      <div class="actual-angle"><dt>Actual 3D sky angle</dt><dd>{aspect.actualSkySeparationDeg === undefined ? 'Unavailable' : degrees(aspect.actualSkySeparationDeg)}</dd></div>
    </dl>
    <p>The aspect uses longitude separation along the ecliptic. The bodies keep their actual latitude in the scene, so their three-dimensional angle can differ.</p>
    {#if !aspect.withinOrb}<div class="aspect-warning"><strong>Outside configured orb</strong><p>No active strand is drawn for this pair and type. Its measurements and the type’s general meaning remain available.</p></div>{:else if !visible}<p class="field-note">This aspect is within orb and hidden by the current layer or type filter.</p>{/if}
  </section>
  {#if visible}<button class="button secondary focus-button" onclick={onFocus}>Focus aspect <kbd>F</kbd></button>{/if}
  <ContentCard id={`aspect-type:${aspect.type}`} />
{:else}
  <section class="inspector-section"><h2>Aspect unavailable</h2><p>{snapshot ? 'This pair could not be resolved in the current snapshot.' : 'A calculated snapshot is needed to inspect this pair.'}</p></section>
{/if}

<style>
  .aspect-heading h2{font-size:1.5625rem}.pair-actions{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 19px}.pair-actions button{border:1px solid #385069;background:#17283d;border-radius:5px;padding:7px 10px;color:#a9d8dc;font-size:0.875rem;line-height:1.5}.pair-actions button:hover{background:#294158;border-color:#7c979f}
  .aspect-measurement .data-list dt{font-size:0.75rem}.aspect-measurement .data-list dd{font-size:0.8125rem}.aspect-measurement .data-list>div{gap:10px}.actual-angle{padding-top:13px;margin-top:2px;border-top:1px solid #34445c}.aspect-measurement>p{font-size:0.875rem;line-height:1.75;margin:16px 0 0;color:#b0c3d9}.aspect-warning{border:1px solid #80623f;background:#302a34;border-radius:6px;padding:10px 12px;font-size:0.8125rem;color:#d4bda0;line-height:1.7;margin-top:16px}.aspect-warning strong{font-size:0.8125rem;color:#e8c794}.aspect-warning p{font-size:0.875rem;line-height:1.7;margin:5px 0 0;color:#ccbaa1}
</style>
