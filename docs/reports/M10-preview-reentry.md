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
this review demonstrates no product layout fix and does not establish a passing
Orion workflow. An unchanged scoped rerun is required to investigate it further.

## Validation scope

The setup change is limited to the aspect browser test. Targeted ESLint and
`git diff --check` pass. Browser validation is pending coordinated access to the active
browser window; earlier or remote passes remain revision-scoped.
