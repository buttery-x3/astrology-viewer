<script lang="ts">
  import { onMount } from 'svelte';
  import type { EphemerisSnapshot } from '../astronomy/ephemeris';
  import type { ObserverCoordinates } from '../astronomy/coordinates';
  import { mountScene, type ScenePresentation } from '../scene/runtime';

  interface Props {
    snapshot: EphemerisSnapshot | null;
    presentation: ScenePresentation;
    onSelect?: (id: string | null) => void;
    onViewpoint?: (viewpoint: 'overview' | 'observer' | 'outside') => void;
    onStatus?: (message: string | null) => void;
    globePickMode?: boolean;
    onObserverPick?: (observer: ObserverCoordinates) => void;
  }

  let { snapshot, presentation, onSelect, onViewpoint, onStatus, globePickMode = false, onObserverPick }: Props = $props();
  let container: HTMLDivElement;
  let runtime = $state.raw<ReturnType<typeof mountScene> | undefined>();
  let hovered = $state<{ id: string; name: string } | null>(null);

  onMount(() => {
    try {
      runtime = mountScene(container, {
        onSelect: (id) => onSelect?.(id),
        onViewpoint: (viewpoint) => onViewpoint?.(viewpoint),
        onStatus: (message) => onStatus?.(message),
        onObserverPick: (observer) => onObserverPick?.(observer),
        onHover: (entity) => { hovered = entity; },
      });
      runtime.update(snapshot, { ...presentation, globePickMode });
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : 'The 3D view could not start.');
    }
    return () => {
      runtime?.dispose();
      runtime = undefined;
    };
  });

  $effect(() => { runtime?.update(snapshot, { ...presentation, globePickMode }); });

  export function focusSelection() { runtime?.focusSelection(); }
  export function returnToObserver() { runtime?.returnToObserver(); }
</script>

<div class="scene-canvas" bind:this={container} aria-label="Interactive celestial sphere. Use the Objects list to select sky features with the keyboard.">
  {#if hovered}<span class="hover-identity" data-testid="scene-hover" aria-hidden="true">{hovered.name}</span>{/if}
</div>

<style>
  .hover-identity { position: absolute; bottom: 0.8rem; left: 0.85rem; z-index: 2; pointer-events: none; padding: 0.45rem 0.65rem; border: 1px solid #55717d; border-radius: 0.35rem; color: #deecee; background: #0b1727e8; font: 0.75rem/1.4 system-ui, sans-serif; }
</style>
