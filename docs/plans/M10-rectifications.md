# M10 rectifications — compact, expressive cards and clearer view presets

Approved 26 October 2026 against `71b7158`, following the user's review of M10. **Approved for implementation with focused checks and a visual review before full validation or M10 integration.** M10 remains on [PR #18](https://github.com/buttery-x3/astrology-viewer/pull/18), with integration held for product iteration. Main stays untouched.

This amendment supersedes the conflicting card-density, scrolling, decoration and default-view requirements in [the original M10 plan](M10-hover-and-earth-projections.md). All other calculation, selection, content-provenance and layer-independence requirements remain in force.

**Mode-memory amendment, 26 October 2026:** the user's subsequent request replaces shared/carrying layer choices and reapplying partial presets with independent per-view layer memory. The defaults below initialize each mode once per session; returning or reselecting restores that mode's saved toggles. Asterisms start Off for Outside/Earth and On for Observer. Every reference layer, aspect master and Earth projection master/child toggle belongs to its mode. Appearance values, filters and calculations remain shared. See the [implementation and focused checks](../reports/M10-view-layer-memory.md).

## 1. Intended result

Hover cards should give an immediate, visually striking explanation of the thing under the pointer. Every feature family receives a deliberate colour theme, luminous border, complementary gradients, dark reading panels and restrained sparkles. Cards present concise meaning without a technical fact table or an internal scrolling interaction.

Outside sphere becomes the starting view. Relationship strands become easy to distinguish against constellation figures, while house cusps recede. Earth overview opens as an astrocartography view; Observer sky opens with constellation figures and without relationship strands.

## 2. View and layer defaults

| Setting | Outside sphere | Earth overview | Observer sky |
|---|---|---|---|
| Initial application view | **Default** | Available by selection | Available by selection |
| Aspect strands | **On** | **Off** | **Off** |
| Earth projections master | Off | **On** | Off |
| Projected house sections | Off in fresh state; master disabled | **Off** | Master disabled |
| Astrocartography | Master disabled | **On** | Master disabled |
| Constellation asterisms | Initially Off; own memory | Initially Off; own memory | Initially **On**; own memory |

Initialize each mode from the listed defaults. Explicit view selection, including reselecting the current view, restores its saved profile. Manual layer changes remain effective when returning to that mode. Observer asterisms do not carry into Outside/Earth; deliberately enabled Outside/Earth asterisms remain remembered for that mode. Star and constellation-region switches remain independent.

Geographic line opacity starts at **75%**, replacing 55%. Preserve manual opacity and body/angle filter changes across view switches; restore 75% when the relevant appearance settings are reset. House sections start disabled rather than being silently enabled by Earth entry. Retain Layered shells and 0% selected-shell lift.

Use a shared view-preset definition to keep store state, aspect controls, initial scene presentation and visible legends consistent. Currently aspects are local App state while projection presets live in the explorer store; applying only one side would leave the UI and renderer disagreeing. Apply presets only on intentional view entry, not on each snapshot, render, playback tick or ordinary layer change. Temporary globe picking and internal focus transitions retain their existing non-preset route.

## 3. Scene visibility and hierarchy

### Relationship strands

The current default is 18% opacity multiplied by a closeness factor of 0.35–1.0: an unselected relationship can therefore render at approximately **6–18%** opacity before compositing. Increasing the slider alone would still leave wide-orb strands difficult to see.

Proposed starting values for visual tuning:

- Default background strand opacity: **65%**, with the appearance slider supporting the full useful range through 100%.
- Closeness modulation: **0.8–1.0**, giving ordinary default strands approximately **52–65%** opacity. Preserve the ordering that closer-to-exact relationships are brighter, with a much smaller variation.
- Ordinary core width: approximately **1.7 CSS pixels**; hover and selection retain stronger emphasis. Retain the existing aspect colours, glyphs and type patterns.
- Keep unrelated strands intentionally quieter when a body is selected, but avoid the current near-invisibility. Make the selected/related hierarchy explicit and retain deliberate pair isolation.
- Keep glow soft. Judge actual line readability over both constellation figures and region boundaries; do not rely on increasing blur to make a faint core visible.

### House cusp lines

- Reduce ordinary primary sky cusp opacity from **44% to 22%**.
- Reduce inactive comparison cusps from **58% to approximately 25%**; retain the comparison pattern and an even quieter level where explicitly requested by the comparison mode.
- Hovered/selected boundaries remain clearly identifiable, around **80–90%**, without brightening every house boundary.
- This concerns cusp/boundary strokes, not house-fill opacity, astrocartography opacity or the independent ASC/MC reference layer. Keep house labels legible and hit areas usable.

The numeric strand/cusp choices are starting design tokens. The acceptance criterion is visible relationship priority in the actual dense scene, without losing the distinction between inactive and selected geometry.

## 4. A compact card content model

Create a dedicated preview presentation from the resolved feature model. The inspector also consumes that model, so removing data from the shared resolver would unintentionally remove inspectable details. Keep complete calculation facts, source records and registered claims available to the inspector; explicitly choose the small amount shown in a hover preview.

Remove these from all hover previews:

- The **Feature role** row and implementation labels such as **Aspect symbol caption**.
- **Longitude separation**, **Target**, **Departure**, **Configured orb**, and **Actual sky angle**, including their values.
- The routine **Displayed moment** timestamp and its repeated UTC value.
- The technical fact-table footer and the **F2: scroll card** instruction.

Use a small identity line for information needed to understand the feature: a body's sign and house, a house's system, or a geographic line's angle. Retain concise provisional, comparison, undefined-result and previous-snapshot notices when applicable. Historical trails and boundary samples still identify their actual sample time/interval and past/future context; those are feature identity, not the repeated current-moment footer. Measurement projections and construction subfeatures receive a plain-language title where needed to avoid presenting them as a different physical object.

### Relationship card

One compact composition:

> **♀ Venus □ ♆ Neptune · Square**
>
> Competing demands or tension between:
>
> **♀ Venus in ♈ Aries**  
> Affection begins directly and playfully, seeking spontaneity while learning patience beyond pursuit.
>
> **and**
>
> **♆ Neptune in ♑ Capricorn**  
> Practical ideals favor responsible order, while attainable expectations give aspiration a durable structure.

Use actual snapshot placements, with both interpretation panels given equal weight. Reduce the oversized medallion/header area and duplicate name/placement headings. Keep one unobtrusive interpretation label for the relevant reading group rather than repeating it above every paragraph. No orb, angle, timestamp or other measurement footer appears.

### Body and other feature cards

- Bodies: coloured symbol/name, compact sign and house identification, body meaning, body-in-sign and body-in-house interpretations.
- Signs, houses and angles: the relevant interpretation plus the minimum explanation needed to identify the feature correctly.
- Stars, constellations, reference layers, construction and historical features: concise factual explanations and relevant identity/context; do not invent traditional interpretations where none exist.
- Keep every existing meaningful hover target covered, including disabled layer controls, comparison geometry and Earth projections.

### Astrocartography cards

Remove the entire repeated **Geometric context → Traditional interpretation → “Astrocartography associates geographic locations with planetary and angular themes in a natal chart.”** section from every line/badge hover card.

Instead show:

1. Body-coloured icon and **Venus · AC — Rising**, or the corresponding actual body/angle.
2. One short line-specific geometric explanation, such as “Venus is rising across the geometric horizon along this line.”
3. The existing body-line and angle-theme interpretations, without duplicate boilerplate headings.

Keep the generic astrocartography introduction once in its layer help. Preserve full attribution and supporting detail in the inspector. This applies to all 40 body/angle combinations and their line and badge targets.

## 5. No scrolling cards

Both `HoverCard.svelte` and its portal wrapper currently provide scroll containers. Remove scrolling behaviour from both, together with the scroll-only tab stop, F2 focus transfer and scroll hint. Preserve keyboard-triggered previews, `aria-describedby`, hover persistence, text selection/copying, Escape dismissal and correct origin focus.

Initial layout targets:

- Standard body text **13px equivalent (`0.8125rem`)**, approximately **1.35–1.4 line height**; headings around 16–18px.
- Panel padding **8–10px**, section gaps **6–8px**, outer padding approximately **12px**.
- Preferred width approximately **400–460px**, bounded by the available viewport. Adapt composition to available width and height, with compact headers and equal relationship panels.
- Derive the height budget from the visible viewport with approximately 12px edge clearance; place the fully measured card with the existing flip/shift logic.
- Large text and browser zoom continue to enlarge text. Do not counteract them with transforms, progressively shrinking fonts, clipping paragraphs, ellipses or hidden overflow content.

Remove redundancy first so normal cards fit with their complete interpretations. For constrained-height/zoom layouts, provide deliberately authored, source-linked concise preview variants when necessary. They must remain complete sentences, preserve both sides of an aspect and all essential qualifications, and retain links to the same underlying claim identities. Full prose stays in the inspector. Do not introduce runtime-generated summaries, accordions, carousels or “more” states inside a hover card.

Update only the preview wording that actually needs a short variant and record it through the existing editorial/source-budget process. Normal desktop cards should not lose their body/sign/house coverage simply to accommodate a smaller layout.

Acceptance means **no vertical or horizontal scrollbar and no inaccessible text**, including on the longest body, relationship and geographic cards. Merely changing `overflow: auto` to `hidden` is not a solution.

## 6. Expressive treatment for every card

Replace the aspect-only theme branch with a theme resolver covering all target families:

| Card family | Colour treatment |
|---|---|
| Bodies and body trails | Existing body identity colour, complementary secondary hue, coloured emblem and luminous border |
| Relationships | Retain the five aspect palettes and both bodies' identity colours |
| Astrocartography | Body palette, with the angle's distinctive icon/label |
| Tropical signs | Consistent sign/element palettes with the named sign and glyph |
| Houses, cusps and Earth house sections | Coordinated house palettes; preserve house number, actual system and comparison identity |
| Sky angles and reference geometry | Deliberate reference palettes and matching symbols |
| Stars, figures and regions | Celestial palettes with explicit star/figure/region identity |
| Layer help and construction | Palette of the layer or feature being explained |

Every family receives coloured borders, complementary gradients, an illuminated emblem and the sparkle treatment. Text stays high-contrast on dark translucent panels. Colours identify the feature; they do not rate its significance or imply a favourable/unfavourable prediction.

Reuse the bounded deterministic glints, repositioned for the more compact headers. Keep sparkles outside reading text, noninteractive and decorative. Respect Card sparkles, reduced motion, Low quality, forced colours and document visibility across every family. The static version must retain its rich colour treatment; animation must not wake the Three.js scene.

Expand the existing visual preview to show representative non-aspect cards as well as the five aspect themes. Inspect those actual cards before rolling out the same layout to every target.

## 7. Equal-weight astrocartography line identities

Current AC and MC curves are both solid. DC and IC are dashed at different spacings, which makes the categories appear to have different prominence.

Use **equal-width, equal-opacity solid curves for all four angle types**, coloured by body. Distinguish angles with repeated, sparse, camera-facing labels and geometric pictograms rather than solid versus dashed importance cues:

| Angle | Label and marker meaning |
|---|---|
| AC | **AC · Rising**, rising-across-horizon pictogram |
| DC | **DC · Setting**, setting-across-horizon pictogram |
| MC | **MC · Upper meridian**, upper-meridian pictogram |
| IC | **IC · Lower meridian**, lower-meridian pictogram |

Give the four pictograms the same footprint and prominence. Show small AC/DC/MC/IC labels at useful intervals along visible arcs, including when the line is not hovered. Collision handling limits clutter; hover/selection always makes the target identity clear. Marker pictograms are categorical symbols, not motion arrows along the globe.

The compact geographic key repeats the actual line/marker styling and states once: **Colour identifies the body; the marker identifies the angle. All four line types have equal visual weight.** Match that language in controls and help; remove the old solid-upper/dashed-lower description.

Keep curve coordinates, date/pole handling, rear-Earth clipping and overlap selection unchanged. Repeated markers share their line's identity and existing hit semantics. Do not displace geographically coincident curves just to separate their decoration; retain the overlap chooser.

## 8. Implementation order and review

After approval, use review branches based on the current M10 work:

1. **View presets and scene contrast:** shared entry presets, Outside startup, Observer figures, Earth defaults, relationship/cusp opacity and control text.
2. **Compact rich previews:** separate preview content from inspector facts, remove boilerplate/scrolling, compact layouts, all-family colour/sparkles and representative visual gallery. Review the visual result early.
3. **Geographic line identity:** equal-weight strokes, recurring angle markers, matching key and line-specific cards. This can proceed in parallel with card layout work using separate files/worktrees.
4. **Integration review:** reconcile branches, inspect the requested scenarios and update the M10 contract, target inventory, manual validation and acceptance documents to this amended scope.

Likely touch points: `state/explorer.ts`, `App.svelte`, `domain/aspect-presentation.ts`, `domain/earth-projections.ts`, `scene/aspect-renderer.ts`, `scene/house-renderer.ts`, `scene/earth-projection-renderer.ts`, card/theme domain modules, `HoverCard.svelte`, `FeaturePreview.svelte`, preview fixtures and the related controls/legend.

Push each package for review under the established process. Keep PR #18 unmerged until the product iteration is ready; then review and merge the M10 work into `codex/development`. Do not merge the development-to-main PR.

## 9. Focused validation only during this pass

- Preset checks: fresh start, explicit view changes/re-entry, manual overrides, snapshot updates and temporary globe picking.
- Renderer checks: opacity ordering, readable ordinary aspects, quieter cusps, all four equal-weight geographic categories and shared marker/line selection.
- Preview checks: removed data absent; inspector retains it; body/sign/house and both aspect placements correct; repeated astro introduction absent; all families themed and motion preferences honoured.
- A small browser pass over the actual Melbourne chart: Outside with constellations, Earth with geographic lines, Observer with asterisms; representative long cards at 1440×900 and 1024×768, plus a constrained-height/zoom/large-text spot check.
- Replace obsolete tests requiring a card to scroll with tests requiring all preview content to fit without clipping or scrollbars. Retain their useful keyboard, selection, dismissal, focus and accessibility assertions. Do not weaken unrelated regression coverage.
- Run relevant source/type/lint/content checks for changed files and prose. Do not repeat the full packaged matrix, archive rebuild, cold-load probes or stress suite on each edit.

The previous native-zoom and browser reports remain evidence of their recorded revisions, not proof of this new design. Full release validation and the unresolved picking-performance confirmation remain deferred until the product candidate settles. This amendment does not close those gates.

## 10. Review decisions

There are no blocking questions. The concrete proposed defaults are 65% aspect opacity with a higher visibility floor, 22% inactive primary cusps, 75% geographic lines, approximately 13px compact card text, and equal-weight solid geographic curves distinguished by recurring angle markers. These can be tuned through the next visual iteration without changing the calculation model.
