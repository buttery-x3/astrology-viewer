# M10 target and lifecycle review

Reviewed on 26 October 2026 against the integration working tree served at
`http://127.0.0.1:5196`. The review covered App selection and inspector routing,
FeaturePreview lifecycle, scene picking descriptors and overlap choices, and
camera restoration. This supplements the hover design and hover browser reports.

## Findings and verified corrections

The review found the following concrete defects. The integration implementation
corrects each one; no unresolved defect was identified in this review.

| Finding | Correction and evidence |
| --- | --- |
| Changing the trail frame could leave a historical hit whose body alias displayed current body placements. | An unavailable historical selection receives an explicit inspector state. A test selects a Moon trail sample, changes stars to horizon, and rejects a current celestial-body fallback. |
| A card retained while its pointer was inside could survive an explicit viewpoint change or graphics-context loss. | View revisions and suspended scene state explicitly dismiss the card. Tests exercise keyboard viewpoint activation while the pointer reads the card and a canvas context-loss notification. |
| Default overview restoration could reframe the camera after an hour step because restoration reused ordinary resize framing. | Restoration preserves camera pose. A test observes actual WebGL view/projection matrix uploads, steps an hour, loses and restores the actual WebGL context, and compares all matrix entries. |
| An overlap choice could collapse a construction descriptor to its parent boundary. | Choices retain the complete feature descriptor. An actual Equal-house C1/ASC canvas overlap opens the construction explanation, including its stage and intersection claim. |
| Equal-radius catalogue points ordered by ray depth could prefer a nearby off-axis point. | Picking uses indexed vertex positions and distance from the pointer. Actual Observer canvas tests focus Mizar and Alcor separately; hover identifies the exact centred HYG record and the chooser ranks it first while retaining both neighbours. |
| Catalogue points discarded by the outside-sphere shader could remain CPU pick candidates. | Source review confirms the CPU facing test uses the actual indexed, transformed vertex and matches the shader visibility condition. The suite does not claim a separate far-side pixel assertion. |
| A trail segment spanning the displayed instant could be labelled past using only its first endpoint. | Source review confirms classification considers both explicit interval endpoints and reports a spanning interval. |

## Browser evidence

`tests/browser/m10-targets.spec.ts` contains six tests. All six passed together
against the live integration implementation in Chromium in **19.8 seconds**.
The suite uses ordinary application controls and actual canvas interactions; it
does not import application source into the page or add a product testing API.

The camera test transparently observes native WebGL uniform calls, preserving the
original calls. Its recovery step uses `WEBGL_lose_context` and requires the
driver extension rather than skipping the assertion. The separate tooltip-loss
test dispatches the canvas lifecycle event to exercise deterministic dismissal.

The catalogue test uses the natural close pair **Mizar, HYG 65173**, and **Alcor,
HYG 65272**. Each star is selected and focused through the application, then
hovered and clicked at the exact Observer canvas centre. Assertions check both
the hover record and the first overlap choice in both directions. Test
attachments retain the chooser records and an actual GPU frame readback; the
frame must contain more than ten distinct colours.

This is working-tree integration evidence. Final immutable release and Linux
cross-browser execution remain part of the parent release workflow. Earlier
local Firefox/WebKit dev-server transport failures are recorded separately in
`M10-hover-browser.md`; this report does not represent those engines as passing.

## Checks

- Six Chromium target workflows: passed.
- ESLint for the new browser suite: passed.
- TypeScript `tsc --noEmit`: passed.
- Runtime and application source: unchanged by this test/review branch.

Run against an already running integration or release server:

```powershell
$env:RELEASE_BASE_URL='http://127.0.0.1:5196'
$env:PLAYWRIGHT_BROWSERS_PATH='D:\dev\astrology-viewer\.cache\playwright'
node D:\dev\astrology-viewer\node_modules\playwright\cli.js test tests/browser/m10-targets.spec.ts --config playwright.config.ts --project chromium --workers 1 --reporter line
```
