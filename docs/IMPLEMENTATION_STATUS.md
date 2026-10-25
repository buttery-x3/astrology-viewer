# Implementation status

The approved plan is [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md); the source [design brief](source/spatial_astrology_design_brief.md) is retained for final comparison. The user approved concise interactive construction guides and autonomous defaults, milestone development, reviews, and merges.

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
| M5 Actual house constructions | Complete; review and integration pending | [M5 evidence](reports/M5.md): 277 tests, 16 browser workflows; independently reconstructed guides validated against 644 native results |
| M6 Aspects and complete inspector | Pending | |
| M7 Timeline and history | Pending | |
| M8 Accessibility, visual quality, recovery | Pending | |
| M9 Release validation | Pending | |

## Verified environment and current decisions

- Node 24.15.0, npm 11.12.1, Windows, desktop browsers.
- Git transport can push the remote; the connected GitHub integration can create/review/merge PRs. The CLI's independent stored token is invalid and is not required.
- Swiss Ephemeris `v2.10.3bfinal`, revision `f4dcd18e8005dde95fd8a8d2312ed12f9accd1b0`, with the two 1800–2399 planet/Moon files, covers the product range.
- An audited browser wrapper lacks the required UTC/TT/UT1 functions. M0 builds an owned minimal binding instead.
- Pinned IANA 2026e with backzone supplies 598 historical identities, independently checked against TZif files. Geographic lookup uses server-only comprehensive geo-tz data; historical uncertainty remains explicit.

Unmeasured budgets and incomplete milestones are not treated as completed acceptance criteria.
