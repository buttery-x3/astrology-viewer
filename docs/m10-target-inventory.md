# M10 interaction inventory

This inventory covers semantic rendered targets and their control/list equivalents. The immutable displayed snapshot supplies all calculated context. Hover previews never request ephemeris work or select an object. Source records remain in the inspector; preview paragraphs reuse their exact registered claim IDs.

| Visible target | Identity and deliberate explanation | Keyboard/persistent route |
|---|---|---|
| Ten body markers/captions | `body:*`: body, actual tropical placement, primary house, body/sign/house interpretations, horizon and provisional/pending state | Celestial objects and geometry search |
| Body longitude anchor and latitude projection | Same body identity with explicit representation role; body stays at its real latitude | Body selection, inspector and focus |
| Aspect core/caption/separation arc | `aspect:*`: one aspect-type interpretation plus the two actual body-in-sign interpretations, orb, departure and both longitude/sky angles | Matching-pair buttons and combined attributed inspector |
| Selected aspect endpoints/longitude guides | Body identities with endpoint/anchor/caption-leader/projection roles; separation arc retains the aspect identity | Pair selection, body list and overlap chooser |
| Tropical sectors, boundaries and glyphs | `sign:*`: equal longitude interval, tradition and sign/constellation distinction | Twelve named sign entries |
| Primary house surfaces, shells, volumes, arcs and captions | `house:n`, `boundary:n`: actual system, directed partition, house tradition and indexed-cusp meaning | House and boundary controls |
| Comparison cusp ghosts | `boundary:comparison:n`: comparison representation and actual secondary system; persistent ID remains distinct | Searchable comparison-cusp category |
| Chart angles and sky reference paths/points | `angle:*`, `reference:*`: registered definitions and calculated placements; compass, horizon plane and tangent patch retain specific roles | Named reference list; compass cards link to the horizon inspector |
| Earth surface and observer marker | Geographic context and the matching displayed local/UTC moment | Earth/Observer entries; globe picking remains a separate draft action |
| Catalogue and figure-endpoint points | `star:hyg:n`: indexed HYG identity, magnitude, proper-motion position epoch and fixed J2000 coordinates | Paginated/searchable 2,874-star category, including nine supporting stars; selecting a support star enables its figure presentation |
| Official constellation lines/labels/interiors | `constellation:*`: exact spherical region identity, unequal-region distinction | Named 88-region list |
| Modern Western figure paths/labels | `asterism:*`: figure identity and path/label role, distinct from official region and tropical sign | Searchable 88-figure category and attributed factual inspector |
| Construction lines/intersections/captions | `construction:*`: actual system, boundary, element, stage and registered construction rule | Stage-filtered construction category, live construction legend and metadata-preserving overlap chooser |
| Trail strokes, arrows, ticks and interval captions | `trail:*`: actual stored sample time or explicit approximate interval, frame, past/future/spanning state; no current-placement substitution | Previous/next/time-index trail sample navigator |
| Historical cusp ghosts/captions | `history:*`: actual sample system/time/cusp or jump; undefined samples remain absent with reasons | Bounded history list with discontinuity and omission explanations |
| Globe house fills, cusps and badges | `earth:house:primary:n`, `earth:boundary:primary:n`: current primary chart partition, house tradition and radial-projection explanation | Searchable 24-target geographic-house category; selection links both representations without replacing the geographic ID |
| Forty geographic curves/badges | `astro:body:angle`: rising/setting or upper/lower meridian condition, sourced body/angle themes and displayed moment | Body/angle filters, searchable geographic-line category and overlap chooser; focus uses the transformed surface anchor |
| Layer toggles and live legend entries | `layer:*`: registered layer purpose, enabled state and availability; aspect-type legend entries include that type's tradition | Native checkboxes/buttons, including disabled-layer help |

The overlap chooser carries the full `FeatureHit`, including construction/sample/system/representation metadata. Primary geographic IDs follow the current primary house result when its method changes. A stale historical or comparison selection receives an explicit unavailable inspector instead of falling through to a current body interpretation.

## Intentionally decorative geometry

The atmospheric sky shell/grid, aspect glow copies, selection rings, ordinary displaced-label leaders and decorative card glints do not add semantic hit targets. Their associated marker/core/caption provides the explanation. Coastline/graticule strokes belong to the Earth context rather than separate astronomical entities. Sparkles never intercept pointer input or animate reading-panel interiors. No catalogue star or meaningful construction/comparison object is excluded as decoration.

## Picking and availability rules

Actual visible point/glyph centres precede line and broad-surface hits. Indexed Points are ordered by screen distance, and main-catalogue picks apply their shader's exterior-hemisphere condition. Exact constellation-region classification is a background fallback. Projected surface picking intersects the globe analytically and classifies the same directed primary partition used to build its geometry. Front-side clipping, hidden parents, layer filters and ambiguous projected poles apply to CPU picking as well as drawing.

Selecting a feature can enable its own presentation; focusing a geographic feature does not enable sky houses or change the primary inputs. Camera synchronization and temporary globe picking do not issue an explicit view-entry preset. Each view remembers its complete reference-layer profile independently for the session. First entry uses that view's defaults: Earth enables geographic lines with projected houses off, Outside disables Earth projections and asterisms with aspects on, and Observer enables asterisms with Earth projections and aspects off. Returning to or reselecting a view preserves deliberate layer choices. See the [view-memory amendment and focused evidence](reports/M10-view-layer-memory.md). Validation evidence is recorded in the milestone reports; this inventory alone is not a claim that browser or external acceptance has passed.
