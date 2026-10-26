# M10 native Chrome zoom

Installed Chrome 156.0.8078.47 passes eight combinations of native window size, Earth/Outside view and standard/large text after the width repair. Zoom was selected through Chrome's actual Page zoom control in a fresh owned profile. No viewport/device-scale emulation, CSS zoom or pinch zoom was used.

At 1440×900 outer size, DPR changed from 1 to 2 and CSS inner width from 1424 to 712. At 1024×768, DPR changed from 1 to 2 and inner width from 1008 to 504. Native outer bounds remained unchanged.

The original 640px body minimum made the page overflow at 504 CSS pixels and put the Inspector button offscreen. The body now has a 320px minimum. All eight corrected states pass horizontal reflow, header bounds/no overlap, actual Inspector opening, card bounds, pointer scrolling, F2/PageDown/End reading and Escape focus restoration. No page errors occurred. Chrome was closed and its owned profile safely removed.

The [summary](M10-native-zoom-summary.json) and [raw measurements](M10-native-zoom.json) retain the exact working-tree hashes; `app.css` was the uncommitted width repair on `da1404f` during this validation. Fifty native screenshots were collected; eight representative files are retained here. Other paths in the raw record refer to the local ignored capture cache.

- [Actual 200% settings at 1440](assets/m10-native-200-settings-1440.png), [at 1024](assets/m10-native-200-settings-1024.png)
- [1440 Earth](assets/m10-native-200-1440-earth.png), [1440 Outside](assets/m10-native-200-1440-outside.png)
- [1024 Earth](assets/m10-native-200-1024-earth.png), [1024 Outside](assets/m10-native-200-1024-outside.png)
- [Reachable Inspector](assets/m10-native-200-inspector.png), [keyboard scrolling to measurements](assets/m10-native-200-card-end.png)

This is actual Chrome zoom evidence, not a completed screen-reader or Safari evaluation.
