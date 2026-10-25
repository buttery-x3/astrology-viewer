<script lang="ts">
  import { onMount } from 'svelte';
  import type { EphemerisSnapshot } from '../astronomy/ephemeris';
  import type { ObserverCoordinates } from '../astronomy/coordinates';
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
    globePickMode?: boolean;
    onObserverPick?: (observer: ObserverCoordinates) => void;
  }

  let { snapshot, presentation, onSelect, onViewpoint, onStatus, globePickMode = false, onObserverPick }: Props = $props();
  let container: HTMLDivElement;
  let runtime = $state.raw<ReturnType<typeof mountScene> | undefined>();

  onMount(() => {
    try {
      runtime = mountScene(container, {
        onSelect: (id) => onSelect?.(id),
        onViewpoint: (viewpoint) => onViewpoint?.(viewpoint),
        onStatus: (message) => onStatus?.(message),
        onObserverPick: (observer) => onObserverPick?.(observer),
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

<div class="scene-canvas" bind:this={container} aria-label="Interactive celestial sphere. Use the Objects list to select bodies with the keyboard."></div>
