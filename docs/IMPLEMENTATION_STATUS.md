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
| M1 Application foundation | Complete; review and integration pending | [M1 evidence](reports/M1.md): Svelte shell, scene lifecycle, immutable coordinator, validated commands, CI; 52 tests and 3 production browser workflows |
| M2 Numerical chart and input | Pending | |
| M3 Spatial vertical slice | Pending | |
| M4 House displays and comparison | Pending | |
| M5 Actual house constructions | Pending | |
| M6 Aspects and complete inspector | Pending | |
| M7 Timeline and history | Pending | |
| M8 Accessibility, visual quality, recovery | Pending | |
| M9 Release validation | Pending | |

## Verified environment and current decisions

- Node 24.15.0, npm 11.12.1, Windows, desktop browsers.
- Git transport can push the remote; the connected GitHub integration can create/review/merge PRs. The CLI's independent stored token is invalid and is not required.
- Swiss Ephemeris `v2.10.3bfinal`, revision `f4dcd18e8005dde95fd8a8d2312ed12f9accd1b0`, with the two 1800–2399 planet/Moon files, covers the product range.
- An audited browser wrapper lacks the required UTC/TT/UT1 functions. M0 builds an owned minimal binding instead.
- Full pinned Moment rules supply the initial adapter; pre-1970 historical identity needs explicit limitation/provenance and fixture coverage.

Unmeasured budgets and incomplete milestones are not treated as completed acceptance criteria.
