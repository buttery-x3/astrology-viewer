<script lang="ts">
  import { BODY_IDS, type EphemerisSnapshot } from '../astronomy/ephemeris';
  import { DEFAULT_EARTH_PROJECTIONS, earthHouseAvailability, type EarthProjectionSettings } from '../domain/earth-projections';
  import { BODY_IDENTITY } from '../domain/hover-card-themes';
  import { GEOGRAPHIC_ANGLE_KEY, GEOGRAPHIC_IDENTITY_NOTE } from '../domain/geographic-line-style';
  import { getContent } from '../content';
  import GeographicAngleMarker from './GeographicAngleMarker.svelte';
  let { settings, snapshot, onChange }: { settings: EarthProjectionSettings; snapshot: EphemerisSnapshot | null; onChange: (patch: Partial<EarthProjectionSettings>) => void } = $props();
  const houseAvailability=$derived(earthHouseAvailability(snapshot?.houses[0]));
</script>

<section class="dock-section earth-controls" aria-label="Earth projection controls">
  <h2>Earth projections</h2>
  <label data-feature-id="layer:earthProjections"><input type="checkbox" aria-label="Earth projections" checked={settings.enabled} onchange={event=>onChange({enabled:event.currentTarget.checked})}/>Show Earth projections</label>
  <label data-feature-id="layer:earthHouses"><input type="checkbox" aria-label="Projected house sections" checked={settings.houses} onchange={event=>onChange({houses:event.currentTarget.checked})}/>House sections</label>
  <p class="field-note">The current chart's houses projected onto the globe.</p>
  {#if snapshot && houseAvailability.status==='undefined'}<p class="projection-warning" role="status">House sections unavailable: {houseAvailability.reason}</p>{/if}
  <label class="range-field">House projection opacity <output>{Math.round(settings.houseOpacity*100)}%</output><input aria-label="House projection opacity" type="range" min="0" max="0.7" step="0.01" value={settings.houseOpacity} oninput={event=>onChange({houseOpacity:Number(event.currentTarget.value)})}/></label>
  <label data-feature-id="layer:astrocartography"><input type="checkbox" aria-label="Astrocartography lines" checked={settings.astrocartography} onchange={event=>onChange({astrocartography:event.currentTarget.checked})}/>Astrocartography</label>
  <p class="field-note">{getContent('astro:overview')?.claims[0]?.text}</p>
  <label class="range-field">Geographic line opacity <output>{Math.round(settings.astroOpacity*100)}%</output><input aria-label="Geographic line opacity" type="range" min="0.1" max="1" step="0.01" value={settings.astroOpacity} oninput={event=>onChange({astroOpacity:Number(event.currentTarget.value)})}/></label>
  <button class="text-button projection-reset" onclick={() => onChange({houseOpacity:DEFAULT_EARTH_PROJECTIONS.houseOpacity,astroOpacity:DEFAULT_EARTH_PROJECTIONS.astroOpacity})}>Reset projection appearance</button>
  <details><summary>Geographic line filters</summary>
    <fieldset><legend>Angular lines</legend>{#each GEOGRAPHIC_ANGLE_KEY as item (item.angle)}<label><input type="checkbox" aria-label={`${item.name} · ${item.short}`} checked={settings.angles[item.angle]} onchange={event=>onChange({angles:{...settings.angles,[item.angle]:event.currentTarget.checked}})}/><GeographicAngleMarker angle={item.angle}/>{item.label}</label>{/each}</fieldset>
    <fieldset><legend>Bodies on Earth</legend>{#each BODY_IDS as id (id)}<label><input type="checkbox" aria-label={`${BODY_IDENTITY[id].name} geographic lines`} checked={settings.bodies[id]} onchange={event=>onChange({bodies:{...settings.bodies,[id]:event.currentTarget.checked}})}/><span style:color={BODY_IDENTITY[id].color} aria-hidden="true">{BODY_IDENTITY[id].glyph}</span>{BODY_IDENTITY[id].name}</label>{/each}</fieldset>
  </details>
  <p class="field-note">Map time: displayed moment. {GEOGRAPHIC_IDENTITY_NOTE}</p>
</section>

<style>
  .earth-controls>label,.earth-controls fieldset label{display:flex;align-items:center;gap:8px;color:#c4d7e8;font-size:.82rem;line-height:1.6;margin:12px 0}.earth-controls input[type=checkbox]{width:15px;height:15px;accent-color:#98d9df;flex-shrink:0}.earth-controls .range-field{display:grid;grid-template-columns:1fr auto}.range-field input{grid-column:1/-1;width:100%;height:25px;accent-color:#9fd3dd}.range-field output{font-variant-numeric:tabular-nums;color:#9cd4de}.earth-controls summary,.earth-controls legend{font-size:.8rem;color:#c8d8e8;line-height:1.6}.earth-controls fieldset{margin:12px 0;padding:10px 0;border:0;border-top:1px solid #34465c}.projection-warning{font-size:.8rem;line-height:1.6;color:#e6bc8b;background:#302d35;border:1px solid #65543c;padding:10px;border-radius:6px}
  .projection-reset{font-size:.76rem;margin:0 0 14px}
</style>
