# M10 independent requirement audit

Reviewed on 26 October 2026. The frozen product baseline is
[`6cfa912f72eafce86b2f17c205e5c65d4d21c172`](https://github.com/buttery-x3/astrology-viewer/tree/6cfa912f72eafce86b2f17c205e5c65d4d21c172),
tree `1067f95f63a1980b225cf57eb800fc0360ac3248` and corresponding source archive SHA-256
`cf63f28bedfea91b1c8a270c67c5923b861320a7ec1728468a3e3dc3acadf3ef`.
The archive identity is independently verified in the [source-archive report](M10-source-archive.md).
This audit reads the actual source,
test assertions, data contracts and reports rather than treating feature names or
test counts as evidence of every requirement.

The controlling requirements are the approved [M10 extension](../plans/M10-hover-and-earth-projections.md),
the [implementation plan](../../IMPLEMENTATION_PLAN.md), and the retained
[original design brief](../source/spatial_astrology_design_brief.md). The user's
desktop mouse/keyboard scope and the later M10 defaults/view presets override
the brief's mobile suggestions and the original arcs opening preset. Design
document content is product input, not an independent instruction to publish.

## Findings and completion boundary

Three product omissions/defects were found in the frozen baseline and repaired
through the authorized review branches. They are not new feature proposals.

1. Sky-angle hover cards
included the new traditional AC/DC/MC/IC theme, while the persistent angle
inspector rendered only the geometric method card. Clicking therefore lost the
theme and its inspectable attribution. The approved narrow repair is commit
`4e576f4`: [FeatureInspector.svelte](../../src/lib/ui/FeatureInspector.svelte)
retains the method card and adds the existing attributed angle-theme card.
[Four angle browser regressions](../../tests/browser/m10-angle-inspector.spec.ts)
check hover-to-keyboard-selection continuity, source URL/author and exact source
section. All four passed against the integrated server in **25.2 seconds**.
`c3fc6bb` loads their expected catalogue/source bytes in Node without importing
the browser JSON module graph. No claim text or calculation changed.

2. Historical boundary cards lacked explicit frame and past/current/future facts,
although their descriptors already carried the correct time/frame. Commit
`6936ab4` adds those facts, rejects a mismatched horizon-frame history descriptor,
and tests all three time classifications. It reuses existing labels and claims.

3. A real visible Moon trail caption and historical Equal-house cusp line failed
to show a card when the ordinary body/house layer was disabled. The old runtime
validated the parent entity's layer rather than the independently visible
representation. Commit `12ef029` validates actual visible construction/trail/history
targets with matching ID, parent, system, frame, sample interval and construction
metadata. It also permits valid old ghosts when a current cusp is undefined.
The strict canvas regressions failed before this correction and passed afterward.

The audit also closed an explicit verification gap: M10 section 8 calls for
actual canvas picking checks of region interiors, comparison ghosts and
trail/history representations. Existing domain/renderer tests establish their
identity/classification rules, but the earlier browser suites used list/control
routes for those particular targets. Commit `47d4812` adds
[four real canvas workflows](../../tests/browser/m10-history-regions.spec.ts).
All four passed together against the integrated corrections in **25.2 seconds**:

- A J2000 direction inside Orion resolves specifically as a **Region interior**;
  disabling the region removes that target.
- An actual Equal comparison cusp retains the secondary system, native cusp
  value and full `boundary:comparison:7` selection.
- A real Moon trail start caption selects the exact midnight sample and its old
  altitude, with Past/stars facts and no current-placement substitution, while
  ordinary body markers are hidden.
- A real earlier Equal C7 ghost selects its exact 11:30 sample and native cusp,
  with Past/stars facts, while ordinary house geometry is hidden.

The tests observe actual uploaded WebGL camera matrices, independently calculate
fixed-fixture positions in Node, and send ordinary mouse events to the actual
canvas. They assert that the projected hit lies over the canvas; they add no
production testing API or page source import. ESLint and `tsc --noEmit` passed.
Other actual canvas cases are present, including
indexed points, aspect strands, figure paths, construction overlap choices and
Earth features. Commit `b9bda88` adds three further actual geographic-crossing,
filter and far-side/translucent-Earth cases, recorded in
[the crossing review](M10-geographic-crossings.md).

No additional concrete product defect was identified in this audit. The release
owner separately corrected keyboard scrolling/axe findings: cards are deliberately
focusable for scrolling, F2 transfers focus from the described control, and Escape
closes and restores focus without reopening. The current source and new keyboard
workflow were read, but final packaged CI for that change is pending; no result
is invented here. This is not final release approval: exact packaged checks for
all corrections must pass before an engineering-complete claim.
The five previously declared external gates are retained separately and
are not newly invented engineering work.

## Original brief and implementation-plan mapping

Each row covers the corresponding substantive baseline requirements. Later M10
rows detail the extension rather than implicitly replacing these commitments.

| Requirement | Source and meaningful evidence | Audit result |
| --- | --- | --- |
| Brief 1–2; plan 1, 3, 6: one desktop spatial application, example/birth entry, compact tools, inspector and timeline | [App](../../src/App.svelte), [SceneCanvas](../../src/lib/ui/SceneCanvas.svelte), [accessibility workflows](../../tests/browser/accessibility.spec.ts), [M1](M1.md), [M8](M8.md) | Present; example is labelled, scene remains the interface; no separate wheel/account flow. |
| Brief 3; plan 4, 6: schematic directional sky, three viewpoints, below-horizon access, camera independent of observer | [coordinate contract](../coordinate-contract.md), [runtime](../../src/lib/scene/runtime.ts), [spatial workflows](../../tests/browser/spatial.spec.ts), [camera recovery](../../tests/browser/camera-cancel.spec.ts) | Present; observer sky uses the directional centre, Earth scale is explicitly schematic; M10 deliberately changes only Earth composition/presets. |
| Brief 4; plan 5: search/globe/numeric observer, authoritative globe point, manual fallback and instant-versus-clock mode | [MomentForm](../../src/lib/ui/MomentForm.svelte), [birth context](../../src/lib/state/birth-context.ts), [location workflows](../../tests/browser/location.spec.ts), [recovery workflows](../../tests/browser/recovery-preferences.spec.ts) | Present; lookup is separate from chart calculation, and an outage does not remove manual input. |
| Brief 4; plan 4–5: 1900–2100 Gregorian input, historical rules, folds/gaps/seconds, manual offset and uncertainty | [civil-time resolver](../../src/lib/time/civil-time.ts), [civil-time tests](../../tests/domain/civil-time.test.ts), [historical tests](../../tests/domain/historical-timezones.test.ts), [timezone build](../timezone-build.md) | Present; pinned backzone history, explicit candidates and documented limits. The resolver's literal status names differ from planning vocabulary without silently accepting an invalid instant. |
| Brief 4, 8; plan 3, 5, 9: immutable birth anchor and one moving displayed moment | [birth-context tests](../../tests/state/birth-context.test.ts), [timeline domain](../../src/lib/domain/timeline.ts), [timeline workflows](../../tests/browser/timeline.spec.ts) | Present; return-instant and restore-context actions remain distinct; pending geometry retains its actual context. |
| Brief 5; plan 4: ten genuine-latitude geocentric apparent directions, tropical signs, fixed/date/horizon transforms | [engine](../../src/lib/astronomy/ephemeris.ts), [coordinates](../../src/lib/astronomy/coordinates.ts), [native integration tests](../../tests/ephemeris.test.ts), [Horizons report](horizons-validation.md) | Present; no snapping to the ecliptic or hidden topocentric correction. Independent reference differences/time policies remain recorded. |
| Brief 5–6; plan 7: seven indexed house systems, longitude membership, angles separate from cusps, honest polar failure | [chart domain](../../src/lib/domain/chart.ts), [chart tests](../../tests/domain/chart.test.ts), [house workflows](../../tests/browser/houses.spec.ts), [M2](M2.md), [M4](M4.md) | Present; no numerical sorting of cusp identities or substitute P/K result under the requested name. |
| Brief 6; plan 7: all three house displays, adjustable opacity/fill/lift/hybrid, unchanged membership, comparison ghosts and changed assignments | [house geometry](../../src/lib/domain/house-geometry.ts), [renderer](../../src/lib/scene/house-renderer.ts), [geometry tests](../../tests/domain/house-geometry.test.ts), [house workflows](../../tests/browser/houses.spec.ts) | Present; M10 shells/zero lift supersedes the old initial arcs preference while preserving explicit saved choices. |
| Brief 6; plan 7: each method's actual concise interactive construction | [construction domain](../../src/lib/domain/house-construction.ts), [construction tests](../../tests/domain/house-construction.test.ts), [M5](M5.md) | Present; 644 native cases and numerical residuals cover actual rules, including polar conventions; display extensions are not claimed as universal construction planes. |
| Brief 7; plan 8: five longitude aspects, explicit orbs, core/halo, selection, true latitude and measured ecliptic arc | [aspect presentation](../../src/lib/domain/aspect-presentation.ts), [renderer](../../src/lib/scene/aspect-renderer.ts), [inspector](../../src/lib/ui/AspectInspector.svelte), [actual strand regression](../../tests/browser/m10-earth.spec.ts) | Present; an outside-orb selection retains measurements but no active hovered strand. No force/energy scale is introduced. |
| Brief 8; plan 9: forward/reverse/step/scrub, short/long windows, two adaptive trail frames, bounded ghost history and breaks | [trails](../../src/lib/domain/trails.ts), [trail service](../../src/lib/services/trails.ts), [trail tests](../../tests/domain/trails.test.ts), [trail workflows](../../tests/browser/trails.spec.ts), [M7](M7.md) | Present; exact current insertion, cancellation, declared clipping/budgets and discrete invalid/jump handling remain. Canvas representation verification is distinguished above. |
| Brief 9, 11; plan 10: identity/definition, interpretation, sources, all 240 placements, clear evidence roles and Wikipedia navigation | [catalogue](../../src/lib/content/index.ts), [validation](../../src/lib/content/validation.ts), [catalogue tests](../../tests/content/catalogue.test.ts), [Wikipedia tests](../../tests/content/wikipedia.test.ts), [licence/content audit](content-source-licence-audit.md) | Present; 320 cards include the preserved 305 and 15 additions; human claim-to-passage sign-off remains external. Angle inspector omission receives the narrow repair above. |
| Brief 10; plan 11: restrained observatory styling, explicit glyph names, distinct sign/house encoding, active legends and strongest selection | [runtime](../../src/lib/scene/runtime.ts), [App legends](../../src/App.svelte), [hover design review](M10-hover-design.md), [M10 performance/visual review](M10-performance.md) | Present; aspect palettes identify type rather than good/bad or strength. M10's deliberately expressive cards remain separate from quiet scene styling. |
| Brief 12; plan 6, 11: keyboard alternatives, visible focus, scalable text, collapsible desktop panels, motion/quality options | [FeatureNavigation](../../src/lib/ui/FeatureNavigation.svelte), [accessibility tests](../../tests/browser/accessibility.spec.ts), [hover workflows](../../tests/browser/m10-hover.spec.ts), [manual kit](../manual-validation.md) | Engineering paths present; native zoom/screen-reader evaluation is not inferred from axe or logical viewport tests. |
| Brief 12; plan 3, 12: coherent pending/error/provisional/undefined state, recovery and privacy | [explorer coordinator](../../src/lib/state/explorer.ts), [preferences](../../src/lib/state/preferences.ts), [worker recovery tests](../../tests/state/worker-recovery.test.ts), [recovery workflows](../../tests/browser/recovery-preferences.spec.ts) | Present; display-only whitelist excludes personal context, and hovering starts no lookup or calculation request. |
| Plan 2, 12–14: reproducible source/data, deployment, CSP, HTTPS configuration, notices, exact corresponding source and branch review process | [release builder](../../scripts/build-release.ts), [server](../../server/production.ts), [source workflow](../../tests/browser/release-source.spec.ts), [CI](../../.github/workflows/ci.yml), [deployment](../deployment.md), [M9](M9.md) | Infrastructure present; final M10 clean artifact/remote acceptance and development merge remain release work, not an inferred pass. No external deployment was requested. |
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
| Body marker/caption, actual sign/degree and house/system, three interpretation roles and qualifiers | Resolver body branch; all 120 sign and 120 house placement combinations; actual body hover workflow | Present. |
| One combined aspect card, all five types, two actual placements, configured orb/departure and distinct sky angle | Resolver/themes; [AspectInspector](../../src/lib/ui/AspectInspector.svelte); actual Sun–Moon strand/orb-crossing test; Venus–Neptune design fixture | Present; no pair-specific invented narrative or source links in the tooltip. |
| Aspect endpoint, longitude anchor, projection and measurement roles | [aspect renderer](../../src/lib/scene/aspect-renderer.ts) descriptors and resolver facts; renderer/domain checks | Present; endpoints retain body cards, measured arc retains pair identity. |
| Tropical sign sector/glyph and constellation distinction | Resolver sign branch, exact 30° interval, existing sign interpretation; Melbourne actual label/placement regression | Present. |
| House surfaces/arcs/labels and boundaries, actual primary/comparison identity | Directed house partition, separate comparison IDs, resolver tests rebinding comparison slots, house renderer tests, actual comparison-cusp regression | Present; full secondary identity and measured cusp survive the real canvas click. |
| ASC/DSC/MC/IC geometry plus new traditional themes | Resolver angle branch, canonical sky references, new four-angle inspector repair/regressions | Frozen baseline omission found; repair is tracked separately rather than concealed by a coverage count. |
| Horizon/compass/ecliptic/equator/meridian/prime vertical/zenith/nadir/poles | Canonical reference definitions and registered compass explanation; runtime role descriptors; reference/resolver tests | Present; geometric-pole undefined state is explicit. |
| Earth/observer geographic and displayed local/UTC context | Resolver requires matching local label instant; App committed observer/time context; ordinary Earth/observer workflow | Present; view motion does not change observer data. |
| Catalogue points including nine support stars | Indexed Points/HYG lookup, combined star map, fixed epoch/proper motion; Mizar/Alcor actual indexed centre-ray test | Present; screen-distance ordering and shader-consistent hidden-side filtering are source-verified. |
| Regions/figures/labels as distinct representations | Region classifier, figure IDs, region/asterism explanation and factual inspector; actual Orion path and region-interior/disabled-region tests | Present; background interior classification is tested separately from the figure/label/edge. |
| Construction elements preserve actual system/stage/element/role | Construction IDs, complete overlap descriptors, stage-filtered navigation; actual Equal C1/ASC overlap regression | Present. |
| Trails/history preserve exact sample or bounded interval, frame, past/future/spanning status and validity | Resolver/time metadata; stale-frame test rejects current-body fallback; navigation/renderer tests and actual historical caption/line tests | Present after explicit history-fact and representation-visibility repairs; old altitude/cusp/time are checked against fixed-fixture calculations. |
| Projected house section/cusp/badge retains projected identity and house interpretation | Earth domain/renderer, primary link helper, 24 keyboard targets; actual section/reciprocal-material tests | Present; radial projection is explicitly distinguished from relocated charts. |
| Geographic line/badge, all 40 body-angle themes, displayed moment and provisional flag | Astro domain and composed 15-entry catalogue; 40-combination resolver tests, Venus AC navigation and Venus MC actual canvas/focus test | Present; full geographic IDs remain distinct from sky-body aliases. |
| Layer toggles/legends work even while disabled, with availability reasons | `LAYER_HELP`, registered supplementary claims, live layer metadata and native controls; exhaustive layer resolver tests | Present; unavailable house projection retains its specific reason without disabling valid lines. |

### Visual and interaction contract

| M10 requirement | Implementation and evidence | Result |
| --- | --- | --- |
| Readable 360–420px HTML card, explicit identity/facts/context, SVG symbols and no hover source details | [HoverCard](../../src/lib/ui/HoverCard.svelte), [FeatureGlyph](../../src/lib/ui/FeatureGlyph.svelte), [design report](M10-hover-design.md), source-free DOM assertions | Present; 410px default, 16px/1.55 body text, viewport cap with scrolling rather than text shrink. |
| Five themed borders, complementary gradients, body-colour medallions, equal dark placement panels, connector and calm measurements | [theme tokens](../../src/lib/domain/hover-card-themes.ts), actual production-component screenshots in design report | Present; all five identities match scene accents and neither placement is visually privileged. |
| Deterministic 8–14 glints, 3–6s cycles, short entrance, no moving text/full-card animation | Twelve bounded CSS/SVG glints; 190ms/4px one-time component entrance; theme tests and rendered animation review | Present; same-target model updates do not remount the card. |
| On/Off persisted preference, motion/Low suppression, static design, hidden-document pause and cleanup | HoverCard visibility listener/media query, App display flags, strict v2 preferences; hover motion/persistence tests and physical idle/resource report | Present in source; source-level hidden-document handling is not a substitute for manual assistive-technology evaluation. |
| Glints masked outside reading interiors, clipped/nonsemantic/noninteractive, no extra canvas/dependency | CSS stacking/gutter placement and `pointer-events:none`; rendered design review | Present. |
| Actual composited contrast ≥4.5:1 body; forced-colour glyph/text/focus distinction | Design report pixel samples: minimum body 16.90:1, secondary panels 9.71:1; small metadata 4.58:1; forced-colour SVG correction | Present with documented sampling/browser limits, not an unsupported all-platform pixel guarantee. |
| Five static previews plus normal/large animated Venus–Neptune example | [AspectCardPreview](../../src/lib/ui/AspectCardPreview.svelte), three committed PNGs and preview workflow | Present; final production-safe fragment entry is a release-owner follow-up after the frozen baseline. |
| Approximately 300ms stable dwell, movement tolerance, grace, 16px-ish offset, flip/shift and stable reading position | [FeaturePreview controller](../../src/lib/ui/FeaturePreview.svelte), strict hover workflows | Present: 300ms, 5px movement tolerance, 18px offset, viewport bounds and resize observation. |
| Move into card, safe corridor, scroll/copy, persistent reading, Escape suppression, no selection/camera mutation | Global HTML portal, wheel isolation, safe-corridor/scroll/Escape and selected-pair assertions | Present; no interactive controls are placed inside the passive tooltip. |
| Clear on drag/cancel/blur/context/view/removal; stationary pointer re-hit after camera/layout/snapshot updates; no idle polling | Runtime demand-render re-hit, lifecycle cancellation, controller reset/suspension and null-model invalidation; camera/context/view tests | Present in inspected source and focused lifecycle tests; removal invalidity retains explicit inspector state. |
| Keyboard same content, correct `aria-describedby`, no focus stealing/live hover announcements | Focus ownership, description restoration, paginated focus tests, inspector semantics; root's deliberate F2 card-focus/scroll/Escape correction | Engineering implementation present; final keyboard-scroll/axe packaged CI is pending and actual screen-reader gate remains open. |
| Reach individual stars/figures/line/house/guide/history targets without thousands of tab stops | [bounded navigation](../../src/lib/ui/feature-navigation.ts), 12-result pages, stage lists, indexed trail navigator and ≤7 history entries; [navigation tests](../../tests/domain/feature-navigation.test.ts) | Present: 2,874 stars, 88 figures, 40 geographic lines, 24 surface features and 12 comparison cusps. |
| 1440×900/1024×768, large text and 200%-equivalent constraints with both panels | Design/hover/performance reports, 720×600 CSS viewport with 32px text and scroll assertions | Actual reported desktop sizes and logical-space constraints are covered; native browser zoom is not falsely claimed. |

### Figures, views and geographic mathematics

| M10 requirement | Implementation and evidence | Result |
| --- | --- | --- |
| Independent default-off figures, stars and official regions | Explorer layers and independent controls; all endpoint switching renderer tests; actual GPU 710-endpoint submission with stars hidden | Present. |
| Pinned modern Western topology/licence/raw bytes, exact HIP→HYG join and support stars | [figure contract](../constellation-figure-data.md), [import](../../scripts/prepare-constellation-figures.mjs), raw vendor source and checksum manifest | Present: 88 figures, 219 polylines, 695 segments, 710 unique endpoints, 701 existing plus 9 support stars; no illustrations. |
| Serpens portions, no unintended duplicates, exact epoch/proper-motion alignment and short spherical arcs | [figure tests](../../tests/scene/constellation-figures.test.ts), shared `catalogueStarDirection`, renderer tests at 1900/J2000/2100 | Present; no second precession or nearest-position endpoint substitute. |
| Distinct close observer-facing Earth, north-up, radius/aspect framing, orbit/no pan/safe zoom and resize | Runtime `frameEarthForPicking`, `viewingDistance`, `applyViewpoint`, `resize`; actual close-Earth re-entry and GPU camera recovery tests | Present; margin 1.2 yields the specified approximate 75–85% globe occupancy, adjusted by available aspect ratio. |
| Explicit Earth entry enables both children; Outside/Observer disable master; filters/style retained; updates never reapply preset | Explorer view revision/preset logic and defaults/state tests; actual re-entry/focus tests | Present; geographic focus and temporary globe picking use internal view transitions without the explicit preset. |
| Shells/0% fresh/fallback/reset, preserve old explicit mode, no numerical change | House/display defaults, v2 migration, both reset actions; [defaults browser tests](../../tests/browser/m10-defaults.spec.ts), preference and membership tests | Present. |
| Independent Earth master/children/opacities/body and angle filters, live encoding | [Earth controls](../../src/lib/ui/EarthProjectionControls.svelte), renderer visibility tests and App legend | Present; celestial longitude-house visibility is independent. |
| Project exact primary partition once into Earth frame; all systems, reverse polar/undefined/degenerate states and ambiguous poles | [Earth domain](../../src/lib/domain/earth-projections.ts), [projection tests](../../tests/domain/earth-projections.test.ts), [contract](../earth-projection-contract.md) | Present; renderer classifies the same directed partition; no comparison fill or relocated-house calculation. |
| Correct inside-region badges, front-side clipping and geographic hit priority/reciprocal focus | Earth renderer analytic globe/partition intersection, local front-face labels, scene label collision layout; transformed-parent/hidden-side renderer tests, actual Earth workflows and geographic crossing/filter/far-side cases | Present; globe/sky fills do not consume a valid geographic section/line hit and independent crossing choices retain their geographic identities. |
| All ten bodily true-latitude AC/DC/MC/IC curves at displayed moment, matching GAST | [astro domain](../../src/lib/domain/astrocartography.ts), native/synthetic tests and contract | Present; geocentric apparent in-mundo/unrefracted convention, no hidden zero-latitude projection, refraction/parallax or fixed natal map. |
| Both hemispheres, equatorial/polar/tangent/circumpolar cases, seams and no fabricated crossings | Conditioned vector terminator, declared singularities, seam splitting; [synthetic tests](../../tests/domain/astrocartography.test.ts) | Present; exact celestial-pole ambiguity is honest. |
| Native reference at range/date examples, AC/DC rise/set, meridian residual ≤1e−6° | [native tests](../../tests/domain/astrocartography-native.test.ts), 320 retained independent native probe samples/hashes and geometric contract | Present; worst recorded altitude 1.1291e−13°, meridian 1.1369e−13°. This is same-model implementation consistency, not independent physical validation. |
| Interpolated geometry follows the true curve without false seam joins | Default ≤2° central steps on great-circle loci, exact same-plane seam intersections and duplicate removal | Present; normalized chord directions remain on the same great circle. The maximum chord radial sagitta is `1−cos(1°)≈0.0001523` of radius, not a new astrological influence width. |
| Astro geography invariant under observer/system/camera/display; house geography depends on actual partition/frame | Pure astro input type, separate dependency keys and reused buffers; domain and renderer invariance tests | Present; surface axes are transformed exactly once under the already rotating Earth group. |
| 15 short sourced entries, all 40 combinations, reused angle themes and ≤180 Almanac-derived words | [content tests](../../tests/content/astrocartography-content.test.ts), 154-word canonical page budget, unchanged-original-claims hash | Present; inspector continuity repair is identified above. No parans, influence bands, city scores or pair-specific predictions were added. |

### Performance, recovery and release

| M10 requirement | Evidence and limit | Result |
| --- | --- | --- |
| ≤50ms p95 after eligibility; no calculation/content/geometry work per pointer; ≤4ms p95 whole picking | [physical performance report](M10-performance.md) and JSON: card 31.4ms; whole picking Earth 2.3ms, Earth+figures 2.2ms, dense Outside 1.7ms; zero worker messages in measured phases | Meets measured host targets; timing includes the real picker and preserves maxima. |
| Default Earth/all 40 lines/houses, figures and dense sky; card effects do not wake scene | Same physical report: default and dense delivered rAF p95 16.7–16.8ms; matched sparkle On/Off; zero additional scene renders while card glints animate | Meets documented RTX desktop scope, not the unperformed integrated-laptop gate. |
| Plateau through hovers/views/dates/layers, bounded DOM, disposal and actual recovery | Four repeated passes with fixed 538 geometries/230 textures/16 programs; ≤12 glints; real context restoration and exact preserved camera | Present; startup/restoration long tasks and shared internal texture bookkeeping are retained rather than hidden. |
| Complete source/content/assets/notices and packaged three-engine workflows, versions and captures | Owner reports 892 source tests/49 files, check 0 errors/warnings, lint, 320 cards/90 sources/96 canonical pages, 53 notice records and assets green | Source results are owner-reported; this audit did not rerun a competing full/GPU suite during release measurements. Exact packaged local/remote runs remain pending below. |
| Exact clean source/archive, new data/notices/version identities and no hover personal-data transmission | Release scripts and source workflow, retained Stellarium/HYG notices/manifests, source archive review | Infrastructure present; updated final artifact evidence is a required release result, not supplied by dev-server screenshots. |

## Pending release evidence and external acceptance

At the initial audit checkpoint, [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18)'s
[CI run 40264649899](https://github.com/buttery-x3/astrology-viewer/actions/runs/40264649899)
was still running its packaged browser phase. The local exact-source
three-engine run was also in progress.
Neither is recorded as a final passing release here.
The release owner subsequently advanced the PR to `0f2ef1e` for documentation,
performance evidence and the production-safe preview fragment. The angle repair
and the later history/runtime/keyboard corrections are additional required
source changes, so a preceding artifact's success must not be silently
relabeled as validation of those repairs. Final packaged local/remote validation
for the complete repaired source is **pending** at report handover.

The planned durable final records are `M10.md` and `M10-browser-validation.json`,
plus the available [source-archive](M10-source-archive.md),
[geographic crossing](M10-geographic-crossings.md) and
[M10 performance](M10-performance.md) records beside this report. The archive
check identifies the earlier `6cfa912` artifact, not the later corrections.
The physical performance source identifies `dc1b846` and its exact source hashes;
later runtime/UI changes must retain that scope or receive updated measurements.
Each record's final status/revision must be
read from those records and the PR, not inferred from this audit's timestamp.
The final source/archive and corresponding served build revision must agree;
normal source changes require a new clean artifact and regenerated checksums.

The five existing external gates remain explicitly open: actual Safari on
macOS, a desktop screen reader, the specified integrated-GPU laptop, moderated
users, and a human editor's claim-to-passage review. The
[release acceptance matrix](../RELEASE_ACCEPTANCE.md) and
[manual protocol](../manual-validation.md) already define them. Agent/source
review, Playwright WebKit, logical zoom and RTX measurements do not close them.

This audit makes no new hosting, browser-support, scientific-validity, legal
clearance or user-evaluation claim. It records implemented engineering scope,
the concrete repairs and the remaining explicit verification boundary.
