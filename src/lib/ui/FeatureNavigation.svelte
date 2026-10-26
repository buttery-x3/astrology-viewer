<script lang="ts">
  import {tick} from 'svelte';
  import type {HoverCardContext} from '../domain/hover-card';
  import type {FeatureHit} from '../domain/scene-hit';
  import {navigationGroups,featurePage,trailNavigation,historyNavigation,type NavigationItem} from './feature-navigation';
  let {context,selectedId,stage=2,onSelect}:{context:HoverCardContext;selectedId:string|null;stage?:number;onSelect:(hit:FeatureHit)=>void}=$props();
  const uid=$props.id();
  let category=$state('stars'),query=$state(''),page=$state(0),sampleIndex=$state(0);
  let list:HTMLDivElement;
  const groups=$derived(navigationGroups(context,stage));
  const group=$derived(groups.find(group=>group.id===category)??groups[0]!);
  const results=$derived(featurePage(group.items,query,page));
  const trail=$derived(trailNavigation(context));
  const history=$derived(historyNavigation(context));
  const currentIndex=$derived(Math.min(Math.max(0,Number.isFinite(sampleIndex)?Math.trunc(sampleIndex):0),Math.max(0,trail.items.length-1)));
  const sample=$derived(trail.items[currentIndex]);
  const previous=$derived(trail.items[currentIndex-1]);
  const next=$derived(trail.items[currentIndex+1]);
  const json=(item:NavigationItem|undefined)=>item?JSON.stringify(item.hit):undefined;
  function inspectSample(index:number){sampleIndex=index;const item=trail.items[index];if(item)onSelect(item.hit);}
  async function changePage(nextPage:number){page=nextPage;await tick();list?.querySelector<HTMLButtonElement>('button')?.focus();}
</script>

<section class="feature-navigation" aria-labelledby={`${uid}-title`}>
  <h2 id={`${uid}-title`}>Additional scene features</h2>
  <label for={`${uid}-category`}>Feature category<select id={`${uid}-category`} aria-label="Feature category" value={category} onchange={event=>{category=event.currentTarget.value;query='';page=0;}}>{#each groups as option (option.id)}<option value={option.id}>{option.title} ({option.items.length})</option>{/each}</select></label>
  <label for={`${uid}-query`}>Search this category<input id={`${uid}-query`} type="search" aria-label="Search additional features" maxlength="100" placeholder="Name, type or HYG catalogue ID" value={query} oninput={event=>{query=event.currentTarget.value;page=0;}} /></label>
  <p class="result-count" role="status" aria-live="polite" aria-atomic="true">{results.start}–{results.end} of {results.count} {group.title.toLowerCase()}</p>
  {#if !group.items.length}<p class="empty-note">{group.reason??'No calculated target is available in this category.'}</p>{:else if !results.count}<p class="empty-note">No matching feature. Try a shorter name or another category.</p>{/if}
  <div class="navigation-results" role="group" aria-label={group.title} bind:this={list}>
    {#each results.items as item (item.hit.id)}<button class:chosen={selectedId===item.hit.id} aria-pressed={selectedId===item.hit.id} data-feature-id={item.hit.id} data-feature-name={item.hit.name} data-feature-json={json(item)} onclick={()=>onSelect(item.hit)}><span>{item.hit.name}</span><small>{item.detail}</small></button>{/each}
  </div>
  {#if results.pages>1}<div class="feature-pagination" role="group" aria-label="Feature pages"><button aria-label="Previous feature page" disabled={results.page===0} onclick={()=>void changePage(results.page-1)}>← Previous</button><span>Page {results.page+1} / {results.pages}</span><button aria-label="Next feature page" disabled={results.page+1===results.pages} onclick={()=>void changePage(results.page+1)}>Next →</button></div>{/if}

  <details class="sample-navigation"><summary>Body trail samples <span>{trail.items.length}</span></summary>
    {#if sample}<label for={`${uid}-sample`}>Trail sample index<input id={`${uid}-sample`} type="number" aria-label="Trail sample index" min="1" max={trail.items.length} step="1" value={currentIndex+1} oninput={event=>sampleIndex=Number(event.currentTarget.value)-1} onkeydown={event=>{if(event.key==='Enter'){event.preventDefault();inspectSample(currentIndex);}}} /></label><p class="sample-context">{sample.hit.name}<br />{sample.detail}</p><div class="sample-buttons"><button aria-label="Previous trail sample" disabled={!previous} data-feature-id={previous?.hit.id} data-feature-name={previous?.hit.name} data-feature-json={json(previous)} onclick={()=>inspectSample(currentIndex-1)}>← Previous</button><button aria-label="Next trail sample" disabled={!next} data-feature-id={next?.hit.id} data-feature-name={next?.hit.name} data-feature-json={json(next)} onclick={()=>inspectSample(currentIndex+1)}>Next →</button></div><button class="inspect-sample" data-feature-id={sample.hit.id} data-feature-name={sample.hit.name} data-feature-json={json(sample)} aria-label="Inspect trail sample" onclick={()=>onSelect(sample.hit)}>Inspect sample {currentIndex+1}</button><p class="input-help">Choose a sample number and press Enter or Inspect. Previous and Next inspect their exact sampled times.</p>
    {:else}<p class="empty-note">{trail.reason}</p>{/if}
  </details>
  <details class="sample-navigation"><summary>Boundary history samples <span>{history.items.length}</span></summary>
    <div class="navigation-results">{#each history.items as item (item.hit.id)}<button class:chosen={selectedId===item.hit.id} aria-pressed={selectedId===item.hit.id} data-feature-id={item.hit.id} data-feature-name={item.hit.name} data-feature-json={json(item)} onclick={()=>onSelect(item.hit)}><span>{item.hit.name}</span><small>{item.detail}</small></button>{/each}</div>
    {#if history.reason}<p class="empty-note">{history.reason}</p>{/if}
    {#if history.omitted.length}<p class="empty-note">Undefined samples are omitted:</p><ul class="omitted-samples">{#each history.omitted as reason (reason)}<li>{reason}</li>{/each}</ul>{/if}
  </details>
</section>

<style>
  .feature-navigation{min-width:0;color:#c9d8e8}.feature-navigation h2{font-size:.875rem;line-height:1.6;margin:0 0 14px;font-weight:600}.feature-navigation label{display:grid;gap:7px;margin:13px 0;color:#bbcede;font-size:.8125rem;line-height:1.6}.feature-navigation input,.feature-navigation select{min-width:0;width:100%;padding:9px 10px;border:1px solid #587084;border-radius:5px;background:#101e30;color:#deebf3;font:inherit;font-size:.875rem;line-height:1.6}.result-count,.feature-pagination span{font-size:.75rem;color:#afc5d6;line-height:1.6}.navigation-results{display:grid;gap:7px}.navigation-results button{display:grid;gap:5px;text-align:left;width:100%;border:1px solid #486076;border-radius:5px;padding:10px;background:#182a3e;color:#d4e3ed;font-size:.875rem;line-height:1.6;overflow-wrap:anywhere}.navigation-results small{color:#adc6d8;font-size:.75rem;line-height:1.6}.navigation-results button.chosen{border-color:#c6b180;background:#2b3040}.feature-pagination,.sample-buttons{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:12px 0}.feature-pagination button,.sample-buttons button,.inspect-sample{border:1px solid #587084;border-radius:4px;background:#1b3045;color:#cbe0e8;padding:8px;font-size:.8125rem;line-height:1.6}.feature-pagination button:disabled,.sample-buttons button:disabled{opacity:.45;cursor:default}.feature-pagination span{white-space:nowrap}.sample-navigation{margin-top:16px;border-top:1px solid #3d536a;padding-top:12px}.sample-navigation summary{cursor:pointer;display:flex;justify-content:space-between;gap:8px;color:#c1d6e5;font-size:.875rem;line-height:1.7}.sample-navigation summary span{font-size:.75rem;color:#a8c4d7}.empty-note,.input-help,.sample-context,.omitted-samples{font-size:.8125rem;line-height:1.8;color:#afc5d6;margin:10px 0}.input-help{font-size:.75rem}.sample-context{overflow-wrap:anywhere}.omitted-samples{padding-left:18px}.inspect-sample{width:100%;text-align:center}.feature-navigation button:hover:not(:disabled){background:#2b435a;border-color:#91b8c6}.feature-navigation :is(input,select,button,summary):focus-visible{outline:2px solid #b0e4e6;outline-offset:3px}
  .feature-pagination,.sample-buttons{flex-wrap:wrap}.feature-pagination button,.sample-buttons button,.inspect-sample{font-size:.875rem}.sample-buttons button{flex:1}
  @media(forced-colors:active){.navigation-results button.chosen{outline:2px solid Highlight}.feature-navigation :is(input,select,button,summary):focus-visible{outline-color:Highlight}}
</style>
