# M10 actual geographic crossing validation

All three Chromium tests in `tests/browser/m10-geographic-crossings.spec.ts` passed against the live integration server at `http://127.0.0.1:5196`: no skips, failures, retries or flaky results; 28.2 seconds in total. The viewport was 1440×900 and Playwright was 1.64.1. [The retained JSON](M10-geographic-crossings.json) contains the exact fixture, numerical conditions, full chooser metadata and test results.

The tests are based on committed integration revision `f2ca281e8f57fd8841ca2e0a0de96017373ea522` and target the live working tree. They do not claim validation of the forthcoming final packaged revision. No production files were changed.

The first workflow clicks the actual Sun MC/Jupiter AC crossing at approximately 55.263045346° N, 0.819834056° E for 1 January 2000, 12:00 UTC. Both curves appear in the chooser. Each candidate carries its full line ID, entity ID, `astro-line` kind, Earth representation, line role, body, angle, instant and geocentric apparent unrefracted convention. Keyboard selection of each candidate preserves its correct inspector identity, traditional body/angle entries, angular condition and displayed moment, and returns focus to the canvas.

The crossing is computed from the two curve planes. A separate hour-angle/altitude calculation checks the angular conditions: the Sun's hour angle is 0° at its upper meridian; Jupiter's geometric altitude is approximately 0° and its vertical-motion sign is rising. The actual camera matrices uploaded to WebGL project the geographic intersection onto the canvas, including after inspector layout changes. No development-module import or production test hook is used, so the test can run against packaged builds.

The second workflow independently disables the Sun body filter and the MC angle filter. In each case, only the still-enabled Jupiter AC target is selected at the same real crossing, without re-enabling the disabled filter. Disabling the astrocartography master layer then returns the same canvas click to the base Earth inspector and leaves no stale geographic content cards.

The third workflow tests a far-side Sun IC/Moon AC crossing at approximately 69.592775327° S, 179.180165944° W with Earth opacity 0.3. Its nearest visible geographic curve is more than 152 pixels away, avoiding a legitimate front-side overlap. Both rear curves remain unavailable to hover/selection: the click inspects the Earth, and neither hidden line can be chosen. This exercises geographic front-surface rejection when ordinary opaque-Earth occlusion is disabled.

No runtime defect was found by these workflows. They cover canvas disambiguation and visibility policy, rather than a new ephemeris accuracy or scientific validation claim.
