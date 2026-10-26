# Implementation status

The approved plan is [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md); the source [design brief](source/spatial_astrology_design_brief.md) is retained for final comparison. The user approved concise interactive construction guides and autonomous defaults, milestone development, reviews, and merges.

The user has approved the M10 visual iteration and authorized complete release validation followed by integration into `codex/development`. Final repaired-source evidence and that integration remain pending at this checkpoint. The [final scope audit](reports/M10-plan-review.md) includes the [rectifications and per-view memory amendment](plans/M10-rectifications.md); earlier reports retain their recorded revision boundaries.

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
| M10 Rich hover cards and Earth projections | Implemented and independently reviewed; final audit repairs/validation and development integration pending | [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18), [final scope audit](reports/M10-plan-review.md), [approved visuals](reports/M10-rectification-visual-review.md), [per-view memory](reports/M10-view-layer-memory.md): compact all-family readings with full inspector facts, independent figures/layer profiles, clearer aspects/quieter cusps, equal solid geographic angles with recurring markers/key, 75% geographic opacity and shells/0% defaults. Earlier source/browser/zoom reports remain historical; final results are tracked below. |

The screenshot-driven identity/date follow-up is merged through [PR #11](https://github.com/buttery-x3/astrology-viewer/pull/11), with [evidence](reports/sun-identity-follow-up.md). It adds named Sun/body captions, explicit sign selection and local-first dates without changing calculations. All 42 production browser workflows and remote CI passed. Development includes merge `83f113723f13859c27692ea4e4a113ba776c3c7d`.

## Final M10 validation checkpoint

The audited product/test baseline is `bd58cf11c0756201ae4e71cc904a63fae632106b`,
tree `421cf3b67a1332f60e764611f589b71604da7ad1` (identical to `ca78c51`).
Final camera-test, house-palette and native-fit repairs are integrated at
`79b585b8007537e41bafefb6f40449fa0e431e45`, tree
`18c7dd46a0c22aff1a2218a104b8439c76abe112`, and recorded in the scope audit.
The release owner will bind the final integrated source and artifact
to the actual results below; this checkpoint does not claim completion or merge.

| Required result | Status |
| --- | --- |
| Final source/type/lint/content/asset/notice checks | Pending integrated result record |
| Packaged three-engine workflows, matrix, source/CSP and available installed browsers | Pending final repaired-source run; CI 40278075143 exposed a stale startup assumption in the camera test |
| Actual asserted physical picking/card/frame/idle/resource/recovery workloads | Pending final measured result; earlier successful and failed measurements remain revision-scoped |
| Final archive identity and independent extracted install/build | Pending final artifact/rebuild record |
| Current cold loading and actual native 200% no-scroll/Large-text checks | Pending final result after native-fit repair |
| M10 integration into `codex/development` | Pending evidence review; main remains unchanged |

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
