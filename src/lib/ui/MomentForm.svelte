<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { resolveCivilTime, timeZoneDatabase, type CivilDateTime, type CivilTimeCandidate, type CivilTimeResolution } from '../time/civil-time';
  import { civilAtInstant, civilDateValue, civilTimeValue, formatOffset, type GlobeDraft, type MomentCommit, type ObserverContext } from '../state/birth-context';
  import { lookupTimezones, searchPlaces, type PlaceResult } from '../services/locations';

  interface Props {
    mode: 'birth' | 'moment' | 'location';
    initialInstantMs: number;
    initialObserver: ObserverContext;
    initialTimeKnown?: boolean;
    initialCivil?: CivilDateTime;
    initialKeepLocal?: boolean;
    onCommit: (commit: MomentCommit) => void;
    onCancel: () => void;
    onGlobePick: (draft: GlobeDraft) => void;
  }
  let { mode, initialInstantMs, initialObserver, initialTimeKnown = true, initialCivil, initialKeepLocal = false, onCommit, onCancel, onGlobePick }: Props = $props();
  const seed = untrack(() => ({ initialInstantMs, initialObserver, initialTimeKnown, initialCivil, initialKeepLocal }));
  const initialLocal = (() => {
    try { return civilAtInstant(seed.initialInstantMs, seed.initialObserver); }
    catch { return { civil: seed.initialCivil ?? civilAtInstant(seed.initialInstantMs, { zoneId: 'UTC', manualOffsetMinutes: 0 }).civil, offsetMinutes: 0 }; }
  })();
  let date = $state(civilDateValue(seed.initialCivil ?? initialLocal.civil));
  let clock = $state(civilTimeValue(seed.initialCivil ?? initialLocal.civil));
  let latitude = $state(String(seed.initialObserver.latitudeDeg));
  let longitude = $state(String(seed.initialObserver.longitudeDeg));
  let label = $state(seed.initialObserver.label);
  let zoneId = $state(seed.initialObserver.zoneId);
  let manualOffset = $state(seed.initialObserver.manualOffsetMinutes !== null);
  let offsetText = $state(String(seed.initialObserver.manualOffsetMinutes ?? initialLocal.offsetMinutes));
  let timeKnown = $state(seed.initialTimeKnown);
  let keepLocal = $state(seed.initialKeepLocal);
  let source = $state<ObserverContext['source']>(seed.initialObserver.source);
  let zoneOverride = $state(seed.initialObserver.zoneOverride);
  let zoneConfirmed = $state(seed.initialObserver.source !== 'globe');
  let query = $state('');
  let results = $state<PlaceResult[]>([]);
  let placeStatus = $state('');
  let searching = $state(false);
  let zoneStatus = $state('');
  let zoneCandidates = $state<string[]>([]);
  let zonePending = $state(false);
  let chosenFold = $state<number | null>(null);
  let error = $state('');
  let searchController: AbortController | undefined;
  let zoneController: AbortController | undefined;
  const zoneNames = timeZoneDatabase.names();

  const observer = $derived<ObserverContext>({ latitudeDeg: Number(latitude), longitudeDeg: Number(longitude), label: label || 'Custom location', zoneId, manualOffsetMinutes: manualOffset ? Number(offsetText) : null, source, zoneOverride });
  const preserveInstant = $derived(mode === 'location' && !keepLocal);
  const resolution = $derived.by((): CivilTimeResolution | null => {
    try {
      const civil = enteredCivil();
      return resolveCivilTime({ civil, zoneId, ...(manualOffset ? { manualOffsetMinutes: offsetText.trim() ? Number(offsetText) : Number.NaN } : {}) });
    } catch { return null; }
  });
  const candidate = $derived.by((): CivilTimeCandidate | null => {
    if (!resolution) return null;
    if (resolution.status === 'unique') return resolution.candidate;
    if (resolution.status === 'ambiguous') {
      if (preserveInstant) return resolution.candidates.find((value) => value.utcMs === initialInstantMs) ?? null;
      return chosenFold === null ? null : resolution.candidates.find((value) => value.utcMs === chosenFold) ?? null;
    }
    return null;
  });
  const effectiveFields = $derived.by(() => {
    if (preserveInstant) { try { const local = civilAtInstant(initialInstantMs, observer); return { date: civilDateValue(local.civil), clock: civilTimeValue(local.civil) }; } catch { return { date, clock }; } }
    return { date, clock: timeKnown ? clock : '12:00:00' };
  });
  const title = $derived(mode === 'birth' ? 'Set birth details' : mode === 'location' ? 'Change observer location' : 'Explore another moment');

  onDestroy(() => { searchController?.abort(); zoneController?.abort(); });
  onMount(() => { if (seed.initialObserver.source === 'globe') void findZones(); });

  function enteredCivil(): CivilDateTime {
    if (preserveInstant) return civilAtInstant(initialInstantMs, observer).civil;
    const dateParts = date.split('-').map(Number), timeParts = (timeKnown ? clock : '12:00:00').split(':').map(Number);
    return { year: dateParts[0] ?? 0, month: dateParts[1] ?? 0, day: dateParts[2] ?? 0, hour: timeParts[0] ?? 0, minute: timeParts[1] ?? 0, second: timeParts[2] ?? 0 };
  }
  function clearChoice() { chosenFold = null; error = ''; }
  async function findPlaces(event: SubmitEvent) {
    event.preventDefault();
    searchController?.abort(); searchController = new AbortController();
    const controller = searchController;
    searching = true; placeStatus = ''; results = [];
    try {
      const found = await searchPlaces(query.trim(), controller.signal);
      if (controller.signal.aborted) return;
      results = found; placeStatus = found.length ? 'Choose the intended place below.' : 'No matching places. Try a region or enter coordinates.';
    } catch (reason) { if (!controller.signal.aborted) placeStatus = `${reason instanceof Error ? reason.message : 'Place search unavailable.'} Enter coordinates and an IANA zone manually.`; }
    finally { if (!controller.signal.aborted) searching = false; }
  }
  async function findZones() {
    clearChoice();
    const lat = Number(latitude), lon = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) { zoneStatus = 'Enter valid coordinates first.'; return; }
    zoneController?.abort(); zoneController = new AbortController();
    const controller = zoneController;
    zonePending = true; zoneStatus = ''; zoneCandidates = [];
    try {
      const zones = await lookupTimezones(lat, lon, controller.signal);
      if (controller.signal.aborted) return;
      zoneCandidates = zones;
      if (zones.length === 1) { zoneId = zones[0]!; zoneOverride = false; zoneConfirmed = true; zoneStatus = 'Zone found from comprehensive geographic boundaries. You can correct it below.'; }
      else if (zones.length > 1) { zoneId = ''; zoneConfirmed = false; zoneStatus = 'More than one time zone applies at these coordinates. Choose the intended zone.'; }
      else { zoneOverride = true; zoneConfirmed = false; zoneStatus = 'No geographic zone found. Choose an IANA zone or enter an explicit offset.'; }
    } catch (reason) { if (!controller.signal.aborted) { zoneOverride = true; zoneConfirmed = false; zoneStatus = `${reason instanceof Error ? reason.message : 'Zone lookup unavailable.'} Choose a time zone or explicit offset manually.`; } }
    finally { if (!controller.signal.aborted) zonePending = false; }
  }
  function choosePlace(place: PlaceResult) {
    latitude = String(place.latitudeDeg); longitude = String(place.longitudeDeg); label = place.label; zoneId = place.timezone ?? '';
    source = 'search'; zoneOverride = false; results = []; placeStatus = `Selected ${place.label}.`;
    void findZones();
  }
  function manualCoordinates() { zoneController?.abort(); zonePending = false; zoneCandidates = []; source = 'manual'; label = 'Custom location'; clearChoice(); zoneStatus = 'Coordinates changed. Find the geographic zone or explicitly confirm your own zone below.'; zoneOverride = true; zoneConfirmed = false; }
  function manualZone() {
    zoneController?.abort(); zoneController = undefined;
    zonePending = false; zoneCandidates = [];
    zoneOverride = true; zoneConfirmed = false; clearChoice();
    zoneStatus = 'Manual time zone entered. Confirm it for these coordinates.';
  }
  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(observer.latitudeDeg) || Math.abs(observer.latitudeDeg) > 90 || !Number.isFinite(observer.longitudeDeg) || Math.abs(observer.longitudeDeg) > 180) { error = 'Enter latitude from −90 to 90 and longitude from −180 to 180.'; return; }
    if (!manualOffset && !zoneConfirmed) { error = 'Find the geographic zone or confirm the IANA zone for these coordinates.'; return; }
    if (!candidate || !resolution || !candidate.withinSupportedRange) { error = resolution?.status === 'ambiguous' ? 'Choose which occurrence of this local time you intend.' : 'Resolve the date, time, and time zone before applying.'; return; }
    onCommit({ instantMs: candidate.utcMs, civil: enteredCivil(), observer: { ...observer }, timeKnown: preserveInstant ? initialTimeKnown : timeKnown, candidate, resolution });
  }
  function useGapEnd() {
    if (resolution?.status !== 'nonexistent' || !resolution.gap) return;
    date = resolution.gap.endCivilIso.slice(0, 10); clock = resolution.gap.endCivilIso.slice(11, 19); clearChoice();
  }
  function pickGlobe() {
    let civil: CivilDateTime;
    try { civil = enteredCivil(); } catch { civil = initialLocal.civil; }
    onGlobePick({ instantMs: candidate?.utcMs ?? initialInstantMs, civil, observer, timeKnown, keepLocal });
  }
</script>

<div class="dialog-heading"><span class="eyebrow">SET YOUR CONTEXT</span><button type="button" class="icon-button" onclick={onCancel} aria-label="Close moment form">×</button></div>
<h2 id="moment-title">{title}</h2>
<p class="dialog-intro">{mode === 'birth' ? 'The birth anchor stays fixed while you explore other moments and places.' : mode === 'location' ? 'Choose a place, refine its coordinates, or pick directly on Earth.' : 'Change the exploration time. Your birth details stay saved for this session.'}</p>

<form class="place-search" onsubmit={findPlaces}>
  <label for="place-search">Search for a city or place</label><div class="search-controls"><input id="place-search" type="search" bind:value={query} minlength="2" maxlength="100" placeholder="e.g. Sydney, Australia" required /><button class="button secondary" type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button><button type="button" class="button secondary globe-pick-button" onclick={pickGlobe}>Pick on globe</button></div>
  <p class="lookup-status" role="status">{placeStatus}</p>
  {#if results.length}<div class="place-results" aria-label="Choose a matching place">{#each results as place (place.id)}<button type="button" onclick={() => choosePlace(place)}><strong>{place.label}</strong><small>{place.latitudeDeg.toFixed(3)}°, {place.longitudeDeg.toFixed(3)}° · {place.timezone}</small></button>{/each}</div>{/if}
</form>

<form class="moment-entry" onsubmit={submit}>
  <div class="form-grid"><label>Latitude · north positive<input type="text" inputmode="decimal" bind:value={latitude} oninput={manualCoordinates} required /></label><label>Longitude · east positive<input type="text" inputmode="decimal" bind:value={longitude} oninput={manualCoordinates} required /></label></div>
  <div class="zone-find-row"><span>{label}</span><button type="button" class="text-button" onclick={findZones} disabled={zonePending}>{zonePending ? 'Finding zone…' : 'Find zone for coordinates'}</button></div>
  <p class="lookup-status" role="status">{zoneStatus}</p>
  {#if zoneCandidates.length > 1}<label class="standalone-label">Geographic time-zone choices<select bind:value={zoneId} onchange={() => { zoneOverride = false; zoneConfirmed = true; clearChoice(); }} required={!manualOffset} disabled={manualOffset}><option value="" disabled>Choose a time zone</option>{#each zoneCandidates as zone (zone)}<option value={zone}>{zone}</option>{/each}</select></label>{/if}
  <label class="standalone-label">IANA time zone<input list="iana-zone-options" bind:value={zoneId} placeholder="Europe/London" disabled={manualOffset} oninput={manualZone} required={!manualOffset} /></label>
  {#if zoneOverride && !manualOffset}<label class="form-checkbox"><input type="checkbox" bind:checked={zoneConfirmed} /><span>Confirm this time zone for the entered coordinates</span></label>{/if}
  <datalist id="iana-zone-options">{#each zoneNames as zone (zone)}<option value={zone}></option>{/each}</datalist>
  <label class="form-checkbox"><input type="checkbox" checked={manualOffset} onchange={(event) => { manualOffset = event.currentTarget.checked; if (manualOffset) { zoneController?.abort(); zonePending = false; } clearChoice(); }} /><span>Override with an explicit UTC offset</span></label>
  {#if manualOffset}<label class="standalone-label">Offset minutes east of UTC<input type="text" inputmode="numeric" bind:value={offsetText} oninput={clearChoice} required /><small>For example: 330 for UTC+05:30, −300 for UTC−05:00. This overrides daylight-saving rules.</small></label>{/if}
  {#if mode === 'location'}<label class="form-checkbox location-policy"><input type="checkbox" bind:checked={keepLocal} onchange={clearChoice} /><span>Keep the original local clock time instead</span></label><p class="field-note">{keepLocal ? 'The UTC instant will change to preserve the entered local clock.' : 'The UTC instant stays fixed; the local clock changes for the new location.'}</p>{/if}
  <div class="form-grid civil-fields"><label>Gregorian date ({manualOffset ? 'fixed offset' : 'local'})<input type="date" value={effectiveFields.date} oninput={(event) => { date = event.currentTarget.value; clearChoice(); }} readonly={preserveInstant} min="1899-12-31" max="2101-01-01" required /></label><label>Time ({manualOffset ? 'fixed offset' : 'local'})<input type="time" value={effectiveFields.clock} oninput={(event) => { clock = event.currentTarget.value; clearChoice(); }} readonly={preserveInstant || !timeKnown} step="1" required /></label></div>
  {#if mode !== 'location'}<label class="form-checkbox"><input type="checkbox" checked={!timeKnown} onchange={(event) => { timeKnown = !event.currentTarget.checked; clearChoice(); }} /><span>Birth time unknown — use provisional local noon</span></label>{/if}
  {#if !timeKnown}<p class="provisional-note">Provisional noon: house and angle positions depend strongly on the unknown time.</p>{/if}

  {#if resolution?.status === 'ambiguous' && !preserveInstant}<fieldset class="fold-choice"><legend>This local time occurred twice. Choose an occurrence.</legend>{#each resolution.candidates as occurrence, index (occurrence.utcMs)}<label><input type="radio" name="fold" value={occurrence.utcMs} checked={chosenFold === occurrence.utcMs} onchange={() => { chosenFold = occurrence.utcMs; error = ''; }} disabled={!occurrence.withinSupportedRange} /><span><strong>{index === 0 ? 'Earlier occurrence' : 'Later occurrence'} · {formatOffset(occurrence.offsetMinutes)}</strong><small>{occurrence.utcIso} · {occurrence.abbreviation}</small></span></label>{/each}</fieldset>{/if}
  {#if resolution?.status === 'nonexistent'}<div class="resolution-warning" role="alert"><strong>This local time did not occur.</strong><p>{resolution.message}</p>{#if resolution.gap}<p>The clock skipped {resolution.gap.startCivilIso.slice(11, 19)} to {resolution.gap.endCivilIso.slice(11, 19)} ({resolution.gap.durationMinutes} minutes).</p><button type="button" class="text-button" onclick={useGapEnd}>Use the first valid local time →</button>{/if}</div>{/if}
  {#if resolution?.status === 'invalid'}<p class="form-error">{resolution.message}</p>{/if}
  {#if candidate}<div class="resolved-moment"><span class="eyebrow">RESOLVED INSTANT</span><strong>{candidate.utcIso.replace('T', ' · ').replace('.000Z', ' UTC')}</strong><small>{formatOffset(candidate.offsetMinutes)} · {manualOffset ? 'Explicit manual offset' : zoneId} · Gregorian calendar</small></div>{/if}
  {#if resolution?.warnings.length}<div class="civil-warnings">{#each resolution.warnings as warning (warning.code)}<p>{warning.message}</p>{/each}</div>{/if}
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}
  <p class="lookup-attribution">Place search: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>. Only the place query or coordinates go to lookup services.</p>
  <div class="dialog-actions"><button type="button" class="button secondary" onclick={onCancel}>Cancel</button><button type="submit" class="button primary" disabled={zonePending || (!manualOffset && !zoneConfirmed) || !candidate || !candidate.withinSupportedRange}>{mode === 'birth' ? 'Set birth anchor' : 'Apply exploration'} <span aria-hidden="true">→</span></button></div>
</form>
