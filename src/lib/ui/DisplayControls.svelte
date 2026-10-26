<script lang="ts">
  import type { SceneDisplaySettings } from '../domain/display-settings';

  let { settings, onChange, motion, onMotionChange, textSize, onTextSizeChange, cardSparkles = true, onSparklesChange, onReset }: {
    settings: SceneDisplaySettings; onChange: (patch: Partial<SceneDisplaySettings>) => void;
    motion: 'system' | 'reduced' | 'full'; onMotionChange: (motion: 'system' | 'reduced' | 'full') => void;
    textSize: 'standard' | 'large'; onTextSizeChange: (textSize: 'standard' | 'large') => void;
    cardSparkles?: boolean; onSparklesChange?: (enabled: boolean) => void;
    onReset?: () => void;
  } = $props();
  const uid = $props.id();
</script>

<section class="dock-section display-controls" aria-labelledby={`${uid}-heading`}>
  <h2 id={`${uid}-heading`}>Display and access</h2>
  <label class="display-field">Rendering quality<select aria-label="Rendering quality" value={settings.quality} onchange={event => onChange({ quality: event.currentTarget.value as SceneDisplaySettings['quality'] })}><option value="auto">Auto</option><option value="low">Low</option><option value="high">High</option></select></label>
  <p class="display-note">Low reduces decorative glow and the faint coordinate grid. Bodies, reference lines and chart measurements remain available.</p>
  <label class="display-field" for={`${uid}-labels`}>Scene label size <output>{Math.round(settings.labelScale * 100)}%</output><input id={`${uid}-labels`} aria-label="Scene label size" type="range" min="1" max="1.5" step="0.05" value={settings.labelScale} aria-valuetext={`${Math.round(settings.labelScale * 100)} percent`} oninput={event => onChange({ labelScale: Number(event.currentTarget.value) })} /></label>
  <label class="display-field" for={`${uid}-earth`}>Earth opacity <output>{Math.round(settings.earthOpacity * 100)}%</output><input id={`${uid}-earth`} aria-label="Earth opacity" type="range" min="0.15" max="1" step="0.05" value={settings.earthOpacity} aria-valuetext={`${Math.round(settings.earthOpacity * 100)} percent`} oninput={event => onChange({ earthOpacity: Number(event.currentTarget.value) })} /></label>
  <p class="display-note">A translucent Earth reveals the schematic sky behind it. Observer coordinates and calculated positions stay the same.</p>
  <label class="display-field">Motion preference<select aria-label="Motion preference" value={motion} onchange={event => onMotionChange(event.currentTarget.value as 'system' | 'reduced' | 'full')}><option value="system">Use system preference</option><option value="reduced">Reduced motion</option><option value="full">Full motion</option></select></label>
  <label class="display-field">Card sparkles<select aria-label="Card sparkles" value={cardSparkles ? 'on' : 'off'} onchange={event => onSparklesChange?.(event.currentTarget.value === 'on')}><option value="on">On</option><option value="off">Off</option></select></label>
  <p class="display-note">Reduced motion and Low quality keep the complete static card design.</p>
  <label class="display-field">Interface text size<select aria-label="Interface text size" value={textSize} onchange={event => onTextSizeChange(event.currentTarget.value as 'standard' | 'large')}><option value="standard">Standard</option><option value="large">Large</option></select></label>
  <p class="display-note">Only display preferences are stored on this device.</p>
  {#if onReset}<button class="text-button reset-display" onclick={onReset}>Reset display preferences</button>{/if}
</section>

<style>
  .display-controls{min-width:0}.display-field{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;font-size:.8125rem;line-height:1.6;color:#c6d6e7;margin:16px 0}
  .display-field select,.display-field input{grid-column:1/-1;min-width:0;font-size:.8125rem}.display-field input{width:100%;height:28px;padding:0;accent-color:#9bdde4;cursor:pointer}.display-field output{color:#b5e0e1;font-variant-numeric:tabular-nums}
  .display-note{font-size:.75rem;line-height:1.7;color:#adc1d8;margin:10px 0 16px}.reset-display{font-size:.8125rem;line-height:1.7;color:#b2dce1;padding:7px 0}
</style>
