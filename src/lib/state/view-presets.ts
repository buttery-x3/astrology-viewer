export type Viewpoint = 'overview' | 'observer' | 'outside';
export type LayerKey = 'bodies' | 'horizon' | 'ecliptic' | 'houses' | 'stars' | 'signs' | 'equator' | 'meridian' | 'primeVertical' | 'angles' | 'constellations' | 'asterisms' | 'earthProjections' | 'earthHouses' | 'astrocartography' | 'aspects';

export const INITIAL_VIEWPOINT: Viewpoint = 'outside';

const REFERENCE_DEFAULTS: Readonly<Record<LayerKey, boolean>> = Object.freeze({
  bodies: true, horizon: true, ecliptic: true, houses: true, stars: true, signs: true,
  equator: false, meridian: false, primeVertical: false, angles: true, constellations: false,
  asterisms: false, earthProjections: false, earthHouses: false, astrocartography: true, aspects: true,
});

/** Complete independent initial profiles; view entry restores that view's memory. */
export const VIEW_PRESETS: Readonly<Record<Viewpoint, Readonly<Record<LayerKey, boolean>>>> = Object.freeze({
  outside: Object.freeze({ ...REFERENCE_DEFAULTS }),
  overview: Object.freeze({ ...REFERENCE_DEFAULTS, earthProjections: true, aspects: false }),
  observer: Object.freeze({ ...REFERENCE_DEFAULTS, aspects: false, asterisms: true }),
});
