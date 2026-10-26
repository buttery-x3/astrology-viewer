# M10 preview re-entry trace review

The local Windows packaged WebKit run at `6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd`
failed two workflows. This review reads their retained trace ZIPs without running a browser.
Both traces use a 1440 × 900 viewport.

## Aspect preview

In `m10-hover-complete-aspect--c35a7-preserves-its-selected-pair-webkit/trace.zip`,
the initial preview contains all three reading panels and fits in a 460 × 374.15625 card.
After leaving that card, the pair click finishes at trace time 1046800.785 ms and its
selected state is confirmed. The following hover finishes normally at 1047006.407 ms,
but the preview stays absent through the 5000 ms visibility assertion.

The click and subsequent hover both target exactly `(139.5, 399.31)` in an unchanged
button rectangle `(18, 372.3125, 243, 54)`. The trace has no console errors. The
production preview closes on pointer-down, and its pointer-move handler ignores
unchanged coordinates. This input sequence supports a missing real pointer re-entry;
the trace does not capture individual DOM pointer events.

The test now moves the real pointer to `(750, 35)` before hovering the selected pair
again. Every existing assertion, timeout and complete-reading check remains intact.
No production code, forced action or synthetic event dispatch changes.

## Orion workflow

In `m10-earth-a-real-Orion-fig-9adf8-lecting-the-official-region-webkit/trace.zip`,
the Orion selection completes at 926649.589 ms. Its next DOM snapshot has the selected
Orion button and an enabled Focus selected feature button. Focus selector resolution
then stalls for 15041.046 ms. WebGL context loss is reported at 941677.012 ms, followed
by the Three.js context-loss message. The last normal screencast is at 926708.297 ms;
the next frame at 941767.186 ms shows a black central workspace with the header and
timeline remaining visible. No Focus click input is dispatched, and the action log
contains no hidden, unstable or intercepted-target retry.

The trace supports a browser/GPU stall. Its underlying cause remains unresolved;
this review demonstrates no product layout fix. A later unchanged WebKit rerun
against the same 6c1 package passes 3/3, with no skips, failures or retries, in
26.230 seconds. Raw evidence is `.cache/m10-final-orion-repeat.json` in the root
checkout, SHA-256 `28f44af2bf04d436dc5032fd9db46abc0be5643ec37238eaf708b9c4c668d3de`.
The rerun does not erase the original context-loss failure or establish its cause.

## Validation scope

The setup change is limited to the aspect browser test. Targeted ESLint and
`git diff --check` pass. The changed test at source commit
`fedd5e918c9bef6485f50bc0713840e8a6fe79dd` passes all nine focused cases: three each
in Chromium, Firefox and WebKit, with zero skips, failures, flaky results or retries.
Total runner duration is 52.142 seconds. All complete-reading, viewport, Escape,
retained-selection and inspector assertions execute unchanged.

The standalone server is launched from the absolute artifact directory
`D:/dev/astrology-viewer/.cache/releases/6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd`
and its readiness message is checked for that exact revision. The test branch changes
only this test file and this evidence note relative to 6c1; production source,
configuration, scripts and packaged bytes are unchanged. Removing the two inserted
test lines reproduces the original entire test file after newline normalization.
The tested file SHA-256 is
`9d69e0146f6196ee6362fa2473953606b6269ca0b0e1494d1d5e00b7ff253e09`.

Raw focused results are retained at
`.cache/worktrees/m10-final-source-archive/.cache/m10-preview-reentry-unsandboxed-6c1.json`
relative to the root checkout, SHA-256
`d4144f835d690928bdf2503fb21a377690c7b7087fcb85035de943f579630af5`.
An earlier sandbox attempt could not reach the product: localhost navigation was
denied and Firefox profile initialization failed. Its separate raw results remain
at `.cache/m10-preview-reentry-6c1.json` in the review worktree. All owned browser and
server processes from both attempts are closed. These focused results do not claim
that the original local full suite passed; other evidence remains revision-scoped.
