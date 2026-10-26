# M10 independent browser integration validation

On 26 October 2026, the Chromium project passed all 14 tests in `m10-earth.spec.ts`, `scene-display.spec.ts` and `spatial.spec.ts` against the live integration server at `http://127.0.0.1:5196`. There were no skipped, flaky or failed tests. The combined run took 57.9 seconds; its compact machine-readable results are in `M10-browser-integration.json`.

This was a live development-server run against the root working tree based on `ce6b3bbb95ef68fddf2a4e11185a537b52e7b568`, including uncommitted M10 integration fixes. It is not an exact-revision packaged-release result. Final committed-source CI and release validation remain separate. The viewport was 1440×900; the existing scene-display suite also requested device scale factor 2. Playwright used the Chromium installation under the project's pinned browser cache. These results do not establish Safari, screen-reader, participant or reference-device acceptance.

The six new workflows verify:

1. Official constellation regions and modern figures toggle independently; actual GPU point submissions retain all 710 figure endpoints with catalogue stars hidden. Enabling the region layer changes the rendered canvas without disabling the figure layer.
2. Re-entering Earth overview restores its close camera pose and geographic-layer preset, including when already in Earth overview, while preserving the displayed moment.
3. A Venus MC target selected from Outside sphere focuses on Earth without re-enabling the user's disabled house sections. Its independently projected geographic anchor can then be selected with a real canvas click.
4. A real Earth house-section click preserves the projected identity. Both that selection and the corresponding sky-house selection submit the distinct selected Earth and sky surface materials to WebGL.
5. A real Orion figure segment, located from the pinned HYG endpoint data, opens the asterism reading and can be selected while the official region layer remains disabled.
6. A real Sun–Moon sextile strand opens one card containing both current body-in-sign interpretations. Canvas selection opens its measured inspector, and reducing the sextile orb removes the eligible strand/card while retaining the selected pair's outside-orb measurements.

The existing regressions now choose body entries explicitly when geographic lines share their names, choose Outside sphere explicitly for the whole-sky Taurus label test, and disable Earth projections explicitly when inspecting the base globe. Hover assertions check the expanded card's title and committed facts. The Taurus regression still verifies the real GPU label submission and its native-frame anchor; no zoom workaround is used.

Validation found two runtime defects fixed by the integration owner: the fixed linked Taurus glyph lost a screen-space collision to the movable Sun caption, and the broad horizon plane incorrectly received point-marker picking priority over a valid aspect-line hit. The final combined run includes their regression checks. Projected-house duplicate identity headings were also corrected by the integration owner.

The test-only WebGL probe observes uploaded matrices and draw calls. Geographic positions use a separate fixed-fixture engine instance. Fixed-sky line picking uses the submitted line model-view matrix because the compiler can optimize the ordinary view matrix away when stars are hidden. Tests wait for the uploaded projection to match the actual canvas dimensions after inspector layout changes. No production diagnostics or source changes were added by this validation branch.
