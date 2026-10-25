<script lang="ts">
  import WikipediaLinks from './WikipediaLinks.svelte';
  import type {EphemerisSnapshot} from '../astronomy/ephemeris';
  import {SIGNS} from '../domain/chart';
  import {getSkyReferences} from '../domain/sky-reference';
  import {CONSTELLATIONS,SKY_DATA_POLICY} from '../scene/sky-data';
  import ContentCard from './ContentCard.svelte';
  let {snapshot,selectedId,onFocus}:{snapshot:EphemerisSnapshot|null;selectedId:string;onFocus:()=>void}=$props();
  const reference=$derived(snapshot?getSkyReferences(snapshot).find(item=>item.id===selectedId):undefined);
  const signIndex=$derived(SIGNS.findIndex(name=>selectedId===`sign:${name.toLowerCase()}`));
  const region=$derived(CONSTELLATIONS.find(item=>item.id===selectedId));
  const projectSource='https://github.com/buttery-x3/astrology-viewer/blob/0ea709fdff33ac11aed696fcb0b60f17e0fad477';
</script>

{#if selectedId==='reference:earth'||selectedId==='reference:observer'}
  <div class="selected-heading"><span class="eyebrow">{selectedId==='reference:earth'?'SCHEMATIC GLOBE':'OBSERVER REFERENCE'}</span><h2>{selectedId==='reference:earth'?'Earth':'Observer location'}</h2></div>
  <section class="inspector-section"><h3>What this represents</h3><p>The globe marks the origin of geocentric sky directions. The selected geographic location sets the local up direction, horizon and compass orientation. Moving the camera keeps that location and instant fixed.</p>{#if snapshot}<dl class="data-list"><div><dt>Latitude · north positive</dt><dd>{snapshot.observer.latitudeDeg.toFixed(4)}°</dd></div><div><dt>Longitude · east positive</dt><dd>{snapshot.observer.longitudeDeg.toFixed(4)}°</dd></div></dl>{/if}<p class="field-note">Earth’s radius, the sky radius and marker sizes are illustrative. The sky is oriented to this observer without claiming to reproduce a surface photograph or visibility through terrain.</p><a class="source-link" href={`${projectSource}/docs/coordinate-contract.md`} target="_blank" rel="noreferrer">Explorer convention — coordinates and observer orientation ↗</a></section>
{:else if signIndex>=0}
  <div class="selected-heading"><span class="eyebrow">TROPICAL SIGN</span><h2>{SIGNS[signIndex]}</h2><p>{signIndex*30}°–{(signIndex+1)*30}° ecliptic longitude</p></div>
  <section class="inspector-section"><h3>What this represents</h3><p>One of twelve equal sectors measured eastward along the ecliptic from the March equinox. This sign spans 30°. A body’s longitude decides its sign; its ecliptic latitude remains visible in the sky.</p><p class="field-note">The coloured belt is a schematic guide around the ecliptic. The sector extends to bodies away from that belt.</p><h3>What changes it?</h3><p>The tropical reference follows the equinox of the selected date. Changing the moment changes the body’s longitude. Changing observer location leaves geocentric sign membership unchanged.</p><p>The named constellation is a different, unequal sky region. Turn on constellation boundaries to compare them.</p><a class="source-link" href={`${projectSource}/src/lib/domain/chart.ts`} target="_blank" rel="noreferrer">Explorer convention — tropical sign membership ↗</a><a class="source-link" href={`${projectSource}/docs/coordinate-contract.md`} target="_blank" rel="noreferrer">Explorer convention — coordinate and epoch contract ↗</a></section>
  <ContentCard id={selectedId} role="tradition" heading={false} />
{:else if reference}
  <div class="selected-heading"><span class="eyebrow">{selectedId.startsWith('angle:')?'CHART ANGLE':'SPATIAL REFERENCE'}</span><h2>{reference.name}</h2>{#if reference.longitudeDeg!==undefined}<p>{reference.longitudeDeg.toFixed(3)}° ecliptic longitude</p>{/if}</div>
  <ContentCard id={selectedId} heading={false} />
  <section class="inspector-section">{#if reference.status==='undefined'}<div class="warning-note"><strong>Undefined at this input</strong><p>{reference.reason}</p></div>{/if}<h3>What changes it?</h3><p>{selectedId==='reference:ecliptic'||selectedId==='reference:equator'||selectedId.includes('pole')?'The selected date sets the reference frame. The observer changes how this reference appears against the local horizon.':'The moment and observer location set this local orientation. House-system and display choices do not move it.'}</p></section>
{:else if region}
  <div class="selected-heading"><span class="eyebrow">CONSTELLATION REGION</span><h2>{region.name}</h2><p>{region.abbreviation} · IAU sky region</p></div>
  <section class="inspector-section"><h3>What this represents</h3><p>One of the 88 named regions covering the celestial sphere. These boundaries divide the sky into unequal areas; they are independent of the twelve tropical signs.</p><p>The original boundaries follow meridians and parallels in the B1875 frame. The displayed boundary samples are transformed to the fixed J2000 frame. Serpens has two separate pieces belonging to one constellation.</p><h3>Stars and motion</h3><p>{typeof SKY_DATA_POLICY==='string'?SKY_DATA_POLICY:'The bright-star layer uses the HYG catalogue in J2000 axes with its stated proper-motion policy. Catalogue star directions and apparent planetary directions use different correction conventions.'}</p><p class="field-note">The overlay shows regions, without adding cultural figures or suggesting that sign and constellation edges coincide.</p><a class="source-link" href="https://pbarbier.com/constellations/boundaries.html" target="_blank" rel="noreferrer">Source: Pierre Barbier — Delporte boundaries and transformation ↗</a><a class="source-link" href="https://pbarbier.com/terms.html" target="_blank" rel="noreferrer">Boundary data: CC BY-SA 4.0 ↗</a></section>
{:else}
  <section class="inspector-section"><h2>Selection unavailable</h2><p>This feature is not defined in the current snapshot.</p></section>
{/if}
{#if selectedId==='reference:earth'||selectedId==='reference:observer'||selectedId.startsWith('constellation:')}<WikipediaLinks id={selectedId} />{/if}
<button class="button secondary focus-button" onclick={onFocus}>Focus in the scene <kbd>F</kbd></button>
