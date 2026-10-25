<script lang="ts">
  import type { EphemerisSnapshot } from '../astronomy/ephemeris';
  import { ASPECT_TYPES, DEFAULT_ORBS, type OrbSettings } from '../domain/chart';
  import { getVisibleAspects, type AspectDisplaySettings } from '../domain/aspect-presentation';
  import { ASPECT_LEGEND } from '../scene/aspect-style';

  let { snapshot, settings, selectedId, onChange, onSelect }: {
    snapshot: EphemerisSnapshot | null; settings: AspectDisplaySettings; selectedId: string | null;
    onChange: (patch: Partial<AspectDisplaySettings>) => void; onSelect: (id: string) => void;
  } = $props();
  let draft = $state<Record<string,string>>({});
  let error = $state('');
  const visible = $derived(snapshot ? getVisibleAspects(snapshot.bodies,settings,selectedId) : []);
  const name = (id:string) => id[0]!.toUpperCase()+id.slice(1);
  function applyOrbs() {
    const orbs = Object.fromEntries(ASPECT_TYPES.map(type=>[type.id,Number(draft[type.id]??settings.orbs[type.id])])) as OrbSettings;
    if(ASPECT_TYPES.some(type=>(draft[type.id]??String(settings.orbs[type.id])).trim()===''||!Number.isFinite(orbs[type.id])||orbs[type.id]<0||orbs[type.id]>14.999)){
      error='Enter each orb from 0° to 14.999°.';return;
    }
    error='';draft={};onChange({orbs});
  }
</script>

<section class="dock-section aspect-controls" aria-labelledby="aspect-controls-title">
  <div class="section-title"><h2 id="aspect-controls-title">Aspect connections</h2><span class="count">{visible.length}</span></div>
  <label class="aspect-check"><input type="checkbox" checked={settings.enabled} onchange={event=>onChange({enabled:event.currentTarget.checked})} />Show aspect strands</label>
  <p class="field-note">Longitude relationships. Brightness means closeness to the exact angle; colours identify types.</p>
  <div class="aspect-types" role="group" aria-label="Aspect types">
    {#each ASPECT_LEGEND as type (type.id)}
      <label><input type="checkbox" checked={settings.types[type.id]} onchange={event=>onChange({types:{...settings.types,[type.id]:event.currentTarget.checked}})} /><span class="aspect-symbol" style:color={type.color} aria-hidden="true">{type.glyph}</span><span>{type.label}</span><i style:border-top={`1px ${type.dashed?'dashed':'solid'} ${type.color}`} aria-hidden="true"></i></label>
    {/each}
  </div>
  <label class="aspect-field">Aspect scope<select aria-label="Aspect scope" value={settings.scope} onchange={event=>onChange({scope:event.currentTarget.value as AspectDisplaySettings['scope']})}><option value="all">All eligible pairs</option><option value="selected">Selected body or pair</option></select></label>
  <details class="aspect-options"><summary>Orbs and appearance</summary>
    <form onsubmit={event=>{event.preventDefault();applyOrbs();}}>
      <p>Explicit default: ±6° for each type. Orbs are editable conventions, measured in longitude.</p>
      <div class="orb-grid">{#each ASPECT_TYPES as type (type.id)}<label>{type.name} orb<input aria-label={`${type.name} orb`} type="number" min="0" max="14.999" step="0.001" value={draft[type.id]??settings.orbs[type.id]} oninput={event=>draft={...draft,[type.id]:event.currentTarget.value}} /></label>{/each}</div>
      {#if error}<p role="alert" class="orb-error">{error}</p>{/if}
      <button class="button secondary" type="submit">Apply orb settings</button>
      <button type="button" class="text-button" onclick={()=>{draft={};error='';onChange({orbs:{...DEFAULT_ORBS}});}}>Reset 6° preset</button>
    </form>
    <label class="aspect-field">Background strand opacity<input type="range" min="0.04" max="0.5" step="0.01" value={settings.backgroundOpacity} oninput={event=>onChange({backgroundOpacity:Number(event.currentTarget.value)})} /></label>
    <label class="aspect-check"><input type="checkbox" checked={settings.glow} onchange={event=>onChange({glow:event.currentTarget.checked})} />Soft strand glow</label>
    <label class="aspect-check"><input type="checkbox" checked={settings.measurement} onchange={event=>onChange({measurement:event.currentTarget.checked})} />Selected longitude measurement</label>
  </details>
  <details class="aspect-pairs" open><summary>Matching pairs · {visible.length}</summary>
    <p class="field-note">Selecting a pair isolates its strand. Press Escape to clear the selection.</p>
    <div class="aspect-pair-list">{#each visible as aspect (aspect.id)}
      {@const type=ASPECT_TYPES.find(item=>item.id===aspect.type)!}
      <button aria-label={`Inspect ${name(aspect.bodyA)} ${type.name.toLowerCase()} ${name(aspect.bodyB)}`} aria-pressed={selectedId===aspect.id} class:chosen={selectedId===aspect.id} onclick={()=>onSelect(aspect.id)}><span aria-hidden="true">{type.glyph}</span><span>{name(aspect.bodyA)} · {name(aspect.bodyB)}<small>{type.name} · {aspect.departureDeg.toFixed(2)}° from exact</small></span></button>
    {/each}</div>
    {#if !visible.length}<p class="field-note">{!settings.enabled?'Enable strands to show eligible pairs.':settings.scope==='selected'?'Select a body or an aspect pair. Only relationships within the enabled type and orb settings are shown.':'No pairs meet these type and orb settings.'}</p>{/if}
  </details>
</section>

<style>
  .aspect-controls .section-title{margin-bottom:13px}.aspect-check,.aspect-types label{display:flex;align-items:center;gap:8px;font-size:11px;color:#b8c8dc;line-height:1.5;cursor:pointer}.aspect-check{margin-top:12px}.aspect-check input,.aspect-types input{width:13px;height:13px;margin:0;accent-color:#8bd8e1;padding:0;flex-shrink:0}.aspect-types{display:grid;gap:10px;margin:15px 0}.aspect-symbol{font-size:16px;width:18px;text-align:center}.aspect-types i{width:24px;margin-left:auto}.aspect-field{display:grid;gap:8px;font-size:11px;color:#aec3da;margin:16px 0}.aspect-options,.aspect-pairs{margin-top:17px;border-top:1px solid #304058;padding-top:13px}.aspect-controls summary{font-size:11px;color:#b9cedf;cursor:pointer;line-height:1.6}.aspect-options form>p{font-size:10px;line-height:1.7;color:#8ea6c3;margin:12px 0}.orb-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 9px}.orb-grid label{display:grid;gap:7px;font-size:10px;color:#aabed4}.orb-grid input{min-width:0;font-size:11px;padding:7px}.aspect-options .button{font-size:10px;padding:8px;margin-top:13px;width:100%}.aspect-options .text-button{font-size:10px}.aspect-options .orb-error{color:#efb59f}.aspect-pair-list{display:grid;gap:5px;margin-top:11px;max-height:240px;overflow:auto;scrollbar-width:thin}.aspect-pair-list button{display:flex;gap:9px;align-items:center;text-align:left;padding:8px;border:1px solid transparent;font-size:11px;line-height:1.5;color:#b9cde0}.aspect-pair-list button>span:first-child{font-size:17px}.aspect-pair-list button small{display:block;font-size:9px;color:#91a6c2}.aspect-pair-list button:hover{background:#1d3045}.aspect-pair-list button.chosen{background:#20384b;border-color:#527485}
</style>
