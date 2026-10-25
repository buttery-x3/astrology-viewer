<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { EphemerisSnapshot } from '../astronomy/ephemeris';
  import type { ObserverCoordinates } from '../astronomy/coordinates';
  import { mountScene, type ScenePresentation, type SceneOrientation } from '../scene/runtime';

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
  let orientation = $state<SceneOrientation | null>(null);
  let overlaps = $state<{ id: string; name: string }[]>([]);
  let chooser = $state<HTMLDivElement>();
  let graphicsReady = $state(false);
  const uid = $props.id();
  let previousSelection: string | null = null;

  function closeChooser(restoreFocus = false) {
    overlaps = [];
    if (restoreFocus) runtime?.focusCanvas();
  }
  async function showOverlap(candidates: { id: string; name: string }[] | null) {
    overlaps = candidates ?? [];
    if (overlaps.length) { await tick(); chooser?.querySelector<HTMLButtonElement>('button')?.focus(); }
  }
  function choose(id: string) { onSelect?.(id); closeChooser(true); }
  function chooserKey(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeChooser(true); }
    else if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const buttons = Array.from(chooser?.querySelectorAll<HTMLButtonElement>('button') ?? []);
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : index < 0 ? event.key === 'ArrowDown' ? 0 : buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }

  onMount(() => {
    try {
      runtime = mountScene(container, {
        onSelect: (id) => onSelect?.(id),
        onViewpoint: (viewpoint) => onViewpoint?.(viewpoint),
        onStatus: (message) => { graphicsReady = message === null; onStatus?.(message); },
        onObserverPick: (observer) => onObserverPick?.(observer),
        onHover: (entity) => { hovered = entity; },
        onOrientation: (value) => { orientation = value; },
        onOverlap: (candidates) => { void showOverlap(candidates); },
      });
      runtime.update(snapshot, { ...presentation, globePickMode });
      container.querySelector('canvas')?.setAttribute('aria-describedby', `${uid}-help`);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : 'The 3D view could not start.');
    }
    const outside = (event: PointerEvent) => { if (chooser && !chooser.contains(event.target as Node)) closeChooser(); };
    document.addEventListener('pointerdown', outside, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      runtime?.dispose();
      runtime = undefined;
    };
  });

  $effect(() => { runtime?.update(snapshot, { ...presentation, globePickMode }); });
  $effect(() => { if (presentation.selectedId !== previousSelection) { previousSelection = presentation.selectedId; closeChooser(); } });

  export function focusSelection() { runtime?.focusSelection(); }
  export function returnToObserver() { runtime?.returnToObserver(); }
</script>

<div class="scene-canvas" bind:this={container} aria-label="Interactive celestial sphere. Use the Objects list to select sky features with the keyboard.">
  {#if hovered}<span class="hover-identity" data-testid="scene-hover" aria-hidden="true">{hovered.name}</span>{/if}
  {#if orientation}<div class="orientation-hud" role="group" aria-label="Camera orientation"><strong>{orientation.viewpoint === 'observer' ? 'Observer sky' : orientation.viewpoint === 'outside' ? 'Outside sphere' : 'Earth overview'}</strong><span>Look · Az {orientation.azimuthDeg.toFixed(1)}° · Alt {orientation.altitudeDeg.toFixed(1)}°</span></div>{/if}
  <div class="scene-tools" role="group" aria-label="Sky view controls">
    <button disabled={!graphicsReady} onclick={() => runtime?.zoom(1)} aria-label="Zoom in" title="Zoom in (+)">＋</button>
    <button disabled={!graphicsReady} onclick={() => runtime?.zoom(-1)} aria-label="Zoom out" title="Zoom out (−)">−</button>
    <button disabled={!graphicsReady || !presentation.selectedId} onclick={() => runtime?.focusSelection()} aria-label="Focus selected feature" title="Focus selection (F)">⌕</button>
    <button disabled={!graphicsReady} onclick={() => runtime?.returnToObserver()} aria-label="Return to observer" title="Return to observer (Home)">⌖</button>
  </div>
  <details class="scene-help"><summary>View controls</summary><p id={`${uid}-help`}>Drag to orbit or look; scroll or use + / − to zoom. With the sky focused, arrow keys move the view, F focuses the selection, and Home returns to observer sky. Use the object list for keyboard selection.</p></details>
  {#if overlaps.length}<div class="overlap-chooser" role="dialog" aria-modal="false" aria-labelledby={`${uid}-overlap-title`} tabindex="-1" bind:this={chooser} onkeydown={chooserKey}><h3 id={`${uid}-overlap-title`}>Choose a nearby feature</h3><p>These points overlap in this view.</p>{#each overlaps as candidate (candidate.id)}<button onclick={() => choose(candidate.id)}>{candidate.name}</button>{/each}<button class="chooser-cancel" onclick={() => closeChooser(true)}>Cancel</button></div>{/if}
</div>

<style>
  .hover-identity { position: absolute; top: 4.6rem; left: 0.85rem; max-width: calc(100% - 1.7rem); z-index: 2; pointer-events: none; padding: 0.45rem 0.65rem; border: 1px solid #55717d; border-radius: 0.35rem; color: #deecee; background: #0b1727e8; font: 0.875rem/1.4 system-ui, sans-serif; }
  .orientation-hud{position:absolute;right:1rem;bottom:6.1rem;z-index:2;display:grid;gap:4px;text-align:right;pointer-events:none;color:#b7cbd9;font:0.75rem/1.5 system-ui,sans-serif;text-shadow:0 1px 3px #07101e}.orientation-hud strong{font-size:0.75rem;font-weight:500;color:#91b7c5}.orientation-hud span{font-variant-numeric:tabular-nums}
  .scene-tools{position:absolute;right:1rem;bottom:3.2rem;z-index:2;display:flex;gap:6px}.scene-tools button{width:35px;height:35px;border:1px solid #526b80;border-radius:5px;background:#14253aef;color:#d3e5ec;font-size:1.5rem;line-height:1;display:grid;place-items:center}.scene-tools button:hover{background:#2a445b}.scene-tools button:focus-visible,.scene-help summary:focus-visible,.overlap-chooser button:focus-visible{outline:2px solid #b5e4e8;outline-offset:3px}.scene-tools button:disabled{opacity:.4;cursor:default}
  .scene-help{position:absolute;right:1rem;bottom:1rem;z-index:3;color:#b4cddd;font:0.75rem/1.6 system-ui,sans-serif}.scene-help summary{cursor:pointer;text-align:right}.scene-help p{position:absolute;right:0;bottom:1.4rem;width:min(300px,65vw);border:1px solid #526b80;border-radius:6px;background:#102035f5;padding:12px;color:#c4d8e7;font-size:0.875rem;line-height:1.8}
  .overlap-chooser{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;width:min(320px,calc(100% - 2rem));max-height:calc(100% - 3rem);overflow:auto;border:1px solid #7598a7;border-radius:8px;padding:17px;background:#102035f7;box-shadow:0 15px 35px #020910aa}.overlap-chooser h3{font-size:1rem;color:#d7e6ee;margin:0 0 8px}.overlap-chooser p{font-size:0.875rem;line-height:1.7;color:#a5c0d5;margin:0 0 12px}.overlap-chooser button{display:block;width:100%;text-align:left;border:1px solid #415d74;border-radius:4px;color:#d0e2ee;background:#1b3148;padding:10px;margin:6px 0;font-size:0.875rem;line-height:1.6}.overlap-chooser .chooser-cancel{background:transparent;text-align:center;color:#afc8db}
</style>
