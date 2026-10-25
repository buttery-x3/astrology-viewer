<script lang="ts">
  import { onMount } from 'svelte';
  import type { EphemerisSnapshot } from '../astronomy/ephemeris';
  import { mountScene } from '../scene/runtime';

  interface Props {
    snapshot: EphemerisSnapshot | null;
    presentation: {
      viewpoint: 'overview' | 'observer' | 'outside';
      selectedId: string | null;
      layers: { bodies: boolean; horizon: boolean; ecliptic: boolean; houses: boolean; stars: boolean };
    };
    onSelect?: (id: string | null) => void;
    onViewpoint?: (viewpoint: 'overview' | 'observer' | 'outside') => void;
    onStatus?: (message: string | null) => void;
  }

  let { snapshot, presentation, onSelect, onViewpoint, onStatus }: Props = $props();
  let container: HTMLDivElement;
  let runtime = $state.raw<ReturnType<typeof mountScene> | undefined>();

  onMount(() => {
    try {
      runtime = mountScene(container, {
        onSelect: (id) => onSelect?.(id),
        onViewpoint: (viewpoint) => onViewpoint?.(viewpoint),
        onStatus: (message) => onStatus?.(message),
      });
      runtime.update(snapshot, presentation);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : 'The 3D view could not start.');
    }
    return () => {
      runtime?.dispose();
      runtime = undefined;
    };
  });

  $effect(() => { runtime?.update(snapshot, presentation); });

  export function focusSelection() { runtime?.focusSelection(); }
  export function returnToObserver() { runtime?.returnToObserver(); }
</script>

<div class="scene-canvas" bind:this={container} aria-label="Interactive celestial sphere. Use the Objects list to select bodies with the keyboard."></div>
