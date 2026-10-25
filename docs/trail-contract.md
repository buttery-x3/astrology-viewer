# Trail and boundary-history contract

M7 computes one selected body's trajectory in a dedicated worker, independent of the chart worker. There is no runtime interpretation generation. Numerical samples use the same pinned Swiss Ephemeris source revision, checked data files, geocentric apparent-body model and fixed DE431 tidal acceleration as a chart snapshot; see [the coordinate contract](coordinate-contract.md).

## Sampling and frames

`domain/trails.ts` owns `TrailDisplaySettings`, `TrailRequestInput`, `TrailResult`, `sampleTrail`, `makeTrailSample` and `projectTrail`. The default requested interval is one day, tolerance is0.2°, computation budget is3000ms and total display budget is2000 vertices. Requests may choose32–2000 vertices,0.01–2° tolerance and10–10000ms. One vertex is reserved for the exact latest body position, leaving at most1999 precomputed samples. These are product limits, not measures of astrological significance.

Each sample contains an integer UTC instant, a unit astronomical fixed-J2000 vector and unit local east/north/up coordinates. The fixed vector comes from the native fixed-equatorial body coordinates. ENU is derived from that same vector through the snapshot's true-equatorial frame and sidereal orientation, so re-embedding cannot introduce a discrepancy between a trail sample and the displayed body. The scene alone converts astronomical axes to Three.js axes.

In the `stars` frame, samples retain their fixed celestial vectors. In the `horizon` frame, `projectTrail` embeds each stored ENU direction in the **latest displayed snapshot's** horizon orientation. This deliberately shows positions relative to the current horizon; it is not a second physical trajectory in the stars frame.

The exact initial anchor is calculated first and published as partial progress. Sampling expands alternating past/future chunks outwards from it. For each candidate segment, a fresh midpoint is compared with the normalized great-circle midpoint of its endpoint directions, in the requested frame. Segments are bisected until this measured midpoint error meets tolerance and elapsed time meets the maximum gap. Antipodal endpoints force subdivision. This is an adaptive midpoint criterion with a physically conservative elapsed-gap limit, not a mathematical guarantee on every unsampled intermediate instant.

Maximum gaps in the stars frame are six hours for the Moon, one day for Mercury/Venus, two days for Mars, seven days for Sun/Jupiter/Saturn, and fourteen days for Uranus/Neptune/Pluto. Horizon-frame gaps are at most one hour for every body, preventing complete daily turns from aliasing to equal endpoints. The gap choices are documented engineering defaults. Longitude wrap does not create a path discontinuity because all error checks and rendering use unit vectors.

Cancellation and the elapsed-time budget are checked between calculations. A macrotask yield occurs after at most eight new body evaluations, permitting new requests and cancellation messages to run. Initial feedback contains the exact anchor; subsequent partials report accepted geometry at approximately50ms intervals. Synchronous native calls cannot be interrupted partway through an individual calculation.

If the date range, point budget, elapsed-time budget, unavailable data or an unresolved discontinuity prevents further sampling, only a contiguous, verified interval around the anchor is retained. A failed/refinement-limited chunk is discarded in full. The result is `limited`, with explicit reasons and actual sampled bounds. `progress` is the fraction of the **original requested temporal span** covered by those bounds; it does not claim completion of discarded work. Instants are clipped to1900-01-01T00:00:00.000Z through2100-12-31T23:59:59.999Z, and clipping remains visible.

## Playback, projection and cache identity

An enabled trail requests a fixed interval. Playback ticks inside it do not schedule a new numerical job. `projectTrail(result, latestSnapshot)` inserts the exact current body vector into timestamp order and marks it `isCurrent`. A sampled point at the same instant is replaced, preventing duplicates. The latest exact point therefore coincides with the marker, including nonzero ecliptic latitude, in either frame.

When current time is inside the requested interval but outside a limited sampled interval, the current marker is returned as a separate one-point segment. It is never connected across the unsampled gap. An observer or calculation-version mismatch returns no geometry and an explicit reason. The application additionally withholds target/frame/house-system mismatches and rebuilds when current time exits the sampled interval.

`services/trails.ts` exports `createTrailService()`, a Svelte readable with independent `trail` and `history` job states. Methods are `requestTrail(input)`, `requestHistory(input)`, `cancelTrail()`, `cancelHistory()`, `retry()` and `destroy()`. A new request immediately clears the prior result, keeping observer/target/interval labels consistent while work is pending. Published state and nested numerical results are frozen. Independent request IDs and worker-generation guards reject stale results; malformed or future active responses produce an explicit error. Retry replaces the worker. Destruction removes listeners, terminates the worker and clears caches.

The shared LRU defaults to eight final results and permits a configured size0–32. Its keys include the algorithm version, pinned native-source/data identities, observer, selected target, requested interval, frame and sampling settings. Body-trail keys intentionally exclude the changing anchor/current instant. A cache hit retains `anchorMs` as the **original sampling origin**, then projection inserts the latest exact body position. Limited results are reused only while a new anchor remains inside their actual sampled bounds; an exhausted result cannot trap playback in an endlessly reused interval. Boundary-history keys also include their exact anchor, because those discrete indexed cusp samples cannot be replaced by body-trail projection.

## Indexed boundary ghosts

`sampleBoundaryHistory` independently calculates one selected indexed cusp for at most seven times within a maximum24-hour window, defaulting to seven samples over six hours. The exact requested anchor is among the samples. Longer intervals and unsupported dates are explicitly clipped; low sample counts still describe discrete samples, not a continuous history.

Each valid ghost contains the native indexed longitude, the partition's forward/reverse orientation, a fixed-J2000 point at ecliptic latitude0°, and a45-point constant-longitude **display extension** spanning ecliptic latitude−88° to+88°. This is the M4 schematic extension at that sample's date, not an M5 construction guide. Ghosts remain separate and are never joined into a surface or interpolated across time.

Undefined native/partition results remain tagged `undefined` with their reason, including polar Placidus/Koch failures. A Whole Sign rising-sign change or indexed orientation change is tagged `jump`, with an explanation; ghost rendering never implies continuous cusp motion across it. Partial history bounds describe only samples already calculated, and progress is the fraction of requested discrete sample evaluations performed. History yields and checks cancellation after every native calculation.

## Validation

`workers/trail-protocol.ts` validates request intervals/coordinates/targets/budgets and response IDs, vectors, chronological order, actual bounds, bounded arrays and version identity with Zod. Service checks additionally bind results to the active request's observer, target, interval and anchor. Native models fail explicitly rather than selecting a numerical fallback.

`tests/domain/trails.test.ts` exercises adaptive curvature, elapsed-gap alias prevention, budgets, range clipping, cancellation, actual native Moon vectors in both frames, exact-current insertion, polar undefined/reversed indexed states and Whole Sign jumps. `tests/state/trails.test.ts` covers independent channels, truthful partials, cancellation, stale/malformed/future responses, retry, immutable publication, cache identity/LRU and disposal.

Run `npx vitest run tests/domain/trails.test.ts tests/state/trails.test.ts` for the focused suite. Scene and browser tests separately verify rendering, fading/dashed future treatment, timeline interaction and visible budget/undefined explanations.
