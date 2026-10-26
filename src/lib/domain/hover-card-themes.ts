import type { BodyId } from '../astronomy/ephemeris';
import type { AspectTypeId } from './chart';

export const BODY_IDENTITY: Record<BodyId, { name: string; color: string; glyph: string }> = {
  sun: { name: 'Sun', color: '#f4c976', glyph: '☉' },
  moon: { name: 'Moon', color: '#e0e8f3', glyph: '☽' },
  mercury: { name: 'Mercury', color: '#a6c3cb', glyph: '☿' },
  venus: { name: 'Venus', color: '#e5ba9f', glyph: '♀' },
  mars: { name: 'Mars', color: '#e18e7c', glyph: '♂' },
  jupiter: { name: 'Jupiter', color: '#d5b690', glyph: '♃' },
  saturn: { name: 'Saturn', color: '#c4bfa1', glyph: '♄' },
  uranus: { name: 'Uranus', color: '#8cc4c4', glyph: '♅' },
  neptune: { name: 'Neptune', color: '#8fa9d8', glyph: '♆' },
  pluto: { name: 'Pluto', color: '#b8a8ca', glyph: '♇' },
};
export const ASPECT_CARD_THEMES: Record<
  AspectTypeId,
  { accent: string; warm: string; cool: string; name: string }
> = {
  conjunction: { accent: '#c5a9df', warm: '#b58a39', cool: '#7042ad', name: 'Conjunction' },
  sextile: { accent: '#80c5c8', warm: '#c78059', cool: '#166a76', name: 'Sextile' },
  square: { accent: '#dfad89', warm: '#ad572d', cool: '#49369a', name: 'Square' },
  trine: { accent: '#91b3e4', warm: '#bd873c', cool: '#285eac', name: 'Trine' },
  opposition: { accent: '#ce97b3', warm: '#8e3d72', cool: '#258a80', name: 'Opposition' },
};
/** Bounded, reproducible decoration. Positions occupy header/perimeter, never reading panels. */
export function cardSparkles(seed: string) {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  return Array.from({ length: 12 }, (_, index) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return {
      index,
      x: index < 4 ? 7 + index * 12 : index < 8 ? 82 + (index - 4) * 5 : index % 2 ? 96 : 4,
      // Keep the left glints in the top gutter; the remaining header glints
      // occupy the empty upper-right corner, clear of the title and metadata.
      y: index < 4 ? 8 + (value % 8) : index < 8 ? 9 + (value % 58) : 45 + (value % 45),
      size: 3 + (value % 5),
      delay: -(value % 6000) / 1000,
      duration: 3 + (value % 3000) / 1000,
    };
  });
}
