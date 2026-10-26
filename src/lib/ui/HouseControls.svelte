<script lang="ts">
  import { HOUSE_SYSTEMS, type EphemerisSnapshot, type HouseSystemId } from '../astronomy/ephemeris';
  import { housePartition } from '../domain/chart';
  import { DEFAULT_HOUSE_DISPLAY, compareHouseAssignments, type HouseDisplaySettings } from '../domain/house-geometry';

  let {
    system, comparisonSystem, display, snapshot, busy, selectedId = null,
    onSystemChange, onComparisonChange, onDisplayChange, onSelect, onShowConstruction,
  }: {
    system: HouseSystemId;
    comparisonSystem: HouseSystemId | null;
    display: HouseDisplaySettings;
    snapshot: EphemerisSnapshot | null;
    busy: boolean;
    selectedId?: string | null;
    onSystemChange: (id: HouseSystemId) => void;
    onComparisonChange: (id: HouseSystemId | null) => void;
    onDisplayChange: (patch: Partial<HouseDisplaySettings>) => void;
    onSelect: (id: string) => void;
    onShowConstruction?: (house?: number) => void;
  } = $props();

  const uid = $props.id();
  const modes = [
    { id: 'volumes', name: 'Volumes / wedges', detail: 'Filled longitude regions' },
    { id: 'arcs', name: 'Boundary arcs', detail: 'Lightweight boundary view' },
    { id: 'shells', name: 'Layered shells', detail: 'Separate curved regions' },
  ] as const;
  const houseNumbers = Array.from({ length: 12 }, (_, index) => index + 1);
  const primary = $derived(snapshot?.houses[0]);
  const secondary = $derived(snapshot?.houses[1]);
  const partition = $derived(primary ? housePartition(primary) : null);
  const comparison = $derived(snapshot && primary && secondary ? compareHouseAssignments(snapshot.bodies, primary, secondary) : null);
  const comparisonRows = $derived(comparison?.status === 'valid' ? comparison.rows.filter(row => !display.comparisonChangesOnly || row.changed) : []);
  const changedCount = $derived(comparison?.rows.filter(row => row.changed).length ?? 0);
  const selectedHouse = $derived(Number(/^(?:house|boundary):([1-9]|1[0-2])$/.exec(selectedId ?? '')?.[1]) || undefined);
  const name = (id: HouseSystemId) => HOUSE_SYSTEMS.find(item => item.id === id)?.name ?? id;
  const bodyName = (id: string) => id[0]!.toUpperCase() + id.slice(1);
  function cusp(house: number): string {
    return primary?.status === 'valid' ? `${primary.cusps[house - 1]!.toFixed(2)}°` : '—';
  }
</script>

<section class="dock-section house-controls" aria-labelledby={`${uid}-heading`}>
  <h2 id={`${uid}-heading`}>Houses</h2>
  <p class="control-group-title">Calculation system</p>
  <label class="control-label" for={`${uid}-system`}>House system</label>
  <select id={`${uid}-system`} value={system} onchange={event => onSystemChange(event.currentTarget.value as HouseSystemId)}>
    {#each HOUSE_SYSTEMS as item (item.id)}<option value={item.id}>{item.name}</option>{/each}
  </select>
  <p class="house-note">Changing system recalculates boundaries and assignments. Body directions stay fixed.</p>
  {#if onShowConstruction}<button class="text-button show-construction" onclick={() => onShowConstruction?.(selectedHouse)}>Show construction →</button>{/if}
  {#if primary && (busy || primary.system !== system || (secondary?.system ?? null) !== comparisonSystem)}
    <p class="pending-note">{busy ? `Previous ${name(primary.system)} result shown while calculating.` : `Last calculated ${name(primary.system)} result retained. Requested settings have not been applied.`}</p>
  {/if}
  {#if partition?.status === 'undefined'}
    <div class="house-warning"><strong>{primary ? name(primary.system) : 'House system'} unavailable</strong><p>{partition.reason}</p><p>No substitute system is displayed.</p></div>
  {/if}

  <fieldset class="display-choices">
    <legend>House rendering</legend>
    <p class="house-note">Presentation changes keep the same cusp values and house membership.</p>
    {#each modes as mode (mode.id)}
      <label class:active={display.mode === mode.id}>
        <input type="radio" name={`${uid}-display`} value={mode.id} aria-label={mode.name} checked={display.mode === mode.id} onchange={() => onDisplayChange({ mode: mode.id })} />
        <span>{mode.name}<small>{mode.detail}</small></span>
      </label>
    {/each}
  </fieldset>
  <button class="text-button reset-house-display" onclick={() => onDisplayChange({ ...DEFAULT_HOUSE_DISPLAY })}>Reset house display</button>
  <label class="range-label" for={`${uid}-opacity`}><span>House fill opacity</span><output for={`${uid}-opacity`}>{Math.round(display.opacity * 100)}%</output></label>
  <input id={`${uid}-opacity`} class="house-range" type="range" aria-label="House opacity" min="0" max="1" step="0.01" value={display.opacity} oninput={event => onDisplayChange({ opacity: Number(event.currentTarget.value) })} />
  {#if display.mode === 'arcs'}
    <label class="house-check"><input type="checkbox" checked={display.hybrid} onchange={event => onDisplayChange({ hybrid: event.currentTarget.checked })} /><span>Add selected volume to boundary arcs</span></label>
  {/if}
  <label class="house-check"><input type="checkbox" checked={display.contextFill} onchange={event => onDisplayChange({ contextFill: event.currentTarget.checked })} /><span>Show contextual fill</span></label>
  <p class="house-note">Context adds faint unselected regions. Zero opacity hides fills while boundaries remain selectable.</p>
  {#if display.mode === 'shells'}
    <label class="range-label" for={`${uid}-lift`}><span>Lift selected shell</span><output for={`${uid}-lift`}>{Math.round(display.shellSeparation * 100)}%</output></label>
    <input id={`${uid}-lift`} class="house-range" type="range" aria-label="Shell separation" min="0" max="0.2" step="0.01" value={display.shellSeparation} oninput={event => onDisplayChange({ shellSeparation: Number(event.currentTarget.value) })} />
    <p class="house-note">Radial lift is a fraction of the schematic sky radius. Leaders retain the original region.</p>
    {#if display.shellSeparation > 0}<button class="text-button reset-shell" onclick={() => onDisplayChange({ shellSeparation: 0 })}>Reset shell lift</button>{/if}
  {/if}

  <div class="comparison-controls">
    <label class="control-label" for={`${uid}-comparison`}>Compare house system</label>
    <select id={`${uid}-comparison`} value={comparisonSystem ?? ''} onchange={event => onComparisonChange((event.currentTarget.value || null) as HouseSystemId | null)}>
      <option value="">No comparison</option>
      {#each HOUSE_SYSTEMS.filter(item => item.id !== system) as item (item.id)}<option value={item.id}>{item.name}</option>{/each}
    </select>
    {#if comparisonSystem}
      <p class="house-note">The comparison appears as dashed outlines; the primary system stays active.</p>
      <label class="house-check"><input type="checkbox" checked={display.comparisonChangesOnly} onchange={event => onDisplayChange({ comparisonChangesOnly: event.currentTarget.checked })} /><span>Show changed regions and assignments only</span></label>
    {/if}
    {#if primary && secondary && comparison}
      <div class="assignment-changes">
        <h3>{name(primary.system)} → {name(secondary.system)}</h3>
        {#if comparison.status === 'undefined'}
          <p class="comparison-warning">Comparison unavailable. {comparison.reason}</p>
        {:else}
          <p class="house-note">{changedCount} of {comparison.rows.length} body assignments change.</p>
          {#if comparisonRows.length}
            <div class="assignment-links">
              {#each comparisonRows as row (row.bodyId)}
                <button onclick={() => onSelect(`body:${row.bodyId}`)} aria-label={`${bodyName(row.bodyId)}, house ${row.primaryHouse} in ${name(primary.system)}, house ${row.secondaryHouse} in ${name(secondary.system)}`}><span>{bodyName(row.bodyId)}</span><small>H{row.primaryHouse} → H{row.secondaryHouse}</small></button>
              {/each}
            </div>
          {:else}
            <p class="house-note">No bodies change house in this snapshot.{comparison.boundariesChanged ? ' Boundaries still differ.' : ''}</p>
          {/if}
        {/if}
      </div>
    {:else if comparisonSystem && busy}
      <p class="pending-note">Calculating the requested comparison…</p>
    {/if}
  </div>

  <details class="house-object-list" open>
    <summary>Houses & indexed boundaries <span>12</span></summary>
    <p class="house-note">Cusp C1 begins H1. The indices remain the same in every display style.</p>
    <div class="house-rows">
      {#each houseNumbers as house (house)}
        <div>
          <button class:chosen={selectedId === `house:${house}`} aria-pressed={selectedId === `house:${house}`} onclick={() => onSelect(`house:${house}`)}>House {house}</button>
          <button class:chosen={selectedId === `boundary:${house}`} aria-pressed={selectedId === `boundary:${house}`} aria-label={`Boundary ${house}, ${cusp(house)}`} onclick={() => onSelect(`boundary:${house}`)}><span>C{house}</span><small>{cusp(house)}</small></button>
        </div>
      {/each}
    </div>
  </details>
</section>

<style>
  .house-controls{flex-shrink:0;color:var(--text)}
  .control-group-title{margin:0 0 8px;color:var(--gold);font-size:0.75rem;letter-spacing:.35px}
  .control-label{display:block;font-size:0.8125rem;line-height:1.5;color:#bdcce2;margin:0 0 7px}
  select{width:100%;min-width:0;font-size:0.8125rem}
  .house-note{font-size:0.75rem;line-height:1.65;color:#99abc3;margin:8px 0}
  .pending-note{font-size:0.75rem;line-height:1.6;color:#ddc493;margin:8px 0}
  .show-construction{font-size:0.8125rem;line-height:1.6;color:var(--cyan);margin:2px 0 5px}
  .house-warning{border:1px solid #6d5941;background:#302835;border-radius:5px;padding:10px;margin:12px 0;font-size:0.75rem;line-height:1.6;color:#c9b7a3}
  .house-warning strong{font-size:0.8125rem;color:#ebcea1}.house-warning p{margin:5px 0 0}
  .display-choices{border:0;border-top:1px solid #2b3a51;margin:16px 0 14px;padding:12px 0 0;min-width:0}
  .display-choices legend{font-size:0.8125rem;color:#cbd8ea;padding:0 6px 0 0}
  .display-choices>.house-note{margin-top:0}.display-choices label{display:flex;gap:9px;align-items:flex-start;cursor:pointer;border:1px solid transparent;border-radius:5px;padding:8px 7px;font-size:0.8125rem;line-height:1.5}
  .display-choices label:hover{background:#1b2a41}.display-choices label.active{border-color:#3d536f;background:#1a2a40;color:#cbe5e6}
  .display-choices small{display:block;color:#91a3bd;font-size:0.6875rem;margin-top:2px}
  input[type=radio],input[type=checkbox]{accent-color:var(--cyan);width:13px;height:13px;margin:2px 0 0;flex-shrink:0}
  .range-label{display:flex;justify-content:space-between;gap:10px;font-size:0.8125rem;color:#bbcbe1;margin:12px 0 7px}.range-label output{font-variant-numeric:tabular-nums;color:var(--cyan)}
  .house-range{display:block;width:100%;padding:0;height:22px;accent-color:var(--cyan);cursor:pointer}
  .house-check{display:flex;align-items:flex-start;gap:9px;cursor:pointer;font-size:0.75rem;line-height:1.65;color:#aebeD4;margin:10px 0}
  .reset-shell{font-size:0.75rem;margin-top:2px;color:var(--cyan)}
  .comparison-controls{margin-top:18px;padding-top:16px;border-top:1px solid #2b3a51}
  .assignment-changes{margin-top:13px}.assignment-changes h3{font-size:0.75rem;font-weight:500;color:#c2d1e5;line-height:1.6;margin:0}.comparison-warning{font-size:0.75rem;color:#e0bf98;line-height:1.65;margin:8px 0}
  .assignment-links{display:grid;gap:2px;margin-top:6px}.assignment-links button{display:flex;justify-content:space-between;gap:10px;text-align:left;font-size:0.8125rem;padding:6px;color:#bad5dc;border:1px solid transparent;border-radius:4px}.assignment-links button:hover{background:#1c3045;border-color:#3b526c}.assignment-links small{font-size:0.75rem;color:#d8c49f;font-variant-numeric:tabular-nums}
  .house-object-list{margin-top:17px;border-top:1px solid #2b3a51;padding-top:13px}.house-object-list summary{cursor:pointer;font-size:0.8125rem;line-height:1.6;color:#c7d6ea}.house-object-list summary>span{float:right;color:#92a3bc;font-size:0.75rem}
  .house-rows{display:grid;gap:3px;margin-top:9px}.house-rows>div{display:grid;grid-template-columns:1fr 1fr;gap:4px}.house-rows button{display:flex;align-items:baseline;justify-content:space-between;gap:5px;border:1px solid transparent;border-radius:4px;padding:7px 6px;color:#c6d2e4;font-size:0.8125rem;text-align:left}.house-rows button:hover,.house-rows button.chosen{background:#22324a;border-color:#486282;color:#f0dcac}.house-rows small{font-size:0.6875rem;color:#9aadc7;font-variant-numeric:tabular-nums}
</style>
