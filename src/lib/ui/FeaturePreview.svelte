<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { resolveHoverCard, type HoverCardContext } from '../domain/hover-card';
  import type { FeatureHit } from '../domain/scene-hit';
  import HoverCard from './HoverCard.svelte';

  let {
    hit,
    context,
    motion = true,
    sparkles = true,
    suspended = false,
    resetKey = 0,
  }: {
    hit: FeatureHit | null;
    context: HoverCardContext;
    motion?: boolean;
    sparkles?: boolean;
    suspended?: boolean;
    resetKey?: number;
  } = $props();
  let displayed = $state<FeatureHit | null>(null);
  let panel = $state<HTMLDivElement>();
  let inside = false,
    focusInside = false,
    candidate: FeatureHit | null = null,
    suppressed: string[] = [];
  let openTimer: ReturnType<typeof setTimeout> | undefined,
    closeTimer: ReturnType<typeof setTimeout> | undefined;
  let x = $state(12),
    y = $state(12);
  let expanded = $state(false);
  let dense = $state(false);
  let fullWidthPlacements = $state(false);
  let described: HTMLElement | null = null,
    originalDescription: string | null = null;
  let previousResetKey: number | undefined;
  const model = $derived(displayed ? resolveHoverCard(displayed, context) : null);
  function clearTimers() {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    openTimer = closeTimer = undefined;
  }
  function restoreDescription() {
    if (described) {
      if (originalDescription === null) described.removeAttribute('aria-describedby');
      else described.setAttribute('aria-describedby', originalDescription);
    }
    described = null;
  }
  function close() {
    clearTimers();
    displayed = null;
    candidate = null;
    inside = false;
    focusInside = false;
    expanded = false;
    dense = false;
    fullWidthPlacements = false;
    restoreDescription();
  }
  function position() {
    if (!displayed || !panel) return;
    const point = displayed.screen ?? { x: 24, y: 90 },
      width = panel.offsetWidth,
      height = panel.offsetHeight;
    // Use available reading width before considering a shorter editorial variant.
    // Font size and the complete claim text always follow the user's preferences.
    if (!expanded && height > window.innerHeight - 24 && width < window.innerWidth - 25) {
      expanded = true;
      return;
    }
    if (!dense && height > window.innerHeight - 24) {
      dense = true;
      return;
    }
    if (!fullWidthPlacements && model?.kind === 'aspect' && height > window.innerHeight - 24) {
      fullWidthPlacements = true;
      return;
    }
    x = Math.max(
      12,
      Math.min(
        window.innerWidth - width - 12,
        point.x + 18 + width > window.innerWidth - 12 ? point.x - width - 18 : point.x + 18,
      ),
    );
    y = Math.max(
      12,
      Math.min(
        window.innerHeight - height - 12,
        point.y + 18 + height > window.innerHeight - 12 ? point.y - height - 18 : point.y + 18,
      ),
    );
  }
  function reveal(next: FeatureHit) {
    restoreDescription();
    displayed = next;
    candidate = null;
    expanded = false;
    dense = false;
    fullWidthPlacements = false;
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active.closest<HTMLElement>('[data-feature-id]')?.dataset.featureId === next.id
    ) {
      restoreDescription();
      described = active;
      originalDescription = active.getAttribute('aria-describedby');
      active.setAttribute(
        'aria-describedby',
        [originalDescription, 'feature-preview-card'].filter(Boolean).join(' '),
      );
    }
  }
  function receive(next: FeatureHit | null) {
    if (!next) {
      suppressed = [];
      candidate = null;
      clearTimeout(openTimer);
      if (!inside && !focusInside) {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(close, 300);
      }
      return;
    }
    clearTimeout(closeTimer);
    if (suppressed.includes(next.id)) return;
    if (displayed?.id === next.id) {
      displayed = { ...next, screen: displayed.screen ?? next.screen };
      return;
    }
    const focused =
      document.activeElement instanceof HTMLElement &&
      document.activeElement.closest<HTMLElement>('[data-feature-id]')?.dataset.featureId ===
        next.id;
    if ((inside || focusInside) && !focused) return;
    if (focused) inside = false;
    const moved =
      candidate?.screen && next.screen
        ? Math.hypot(candidate.screen.x - next.screen.x, candidate.screen.y - next.screen.y) > 5
        : false;
    if (candidate?.id === next.id && !moved) return;
    // Keep the readable card available while crossing dense targets toward it.
    // Replace it only after the next target completes its own stable dwell.
    clearTimeout(openTimer);
    candidate = next;
    openTimer = setTimeout(() => {
      if (candidate?.id === next.id) reveal(candidate);
    }, 300);
  }
  $effect(() => {
    const next = hit;
    untrack(() => receive(next));
  });
  $effect(() => {
    const key = resetKey;
    untrack(() => {
      if (key !== previousResetKey) {
        previousResetKey = key;
        close();
      }
    });
  });
  $effect(() => {
    if (suspended) untrack(close);
  });
  $effect(() => {
    if (displayed && !model) untrack(close);
  });
  $effect(() => {
    const target = panel;
    if (!target) return;
    position();
    const observer = new ResizeObserver(position);
    observer.observe(target);
    return () => observer.disconnect();
  });
  onMount(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !(displayed || candidate)) return;
      // A pointer reading has already left its feature when it enters the card.
      // Suppress the active hit and an explicitly restored keyboard origin only;
      // suppressing the displayed ID alone would prevent legitimate re-entry.
      const originId = described?.closest<HTMLElement>('[data-feature-id]')?.dataset.featureId;
      event.preventDefault();
      event.stopPropagation();
      suppressed = [hit?.id, originId].filter((id): id is string => !!id);
      close();
    };
    const blur = () => close();
    const press = (event: PointerEvent) => {
      if (!(event.target instanceof Element && event.target.closest('[data-feature-preview]')))
        close();
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', position);
    window.addEventListener('pointerdown', press, true);
    return () => {
      close();
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', position);
      window.removeEventListener('pointerdown', press, true);
    };
  });
</script>

{#if model && displayed}
  <div
    bind:this={panel}
    class="feature-preview-position"
    class:expanded
    data-feature-preview
    data-testid="scene-hover"
    role="presentation"
    style:left={`${x}px`}
    style:top={`${y}px`}
    onpointerenter={() => {
      inside = true;
      candidate = null;
      clearTimers();
    }}
    onpointerleave={() => {
      inside = false;
      if (!hit && !focusInside) closeTimer = setTimeout(close, 180);
      else receive(hit);
    }}
    onfocusin={() => {
      focusInside = true;
      candidate = null;
      clearTimers();
    }}
    onfocusout={(event) => {
      if (panel?.contains(event.relatedTarget as Node | null)) return;
      focusInside = false;
      if (!hit && !inside) closeTimer = setTimeout(close, 180);
    }}
    onwheel={(event) => event.stopPropagation()}
  >
    <HoverCard
      {model}
      id="feature-preview-card"
      {motion}
      {sparkles}
      {dense}
      {fullWidthPlacements}
    />
  </div>
{/if}

<style>
  .feature-preview-position {
    position: fixed;
    z-index: 90;
    width: min(460px, calc(100vw - 24px));
    border-radius: 15px;
    isolation: isolate;
  }
  .feature-preview-position.expanded {
    width: min(640px, calc(100vw - 24px));
  }
  @media (max-height: 500px) {
    .feature-preview-position {
      width: min(560px, calc(100vw - 24px));
    }
  }
</style>
