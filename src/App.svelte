<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { HOUSE_SYSTEMS, type BodyPosition, type EphemerisSnapshot, type HouseResult } from './lib/astronomy/ephemeris';
  import { classifyLongitude, zodiacSign } from './lib/domain/chart';
  import { createExplorerStore, type LayerKey } from './lib/state/explorer';
  import FeatureObjectList from './lib/ui/FeatureObjectList.svelte';
  import FeatureInspector from './lib/ui/FeatureInspector.svelte';
  import CalculationProvenance from './lib/ui/CalculationProvenance.svelte';
  import HouseControls from './lib/ui/HouseControls.svelte';
  import HouseInspector from './lib/ui/HouseInspector.svelte';
  import {DEFAULT_HOUSE_DISPLAY,compareHouseAssignments,type HouseDisplaySettings} from './lib/domain/house-geometry';
  import {DEFAULT_CONSTRUCTION,buildHouseConstruction,type ConstructionSettings} from './lib/domain/house-construction';
  import ConstructionGuide from './lib/ui/ConstructionGuide.svelte';
  import {CONSTRUCTION_LEGEND} from './lib/scene/construction-style';
  import { civilAtInstant, civilDateValue, civilTimeValue, exampleBirthContext, formatOffset, makeBirthContext, type GlobeDraft, type MomentCommit, type ObserverContext } from './lib/state/birth-context';
  import type { CivilDateTime } from './lib/time/civil-time';
  import MomentForm from './lib/ui/MomentForm.svelte';
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
  const views = [{ id: 'overview', label: 'Earth overview' }, { id: 'observer', label: 'Observer sky' }, { id: 'outside', label: 'Outside sphere' }] as const;
  const layerOptions = [
    { id: 'bodies', label: 'Celestial bodies', color: '#e4c49a' },
    { id: 'horizon', label: 'Horizon & compass', color: '#64c9c6' },
    { id: 'ecliptic', label: 'Ecliptic', color: '#dcb879' },
    { id: 'signs', label: 'Tropical signs', color: '#bd91db' },
    { id: 'angles', label: 'Ascendant, MC & opposites', color: '#f0d7a8' },
    { id: 'equator', label: 'Celestial equator', color: '#928bbf' },
    { id: 'meridian', label: 'Local meridian', color: '#80a7d7' },
    { id: 'primeVertical', label: 'Prime vertical', color: '#9aaeb3' },
    { id: 'stars', label: 'Catalogue stars', color: '#cad8e8' },
    { id: 'constellations', label: 'Constellation regions', color: '#7394b3' },
    { id: 'houses', label: 'Longitude houses', color: '#82a8c9' },
  ] as const;
  const initialBirthContext = exampleBirthContext();
  let birthContext = $state.raw(initialBirthContext);
  let explorationObserver = $state<ObserverContext>(initialBirthContext.observer);
  let displayedObserver = $state<ObserverContext>(initialBirthContext.observer);
  let explorationTimeKnown = $state(true);
  let displayedTimeKnown = $state(true);
  let welcome = $state(true);
  let formOpen = $state(false);
  let leftOpen = $state(false);
  let rightOpen = $state(false);
  let formMode = $state<'birth' | 'moment' | 'location'>('birth');
  let formInstant = $state(initialBirthContext.instantMs);
  let formObserver = $state<ObserverContext>(initialBirthContext.observer);
  let formTimeKnown = $state(true);
  let formSession = $state(0);
  let formCivil = $state<CivilDateTime | undefined>();
  let formKeepLocal = $state(false);
  let globePickMode = $state(false);
  let sceneStatus = $state<string | null>(null);
  let houseDisplay=$state<HouseDisplaySettings>({...DEFAULT_HOUSE_DISPLAY});
  let construction=$state<ConstructionSettings>({...DEFAULT_CONSTRUCTION});
  let formDialog: HTMLDialogElement;
  let sceneCanvas: { focusSelection(): void; returnToObserver(): void } | undefined = $state();
  let observedSnapshot: EphemerisSnapshot | null = null;

  const selectedBody = $derived($explorer.snapshot?.bodies.find((body) => `body:${body.id}` === $explorer.selectedId));
  const selectedMeta = $derived(bodies.find((body) => body.id === selectedBody?.id));
  const shownInstant = $derived($explorer.snapshot?.instantMs ?? $explorer.input.instantMs);
  const selectedHouses = $derived($explorer.snapshot?.houses[0]);
  const houseComparison=$derived($explorer.snapshot?.houses[1]?compareHouseAssignments($explorer.snapshot.bodies,$explorer.snapshot.houses[0]!,$explorer.snapshot.houses[1]):null);
  const activeConstruction=$derived(construction.enabled&&$explorer.snapshot&&selectedHouses?buildHouseConstruction($explorer.snapshot,selectedHouses,construction):null);
  const constructionLegend=$derived(CONSTRUCTION_LEGEND.filter(item=>activeConstruction?.status==='valid'&&(activeConstruction.lines.some(line=>line.kind===item.kind&&line.stage<=construction.stage)||activeConstruction.markers.some(marker=>marker.kind===item.kind&&marker.stage<=construction.stage))));
  const busy = $derived($explorer.status === 'loading' || $explorer.status === 'pending');
  const statusLabel = $derived($explorer.error ? 'Calculation needs attention' : busy ? 'Calculating requested moment…' : $explorer.snapshot ? 'Moment calculated' : 'Preparing observatory…');
  const localContext = $derived(civilAtInstant(shownInstant, displayedObserver));

  $effect(() => {
    const snapshot = $explorer.snapshot;
    if (snapshot && snapshot !== observedSnapshot) {
      observedSnapshot = snapshot;
      if (snapshot.observer.latitudeDeg === explorationObserver.latitudeDeg && snapshot.observer.longitudeDeg === explorationObserver.longitudeDeg) {
        displayedObserver = explorationObserver;
        displayedTimeKnown = explorationTimeKnown;
      }
    }
  });

  onMount(() => {
    explorer.init();
    return () => explorer.destroy();
  });

  function formatInstant(ms: number) {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(ms).replace(',', ' ·');
  }
  function coordinate(value: number, positive: string, negative: string) { return `${Math.abs(value).toFixed(2)}° ${value < 0 ? negative : positive}`; }
  function deg(value: number, digits = 2) { return `${value.toFixed(digits)}°`; }
  function sign(body: BodyPosition) { return zodiacSign(body.longitudeDeg).name; }
  function houseFor(body: BodyPosition,houses:HouseResult|undefined=selectedHouses): string {
    if (!houses) return 'Unavailable';
    const result = classifyLongitude(houses, body.longitudeDeg);
    return result.status === 'valid' ? String(result.house) : 'Unavailable';
  }
  function selectBody(id: string) { explorer.select(`body:${id}`); explorer.setLayer('bodies',true); rightOpen = true; }
  function selectFeature(id: string) {
    explorer.select(id); rightOpen = true;
    const boundary=/^(?:house|boundary):([1-9]|1[0-2])$/.exec(id);
    if(construction.enabled&&boundary)construction={...construction,boundaryHouse:Number(boundary[1])};
    const kind=id.split(':')[0];
    const referenceLayer:Record<string,LayerKey>={'reference:horizon':'horizon','reference:ecliptic':'ecliptic','reference:equator':'equator','reference:meridian':'meridian','reference:prime-vertical':'primeVertical','reference:zenith':'horizon','reference:nadir':'horizon','reference:north-pole':'equator','reference:south-pole':'equator'};
    const layer:LayerKey|undefined=kind==='sign'?'signs':kind==='constellation'?'constellations':kind==='angle'?'angles':kind==='house'||kind==='boundary'?'houses':kind==='body'?'bodies':referenceLayer[id];
    if(layer)explorer.setLayer(layer,true);
  }
  function showConstruction(house?:number){
    const selected=/^(?:house|boundary):([1-9]|1[0-2])$/.exec($explorer.selectedId??'');
    const boundaryHouse=house??(selected?Number(selected[1]):['P','K'].includes(selectedHouses?.system??$explorer.input.system)?11:1);
    construction={...construction,enabled:true,boundaryHouse,stage:2,progress:1};
    selectFeature(`boundary:${boundaryHouse}`);
  }
  async function focusConstruction(){selectFeature(`boundary:${construction.boundaryHouse}`);await tick();sceneCanvas?.focusSelection();}
  function openForm(mode: 'birth' | 'moment' | 'location' = 'moment', observer?: ObserverContext) {
    formMode = mode;
    formInstant = mode === 'birth' ? birthContext.instantMs : $explorer.input.instantMs;
    formObserver = observer ?? (mode === 'birth' ? birthContext.observer : explorationObserver);
    formTimeKnown = mode === 'birth' ? birthContext.timeKnown : explorationTimeKnown;
    formCivil = mode === 'birth' ? birthContext.civil : undefined;
    formKeepLocal = false;
    formSession += 1; formOpen = true;
  }
  $effect(() => {
    if (!formDialog) return;
    if (formOpen && !formDialog.open) formDialog.showModal();
    if (!formOpen && formDialog.open) formDialog.close();
  });
  function commitMoment(commit: MomentCommit) {
    if (formMode === 'birth') birthContext = makeBirthContext(commit);
    explorationObserver = commit.observer;
    explorationTimeKnown = commit.timeKnown;
    const snapshot = $explorer.snapshot;
    if (snapshot?.instantMs === commit.instantMs && snapshot.observer.latitudeDeg === commit.observer.latitudeDeg && snapshot.observer.longitudeDeg === commit.observer.longitudeDeg) {
      displayedObserver = commit.observer; displayedTimeKnown = commit.timeKnown;
    }
    explorer.requestChart({ instantMs: commit.instantMs, observer: { latitudeDeg: commit.observer.latitudeDeg, longitudeDeg: commit.observer.longitudeDeg } });
    formOpen = false; welcome = false;
  }
  function restoreBirthContext() {
    explorationObserver = birthContext.observer;
    explorationTimeKnown = birthContext.timeKnown;
    explorer.requestChart({ instantMs: birthContext.instantMs, observer: { latitudeDeg: birthContext.observer.latitudeDeg, longitudeDeg: birthContext.observer.longitudeDeg } });
    if ($explorer.snapshot?.instantMs === birthContext.instantMs && $explorer.snapshot.observer.latitudeDeg === birthContext.observer.latitudeDeg && $explorer.snapshot.observer.longitudeDeg === birthContext.observer.longitudeDeg) {
      displayedObserver = birthContext.observer; displayedTimeKnown = birthContext.timeKnown;
    }
  }
  function returnBirthInstant() {
    explorationTimeKnown = birthContext.timeKnown;
    if ($explorer.snapshot?.instantMs === birthContext.instantMs) displayedTimeKnown = birthContext.timeKnown;
    explorer.requestChart({ instantMs: birthContext.instantMs });
  }
  function beginGlobePick(draft: GlobeDraft) { formInstant = draft.instantMs; formCivil = draft.civil; formObserver = draft.observer; formTimeKnown = draft.timeKnown; formKeepLocal = draft.keepLocal; formOpen = false; welcome = false; globePickMode = true; explorer.setViewpoint('overview'); }
  function observerPicked(coordinates: { latitudeDeg: number; longitudeDeg: number }) {
    globePickMode = false;
    formObserver = { ...formObserver, ...coordinates, label: 'Globe selection', source: 'globe', zoneOverride: true };
    formSession += 1; formOpen = true;
  }
  function step(days: number) {
    const instantMs = $explorer.input.instantMs + days * 86400000;
    if (instantMs >= Date.UTC(1900, 0, 1) && instantMs < Date.UTC(2101, 0, 1)) explorer.requestChart({ instantMs });
  }
  function onKey(event: KeyboardEvent) {
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const target = event.target;
    if (formOpen || target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    if (event.key === 'Escape') { explorer.select(null); leftOpen = false; rightOpen = false; globePickMode = false; }
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
      <span><strong>{formatInstant(shownInstant)} UTC</strong><small>{civilDateValue(localContext.civil)} · {civilTimeValue(localContext.civil)} local · {formatOffset(localContext.offsetMinutes)}</small>{#if !displayedTimeKnown}<small class="provisional-badge">Provisional time · local noon anchor</small>{/if}</span>
      <span class="context-divider"></span>
      <button class="context-location context-location-button" onclick={() => openForm('location')} title="Change observer location"><strong>{coordinate($explorer.snapshot?.observer.latitudeDeg ?? $explorer.input.observer.latitudeDeg, 'N', 'S')} <span class="dot">·</span> {coordinate($explorer.snapshot?.observer.longitudeDeg ?? $explorer.input.observer.longitudeDeg, 'E', 'W')}</strong><small>{displayedObserver.manualOffsetMinutes === null ? displayedObserver.zoneId : 'Explicit UTC offset'} · Change location ↗</small></button>
    </div>
    <button class="button secondary compact" onclick={() => openForm('moment')}><span aria-hidden="true">⌖</span> Edit moment</button>
  </header>

  <main class="workspace">
    <button class="mobile-panel-toggle left-toggle" aria-expanded={leftOpen} aria-controls="explorer-dock" onclick={() => { leftOpen = !leftOpen; rightOpen = false; }}>☷ Explore</button>
    <aside id="explorer-dock" class:drawer-open={leftOpen} class="explorer-dock panel">
      <div class="panel-heading"><span class="eyebrow">YOUR OBSERVATORY</span><button class="drawer-close icon-button" onclick={() => leftOpen = false} aria-label="Close explorer panel">×</button></div>
      <section class="dock-section birth-anchor-section"><div class="section-title"><h2>Birth anchor</h2><button class="text-button" onclick={() => openForm('birth')}>Birth details</button></div><p>{formatInstant(birthContext.instantMs)} UTC</p><small>{birthContext.observer.label}{birthContext.timeKnown ? '' : ' · provisional noon'}</small><div class="birth-context-actions"><button class="text-button" onclick={restoreBirthContext}>Restore birth context ↺</button><button class="text-button" onclick={() => openForm('location')}>Change observer ↗</button></div></section>
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
      <HouseControls system={$explorer.input.system} comparisonSystem={$explorer.input.comparisonSystem} display={houseDisplay} snapshot={$explorer.snapshot} selectedId={$explorer.selectedId} {busy} onSystemChange={(system)=>explorer.requestChart({system,comparisonSystem:$explorer.input.comparisonSystem===system?null:$explorer.input.comparisonSystem})} onComparisonChange={(comparisonSystem)=>explorer.requestChart({comparisonSystem})} onDisplayChange={(patch)=>houseDisplay={...houseDisplay,...patch}} onSelect={selectFeature} onShowConstruction={showConstruction} />
      {#if construction.enabled}<ConstructionGuide snapshot={$explorer.snapshot} settings={construction} onChange={(patch)=>construction={...construction,...patch}} onSelect={selectFeature} onFocus={focusConstruction} />{/if}
      <section class="dock-section object-section">
        <div class="section-title"><h2 id="object-list" tabindex="-1">Celestial objects</h2><span class="count">10</span></div>
        <div class="object-list" aria-label="Select celestial body">
          {#each bodies as body (body.id)}
            {@const position = $explorer.snapshot?.bodies.find((value) => value.id === body.id)}
            <button class:chosen={$explorer.selectedId === `body:${body.id}`} onclick={() => selectBody(body.id)} aria-pressed={$explorer.selectedId === `body:${body.id}`}><span class="body-glyph" style:color={body.color} aria-hidden="true">{body.glyph}</span><span>{body.name}</span><small>{position ? `${(position.longitudeDeg % 30).toFixed(1)}° ${sign(position).slice(0, 3)}` : '—'}</small></button>
          {/each}
        </div>
      </section>
      <FeatureObjectList snapshot={$explorer.snapshot} selectedId={$explorer.selectedId} onSelect={selectFeature} />
      <div class="dock-footer"><span class="status-dot"></span> Browser calculation <a href="https://github.com/aloistr/swisseph" target="_blank" rel="noreferrer">Swiss Ephemeris ↗</a></div>
    </aside>

    <section class="scene-stage" aria-label="Spatial exploration">
      <div class="scene-topline"><span class="scene-tag"><span class="status-dot"></span> CELESTIAL SPHERE</span><span class="scene-mode">{views.find((view) => view.id === $explorer.viewpoint)?.label}</span></div>
      <span class="schematic-label">Schematic sky · distances not to scale</span>
      <SceneCanvas bind:this={sceneCanvas} snapshot={$explorer.snapshot} presentation={{ viewpoint: $explorer.viewpoint, selectedId: $explorer.selectedId, layers: $explorer.layers,houseDisplay,construction }} {globePickMode} onObserverPick={observerPicked} onSelect={(id) => { if(id)selectFeature(id);else explorer.select(null); }} onViewpoint={(viewpoint) => explorer.setViewpoint(viewpoint)} onStatus={(message) => sceneStatus = message} />
      {#if globePickMode}<div class="globe-pick-banner" role="status"><span>Click Earth to choose observer coordinates. Drag to rotate.</span><button class="text-button" onclick={() => globePickMode = false}>Cancel</button></div>{/if}
      {#if welcome}
        <div class="welcome-card">
          <span class="eyebrow">A DIFFERENT PERSPECTIVE</span>
          <h1>See the chart.<br /><em>Understand the space.</em></h1>
          <p>Explore how the sky, your horizon, and the zodiac fit together in one celestial sphere.</p>
          <div class="welcome-actions"><button class="button primary" onclick={() => welcome = false}>Explore example <span aria-hidden="true">↗</span></button><button class="text-button" onclick={() => openForm('birth')}>Enter a birth moment <span aria-hidden="true">→</span></button></div>
          <small>Example: 1 January 2000 · 12:00 UTC · Greenwich</small>
        </div>
      {/if}
      {#if sceneStatus}<div class="scene-notice" role="status"><strong>3D view unavailable</strong><span>{sceneStatus}</span><span>The moment controls and celestial object list remain available.</span></div>{/if}
      <div class="scene-controls"><button class="icon-button" onclick={() => sceneCanvas?.focusSelection()} aria-label="Focus selected feature" title="Focus selection (F)">⌕</button><button class="icon-button" onclick={() => { explorer.setViewpoint('observer'); sceneCanvas?.returnToObserver(); }} aria-label="Return to observer" title="Return to observer (O)">⌖</button></div>
      <div class="scene-legend" aria-label="Active layer legend">{#each layerOptions.filter(layer=>$explorer.layers[layer.id]) as layer (layer.id)}<span><i class="legend-line" style:background={layer.color}></i>{layer.label}</span>{/each}{#if $explorer.selectedId}<span><i class="legend-line" style:background="#f1d79d"></i>Selected feature</span>{/if}{#if $explorer.layers.houses && houseComparison?.status==='valid'}<span><i class="legend-line" style:background="transparent" style:border-top="1px dashed #b0a4d7"></i>Comparison boundaries</span>{#if houseComparison.changedRegions.length}<span><i class="legend-line" style:background="#b0a4d7"></i>Changed assignments</span>{/if}{/if}{#if $explorer.layers.houses && selectedHouses?.status==='valid' && houseDisplay.mode==='shells' && houseDisplay.shellSeparation>0 && ($explorer.selectedId?.startsWith('house:')||selectedBody)}<span>Radial leaders: shell lift</span>{/if}<span class="legend-convention">Below horizon: dimmed body · distances schematic</span></div>
      <div class="interaction-hint"><span>Drag to orbit</span><i>·</i><span>Scroll to zoom</span><i>·</i><kbd>F</kbd><span>focus</span></div>
      {#if construction.enabled}<div class="construction-key" aria-label="Construction legend">{#each constructionLegend as item (item.kind)}<span><i style:border-top={`1px ${item.dashed?'dashed':'solid'} ${item.color}`}></i>{item.label}</span>{/each}<small>C{construction.boundaryHouse} · {activeConstruction?.status==='valid'?`stage ${construction.stage+1} · sweep ${Math.round(construction.progress*100)}%`:'construction unavailable'}</small></div>{/if}
    </section>

    <button class="mobile-panel-toggle right-toggle" aria-expanded={rightOpen} aria-controls="inspector" onclick={() => { rightOpen = !rightOpen; leftOpen = false; }}>ⓘ Inspector</button>
    <aside id="inspector" class:drawer-open={rightOpen} class="inspector panel">
      <div class="panel-heading"><span class="eyebrow">INSPECTOR</span><button class="drawer-close icon-button" onclick={() => rightOpen = false} aria-label="Close inspector panel">×</button></div>
      {#if selectedBody && selectedMeta}
        <div class="selected-heading"><span class="selected-glyph" style:color={selectedMeta.color} aria-hidden="true">{selectedMeta.glyph}</span><span class="eyebrow">CELESTIAL BODY</span><h2>{selectedMeta.name}</h2><p>{sign(selectedBody)} <span class="dot">·</span> {deg(selectedBody.longitudeDeg % 30)}</p></div>
        <div class="inspector-section"><h3>Position in the chart</h3><dl class="data-list"><div><dt>Ecliptic longitude</dt><dd>{deg(selectedBody.longitudeDeg)}</dd></div><div><dt>Ecliptic latitude</dt><dd>{deg(selectedBody.latitudeDeg)}</dd></div><div><dt>House · {HOUSE_SYSTEMS.find(s=>s.id===selectedHouses?.system)?.name??'Primary'}</dt><dd>{houseFor(selectedBody)}</dd></div>{#if $explorer.snapshot?.houses[1]}<div><dt>House · {HOUSE_SYSTEMS.find(s=>s.id===$explorer.snapshot?.houses[1]?.system)?.name}</dt><dd>{houseFor(selectedBody,$explorer.snapshot.houses[1])}</dd></div>{/if}<div><dt>Motion</dt><dd>{selectedBody.longitudeSpeedDegPerDay < 0 ? 'Retrograde' : 'Direct'}</dd></div></dl></div>
        <div class="inspector-section"><h3>From the observer</h3><dl class="data-list"><div><dt>Altitude</dt><dd>{deg(selectedBody.horizon.altitudeDeg)}</dd></div><div><dt>Azimuth</dt><dd>{selectedBody.horizon.azimuthDeg === null ? 'Undefined' : deg(selectedBody.horizon.azimuthDeg)}</dd></div><div><dt>Horizon</dt><dd class:above={selectedBody.horizon.altitudeDeg >= 0}>{selectedBody.horizon.altitudeDeg >= 0 ? 'Above' : 'Below'}</dd></div></dl><p class="field-note">Geometric horizon; atmospheric refraction is excluded.</p></div>
        <button class="button secondary focus-button" onclick={() => sceneCanvas?.focusSelection()}>Focus in the scene <kbd>F</kbd></button>
        <section class="inspector-section numerical-sources"><h3>How these values are defined</h3><p>Apparent geocentric positions use the tropical ecliptic of date. Latitude is retained in the 3D position. Houses and aspects use longitude alone. The horizon is geometric, with no atmospheric refraction.</p><p class="field-note">Swiss Ephemeris {$explorer.snapshot?.provenance.engine} · {selectedHouses?.system} houses · TT for body positions, UT1 for Earth rotation.</p><a class="source-link" href="https://www.astro.com/swisseph/swephprg.htm" target="_blank" rel="noreferrer">Swiss Ephemeris — swe_calc, coordinate flags and swe_houses_ex2 ↗</a></section>
      {:else if $explorer.selectedId?.startsWith('house:')||$explorer.selectedId?.startsWith('boundary:')}
        <HouseInspector snapshot={$explorer.snapshot} selectedId={$explorer.selectedId} display={houseDisplay} onFocus={()=>sceneCanvas?.focusSelection()} onSelect={selectFeature} onShowConstruction={showConstruction} />
      {:else if $explorer.selectedId}
        <FeatureInspector snapshot={$explorer.snapshot} selectedId={$explorer.selectedId} onFocus={()=>sceneCanvas?.focusSelection()} />
      {:else}
        <div class="inspector-empty"><div class="empty-orbit" aria-hidden="true"><span>✦</span></div><span class="eyebrow">FOLLOW YOUR CURIOSITY</span><h2>A sky full of connections.</h2><p>Select a body in the sphere or celestial objects list to inspect its position.</p><div class="empty-rule"></div><small>The same moment.<br />A new point of view.</small></div>
      {/if}
      {#if !displayedTimeKnown}<div class="warning-note"><strong>Provisional birth time</strong><p>Local noon is an example when the birth time is unknown. Houses and angles depend on the actual time.</p></div>{/if}
      {#if selectedHouses?.status === 'undefined'}<div class="warning-note"><strong>House system unavailable</strong><p>{selectedHouses.reason}</p></div>{/if}
      {#if $explorer.snapshot}<CalculationProvenance snapshot={$explorer.snapshot} />{/if}
      <div class="inspector-footer"><span class="tiny-cross" aria-hidden="true">✦</span><span>Astronomical positions<br />with explicit chart conventions.</span></div>
    </aside>
  </main>

  <footer class="timeline">
    <div class="timeline-label"><span class="eyebrow">EXPLORE TIME</span><strong>One moment, in motion</strong></div>
    <div class="time-step-controls"><button class="icon-button" onclick={() => step(-1)} aria-label="Previous day" title="Previous day">‹</button><span class="paused-indicator"><span></span> PAUSED</span><button class="icon-button" onclick={() => step(1)} aria-label="Next day" title="Next day">›</button></div>
    <div class="timeline-track" aria-hidden="true"><span class="timeline-tick"></span><span></span><span></span><span></span><span></span><i></i><span></span><span></span><span></span><span></span><span></span><b>1 day / step</b></div>
    <button class="anchor-button" onclick={returnBirthInstant} title="Return to the birth instant at the current observer location"><span aria-hidden="true">↺</span> Return to birth instant</button>
  </footer>
  <div class="app-status"><span role="status" aria-live="polite" aria-atomic="true"><span class:working={busy} class="status-dot"></span>{statusLabel}{busy && $explorer.snapshot ? ' · previous moment shown' : ''}</span><span class="status-links"><span>M5 · Construction guides</span><a href="https://github.com/buttery-x3/astrology-viewer/tree/codex/development" target="_blank" rel="noreferrer">Source & licences ↗</a></span></div>
  {#if $explorer.error}<div class="error-toast" role="alert"><span>{$explorer.error}</span><button class="text-button" onclick={() => explorer.retry()}>Retry calculation</button></div>{/if}
</div>

<dialog bind:this={formDialog} class="moment-dialog" onclose={() => formOpen = false} oncancel={() => formOpen = false} aria-labelledby="moment-title">
  {#if formOpen}{#key formSession}<MomentForm mode={formMode} initialInstantMs={formInstant} initialObserver={formObserver} initialTimeKnown={formTimeKnown} initialCivil={formCivil} initialKeepLocal={formKeepLocal} onCommit={commitMoment} onCancel={() => formOpen = false} onGlobePick={beginGlobePick} />{/key}{/if}
</dialog>
