<script lang="ts">
  import { BODY_IDS, type BodyId } from '../astronomy/ephemeris';
  import type { AstroAngle } from '../domain/astrocartography';
  import { GEOGRAPHIC_ANGLE_KEY, GEOGRAPHIC_BODY_STYLE, GEOGRAPHIC_IDENTITY_NOTE } from '../domain/geographic-line-style';
  import GeographicAngleMarker from './GeographicAngleMarker.svelte';
  let { bodies, angles }: { bodies?: Record<BodyId, boolean>; angles?: Record<AstroAngle, boolean> } = $props();
  const shownBodies = $derived(BODY_IDS.filter(id => !bodies || bodies[id]));
  const sampleColour = $derived(GEOGRAPHIC_BODY_STYLE[shownBodies[0] ?? 'sun'].color);
</script>

<div class="geographic-key" aria-label="Geographic line key">
  <strong>Geographic lines</strong>
  <div class="angle-key">
    {#each GEOGRAPHIC_ANGLE_KEY.filter(item => !angles || angles[item.angle]) as item (item.angle)}
      <span><i style:border-color={sampleColour}></i><span class="marker" style:color={sampleColour}><GeographicAngleMarker angle={item.angle}/></span>{item.label}</span>
    {/each}
  </div>
  <div class="body-key" aria-label="Body colours">{#each shownBodies as id (id)}<span style:color={GEOGRAPHIC_BODY_STYLE[id].color} title={GEOGRAPHIC_BODY_STYLE[id].name}><span aria-hidden="true">{GEOGRAPHIC_BODY_STYLE[id].glyph}</span><span class="sr-only">{GEOGRAPHIC_BODY_STYLE[id].name}</span></span>{/each}</div>
  <small>{GEOGRAPHIC_IDENTITY_NOTE}</small>
</div>

<style>
  .geographic-key{display:grid;gap:5px;max-width:390px;color:#cbdbe8;font-size:.7rem;line-height:1.35}.geographic-key>strong{font-size:.72rem;letter-spacing:.02em;color:#e1e9f2}.angle-key{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px}.angle-key>span{display:flex;align-items:center;gap:5px;white-space:nowrap}.angle-key i{width:19px;border-top:1.1px solid;flex-shrink:0}.marker{display:inline-flex}.body-key{display:flex;gap:11px;align-items:center;flex-wrap:wrap;font-size:.95rem}.geographic-key small{font-size:.66rem;color:#aabbcd}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
  @media(max-width:480px){.angle-key{gap:2px 7px}.angle-key i{width:12px}.body-key{gap:9px}}
</style>
