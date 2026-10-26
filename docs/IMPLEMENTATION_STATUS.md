# Implementation status

The approved plan is [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md); the source [design brief](source/spatial_astrology_design_brief.md) is retained for final comparison. The user approved concise interactive construction guides and autonomous defaults, milestone development, reviews, and merges.

The user has approved the M10 visual iteration and authorized complete release validation followed by integration into `codex/development`. Source gates, installed Chrome/Edge workflows, physical performance, cold loading, native zoom and an independent archive rebuild have passed at the recorded revisions. The final terminal CSS checks/complete CI run, exact post-CSS archive identity and development integration remain pending. The [final scope audit](reports/M10-plan-review.md) includes the [rectifications and per-view memory amendment](plans/M10-rectifications.md); earlier reports retain their recorded revision boundaries.

## Branch and review process

- Integration branch: `codex/development`, initially created from `main` at `8b45caf0867e20b93cd126871ad38a526672a3c4`.
- Each milestone uses its own `codex/mN-*` branch and pull request into development.
- Run appropriate checks, conduct an independent review, resolve findings, record results, and merge the tested head into development. Push or fetch the integration state before beginning the next milestone.
- `main` remains unchanged. At completion open a development-to-main PR and review it against both source documents, resolving remaining work on additional branches before calling the plan complete.

## Milestones

| Milestone | Status | Evidence / review |
|---|---|---|
| M0 Feasibility and conventions | Complete and merged | [PR #1](https://github.com/buttery-x3/astrology-viewer/pull/1), [checksum follow-up #2](https://github.com/buttery-x3/astrology-viewer/pull/2), [M0 evidence](reports/M0.md), 37 tests and real browser worker |
| M1 Application foundation | Complete and merged | [PR #3](https://github.com/buttery-x3/astrology-viewer/pull/3), [M1 evidence](reports/M1.md): 53 tests and 3 production browser workflows; remote CI passed |
| M2 Numerical chart and input | Complete and merged | [PR #4](https://github.com/buttery-x3/astrology-viewer/pull/4), [M2 evidence](reports/M2.md): 87 tests and 8 browser workflows; remote CI passed |
| M3 Spatial vertical slice | Complete and merged | [PR #5](https://github.com/buttery-x3/astrology-viewer/pull/5), [M3 evidence](reports/M3.md): 105 tests, 11 browser workflows; remote CI passed |
| M4 House displays and comparison | Complete and merged | [PR #6](https://github.com/buttery-x3/astrology-viewer/pull/6), [M4 evidence](reports/M4.md): 165 tests, 14 browser workflows; remote CI passed |
| M5 Actual house constructions | Complete and merged | [PR #7](https://github.com/buttery-x3/astrology-viewer/pull/7), [M5 evidence](reports/M5.md): 277 tests, 16 browser workflows; independently reconstructed guides validated against 644 native results; remote CI passed |
| M6 Aspects and complete inspector | Complete and merged | [PR #8](https://github.com/buttery-x3/astrology-viewer/pull/8), [M6 evidence](reports/M6.md): 315 tests, 18 browser workflows, 305 sourced cards and CI content gates; remote CI passed |
| M7 Timeline and history | Complete and merged | [PR #9](https://github.com/buttery-x3/astrology-viewer/pull/9), [M7 evidence](reports/M7.md): 365 tests, 23 browser workflows, two trail frames and discrete bounded history; remote CI passed |
| M8 Accessibility, visual quality, recovery | Engineering complete and merged; external acceptance tracked for release | [PR #10](https://github.com/buttery-x3/astrology-viewer/pull/10), [M8 evidence](reports/M8.md): 404 tests, 41 browser workflows and measured software-renderer resource stability; remote CI passed |
| M9 Release validation | Engineering implementation and local artifact validation complete; integration tracked in PR #12; external acceptance open | [PR #12](https://github.com/buttery-x3/astrology-viewer/pull/12), [M9 report](reports/M9.md): 515 source tests, three-engine packaged workflows with corrected quality/matrix reruns, 189 verified matrix frames, exact source/CSP checks, physical desktop scene/UI measurements and measured cold loading |
| M10 Rich hover cards and Earth projections | Implemented and independently reviewed; recorded passes below, final terminal CSS/CI/archive and development integration pending | [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18), [scope audit](reports/M10-plan-review.md), [visuals](reports/M10-rectification-visual-review.md), [view memory](reports/M10-view-layer-memory.md): compact all-family readings with full inspector facts, independent figures/layer profiles, clearer aspects/quieter cusps, equal solid geographic curves/markers/key, 75% geographic opacity and shells/0% defaults. 906 source tests, 96 installed-browser workflows, 24 native-zoom previews, physical budgets, cold loading and an independent archive rebuild pass at their recorded revisions. |

The screenshot-driven identity/date follow-up is merged through [PR #11](https://github.com/buttery-x3/astrology-viewer/pull/11), with [evidence](reports/sun-identity-follow-up.md). It adds named Sun/body captions, explicit sign selection and local-first dates without changing calculations. All 42 production browser workflows and remote CI passed. Development includes merge `83f113723f13859c27692ea4e4a113ba776c3c7d`.

## Final M10 validation checkpoint

The settled product/test candidate is `a2ef959acc4cf42526245ef0362b70ac5e2f4056`,
tree `7f7a49647f10c3d2e384845a8edbec178379e9ec`, with reporting/CI changes through
`5ce72d9`. Results retain their actual source/artifact identities. Later terminal
CSS repair `ca39e0f` changes only full-width aspect line height/padding, preserving
reading fonts/prose and normal 1920×1080 layout. This checkpoint does not claim
engineering completion or development merge.

| Passed check | Recorded result |
| --- | --- |
| Source/type/lint/content/assets/notices | [CI 40279259335](https://github.com/buttery-x3/astrology-viewer/actions/runs/40279259335), head `3c3a43f2f1ff55ef75c9f10264119bb338249147`: 906 tests/50 files; zero type/Svelte warnings; lint, assets, 320 entries/90 sources/96 budgets and 53 notices pass (50 full notices, three shorthand cases). The later browser failure is retained below. |
| Installed packaged browsers | `a2ef959`: 96/96 pass in 286.3 seconds, 48 each in Chrome 156.0.8078.47 and Edge 142.0.3595.94; zero skips/flaky cases. Local JSON: `.cache/m10-final-installed.json`. |
| Physical performance, idle/resources and recovery | [Report](reports/M10-performance.md), [raw](reports/M10-performance.json), [Git binding](reports/M10-performance-binding.json) at `a2ef959`: picking p95 2.0–2.1ms, reveal p95 29.7ms; plateau 537 geometries/331 textures/15 programs, idle renders zero, exact camera recovery and disposal pass. Actual workloads include default Earth, all forty lines/houses, figures, dense Outside and matched Sun sparkles On/Off. |
| Native Chrome actual 200% zoom | [Compact-card report](reports/M10-native-zoom-rectified.md) at `79b585b`: eight states/24 full-text previews pass, including Large text at 1024×768 outer/504×308 CSS, with no scrolling/clipping/F2 surface. |
| Cold loading | [Packaged `a2ef959` runs](reports/M10-cold-load.json): 2.1524s/2.2854s/1.9796s, 2,345,077 encoded body bytes each, under the documented 20Mbps/40ms application-layer profile and five-second target. |
| Independent archive extraction/install/build | [`a2ef959` audit `58221c9`](https://github.com/buttery-x3/astrology-viewer/blob/58221c98e1da9465c4bb335f47e058237b19bbf9/docs/reports/M10-source-archive.md) passes ordinary build, exact source/manifest, assets/content/notices and independent locked dependency checks. This is the last validated archive, before the terminal CSS change. |

The physical run stays bound to `a2ef959`; it is not relabelled as a later-source
measurement. Three cold loads and RTX desktop results do not establish a
population percentile or the reference integrated-GPU laptop result.

| Remaining engineering item | Pending result |
| --- | --- |
| Terminal CSS and complete three-engine release CI | Linux CI 40279259335 passed 57 browser cases before the new 504×308/Large card reached 318.8px bottom. Record the focused three-engine and two affected actual native checks for `ca39e0f`, then full packaged [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18) CI. `5ce72d9` collects all 261 cases without early stopping or weaker assertions. |
| Exact final archive/identity and development integration | Independently rebuild/verify the post-CSS source archive and record source/tree/manifest identities in the [archive report](reports/M10-source-archive.md), then record M10 → `codex/development`. The earlier archive pass does not prove the later artifact. Main remains unchanged. |

The five [external acceptance gates](RELEASE_ACCEPTANCE.md#external-acceptance-gates)
remain open: actual Safari, desktop screen reader, the specified integrated-GPU
laptop, moderated participants and human claim-to-passage editorial review.
Available automated/native-zoom/RTX checks do not close those sessions.

## Verified environment and current decisions

- Node 24.15.0, npm 11.12.1, Windows, desktop browsers.
- Git transport can push the remote; the connected GitHub integration can create/review/merge PRs. The CLI's independent stored token is invalid and is not required.
- Swiss Ephemeris `v2.10.3bfinal`, revision `f4dcd18e8005dde95fd8a8d2312ed12f9accd1b0`, with the two 1800–2399 planet/Moon files, covers the product range.
- An audited browser wrapper lacks the required UTC/TT/UT1 functions. M0 builds an owned minimal binding instead.
- Pinned IANA 2026e with backzone supplies 598 historical identities, independently checked against TZif files. Geographic lookup uses server-only comprehensive geo-tz data; historical uncertainty remains explicit.

Unmeasured budgets and incomplete milestones are not treated as completed acceptance criteria.
