# Release acceptance audit

This audit compares the approved [implementation plan](../IMPLEMENTATION_PLAN.md), [M10 extension](plans/M10-hover-and-earth-projections.md), [rectifications and mode-memory amendment](plans/M10-rectifications.md), and retained [design brief](source/spatial_astrology_design_brief.md). It distinguishes implemented behavior, pending exact-source engineering validation and acceptance requiring actual people or reference hardware.

The [final scope audit](reports/M10-plan-review.md) reviews product/test baseline `bd58cf11c0756201ae4e71cc904a63fae632106b` and final camera-test, house-palette and native-fit repairs integrated at `79b585b8007537e41bafefb6f40449fa0e431e45`. The user approved the visuals and authorized full validation followed by M10 integration into `codex/development`. Final repaired-source results and that integration remain **pending** here. Main remains unchanged.

| Requirement | Implementation and durable evidence | Remaining release work |
| --- | --- | --- |
| Desktop spatial application; one sky, keyboard and mouse | Svelte/Vite/Three, scene runtime, native controls and searchable objects; packaged three-engine workflows and corrected quality/matrix checks in `reports/M9.md` | Manual screen reader and moderated comprehension gates |
| Birth moment, globe picking, place search and manual fallback | `MomentForm.svelte`, scene globe picker, birth/explorer stores; bounded production lookup API, quotas, TLS/proxy policy and privacy headers; location/globe/server/recovery tests | Deployment operator selects provider and supplies its server-only configuration |
| Immutable birth anchor versus exploration | Birth-context store, distinct return/restore actions; birth-context, location and timeline tests | Moderated comprehension gate |
| 1900–2100, Gregorian validity and historical civil time | Civil-time/historical-timezone tests, explicit folds/gaps/overrides and provenance | Retain documented uncertainty, future rule and leap-table limitations |
| Ten bodies, apparent geocentric tropical coordinates and genuine latitude | Owned Swiss WASM, native fixtures, coordinate round trips and rendered positions; 80 fresh-engine JPL comparisons with retained responses and time-policy differences in `reports/horizons-validation.md` | No unresolved engineering gap; retain stated model/time-policy limits |
| Seven houses; indexed longitude membership; valid or honestly undefined | Domain models, native polar fixtures, membership tests and packaged polar cases; 63 actual rendered frames per engine in `reports/M9-view-matrix.json` | No unresolved engineering gap; actual Safari/device gates remain |
| Three displays, independent membership and comparison ghosts | House geometry/renderer, boundary/volume/shell tests and packaged three-engine matrix; unchanged body vectors and distinct rendered modes | Moderated comparison/comprehension gate |
| Actual constructions and concise interactive guides | Independent guide builders, 644 native results, residual report M5 and seven-method workflows in all three engines | No unresolved engineering gap; manual comprehension remains |
| Five aspects, editable orbs, actual relation versus longitude measure | Aspect domain/presentation/renderer, inspector and source cards; packaged interaction checks in all three engines | Moderated comprehension gate |
| Timeline, reverse/play/step/scrub and minutes-to-years intervals | Timeline domain/controls, bounded playback, calendar steps, original anchor; packaged timeline workflows in all three engines | No unresolved engineering gap; manual accessibility/comprehension remain |
| Stars/local-horizon adaptive trails and discrete cusp history | Separate worker/cache/cancellation, exact current insertion, bounded ghosts and discontinuities; packaged tests in all three engines; normal warm path measured at 80.9 ms | Reference integrated-GPU and manual comprehension gates |
| Bright stars and actual constellation regions | Pinned HYG and transformed boundaries; sky-data fixtures, retained notices/manifests, release hashes and packaged browser selection | No unresolved engineering gap |
| Definitions, placements, interpretations and evidence roles | 320 engineering-curated cards, 240 placement combinations, 90 sources, claim bindings, canonical word budgets and specific Wikipedia concept navigation; pinned manifests and licence audit | Human claim-to-passage editorial gate; engineering curation is not human sign-off |
| Selection, hover, focus, labels and concise live legends | Shared entity IDs, independent camera, collision layout/leaders and overlap chooser; exact native Sun anchor, committed-snapshot refresh and historical hit identity remain asserted; full inspector retains numerical facts and attribution | Final revised browser execution; manual screen reader/comprehension gates |
| Display preferences, accessibility, privacy and recovery | Whitelisted preferences, independent session-only layer profiles, no personal persistence, bounded streams/watchdogs, generation guards and context recovery | Final integrated checks; actual screen reader and reference-device performance |
| Deployable artifact with source access and licensing | Clean-commit builder, independently installed standalone server, HTTPS/proxy policy, exact Git archive, 53 notice records and strict CSP; source identity/archive/calculation workflow passes in all three engines | Actual hosting configuration/HTTPS endpoint is an operator task; no external deployment requested |
| Deterministic QA, honest support and release documentation | Historical M9 source checks, three-engine workflows, 189-frame matrix, physical scene/UI measurements and three throttled cold loads remain recorded at their revisions; final M10 checks are tracked below | Final repaired-source counts, runs, artifact identity and development integration pending; untested browser versions remain unverified |
| Moderated comprehension evaluation | Design brief scenarios and plan section 13 | Approximately five visual learners and two experienced users; record real observations and address findings |
| Compact rich hover/focus readings across every feature family | Dedicated preview model preserves full inspector facts/claims, removes technical/current-time tables and repeated geographic boilerplate, and retains historical identity/notices. All families have rich themes/glints; 13px-equivalent full prose adapts through measured composition without scrolling or an F2/tab-stop mode; [rectification review](reports/M10-rectification-visual-review.md) | Final actual 200% zoom and packaged checks after native-fit repair pending; screen-reader/comprehension gates remain external |
| Independent constellation stick figures | Pinned Stellarium topology, 88 figures, 710 unambiguous endpoints, nine support stars and shared HYG proper motion; [data contract](constellation-figure-data.md), actual canvas tests and per-view defaults | Final packaged execution; manual figure/region comprehension |
| Distinct close Earth, projected houses and geographic angular lines | Observer-facing globe, linked primary sections, forty body/angle curves, filters, source themes and 320 native samples; equal solid strokes, repeated categorical angle labels/pictograms and a matching key preserve line IDs/clipping/overlap; [contract](earth-projection-contract.md) | Final exact-source performance/release evidence; reference-device and manual comprehension gates |
| Independent remembered view layers and clear scene hierarchy | Outside starts with aspects and no figures; Earth starts with astrocartography and sections/aspects/figures Off; Observer starts with figures and aspects Off. Return/reselection restores that mode's choices. Internal focus/picking does not copy whole profiles. Appearance/orbs/filters stay shared; [memory review](reports/M10-view-layer-memory.md) | Final integrated regression results pending; no chart or personal state is duplicated/persisted by view memory |
| Relationship/cusp contrast and distinct house-card meaning | 65% ordinary aspect opacity with 0.8–1.0 closeness modulation and 1.7px core; quieter 22%/25% inactive cusps. Geographic opacity starts at 75%. Final house-palette correction avoids sign-element colour cycling | Final integrated source and rendered evidence pending; no calculation, influence scale or house/sign equivalence is introduced |
| Layered shells/zero-lift defaults and sparkle preference | Versioned display-only migration, valid saved choices preserved, both reset paths consistent; defaults/browser preference regressions | No personal context persisted; retain existing privacy checks |

## Pending final engineering evidence

These are available engineering checks, separate from the five external gates.
The release owner must replace pending entries with the actual final repaired
commit/artifact, command or CI run, result and durable report link before making
an engineering-complete or development-integration claim.

| Final result to record | Status / evidence boundary |
| --- | --- |
| Source/type/lint/content/assets/notices | **Pending final integrated result record**; earlier test totals remain historical. |
| Packaged Chromium/Firefox/WebKit workflows, system/display/view matrix and source/CSP checks | **Pending repaired-source run** on [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18). Run 40278075143 exposed a stale camera-test startup assumption and is not a passing final run. |
| Physical card/picking/frame/idle/resource/recovery measurements | **Pending final result** with actual asserted workloads. The prior [performance report](reports/M10-performance.md) records an older success and later unresolved picking miss; neither closes the current ≤50ms card / ≤4ms picking p95 targets. |
| Exact source archive and independent extracted install/build | **Pending final artifact/rebuild**; the existing [archive record](reports/M10-source-archive.md) verifies `da1404f`, preceding later changes. |
| Current cold-load/first-usable results | **Pending final result** under the documented profile; retain earlier M9 measurements at their original artifact. |
| Native Chrome 200%, Large text, complete cards and accessible panel routes | **Pending final result after native-fit repair**; older native zoom used scrolling/F2 cards. Logical/constrained viewport captures alone do not prove native page zoom. |
| M10 → `codex/development` integration and final documentation identities | **Pending** after evidence review; authorization is not recorded as a completed merge. |

## External acceptance gates

Do not mark these passed without actual evidence:

- A person completes the core flows with a desktop screen reader and records its exact version, browser and findings.
- Actual Safari on macOS is tested before claiming Safari support; Playwright WebKit is separate evidence.
- A recent integrated-GPU laptop at 1080p with at least 8 GB RAM meets the plan's reference-device budgets. The physical RTX 3060 desktop measurements in `reports/M9-scene-performance.md` are useful additional evidence, not a substitute for that device.
- Approximately five visual learners and two experienced astrology users perform the six design-brief tasks. The evaluation measures understanding and usability, not astrological predictive validity.
- A human editor checks the catalogue's claim-to-passage support as required by plan section 10. Engineering/agent curation, schema coverage and working links do not establish that a human review occurred.

No available automated check substitutes for these gates. A verification kit can make them executable without inventing their results.

The M10 additions expand those same sessions: accessible preview descriptions and target navigation, motion/colour modes, constellation-figure versus region comprehension, primary-house projection versus geographic angular lines, and human review of all 320 entries. Current native zoom remains an engineering check above; a completed zoom check does not establish a screen-reader session. None of the earlier external sessions is inferred to have happened.


## Concrete final-audit fixes

- OrbitControls panning is disabled from construction onward and after viewpoint changes, as required by plan section 6. The camera regression checks that right-drag cannot move the target.
- Blur, lost pointer capture and context loss clear all-button gesture state and residual damping while preserving the exact current camera pose. Camera browser workflows cover both exterior views, observer look, subsequent drags and actual WebGL restoration.
- Browser and worker Zod schemas use the explicit `jitless` setting before construction. The packaged-source workflow checks that real chart calculation succeeds without CSP evaluation violations; the policy allows WebAssembly compilation without allowing JavaScript evaluation.
