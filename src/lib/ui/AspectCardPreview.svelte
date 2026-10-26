<script lang="ts">
  import HoverCard from './HoverCard.svelte';
  import { aspectPreviewModel } from '../domain/hover-card';
  import { ASPECT_TYPES } from '../domain/chart';
  let { motion = true, largeText = false }: { motion?: boolean; largeText?: boolean } = $props();
</script>

<section
  class:large-text={largeText}
  class="aspect-preview"
  aria-label="Five aspect card design studies"
>
  <header>
    <span>Visual studies · illustrative positions</span>
    <h1>Five relationships, one celestial language.</h1>
    <p>
      Static theme studies and the animated Venus–Neptune square. These fixtures do not represent a
      calculated birth chart.
    </p>
  </header>
  <div class="theme-grid">
    {#each ASPECT_TYPES as aspect (aspect.id)}<div class="study">
        <HoverCard model={aspectPreviewModel(aspect.id)} motion={false} sparkles={false} />
      </div>{/each}
  </div>
  <div class="animated-study">
    <h2>Venus in Aries · Neptune in Capricorn</h2>
    <p>
      {motion ? 'Motion enabled' : 'Reduced-motion composition'} · {largeText
        ? 'Large text'
        : 'Normal text'}
    </p>
    <HoverCard model={aspectPreviewModel('square')} {motion} sparkles={true} />
  </div>
</section>

<style>
  .aspect-preview {
    padding: clamp(24px, 5vw, 70px);
    background: radial-gradient(ellipse at 15% 0, #20344d, #060c15 65%);
    color: #ecf0f8;
    font: 1rem/1.6 system-ui;
    min-height: 100vh;
  }
  .aspect-preview > header {
    max-width: 700px;
    margin-bottom: 40px;
  }
  .aspect-preview > header span {
    font-size: 0.7rem;
    letter-spacing: 0.17em;
    text-transform: uppercase;
    color: #bdb0cb;
  }
  .aspect-preview h1 {
    font:
      400 clamp(2rem, 4vw, 3.4rem)/1.15 Georgia,
      serif;
    margin: 15px 0;
  }
  .aspect-preview p {
    color: #b9c7d9;
  }
  .theme-grid {
    display: flex;
    gap: 28px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .study {
    max-width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #081224, #506b83);
    border-radius: 25px;
  }
  .animated-study {
    margin-top: 55px;
  }
  .animated-study h2 {
    font:
      400 1.8rem Georgia,
      serif;
  }
  .large-text :global(.hover-card) {
    font-size: 1.25rem;
  }
  .large-text :global(.reading-panel p) {
    font-size: 1.25rem;
  }
  .large-text :global(.hover-card) {
    max-height: none;
  }
  .aspect-preview :global(.hover-card) {
    max-width: 100%;
    max-height: none;
  }
</style>
