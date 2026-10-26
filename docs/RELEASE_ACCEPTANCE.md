# Release acceptance audit

This audit compares the approved [implementation plan](../IMPLEMENTATION_PLAN.md), [M10 extension](plans/M10-hover-and-earth-projections.md), [rectifications and mode-memory amendment](plans/M10-rectifications.md), and retained [design brief](source/spatial_astrology_design_brief.md). It records engineering evidence separately from acceptance requiring actual people or reference hardware.

The [final scope audit](reports/M10-plan-review.md) reviews settled candidate `6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd`. The complete Linux packaged three-engine suite passes 261/261 with all 189 matrix frames. Source, native/installed-browser, physical, final latency/cold-load and archive evidence retain their recorded scopes; the supplemental Windows failures and focused follow-ups remain explicit below. Development integration through [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18) is **pending execution**. Main remains unchanged.

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
| Stars/local-horizon adaptive trails and discrete cusp history | Separate worker/cache/cancellation, exact current insertion, bounded ghosts and discontinuities; complete Linux three-engine regressions pass; final `6c1a0cb` one-day Moon trail first usable in 138.2ms with feedback in 4.2ms | Reference integrated-GPU and manual comprehension gates |
| Bright stars and actual constellation regions | Pinned HYG and transformed boundaries; sky-data fixtures, retained notices/manifests, release hashes and packaged browser selection | No unresolved engineering gap |
| Definitions, placements, interpretations and evidence roles | 320 engineering-curated cards, 240 placement combinations, 90 sources, claim bindings, canonical word budgets and specific Wikipedia concept navigation; pinned manifests and licence audit | Human claim-to-passage editorial gate; engineering curation is not human sign-off |
| Selection, hover, focus, labels and concise live legends | Shared entity IDs, independent camera, collision layout/leaders and overlap chooser; exact native Sun anchor, committed-snapshot refresh and historical hit identity remain asserted; full inspector retains numerical facts and attribution; complete Linux and installed Chrome/Edge checks pass, with Windows follow-ups recorded below | Manual screen reader/comprehension gates |
| Display preferences, accessibility, privacy and recovery | Whitelisted preferences, independent session-only layer profiles, no personal persistence, bounded streams/watchdogs, generation guards and context recovery; 906 source tests, complete Linux suite and installed browser checks pass | Actual screen reader and reference-device performance |
| Deployable artifact with source access and licensing | Clean-commit builder, independently installed standalone server, HTTPS/proxy policy, exact Git archive, 53 notice records and strict CSP; source identity/archive/calculation workflow passes in all three engines | Actual hosting configuration/HTTPS endpoint is an operator task; no external deployment requested |
| Deterministic QA, honest support and release documentation | Complete Linux suite 261/261 and 189 matrix frames; Windows full run 259/261 with both failures retained and scoped follow-ups. Source, installed/native, physical, latency/cold and exact archive results remain revision-scoped | Development integration pending; untested browser versions remain unverified |
| Moderated comprehension evaluation | Design brief scenarios and plan section 13 | Approximately five visual learners and two experienced users; record real observations and address findings |
| Compact rich hover/focus readings across every feature family | Dedicated preview model preserves full inspector facts/claims, removes technical/current-time tables and repeated geographic boilerplate, and retains historical identity/notices. All families retain rich themes/glints; full prose adapts without scrolling or an F2/tab-stop mode. [Native Chrome](reports/M10-native-zoom-rectified.md), the [terminal amendment](reports/M10-native-zoom-headroom-amendment.md) and complete Linux suite pass; test-only pointer re-entry follow-ups retain all assertions | Screen-reader/comprehension gates remain external |
| Independent constellation stick figures | Pinned Stellarium topology, 88 figures, 710 unambiguous endpoints, nine support stars and shared HYG proper motion; [data contract](constellation-figure-data.md), actual canvas tests and complete Linux suite pass. The Windows Orion stall and unchanged successful repeats remain recorded | Manual figure/region comprehension |
| Distinct close Earth, projected houses and geographic angular lines | Observer-facing globe, linked primary sections, forty body/angle curves, filters, source themes and 320 native samples; equal solid strokes, repeated categorical markers and a matching key preserve line IDs/clipping/overlap. Complete Linux suite and [physical picking](reports/M10-performance.md) pass within their scopes | Reference-device and manual comprehension gates |
| Independent remembered view layers and clear scene hierarchy | Outside starts with aspects and no figures; Earth starts with astrocartography and sections/aspects/figures Off; Observer starts with figures and aspects Off. Return/reselection restores choices; internal focus does not copy whole profiles. Shared appearance/orbs/filters and independent memory pass source, installed and complete Linux regressions | No chart or personal state is duplicated/persisted by view memory |
| Relationship/cusp contrast and distinct house-card meaning | 65% ordinary aspect opacity with 0.8–1.0 closeness modulation and 1.7px core; quieter 22%/25% inactive cusps; 75% initial geographic opacity. Distinct house-card palette has source and complete Linux coverage | No calculation, influence scale or house/sign equivalence is introduced |
| Layered shells/zero-lift defaults and sparkle preference | Versioned display-only migration, valid saved choices preserved, both reset paths consistent; defaults/browser preference regressions | No personal context persisted; retain existing privacy checks |

## Recorded engineering passes

The results below retain their actual revision boundaries. The [file binding](reports/M10-performance-binding.json)
compares final `6c1a0cb` with the physical run at `a2ef959`: 110 of 111 measured
files are identical; only terminal `HoverCard.svelte` CSS differs, with script
and template identical. No picker/controller or normal 1920×1080 layout changed.
This scopes the earlier timing evidence without claiming another GPU run.

| Check | Recorded result and evidence |
| --- | --- |
| Source/type/lint/content/assets/notices | Green ordinary [CI 40281047430](https://github.com/buttery-x3/astrology-viewer/actions/runs/40281047430) at `6c1a0cb`: 906 tests across 50 files, zero type/Svelte warnings, lint and assets pass; 320 entries, 90 sources and 96 canonical budgets pass; 53 notice records pass (50 full notices, three shorthand cases). This is not the complete browser result. |
| Complete Linux packaged suite and matrix | [CI 40281143229](https://github.com/buttery-x3/astrology-viewer/actions/runs/40281143229): 261/261 pass, zero skips/flaky/unexpected cases, 1,114.637 seconds and all 189 matrix frames. Actual synthetic build `83f600b3a4e368905325f3cc9422de82bf8dc3a0` has exactly the frozen `6c1a0cb` Git tree `02970a9f388aa475c656ba9920b05feae92d8d0e`; the two build identities are not relabelled. [Final report](reports/M10-final-validation.md), [browser JSON](reports/M10-browser-validation.json), [matrix JSON](reports/M10-view-matrix.json). |
| Supplemental Windows full run and focused follow-ups | Exact `6c1a0cb` artifact: 259/261 pass in 1,261.949 seconds; both WebKit failures remain recorded. The Orion context-loss stall's cause is unproved; unchanged repeats pass 3/3 in 26.2 seconds. Aspect re-entry test-only `fedd5e9` adds actual pointer movement, preserves production/all assertions, and passes nine repeats (three per engine) in 52.1 seconds. This does not relabel the Windows full run as a pass. |
| Installed packaged browsers | Artifact `a2ef959`: 96/96 pass in 286.3 seconds, 48 in Chrome 156.0.8078.47 and 48 in Edge 142.0.3595.94, zero skipped/flaky cases (`.cache/m10-final-installed.json`). Final artifact `6c1a0cb` passes the affected terminal case in both browsers, 2/2 with no skips/flaky cases (`.cache/m10-final-terminal-installed.json`). |
| Physical card/picking/frame/idle/resources/recovery | [Report](reports/M10-performance.md), [samples](reports/M10-performance.json) and [Git binding](reports/M10-performance-binding.json) at `a2ef959`: reveal p95 29.7ms; four picking workloads p95 2.0–2.1ms; post-warmup plateau 537 geometries/331 textures/15 programs; zero idle canvas renders and exact context-restored camera. These satisfy the ≤50ms/≤4ms targets on this RTX 3060 desktop. |
| Native compact cards at actual 200% zoom | The [initial report](reports/M10-native-zoom-rectified.md) at `79b585b` passes eight states/24 cards. The [terminal amendment](reports/M10-native-zoom-headroom-amendment.md) at `ca39e0f` passes focused engines 3/3 and both affected actual native states/six previews. The smallest relationship is 261.44px high with an unchanged 14.625px font and full prose; no scrolling/clipping/F2 surface. |
| Final packaged UI latency | [`6c1a0cb` samples](reports/M10-ui-latency.json): selection p95 25.9ms/max 53.8ms; warm chart p95 79.4ms/max 95.4ms, 30 samples each; normal Moon trail first usable in 138.2ms with feedback in 4.2ms. No page errors. These measure committed UI plus the next rAF, not physical scanout. |
| Cold loading/first usable scene | [Final packaged `6c1a0cb` JSON](reports/M10-cold-load.json): 2.3424s, 2.0180s and 2.0609s with 2,344,991 encoded body bytes per run and zero errors/blocked requests under the documented 20Mbps/40ms application-layer profile, below five seconds. Three runs are not a population p95 or actual last-mile measurement. |
| Exact final archive install/build | [Final audit](reports/M10-source-archive.md) and [JSON](reports/M10-source-archive.json) verify `6c1a0cb`: 443 source files/50 directories and all 108 release manifest records pass, with independent extraction, locked install, ordinary build, assets/content/notices and exact source/manifest checks. Archive SHA-256 `883420968c5a6d4b4b4a6eff397f5c1fac94d920afc6122079613de76acc3ef3`; manifest SHA-256 `161997ac33ec307a556a8999a9989f7c5f8e69a340364f718a789a5b0eb16c00`. |

## Development integration

Validation is recorded above. The approved integration still requires execution;
the five external gates below retain their own acceptance scope.

| Final item | Pending result |
| --- | --- |
| Development integration and final status | Execute the authorized M10 → `codex/development` integration through [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18), then record the actual merge and final identities in the validation report/status documents. Passing validation is not recorded as execution. Main remains untouched. |

## External acceptance gates

Do not mark these passed without actual evidence:

- A person completes the core flows with a desktop screen reader and records its exact version, browser and findings.
- Actual Safari on macOS is tested before claiming Safari support; Playwright WebKit is separate evidence.
- A recent integrated-GPU laptop at 1080p with at least 8 GB RAM meets the plan's reference-device budgets. The physical RTX 3060 desktop measurements in `reports/M9-scene-performance.md` are useful additional evidence, not a substitute for that device.
- Approximately five visual learners and two experienced astrology users perform the six design-brief tasks. The evaluation measures understanding and usability, not astrological predictive validity.
- A human editor checks the catalogue's claim-to-passage support as required by plan section 10. Engineering/agent curation, schema coverage and working links do not establish that a human review occurred.

No available automated check substitutes for these gates. A verification kit can make them executable without inventing their results.

The M10 additions expand those same sessions: accessible preview descriptions and target navigation, motion/colour modes, constellation-figure versus region comprehension, primary-house projection versus geographic angular lines, and human review of all 320 entries. The completed native-zoom/headroom checks are engineering evidence, not screen-reader sessions. None of the earlier external sessions is inferred to have happened.


## Concrete final-audit fixes

- OrbitControls panning is disabled from construction onward and after viewpoint changes, as required by plan section 6. The camera regression checks that right-drag cannot move the target.
- Blur, lost pointer capture and context loss clear all-button gesture state and residual damping while preserving the exact current camera pose. Camera browser workflows cover both exterior views, observer look, subsequent drags and actual WebGL restoration.
- Browser and worker Zod schemas use the explicit `jitless` setting before construction. The packaged-source workflow checks that real chart calculation succeeds without CSP evaluation violations; the policy allows WebAssembly compilation without allowing JavaScript evaluation.
