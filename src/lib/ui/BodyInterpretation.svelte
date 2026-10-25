<script lang="ts">
  import type { BodyPosition, HouseResult } from '../astronomy/ephemeris';
  import { zodiacSign } from '../domain/chart';
  import { resolveBodyContent } from '../content';
  import ContentCard from './ContentCard.svelte';

  let { body, houses, provisional, onSelect }: {
    body: BodyPosition;
    houses: HouseResult | undefined;
    provisional: boolean;
    onSelect: (id: string) => void;
  } = $props();
  const resolved = $derived(resolveBodyContent(body, houses, provisional));
  const sign = $derived(zodiacSign(body.longitudeDeg));
  const outerBody = $derived(['uranus', 'neptune', 'pluto'].includes(body.id));
</script>

<div class="body-interpretation">
  <section class="interpretation-context inspector-section">
    <h3>Reading this chart</h3>
    <p>Traditional meanings are attributed symbolic readings. Astronomical measurements and interpretive claims have separate labels and sources.</p>
    {#if resolved.provisional}<div class="provisional-reading"><strong>Provisional birth time</strong><p>{resolved.qualification ?? 'These readings use a provisional local-noon time. The Moon, angles and houses may change with the actual time.'}</p></div>{/if}
    {#if outerBody}<p class="generation-note">The outer planets remain in a sign for years. Read this sign placement as a broad generational theme.</p>{/if}
  </section>
  <ContentCard id={`body:${body.id}`} heading={false} />
  <ContentCard id={resolved.bodyInSign.id} />
  <div class="concept-actions"><button class="text-button" onclick={() => onSelect(`sign:${sign.id}`)}>Explore {sign.name} →</button></div>
  {#if resolved.houseStatus === 'valid' && resolved.bodyInHouse && resolved.houseNumber !== null}
    <ContentCard id={resolved.bodyInHouse.id} />
    <div class="concept-actions"><button class="text-button" onclick={() => onSelect(`house:${resolved.houseNumber}`)}>Explore house {resolved.houseNumber} →</button></div>
  {:else}
    <section class="inspector-section placement-unavailable"><h3>House placement unavailable</h3><p>{resolved.houseReason ?? 'There is no valid house result for this snapshot.'}</p><p class="field-note">No house interpretation is assigned when membership is undefined.</p></section>
  {/if}
</div>

<style>
  .interpretation-context h3{font-size:12px;color:#cfdaeb;margin:0 0 10px}.interpretation-context>p{font-size:11px;line-height:1.75;margin:0;color:#a8bbd3}
  .provisional-reading{border:1px solid #79623d;border-radius:5px;background:#302b34;padding:10px;margin:14px 0 0;font-size:11px;line-height:1.7;color:#d7c29f}.provisional-reading strong{font-size:11px;color:#e7c68f}.provisional-reading p{font-size:11px;color:#cdbb9f;margin:5px 0 0;line-height:1.75}
  .interpretation-context p.generation-note{margin-top:13px;color:#bfabd4}.concept-actions{padding:11px 23px 14px;border-bottom:1px solid #2a374c}.concept-actions button{font-size:11px;color:#a4d7dc;line-height:1.7}.placement-unavailable p{font-size:11px;color:#d1bb9b;line-height:1.75}
</style>
