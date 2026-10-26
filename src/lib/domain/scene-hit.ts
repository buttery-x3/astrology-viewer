import type { HouseSystemId } from '../astronomy/ephemeris';

/** A visible representation can carry a different meaning from its parent selection. */
export type FeatureKind = 'body' | 'sign' | 'angle' | 'reference' | 'constellation' | 'asterism' | 'star'
  | 'house' | 'boundary' | 'aspect' | 'construction' | 'trail' | 'history' | 'earth-house' | 'astro-line' | 'layer';
export interface FeatureHit {
  id: string;
  entityId: string;
  name: string;
  kind: FeatureKind;
  role?: string;
  representation?: 'sky' | 'earth' | 'comparison' | 'guide' | 'history' | 'control';
  system?: HouseSystemId;
  sampleInstantMs?: number;
  sampleEndInstantMs?: number;
  constructionId?: string;
  frame?: 'stars' | 'horizon';
  screen?: { x: number; y: number };
}

export const FEATURE_KINDS: readonly FeatureKind[] = Object.freeze([
  'body', 'sign', 'angle', 'reference', 'constellation', 'asterism', 'star', 'house', 'boundary', 'aspect',
  'construction', 'trail', 'history', 'earth-house', 'astro-line', 'layer',
]);

export function featureHit(id: string, name = id, details: Partial<Omit<FeatureHit, 'id' | 'name'>> = {}): FeatureHit {
  const namespace = id.split(':')[0];
  const kind: FeatureKind = namespace === 'astro' ? 'astro-line' : namespace === 'earth' ? 'earth-house'
    : FEATURE_KINDS.includes(namespace as FeatureKind) ? namespace as FeatureKind : 'reference';
  return { id, entityId: id, kind, name, ...details };
}
