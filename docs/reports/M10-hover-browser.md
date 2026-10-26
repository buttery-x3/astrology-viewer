# M10 hover integration browser review

Reviewed 26 October 2026 using the live integration app at `http://127.0.0.1:5196`. The strict suite is [m10-hover.spec.ts](../../tests/browser/m10-hover.spec.ts). It contains no skipped tests or engine-specific assertion exemptions. This is a review of the integration working tree, rather than a claim about an immutable release artifact.

All eight workflows passed in Chromium 156.0.8078.4 on Windows, using Playwright 1.64.1 and one worker. The final complete run took 32.8 seconds.

| Workflow | Verified behaviour |
|---|---|
| Calculated body card | Actual Capricorn Sun/example placement; one source-free card; registered claim IDs; measured reveal delay of at least 250ms for the configured 300ms dwell |
| Combined aspect and dismissal | Exactly one aspect and two actual placement sections; sky-angle measurement; pointer transfer into the card; real wheel scrolling; Escape retains the selected pair and does not immediately reopen the card |
| Keyboard and mouse handover | Focused control receives `aria-describedby`; Tab replaces the card while the pointer is inside it; existing descriptions are restored on Escape and when the mouse reveals a different body while the old control retains focus |
| Safe corridor | Crossing another valid body target and moving into the original card before replacement dwell preserves the readable original card |
| Persisted sparkle/motion settings | Card sparkles On animates; Off persists across reload; Low quality, app Reduced motion and OS reduced-motion emulation retain all panels/medallions and four static glints |
| Theme/text layout | All five themes and animated example render; enlarged text is retained; a 720×600 logical viewport and 32px document text keep the production card inside the viewport with scrollable contents |
| Paginated stars | Changing pages focuses the first new star; its HYG identity matches the revealed card and accessible description |
| Support star and geographic line | Additional HYG3752 resolves its own card/inspector; Venus AC retains its full astro-line/earth/line identity and the inspector renders both attributed body and angle entries |

The constrained viewport/text case exercises layout under reduced CSS space and enlarged text. It does not assert that a native browser chrome zoom control or physical display scaling was measured. The normal/large previews and constrained card are attached to the Playwright result.

The initial pagination regression found that focus scrolling generated a stationary pointerover over another star. The focused star was correct while the tooltip described that other star. Root’s controller now preserves focus ownership until actual coordinate movement. The strict matching-HYG/description assertion passes without being weakened. The pointer-crossing regression also passes after the controller retained the original readable card until the replacement target completes its dwell.

The installed Firefox 157.0 and WebKit 27.2 executables both launch successfully. Attempts to navigate the shared development origin fail before application loading (`NS_ERROR_CONNECTION_REFUSED` / `Could not connect to server`), despite Chromium and the local HTTP client reaching the same origin. Those attempts provide no passing Firefox/WebKit application assertions. They were stopped after two connection failures per run; the committed suite retains all eight cases for the release/CI cross-browser run.

ESLint and `tsc --noEmit` pass for the test branch. No App, scene/runtime, package or preference code was changed by this test work. See the separate [visual design review](M10-hover-design.md) for screenshots and composited contrast measurements.

To rerun against an already running integration or release server:

```powershell
$env:RELEASE_BASE_URL='http://127.0.0.1:5196'
$env:PLAYWRIGHT_BROWSERS_PATH='D:\dev\astrology-viewer\.cache\playwright'
npx playwright test tests/browser/m10-hover.spec.ts --config playwright.config.ts --project chromium --workers 1
```

The repository cross-browser config accepts the same `RELEASE_BASE_URL` and includes Chromium, Firefox and WebKit.
