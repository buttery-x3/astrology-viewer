export const TRAIL_REFERENCE_LABELS = {
  stars: 'Relative to the stars',
  horizon: 'Relative to the local horizon',
} as const;

export const TRAIL_LEGEND = [
  { id: 'past', label: 'Past · fades with age', color: '#8bc6d3', dashed: false },
  { id: 'future', label: 'Future', color: '#8bc6d3', dashed: true },
  { id: 'direction', label: 'Arrow · increasing time', color: '#bddbe3', dashed: false },
  { id: 'tick', label: 'Tick · sampled UTC time', color: '#bddbe3', dashed: false },
  { id: 'history', label: 'Selected boundary history', color: '#aca4d1', dashed: true },
  { id: 'jump', label: 'Discrete boundary change', color: '#d1b18b', dashed: true },
] as const;

export const TRAIL_PAST_OPACITIES = [0.12, 0.23, 0.39, 0.62] as const;
