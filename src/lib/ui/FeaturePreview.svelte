<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { resolveHoverCard, type HoverCardContext } from '../domain/hover-card';
  import type { FeatureHit } from '../domain/scene-hit';
  import HoverCard from './HoverCard.svelte';

  let { hit, context, motion = true, sparkles = true, suspended=false, resetKey=0 }: { hit: FeatureHit | null; context: HoverCardContext; motion?: boolean; sparkles?: boolean; suspended?:boolean; resetKey?:number } = $props();
  let displayed = $state<FeatureHit | null>(null);
  let panel = $state<HTMLDivElement>();
  let inside = false, focusInside = false, candidate: FeatureHit | null = null, suppressed: string[] = [];
  let returnFocus: HTMLElement | null = null;
  let openTimer: ReturnType<typeof setTimeout> | undefined, closeTimer: ReturnType<typeof setTimeout> | undefined;
  let x = $state(12), y = $state(12);
  let described: HTMLElement | null = null, originalDescription: string | null = null;
  let previousResetKey:number|undefined;
  const model = $derived(displayed ? resolveHoverCard(displayed, context) : null);
  function clearTimers() { clearTimeout(openTimer); clearTimeout(closeTimer); openTimer = closeTimer = undefined; }
  function restoreDescription() {
    if (described) { if (originalDescription === null) described.removeAttribute('aria-describedby'); else described.setAttribute('aria-describedby', originalDescription); }
    described = null;
  }
  function close() { clearTimers(); displayed = null; candidate = null; inside = false; focusInside = false; returnFocus = null; restoreDescription(); }
  function position() {
    if (!displayed || !panel) return;
    const point = displayed.screen ?? { x: 24, y: 90 }, width = panel.offsetWidth, height = panel.offsetHeight;
    x = Math.max(12, Math.min(window.innerWidth - width - 12, point.x + 18 + width > window.innerWidth - 12 ? point.x - width - 18 : point.x + 18));
    y = Math.max(12, Math.min(window.innerHeight - height - 12, point.y + 18 + height > window.innerHeight - 12 ? point.y - height - 18 : point.y + 18));
  }
  function reveal(next: FeatureHit) {
    restoreDescription();
    displayed = next; candidate = null;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest<HTMLElement>('[data-feature-id]')?.dataset.featureId === next.id) {
      restoreDescription(); described = active; originalDescription = active.getAttribute('aria-describedby');
      active.setAttribute('aria-describedby', [originalDescription, 'feature-preview-card'].filter(Boolean).join(' '));
    }
  }
  function receive(next: FeatureHit | null) {
    if (!next) {
      suppressed = []; candidate = null; clearTimeout(openTimer);
      if (!inside && !focusInside) { clearTimeout(closeTimer); closeTimer = setTimeout(close, 300); }
      return;
    }
    clearTimeout(closeTimer);
    if (suppressed.includes(next.id)) return;
    if (displayed?.id === next.id) { displayed = { ...next, screen: displayed.screen ?? next.screen }; return; }
    const focused=document.activeElement instanceof HTMLElement&&document.activeElement.closest<HTMLElement>('[data-feature-id]')?.dataset.featureId===next.id;
    if ((inside || focusInside) && !focused) return;
    if (focused) inside=false;
    const moved = candidate?.screen && next.screen ? Math.hypot(candidate.screen.x - next.screen.x, candidate.screen.y - next.screen.y) > 5 : false;
    if (candidate?.id === next.id && !moved) return;
    // Keep the readable card available while crossing dense targets toward it.
    // Replace it only after the next target completes its own stable dwell.
    clearTimeout(openTimer); candidate = next;
    openTimer = setTimeout(() => { if (candidate?.id === next.id) reveal(candidate); }, 300);
  }
  $effect(() => { const next = hit; untrack(() => receive(next)); });
  $effect(()=>{const key=resetKey;untrack(()=>{if(key!==previousResetKey){previousResetKey=key;close();}});});
  $effect(()=>{if(suspended)untrack(close);});
  $effect(() => { if (displayed && !model) untrack(close); });
  $effect(() => {
    const target = panel;
    if (!target) return;
    position();
    const observer = new ResizeObserver(position); observer.observe(target);
    return () => observer.disconnect();
  });
  onMount(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'F2' && displayed && panel) {
        const active = document.activeElement;
        if (panel.contains(active)) {
          if (returnFocus?.isConnected) { event.preventDefault(); event.stopPropagation(); returnFocus.focus({preventScroll:true}); }
        } else if (active === described) {
          event.preventDefault(); event.stopPropagation(); returnFocus = described;
          panel.querySelector<HTMLElement>('[role="tooltip"]')?.focus({preventScroll:true});
        }
        return;
      }
      if (event.key !== 'Escape' || !(displayed || candidate)) return;
      const restore = panel?.contains(document.activeElement) ? returnFocus : null;
      event.preventDefault(); event.stopPropagation(); suppressed = [hit?.id,displayed?.id].filter((id):id is string=>!!id); close();
      if (restore?.isConnected) restore.focus({preventScroll:true});
    };
    const blur = () => close();
    const press = (event: PointerEvent) => { if (!(event.target instanceof Element && event.target.closest('[data-feature-preview]'))) close(); };
    window.addEventListener('keydown', key, true); window.addEventListener('blur', blur); window.addEventListener('resize', position); window.addEventListener('pointerdown', press, true);
    return () => { close(); window.removeEventListener('keydown', key, true); window.removeEventListener('blur', blur); window.removeEventListener('resize', position); window.removeEventListener('pointerdown', press, true); };
  });
</script>

{#if model && displayed}
  <div bind:this={panel} class="feature-preview-position" data-feature-preview data-testid="scene-hover" role="presentation" style:left={`${x}px`} style:top={`${y}px`} onpointerenter={() => { inside = true; candidate = null; clearTimers(); }} onpointerleave={() => { inside = false; if (!hit && !focusInside) closeTimer = setTimeout(close, 180); else receive(hit); }} onfocusin={() => { focusInside=true; candidate=null; clearTimers(); }} onfocusout={event => { if(panel?.contains(event.relatedTarget as Node|null))return; focusInside=false; if(!hit&&!inside)closeTimer=setTimeout(close,180); }} onwheel={event => event.stopPropagation()}>
    <HoverCard {model} id="feature-preview-card" {motion} {sparkles} keyboardHint />
  </div>
{/if}

<style>
  .feature-preview-position{position:fixed;z-index:90;width:min(420px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;border-radius:18px;isolation:isolate}
</style>
