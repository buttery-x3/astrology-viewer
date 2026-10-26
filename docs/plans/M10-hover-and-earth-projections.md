# M10 — Rich hover cards, constellation figures, and Earth projections

Prepared 26 October 2026 against development `36d3df1`. **Proposed implementation plan; no M10 application changes have been made.** This extends the approved [implementation plan](../../IMPLEMENTATION_PLAN.md) and retains its desktop mouse/keyboard, calculation, privacy, and review conventions.

The user's screenshot specifies the desired close, observer-facing Earth composition. The linked Almanac article is a reference for astrocartography explanations, not a calculation specification or an instruction to reproduce its images/text. The user's subsequent requirements set the default house rendering to **Layered shells**, with **Lift selected shells: 0%**, and make aspect cards a visual centrepiece with themed borders, complementary gradients, translucent dark reading panels and animated sparkles.

## 1. Outcome and scope

Make hovering the fastest way to understand the scene: identify the feature, see its current meaning, and understand its relationships without opening the inspector. Give Earth overview a distinct geographic purpose while keeping Outside sphere as the whole-sky view.

M10 includes:

1. A shared, accessible rich hover-card system for scene features, object-list equivalents, reference-layer controls, and legends.
2. One coherent aspect card combining the aspect's meaning with both bodies' actual sign placements and their existing interpretations.
3. An independent **Constellation asterisms** layer showing catalogue-aligned stick figures.
4. A close Earth overview, framed around the current observer like the supplied screenshot.
5. An **Earth projections** layer with independent **House sections** and **Astrocartography** sublayers, including hoverable labels and geometry.
6. Layered shells and zero selected-shell lift as the initial/reset house-display defaults.

Keep Svelte, Vite, TypeScript, Three.js, and the current Swiss Ephemeris snapshots. No additional calculation service, globe framework, or runtime text-generation service is needed.

## 2. Rich hover cards

### Visual structure

Render readable HTML above the canvas, using the application's dark background and a consistent SVG icon family. Give aspect cards the expressive treatment specified below; other cards share the typography, panel shapes and icon language with quieter decoration. Start with 360–420 px cards, 15–16 px body text, approximately 1.5 line spacing, generous section spacing, and a small type label. Fit within the available viewport at browser zoom and large-text settings; never shrink text to force a fit.

Each card has:

- **Identity:** icon, explicit name, and feature type. Distinguish a body, tropical sign, constellation, house, or geographic line by text as well as icon.
- **Essential facts:** only values that help understand the feature, such as sign/degree, house/system, or aspect separation/orb.
- **Explanation:** a concise geometric explanation where needed, followed by clearly labelled traditional interpretation blocks when supported.
- **Context:** compact provisional, comparison-system, historical-sample, or previous-snapshot labels where relevant.

Reuse existing traditional interpretation text and its claim IDs. Omit publisher names, source links, source passages, reuse details, and Wikipedia links from the hover card. Keep these available in the inspector. Do not flatten the inspector's entire content into a tooltip.

Register newly authored layer-help and geometric explanation claims in the existing supplementary claim/source-budget registry as well as registering new interpretation entries. Shared text keeps one underlying claim record even when displayed in several places.

Use custom SVG versions of the existing body, sign, and aspect symbols with consistent stroke weights. Include names alongside symbols. A small diagram may show two body medallions joined by the aspect symbol, or a globe with the relevant line; these are schematic illustrations, not substitute position plots. Create the rich aspect-card finish with gradients, SVG details and lightweight animation; raster illustrations and ornamental paintings remain outside this milestone.

### Aspect-card art direction: luminous colour and depth

Aspect cards should feel spectacular on first reveal and remain comfortable to read. Build a distinct visual composition around each relationship: a luminous border, two complementary pools of colour, prominent planetary medallions, translucent dark reading panels and sparse star glints. These are required design deliverables, not optional final polish.

**Composition, from back to front:**

1. A deep midnight base with two layered radial gradients, concentrated near opposite corners and behind the body medallions. Let vivid colour show through the header, margins and gaps between text blocks; keep a dark centre beneath the reading area.
2. A crisp 1–2 px gradient border, soft outer halo and darker separating shadow, giving the card depth over either a bright globe or dark sky. Use a static glow rather than pulsing the entire card. A small corner accent can repeat the aspect's glyph/pattern.
3. A decorative sparkle layer across the header, perimeter and spaces between panels. Mask it out of the text-panel interiors and clip it to the card so particles never wander into the scene or other controls.
4. A strong header with two outlined planet medallions joined by the aspect symbol and a fine connecting line. Preserve each body's existing identity colour within its own medallion; the outer card theme identifies the aspect type. Render the actual body/sign names in text beside their icons.
5. Interpretation sections on rounded **semi-transparent dark backgrounds**: start around `rgba(7, 12, 24, 0.82–0.92)`, with a subtle inner border and 12–16 px padding. Use warm-white or cool-white text; do not colour whole paragraphs. The aspect summary occupies one panel and the two placement paragraphs occupy connected panels inside the same card, with a small “and” connector. Measurements sit in a compact, calm footer.

Retain the scene's current aspect accent as the recognisable border/glyph anchor, then introduce a complementary secondary hue for the card's gradient. These starting palettes are design tokens to tune in the prototype:

| Aspect | Existing identity accent | Complementary card palette | Visual character |
|---|---|---|---|
| Conjunction ☌ | Lavender `#c5a9df` | Violet `#7042ad` and antique gold `#b58a39` | Two luminous fields meeting behind the central symbol |
| Sextile ⚹ | Teal `#80c5c8` | Deep teal `#166a76` and warm apricot `#c78059` | Light, open highlights with a fine star motif |
| Square □ | Amber `#dfad89` | Copper `#ad572d` and indigo `#49369a` | Strong opposing corners and a clearly defined square emblem |
| Trine △ | Blue `#91b3e4` | Sapphire `#285eac` and warm gold `#bd873c` | Broad flowing colour fields around a triangular connection |
| Opposition ☍ | Rose `#ce97b3` | Plum-rose `#8e3d72` and sea-green `#258a80` | Two distinct luminous ends joined across the header |

The palettes identify relationship types; they are not good/bad ratings. Keep the aspect name and glyph visible in every theme and align any line motif with the scene legend. Do not recolour scene strands solely to accommodate the card decoration. Both placement panels retain equal visual weight.

For the **Venus in Aries □ Neptune in Capricorn** example, show an amber/copper border transitioning to indigo at the opposite corner, a warm glow behind Venus and a cool glow behind Neptune, their existing body-colour medallion rims, and the square symbol between them. Place the two interpretation paragraphs on dark translucent panels. Small gold and lavender glints move around the header and panel edges while the text remains still.

### Sparkle animation and reading comfort

- Animate a small, bounded set of approximately **8–14 decorative points or four-point SVG stars**. Vary size, delay and position using a deterministic seed; only a few should brighten simultaneously. Use slow, staggered opacity changes and very short drift/scale movements, with approximately 3–6 second cycles. Avoid rapid flashes, full-card shimmer, large sweeps over text, and pointer-following particles.
- On first reveal, use a brief 160–220 ms opacity/maximum 4 px entrance transition and a short staggered appearance of the glints. No bounce or moving text. Hovering into the card, changing a numeric value, or receiving a new snapshot must not restart the entrance animation.
- Sparkles may continue gently **only while an aspect card is visible**. Stop and remove their animation resources on dismissal/unmount; pause when the document is hidden. Retain a fully composed static version when animation is off.
- Add **Card sparkles: On / Off** to the existing display controls, with a descriptive accessible label and a display-only persisted preference. Default On where motion is permitted; reduced-motion requests, the app's Reduced motion setting and Low quality suppress the motion. The static version keeps the gradients, border, medallions and a few fixed glints, so it still looks finished.
- Keep particles `aria-hidden` and `pointer-events: none`. They must not participate in hit testing, intercept copying/scrolling, or affect card positioning. Reading panels and text remain above the decorative layer.
- Implement with CSS gradients, SVG and compositor-friendly opacity/transform animation on bounded elements. Do not add another WebGL canvas or a particle-engine dependency. Do not animate expensive full-card blur/filter effects. Card effects must not wake the Three.js scene's render loop.
- Measure text contrast over the actual composited gradient/panel at its brightest state; require at least **4.5:1 for body text**. Increase panel opacity as needed and provide an opaque dark fallback. Validate focus indicators and icons separately; retain text/glyph identification in forced-colour presentation.

M10.1 must include static previews of all five themes and a working animated Venus–Neptune example at normal and large text sizes before applying the treatment broadly. Capture both the expressive and reduced-motion versions for the milestone's visual review.

### Aspect card: the primary design example

The following is a single card, with two visually connected placement sections rather than separate popups. “Aries” is used for the sign in the user's example. Numerical values below will come from the actual snapshot, not this illustration.

> **♀ Venus □ ♆ Neptune**
>
> **Square** · target 90° · measured separation and departure shown here
>
> **Traditional interpretation**
>
> Competing demands or tension between:
>
> **♀ Venus in ♈ Aries**
>
> Affection begins directly and playfully, seeking spontaneity while learning patience beyond pursuit.
>
> **and**
>
> **♆ Neptune in ♑ Capricorn**
>
> Practical ideals favor responsible order, while attainable expectations give aspiration a durable structure.

Implement this for all five supported aspect types, every eligible body pair, and all actual sign combinations. Compose the existing aspect-type and two body-in-sign claims deterministically; a new pair-specific predictive narrative is not required. Show the active configured orb and departure compactly. Preserve the distinction between longitude separation and the actual three-dimensional sky angle. An aspect that leaves the configured orb must cease to appear as a currently active hovered strand.

On hovering the strand, highlight the strand and both bodies. Moving to an endpoint uses the endpoint/body card with its specific role identified. The inspector should reuse the same combined aspect summary so clicking does not lose the explanation just read.

### Coverage contract

Every meaningful visible feature must resolve to a deliberate card model. A generic “content unavailable” fallback is a release failure for an in-scope target.

| Target | Card contents |
|---|---|
| Celestial body / body caption | Name and symbol; current sign/degree and house/system; body meaning, body-in-sign and body-in-house interpretations; applicable provisional/undefined qualification |
| Aspect strand / measurement | Combined card above; exact feature role for a longitude anchor, latitude projection, or measurement arc |
| Tropical sign sector / glyph | Explicit “Tropical sign”; longitude interval; sign interpretation; brief distinction from the named constellation |
| House shell, wedge, arc or label | House number/system, meaning and interpretation; cusp/interval context; primary versus comparison identity |
| House boundary / comparison ghost | Boundary number, actual system and cusp, adjacent-house explanation; comparison status when applicable |
| ASC, DSC, MC, IC | Angle name and measured placement; existing geometric definition plus the newly sourced angle theme described below |
| Horizon, compass, ecliptic, equator, meridian, prime vertical, zenith/nadir, celestial poles | What the reference means and what changes it; relevant values. Use factual explanation where no traditional interpretation exists |
| Earth / observer marker | Geographic context, displayed local/UTC moment, and what observer changes affect |
| Catalogue star | Name/catalogue identity, magnitude and positional context; factual catalogue explanation |
| Constellation region / stick figure / figure label | Name, abbreviation and feature type; distinguish the connected pattern from its official region and from a tropical sign |
| Construction guide element | Actual system, stage and element-specific explanation; preserve timing/projection/intersection identity |
| Body trail / boundary history | Body or boundary, sample time or explicitly approximate segment interval, frame, past/future status and meaning; never silently substitute the current placement for an old sample |
| Projected Earth house section / H1–H12 badge | House interpretation plus “Projected chart house”; observer/system/instant context and the projection's meaning |
| Astrocartography line / badge | Body plus AC/DC/MC/IC, what happens geometrically there, traditional body/angle themes, and displayed-map time |
| Reference-layer toggle / layer legend | Layer purpose, visual encoding, current availability and enabled state; works when the layer is disabled |

Decorative stars/lines that are intentionally nonsemantic must be declared as such in a target inventory. Existing catalogue stars, meaningful construction lines and comparison features are included rather than being silently classified as decoration. Underlying layer toggles and object-list entries supply access when canvas geometry is hidden or unavailable.

### Interaction and accessibility

- Reveal after approximately **300 ms of stable hover**; use a small movement tolerance and a short transition grace period to prevent flickering between nearby targets.
- Anchor beside the pointer/feature, offset by about 16 px. Flip and shift at viewport/panel edges. Keep the chosen position stable while reading; avoid covering the target where space permits.
- Let the pointer move from the feature into the card without dismissing it. Maintain a safe transition corridor; allow scrolling/copying its text without orbiting or zooming the canvas underneath.
- Keep it open while the feature or card is hovered. **Escape dismisses it** and suppresses immediate reopening until the pointer leaves/re-enters. Never time out while someone is reading.
- Hover previews do not change persistent selection, move the camera, or replace a pinned inspector. Clicking the feature retains the normal selection/inspector workflow.
- Clear on drag, pointer cancellation, window blur, context loss, explicit view changes and target/layer removal. Re-resolve against committed snapshots when time changes; never combine requested input with retained geometry.
- Re-evaluate a stationary pointer after camera/zoom movement and layout changes so it cannot retain a card for a feature that has moved away. Coalesce these checks with demand rendering; do not poll while the scene is idle.
- Keyboard focus on an object-list entry or layer control exposes the same content. Enter selects the object and the inspector provides persistent reading. Use appropriate `aria-describedby`/tooltip semantics for passive cards; if an interactive control is added later, use an accessible nonmodal popover rather than placing buttons inside `role="tooltip"`.
- Extend keyboard routes to the new individual targets: searchable star/constellation groups, Earth-house and geographic-line groups, construction-stage/subfeature lists, and a previous/next/time-index navigator for trail samples and boundary history. Use bounded/paginated results rather than thousands of simultaneous tab stops. A layer's purpose card alone is not a substitute for access to its individual targets.
- No automatic focus stealing or live-region announcement on every mouse movement. Large text, reduced motion, keyboard scrolling through the inspector, and disabled/undefined states remain supported.

This follows the dismissible, hoverable and persistent behaviour in [WCAG 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html). Evaluate [`@floating-ui/dom`](https://floating-ui.com/docs/computePosition) for placement/flip/shift/size if it simplifies implementation; pin and audit it if adopted. Keep the interaction state machine in Svelte rather than adding a general component framework.

## 3. Constellation asterisms

Add **Constellation asterisms** alongside **Catalogue stars** and **Constellation regions**. All three controls remain independent. Asterisms start disabled, preserving the current restrained sky until requested.

Use one clearly named modern Western stick-figure convention covering all 88 constellations. Asterisms are drawing conventions, not additional IAU boundaries. Serpens remains one constellation with disconnected figure portions. Shared stars do not merge constellation identities.

Preferred dataset: [Stellarium v26.2 modern sky culture](https://github.com/Stellarium/stellarium/tree/v26.2/skycultures/modern). The read-only planning audit found 88 figures, 219 polylines, 695 segments and 710 unique HIP star endpoints. All endpoints map uniquely to the project's pinned HYG v4.1 catalogue; 701 are already in the bright-star subset and nine fainter support stars are needed (faintest magnitude 6.65).

Implementation must resolve the tag to an immutable commit, retain the exact source bytes/hashes, record the derivation and [sky-culture attribution/licence](https://github.com/Stellarium/stellarium/blob/v26.2/skycultures/modern/description.md), and regenerate a checked-in compact topology/manifest. The inspected text/data licence is CC BY-SA 4.0; import topology only, avoiding separately licensed illustrations. Verify these facts again against the pinned bytes during the import gate.

Resolve HIP→HYG at build time, not by nearest position. Include all supporting endpoints independently of the general star magnitude filter. When Catalogue stars is off, show restrained endpoint dots with the asterism layer so the connected figure remains legible. Turning the asterism layer off removes its extra dots.

Both dots and line endpoints must use the exact same `catalogueStarDirection` and epoch/proper-motion policy. Draw short spherical arcs rather than chords through the sphere. Use restrained lines, with thicker/brighter hover and selected figures, and deduplicated readable names. Maintain Earth occlusion, below-horizon styling and hit-target visibility consistently in all three viewpoints.

## 4. Distinct viewpoints and defaults

### Earth overview

Frame the globe around the **current observer**, with geographic north approximately up, as in the supplied screenshot. Aim for a globe diameter around 75–85% of the scene's available short dimension; tune against 1440×900 and 1024×768 layouts. Keep the observer marker readable and coastlines/land visible under translucent projections.

Use Earth radius and current aspect ratio to calculate framing, not a hard-coded distance. Rotate around Earth's centre, prohibit panning, and stop zooming through the surface. Preserve the current schematic Earth/sky scale and astronomical origins. Switching camera views must not change any chart input.

The sky stays spatially consistent around the close globe. Earth projections get visual priority; sky geometry must not obscure the geographic scene or become a blanket hit target over Earth. Deliberately recenter on explicit Earth-overview selection/reset, not during every snapshot update or while the user is orbiting. Resize preserves a user-adjusted view; default framing adapts when it is still active.

### View-entry behaviour

| Explicit view action | Camera | Earth projections |
|---|---|---|
| Select/reselect Earth overview | Close, observer-facing globe | Master ON; House sections ON; Astrocartography ON |
| Select Outside sphere | Existing whole celestial-sphere framing | Master OFF; Earth sublayers effectively hidden |
| Select Observer sky / Home | Existing local sky view | Master OFF; Earth sublayers effectively hidden |

Layer controls can override the current preset after entry. Keep body/angle filters and styling settings when switching views. The next explicit Earth-overview entry re-enables both sublayers, as requested. Repeated scene updates must never turn a manually disabled layer back on.

Treat temporary globe-picking mode separately: it must not apply the Earth-overview preset, leak projections into picking, or erase saved presentation settings. Existing Home/F shortcuts keep their meaning. New surface objects receive sensible focus targets and cannot send the camera through the globe.

### House rendering defaults

- `DEFAULT_HOUSE_DISPLAY.mode = 'shells'` and `shellSeparation = 0`.
- `DEFAULT_PREFERENCES.houseMode = 'shells'`; initialize every fallback/reset path consistently.
- **Lift selected shells: 0%** remains independently adjustable after startup.
- Preserve valid saved user house-mode choices. Existing v1 preferences do not distinguish an automatically saved old default from an explicit choice, so do not guess and overwrite them. Provide a clear **Reset house display** action applying shells/0% for existing installations as well as fresh sessions.
- Changing display mode or lift never changes house cusps or membership. At zero lift, shared edges must remain free of visible z-fighting.

## 5. Earth projections — two complementary sublayers

Expose one **Earth projections** group with a master toggle, **House sections** and **Astrocartography** child toggles, separate opacity controls, and a compact legend. Turning off celestial Longitude houses must not disable projected Earth houses; turning off either Earth sublayer must not disable the other.

### House sections on Earth

Radially intersect the current chart's constant-ecliptic-longitude house partition with the schematic globe. Reuse the existing seven-system partition and fixed-frame transforms rather than inventing equally spaced geographic wedges. The resulting sections reflect the selected observer, system and displayed instant.

This is a projection of the current chart's houses onto Earth; it does **not** mean every location within that section has that same relocated house chart. State that distinction once in the layer help and briefly in each projected-house card.

Render translucent sections, crisp boundaries, and hoverable H1–H12 badges. Reuse house colours and selection links between sky and Earth. Place badges inside their actual regions, with screen-space collision handling; visible surfaces/boundaries are also hoverable when a badge is culled. Clip back-side geometry and prevent the globe itself or a broad sky shell from winning the hit before a visible surface badge/line.

Use the primary house system initially. Existing comparison houses remain available in the sky/inspector; a second projected fill is outside M10 to avoid contradictory overlapping geographic colour fields. When the primary partition is undefined, remove its geometry and show the exact reason in the layer control. Other valid Earth layers remain usable. Handle clockwise polar partitions, shared edges, zero-width/degenerate cases and ambiguous ecliptic poles explicitly.

### Astrocartography

Support all ten current bodies and their four angular line types, up to **40 selectable lines**:

| Line | Geometric meaning | Compact interpretive theme |
|---|---|---|
| AC | The body's centre is rising across the geometric horizon | Self-expression / approach |
| DC | The body's centre is setting across the geometric horizon | Relationships / encounters |
| MC | The body is at upper meridian transit | Public life / vocation |
| IC | The body is at lower meridian transit | Home / roots |

Use the existing apparent equatorial direction, including the body's actual celestial latitude, with matching apparent Greenwich sidereal time. This is the **in-mundo** convention, not a projection of a zero-latitude zodiac point. Upper meridian transit does not necessarily mean zenith, and may be below the horizon at some latitudes. AC/DC names in this layer describe bodily rise/set, not necessarily equality with the ecliptic ASC/DSC longitude. The distinction between in-mundo and zodiacal mapping is documented in [Solar Maps, section 4.2](https://alabe.com/y8/SM4UserGuide.pdf).

The numerical contract, to be recorded and tested before rendering:

```text
H = GAST + eastLongitude - rightAscension
MC: H = 0°             IC: H = 180°
Horizon: sin(phi) sin(delta) + cos(phi) cos(delta) cos(H) = 0
For nonsingular phi/delta: H0 = acos(-tan(phi) tan(delta))
AC longitude = rightAscension - GAST - H0
DC longitude = rightAscension - GAST + H0
```

All values above use degrees, with geographic latitude `phi` and declination `delta`; convert to radians at trigonometric function boundaries. These relations follow the existing coordinate contract and the [US Naval Observatory's hour-angle/altitude equations](https://aa.usno.navy.mil/faq/alt_az).

Evaluate the horizon as a vector condition near poles and tangencies; do not rely on the tangent formula outside its domain. Mark circumpolar/no-crossing cases honestly, join/split branches correctly and avoid drawing spurious lines across the dateline. No atmospheric refraction, terrain correction or topocentric parallax is added; this matches the application's existing geocentric directional convention. [Swiss Ephemeris reference: horizontal coordinates and sidereal time](https://www.astro.com/swisseph/swephprg.htm).

The map follows the **displayed snapshot moment**. It is a natal map when that instant is the birth instant; during timeline exploration, label it as the displayed/exploration moment. Include the local/UTC context and keep Return to birth available. This avoids mixing a hidden fixed natal map with an animated sky. Moving only the observer or changing the house system must leave astrocartography's geographic lines unchanged at a fixed instant; it can change the separate house projection.

Initially enable all bodies and four line types with quiet strokes. Provide body and AC/DC/MC/IC filters, isolated hover/selection emphasis and sparse collision-managed badges such as **♀ MC**. Use body colour plus angle labels/patterns, not colour alone. At crossings, resolve overlapping candidates and allow deliberate selection of each line.

An astrocartography card combines the body's line theme and the angle theme in one readable block, plus “Here Venus is at upper meridian transit at the displayed moment,” for example. Cover all 40 combinations with sourced, deterministic composition. Add **15 short content entries: one overview, ten body-line themes and four angle themes**. Existing angle cards contain method definitions, so their traditional themes require these new sourced claims. Reuse the new angle themes in both sky-angle and geographic-line cards. Preserve full attribution and provenance in the inspector/content catalogue. An unknown birth time must mark these time-sensitive lines and interpretations provisional.

Use the user's [Almanac reference](https://www.almanac.com/astrocartography-explained-find-your-best-places-live) for the overview and interpretive framing, with original concise paraphrases and a target of **at most 180 derived words across the entire source page**, tracked by the project's existing page-level word-budget checks. Do not reproduce its map image or infer unsupported combination predictions. Its suggested influence distances and paran discussion are not adopted as numerical rules.

M10 excludes paran lines, influence-width bands, location rankings, a “best city” score, relocated charts for every geographic point, and a separate 2D world map. Ordinary line intersections remain visible, but do not generate paran interpretations. These are separate features requiring their own contracts and validation.

## 6. Implementation architecture

The current `SceneCanvas.svelte` hover HUD receives only `{id, name}`. Guide/trail elements can collapse onto a parent ID, catalogue stars and some reference geometry lack meaningful hover registration, and overview/outside currently share `fitSky`. Address these contracts before styling the card.

| Area | Planned change |
|---|---|
| `src/lib/scene/runtime.ts` and renderer hit metadata | Typed hit descriptor: stable target ID, kind, owning entity, system/role/subfeature, screen anchor, and optional sample time; snapshot revision travels with resolution. Retain a separate selection target |
| New `src/lib/domain/hover-card.ts` | Pure resolver from descriptor + committed snapshot + display/context + catalogue to a typed card; exhaustive target coverage |
| New `src/lib/ui/HoverCard.svelte` and controller | Svelte HTML rendering, positioning, delay/grace/dismissal lifecycle, keyboard equivalents; no Three references in card content |
| New shared aspect-card theme tokens and bounded decorative component | Five palettes tied to existing aspect identities, translucent reading panels, SVG medallions, clipped sparkles, motion/quality handling and deterministic visual fixtures |
| `SceneCanvas.svelte`, `FeatureObjectList.svelte`, `App.svelte` | Wire canvas hits, object focus, reference controls and legends into the shared card; give the resolver aspect orbs and provisional/context state |
| `src/lib/content/` and `AspectInspector.svelte` | Reuse claim IDs; shared composed aspect/line models; new sourced layer/method/body-line entries and validation |
| `sky-data.ts`, new asterism import script/data/renderer | HIP→HYG topology, support endpoints, versioned manifest/notices, proper-motion alignment and figure picking |
| New domain `earth-projections.ts` / `astrocartography.ts` | Pure geometric results with explicit conventions and validity; no dependence on camera pose or UI selection |
| New scene `earth-projection-renderer.ts` | Surface sections, line buffers, badges, depth/occlusion, picking and disposal; separate geographic data from world/Earth rotation |
| `state/explorer.ts`, presentation types, `App.svelte` | New layers, independent child/body/angle filters and atomic explicit view-entry presets; distinguish view commands from internal globe-pick transitions |
| `domain/house-geometry.ts`, `state/preferences.ts`, `HouseControls.svelte`, `DisplayControls.svelte` | Shells/zero-lift defaults and consistent reset behaviour; Card sparkles preference with a versioned migration preserving all existing valid display choices |

Use stable IDs such as `asterism:ori`, `earth:house:primary:7`, `astro:venus:mc` and `star:hyg:123`, compatible with the existing namespace validator. Keep the selected geographic target/representation independent of its content alias: `astro:venus:mc` remains distinct from Venus's other three lines and its sky body. Route these IDs explicitly through selection validation, object lists, inspector resolution and focus commands; do not let the existing `selectFeature` helper implicitly enable a sky layer when selecting a surface counterpart. Do not overload `house:7` with two different systems or one indistinguishable sky/surface hit. Individual label layouts are presentation metadata, not astronomical identity.

Pick stars through their `THREE.Points` intersection index rather than thousands of individual meshes. Region-interior hovering requires a tested spherical-region classification; register it as a background candidate so a broad region cannot consume a body or line hit. Keep each figure/region representation linked to the same constellation inspector while retaining distinct hover metadata.

Keep astrocartography derived from existing snapshot values; no expansion of the native WASM interface is expected. Run bounded geometry generation in the existing worker architecture if profiling shows it is too expensive for a snapshot commit. Cache by actual dependencies, discard superseded results, and never launch a calculation on pointer movement. Surface coordinates must be transformed exactly once into the existing rotating Earth/world frame.

Use reusable buffers and screen-space hit tolerances. Rebuild geographic paths on a changed moment, house sections on changed moment/observer/system, and label positions on camera/viewport changes. Hover-card display alone must not create a permanent animation loop.

## 7. Work packages and delivery process

The current request is planning only. Once implementation is started, follow the existing pushed-branch/review/merge process; leave `main` unchanged. M10 is one product milestone, delivered in reviewable dependent branches into `codex/development`.

| Package / suggested branch | Deliverable | Dependency |
|---|---|---|
| M10.0 `codex/m10-contracts-defaults` | Target coverage inventory; coordinate/state contracts; approved card examples; shells/0% defaults and reset | This plan |
| M10.1 `codex/m10-rich-hover` | Structured hits, shared content resolver, complete hover/focus cards and combined aspect summary; five expressive card themes, animated prototype, sparkle setting and static alternatives | M10.0 |
| M10.2 `codex/m10-constellation-figures` | Pinned topology import, support stars, independent layer and full hover integration | M10.0; integrate against M10.1 contract |
| M10.3 `codex/m10-earth-houses` | Close Earth overview, explicit view presets and projected primary house sections | M10.0; M10.1 for cards |
| M10.4 `codex/m10-astrocartography` | Independently checked angular lines, filters, badges and composed interpretations | M10.0 numerical contract; M10.3 renderer |
| M10.5 `codex/m10-validation` | Integrated visual polish, coverage/numerical/browser/performance evidence and documentation | All preceding packages |

Parallel work is appropriate after contracts stabilize: interaction/cards, constellation data/renderer, and projection mathematics/content can proceed independently. Keep shared runtime/App integration owned by one developer to avoid competing scene/state edits. Independently review each branch, resolve findings, run its relevant checks, push, and merge into development. Update final PR #13 and release acceptance against the expanded scope after M10 validation.

Planning estimate: **15–25 engineering person-days**, plus **2–4 person-days** of new content/source review and target-device validation. This includes an additional 1–2 engineering/design days for the five-theme aspect-card treatment, animated prototype and visual checks. The main uncertainty is reliable surface/sky picking and readable dense geographic lines. Re-estimate after the first real hover-card and Earth-view prototypes; this is effort, not a calendar promise.

## 8. Acceptance and evidence

### Content and interaction

- Exhaustive resolver coverage for every target in the inventory, all 120 body-in-sign and 120 body-in-house placements, five aspect types with representative pairs, and all 40 astrocartography combinations. Resolver uses the correct active system, orbs and displayed revision.
- The Venus–Neptune square example reads as one card with the two actual placements. No source links/details appear in hover cards; equivalent inspector content retains attribution.
- Review all five aspect themes over both dark sky and bright Earth backgrounds: identity accent/glyph matches the scene, complementary gradients and luminous borders are visible, both placement panels have equal weight, and body text meets contrast requirements at the brightest decorative state. Inspect actual rendered pixels, not just declared CSS colours.
- Verify the animated Venus–Neptune example, deterministic static snapshots, Card sparkles toggle/persistence, legacy-preference migration, reduced motion, Low quality, forced colours and document visibility. Sparkles never cross reading-panel interiors or intercept input, and content updates do not retrigger the entrance effect.
- Actual canvas picking tests for points, line crossings, regions, comparison geometry, construction subfeatures, trail samples and new Earth features; test that hidden/back-side/disabled targets cannot steal the hit.
- Select and focus individual geographic lines/house sections without collapsing their IDs to sky targets, enabling disabled sky layers or moving the camera through Earth. Keyboard tests must reach individual stars, guide subfeatures, history samples and all Earth target types through their explicit navigation routes.
- Stable open/read/move-into-card/Escape behaviour; drag, zoom, blur and context-loss cancellation; same-target update during playback; keyboard/object-list parity; no hidden selection changes.
- Visual checks at 1440×900 and 1024×768, 200% browser zoom, large text, reduced motion and with both panels open. Text remains readable, scrollable where needed, and within the available viewport.

### Astronomy and geometry

- Preserve the Melbourne regression: 27 April 1987, 02:00 local resolves to 26 April 16:00 UTC, with Sun Taurus 5.89°. A sign, body and projection remain explicitly distinguishable.
- Asterisms: 88 figures, zero unresolved/ambiguous endpoint mappings, no unintended duplicate/reversed segments, expected disconnected portions; exact line/dot alignment at 1900, J2000 and 2100; all combinations of stars/regions/asterisms toggles work.
- Projected houses: all seven systems at valid locations, polar clockwise and undefined cases, boundary/inside/outside checks, and selected sky/surface identity. Compare classification after globe→fixed→ecliptic round trips; do not recompute a different partition in the renderer.
- Astrocartography: all ten bodies, both hemispheres, equatorial and polar fixtures, equinox/solstice, date-range endpoints, wrap/tangent/circumpolar cases. At generated vertices verify AC/DC altitude residual and rise/set direction, MC/IC hour-angle residual, with target residual ≤1e-6° away from declared singularities.
- Validate a checked-in sample against independently computed native Swiss horizontal coordinates/meridian conditions, plus hand-solvable synthetic directions. These check implementation consistency, not independent physical ephemeris validation. Record source flags and exact conventions rather than comparing unexplained screenshots from another service.
- Rendered line interpolation remains within a documented angular error (initial target ≤0.05°); branch endpoints and the dateline do not acquire false connections. Astrocartography geography stays invariant under camera rotation, display mode, house-system changes and observer relocation at fixed instant. Projected house geography intentionally changes with the observer/system; camera and display changes alone must preserve it.

### Performance, recovery and release

- Measure card reveal after its intentional dwell: target ≤50 ms p95 processing/render latency after eligibility. No ephemeris work, content-catalogue reconstruction or geometry rebuilding per pointer move; one hit-test pass per animation frame at most. A bounded `THREE.Points` vertex scan is permitted, with a picking target of ≤4 ms p95 on the measured reference configuration. Add a cached spatial index if needed to meet that budget.
- Benchmark default Earth view, all 40 lines with houses, asterisms, and the existing dense sky configuration. Retain the established default-interaction budget; require bounded degradation and documented measurements for dense combinations rather than claiming every overlay is 60 fps.
- The Three.js scene remains idle when only card sparkles animate. With no visible animated card, decorative animations are also stopped. Geometry/textures/programs and decorative DOM nodes plateau through repeated hovers, view switches, dates and layer toggles; disposal and WebGL context restoration recreate consistent cards, geometry and camera state. Compare frame/interaction measurements with card sparkles on and off; require no new long tasks attributable to the card effect and reduce particle count if the existing interaction budget regresses.
- Run source/content/asset/notice checks, meaningful domain tests and packaged Chromium/Firefox/WebKit workflows, with installed Chrome/Edge checks as available. Record actual GPU/browser versions and screenshot evidence.
- Update source archives, dataset manifests, notices, release documentation and final scope matrix. New data remains bundled and versioned; hovering transmits no personal data.
- Existing external acceptance gaps—actual Safari, screen reader, integrated-GPU laptop, moderated usability and human editorial review—remain explicitly open until those checks are genuinely performed. New features expand those checks; engineering tests do not close them by implication.

M10 is engineering-complete only when the richer cards explain every promised target, all new layers work independently and together, Earth overview is visibly distinct, the new defaults are consistent, and numerical/browser/performance evidence is recorded.

## 9. Defaults and remaining decisions

There are no blocking product questions for this plan. The following defaults make the intended implementation concrete and can be changed before or during design review:

- **Hover placement:** near the feature/pointer with collision handling, replacing the current small top-left name badge.
- **Graphics:** expressive aspect cards with five coordinated border/gradient themes, translucent dark text panels, SVG medallions and animated sparkles; shared typography/icons and quieter decoration for other card types.
- **Card motion:** sparkles On by default where permitted, with an accessible display preference; reduced motion and Low quality retain the complete static design.
- **Constellation convention:** Stellarium's modern Western figures; 88 constellations, independent of boundary and star toggles.
- **Map time:** displayed snapshot time, initially the birth moment; visible labels distinguish exploration from natal context.
- **House projection meaning:** radial projection of the current primary chart, not a world-wide set of relocated charts.
- **Astrocartography scope:** true-latitude/geocentric geometric AC/DC/MC/IC only; all ten bodies; no parans or influence bands.
- **View presets:** explicit Earth entry enables both Earth sublayers; Outside and Observer entry disable them; manual toggles work until the next explicit entry.
- **House defaults:** shells/0% for fresh and reset state; preserve saved mode choices and expose reset for existing users.

The source import/licence verification and numerical reference fixtures are implementation gates, not unanswered user preferences. The work packages must resolve those gates before describing the feature as complete.
