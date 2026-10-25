export type ConstructionKind = 'reference' | 'division' | 'timing' | 'projection' | 'intersection';

/** Shared by the actual materials and the user-facing live legend. */
export const CONSTRUCTION_LEGEND = [
  { kind: 'reference', label: 'Reference geometry', color: '#80aec9', dashed: false },
  { kind: 'division', label: 'Divisions', color: '#bda4df', dashed: true },
  { kind: 'timing', label: 'Timing / history', color: '#87d4bf', dashed: true },
  { kind: 'projection', label: 'Projection guides', color: '#d8b87c', dashed: true },
  { kind: 'intersection', label: 'Cusp intersection', color: '#ffe3a3', dashed: false },
] as const;

export const CONSTRUCTION_STYLE: Record<ConstructionKind, { color: string; opacity: number; dashSize: number; gapSize: number }> = {
  reference: { color: CONSTRUCTION_LEGEND[0].color, opacity: 0.65, dashSize: 1000, gapSize: 0 },
  division: { color: CONSTRUCTION_LEGEND[1].color, opacity: 0.85, dashSize: 0.018, gapSize: 0.012 },
  timing: { color: CONSTRUCTION_LEGEND[2].color, opacity: 0.88, dashSize: 0.045, gapSize: 0.018 },
  projection: { color: CONSTRUCTION_LEGEND[3].color, opacity: 0.8, dashSize: 0.006, gapSize: 0.014 },
  intersection: { color: CONSTRUCTION_LEGEND[4].color, opacity: 0.98, dashSize: 1000, gapSize: 0 },
};
