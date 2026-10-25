<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
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
  import AspectControls from './lib/ui/AspectControls.svelte';
  import AspectInspector from './lib/ui/AspectInspector.svelte';
  import BodyInterpretation from './lib/ui/BodyInterpretation.svelte';
  import EvidencePanel from './lib/ui/EvidencePanel.svelte';
  import ContentCard from './lib/ui/ContentCard.svelte';
  import {DEFAULT_ASPECT_DISPLAY,getAspectDetails,getVisibleAspects,type AspectDisplaySettings} from './lib/domain/aspect-presentation';
  import {ASPECT_LEGEND} from './lib/scene/aspect-style';
  import Timeline from './lib/ui/Timeline.svelte';
  import {PlaybackClock,TIMELINE_PRESETS,clampInstant,explorationOffset,stepInstant,timelineWindow,type StepUnit,type TimelinePreset} from './lib/domain/timeline';
  import {DEFAULT_TRAIL_DISPLAY,DEFAULT_BOUNDARY_HISTORY,type TrailDisplaySettings,type BoundaryHistorySettings} from './lib/domain/trails';
  import {createTrailService} from './lib/services/trails';
  import TrailControls from './lib/ui/TrailControls.svelte';
  import {TRAIL_LEGEND,TRAIL_REFERENCE_LABELS} from './lib/scene/trail-style';

  const explorer = createExplorerStore();
  const trailService=createTrailService();
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
  let aspects=$state<AspectDisplaySettings>({...DEFAULT_ASPECT_DISPLAY,types:{...DEFAULT_ASPECT_DISPLAY.types},orbs:{...DEFAULT_ASPECT_DISPLAY.orbs}});
  let evidenceOpen=$state(false);
  let evidenceDialog:HTMLDialogElement;
  let timelinePreset=$state<TimelinePreset>('1d');
  let timeWindow=$state(timelineWindow(initialBirthContext.instantMs,TIMELINE_PRESETS['1d']));
  let stepUnit=$state<StepUnit>('day');
  let playbackDirection=$state<1|-1>(1);
  let playbackSpeed=$state(3600000);
  let playing=$state(false);
  let pauseReason=$state<string|null>(null);
  let playbackClock:PlaybackClock|null=null;
  let trails=$state<TrailDisplaySettings>({...DEFAULT_TRAIL_DISPLAY});
  let history=$state<BoundaryHistorySettings>({...DEFAULT_BOUNDARY_HISTORY});
  let trailKey:string|null=null,historyKey:string|null=null;
  let trailInterval:{startMs:number;endMs:number}|null=null,historyInterval:{startMs:number;endMs:number}|null=null;
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
  const visibleAspects=$derived(($explorer.snapshot?getVisibleAspects($explorer.snapshot.bodies,aspects,$explorer.selectedId):[]).filter(aspect=>!$explorer.selectedId?.startsWith('aspect:')||aspect.id===$explorer.selectedId));
  const aspectLegend=$derived(ASPECT_LEGEND.filter(type=>visibleAspects.some(aspect=>aspect.type===type.id)));
  const boundaryHouse=$derived(Number(/^(?:house|boundary):([1-9]|1[0-2])$/.exec($explorer.selectedId??'')?.[1])||null);
  const activeTrail=$derived(trails.enabled&&selectedBody&&$trailService.trail.result?.bodyId===selectedBody.id&&$trailService.trail.result.frame===trails.frame&&$trailService.trail.result.observer.latitudeDeg===$explorer.snapshot?.observer.latitudeDeg&&$trailService.trail.result.observer.longitudeDeg===$explorer.snapshot?.observer.longitudeDeg?$trailService.trail.result:null);
  const activeHistory=$derived(history.enabled&&boundaryHouse&&$trailService.history.result?.house===boundaryHouse&&$trailService.history.result.system===selectedHouses?.system&&$trailService.history.result.observer.latitudeDeg===$explorer.snapshot?.observer.latitudeDeg&&$trailService.history.result.observer.longitudeDeg===$explorer.snapshot?.observer.longitudeDeg?$trailService.history.result:null);

  $effect(()=>{
    const snapshot=$explorer.snapshot,bodyId=selectedBody?.id,settings={...trails};
    if(!settings.enabled||!snapshot||!bodyId){untrack(()=>{trailService.cancelTrail();trailKey=null;trailInterval=null;});return;}
    const key=JSON.stringify({bodyId,observer:snapshot.observer,...settings});
    const result=$trailService.trail.result;
    const outside=!trailInterval||snapshot.instantMs<trailInterval.startMs||snapshot.instantMs>trailInterval.endMs;
    const limitedOutside=result?.status==='limited'&&(snapshot.instantMs<result.startMs||snapshot.instantMs>result.endMs);
    if(key!==trailKey||outside||limitedOutside)untrack(()=>{
      trailKey=key;trailInterval={startMs:snapshot.instantMs-Math.floor(settings.windowMs/2),endMs:snapshot.instantMs+Math.ceil(settings.windowMs/2)};
      trailService.requestTrail({bodyId,frame:settings.frame,observer:snapshot.observer,...trailInterval,anchorMs:snapshot.instantMs,maxVertices:settings.maxVertices,toleranceDeg:settings.toleranceDeg,maxComputeMs:settings.maxComputeMs});
    });
  });
  $effect(()=>{
    const snapshot=$explorer.snapshot,house=boundaryHouse,settings={...history};
    if(!settings.enabled||!snapshot||!house){untrack(()=>{trailService.cancelHistory();historyKey=null;historyInterval=null;});return;}
    const system=snapshot.houses[0]!.system,key=JSON.stringify({house,system,observer:snapshot.observer,...settings});
    if(key!==historyKey||!historyInterval||snapshot.instantMs<historyInterval.startMs||snapshot.instantMs>historyInterval.endMs)untrack(()=>{
      historyKey=key;historyInterval={startMs:snapshot.instantMs-Math.floor(settings.windowMs/2),endMs:snapshot.instantMs+Math.ceil(settings.windowMs/2)};
      trailService.requestHistory({house,system,observer:snapshot.observer,...historyInterval,anchorMs:snapshot.instantMs,count:settings.count});
    });
  });

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
    const transport=setInterval(()=>{
      if(!playing||!playbackClock)return;
      if($explorer.status==='error'){pausePlayback('Playback paused because the calculation needs attention.');return;}
      const next=playbackClock.tick(performance.now(),$explorer.status==='ready');
      if(next.type==='request')requestTimelineInstant(next.instantMs);
      else if(next.type==='pause'){if(next.instantMs!==undefined)requestTimelineInstant(next.instantMs);pausePlayback(next.reason);}
    },80);
    const hidden=()=>{if(document.hidden&&playing)pausePlayback('Playback paused while this tab was hidden.');};
    document.addEventListener('visibilitychange',hidden);
    return () => {clearInterval(transport);document.removeEventListener('visibilitychange',hidden);trailService.destroy();explorer.destroy();};
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
    if(kind==='aspect'&&$explorer.snapshot){
      const detail=getAspectDetails($explorer.snapshot.bodies,id,aspects.orbs);
      if(detail)aspects={...aspects,enabled:true,types:{...aspects.types,[detail.type]:true}};
    }
  }
  function showConstruction(house?:number){
    const selected=/^(?:house|boundary):([1-9]|1[0-2])$/.exec($explorer.selectedId??'');
    const boundaryHouse=house??(selected?Number(selected[1]):['P','K'].includes(selectedHouses?.system??$explorer.input.system)?11:1);
    construction={...construction,enabled:true,boundaryHouse,stage:2,progress:1};
    selectFeature(`boundary:${boundaryHouse}`);
  }
  async function focusConstruction(){selectFeature(`boundary:${construction.boundaryHouse}`);await tick();sceneCanvas?.focusSelection();}
  function openForm(mode: 'birth' | 'moment' | 'location' = 'moment', observer?: ObserverContext) {
    pausePlayback('Playback paused while editing the context.');
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
  $effect(()=>{if(!evidenceDialog)return;if(evidenceOpen&&!evidenceDialog.open)evidenceDialog.showModal();if(!evidenceOpen&&evidenceDialog.open)evidenceDialog.close();});
  function commitMoment(commit: MomentCommit) {
    if (formMode === 'birth') birthContext = makeBirthContext(commit);
    explorationObserver = commit.observer;
    explorationTimeKnown = commit.timeKnown;
    const snapshot = $explorer.snapshot;
    if (snapshot?.instantMs === commit.instantMs && snapshot.observer.latitudeDeg === commit.observer.latitudeDeg && snapshot.observer.longitudeDeg === commit.observer.longitudeDeg) {
      displayedObserver = commit.observer; displayedTimeKnown = commit.timeKnown;
    }
    explorer.requestChart({ instantMs: commit.instantMs, observer: { latitudeDeg: commit.observer.latitudeDeg, longitudeDeg: commit.observer.longitudeDeg } });
    keepInstantInWindow(commit.instantMs);
    formOpen = false; welcome = false;
  }
  function restoreBirthContext() {
    pausePlayback();keepInstantInWindow(birthContext.instantMs);
    explorationObserver = birthContext.observer;
    explorationTimeKnown = birthContext.timeKnown;
    explorer.requestChart({ instantMs: birthContext.instantMs, observer: { latitudeDeg: birthContext.observer.latitudeDeg, longitudeDeg: birthContext.observer.longitudeDeg } });
    if ($explorer.snapshot?.instantMs === birthContext.instantMs && $explorer.snapshot.observer.latitudeDeg === birthContext.observer.latitudeDeg && $explorer.snapshot.observer.longitudeDeg === birthContext.observer.longitudeDeg) {
      displayedObserver = birthContext.observer; displayedTimeKnown = birthContext.timeKnown;
    }
  }
  function returnBirthInstant() {
    pausePlayback();keepInstantInWindow(birthContext.instantMs);
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
  function pausePlayback(reason:string|null=null){playing=false;playbackClock=null;pauseReason=reason;}
  function togglePlayback(){
    if(playing){pausePlayback();return;}
    if(busy||$explorer.status==='error'){pauseReason='Wait for a valid calculated moment before playback.';return;}
    playbackClock=new PlaybackClock(playbackSpeed,playbackDirection);playbackClock.start(shownInstant,performance.now());pauseReason=null;playing=true;
  }
  function keepInstantInWindow(instantMs:number){if(instantMs<timeWindow.startMs||instantMs>timeWindow.endMs)timeWindow=timelineWindow(instantMs,timeWindow.endMs-timeWindow.startMs);}
  function requestTimelineInstant(instantMs:number){const value=clampInstant(instantMs);keepInstantInWindow(value);explorer.requestChart({instantMs:value});}
  function seekInstant(instantMs:number){pausePlayback();requestTimelineInstant(instantMs);}
  function stepTime(direction:1|-1){seekInstant(stepInstant($explorer.input.instantMs,stepUnit,direction));}
  function changeWindow(preset:Exclude<TimelinePreset,'custom'>){timelinePreset=preset;timeWindow=timelineWindow(shownInstant,TIMELINE_PRESETS[preset]);}
  function zoomWindow(factor:0.5|2){timelinePreset='custom';timeWindow=timelineWindow(shownInstant,(timeWindow.endMs-timeWindow.startMs)*factor);}
  function changePlayback(patch:{speed?:number;direction?:1|-1}){const resume=playing;pausePlayback();if(patch.speed!==undefined)playbackSpeed=patch.speed;if(patch.direction)playbackDirection=patch.direction;if(resume)togglePlayback();}
  function onKey(event: KeyboardEvent) {
    if(event.defaultPrevented)return;
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const target = event.target;
    if (formOpen || evidenceOpen || target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    if (event.key === 'Escape') { explorer.select(null); leftOpen = false; rightOpen = false; globePickMode = false; }
    if (event.key.toLowerCase() === 'f') sceneCanvas?.focusSelection();
    if (event.key.toLowerCase() === 'o') { explorer.setViewpoint('observer'); sceneCanvas?.returnToObserver(); }
    if(event.code==='Space'&&target instanceof HTMLElement&&(target.tagName==='CANVAS'||target.closest('.timeline'))&&target.tagName!=='BUTTON'){event.preventDefault();togglePlayback();}
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
      <span><strong>{formatInstant(shownInstant)} UTC</strong><small>{civilDateValue(localContext.civil)} · {civilTimeValue(localContext.civil)} local · {formatOffset(localContext.offsetMinutes)}</small><small class="exploration-badge">{explorationOffset(shownInstant,birthContext.instantMs)} · {HOUSE_SYSTEMS.find(system=>system.id===selectedHouses?.system)?.name??$explorer.input.system}</small>{#if !displayedTimeKnown}<small class="provisional-badge">Provisional time · local noon anchor</small>{/if}</span>
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
      <AspectControls snapshot={$explorer.snapshot} settings={aspects} selectedId={$explorer.selectedId} onChange={patch=>aspects={...aspects,...patch}} onSelect={selectFeature} />
      <TrailControls settings={trails} historySettings={history} bodyId={selectedBody?.id??null} {boundaryHouse} state={$trailService} onChange={patch=>trails={...trails,...patch}} onHistoryChange={patch=>history={...history,...patch}} onRetry={()=>trailService.retry()} onRetryHistory={()=>trailService.retry()} onCancel={()=>trailService.cancelTrail()} onCancelHistory={()=>trailService.cancelHistory()} />
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
      <SceneCanvas bind:this={sceneCanvas} snapshot={$explorer.snapshot} presentation={{ viewpoint: $explorer.viewpoint, selectedId: $explorer.selectedId, layers: $explorer.layers,houseDisplay,construction,aspects,trails,trailResult:activeTrail,history,historyResult:activeHistory }} {globePickMode} onObserverPick={observerPicked} onSelect={(id) => { if(id)selectFeature(id);else explorer.select(null); }} onViewpoint={(viewpoint) => explorer.setViewpoint(viewpoint)} onStatus={(message) => sceneStatus = message} />
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
      {#if aspectLegend.length}<div class="aspect-key" aria-label="Aspect legend">{#each aspectLegend as type (type.id)}<span><i style:border-top={`2px ${type.dashed?'dashed':'solid'} ${type.color}`}></i>{type.glyph} {type.label}</span>{/each}<small>Brighter core: closer to exact · curved strand: connection{aspects.glow?' · glow: emphasis':''}</small>{#if $explorer.selectedId?.startsWith('aspect:')&&aspects.measurement}<small>Gold arc: longitude separation · dashed leaders: latitude projection</small>{/if}</div>{/if}
      {#if activeTrail||activeHistory}<div class="trail-key" aria-label="Motion history legend">{#if activeTrail}<strong>{selectedMeta?.name} · {TRAIL_REFERENCE_LABELS[activeTrail.frame]}</strong>{#each TRAIL_LEGEND.filter(item=>['past','future','direction','tick'].includes(item.id)) as item (item.id)}<span><i style:border-top={`1px ${item.dashed?'dashed':'solid'} ${item.color}`}></i>{item.label}</span>{/each}<small>{formatInstant(activeTrail.startMs)} → {formatInstant(activeTrail.endMs)} UTC</small>{#if activeTrail.status!=='complete'}<small>{activeTrail.status==='partial'?'Refining sampled path…':'Limited to the sampled interval · see trail controls'}</small>{/if}{/if}{#if activeHistory}<strong>C{activeHistory.house} · {activeHistory.samples.filter(sample=>sample.status!=='undefined').length} discrete boundary ghosts</strong><small>Dashed violet: history · gold: discrete boundary change · undefined samples omitted</small>{/if}</div>{/if}
    </section>

    <button class="mobile-panel-toggle right-toggle" aria-expanded={rightOpen} aria-controls="inspector" onclick={() => { rightOpen = !rightOpen; leftOpen = false; }}>ⓘ Inspector</button>
    <aside id="inspector" class:drawer-open={rightOpen} class="inspector panel">
      <div class="panel-heading"><span class="eyebrow">INSPECTOR</span><button class="drawer-close icon-button" onclick={() => rightOpen = false} aria-label="Close inspector panel">×</button></div>
      {#if selectedBody && selectedMeta}
        <div class="selected-heading"><span class="selected-glyph" style:color={selectedMeta.color} aria-hidden="true">{selectedMeta.glyph}</span><span class="eyebrow">CELESTIAL BODY</span><h2>{selectedMeta.name}</h2><p>{sign(selectedBody)} <span class="dot">·</span> {deg(selectedBody.longitudeDeg % 30)}</p></div>
        <div class="inspector-section"><h3>Position in the chart</h3><dl class="data-list"><div><dt>Ecliptic longitude</dt><dd>{deg(selectedBody.longitudeDeg)}</dd></div><div><dt>Ecliptic latitude</dt><dd>{deg(selectedBody.latitudeDeg)}</dd></div><div><dt>House · {HOUSE_SYSTEMS.find(s=>s.id===selectedHouses?.system)?.name??'Primary'}</dt><dd>{houseFor(selectedBody)}</dd></div>{#if $explorer.snapshot?.houses[1]}<div><dt>House · {HOUSE_SYSTEMS.find(s=>s.id===$explorer.snapshot?.houses[1]?.system)?.name}</dt><dd>{houseFor(selectedBody,$explorer.snapshot.houses[1])}</dd></div>{/if}<div><dt>Motion</dt><dd>{selectedBody.longitudeSpeedDegPerDay < 0 ? 'Retrograde' : 'Direct'}</dd></div></dl></div>
        <div class="inspector-section"><h3>From the observer</h3><dl class="data-list"><div><dt>Altitude</dt><dd>{deg(selectedBody.horizon.altitudeDeg)}</dd></div><div><dt>Azimuth</dt><dd>{selectedBody.horizon.azimuthDeg === null ? 'Undefined' : deg(selectedBody.horizon.azimuthDeg)}</dd></div><div><dt>Horizon</dt><dd class:above={selectedBody.horizon.altitudeDeg >= 0}>{selectedBody.horizon.altitudeDeg >= 0 ? 'Above' : 'Below'}</dd></div></dl><p class="field-note">Geometric horizon; atmospheric refraction is excluded.</p></div>
        <button class="button secondary focus-button" onclick={() => sceneCanvas?.focusSelection()}>Focus in the scene <kbd>F</kbd></button>
        <BodyInterpretation body={selectedBody} houses={selectedHouses} provisional={!displayedTimeKnown} onSelect={selectFeature} />
        <ContentCard id="concept:conventions" />
      {:else if $explorer.selectedId?.startsWith('aspect:')}
        <AspectInspector snapshot={$explorer.snapshot} selectedId={$explorer.selectedId} settings={aspects} onSelect={selectFeature} onFocus={()=>sceneCanvas?.focusSelection()} />
      {:else if $explorer.selectedId?.startsWith('house:')||$explorer.selectedId?.startsWith('boundary:')}
        <HouseInspector snapshot={$explorer.snapshot} selectedId={$explorer.selectedId} display={houseDisplay} onFocus={()=>sceneCanvas?.focusSelection()} onSelect={selectFeature} onShowConstruction={showConstruction} />
      {:else if $explorer.selectedId}
        <FeatureInspector snapshot={$explorer.snapshot} selectedId={$explorer.selectedId} onFocus={()=>sceneCanvas?.focusSelection()} />
      {:else}
        <div class="inspector-empty"><div class="empty-orbit" aria-hidden="true"><span>✦</span></div><span class="eyebrow">FOLLOW YOUR CURIOSITY</span><h2>A sky full of connections.</h2><p>Select a body in the sphere or celestial objects list to inspect its position.</p><div class="empty-rule"></div><small>The same moment.<br />A new point of view.</small></div>
      {/if}
      {#if !displayedTimeKnown && !selectedBody}<div class="warning-note"><strong>Provisional birth time</strong><p>Local noon is an example when the birth time is unknown. Houses and angles depend on the actual time.</p></div>{/if}
      {#if selectedHouses?.status === 'undefined'}<div class="warning-note"><strong>House system unavailable</strong><p>{selectedHouses.reason}</p></div>{/if}
      {#if $explorer.snapshot}<CalculationProvenance snapshot={$explorer.snapshot} />{/if}
      <div class="inspector-footer"><span class="tiny-cross" aria-hidden="true">✦</span><span>Astronomical positions<br />with explicit chart conventions.</span></div>
    </aside>
  </main>

  <Timeline displayedInstantMs={shownInstant} requestedInstantMs={$explorer.input.instantMs} birthInstantMs={birthContext.instantMs} window={timeWindow} preset={timelinePreset} {stepUnit} direction={playbackDirection} speed={playbackSpeed} {playing} {busy} {pauseReason} onSeek={seekInstant} onStep={stepTime} onPresetChange={changeWindow} onZoom={zoomWindow} onPlayPause={togglePlayback} onDirectionChange={direction=>changePlayback({direction})} onSpeedChange={speed=>changePlayback({speed})} onStepUnitChange={unit=>stepUnit=unit} onReturnBirth={returnBirthInstant} onEditMoment={()=>openForm('moment')} />
  <div class="app-status"><span role="status" aria-live="polite" aria-atomic="true"><span class:working={busy} class="status-dot"></span>{statusLabel}{busy && $explorer.snapshot ? ' · previous moment shown' : ''}</span><span class="status-links"><button onclick={()=>evidenceOpen=true}>Evidence & sources</button><span>M7 · Timeline & motion history</span><a href="https://github.com/buttery-x3/astrology-viewer/tree/codex/development" target="_blank" rel="noreferrer">Source & licences ↗</a></span></div>
  {#if $explorer.error}<div class="error-toast" role="alert"><span>{$explorer.error}</span><button class="text-button" onclick={() => explorer.retry()}>Retry calculation</button></div>{/if}
</div>

<dialog bind:this={formDialog} class="moment-dialog" onclose={() => formOpen = false} oncancel={() => formOpen = false} aria-labelledby="moment-title">
  {#if formOpen}{#key formSession}<MomentForm mode={formMode} initialInstantMs={formInstant} initialObserver={formObserver} initialTimeKnown={formTimeKnown} initialCivil={formCivil} initialKeepLocal={formKeepLocal} onCommit={commitMoment} onCancel={() => formOpen = false} onGlobePick={beginGlobePick} />{/key}{/if}
</dialog>
<dialog bind:this={evidenceDialog} class="evidence-dialog" aria-labelledby="evidence-title" onclose={()=>evidenceOpen=false} oncancel={()=>evidenceOpen=false}>{#if evidenceOpen}<EvidencePanel onClose={()=>evidenceOpen=false} />{/if}</dialog>
