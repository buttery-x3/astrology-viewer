<script lang="ts">
  import ContentCard from './ContentCard.svelte';
  let { onClose }: { onClose?: () => void } = $props();
</script>

<div class="evidence-panel">
  <header><div><span class="eyebrow">READING THE SOURCES</span><h2 id="evidence-title">Calculation and interpretation</h2></div>{#if onClose}<button class="icon-button" onclick={onClose} aria-label="Close evidence explanation">×</button>{/if}</header>
  <p class="evidence-intro">This explorer combines calculated sky geometry with attributed astrological symbolism. Each claim is labelled so its source and purpose remain clear.</p>
  <ContentCard id="concept:evidence" heading={false} />
  <section class="reading-roles"><h3>What the labels mean</h3><dl><div><dt>Astronomy</dt><dd>Physical identities and descriptions of the sky.</dd></div><div><dt>Calculation method</dt><dd>A documented rule used to construct a numerical or geometric result.</dd></div><div><dt>Explorer convention</dt><dd>A choice this application makes, such as longitude-only house assignment.</dd></div><div><dt>Traditional interpretation</dt><dd>A named practitioner’s symbolic reading within the stated tradition.</dd></div><div><dt>Scientific evidence</dt><dd>A reported empirical test, with its specific scope and conditions.</dd></div></dl></section>
  <footer><p>The interpretation catalogue contains fixed, reviewed text and claim-level citations. Different practitioners and traditions may read the same feature differently.</p><a href="https://github.com/buttery-x3/astrology-viewer/tree/codex/development/src/lib/content" target="_blank" rel="noreferrer">Read the catalogue and source records ↗</a></footer>
</div>

<style>
  .evidence-panel{max-width:760px;color:#c7d5e8}.evidence-panel>header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:0 0 15px}.evidence-panel .eyebrow{font-size:9px;color:#9fc5cd;letter-spacing:1.2px}.evidence-panel h2{font-family:'Manrope',sans-serif;font-size:26px;font-weight:500;line-height:1.4;letter-spacing:-.5px;margin:10px 0 0}.evidence-panel .icon-button{flex-shrink:0;color:#b0c3d9}.evidence-intro{font-size:13px;line-height:1.85;color:#aec0d6;margin:3px 0 13px}.evidence-panel :global(.content-card){padding:18px 0 22px}
  .reading-roles{padding:20px 0}.reading-roles h3{font-size:13px;color:#d1dfef;font-weight:500;margin:0 0 16px}.reading-roles dl{display:grid;gap:13px;margin:0}.reading-roles dl>div{display:grid;grid-template-columns:150px minmax(0,1fr);gap:16px}.reading-roles dt{font-size:11px;color:#b6d1db;line-height:1.7}.reading-roles dd{font-size:12px;color:#aabdd4;line-height:1.7;margin:0}.evidence-panel>footer{border-top:1px solid #35465d;padding-top:15px}.evidence-panel>footer p{font-size:11px;line-height:1.8;color:#a2b6cc;margin:0 0 11px}.evidence-panel>footer a{font-size:12px;color:#9dd8d7;line-height:1.7}
  @media(max-width:650px){.reading-roles dl>div{grid-template-columns:1fr;gap:3px}.evidence-panel h2{font-size:23px}}
</style>
