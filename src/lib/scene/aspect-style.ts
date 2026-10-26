import type { AspectTypeId } from '../domain/chart';

/** Categories only: no colour or brightness encodes a favourable/unfavourable claim. */
export const ASPECT_LEGEND = [
  { id: 'conjunction', label: 'Conjunction', glyph: '☌', color: '#c5a9df', pattern: 'solid', dashed: false },
  { id: 'sextile', label: 'Sextile', glyph: '⚹', color: '#80c5c8', pattern: 'short dashes', dashed: true },
  { id: 'square', label: 'Square', glyph: '□', color: '#dfad89', pattern: 'long dashes', dashed: true },
  { id: 'trine', label: 'Trine', glyph: '△', color: '#91b3e4', pattern: 'solid', dashed: false },
  { id: 'opposition', label: 'Opposition', glyph: '☍', color: '#ce97b3', pattern: 'dotted', dashed: true },
] as const;
export const ASPECT_STYLE: Record<AspectTypeId, { color: string; glyph: string; dashed: boolean; dashSize: number; gapSize: number }> = {
  conjunction: { ...ASPECT_LEGEND[0], dashSize: 0.1, gapSize: 0 },
  sextile: { ...ASPECT_LEGEND[1], dashSize: 0.12, gapSize: 0.08 },
  square: { ...ASPECT_LEGEND[2], dashSize: 0.26, gapSize: 0.1 },
  trine: { ...ASPECT_LEGEND[3], dashSize: 0.1, gapSize: 0 },
  opposition: { ...ASPECT_LEGEND[4], dashSize: 0.035, gapSize: 0.09 },
};
