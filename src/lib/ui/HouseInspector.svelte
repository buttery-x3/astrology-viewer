<script lang="ts">
  import { ENGINE_REVISION, HOUSE_SYSTEMS, type EphemerisSnapshot, type HouseSystemId } from '../astronomy/ephemeris';
  import { classifyLongitude, housePartition, zodiacSign } from '../domain/chart';
  import { compareHouseAssignments, type HouseDisplaySettings } from '../domain/house-geometry';

  let { snapshot, selectedId, display, onFocus, onSelect }: {
    snapshot: EphemerisSnapshot | null;
    selectedId: string;
    display: HouseDisplaySettings;
    onFocus: () => void;
    onSelect: (id: string) => void;
  } = $props();
  const parsedSelection = $derived(/^(house|boundary):([1-9]|1[0-2])$/.exec(selectedId));
  const houseNumber = $derived(Number(parsedSelection?.[2] ?? 0));
  const isBoundary = $derived(parsedSelection?.[1] === 'boundary');
  const nextHouse = $derived(houseNumber % 12 + 1);
  const primary = $derived(snapshot?.houses[0]);
  const secondary = $derived(snapshot?.houses[1]);
  const partition = $derived(primary ? housePartition(primary) : null);
  const interval = $derived(partition?.status === 'valid' ? partition.intervals.find(item => item.house === houseNumber) : undefined);
  const assignedBodies = $derived(snapshot && primary && interval ? snapshot.bodies.filter(body => {
    const result = classifyLongitude(primary, body.longitudeDeg);
    return result.status === 'valid' && result.house === houseNumber;
  }) : []);
  const comparison = $derived(snapshot && primary && secondary ? compareHouseAssignments(snapshot.bodies, primary, secondary) : null);
  const changedBodies = $derived(comparison?.status === 'valid' ? comparison.rows.filter(row => row.changed && (row.primaryHouse === houseNumber || row.secondaryHouse === houseNumber)) : []);
  const cuspSource = `https://github.com/aloistr/swisseph/blob/${ENGINE_REVISION}/swehouse.c`;
  const name = (id: HouseSystemId) => HOUSE_SYSTEMS.find(item => item.id === id)?.name ?? id;
  const bodyName = (id: string) => id[0]!.toUpperCase() + id.slice(1);
  const degrees = (value: number) => `${value.toFixed(3)}°`;
  const styleName = (mode: HouseDisplaySettings['mode']) => ({ volumes: 'Volumes / wedges', arcs: 'Boundary arcs', shells: 'Layered shells' })[mode];
</script>

{#if parsedSelection}
  <div class="selected-heading house-heading">
    <span class="eyebrow">{isBoundary ? 'INDEXED HOUSE CUSP' : 'LONGITUDE HOUSE REGION'}</span>
    <h2>{isBoundary ? 'Boundary' : 'House'} {houseNumber}</h2>
    <p>{primary ? name(primary.system) : 'Awaiting calculation'}{primary ? ` · ${styleName(display.mode)}` : ''}</p>
  </div>
  {#if interval && primary?.status === 'valid'}
    <section class="inspector-section house-numerical">
      <h3>{isBoundary ? `Cusp C${houseNumber}` : 'Indexed longitude interval'}</h3>
      <dl class="data-list">
        <div><dt>Start · included</dt><dd><button class="value-link" onclick={() => onSelect(`boundary:${houseNumber}`)} aria-label={`Select boundary ${houseNumber}`}>{degrees(interval.startDeg)}</button></dd></div>
        <div><dt>End · excluded</dt><dd><button class="value-link" onclick={() => onSelect(`boundary:${nextHouse}`)} aria-label={`Select boundary ${nextHouse}`}>{degrees(interval.endDeg)}</button></dd></div>
        <div><dt>Angular span</dt><dd>{degrees(interval.widthDeg)}</dd></div>
        <div><dt>Indexed direction</dt><dd>{interval.direction === 1 ? 'Increasing longitude' : 'Decreasing longitude'}</dd></div>
        <div><dt>Sign at cusp C{houseNumber}</dt><dd>{zodiacSign(interval.startDeg).name} {degrees(zodiacSign(interval.startDeg).degree)}</dd></div>
      </dl>
      <p class="field-note">C{houseNumber} begins H{houseNumber}; C{nextHouse} begins the next house. A body exactly on the starting cusp belongs to H{houseNumber}.{interval.direction === -1 ? ' This polar result preserves the system’s reversed indexed order.' : ''}</p>
      {#if isBoundary}<button class="text-button related-house" onclick={() => onSelect(`house:${houseNumber}`)}>Inspect house {houseNumber} →</button>{/if}
    </section>
    <section class="inspector-section assigned-bodies">
      <h3>Bodies assigned to house {houseNumber}</h3>
      <p class="field-note">Membership uses ecliptic longitude alone. A body keeps its actual ecliptic latitude in the sky.</p>
      {#if assignedBodies.length}
        <div class="body-links">{#each assignedBodies as body (body.id)}<button onclick={() => onSelect(`body:${body.id}`)}><span>{bodyName(body.id)}</span><small>{degrees(body.longitudeDeg)}</small></button>{/each}</div>
      {:else}<p>No bodies occupy this longitude interval in the current snapshot.</p>{/if}
    </section>
    <button class="button secondary focus-button" onclick={onFocus}>Focus in the scene <kbd>F</kbd></button>
  {:else}
    <section class="inspector-section house-unavailable">
      <h3>{snapshot ? 'House geometry unavailable' : 'Awaiting a chart snapshot'}</h3>
      <p>{partition?.status === 'undefined' ? partition.reason : 'A coherent calculated snapshot is needed before cusp values and assignments can be shown.'}</p>
      {#if snapshot}<p class="field-note">No replacement system or invented cusp values are shown. Change the observer or select another calculation system to explore a valid result.</p>{/if}
    </section>
  {/if}

  {#if primary && secondary && comparison}
    <section class="inspector-section house-comparison">
      <h3>Compared with {name(secondary.system)}</h3>
      {#if comparison.status === 'undefined'}
        <p class="comparison-warning">Comparison unavailable. {comparison.reason}</p>
      {:else}
        <dl class="data-list">
          <div><dt>{name(primary.system)} · C{houseNumber}</dt><dd>{primary.status === 'valid' ? degrees(primary.cusps[houseNumber - 1]!) : 'Undefined'}</dd></div>
          <div><dt>{name(secondary.system)} · C{houseNumber}</dt><dd>{secondary.status === 'valid' ? degrees(secondary.cusps[houseNumber - 1]!) : 'Undefined'}</dd></div>
        </dl>
        <p class="field-note">Primary → comparison house assignment for bodies entering or leaving this indexed house:</p>
        {#if changedBodies.length}
          <div class="body-links">{#each changedBodies as row (row.bodyId)}<button onclick={() => onSelect(`body:${row.bodyId}`)} aria-label={`${bodyName(row.bodyId)}, house ${row.primaryHouse} in ${name(primary.system)}, house ${row.secondaryHouse} in ${name(secondary.system)}`}><span>{bodyName(row.bodyId)}</span><small>H{row.primaryHouse} → H{row.secondaryHouse}</small></button>{/each}</div>
        {:else}<p>No body assignments enter or leave H{houseNumber} in this comparison.{comparison.changedBoundaryHouses.includes(houseNumber) ? ` Cusp C${houseNumber} still changes.` : ''}</p>{/if}
      {/if}
    </section>
  {/if}

  <section class="inspector-section house-definition">
    <h3>What the display means</h3>
    <p>These regions extend calculated longitude intervals into the sky for inspection. The fill, boundary arcs and shell lift are schematic display choices; they do not change house membership.</p>
    <p class="field-note">This extension is separate from each house system’s actual construction. A body’s above/below-horizon state is calculated independently of its longitude house.</p>
    {#if interval && primary?.status === 'valid' && !isBoundary && display.mode === 'shells' && display.shellSeparation > 0}<p class="field-note">The selected shell is lifted by {Math.round(display.shellSeparation * 100)}% of the schematic sky radius. Its leaders identify the original region.</p>{/if}
    <a class="source-link" href={cuspSource} target="_blank" rel="noreferrer">Numerical source: Swiss Ephemeris — swe_houses_ex2, indexed cusps and CalcH ↗</a>
  </section>
{:else}
  <section class="inspector-section"><h2>House selection unavailable</h2><p>Select an indexed house or cusp from the house list.</p></section>
{/if}

<style>
  .house-heading h2{font-variant-numeric:tabular-nums}
  .house-numerical .data-list>div{align-items:start;gap:10px}.house-numerical .data-list dd{max-width:55%;text-align:right;line-height:1.6}.house-numerical .data-list dt{line-height:1.6}
  .value-link{font:inherit;color:#a9dfe0;text-decoration:underline;text-underline-offset:3px;padding:0}.value-link:hover{color:#e6d7aa}
  .related-house{margin-top:6px;font-size:11px;color:var(--cyan)}
  .body-links{display:grid;gap:4px;margin-top:10px}.body-links button{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:8px 9px;border:1px solid #30475f;border-radius:5px;color:#c2dce4;font-size:12px;text-align:left;background:#142337}.body-links button:hover{background:#21364d;border-color:#6e879b}.body-links small{font-size:10px;color:#d7c7a6;font-variant-numeric:tabular-nums}
  .house-unavailable p,.comparison-warning{color:#dfc398}.house-comparison .data-list dd{font-size:10px}.house-comparison .data-list dt{font-size:10px;line-height:1.6}
</style>
