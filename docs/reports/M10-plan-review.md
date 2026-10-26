# M10 independent requirement audit

Reviewed on 26 October 2026 against the settled product/test candidate
[`6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd`](https://github.com/buttery-x3/astrology-viewer/tree/6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd),
tree `02970a9f388aa475c656ba9920b05feae92d8d0e`, with evidence merged through
`ab35f67`. The earlier `bd58cf1` audit, `79b585b` repairs and `a2ef959` physical
measurements retain their own revision boundaries. Source gates, terminal-card
checks and the exact final archive now pass. This audit reads source, assertions
and reports rather than treating test counts as evidence of every requirement.

The controlling requirements are the approved [implementation plan](../../IMPLEMENTATION_PLAN.md),
retained [design brief](../source/spatial_astrology_design_brief.md),
[M10 extension](../plans/M10-hover-and-earth-projections.md), and later
[rectifications and mode-memory amendment](../plans/M10-rectifications.md).
Desktop mouse/keyboard scope supersedes the brief's mobile suggestions. The
amendments supersede the original card density, measurement footer, scrolling/F2,
decoration and view-reset requirements. Other calculation, selection, provenance
and layer-independence requirements remain in force.

The user approved the visuals and authorized complete release validation and
subsequent M10 integration into `codex/development`. Most release checks have
passed at the recorded revisions. Only the complete packaged three-engine
browser result and development integration remain
**pending** at this documentation handover. Main remains untouched; approval is
not recorded as execution or completed external acceptance.

## Findings and completion boundary

The final source retains the earlier audit repairs: attributed sky-angle themes
remain in the inspector (`4e576f4`); historical boundaries retain explicit frame
and past/current/future context (`6936ab4`); and independently visible
trail/history/construction targets remain readable when ordinary body/house
geometry is disabled (`12ef029`). The original [target review](M10-target-review.md),
[geographic crossing review](M10-geographic-crossings.md) and
[browser integration report](M10-browser-integration.md) retain their historical
execution evidence. Their counts and timings are not new results for this source.

Rectification review corrected automatic geographic selection that reapplied a
view preset, a connector line called a longitude marker, measured card bounds,
and precise geographic curve hits obscured by their own badge margins.
The [approved visual review](M10-rectification-visual-review.md) records the
compact composition; the [mode-memory review](M10-view-layer-memory.md) records
the later independent profile behavior.

The final audit produced these focused follow-ups:

- `44e2bc7` preserves exact native camera/vector/sample/cusp/frame/star assertions
  while moving removed preview numerical facts to the inspector. Semantic DOM
  attributes retain exact hit role and committed snapshot identity. The Melbourne
  workflow proves a stationary-pointer preview advances by exactly one hour.
  Observer isolation is configured after entering its own profile.
- `89927cd` and `8ce269e` explicitly configure and assert actual default Earth,
  all forty geographic lines plus houses, figures and dense Outside workloads.
  Exact checkbox selectors avoid ambiguity with preview/legend labels.
- `4063986` keeps the original exact Earth no-pan matrix assertion by explicitly
  entering Earth and waiting for its frame. It adds separate Outside coverage
  with every matrix component within `1e-10`, allowing signed-zero/~`1e-15`
  redraw residuals while rejecting meaningful pan or rotation.
- `4e771ec` replaces house cards' zodiac-element colour cycle with one distinct
  architectural blue/amber palette. Its domain regression checks every house
  number and related family against all twelve sign palettes. The regression is
  included in the 906 passing source tests.
- `13c9e56` repaired the native-zoom Sun–Moon overflow with a measured full-width
  placement composition preserving prose. The new [native report](M10-native-zoom-rectified.md)
  passes all eight Windows Chrome states and 24 complete previews at `79b585b`.
- [CI run 40279259335](https://github.com/buttery-x3/astrology-viewer/actions/runs/40279259335),
  head `3c3a43f2f1ff55ef75c9f10264119bb338249147`, passed the source gates and 57
  browser cases before the new 504×308/Large test failed under Linux font
  wrapping: the card bottom reached 318.8px. This is not a passing release run.
  Repair `ca39e0f` changes only the terminal full-width class's line height and
  padding, preserving reading font size and all prose. The [headroom amendment](M10-native-zoom-headroom-amendment.md)
  records focused three-engine checks passing 3/3 and both affected native states
  passing, with a 261.44px relationship card and unchanged 14.625px reading font.
  The failed run remains historical; the complete final browser run is the
  engineering item still open, not a sixth external acceptance gate.

This documentation review did not run a competing browser/performance suite.
No engineering-complete or development-merge claim is made while those final
items remain pending. The five external acceptance gates are retained separately.

## Original brief and implementation-plan mapping

Each row covers the corresponding substantive baseline requirements. Later M10
rows detail the extension rather than implicitly replacing these commitments.

| Requirement | Source and meaningful evidence | Audit result |
| --- | --- | --- |
| Brief 1–2; plan 1, 3, 6: one desktop spatial application, example/birth entry, compact tools, inspector and timeline | [App](../../src/App.svelte), [SceneCanvas](../../src/lib/ui/SceneCanvas.svelte), [accessibility workflows](../../tests/browser/accessibility.spec.ts), [M1](M1.md), [M8](M8.md) | Present; example is labelled, scene remains the interface; no separate wheel/account flow. |
| Brief 3; plan 4, 6: schematic directional sky, three viewpoints, below-horizon access, camera independent of observer | [coordinate contract](../coordinate-contract.md), [runtime](../../src/lib/scene/runtime.ts), [spatial workflows](../../tests/browser/spatial.spec.ts), [camera recovery](../../tests/browser/camera-cancel.spec.ts) | Present; observer sky uses the directional centre, Earth scale is explicitly schematic; M10 changes Earth composition and introduces independent remembered view profiles. |
| Brief 4; plan 5: search/globe/numeric observer, authoritative globe point, manual fallback and instant-versus-clock mode | [MomentForm](../../src/lib/ui/MomentForm.svelte), [birth context](../../src/lib/state/birth-context.ts), [location workflows](../../tests/browser/location.spec.ts), [recovery workflows](../../tests/browser/recovery-preferences.spec.ts) | Present; lookup is separate from chart calculation, and an outage does not remove manual input. |
| Brief 4; plan 4–5: 1900–2100 Gregorian input, historical rules, folds/gaps/seconds, manual offset and uncertainty | [civil-time resolver](../../src/lib/time/civil-time.ts), [civil-time tests](../../tests/domain/civil-time.test.ts), [historical tests](../../tests/domain/historical-timezones.test.ts), [timezone build](../timezone-build.md) | Present; pinned backzone history, explicit candidates and documented limits. The resolver's literal status names differ from planning vocabulary without silently accepting an invalid instant. |
| Brief 4, 8; plan 3, 5, 9: immutable birth anchor and one moving displayed moment | [birth-context tests](../../tests/state/birth-context.test.ts), [timeline domain](../../src/lib/domain/timeline.ts), [timeline workflows](../../tests/browser/timeline.spec.ts) | Present; return-instant and restore-context actions remain distinct; pending geometry retains its actual context. |
| Brief 5; plan 4: ten genuine-latitude geocentric apparent directions, tropical signs, fixed/date/horizon transforms | [engine](../../src/lib/astronomy/ephemeris.ts), [coordinates](../../src/lib/astronomy/coordinates.ts), [native integration tests](../../tests/ephemeris.test.ts), [Horizons report](horizons-validation.md) | Present; no snapping to the ecliptic or hidden topocentric correction. Independent reference differences/time policies remain recorded. |
| Brief 5–6; plan 7: seven indexed house systems, longitude membership, angles separate from cusps, honest polar failure | [chart domain](../../src/lib/domain/chart.ts), [chart tests](../../tests/domain/chart.test.ts), [house workflows](../../tests/browser/houses.spec.ts), [M2](M2.md), [M4](M4.md) | Present; no numerical sorting of cusp identities or substitute P/K result under the requested name. |
| Brief 6; plan 7: all three house displays, adjustable opacity/fill/lift/hybrid, unchanged membership, comparison ghosts and changed assignments | [house geometry](../../src/lib/domain/house-geometry.ts), [renderer](../../src/lib/scene/house-renderer.ts), [geometry tests](../../tests/domain/house-geometry.test.ts), [house workflows](../../tests/browser/houses.spec.ts) | Present; M10 shells/zero lift supersedes the old initial arcs preference while preserving explicit saved choices. |
| Brief 6; plan 7: each method's actual concise interactive construction | [construction domain](../../src/lib/domain/house-construction.ts), [construction tests](../../tests/domain/house-construction.test.ts), [M5](M5.md) | Present; 644 native cases and numerical residuals cover actual rules, including polar conventions; display extensions are not claimed as universal construction planes. |
| Brief 7; plan 8: five longitude aspects, explicit orbs, core/halo, selection, true latitude and measured ecliptic arc | [aspect presentation](../../src/lib/domain/aspect-presentation.ts), [renderer](../../src/lib/scene/aspect-renderer.ts), [inspector](../../src/lib/ui/AspectInspector.svelte), [actual strand regression](../../tests/browser/m10-earth.spec.ts) | Present; an outside-orb selection retains measurements but no active hovered strand. No force/energy scale is introduced. |
| Brief 8; plan 9: forward/reverse/step/scrub, short/long windows, two adaptive trail frames, bounded ghost history and breaks | [trails](../../src/lib/domain/trails.ts), [trail service](../../src/lib/services/trails.ts), [trail tests](../../tests/domain/trails.test.ts), [trail workflows](../../tests/browser/trails.spec.ts), [M7](M7.md) | Present; exact current insertion, cancellation, declared clipping/budgets and discrete invalid/jump handling remain. Canvas representation verification is distinguished above. |
| Brief 9, 11; plan 10: identity/definition, interpretation, sources, all 240 placements, clear evidence roles and Wikipedia navigation | [catalogue](../../src/lib/content/index.ts), [validation](../../src/lib/content/validation.ts), [catalogue tests](../../tests/content/catalogue.test.ts), [Wikipedia tests](../../tests/content/wikipedia.test.ts), [licence/content audit](content-source-licence-audit.md) | Present; 320 cards include the preserved 305 and 15 additions; human claim-to-passage sign-off remains external. The angle inspector continuity repair is retained. |
| Brief 10; plan 11: restrained observatory styling, explicit glyph names, distinct sign/house encoding, active legends and strongest selection | [runtime](../../src/lib/scene/runtime.ts), [App legends](../../src/App.svelte), [hover design review](M10-hover-design.md), [M10 performance/visual review](M10-performance.md) | Present; aspect palettes identify type rather than good/bad or strength. Expressive cards retain explicit feature names; the final audit's separate house palette avoids a zodiac-element cycle. |
| Brief 12; plan 6, 11: keyboard alternatives, visible focus, scalable text, collapsible desktop panels, motion/quality options | [FeatureNavigation](../../src/lib/ui/FeatureNavigation.svelte), [accessibility tests](../../tests/browser/accessibility.spec.ts), [hover workflows](../../tests/browser/m10-hover.spec.ts), [manual kit](../manual-validation.md) | Engineering paths present; native zoom/screen-reader evaluation is not inferred from axe or logical viewport tests. |
| Brief 12; plan 3, 12: coherent pending/error/provisional/undefined state, recovery and privacy | [explorer coordinator](../../src/lib/state/explorer.ts), [preferences](../../src/lib/state/preferences.ts), [worker recovery tests](../../tests/state/worker-recovery.test.ts), [recovery workflows](../../tests/browser/recovery-preferences.spec.ts) | Present; display-only whitelist excludes personal context, and hovering starts no lookup or calculation request. |
| Plan 2, 12–14: reproducible source/data, deployment, CSP, HTTPS configuration, notices, exact corresponding source and branch review process | [release builder](../../scripts/build-release.ts), [server](../../server/production.ts), [source workflow](../../tests/browser/release-source.spec.ts), [CI](../../.github/workflows/ci.yml), [deployment](../deployment.md), [M9](M9.md) | Infrastructure and exact final archive verification pass; the complete browser result and development merge remain pending. No external deployment was requested. |
| Brief 13; plan 13, 17: six learner tasks and definition of complete | [release acceptance](../RELEASE_ACCEPTANCE.md), [manual protocol](../manual-validation.md) | The engineering workflows exist; moderated understanding and the other declared external gates are explicitly unperformed. |

## M10 requirement mapping

### Card model and every semantic target

The shared [hit contract](../../src/lib/domain/scene-hit.ts) preserves representation,
role, system and sample metadata separately from persistent selection. The
[resolver](../../src/lib/domain/hover-card.ts) consumes the committed snapshot;
[resolver tests](../../tests/domain/hover-card.test.ts) check registered claims,
placements, invalid contexts and exhaustive identities. The
[target inventory](../m10-target-inventory.md) explicitly identifies nonsemantic
decoration rather than excluding real stars or guide geometry.

| M10 target/requirement | Implementation and evidence | Result |
| --- | --- | --- |
| Body marker/caption, actual sign/house identity, body/sign/house readings and qualifiers | Resolver body branch; all 120 sign and 120 house placement combinations; actual body hover workflow | Present. |
| One combined aspect preview, all five types and two actual placements; full measurements in the inspector | Resolver/themes; [AspectInspector](../../src/lib/ui/AspectInspector.svelte); actual Sun–Moon strand/orb-crossing test; Venus–Neptune design fixture | Present; no pair-specific invented narrative or source links in the tooltip. |
| Aspect endpoint, longitude anchor, projection and measurement roles | [aspect renderer](../../src/lib/scene/aspect-renderer.ts) descriptors and preview titles/captions and full resolver facts; renderer/domain checks | Present; endpoints retain body cards, measured arc retains pair identity. |
| Tropical sign sector/glyph and constellation distinction | Resolver sign branch, exact 30° interval, existing sign interpretation; Melbourne actual label/placement regression | Present. |
| House surfaces/arcs/labels and boundaries, actual primary/comparison identity | Directed house partition, separate comparison IDs, resolver tests rebinding comparison slots, house renderer tests, actual comparison-cusp regression | Present; full secondary identity and measured cusp survive the real canvas click. |
| ASC/DSC/MC/IC geometry plus new traditional themes | Resolver angle branch, canonical sky references, new four-angle inspector repair/regressions | Present after the retained inspector continuity repair. |
| Horizon/compass/ecliptic/equator/meridian/prime vertical/zenith/nadir/poles | Canonical reference definitions and registered compass explanation; runtime role descriptors; reference/resolver tests | Present; geometric-pole undefined state is explicit. |
| Earth/observer geographic context, with current local/UTC time in application context/inspector | Resolver requires matching local label instant; App committed observer/time context; ordinary Earth/observer workflow | Present; view motion does not change observer data. |
| Catalogue points including nine support stars | Indexed Points/HYG lookup, combined star map, fixed epoch/proper motion; Mizar/Alcor actual indexed centre-ray test | Present; screen-distance ordering and shader-consistent hidden-side filtering are source-verified. |
| Regions/figures/labels as distinct representations | Region classifier, figure IDs, region/asterism explanation and factual inspector; actual Orion path and region-interior/disabled-region tests | Present; background interior classification is tested separately from the figure/label/edge. |
| Construction elements preserve actual system/stage/element/role | Construction IDs, complete overlap descriptors, stage-filtered navigation; actual Equal C1/ASC overlap regression | Present. |
| Trails/history preserve exact sample or bounded interval, frame, past/future/spanning status and validity | Resolver/time metadata; stale-frame test rejects current-body fallback; navigation/renderer tests and actual historical caption/line tests | Present after explicit history-fact and representation-visibility repairs; old altitude/cusp/time are checked against fixed-fixture calculations. |
| Projected house section/cusp/badge retains projected identity and house interpretation | Earth domain/renderer, primary link helper, 24 keyboard targets; actual section/reciprocal-material tests | Present; radial projection is explicitly distinguished from relocated charts. |
| Geographic line/badge, all 40 body-angle themes and provisional flag; displayed moment in map context/inspector | Astro domain and composed 15-entry catalogue; 40-combination resolver tests, Venus AC navigation and Venus MC actual canvas/focus test | Present; full geographic IDs remain distinct from sky-body aliases. |
| Layer toggles/legends work even while disabled, with availability reasons | `LAYER_HELP`, registered supplementary claims, live layer metadata and native controls; exhaustive layer resolver tests | Present; unavailable house projection retains its specific reason without disabling valid lines. |

### Visual and interaction contract

| Final requirement | Implementation and evidence | Result / limit |
| --- | --- | --- |
| Compact HTML preview with full readings and no technical footer, clipping or scrolling | [Preview model](../../src/lib/domain/hover-preview.ts), [HoverCard](../../src/lib/ui/HoverCard.svelte), [preview tests](../../tests/domain/hover-preview.test.ts), [rectification review](M10-rectification-visual-review.md) | Implemented: 460px preferred width, measured widening/compact composition and full-width aspect fallback. Ordinary text is 13px equivalent at 1.38 line height; the terminal class uses 1.25 line height without reducing fonts or prose. All 24 initial native previews and both affected post-repair native states pass at their recorded revisions. |
| Inspector keeps all calculations, source records and original claim identities | Shared resolver and dedicated preview presentation; removed-field/inspector continuity assertions | Present; previews omit role, orb/angle and routine current-time tables while retaining historical sample/interval identity and essential notices. No runtime summaries are generated. |
| Expressive treatment across every family, five aspect palettes and equal placement panels | [Theme resolver](../../src/lib/domain/hover-card-themes.ts), body identity colours, complementary gradients, dark panels, glyphs and connector | Implemented; house palette correction is tracked above. Colours do not rank significance or favourable/unfavourable outcomes. |
| Bounded deterministic glints outside reading text; no extra canvas or animation-driven scene loop | Twelve CSS/SVG glints, noninteractive decorative layer, opacity-only 160ms entrance | Present; same-target updates do not remount the card. At `a2ef959`, glints stayed bounded at twelve and sparkle On/Off plus no-card idle produced zero additional canvas renders. |
| Sparkles preference, reduced motion, Low quality, forced colours and hidden-document handling for all families | Visibility/media listeners, App flags, v2 persisted display whitelist and motion tests | Present; static cards retain their rich treatment. Personal context remains session-only. |
| Body contrast and clear glyph/text identity | Dark reading panels, forced-colour text/SVG rules, retained [design](M10-hover-design.md), rectification and [native captures](M10-native-zoom-rectified.md) | Current native captures retain complete readable claim text at standard/Large sizes. Earlier numerical pixel contrast samples remain scoped to their earlier design. |
| Five aspect studies plus nine representative feature families | [Gallery](../../src/lib/ui/AspectCardPreview.svelte), real production components and preview workflow | Present; illustrative fixtures remain labelled and separate from calculated placements. |
| 300ms stable dwell, movement tolerance, grace, offset, flip/shift and stable reading position | [FeaturePreview](../../src/lib/ui/FeaturePreview.svelte), hover workflows | Present: 300ms dwell, 5px tolerance and 18px offset with measured viewport placement. |
| Move into/copy the card, persistent reading, Escape suppression and no selection/camera mutation | HTML portal, wheel isolation, safe-corridor and selected-pair assertions | Present; no interactive control or scroll-only tab stop is added to the passive tooltip. |
| Keyboard parity, correct origin description/focus and persistent inspector reading | Focus ownership, `aria-describedby` restoration, paginated navigation and keyboard preview tests | Present; F2 transfer and scrolling card surfaces are removed. Actual screen-reader acceptance remains open. |
| Drag/blur/context/view/removal cancellation; stationary-pointer refresh without idle polling | Runtime demand-render hit checks, reset/suspension and null-model invalidation; lifecycle and snapshot metadata assertions | Present; exact one-hour refresh and representation role remain testable without a visible fact table. |
| Individual stars/figures/lines/houses/guides/history without thousands of tab stops | [Bounded navigation](../../src/lib/ui/feature-navigation.ts), 12-result pages, stage lists, indexed trail navigator and bounded history | Present: 2,874 stars, 88 figures, 40 geographic lines, 24 surface features and 12 comparison cusps. |
| 1440×900/1024×768, actual 200% zoom, Large text and panel routes without inaccessible text | [Eight-state compact-card report](M10-native-zoom-rectified.md) and [terminal amendment](M10-native-zoom-headroom-amendment.md) | Passed on Windows Chrome: 24 initial previews plus both affected native states after the terminal repair. The smallest Large relationship is 261.44px high inside the 504×308 viewport with complete prose. Focused Chromium/Firefox/WebKit checks pass; the complete packaged run remains pending. Earlier scrolling/F2 results remain historical. |

### Figures, views and geographic mathematics

| M10 requirement | Implementation and evidence | Result |
| --- | --- | --- |
| Independent figures, stars and official regions; figures initially Off in Outside/Earth and On in Observer | Explorer layers and independent controls; all endpoint switching renderer tests; actual GPU 710-endpoint submission with stars hidden | Present. |
| Pinned modern Western topology/licence/raw bytes, exact HIP→HYG join and support stars | [figure contract](../constellation-figure-data.md), [import](../../scripts/prepare-constellation-figures.mjs), raw vendor source and checksum manifest | Present: 88 figures, 219 polylines, 695 segments, 710 unique endpoints, 701 existing plus 9 support stars; no illustrations. |
| Serpens portions, no unintended duplicates, exact epoch/proper-motion alignment and short spherical arcs | [figure tests](../../tests/scene/constellation-figures.test.ts), shared `catalogueStarDirection`, renderer tests at 1900/J2000/2100 | Present; no second precession or nearest-position endpoint substitute. |
| Distinct close observer-facing Earth, north-up, radius/aspect framing, orbit/no pan/safe zoom and resize | Runtime `frameEarthForPicking`, `viewingDistance`, `applyViewpoint`, `resize`; actual close-Earth re-entry and GPU camera recovery tests | Present; margin 1.2 yields the specified approximate 75–85% globe occupancy, adjusted by available aspect ratio. |
| Independent complete per-view layer profiles; defaults initialize once, explicit return/reselection restores saved choices | Shared profile definitions, store/state tests and real control/re-entry/focus workflows; [memory amendment](M10-view-layer-memory.md) | Present; Outside starts with aspects, Earth with astrocartography and sections/aspects Off, Observer with figures and aspects Off. Internal focus/picking carries visible layers without copying an entire profile. Named-bit changes update only the destination bit; appearance, body/angle filters and orbs remain shared. |
| Ordinary relationship strands remain clearer than reference figures; inactive cusps recede | [Aspect renderer](../../src/lib/scene/aspect-renderer.ts), [house renderer](../../src/lib/scene/house-renderer.ts), shared aspect controls and renderer regressions | Present: 65% ordinary aspect opacity, 0.8–1.0 closeness modulation and 1.7px core; inactive primary/comparison cusps use 22%/25%. Hover, selection, glow, type patterns and calculations retain their distinct roles. |
| Shells/0% fresh/fallback/reset, preserve old explicit mode, no numerical change | House/display defaults, v2 migration, both reset actions; [defaults browser tests](../../tests/browser/m10-defaults.spec.ts), preference and membership tests | Present. |
| Independent Earth master/children/opacities/body and angle filters, matching live geographic key | [Earth controls](../../src/lib/ui/EarthProjectionControls.svelte), renderer visibility tests and [shared key](../../src/lib/ui/GeographicLineKey.svelte) | Present; geographic opacity starts at 75%, resets preserve layer/filter choices and celestial longitude houses remain independent. |
| Equal-width/opacity solid curves with sparse repeated AC/DC/MC/IC labels and categorical pictograms | [Shared geographic style](../../src/lib/domain/geographic-line-style.ts), [Earth renderer](../../src/lib/scene/earth-projection-renderer.ts), renderer and [crossing regressions](../../tests/browser/m10-geographic-crossings.spec.ts) | Present; all four angles share a 1.1px base stroke and the same marker footprint. Five stable marker anchors reuse the actual curve and line ID; collision/clipping and overlap selection remain, with no displacement of coincident geography. The key and controls use the same symbols and meaning. |
| Project exact primary partition once into Earth frame; all systems, reverse polar/undefined/degenerate states and ambiguous poles | [Earth domain](../../src/lib/domain/earth-projections.ts), [projection tests](../../tests/domain/earth-projections.test.ts), [contract](../earth-projection-contract.md) | Present; renderer classifies the same directed partition; no comparison fill or relocated-house calculation. |
| Correct inside-region badges, front-side clipping and geographic hit priority/reciprocal focus | Earth renderer analytic globe/partition intersection, local front-face labels, scene label collision layout; transformed-parent/hidden-side renderer tests, actual Earth workflows and geographic crossing/filter/far-side cases | Present; globe/sky fills do not consume a valid geographic section/line hit and independent crossing choices retain their geographic identities. |
| All ten bodily true-latitude AC/DC/MC/IC curves at displayed moment, matching GAST | [astro domain](../../src/lib/domain/astrocartography.ts), native/synthetic tests and contract | Present; geocentric apparent in-mundo/unrefracted convention, no hidden zero-latitude projection, refraction/parallax or fixed natal map. |
| Both hemispheres, equatorial/polar/tangent/circumpolar cases, seams and no fabricated crossings | Conditioned vector terminator, declared singularities, seam splitting; [synthetic tests](../../tests/domain/astrocartography.test.ts) | Present; exact celestial-pole ambiguity is honest. |
| Native reference at range/date examples, AC/DC rise/set, meridian residual ≤1e−6° | [native tests](../../tests/domain/astrocartography-native.test.ts), 320 retained independent native probe samples/hashes and geometric contract | Present; worst recorded altitude 1.1291e−13°, meridian 1.1369e−13°. This is same-model implementation consistency, not independent physical validation. |
| Interpolated geometry follows the true curve without false seam joins | Default ≤2° central steps on great-circle loci, exact same-plane seam intersections and duplicate removal | Present; normalized chord directions remain on the same great circle. The maximum chord radial sagitta is `1−cos(1°)≈0.0001523` of radius, not a new astrological influence width. |
| Astro geography invariant under observer/system/camera/display; house geography depends on actual partition/frame | Pure astro input type, separate dependency keys and reused buffers; domain and renderer invariance tests | Present; surface axes are transformed exactly once under the already rotating Earth group. |
| 15 short sourced entries, all 40 combinations, reused angle themes and ≤180 Almanac-derived words | [content tests](../../tests/content/astrocartography-content.test.ts), 154-word canonical page budget, unchanged-original-claims hash | Present; inspector continuity repair is identified above. No parans, influence bands, city scores or pair-specific predictions were added. |

### Performance, recovery and release

These checks have passed at their stated revisions. They are distinct from the
five external acceptance gates.

| Passed evidence | Actual result and scope |
| --- | --- |
| Source/type/lint/content/assets/notices | Green ordinary [CI 40281047430](https://github.com/buttery-x3/astrology-viewer/actions/runs/40281047430) at exact candidate `6c1a0cb`: 906 source tests in 50 files; type/Svelte check with zero warnings; lint, assets, 320 entries/90 sources/96 canonical budgets, and all 53 notices pass (50 full notices, three recorded shorthand cases). This ordinary run does not claim complete browser validation. |
| Installed Chrome/Edge packaged workflows | Artifact `a2ef959`: 96/96 passed, 48 each in Chrome 156.0.8078.47 and Edge 142.0.3595.94, with zero skipped or flaky cases, in 286.3 seconds (`.cache/m10-final-installed.json`). Final artifact `6c1a0cb` also passes the affected terminal case in both installed browsers, 2/2 with no skips/flaky cases (`.cache/m10-final-terminal-installed.json`). |
| Card processing ≤50ms p95; whole picking ≤4ms p95 | [Physical report](M10-performance.md), [raw samples](M10-performance.json) and [Git binding](M10-performance-binding.json) bind 111 source/data/style/WASM/lockfile hashes to `a2ef959`: reveal p95 29.7ms over 36 samples; picking p95 2.0–2.1ms, 203 samples for each of four actual workloads. This is RTX 3060 development-runtime evidence, not an integrated-GPU or packaged-runtime timing claim. |
| Actual workloads, idle, resources and recovery | Default Earth, all forty lines plus houses, Earth with figures, dense Outside, and matched Sun sparkles On/Off are asserted. Delivered rAF p95 was 16.7–16.8ms. Post-warmup resources plateaued at 537 geometries/331 textures/15 programs; sparkle and final idle rendered zero additional frames. Actual context restoration preserved camera state exactly, and disposal removed the canvas and owned geometries/programs. The dense trail result remained explicitly sampling-limited. |
| Native Chrome 200% zoom, Large text and complete cards/panel routes | The [eight-state report](M10-native-zoom-rectified.md) passes 24 previews at `79b585b`. The [headroom amendment](M10-native-zoom-headroom-amendment.md) at `ca39e0f` passes focused engines 3/3 and both affected actual 200% native states/six previews. The relationship is 480×261.44px, ending at y=273.44 inside the 308px height; reading font remains 14.625px. Full prose, selection/focus/Escape, panel routes and no scrolling/clipping/F2 surface are retained. |
| Final packaged UI latency | [Candidate `6c1a0cb` samples](M10-ui-latency.json): selection p95 25.9ms/max 53.8ms and warm chart p95 79.4ms/max 95.4ms over 30 samples each; normal one-day Moon trail first usable in 138.2ms, with initial feedback in 4.2ms. No page errors. Activation-to-committed-UI-plus-rAF measurements meet the initial selection/warm-chart/trail budgets; they do not measure physical scanout. |
| Cold loading/first usable scene | [Three final packaged runs](M10-cold-load.json) at `6c1a0cb`: 2.3424s, 2.0180s and 2.0609s, each transferring 2,344,991 encoded body bytes, with zero errors or blocked requests. The documented aggregate 20Mbps/40ms application-layer profile passes the five-second target. Three samples do not establish a population p95 or a real last-mile link result. |
| Exact final source-archive install/build | The [independent final archive audit](M10-source-archive.md) and [structured record](M10-source-archive.json) verify `6c1a0cb`: all 443 source files/50 directories match its tree; all 108 release manifest records pass. Independent extraction, locked install, ordinary build, assets/content/notices pass without `.git`, linked repository dependencies or a native compiler. Archive SHA-256 `883420968c5a6d4b4b4a6eff397f5c1fac94d920afc6122079613de76acc3ef3`; manifest SHA-256 `161997ac33ec307a556a8999a9989f7c5f8e69a340364f718a789a5b0eb16c00`. |

The physical report remains bound to `a2ef959`. The [later-candidate binding](M10-performance-binding.json)
compares all 111 measured files with final `6c1a0cb`: 110 are unchanged; only
`HoverCard.svelte` terminal CSS differs, with script/template identical. It
changes no picker/controller or normal 1920×1080 composition. This is a scoped
comparison, not a new GPU measurement or a relabelled timing run.
Earlier failed timing runs and scrollable-card/native screenshots retain their
historical scope.

| Remaining engineering item | Evidence still required |
| --- | --- |
| Complete packaged three-engine browser result | Record all 261 cases against `6c1a0cb` in the [final validation report](M10-final-validation.md). Remote [CI 40281143229](https://github.com/buttery-x3/astrology-viewer/actions/runs/40281143229) and the local packaged fallback (`.cache/m10-final-cross.json`) are still awaiting a complete result at this checkpoint. Early stopping was removed; assertions remain intact. Neither the ordinary green CI nor the historical failed runs is substituted for this full result. |
| M10 → `codex/development` and final status | After the complete browser result is reviewed, record the development merge and final identities in the final validation report and status documents. The exact final `6c1a0cb` archive already passes; development integration is still pending. Main remains untouched. |

## Five external acceptance gates

These remain **open**:

- Actual Safari on macOS before claiming Safari support; Playwright WebKit is separate evidence.
- A real desktop screen-reader session with exact version, browser and findings.
- The specified recent integrated-GPU laptop at 1080p with at least 8 GB RAM; RTX desktop measurements do not substitute for it.
- Approximately five visual learners and two experienced astrology users completing the brief's tasks with recorded comprehension findings.
- A human editor's claim-to-passage support review for all 320 entries, including the 240 placements and fifteen geographic additions.

The [acceptance matrix](../RELEASE_ACCEPTANCE.md) and
[manual protocol](../manual-validation.md) define those sessions. Agent review,
source tests, working links, axe, screenshots and physical RTX measurements do
not establish that they occurred. This audit adds no hosting, broader browser
support, legal-clearance, predictive-validity or user-evaluation claim.
