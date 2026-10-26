# M10 release validation and final audit

The frozen product candidate is `6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd`, tree `02970a9f388aa475c656ba9920b05feae92d8d0e`. Subsequent sign-off commits change documentation only. Main remains at `8b45caf0867e20b93cd126871ad38a526672a3c4`; M10 development integration is pending complete browser validation.

## Recorded results

| Check | Result and scope |
| --- | --- |
| Source, types, lint, content, notices and assets | Pass at the final candidate in [CI run 40281047430](https://github.com/buttery-x3/astrology-viewer/actions/runs/40281047430): 906 tests across 50 files, no Svelte/type warnings, 320 entries, 90 sources, 96 canonical budgets, 53 production notice records and all pinned assets. |
| Complete packaged Chromium/Firefox/WebKit suite | Running against the independently installed final artifact locally; 261 cases and the full 189-frame matrix remain pending until the report is complete. |
| Linux CI | [Run 40281143229](https://github.com/buttery-x3/astrology-viewer/actions/runs/40281143229) passed source gates, recovered from a slow browser dependency installation, and is running the complete suite. It is not yet a passing browser result. |
| Installed Chrome and Edge | 96/96 selected packaged workflows pass at `a2ef959`, 48 per channel, without skips or flaky cases. Two focused checks of the later terminal layout pass on the exact final artifact. Chrome 156.0.8078.47 and Edge 142.0.3595.94 were the installed channels; Edge is an older version, not a current/previous-major support claim. |
| Actual browser 200% zoom | [Eight-state/24-card native report](M10-native-zoom-rectified.md) plus the [two affected-state headroom amendment](M10-native-zoom-headroom-amendment.md). Complete registered text, 14.625px Large font, no preview scrolling/clipping, pointer retention, keyboard origin, descriptions, Escape, header and Inspector routes pass. The later smallest relationship card measures 480×261.44 CSS pixels within 504×308. |
| Physical scene and card performance | [Measurements](M10-performance.md) remain bound to `a2ef959`: reveal p95 29.7ms; four picking workloads p95 2.0–2.1ms; zero idle canvas redraws; warmed resources 537 geometries/331 textures/15 programs; actual context restoration and disposal pass. The [111-file binding](M10-performance-binding.json) identifies the sole later terminal CSS delta, absent from these measured 1920px compositions. |
| Exact final packaged latency | [Raw samples](M10-ui-latency.json): selection p95 25.9ms, maximum 53.8ms; warm chart p95 79.4ms, maximum 95.4ms; normal Moon trail feedback 4.2ms and first usable path 138.2ms. These meet the original plan's desktop targets on the recorded RTX 3060 host. |
| Exact final cold loading | [Three fresh contexts](M10-cold-load.json): 2.3424s, 2.0180s and 2.0609s; 2,344,991 encoded body bytes each, aggregate 20Mbps plus 40ms response delay. All are below five seconds, with no page errors or blocked requests. Three runs do not establish a population percentile or real last-mile performance. |
| Independent exact-source rebuild | [Archive audit](M10-source-archive.md): fresh extracted install and ordinary build pass; 443 source files, all 108 release records/encodings, manifests, notices, content and figure topology match. The 392,316-byte numerical WASM is unchanged. |

The production verifier copies the artifact into a fresh OS temporary directory, independently installs its locked production dependencies, and starts its integrity-checked server with lookups disabled. Browser checks use that server, not Vite or the repository's dependency resolution. Timing probes use the same isolated package and record actual served identity. CPU submission, GPU elapsed time, rAF readiness and physical presentation are different quantities; these reports do not claim physical scanout timing.

## Final artifact identity

| Item | Identity |
| --- | --- |
| Source revision | `6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd` |
| Source tree | `02970a9f388aa475c656ba9920b05feae92d8d0e` |
| Corresponding source archive SHA-256 | `883420968c5a6d4b4b4a6eff397f5c1fac94d920afc6122079613de76acc3ef3` |
| Release manifest file SHA-256 | `161997ac33ec307a556a8999a9989f7c5f8e69a340364f718a789a5b0eb16c00` |
| Compact served manifest SHA-256 | `6fc99f2aadfe3f5ced1eadd6bff0c36d323a642197221905191ad3e62bae79db` |
| Numerical WASM SHA-256 | `a2aaedc3f371af501d2dfd61258a8160c873b0df3ea94ad568377df4353fb88e` |

The served manifest is the compact JSON serialization of the same validated manifest, so its byte hash differs from the formatted file. The compiled build label and corresponding source link identify the actual candidate; later report commits are not silently substituted for that tested artifact.

## Review and resolved findings

The [independent scope audit](M10-plan-review.md) compares the approved original [implementation plan](../../IMPLEMENTATION_PLAN.md), [brief](../source/spatial_astrology_design_brief.md), [M10 extension](../plans/M10-hover-and-earth-projections.md) and [rectifications/mode-memory amendment](../plans/M10-rectifications.md). Source, domain assertions, actual canvas picking and final representations support the implemented scope. Five external sessions remain separate from engineering completion.

Separate reviewed packages cover compact cards, geographic line identity, per-view memory, regression adaptations, native zoom and terminal font headroom. The final fixes preserve full prose and source claim IDs, the existing exact Earth camera assertion, numerical inspector checks, actual Sun/Taurus anchors and exact catalogue-star picks. No regression coverage or assertions were deleted to shorten validation. The complete CI command collects all results without early stopping; failures still fail the job.

Two real fit failures are retained at their original revisions: the first native small/Large overflow, then Linux's additional font wrapping. Full-width composition and terminal spacing resolve them without shrinking the reading font or clipping text. Historical reports, older scroll/F2 behavior, previous timing misses and superseded archive identities remain scoped to their actual source.

## Integration and external acceptance

Development integration is pending the complete browser result and final evidence review on [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18). The development-to-main [PR #13](https://github.com/buttery-x3/astrology-viewer/pull/13) remains draft and unmerged.

The five external acceptance gates remain open: actual Safari/macOS, a real desktop screen-reader session, the specified integrated-GPU laptop, moderated visual learners/experienced users, and human claim-to-passage editorial review. Automated tests, native Chrome zoom and RTX desktop measurements cannot substitute for those sessions. See the [acceptance audit](../RELEASE_ACCEPTANCE.md) and [manual protocol](../manual-validation.md).
