<script lang="ts">
  import type { AstroAngle } from '../domain/astrocartography';
  import { GEOGRAPHIC_ANGLE_STYLE, GEOGRAPHIC_MARKER_REFERENCE, GEOGRAPHIC_MARKER_STROKE, GEOGRAPHIC_MARKER_VIEWBOX } from '../domain/geographic-line-style';
  let { angle }: { angle: AstroAngle } = $props();
</script>

<svg class="angle-marker" viewBox={GEOGRAPHIC_MARKER_VIEWBOX} fill="none" stroke="currentColor" stroke-width={GEOGRAPHIC_MARKER_STROKE} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={GEOGRAPHIC_MARKER_REFERENCE}/><path d={GEOGRAPHIC_ANGLE_STYLE[angle].path}/>
</svg>

<style>
  .angle-marker{display:inline-block;width:24px;height:24px;flex-shrink:0;vertical-align:middle}
</style>
