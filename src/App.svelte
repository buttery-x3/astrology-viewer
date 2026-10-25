<script lang="ts">
  import { onMount } from 'svelte';
  import { HOUSE_SYSTEMS, type BodyPosition } from './lib/astronomy/ephemeris';
  import { createExplorerStore } from './lib/state/explorer';
  import SceneCanvas from './lib/ui/SceneCanvas.svelte';

  const explorer = createExplorerStore();
  const bodies = [
    { id: 'sun', name: 'Sun', glyph: '☉', color: '#f1c576' },
    { id: 'moon', name: 'Moon', glyph: '☽', color: '#d5deeb' },
    { id: 'mercury', name: 'Mercury', glyph: '☿', color: '#bfc7dc' },
    { id: 'venus', name: 'Venus', glyph: '♀', color: '#e9c7a3' },
    { id: 'mars', name: 'Mars', glyph: '♂', color: '#ee958d' },
    { id: 'jupiter', name: 'Jupiter', glyph: '♃', color: '#dbc18d' },
    { id: 'saturn', name: 'Saturn', glyph: '♄', color: '#cbb88e' },
    { id: 'uranus', name: 'Uranus', glyph: '♅', color: '#91d6d6' },
    { id: 'neptune', name: 'Neptune', glyph: '♆', color: '#92a8ee' },
    { id: 'pluto', name: 'Pluto', glyph: '♇', color: '#c8ade6' },
  ];
  const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const views = [{ id: 'overview', label: 'Earth overview' }, { id: 'observer', label: 'Observer sky' }, { id: 'outside', label: 'Outside sphere' }] as const;
  const layerOptions = [{ id: 'bodies', label: 'Celestial bodies' }, { id: 'horizon', label: 'Horizon & compass' }, { id: 'ecliptic', label: 'Ecliptic & zodiac' }] as const;
  const anchorMs = Date.UTC(2000, 0, 1, 12);
  let welcome = $state(true);
  let formOpen = $state(false);
  let leftOpen = $state(false);
  let rightOpen = $state(false);
  let draftDate = $state('2000-01-01');
  let draftTime = $state('12:00:00');
  let draftLat = $state('51.5');
  let draftLon = $state('0');
  let formError = $state('');
  let sceneStatus = $state<string | null>(null);
  let formDialog: HTMLDialogElement;
  let sceneCanvas: { focusSelection(): void; returnToObserver(): void } | undefined = $state();
  let personalAnchor = $state(anchorMs);

  const selectedBody = $derived($explorer.snapshot?.bodies.find((body) => `body:${body.id}` === $explorer.selectedId));
  const selectedMeta = $derived(bodies.find((body) => body.id === selectedBody?.id));
  const shownInstant = $derived($explorer.snapshot?.instantMs ?? $explorer.input.instantMs);
  const selectedHouses = $derived($explorer.snapshot?.houses[0]);
  const busy = $derived($explorer.status === 'loading' || $explorer.status === 'pending');
  const statusLabel = $derived($explorer.error ? 'Calculation needs attention' : busy ? 'Calculating requested moment…' : $explorer.snapshot ? 'Moment calculated' : 'Preparing observatory…');

  onMount(() => {
    explorer.init();
    return () => explorer.destroy();
  });

  function formatInstant(ms: number) {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(ms).replace(',', ' ·');
  }
  function coordinate(value: number, positive: string, negative: string) { return `${Math.abs(value).toFixed(2)}° ${value < 0 ? negative : positive}`; }
  function deg(value: number, digits = 2) { return `${value.toFixed(digits)}°`; }
  function sign(body: BodyPosition) { return signs[Math.floor(body.longitudeDeg / 30)] ?? 'Unknown'; }
  function houseFor(body: BodyPosition): string {
    if (!selectedHouses || selectedHouses.status !== 'valid') return 'Unavailable';
    const winding = selectedHouses.cusps.reduce((sum, cusp, index, cusps) => sum + (cusps[(index + 1) % 12]! - cusp + 360) % 360, 0);
    if (Math.abs(winding - 360) > 0.0001) return 'Unavailable';
    for (let i = 0; i < 12; i++) {
      const start = selectedHouses.cusps[i]!;
      const end = selectedHouses.cusps[(i + 1) % 12]!;
      const span = (end - start + 360) % 360;
      const distance = (body.longitudeDeg - start + 360) % 360;
      if (distance < span) return String(i + 1);
    }
    return 'Unavailable';
  }
  function selectBody(id: string) { explorer.select(`body:${id}`); rightOpen = true; }
  function openForm() {
    const date = new Date($explorer.input.instantMs).toISOString();
    draftDate = date.slice(0, 10); draftTime = date.slice(11, 19);
    draftLat = String($explorer.input.observer.latitudeDeg); draftLon = String($explorer.input.observer.longitudeDeg);
    formError = ''; formOpen = true;
  }
  $effect(() => {
    if (!formDialog) return;
    if (formOpen && !formDialog.open) formDialog.showModal();
    if (!formOpen && formDialog.open) formDialog.close();
  });
  function commitMoment(event: SubmitEvent) {
    event.preventDefault();
    const instantMs = Date.parse(`${draftDate}T${draftTime || '00:00:00'}Z`);
    const latitudeDeg = Number(draftLat), longitudeDeg = Number(draftLon);
    if (!Number.isFinite(instantMs) || instantMs < Date.UTC(1900, 0, 1) || instantMs >= Date.UTC(2101, 0, 1)) { formError = 'Enter a UTC date and time between 1900 and 2100.'; return; }
    if (draftLat.trim() === '' || draftLon.trim() === '' || !Number.isFinite(latitudeDeg) || Math.abs(latitudeDeg) > 90 || !Number.isFinite(longitudeDeg) || Math.abs(longitudeDeg) > 180) { formError = 'Enter latitude from −90 to 90 and longitude from −180 to 180.'; return; }
    personalAnchor = instantMs;
    explorer.requestChart({ instantMs, observer: { latitudeDeg, longitudeDeg } });
    formOpen = false; welcome = false;
  }
  function step(days: number) {
    const instantMs = $explorer.input.instantMs + days * 86400000;
    if (instantMs >= Date.UTC(1900, 0, 1) && instantMs < Date.UTC(2101, 0, 1)) explorer.requestChart({ instantMs });
  }
  function onKey(event: KeyboardEvent) {
    const target = event.target;
    if (formOpen || target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    if (event.key === 'Escape') { explorer.select(null); leftOpen = false; rightOpen = false; }
    if (event.key.toLowerCase() === 'f') sceneCanvas?.focusSelection();
    if (event.key.toLowerCase() === 'o') { explorer.setViewpoint('observer'); sceneCanvas?.returnToObserver(); }
  }
</script>

<svelte:window onkeydown={onKey} />

<a class="skip-link" href="#object-list">Skip to celestial objects</a>
<div class="observatory">
  <header class="context-bar">
    <button class="brand" onclick={() => welcome = true} aria-label="Spatial Astrology home">
      <span class="brand-mark" aria-hidden="true"><span></span>✦</span>
      <span><strong>SPATIAL</strong><small>ASTROLOGY EXPLORER</small></span>
    </button>
    <div class="context-details">
      <span class="context-symbol" aria-hidden="true">◷</span>
      <span><strong>{formatInstant(shownInstant)}</strong><small>UTC · Gregorian calendar</small></span>
      <span class="context-divider"></span>
      <span class="context-location"><strong>{coordinate($explorer.snapshot?.observer.latitudeDeg ?? $explorer.input.observer.latitudeDeg, 'N', 'S')} <span class="dot">·</span> {coordinate($explorer.snapshot?.observer.longitudeDeg ?? $explorer.input.observer.longitudeDeg, 'E', 'W')}</strong><small>Observer location</small></span>
    </div>
    <button class="button secondary compact" onclick={openForm}><span aria-hidden="true">⌖</span> Edit moment</button>
  </header>

  <main class="workspace">
    <button class="mobile-panel-toggle left-toggle" aria-expanded={leftOpen} aria-controls="explorer-dock" onclick={() => { leftOpen = !leftOpen; rightOpen = false; }}>☷ Explore</button>
    <aside id="explorer-dock" class:drawer-open={leftOpen} class="explorer-dock panel">
      <div class="panel-heading"><span class="eyebrow">YOUR OBSERVATORY</span><button class="drawer-close icon-button" onclick={() => leftOpen = false} aria-label="Close explorer panel">×</button></div>
      <section class="dock-section">
        <h2>Point of view</h2>
        <div class="view-options" role="group" aria-label="Camera viewpoint">
          {#each views as view, i (view.id)}
            <button class:active={$explorer.viewpoint === view.id} onclick={() => explorer.setViewpoint(view.id)} aria-pressed={$explorer.viewpoint === view.id}><span class="view-icon" aria-hidden="true">{['◎', '⌖', '◈'][i]}</span>{view.label}<span class="view-check" aria-hidden="true">{$explorer.viewpoint === view.id ? '•' : ''}</span></button>
          {/each}
        </div>
      </section>
      <section class="dock-section">
        <h2>Reference layers</h2>
        <div class="layer-options">
          {#each layerOptions as layer (layer.id)}
            <label class="layer-row"><span>{layer.label}</span><input type="checkbox" checked={$explorer.layers[layer.id]} onchange={(event) => explorer.setLayer(layer.id, event.currentTarget.checked)} /><span class="toggle-track" aria-hidden="true"></span></label>
          {/each}
        </div>
      </section>
      <section class="dock-section">
        <label class="field-title" for="house-system">House system</label>
        <select id="house-system" value={$explorer.input.system} onchange={(event) => explorer.requestChart({ system: event.currentTarget.value as typeof $explorer.input.system })}>
          {#each HOUSE_SYSTEMS as system (system.id)}<option value={system.id}>{system.name}</option>{/each}
        </select>
        <p class="field-note">Tropical zodiac · geocentric positions</p>
        {#if busy && selectedHouses && selectedHouses.system !== $explorer.input.system}<p class="field-note">Previous {HOUSE_SYSTEMS.find((system) => system.id === selectedHouses.system)?.name} result shown while calculating.</p>{/if}
      </section>
      <section class="dock-section object-section">
        <div class="section-title"><h2 id="object-list" tabindex="-1">Celestial objects</h2><span class="count">10</span></div>
        <div class="object-list" aria-label="Select celestial body">
          {#each bodies as body (body.id)}
            {@const position = $explorer.snapshot?.bodies.find((value) => value.id === body.id)}
            <button class:chosen={$explorer.selectedId === `body:${body.id}`} onclick={() => selectBody(body.id)} aria-pressed={$explorer.selectedId === `body:${body.id}`}><span class="body-glyph" style:color={body.color} aria-hidden="true">{body.glyph}</span><span>{body.name}</span><small>{position ? `${(position.longitudeDeg % 30).toFixed(1)}° ${sign(position).slice(0, 3)}` : '—'}</small></button>
          {/each}
        </div>
      </section>
      <div class="dock-footer"><span class="status-dot"></span> Browser calculation <a href="https://github.com/aloistr/swisseph" target="_blank" rel="noreferrer">Swiss Ephemeris ↗</a></div>
    </aside>

    <section class="scene-stage" aria-label="Spatial exploration">
      <div class="scene-topline"><span class="scene-tag"><span class="status-dot"></span> CELESTIAL SPHERE</span><span class="scene-mode">{views.find((view) => view.id === $explorer.viewpoint)?.label}</span></div>
      <span class="schematic-label">Schematic sky · distances not to scale</span>
      <SceneCanvas bind:this={sceneCanvas} snapshot={$explorer.snapshot} presentation={{ viewpoint: $explorer.viewpoint, selectedId: $explorer.selectedId, layers: $explorer.layers }} onSelect={(id) => { explorer.select(id); if (id) rightOpen = true; }} onViewpoint={(viewpoint) => explorer.setViewpoint(viewpoint)} onStatus={(message) => sceneStatus = message} />
      {#if welcome}
        <div class="welcome-card">
          <span class="eyebrow">A DIFFERENT PERSPECTIVE</span>
          <h1>See the chart.<br /><em>Understand the space.</em></h1>
          <p>Explore how the sky, your horizon, and the zodiac fit together in one celestial sphere.</p>
          <div class="welcome-actions"><button class="button primary" onclick={() => welcome = false}>Explore example <span aria-hidden="true">↗</span></button><button class="text-button" onclick={openForm}>Enter a birth moment <span aria-hidden="true">→</span></button></div>
          <small>Example: 1 January 2000 · 12:00 UTC · Greenwich</small>
        </div>
      {/if}
      {#if sceneStatus}<div class="scene-notice" role="status"><strong>3D view unavailable</strong><span>{sceneStatus}</span><span>The moment controls and celestial object list remain available.</span></div>{/if}
      <div class="scene-controls"><button class="icon-button" onclick={() => sceneCanvas?.focusSelection()} aria-label="Focus selected body" title="Focus selection (F)">⌕</button><button class="icon-button" onclick={() => { explorer.setViewpoint('observer'); sceneCanvas?.returnToObserver(); }} aria-label="Return to observer" title="Return to observer (O)">⌖</button></div>
      <div class="scene-legend"><span><i class="legend-line cyan"></i> Horizon</span><span><i class="legend-line gold"></i> Ecliptic</span><span><i class="legend-line violet"></i> Equator</span></div>
      <div class="interaction-hint"><span>Drag to orbit</span><i>·</i><span>Scroll to zoom</span><i>·</i><kbd>F</kbd><span>focus</span></div>
    </section>

    <button class="mobile-panel-toggle right-toggle" aria-expanded={rightOpen} aria-controls="inspector" onclick={() => { rightOpen = !rightOpen; leftOpen = false; }}>ⓘ Inspector</button>
    <aside id="inspector" class:drawer-open={rightOpen} class="inspector panel">
      <div class="panel-heading"><span class="eyebrow">INSPECTOR</span><button class="drawer-close icon-button" onclick={() => rightOpen = false} aria-label="Close inspector panel">×</button></div>
      {#if selectedBody && selectedMeta}
        <div class="selected-heading"><span class="selected-glyph" style:color={selectedMeta.color} aria-hidden="true">{selectedMeta.glyph}</span><span class="eyebrow">CELESTIAL BODY</span><h2>{selectedMeta.name}</h2><p>{sign(selectedBody)} <span class="dot">·</span> {deg(selectedBody.longitudeDeg % 30)}</p></div>
        <div class="inspector-section"><h3>Position in the chart</h3><dl class="data-list"><div><dt>Ecliptic longitude</dt><dd>{deg(selectedBody.longitudeDeg)}</dd></div><div><dt>Ecliptic latitude</dt><dd>{deg(selectedBody.latitudeDeg)}</dd></div><div><dt>House</dt><dd>{houseFor(selectedBody)}</dd></div><div><dt>Motion</dt><dd>{selectedBody.longitudeSpeedDegPerDay < 0 ? 'Retrograde' : 'Direct'}</dd></div></dl></div>
        <div class="inspector-section"><h3>From the observer</h3><dl class="data-list"><div><dt>Altitude</dt><dd>{deg(selectedBody.horizon.altitudeDeg)}</dd></div><div><dt>Azimuth</dt><dd>{selectedBody.horizon.azimuthDeg === null ? 'Undefined' : deg(selectedBody.horizon.azimuthDeg)}</dd></div><div><dt>Horizon</dt><dd class:above={selectedBody.horizon.altitudeDeg >= 0}>{selectedBody.horizon.altitudeDeg >= 0 ? 'Above' : 'Below'}</dd></div></dl><p class="field-note">Geometric horizon; atmospheric refraction is excluded.</p></div>
        <button class="button secondary focus-button" onclick={() => sceneCanvas?.focusSelection()}>Focus in the scene <kbd>F</kbd></button>
      {:else}
        <div class="inspector-empty"><div class="empty-orbit" aria-hidden="true"><span>✦</span></div><span class="eyebrow">FOLLOW YOUR CURIOSITY</span><h2>A sky full of connections.</h2><p>Select a body in the sphere or celestial objects list to inspect its position.</p><div class="empty-rule"></div><small>The same moment.<br />A new point of view.</small></div>
      {/if}
      {#if selectedHouses?.status === 'undefined'}<div class="warning-note"><strong>House system unavailable</strong><p>{selectedHouses.reason}</p></div>{/if}
      <div class="inspector-footer"><span class="tiny-cross" aria-hidden="true">✦</span><span>Astronomical positions<br />with explicit chart conventions.</span></div>
    </aside>
  </main>

  <footer class="timeline">
    <div class="timeline-label"><span class="eyebrow">EXPLORE TIME</span><strong>One moment, in motion</strong></div>
    <div class="time-step-controls"><button class="icon-button" onclick={() => step(-1)} aria-label="Previous day" title="Previous day">‹</button><span class="paused-indicator"><span></span> PAUSED</span><button class="icon-button" onclick={() => step(1)} aria-label="Next day" title="Next day">›</button></div>
    <div class="timeline-track" aria-hidden="true"><span class="timeline-tick"></span><span></span><span></span><span></span><span></span><i></i><span></span><span></span><span></span><span></span><span></span><b>1 day / step</b></div>
    <button class="anchor-button" onclick={() => explorer.requestChart({ instantMs: personalAnchor })}><span aria-hidden="true">↺</span> Return to anchor</button>
  </footer>
  <div class="app-status"><span role="status" aria-live="polite" aria-atomic="true"><span class:working={busy} class="status-dot"></span>{statusLabel}{busy && $explorer.snapshot ? ' · previous moment shown' : ''}</span><span class="status-links"><span>M1 · Application foundation</span><a href="https://github.com/buttery-x3/astrology-viewer/tree/codex/development" target="_blank" rel="noreferrer">Source & licences ↗</a></span></div>
  {#if $explorer.error}<div class="error-toast" role="alert"><span>{$explorer.error}</span><button class="text-button" onclick={() => explorer.retry()}>Retry calculation</button></div>{/if}
</div>

<dialog bind:this={formDialog} class="moment-dialog" onclose={() => formOpen = false} oncancel={() => formOpen = false} aria-labelledby="moment-title">
  <form onsubmit={commitMoment}>
    <div class="dialog-heading"><span class="eyebrow">SET YOUR CONTEXT</span><button type="button" class="icon-button" onclick={() => formOpen = false} aria-label="Close moment form">×</button></div>
    <h2 id="moment-title">Enter a moment</h2><p class="dialog-intro">Set an exact UTC moment and observer coordinates. Local civil time and place search arrive in the next milestone.</p>
    <div class="form-grid"><label>Gregorian date (UTC)<input type="date" bind:value={draftDate} min="1900-01-01" max="2100-12-31" required /></label><label>Time (UTC)<input type="time" bind:value={draftTime} step="1" required /></label><label>Latitude · north positive<input type="text" inputmode="decimal" bind:value={draftLat} required /></label><label>Longitude · east positive<input type="text" inputmode="decimal" bind:value={draftLon} required /></label></div>
    {#if formError}<p class="form-error" role="alert">{formError}</p>{/if}
    <div class="dialog-actions"><button type="button" class="button secondary" onclick={() => formOpen = false}>Cancel</button><button type="submit" class="button primary">Explore moment <span aria-hidden="true">→</span></button></div>
  </form>
</dialog>
