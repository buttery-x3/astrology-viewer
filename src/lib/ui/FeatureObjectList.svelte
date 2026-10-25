<script lang="ts">
  import type {EphemerisSnapshot} from '../astronomy/ephemeris';
  import {SIGNS} from '../domain/chart';
  import {getSkyReferences} from '../domain/sky-reference';
  import {CONSTELLATIONS} from '../scene/sky-data';
  let {snapshot,selectedId,onSelect}:{snapshot:EphemerisSnapshot|null;selectedId:string|null;onSelect:(id:string)=>void}=$props();
  let query=$state('');
  const references=$derived(snapshot?getSkyReferences(snapshot):[]);
  const match=(name:string)=>name.toLowerCase().includes(query.trim().toLowerCase());
</script>

<section class="dock-section feature-list">
  <h2>Explore the geometry</h2>
  <div class="feature-buttons"><button class:chosen={selectedId==='reference:earth'} aria-pressed={selectedId==='reference:earth'} onclick={()=>onSelect('reference:earth')}>Earth<small>Direction origin</small></button><button class:chosen={selectedId==='reference:observer'} aria-pressed={selectedId==='reference:observer'} onclick={()=>onSelect('reference:observer')}>Observer location<small>Local orientation</small></button></div>
  <label class="feature-search">Find a sign, angle or region<input type="search" bind:value={query} placeholder="e.g. Ascendant or Orion" /></label>
  <details open><summary>Tropical signs <span>12</span></summary><div class="feature-buttons">{#each SIGNS.filter(match) as name (name)}<button class:chosen={selectedId===`sign:${name.toLowerCase()}`} aria-pressed={selectedId===`sign:${name.toLowerCase()}`} onclick={()=>onSelect(`sign:${name.toLowerCase()}`)}>{name}<small>30° sector</small></button>{/each}</div></details>
  <details open={Boolean(query)}><summary>Angles & reference geometry <span>{references.length}</span></summary><div class="feature-buttons">{#each references.filter(item=>match(item.name)) as item (item.id)}<button class:chosen={selectedId===item.id} aria-pressed={selectedId===item.id} onclick={()=>onSelect(item.id)}>{item.name}<small>{item.status==='undefined'?'Undefined here':item.id.startsWith('angle:')?'Chart angle':'Reference'}</small></button>{/each}</div></details>
  <details open={Boolean(query)}><summary>Constellation regions <span>88</span></summary><p class="field-note">Sky regions have unequal sizes and differ from tropical signs.</p><div class="feature-buttons">{#each CONSTELLATIONS.filter(item=>match(item.name)||match(item.abbreviation)) as item (item.id)}<button class:chosen={selectedId===item.id} aria-pressed={selectedId===item.id} onclick={()=>onSelect(item.id)}>{item.name}<small>{item.abbreviation}</small></button>{/each}</div></details>
</section>
