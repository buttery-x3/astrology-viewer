<script lang="ts">
  import { onMount } from 'svelte';
  import type { HoverCardModel } from '../domain/hover-card';
  import { hoverPreview } from '../domain/hover-preview';
  import { cardSparkles } from '../domain/hover-card-themes';
  import FeatureGlyph from './FeatureGlyph.svelte';
  let {
    model,
    id,
    motion = true,
    sparkles = true,
    dense = false,
    fullWidthPlacements = false,
  }: {
    model: HoverCardModel;
    id?: string;
    motion?: boolean;
    sparkles?: boolean;
    dense?: boolean;
    fullWidthPlacements?: boolean;
  } = $props();
  const uid = $props.id();
  const preview = $derived(hoverPreview(model));
  const points = $derived(cardSparkles(model.id));
  let viewportHeight = $state(Infinity);
  let documentVisible = $state(true),
    reducedMotion = $state(false);
  const animate = $derived(motion && sparkles && documentVisible && !reducedMotion);
  onMount(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      documentVisible = !document.hidden;
      reducedMotion = preference.matches;
    };
    update();
    document.addEventListener('visibilitychange', update);
    preference.addEventListener('change', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      preference.removeEventListener('change', update);
    };
  });
</script>

<svelte:window bind:innerHeight={viewportHeight} />

<article
  id={id ?? uid}
  class="hover-card"
  class:aspect-card={!!preview.aspect}
  class:animate
  class:static-card={!animate}
  class:dense={dense || viewportHeight <= 500}
  class:full-width-placements={fullWidthPlacements}
  role="tooltip"
  data-testid="hover-card"
  data-feature-kind={preview.kind}
  data-snapshot-instant={model.snapshotInstantMs ?? undefined}
  data-feature-role={model.facts.find((fact) => fact.label === 'Feature role')?.value}
  data-aspect-type={preview.aspect?.type}
  data-theme={preview.theme.name}
  style:--accent={preview.theme.accent}
  style:--warm={preview.theme.warm}
  style:--cool={preview.theme.cool}
>
  <div class="card-interior">
    <div class="sparkle-field" aria-hidden="true">
      {#each points as point (point.index)}<svg
          class="glint"
          style:--x={(point.index < 8 ? point.x : point.index % 2 ? 99 : 1) + '%'}
          style:--y={point.index < 8 ? Math.min(point.y, 14) + 'px' : point.y + '%'}
          style:--size={point.size + 'px'}
          style:--delay={point.delay + 's'}
          style:--duration={point.duration + 's'}
          viewBox="0 0 16 16"><path d="M8 0 10 6 16 8 10 10 8 16 6 10 0 8 6 6Z" /></svg
        >{/each}
    </div>
    <header class="identity">
      {#if preview.aspect}
        <div class="relationship-heading">
          <p class="relationship-identity">
            <span class="body-name" style:color={preview.aspect.bodyA.color}
              ><FeatureGlyph name={preview.aspect.bodyA.id} size={23} />{preview.aspect.bodyA
                .name}</span
            >
            <span class="relationship-symbol"
              ><FeatureGlyph name={preview.aspect.type} size={20} /></span
            >
            <span class="body-name" style:color={preview.aspect.bodyB.color}
              ><FeatureGlyph name={preview.aspect.bodyB.id} size={23} />{preview.aspect.bodyB
                .name}</span
            >
          </p>
          <h2 class="aspect-name">{preview.theme.name}</h2>
        </div>
      {:else}
        <span class="feature-emblem"><FeatureGlyph name={preview.glyph.key} size={29} /></span>
        <div class="identity-text">
          <span class="eyebrow">{preview.kicker}</span>
          <h2>{preview.title}</h2>
        </div>
      {/if}
    </header>
    {#if preview.identity.length}<p class="identity-line">{preview.identity.join(' · ')}</p>{/if}
    {#if preview.caption}<p class="geometric-caption">{preview.caption}</p>{/if}
    {#if preview.notices.length}<div class="context-notices">
        {#each preview.notices as notice (notice)}<span>{notice}</span>{/each}
      </div>{/if}
    <div class="reading" class:relationship-reading={!!preview.aspect}>
      {#each preview.sections as section, index (section.id)}
        {#if index === preview.firstTraditionalSection}<p class="claim-label">
            Traditional interpretation
          </p>{/if}
        {#if preview.aspect && index === 2}<div class="and-connector" aria-hidden="true">
            <span></span>and<span></span>
          </div>{/if}
        <section
          class="reading-panel"
          data-claim-section={section.id}
          class:relationship-lead={!!preview.aspect && index === 0}
        >
          {#if preview.aspect && index > 0}
            {@const body = index === 1 ? preview.aspect.bodyA : preview.aspect.bodyB}
            <h3 class="planet-identity">
              <FeatureGlyph name={body.id} color={body.color} size={18} /><span
                >{body.name} in
                <span class="sign-name"
                  ><FeatureGlyph name={body.sign.id} size={14} />{body.sign.name}</span
                ></span
              >
            </h3>
          {:else if !(preview.aspect && index === 0) && !['Traditional interpretation', 'Traditional body theme', 'Traditional angle theme', 'Body meaning'].includes(section.title)}
            <h3>{section.title}</h3>
          {/if}
          {#each section.paragraphs as paragraph (paragraph.claimId)}<p
              data-claim-id={paragraph.claimId}
              data-claim-role={paragraph.role}
            >
              {paragraph.text}
            </p>{/each}
        </section>
      {/each}
    </div>
  </div>
</article>

<style>
  .hover-card {
    box-sizing: border-box;
    width: 100%;
    border: 1.5px solid transparent;
    border-radius: 15px;
    color: #f0f3fa;
    background: linear-gradient(
        135deg,
        var(--accent),
        var(--warm) 32%,
        var(--cool) 76%,
        var(--accent)
      )
      border-box;
    box-shadow:
      0 15px 42px #01050bbf,
      0 0 21px color-mix(in srgb, var(--accent) 20%, transparent),
      inset 0 0 0 1px #ffffff16;
    font:
      400 0.8125rem/1.38 system-ui,
      sans-serif;
    isolation: isolate;
    pointer-events: auto;
    animation: card-reveal 160ms ease-out both;
    overflow-wrap: anywhere;
  }
  .card-interior {
    position: relative;
    border-radius: 13px;
    padding: 12px;
    background:
      radial-gradient(
        ellipse at 0 0,
        color-mix(in srgb, var(--warm) 58%, transparent),
        transparent 70%
      ),
      radial-gradient(
        ellipse at 100% 5%,
        color-mix(in srgb, var(--cool) 68%, transparent),
        transparent 75%
      ),
      #0b1322;
  }
  .identity {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    min-width: 0;
  }
  .identity-text {
    min-width: 0;
  }
  .identity h2 {
    font:
      600 1.0625rem/1.2 system-ui,
      sans-serif;
    color: #fff8ed;
    margin: 1px 0 0;
    letter-spacing: 0.005em;
  }
  .eyebrow {
    display: block;
    font-size: 0.64rem;
    line-height: 1.3;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #e0e7f1;
  }
  .feature-emblem {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 39px;
    height: 39px;
    border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
    border-radius: 11px;
    color: var(--accent);
    background: radial-gradient(
      circle at 30% 20%,
      color-mix(in srgb, var(--accent) 20%, transparent),
      #0b1523bd
    );
    box-shadow:
      0 0 16px color-mix(in srgb, var(--accent) 20%, transparent),
      inset 0 0 12px #ffffff06;
  }
  .relationship-heading {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 9px;
    flex-wrap: wrap;
  }
  .relationship-heading .relationship-identity {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 1.0625rem;
    margin: 0;
  }
  .body-name {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .relationship-symbol {
    display: inline-flex;
    color: var(--accent);
  }
  .aspect-name {
    color: var(--accent);
    font:
      500 1.125rem/1.2 Georgia,
      serif;
  }
  .identity-line,
  .geometric-caption {
    position: relative;
    z-index: 2;
    font-size: 0.75rem;
    line-height: 1.4;
    margin: 0 0 7px;
    color: #e0e7ef;
  }
  .identity-line {
    color: #e8d7bb;
  }
  .geometric-caption {
    font-size: inherit;
  }
  .context-notices {
    position: relative;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 0 0 7px;
  }
  .context-notices span {
    font-size: 0.69rem;
    line-height: 1.35;
    border-left: 2px solid #d7b97f;
    padding: 2px 6px;
    color: #f0dfbd;
    background: #121b2acc;
    border-radius: 0 4px 4px 0;
  }
  .reading {
    position: relative;
    z-index: 2;
    display: grid;
    gap: 7px;
  }
  .reading-panel {
    padding: 8px 9px;
    border: 1px solid #dce7f21c;
    border-radius: 9px;
    background: #070e1aeb;
    box-shadow: inset 0 1px 0 #ffffff04;
    min-width: 0;
  }
  .reading-panel h3 {
    font-size: inherit;
    font-weight: 650;
    line-height: 1.35;
    margin: 0 0 4px;
    color: #e4eaf5;
  }
  .reading-panel p {
    font: inherit;
    line-height: 1.38;
    margin: 0;
    color: #f0f3fa;
  }
  .reading-panel p + p {
    margin-top: 5px;
  }
  .claim-label {
    font-size: 0.62rem;
    line-height: 1.2;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #d0dbea;
    margin: 0 1px -3px;
  }
  .planet-identity {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .planet-identity :global(svg) {
    flex-shrink: 0;
  }
  .sign-name {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: #f1debd;
  }
  .relationship-lead {
    padding: 0 1px;
    border: 0;
    background: none;
    box-shadow: none;
  }
  .relationship-reading .planet-identity {
    margin-bottom: 5px;
  }
  .sparkle-field {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: clip;
    contain: paint;
    border-radius: 13px;
  }
  .glint {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: var(--size);
    height: var(--size);
    fill: var(--accent);
    opacity: 0.55;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .animate .glint {
    animation: glint var(--duration) ease-in-out var(--delay) infinite;
  }
  .static-card .glint:nth-child(n + 5) {
    display: none;
  }
  .static-card {
    animation: none;
  }
  .static-card .glint {
    opacity: 0.55;
  }
  .dense .card-interior {
    padding: 9px;
  }
  .dense .identity {
    gap: 8px;
    margin-bottom: 6px;
  }
  .dense .feature-emblem {
    width: 32px;
    height: 32px;
    border-radius: 9px;
  }
  .dense .identity h2,
  .dense .relationship-heading .relationship-identity {
    font-size: 1rem;
  }
  .dense .aspect-name {
    font-size: 1rem;
  }
  .dense .identity-line,
  .dense .geometric-caption {
    margin-bottom: 5px;
  }
  .dense .context-notices {
    margin-bottom: 5px;
  }
  .dense .reading {
    gap: 5px;
    border: 1px solid #dce7f21c;
    border-radius: 9px;
    padding: 7px 8px;
    background: #070e1aeb;
  }
  .dense .reading-panel {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: none;
    box-shadow: none;
  }
  .dense .reading-panel h3 {
    display: inline;
    margin: 0 0.3em 0 0;
  }
  .dense .reading-panel p {
    display: inline;
  }
  .dense .reading-panel p + p:before {
    content: ' ';
  }
  .dense .claim-label {
    margin: 0;
    font-size: 0.62rem;
  }
  .dense .relationship-reading .planet-identity {
    display: flex;
    margin: 0 0 3px;
  }
  .dense .relationship-reading {
    grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr);
    gap: 5px 6px;
  }
  .dense .relationship-reading .claim-label,
  .dense .relationship-reading .relationship-lead {
    grid-column: 1/-1;
  }
  .dense .relationship-reading .and-connector {
    align-self: center;
    flex-direction: column;
    gap: 4px;
    font-size: 0.69rem;
  }
  .dense .relationship-reading .and-connector span {
    width: 1px;
    height: 10px;
  }
  .dense .relationship-reading .reading-panel:not(.relationship-lead) {
    padding-top: 5px;
    border-top: 1px solid #dce7f226;
  }

  .full-width-placements .card-interior {
    padding: 6px;
  }
  .full-width-placements .relationship-reading {
    display: block;
    padding: 5px 8px;
  }
  .full-width-placements .relationship-reading .claim-label {
    margin-bottom: 3px;
  }
  .full-width-placements .relationship-reading .relationship-lead {
    display: block;
    margin-bottom: 4px;
  }
  .full-width-placements .relationship-reading .reading-panel:not(.relationship-lead) {
    display: inline;
    padding: 0;
    border: 0;
  }
  .full-width-placements .relationship-reading .reading-panel:nth-of-type(2) {
    display: block;
    margin-bottom: 4px;
  }
  .full-width-placements .relationship-reading .planet-identity {
    display: inline;
    margin: 0 0.3em 0 0;
  }
  .full-width-placements .planet-identity :global(svg) {
    vertical-align: -0.15em;
  }
  .full-width-placements .relationship-reading .and-connector {
    display: inline;
    margin-right: 0.4em;
  }
  .full-width-placements .relationship-reading .and-connector span {
    display: none;
  }
  .and-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: var(--accent);
    font:
      italic 0.75rem/1.2 Georgia,
      serif;
  }
  .and-connector span {
    width: 24px;
    height: 1px;
    background: color-mix(in srgb, var(--accent) 50%, transparent);
  }
  @keyframes glint {
    0%,
    70%,
    100% {
      opacity: 0.15;
      transform: translate(-50%, -50%) scale(0.65);
    }
    25% {
      opacity: 0.85;
      transform: translate(calc(-50% + 1px), calc(-50% - 1px)) scale(1.05);
    }
  }
  @keyframes card-reveal {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hover-card,
    .animate .glint {
      animation: none;
    }
    .glint:nth-child(n + 5) {
      display: none;
    }
  }
  @media (forced-colors: active) {
    .hover-card {
      border-color: CanvasText;
      background: Canvas;
      color: CanvasText;
      box-shadow: none;
    }
    .card-interior,
    .reading,
    .reading-panel,
    .feature-emblem,
    .context-notices span {
      background: Canvas;
      color: CanvasText;
      border-color: CanvasText;
      box-shadow: none;
    }
    .identity h2,
    .eyebrow,
    .aspect-name,
    .identity-line,
    .geometric-caption,
    .reading-panel h3,
    .reading-panel p,
    .claim-label,
    .sign-name {
      color: CanvasText;
    }
    .body-name {
      color: CanvasText !important;
    }
    .sparkle-field {
      display: none;
    }
  }
</style>
