<script lang="ts">
  import { getWikipediaOverviews } from '../content/wikipedia';
  let {id,compact=false}:{id:string;compact?:boolean}=$props();
  const links=$derived(getWikipediaOverviews(id));
</script>

{#if links.length}
  <div class="wikipedia-overviews" class:compact data-overview-id={id}>
    <p>Wikipedia concept overview</p>
    <ul>{#each links as link (link.url)}<li><a href={link.url} target="_blank" rel="noreferrer" aria-label={`Wikipedia overview: ${link.title} (opens in a new tab)`}>{link.title} ↗</a></li>{/each}</ul>
  </div>
{/if}

<style>
  .wikipedia-overviews{padding:18px 23px;border-bottom:1px solid #35445b;color:#b8cbe0;min-width:0}.wikipedia-overviews.compact{padding:14px 0 0;margin-top:16px;border-bottom:0;border-top:1px solid #35445b}
  p{font-size:.75rem;line-height:1.6;color:#afc3d9;margin:0 0 9px}ul{display:grid;gap:9px;margin:0;padding:0;list-style:none}a{font-size:.8125rem;line-height:1.6;color:#a8dce2;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
</style>
