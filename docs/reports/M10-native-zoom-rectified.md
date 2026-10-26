# M10 compact cards: final native Chrome 200% zoom

Installed Windows Chrome **156.0.8078.47** passes all **eight** combinations of native window size, Earth/Outside view and standard/Large text on source **`79b585b8007537e41bafefb6f40449fa0e431e45`**. All 24 tested previews retain their complete registered claim text, fit the visible viewport, and provide no internal scrolling or clipped text.

The [structured evidence](M10-native-zoom-rectified.json) records exact source hashes, per-card bounds and claim IDs, keyboard and pointer outcomes, all screenshot hashes, and browser cleanup. This is a new compact-card run; the historical [native zoom report](M10-native-zoom.md) retains its earlier scrollable-card contract and revision.

## Actual browser zoom and source identity

A fresh owned persistent Chrome profile ran headed with `viewport:null`. The validator selected **Page zoom → 200%** through the actual `chrome://settings/appearance` control. Only native window bounds and un-clipped viewport screenshots used CDP. No viewport/device-scale override, CSS zoom, or pinch zoom was applied.

| Native outer window | 100% CSS inner viewport | 200% CSS inner viewport | DPR |
|---|---|---|---|
| 1440×900 | 1424×749 | 712×374 | 1 → 2 |
| 1024×768 | 1008×617 | 504×308 | 1 → 2 |

Outer window dimensions stayed fixed, CSS width halved, and `visualViewport.scale` stayed at 1. At the smaller target, the visual width after its scrollbar was 496.5 CSS pixels and document width was 496 pixels. Header controls, the Inspector button and the opened Inspector fit horizontally in every state.

Eight served Vite `?raw` module hashes matched the checkout; all ten recorded source/data hashes and the Git revision stayed unchanged during the run. The Vite footer retained its startup label `Build 9b625b4`; the served-module and disk hashes bind the actual tested source to the revision above.

## Complete compact readings

The fresh example chart supplied a long **Sun in Capricorn** body card, **Sun sextile Moon** relationship with both full placement readings, and **Venus · AC — Rising** geographic card. Geographic targets were exercised through their feature-navigation controls. Earth aspect strands were temporarily enabled for their semantic preview target and restored before scene capture.

Each preview passed hover retention, exact claim-text comparison against the source registry, all paragraph line bounds, card/wrapper bounds, no scroll or clipping styles, selectable text, keyboard-origin focus and `aria-describedby`, Escape dismissal, description restoration, and no immediate reopening. There is no technical fact footer, routine current-moment timestamp, F2 instruction or scroll-only tab stop. Geographic cards omit the repeated astrocartography introduction. Text selection was exercised through a DOM Range; this run did not modify or inspect the system clipboard.

Standard reading text remained **13 CSS px** and Large text **14.625 CSS px** throughout; native page zoom provided the corresponding physical enlargement. No claim was shortened or font reduced to make a preview fit.

Heights below are CSS pixels at native 200% zoom. All state and card checks passed.

| Native window | Text | View | Sun body | Relationship | Venus AC | Result |
|---|---|---|---:|---:|---:|---|
| 1440×900 | standard | Earth | 232.84 | 259.73 | 157.48 | Pass |
| 1440×900 | standard | Outside | 232.84 | 259.73 | 157.48 | Pass |
| 1440×900 | large | Earth | 253.93 | 302.45 | 169.78 | Pass |
| 1440×900 | large | Outside | 253.93 | 302.45 | 169.78 | Pass |
| 1024×768 | standard | Earth | 268.71 | 262.39 | 175.42 | Pass |
| 1024×768 | standard | Outside | 268.71 | 262.39 | 175.42 | Pass |
| 1024×768 | large | Earth | 294.29 | 285.75 | 210.14 | Pass |
| 1024×768 | large | Outside | 294.29 | 285.75 | 210.14 | Pass |

## Regression found and repaired

The first completed compact run on `bd58cf11c0756201ae4e71cc904a63fae632106b` found the long relationship card below the viewport in the two **1024×768 / 200% / Large** states. Its 480×342.80 CSS-pixel card began at y=12 and ended at y=354.80 against a 308-pixel inner height. That failure remains recorded separately in the ignored cache and in the [before-repair capture](assets/m10-compact-native-200-1024-aspect-before-repair.png).

Repair `13c9e568cbe0237f0a33a205514382a919884578` adds one final measured-height composition after width expansion and the existing dense layout. Both placements use full-width rows with inline headings and a visible “and” connector. The complete original claim paragraphs and enlarged reading font stay intact. A focused native repeat passed before this final eight-state repeat. In the final smallest Large state, the relationship is **480×285.75**, ending at **y=297.75**; the full text fits within the 308-pixel viewport. A targeted browser regression was added for the equivalent 504×308 CSS layout with Large text; this report records the executed native runs.

## Retained captures and cleanup

- Actual settings: [1440](assets/m10-compact-native-200-settings-1440.png), [1024](assets/m10-compact-native-200-settings-1024.png).
- Relationship: [1440 Large](assets/m10-compact-native-200-1440-large-aspect.png), [1024 Large after repair](assets/m10-compact-native-200-1024-large-aspect.png).
- [Full Large body](assets/m10-compact-native-200-1024-large-body.png), [geographic card](assets/m10-compact-native-200-1024-large-geographic.png), [Inspector](assets/m10-compact-native-200-1024-inspector.png), [header and scene](assets/m10-compact-native-200-1024-scene.png).

All 66 original screenshots, served raw sources and full measurements remain in `.cache/m10-native-zoom-rectified/79b585b8-2026-10-26T06-18-50-990Z/`. Selected images above are byte-for-byte copies. The [retained validator](M10-native-zoom-rectified-validator.mjs) defaults to preparation only. This run used its explicit GPU-clearance launch flag and source-revision guard.

No page errors occurred. Chrome closed successfully and the owned profile was deleted after resolved-path containment verification. This report covers installed Chrome native zoom; the separate screen-reader, Safari and other external acceptance gates retain their own scope.
