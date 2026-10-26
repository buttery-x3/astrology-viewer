<script lang="ts">
  import { onMount } from 'svelte';
  import type { HoverCardModel } from '../domain/hover-card';
  import { ASPECT_CARD_THEMES, cardSparkles } from '../domain/hover-card-themes';
  import FeatureGlyph from './FeatureGlyph.svelte';
  let {
    model,
    id,
    motion = true,
    sparkles = true,
  }: { model: HoverCardModel; id?: string; motion?: boolean; sparkles?: boolean } = $props();
  const uid = $props.id();
  let documentVisible = $state(true),
    reducedMotion = $state(false);
  const theme = $derived(model.aspect ? ASPECT_CARD_THEMES[model.aspect.type] : null);
  const points = $derived(cardSparkles(model.id));
  const animate = $derived(motion && sparkles && documentVisible && !reducedMotion);
  onMount(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
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

<article
  id={id ?? uid}
  class:aspect-card={!!theme}
  class:animate
  class:static-card={!animate}
  class="hover-card"
  role="tooltip"
  data-testid="hover-card"
  data-feature-kind={model.kind}
  data-aspect-type={model.aspect?.type}
  style={`--accent:${theme?.accent ?? model.glyph.color};--warm:${theme?.warm ?? '#38546a'};--cool:${theme?.cool ?? '#26364f'}`}
>
  <div class="card-interior">
    {#if theme}<div class="sparkle-field" aria-hidden="true">
        {#each points as point (point.index)}<svg
            class="glint"
            style={`--x:${point.index < 8 ? point.x : point.index % 2 ? 98 : 2}%;--y:${point.index < 8 ? `${point.y}px` : `${point.y}%`};--size:${point.size}px;--delay:${point.delay}s;--duration:${point.duration}s`}
            viewBox="0 0 16 16"><path d="M8 0 10 6 16 8 10 10 8 16 6 10 0 8 6 6Z" /></svg
          >{/each}
      </div>{/if}
    <header class="identity">
      {#if model.aspect && theme}
        <div class="aspect-heading">
          <span class="eyebrow">Planetary relationship</span>
          <h2>{theme.name}</h2>
          <span class="corner-symbol" aria-hidden="true"
            ><FeatureGlyph name={model.aspect.type} size={42} /></span
          >
        </div>
        <div
          class="relationship"
          aria-label={`${model.aspect.bodyA.name} ${theme.name.toLowerCase()} ${model.aspect.bodyB.name}`}
        >
          {#each [model.aspect.bodyA, model.aspect.bodyB] as body, index (body.id)}
            {#if index === 1}<div class="relationship-symbol" aria-hidden="true">
                <span></span><FeatureGlyph name={model.aspect.type} size={31} /><span></span>
              </div>{/if}
            <div class="planet-identity">
              <div class="medallion" style={`--body-color:${body.color}`}>
                <FeatureGlyph name={body.id} color={body.color} size={37} />
              </div>
              <strong>{body.name}</strong>
              <div class="placement-label">
                <FeatureGlyph name={body.sign.id} size={15} /><span
                  >{body.sign.name} {body.sign.degree.toFixed(2)}°</span
                >
              </div>
            </div>
          {/each}
        </div>
      {:else}<div class="simple-heading">
          <span class="feature-emblem"
            ><FeatureGlyph name={model.glyph.key} color={model.glyph.color} size={32} /></span
          >
          <div>
            <span class="eyebrow">{model.kicker}</span>
            <h2>{model.title}</h2>
          </div>
        </div>{/if}
    </header>
    {#if model.notices.length}<div class="context-notices">
        {#each model.notices as notice (notice)}<span>{notice}</span>{/each}
      </div>{/if}
    <div class="reading">
      {#each model.sections as section, index (section.id)}
        {#if model.aspect && index === 2}<div class="and-connector" aria-hidden="true">
            <span></span>and<span></span>
          </div>{/if}
        <section class="reading-panel" data-claim-section={section.id}>
          <h3>
            {#if model.aspect && index > 0}<FeatureGlyph
                name={index === 1 ? model.aspect.bodyA.id : model.aspect.bodyB.id}
                color={index === 1 ? model.aspect.bodyA.color : model.aspect.bodyB.color}
                size={20}
              />{/if}{section.title}
          </h3>
          {#each section.paragraphs as paragraph (paragraph.claimId)}<p
              data-claim-id={paragraph.claimId}
              data-claim-role={paragraph.role}
            >
              {#if paragraph.role === 'tradition' && (!model.aspect || index > 0)}<span
                  class="claim-label">Traditional interpretation</span
                >{/if}{paragraph.text}
            </p>{/each}
        </section>
      {/each}
    </div>
    {#if model.facts.length}<footer class="measurements">
        <dl>
          {#each model.facts as fact (fact.label)}<div>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>{/each}
        </dl>
      </footer>{/if}
  </div>
</article>

<style>
  .hover-card {
    width: min(410px, calc(100vw - 32px));
    max-height: min(85dvh, 820px);
    overflow: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
    border: 1.5px solid #50677b;
    border-radius: 19px;
    color: #eef2f8;
    background: #101b2b;
    box-shadow:
      0 18px 55px #01050bd9,
      0 2px 7px #0009;
    font:
      400 1rem/1.55 system-ui,
      sans-serif;
    isolation: isolate;
    pointer-events: auto;
    scrollbar-width: thin;
    scrollbar-color: #67788d #0b1422;
    animation: card-reveal 190ms ease-out both;
  }
  .aspect-card {
    border-color: transparent;
    background: linear-gradient(
        135deg,
        var(--accent),
        var(--warm) 30%,
        var(--cool) 77%,
        var(--accent)
      )
      border-box;
    box-shadow:
      0 18px 50px #01050bd9,
      0 0 26px color-mix(in srgb, var(--accent) 22%, transparent),
      inset 0 0 0 1px #ffffff18;
  }
  .card-interior {
    position: relative;
    overflow: hidden;
    border-radius: 17px;
    background:
      radial-gradient(
        ellipse at 2% 3%,
        color-mix(in srgb, var(--warm) 65%, transparent),
        transparent 58%
      ),
      radial-gradient(
        ellipse at 100% 21%,
        color-mix(in srgb, var(--cool) 80%, transparent),
        transparent 60%
      ),
      #09101f;
    min-height: 100%;
  }
  .identity {
    position: relative;
    z-index: 2;
    padding: 21px 22px 18px;
  }
  .eyebrow {
    display: block;
    font-size: 0.66rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #d0d9e6;
    line-height: 1.6;
    font-weight: 650;
  }
  .identity h2 {
    font:
      500 1.6rem/1.15 Georgia,
      serif;
    letter-spacing: 0.015em;
    margin: 5px 0 0;
    color: #fff9f2;
    text-wrap: balance;
  }
  .aspect-heading h2 {
    font-size: 1.8rem;
    color: var(--accent);
  }
  .aspect-heading {
    position: relative;
  }
  .corner-symbol {
    position: absolute;
    right: -5px;
    top: 1px;
    color: var(--accent);
    opacity: 0.19;
    transform: rotate(-8deg);
  }
  .relationship {
    display: grid;
    grid-template-columns: 1fr 58px 1fr;
    align-items: start;
    margin-top: 20px;
    position: relative;
  }
  .planet-identity {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .planet-identity strong {
    font-size: 1.03rem;
    letter-spacing: 0.02em;
    color: #fff3e7;
    font-weight: 600;
  }
  .medallion {
    display: grid;
    place-items: center;
    width: 70px;
    height: 70px;
    border: 1px solid var(--body-color);
    outline: 1px solid #ffffff13;
    outline-offset: 5px;
    border-radius: 50%;
    background: radial-gradient(
      circle at 30% 25%,
      color-mix(in srgb, var(--body-color) 14%, transparent),
      #09101dd9 72%
    );
    box-shadow:
      0 0 25px color-mix(in srgb, var(--body-color) 18%, transparent),
      inset 0 0 18px #ffffff04;
  }
  .placement-label {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
    font-size: 0.75rem;
    color: #dae4ef;
    text-align: center;
    flex-wrap: wrap;
  }
  .relationship-symbol {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin: 22px -13px 0;
    color: var(--accent);
    z-index: 1;
  }
  .relationship-symbol span {
    height: 1px;
    flex: 1;
    background: linear-gradient(90deg, transparent, var(--accent));
    min-width: 15px;
  }
  .relationship-symbol span:last-child {
    transform: scaleX(-1);
  }
  .simple-heading {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .simple-heading h2 {
    font-family: system-ui, sans-serif;
    font-size: 1.3rem;
  }
  .feature-emblem {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 49px;
    height: 49px;
    border: 1px solid #b8d0e32c;
    border-radius: 13px;
    background: #0a1425;
  }
  .reading {
    position: relative;
    z-index: 3;
    padding: 0 15px 16px;
    display: grid;
    gap: 11px;
  }
  .reading-panel {
    padding: 13px 15px 15px;
    border: 1px solid #dae5f21a;
    border-radius: 12px;
    background: rgba(7, 12, 24, 0.92);
    box-shadow: inset 0 1px 0 #ffffff05;
  }
  .reading-panel h3 {
    font-size: 0.78rem;
    line-height: 1.5;
    margin: 0 0 8px;
    font-weight: 600;
    color: #dbe3ef;
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.015em;
  }
  .reading-panel p {
    font-size: 1rem;
    line-height: 1.55;
    margin: 0;
    color: #eef2f8;
    overflow-wrap: anywhere;
  }
  .reading-panel p + p {
    margin-top: 10px;
  }
  .claim-label {
    display: block;
    font-size: 0.63rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #abbace;
    margin-bottom: 5px;
  }
  .and-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 11px;
    font:
      italic 0.83rem Georgia,
      serif;
    color: var(--accent);
    margin: -3px 0;
  }
  .and-connector span {
    height: 1px;
    width: 30px;
    background: linear-gradient(90deg, transparent, #c8bddd55);
  }
  .and-connector span:last-child {
    transform: scaleX(-1);
  }
  .context-notices {
    position: relative;
    z-index: 3;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 20px 13px;
  }
  .context-notices span {
    padding: 4px 8px;
    border-radius: 5px;
    border: 1px solid #d5b98744;
    background: #171b2be8;
    font-size: 0.69rem;
    line-height: 1.5;
    color: #eadbc4;
  }
  .measurements {
    position: relative;
    z-index: 3;
    background: #070e1cdc;
    border-top: 1px solid #dae5f21c;
    padding: 13px 20px 17px;
  }
  .measurements dl {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 11px 16px;
  }
  .measurements dt {
    font-size: 0.66rem;
    color: #aebcd0;
    line-height: 1.5;
  }
  .measurements dd {
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    margin: 3px 0 0;
    color: #e4ecf7;
    overflow-wrap: anywhere;
    line-height: 1.5;
  }
  .sparkle-field {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: hidden;
    contain: paint;
  }
  .glint {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: var(--size);
    height: var(--size);
    fill: var(--accent);
    opacity: 0.48;
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
    opacity: 0.48;
  }
  @keyframes glint {
    0%,
    70%,
    100% {
      opacity: 0.13;
      transform: translate(-50%, -50%) scale(0.6);
    }
    25% {
      opacity: 0.8;
      transform: translate(calc(-50% + 1px), calc(-50% - 2px)) scale(1.05);
    }
  }
  @keyframes card-reveal {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
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
      border: 2px solid CanvasText;
      background: Canvas;
      color: CanvasText;
      box-shadow: none;
    }
    .card-interior,
    .reading-panel,
    .measurements,
    .medallion,
    .feature-emblem,
    .context-notices span {
      background: Canvas;
      color: CanvasText;
      border-color: CanvasText;
    }
    .identity h2,
    .eyebrow,
    .planet-identity strong,
    .placement-label,
    .reading-panel p,
    .reading-panel h3,
    .claim-label,
    .measurements dd,
    .measurements dt {
      color: CanvasText;
    }
    .sparkle-field,
    .corner-symbol {
      display: none;
    }
    .medallion {
      outline-color: CanvasText;
      box-shadow: none;
    }
    .relationship-symbol {
      color: CanvasText;
    }
  }
</style>
