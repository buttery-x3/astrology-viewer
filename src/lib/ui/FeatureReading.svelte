<script lang="ts">
  import type { HoverCardModel } from '../domain/hover-card';
  import { getContent, getSupplementalClaim } from '../content';
  import ContentCard from './ContentCard.svelte';
  let { model, heading = true, facts = true }: { model: HoverCardModel; heading?: boolean; facts?: boolean } = $props();
</script>

<div class="feature-reading">
  {#if heading}<div class="selected-heading"><span class="eyebrow">{model.kicker}</span><h2>{model.title}</h2></div>{/if}
  {#if model.notices.length}<div class="inspector-section reading-notices">{#each model.notices as notice (notice)}<p>{notice}</p>{/each}</div>{/if}
  {#if facts && model.facts.length}<dl class="data-list inspector-section">{#each model.facts as fact (fact.label)}<div><dt>{fact.label}</dt><dd>{fact.value}</dd></div>{/each}</dl>{/if}
  {#each model.sections as section (section.id)}
    {#if getContent(section.id)}<ContentCard id={section.id} heading={getContent(section.id)?.title!==model.title} />
    {:else}
      {@const source=getSupplementalClaim(section.id)}
      <section class="inspector-section"><h3>{section.title}</h3>{#each section.paragraphs as paragraph (paragraph.claimId)}<p>{paragraph.text}</p>{/each}
      {#if source}<details><summary>Source and explorer convention</summary>{#each source.sourceUrls as url (url)}<p><a href={url} target="_blank" rel="noreferrer">Supporting documentation ↗</a></p>{/each}</details>{/if}
      </section>
    {/if}
  {/each}
</div>

<style>
  .feature-reading h3{font-size:.95rem;line-height:1.5;color:#d7e5f0;margin:0 0 10px}.feature-reading p{font-size:.9rem;line-height:1.7;color:#bfd0e1}.reading-notices p{color:#dfc49e}
</style>
