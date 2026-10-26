<script lang="ts">
  import type { Snippet } from 'svelte';

  let { id, title, open, onToggle, children }: {
    id: string; title: string; open: boolean; onToggle: (open: boolean) => void; children: Snippet;
  } = $props();
  function toggled(event: Event) {
    const next = (event.currentTarget as HTMLDetailsElement).open;
    if (next !== open) onToggle(next);
  }
</script>

<details class="control-group" data-control-group={id} {open} ontoggle={toggled}>
  <summary id={`control-group-${id}`}><span>{title}</span><span class="group-indicator" aria-hidden="true">⌄</span></summary>
  <div class="control-group-content">{@render children()}</div>
</details>

<style>
  .control-group{flex-shrink:0;min-width:0;border-bottom:1px solid #35445b;background:#111b2c}
  summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;cursor:pointer;padding:15px 18px;color:#d0dceb;font-size:.8125rem;font-weight:600;line-height:1.5}
  summary::-webkit-details-marker{display:none}summary:hover{background:#1d3045;color:#eff7ff}summary:focus-visible{outline:2px solid #9bdde4;outline-offset:-4px;border-radius:4px}
  .group-indicator{font-size:1.125rem;line-height:1;transform:rotate(-90deg);color:#b3cbd8}.control-group[open] .group-indicator{transform:rotate(0)}
  .control-group[open]>summary{border-bottom:1px solid #2b3b52}.control-group-content{min-width:0;padding:14px 18px 18px}
  .control-group-content :global(.dock-section),.control-group-content :global(.feature-list){border-bottom:0}
  .control-group-content :global(.dock-section>h2:first-child){position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
  @media(forced-colors:active){summary:focus-visible{outline-color:Highlight}.control-group,summary{border-color:CanvasText}}
</style>
