# M10 iteration checkpoint

**Historical checkpoint, superseded.** This records the earlier product-iteration hold. The user subsequently approved the visuals, final validation and M10 development merge. Current results and outstanding gates are in [M10 final validation](M10-final-validation.md); the original evidence and canonical-file contents at this checkpoint remain available in the [recorded revision](https://github.com/buttery-x3/astrology-viewer/blob/7c70d664893d81664a8d47dc4874e98168d79cd8/docs/reports/M10-iteration-status.md).

The features are implemented on [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18). On 26 October 2026 the user requested product iteration before landing and asked to prune repeated broad test runs. Integration is therefore held; main remains untouched.

The approved rectifications are now implemented on [PR #19](https://github.com/buttery-x3/astrology-viewer/pull/19), with separate card and geographic packages reviewed on PRs #21 and #20. The [visual review report](M10-rectification-visual-review.md) records the compact all-family cards, new defaults, clearer line identities and focused evidence. The current step is the user's visual review; no M10/development/main integration or new full release validation has been performed.

Completed evidence remains scoped to the source actually tested:

- 892 source tests across 49 files; type/Svelte checking, lint, content, notices and asset checks pass at the recorded candidate revisions.
- The corrected `da1404f` standalone artifact passes all 78 installed Chrome/Edge workflows, no skips or flaky results, in 6.6 minutes. [Results](M10-browser-validation.json) and [126 rendered matrix records](M10-view-matrix.json) retain exact versions and hashes. Edge 142 is the available older version, not a claim about all current browser versions.
- The [independent archive rebuild](M10-source-archive.md) verifies `da1404f`, all 399 archived source files, 108 release records, revision identity, unchanged WASM and retained data/notices.
- [Native Chrome 200% zoom](M10-native-zoom.md) passes after the later width repair. Its new 504px reflow/Inspector regression, including axe, passes. Existing hover and accessibility workflows also pass.
- The [independent requirement audit](M10-plan-review.md) and data/numerical reports document implemented scope and repaired findings.

The full three-engine packaged workflow for `da1404f` was still running when broad validation was deferred: [run 40268268978](https://github.com/buttery-x3/astrology-viewer/actions/runs/40268268978). Its eventual result must be read from that run; this checkpoint does not invent a pass. The width repair has focused/native validation rather than another full release rebuild.

Picking performance confirmation remains unresolved as explicitly recorded in [the performance report](M10-performance.md). Further stress runs, archive rebuilds and full matrices will wait until the product candidate settles. The existing five external acceptance gates remain open.

Routine CI now runs source/type/lint/content/notice/asset checks. Adding the PR label `full-release-validation` triggers the complete packaged three-engine suite once; leaving the label attached does not run it again on each push. The manual `full_release` workflow input is another route when that workflow is available on the repository's default branch. Superseded runs in the same concurrency group cancel automatically. Regression files and assertions remain intact.
