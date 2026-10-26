# Release acceptance audit

This audit compares the approved [implementation plan](../IMPLEMENTATION_PLAN.md), [M10 extension](plans/M10-hover-and-earth-projections.md) and retained [design brief](source/spatial_astrology_design_brief.md). It distinguishes implemented behavior and automated evidence from acceptance that requires people or hardware unavailable to this execution environment. Main remains unchanged; the release candidate is reviewed through development.

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
| Selection, hover, focus, labels and concise live legends | Shared entity IDs, independent camera controls, collision layout and leaders, overlap chooser; Melbourne identity/date follow-up merged in PR #11 and verified in all three packaged engines | Manual screen reader/comprehension gates |
| Display preferences, accessibility, privacy and recovery | Whitelisted preferences, no personal persistence, bounded streams/watchdogs, generation guards, context recovery and axe scans | Actual screen reader and supported-device performance |
| Deployable artifact with source access and licensing | Clean-commit builder, independently installed standalone server, HTTPS/proxy policy, exact Git archive, 53 notice records and strict CSP; source identity/archive/calculation workflow passes in all three engines | Actual hosting configuration/HTTPS endpoint is an operator task; no external deployment requested |
| Deterministic QA, honest support and release documentation | 515 source tests, three-engine packaged workflows and 189-frame matrix; physical scene/UI measurements, three throttled cold loads, retained reports and manual kit | Remote CI/integration results are tracked in PR #12; proposed untested browser versions remain unverified |
| Moderated comprehension evaluation | Design brief scenarios and plan section 13 | Approximately five visual learners and two experienced users; record real observations and address findings |
| Rich hover/focus readings and expressive aspect cards | Shared committed-snapshot resolver, five themes, bounded SVG sparkles, source-free preview and attributed persistent inspector; [target inventory](m10-target-inventory.md), [design review](reports/M10-hover-design.md), [hover workflows](reports/M10-hover-browser.md) | Integrated release validation in M10.5; actual screen reader/zoom and comprehension remain external gates |
| Independent constellation stick figures | Pinned Stellarium topology, 88 figures, 710 unambiguous endpoints, nine support stars, exact shared HYG proper motion; [data contract](constellation-figure-data.md) and [actual canvas workflows](reports/M10-browser-integration.md) | Integrated release validation in M10.5; manual figure/region comprehension |
| Distinct close Earth, projected houses and geographic angular lines | Observer-facing framing, explicit view presets, linked primary sections, forty body/angle curves, filters, source themes and 320 native geographic samples; [geometric contract](earth-projection-contract.md) | Integrated performance/release evidence in M10.5; reference-device and manual comprehension gates |
| Layered shells/zero-lift defaults and sparkle preference | Versioned display-only migration, valid saved choices preserved, both reset paths consistent; defaults/browser preference regressions | No personal context persisted; retain existing privacy checks |

## External acceptance gates

Do not mark these passed without actual evidence:

- A person completes the core flows with a desktop screen reader and records its exact version, browser and findings.
- Actual Safari on macOS is tested before claiming Safari support; Playwright WebKit is separate evidence.
- A recent integrated-GPU laptop at 1080p with at least 8 GB RAM meets the plan's reference-device budgets. The physical RTX 3060 desktop measurements in `reports/M9-scene-performance.md` are useful additional evidence, not a substitute for that device.
- Approximately five visual learners and two experienced astrology users perform the six design-brief tasks. The evaluation measures understanding and usability, not astrological predictive validity.
- A human editor checks the catalogue's claim-to-passage support as required by plan section 10. Engineering/agent curation, schema coverage and working links do not establish that a human review occurred.

No available automated check substitutes for these gates. A verification kit can make them executable without inventing their results.

The M10 additions expand those same gates: accessible preview descriptions and target navigation, actual zoom and motion/colour modes, constellation-figure versus region comprehension, primary-house projection versus geographic angular lines, and human review of all 320 catalogue entries. They do not create a claim that the earlier external sessions have happened.


## Concrete final-audit fixes

- OrbitControls panning is disabled from construction onward and after viewpoint changes, as required by plan section 6. The camera regression checks that right-drag cannot move the target.
- Blur, lost pointer capture and context loss clear all-button gesture state and residual damping while preserving the exact current camera pose. Four camera browser workflows cover both exterior views, observer look, subsequent drags and actual WebGL restoration.
- Browser and worker Zod schemas use the explicit `jitless` setting before construction. The packaged-source workflow checks that real chart calculation succeeds without CSP evaluation violations; the policy allows WebAssembly compilation without allowing JavaScript evaluation.
