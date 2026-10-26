import type { BodyId } from '../astronomy/ephemeris';
import type { AspectTypeId } from './chart';
import type { HoverCardModel } from './hover-card';

export interface CardTheme {
  accent: string;
  warm: string;
  cool: string;
  name: string;
}

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
const BODY_COMPLEMENTS: Record<BodyId, [string, string]> = {
  sun: ['#9e6028', '#314c91'],
  moon: ['#536c99', '#675483'],
  mercury: ['#3b828b', '#6b4d88'],
  venus: ['#9a526a', '#296c72'],
  mars: ['#9e443d', '#315e81'],
  jupiter: ['#9b702c', '#5a438e'],
  saturn: ['#7e7450', '#38546d'],
  uranus: ['#267c81', '#655095'],
  neptune: ['#385c9d', '#735579'],
  pluto: ['#73518e', '#2e6a74'],
};
const ELEMENT_PALETTES = [
  { accent: '#f2b17e', warm: '#964b32', cool: '#67408d', name: 'Fire' },
  { accent: '#c9d5a0', warm: '#79713c', cool: '#326b65', name: 'Earth' },
  { accent: '#a9d6ed', warm: '#5c6592', cool: '#267a88', name: 'Air' },
  { accent: '#b4b9ed', warm: '#66518f', cool: '#236e7e', name: 'Water' },
] as const;
// Houses describe chart divisions, not corresponding zodiac signs. Give
// their cards one architectural blue/amber treatment without an element cycle.
const HOUSE_PALETTE: Readonly<CardTheme> = Object.freeze({
  accent: '#b9cde7', warm: '#8b653c', cool: '#365d7c', name: 'House',
});
const SIGN_KEYS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];
const REFERENCE_PALETTES: Record<string, CardTheme> = {
  horizon: { accent: '#b9dca8', warm: '#6b7441', cool: '#2c727b', name: 'Horizon' },
  ecliptic: { accent: '#ead38e', warm: '#99753b', cool: '#415d8d', name: 'Ecliptic' },
  equator: { accent: '#9bd4e5', warm: '#3c758b', cool: '#665393', name: 'Equator' },
  meridian: { accent: '#dfa9c8', warm: '#885474', cool: '#396c82', name: 'Meridian' },
  earth: { accent: '#93d6c7', warm: '#4f7962', cool: '#315d91', name: 'Earth' },
};
/** All feature families share rich treatment; colour identifies the object, never its significance. */
export function resolveCardTheme(
  model: Pick<HoverCardModel, 'kind' | 'entityId' | 'glyph' | 'aspect'>,
): CardTheme {
  if (model.aspect) return ASPECT_CARD_THEMES[model.aspect.type];
  const body = model.entityId.split(':').find((part) => part in BODY_IDENTITY) as
    BodyId | undefined;
  if (body)
    return {
      accent: BODY_IDENTITY[body].color,
      warm: BODY_COMPLEMENTS[body][0],
      cool: BODY_COMPLEMENTS[body][1],
      name: BODY_IDENTITY[body].name,
    };
  if (model.kind === 'sign')
    return ELEMENT_PALETTES[Math.max(0, SIGN_KEYS.indexOf(model.glyph.key)) % 4]!;
  if (['house', 'boundary', 'earth-house', 'history', 'construction'].includes(model.kind)) {
    return {
      ...HOUSE_PALETTE,
      name: model.kind === 'construction' ? 'Construction' : 'House',
    };
  }
  if (['star', 'asterism', 'constellation'].includes(model.kind))
    return {
      accent: model.kind === 'star' ? '#d9dff6' : '#a9bdeb',
      warm: '#655387',
      cool: '#2c6983',
      name: 'Celestial',
    };
  const key = model.entityId
    .replace(/^(reference|angle|layer):/, '')
    .replace(/^(asc|dsc)$/, 'horizon');
  if (key.startsWith('aspect-type:'))
    return ASPECT_CARD_THEMES[key.slice(12) as AspectTypeId] ?? ASPECT_CARD_THEMES.sextile;
  return (
    REFERENCE_PALETTES[key] ?? {
      accent: '#accede',
      warm: '#496b85',
      cool: '#62518d',
      name: 'Reference',
    }
  );
}
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
