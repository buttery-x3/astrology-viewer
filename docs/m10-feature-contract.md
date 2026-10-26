# M10 feature and view contract

An interaction identifies both a semantic entity and the representation actually hit. `FeatureHit` in `src/lib/domain/scene-hit.ts` is the shared transport. Hover state remains independent of selected state. Resolve content from the displayed immutable snapshot, never the pending form/request.

| Representation | Stable hit ID | Parent / context |
|---|---|---|
| Body, sign, angle, sky reference | Existing entity ID | Same entity; role distinguishes measurement endpoints/projections |
| Primary house / cusp | `house:n`, `boundary:n` | Primary system |
| Comparison house / cusp | `house:comparison:n`, `boundary:comparison:n` | Parent `house:n` / `boundary:n`; explicit comparison system |
| Aspect strand / measurement | Existing `aspect:…` ID | Current pair, type, permitted orb |
| Catalogue point | `star:hyg:n` | Catalogue index resolves HYG tuple; fixed-frame epoch policy |
| Region / modern figure | `constellation:ori`, `asterism:ori` | Shared constellation identity, distinct representation |
| Construction element | `construction:…` | Parent boundary; system, construction element ID and role |
| Trail / historic boundary sample | `trail:…`, `history:…` | Parent body/boundary; exact sample time or bounded segment interval and frame |
| Projected house / cusp | `earth:house:primary:n`, `earth:boundary:primary:n` | Primary house/cusp content, Earth representation and globe focus |
| Geographic line | `astro:venus:mc` | Body and one of four angles remain a distinct selectable target |
| Layer control / legend | `layer:…` | Layer purpose, availability and enabled state, even when hidden |

Only lowercase namespace segments appear in selectable IDs. System codes remain typed metadata. Missing/superseded geometry invalidates the hover; no tooltip may invent a replacement result. Historical metadata must not receive a current-placement interpretation.

Explicit Earth-overview entry applies the projection preset and increments `viewRevision`, including re-entry into the same view. Outside/Observer entry disables the master. Layer changes do not apply view presets. Temporary globe picking calls `setViewpoint('overview', false)` and suppresses projected layers without altering saved layer settings. Snapshot and house-display changes never issue a view-entry command.

The preference v2 whitelist adds only `cardSparkles`. Existing v1 choices migrate to v2 in memory and are saved through the existing display-only persistence path. Personal context is excluded. Fresh/fallback and reset defaults use shells with zero radial lift; valid explicit saved house modes remain honored. Both the house-specific reset and global display reset restore zero lift.
