<script lang="ts">
  import type {EphemerisSnapshot} from '../astronomy/ephemeris';
  let {snapshot}:{snapshot:EphemerisSnapshot}=$props();
</script>
<details class="calculation-provenance inspector-section">
  <summary>Calculation provenance</summary>
  <dl class="data-list"><div><dt>Engine</dt><dd>Swiss {snapshot.provenance.engine}</dd></div><div><dt>Body time · TT</dt><dd>JD {snapshot.time.julianDateTt.toFixed(8)}</dd></div><div><dt>Rotation time · UT1</dt><dd>JD {snapshot.time.julianDateUt1.toFixed(8)}</dd></div><div><dt>ΔT · TT − UT1</dt><dd>{snapshot.time.deltaTSeconds.toFixed(3)} s</dd></div></dl>
  {#if snapshot.time.interpretation==='historical-ut1'}<p>The engine treats this historical UTC-labelled reference as UT1 using its pinned historical ΔT model. It is not evidence of the accuracy of a recorded civil clock.</p>{:else if snapshot.time.interpretation==='future-ut1-assumption'}<p>The date exceeds the engine’s known leap-second information. It uses a future UT1 assumption and modelled ΔT; future Earth rotation and civil rules remain uncertain.</p>{:else}<p>UTC is converted using the engine’s pinned leap-second table and ΔT model. TT and UT1 are kept distinct.</p>{/if}
  <p class="field-note">Apparent geocentric directions · tropical of date · fixed J2000 scene axes · geometric horizon · no atmospheric refraction or topocentric parallax.</p>
  <a class="source-link" href="https://www.astro.com/swisseph/swephprg.htm" target="_blank" rel="noreferrer">Swiss Ephemeris — UTC conversion and coordinate flags ↗</a>
</details>
