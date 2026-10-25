import type { SceneDisplaySettings } from '../domain/display-settings';

/** Quality changes decoration and pixel work, never the calculated sky entities. */
export function scenePixelRatio(deviceRatio: number, quality: SceneDisplaySettings['quality']): number {
  const cap = quality === 'low' ? 1 : quality === 'high' ? 2 : 1.5;
  return Math.min(Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1, cap);
}
export function earthOccludes(opacity: number, picking = false): boolean { return picking || opacity >= 0.999; }

export interface ScreenCandidate { id: string; name: string; x: number; y: number; pointLike: boolean }
/** A chooser is useful for true nearby point hits, rather than broad plane crossings. */
export function nearbyPointCandidates(candidates: readonly ScreenCandidate[], radiusPx = 6): { id: string; name: string }[] {
  const first = candidates[0];
  if (!first?.pointLike) return [];
  const seen = new Set<string>();
  return candidates.filter(candidate => candidate.pointLike && Math.hypot(candidate.x - first.x, candidate.y - first.y) <= radiusPx && !seen.has(candidate.id) && !!seen.add(candidate.id))
    .slice(0, 8).map(({ id, name }) => ({ id, name }));
}
