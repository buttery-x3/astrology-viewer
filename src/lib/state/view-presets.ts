export type Viewpoint = 'overview' | 'observer' | 'outside';

export const INITIAL_VIEWPOINT: Viewpoint = 'outside';

/** Only intentional view entry applies these bits; other layer choices survive. */
export const VIEW_PRESETS = Object.freeze({
  outside: Object.freeze({ earthProjections: false, aspects: true }),
  overview: Object.freeze({ earthProjections: true, earthHouses: false, astrocartography: true, aspects: false }),
  observer: Object.freeze({ earthProjections: false, aspects: false, asterisms: true }),
});
