# M10 feature and view contract

The [approved rectifications](plans/M10-rectifications.md) amend the original presentation contract. Following the user's further mode-memory correction, each view starts with a complete independent layer profile. Outside sphere is the initial view, with aspects on and asterisms/Earth projections off. Earth starts with astrocartography on, projected house sections/aspects/asterisms off. Observer starts with asterisms on and aspects/Earth projections off. Explicit view entry or re-entry restores that view's own layer choices for the current session. All reference layers, aspect visibility and Earth master/child toggles are included; appearance settings, filters and chart calculations remain shared. Geographic opacity starts at 75%.

Hover previews use a separate compact presentation of the resolved model. All feature families receive colour themes and sparkles; previews omit technical measurement/role/current-time tables and the repeated generic astrocartography introduction. Cards fit without scrolling or clipping. Full inspector facts and attribution remain available. Historical sample time/frame and essential qualifications remain explicit. Keyboard previews stay described by their origin; there is no F2 scroll mode or focusable tooltip surface.

All four geographic angle types have equal solid strokes. Repeated categorical pictograms and AC/DC/MC/IC badges identify them, with a matching visible key; body colours retain their identities. Geometry and overlap selection are independent of that decoration.

An interaction identifies both a semantic entity and the representation actually hit. `FeatureHit` in `src/lib/domain/scene-hit.ts` is the shared transport. Hover state remains independent of selected state. Resolve content from the displayed immutable snapshot, never the pending form/request.

| Representation | Stable hit ID | Parent / context |
|---|---|---|
| Body, sign, angle, sky reference | Existing entity ID | Same entity; role distinguishes measurement endpoints/projections |
| Primary house / cusp | `house:n`, `boundary:n` | Primary system |
| Comparison house / cusp | `house:comparison:n`, `boundary:comparison:n` | Distinct comparison selection; current secondary system |
| Aspect strand / measurement | Existing `aspect:…` ID | Current pair, type, permitted orb |
| Catalogue point | `star:hyg:n` | Catalogue index resolves HYG tuple; fixed-frame epoch policy |
| Region / modern figure | `constellation:ori`, `asterism:ori` | Shared constellation identity, distinct representation |
| Construction element | `construction:…` | Parent boundary; system, construction element ID and role |
| Trail / historic boundary sample | `trail:…`, `history:…` | Parent body/boundary; exact sample time or bounded segment interval and frame |
| Projected house / cusp | `earth:house:primary:n`, `earth:boundary:primary:n` | Primary house/cusp content, Earth representation and globe focus |
| Geographic line | `astro:venus:mc` | Body and one of four angles remain a distinct selectable target |
| Layer control / legend | `layer:…` | Layer purpose, availability and enabled state, even when hidden |

Only lowercase namespace segments appear in selectable IDs. System codes remain typed metadata. Missing/superseded geometry invalidates the hover; no tooltip may invent a replacement result. Historical metadata must not receive a current-placement interpretation.

Primary geographic and comparison-slot IDs follow the current primary/secondary result when methods change. Historical construction/trail/cusp hits retain their explicit stored system, frame, element and sample metadata. Overlap choices transport the same complete hit instead of reducing a subfeature to its parent.

Explicit view entry restores its independent profile and increments `viewRevision`, including re-entry into the same view; re-entry reframes without resetting choices. Layer changes update only that view's saved bit. Temporary globe picking and internal focus use `setViewpoint(view, false)`, carrying the currently visible layers without copying those layers into another view's memory. Any subsequent feature/layer command updates only the named destination bit. Snapshot and house-display changes never issue a view-entry command. No personal context or new preferences are persisted by layer memory.

The preference v2 whitelist adds only `cardSparkles`. Existing v1 choices migrate to v2 in memory and are saved through the existing display-only persistence path. Personal context is excluded. Fresh/fallback and reset defaults use shells with zero radial lift; valid explicit saved house modes remain honored. Both the house-specific reset and global display reset restore zero lift.
