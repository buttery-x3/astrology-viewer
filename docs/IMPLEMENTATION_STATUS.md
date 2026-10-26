# Implementation status

The approved plan is [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md); the source [design brief](source/spatial_astrology_design_brief.md) is retained for final comparison. The user approved concise interactive construction guides and autonomous defaults, milestone development, reviews, and merges.

M10 is reviewed, validated and merged into pushed `codex/development` through [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18), merge `4bbcf0f88f6b35b18aae4f63653c6b2957fac872`. The complete Linux packaged suite passes 261/261 with all 189 matrix frames for the frozen `6c1a0cb` Git tree. The Windows full run remains 259/261, with both WebKit failures and successful focused follow-ups recorded below. Source, installed/native-browser, physical, latency/cold-load and exact archive evidence retain their actual scopes. The [scope audit](reports/M10-plan-review.md) includes the [rectifications and mode-memory amendment](plans/M10-rectifications.md). Main is unchanged; the five external acceptance gates remain open.

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
| M9 Release validation | Engineering complete and merged; external acceptance open | [PR #12](https://github.com/buttery-x3/astrology-viewer/pull/12), [M9 report](reports/M9.md): 515 source tests, three-engine packaged workflows with corrected quality/matrix reruns, 189 verified matrix frames, exact source/CSP checks, physical desktop scene/UI measurements and measured cold loading |
| M10 Rich hover cards and Earth projections | Engineering complete, independently reviewed and merged; external acceptance open | [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18), [scope audit](reports/M10-plan-review.md), [visuals](reports/M10-rectification-visual-review.md), [view memory](reports/M10-view-layer-memory.md): compact all-family readings, full inspector facts, independent layer memory, clearer aspects/quieter cusps, equal solid geographic curves/markers/key, 75% geographic opacity and shells/0% defaults. Complete Linux suite 261/261 and 189 matrix frames pass. Windows failures/focused follow-ups and all other revision-scoped evidence are retained below. |

The screenshot-driven identity/date follow-up is merged through [PR #11](https://github.com/buttery-x3/astrology-viewer/pull/11), with [evidence](reports/sun-identity-follow-up.md). It adds named Sun/body captions, explicit sign selection and local-first dates without changing calculations. All 42 production browser workflows and remote CI passed. Development includes merge `83f113723f13859c27692ea4e4a113ba776c3c7d`.

## Final M10 validation and integration

The settled product/test candidate is `6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd`,
tree `02970a9f388aa475c656ba9920b05feae92d8d0e`. The complete Linux CI run built
synthetic revision `83f600b3a4e368905325f3cc9422de82bf8dc3a0`; fetched refs confirm
its exact Git tree matches the frozen candidate. These build identities remain
distinct. Terminal CSS checks pass; final browser results and Windows follow-ups
are recorded below. Reviewed head `6c3d64c` merged into development as `4bbcf0f`;
the two trees are identical. Later merge-record documentation changes no product code.

| Recorded check | Result and scope |
| --- | --- |
| Source/type/lint/content/assets/notices | Green ordinary [CI 40281047430](https://github.com/buttery-x3/astrology-viewer/actions/runs/40281047430) at `6c1a0cb`: 906 tests across 50 files; zero type/Svelte warnings; lint, assets, 320 entries/90 sources/96 budgets and 53 notices pass (50 full notices, three shorthand cases). The complete browser run is separate. |
| Complete Linux packaged suite and matrix | [CI 40281143229](https://github.com/buttery-x3/astrology-viewer/actions/runs/40281143229): 261/261 pass, zero skipped/flaky/unexpected cases, in 1,114.637 seconds; all 189 matrix frames pass. See the [final validation report](reports/M10-final-validation.md), [browser JSON](reports/M10-browser-validation.json) and [matrix JSON](reports/M10-view-matrix.json). |
| Supplemental Windows full run and focused follow-ups | Exact `6c1a0cb` artifact: 259/261 pass in 1,261.949 seconds, with both WebKit failures retained. The Orion context-loss stall's cause remains unproved; unchanged repeats pass 3/3 in 26.2 seconds. Test-only pointer re-entry repair `fedd5e9` preserves all assertions and production source; focused repeats pass 9/9, three per engine, in 52.1 seconds on the unchanged artifact. This is not a passing Windows full-run claim. |
| Installed packaged browsers | `a2ef959`: 96/96 pass in 286.3 seconds, 48 each in Chrome 156.0.8078.47 and Edge 142.0.3595.94; zero skips/flaky cases (`.cache/m10-final-installed.json`). Final `6c1a0cb` also passes the affected terminal case in both browsers, 2/2 with no skips/flaky cases (`.cache/m10-final-terminal-installed.json`). |
| Physical performance, idle/resources and recovery | [Report](reports/M10-performance.md), [raw](reports/M10-performance.json), [Git binding](reports/M10-performance-binding.json) at `a2ef959`: picking p95 2.0–2.1ms, reveal p95 29.7ms; plateau 537 geometries/331 textures/15 programs, idle renders zero, exact camera recovery and disposal pass. Actual workloads include default Earth, all forty lines/houses, figures, dense Outside and matched Sun sparkles On/Off. |
| Native Chrome actual 200% zoom | [Initial report](reports/M10-native-zoom-rectified.md) at `79b585b`: eight states/24 full-text previews pass. The [headroom amendment](reports/M10-native-zoom-headroom-amendment.md) at `ca39e0f` passes focused engines 3/3 and both affected actual native states/six previews. Smallest Large relationship height 261.44px, font 14.625px and full prose; no scrolling/clipping/F2 surface. |
| Final packaged UI latency | [`6c1a0cb` samples](reports/M10-ui-latency.json): selection p95 25.9ms/max 53.8ms, warm chart p95 79.4ms/max 95.4ms (30 samples each), normal Moon trail first usable 138.2ms/feedback 4.2ms; zero page errors. Committed UI plus next rAF is measured, not scanout. |
| Cold loading | [Final packaged `6c1a0cb` runs](reports/M10-cold-load.json): 2.3424s, 2.0180s and 2.0609s, 2,344,991 encoded body bytes each, zero errors/blocked requests, under the documented 20Mbps/40ms application-layer profile and five-second target. |
| Exact final archive extraction/install/build | [Final audit](reports/M10-source-archive.md) and [JSON](reports/M10-source-archive.json) verify `6c1a0cb`: 443 source files/50 directories, all 108 manifest records, ordinary build, assets/content/notices and independent locked install pass. Source archive SHA-256 `883420968c5a6d4b4b4a6eff397f5c1fac94d920afc6122079613de76acc3ef3`; manifest SHA-256 `161997ac33ec307a556a8999a9989f7c5f8e69a340364f718a789a5b0eb16c00`. |

The physical run stays bound to `a2ef959`. The [candidate comparison](reports/M10-performance-binding.json)
finds 110 of 111 measured files unchanged at final `6c1a0cb`; only terminal
`HoverCard.svelte` CSS differs, with identical script/template and no picker,
controller or normal 1920×1080 layout change. This is not a new GPU run. Three
cold loads and RTX desktop results do not establish a population percentile or
the reference integrated-GPU laptop result.

| Completed integration item | Recorded result |
| --- | --- |
| Development integration and final status | [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18) merged reviewed head `6c3d64cb409068a50e21450f88549dca26a5223e` as `4bbcf0f88f6b35b18aae4f63653c6b2957fac872`. The remote and local development branches were synchronized and their tree verified against the reviewed head. Final routine [CI 40285339199](https://github.com/buttery-x3/astrology-viewer/actions/runs/40285339199) passes. Main remains `8b45caf0867e20b93cd126871ad38a526672a3c4`; [PR #13](https://github.com/buttery-x3/astrology-viewer/pull/13) remains draft/unmerged. |

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
