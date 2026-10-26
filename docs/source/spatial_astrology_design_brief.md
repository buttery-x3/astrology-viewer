# Spatial Astrology Explorer
## Product and experience design brief

**Status:** Concept design · 25 October 2026  
**Format:** Single-page, browser-based 3D application  
**Working descriptor, not a final product name**

> **The sky is the interface. Astrology is an inspectable overlay within it.**

## 1. Purpose and boundaries

Create an interactive spatial instrument for exploring how birth-chart astrology organises the sky. A user selects a location on Earth, enters a date and time, and explores celestial objects, zodiac divisions, houses, relationships and movement in one continuous 3D environment.

The primary audience is a curious visual learner. Prior knowledge of astrology, astronomical terminology or traditional chart notation is not required. The experience should also support people who already understand astrology and want to examine familiar conventions spatially.

This is **not** a traditional chart accompanied by a planetarium. There is no detached zodiac wheel, no requirement to translate the scene into a flat chart, and no separate diagram that becomes the “real” interface. Astronomy, astrological divisions and interpretations remain connected to the objects being explored.

The intended experience is discovery through manipulation: change the time, move the observer, switch the house system, try a different rendering, and see what changes and what does not.

The atmosphere may feel mysterious; the explanations must not. Astrological interpretations are presented as attributed traditions, not measured forces or established predictions. Scientific testing has not established the claimed personality or predictive effects of astrology. This distinction belongs in a clear evidence explanation, not a repetitive warning interrupting every interaction. [Background: Wikipedia — Astrology and science](https://en.wikipedia.org/wiki/Astrology_and_science).

## 2. One page, one spatial environment

The scene occupies most of the browser window. Controls sit around it as compact, retractable panels. Opening an explanation or changing a setting must not replace the spatial experience with a different page.

| Page region | Contents | Behaviour |
|---|---|---|
| Top context bar | Location, date, time, time zone and active house system | Always clear which circumstances are being shown; edit without leaving the scene. |
| Left tool dock | Layers, house rendering, aspect visibility and trail controls | Compact by default; expands only the selected control group. |
| Main canvas | Earth, observer reference, celestial sphere and selected overlays | Direct rotation, zooming, selection and exploration. |
| Right inspector | Selected object, explanation, interpretation and sources | Opens on selection; can be pinned or collapsed. |
| Bottom timeline | Scrubber, play/pause, direction, time scale and birth-moment marker | Remains available while inspecting objects or comparing systems. |

The first screen offers **Explore an example** and **Enter a birth moment**. An example is explicitly labelled as a demonstration, not a reading of the user. No account or personal name is required.

The suggested opening composition is an oblique view of Earth inside a faint celestial sphere, with a marked location, its local horizon, a restrained zodiac band, house boundaries and celestial objects. The scene starts paused. A short prompt—“Select something to see how it is defined”—invites exploration without a compulsory tutorial.

## 3. Spatial foundation and camera behaviour

### A sky of directions, not a miniature Solar System

The main model is a [celestial sphere](https://en.wikipedia.org/wiki/Celestial_sphere): an enclosing representation of sky directions, not a claim that all objects are equally distant. Planet-marker sizes, Earth size and shell distances are illustrative. A persistent, unobtrusive label identifies this as a **schematic sky; distances not to scale**.

The default uses Earth-centred chart directions oriented to the selected location’s horizon. It must not claim to be an exact photographic simulation of the view from the ground. Any later comparison with surface-observer positions must distinguish the two explicitly rather than silently mixing them. [Reference: Astrodienst — geocentric and topocentric positions](https://www.astro.com/swisseph/swisseph.htm).

### Three viewpoints within the same scene

**Earth overview** makes selecting a location and understanding its orientation intuitive. The observer’s horizon appears as a local plane, with its orientation extended into the surrounding sky.

**Observer sky** brings the camera into the local sky perspective. The user looks around the dome while the same objects, overlays and selections remain available.

**Outside the sphere** lets the user inspect how the divisions wrap around the complete sky, including the portion below the horizon.

These are camera destinations, not separate conceptual workspaces. Switching viewpoint preserves time, location, selected object, house system and overlay settings. Moving the camera must never move the observer or alter the chart.

A visible orientation marker and **Return to observer** action prevent getting lost. Automatic camera movements are gentle, interruptible and optional.

### Below the horizon still exists

Use a horizon plane, subdued lower hemisphere and optional transparent Earth to reveal below-horizon placements. Label them **Below the horizon**, not “missing” or “invisible” without qualification. The application can show objects during daylight for explanatory purposes, but must distinguish schematic display from naked-eye visibility. [Background: Wikipedia — Horizontal coordinate system](https://en.wikipedia.org/wiki/Horizontal_coordinate_system).

## 4. Selecting place and time

Users can search for a place, select it directly on the globe, or refine the chosen point. Search results show enough geographical context to distinguish similarly named places. Selection displays the place name, coordinates and time zone.

Date and time entry use an unambiguous format, with local time and UTC available together. Historical daylight-saving and time-zone changes must be respected; a present-day offset must not be applied indiscriminately to a birth date. Ambiguous or nonexistent local times require a visible resolution rather than an unnoticed assumption. [Reference: IANA — Time Zones](https://www.iana.org/time-zones).

After an initial birth moment is established, moving the observer preserves the same instant by default. An explicit **Keep local clock time instead** option supports a different comparison. The interface states which behaviour is active.

The original birth moment remains a clearly marked timeline anchor. Scrubbing changes the moment being explored, not the saved anchor. **Return to birth moment** restores it immediately. The status bar distinguishes **Birth moment** from **Exploring: +2 hours**, for example.

For an unknown birth time, allow exploration using a visibly provisional time. Do not present its time-sensitive house placements as a precise birth result. Changing personal details does not require saving or sharing them, and any future sharing feature must make inclusion of birth details explicit.

## 5. Visual vocabulary: concepts embedded in space

| Concept | Spatial expression | On focus |
|---|---|---|
| Earth and observer | Restrained globe, precise location marker and local orientation | Show horizon, compass directions and the selected location. |
| Celestial object | Bright, compact marker with a name and optional glyph | Reveal position, sign, house, related aspects and motion trail. |
| Ecliptic | Thin reference path inside a wider translucent belt | Explain the path and reveal relevant longitude markers. |
| Zodiac sign | Named segment of that belt, with a clear boundary | Highlight its extent and the objects assigned to it. |
| House | One of three selectable spatial rendering styles | Emphasise its extent, boundaries and assigned objects. |
| Ascendant and related points | Distinct geometric markers, not planet-like objects | Reveal the intersections or construction that define them. |
| Aspect | Thick translucent connector with a readable core | Isolate the pair and reveal the measured relationship. |
| Motion | Fading trail with direction and time markers | Show its time window and the reference frame in which it is drawn. |

The [ecliptic](https://en.wikipedia.org/wiki/Ecliptic) is the Sun’s apparent annual path across the celestial sphere. Its visual belt provides useful interaction space, but its decorative width is not a scientific boundary. Planets and the Moon retain their positions above or below it; they are not snapped onto its centreline. Selecting an object may show its corresponding longitude position on the ecliptic without moving the object. [Background: Wikipedia — Ecliptic coordinate system](https://en.wikipedia.org/wiki/Ecliptic_coordinate_system).

Use the **Western tropical zodiac** as the explicitly labelled starting convention. Its signs are twelve 30-degree divisions, anchored at the March equinox. A separate constellation overlay must retain the distinction between signs and astronomical sky regions. Do not resize constellations to fit the signs or treat the two as interchangeable. [Wikipedia — Astrological sign](https://en.wikipedia.org/wiki/Astrological_sign); [IAU — The Constellations](https://www.iau.org/IAU/IAU/Astronomy-FAQs/Constellations.aspx).

Offer the Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto as the core selectable bodies. Their astronomical identities and astrological roles should have separate links. “Bodies” is the inclusive interface label: it avoids implying that the Sun and Moon are planets in the modern astronomical sense. [Wikipedia — Planets in astrology](https://en.wikipedia.org/wiki/Planets_in_astrology).

The [Ascendant](https://en.wikipedia.org/wiki/Ascendant) identifies the eastern horizon–ecliptic intersection used by the system. The Midheaven belongs to the meridian–ecliptic construction; it must not be equated with the zenith, directly overhead. The opposite points and their definitions should be inspectable too. [Astrodienst — Medium Coeli](https://www.astro.com/astrowiki/en/Medium_Coeli).

## 6. Houses: separate the system from the rendering

**House system** answers “Which rule divides the chart?”  
**House rendering** answers “How are those divisions displayed?”

These are independent controls. Changing only the rendering must never change house assignments, boundary values or explanations of the selected system.

### Proposed house-system selection

The following set provides contrasting constructions without claiming to include every astrological tradition. The short descriptions below are labels for orientation, not complete explanations; each system needs its own linked, inspectable construction.

| System | Construction in plain language | What the scene should make inspectable |
|---|---|---|
| Whole Sign | The sign containing the Ascendant is the first house; succeeding signs form the others. | Alignment between whole signs and houses. |
| Equal House | Twelve equal longitude divisions starting at the Ascendant. | Equal widths with a starting boundary that can lie within a sign. |
| Porphyry | Each quadrant between the four principal chart angles is divided into three. | The quadrants and their subdivisions. |
| Placidus | Divisions based on portions of daily rising and setting arcs. | The time-based construction rather than an invented equal-space division. |
| Koch | A time-based construction using the rising history of the Midheaven degree. | The reference timing and resulting boundaries. |
| Regiomontanus | Divisions derived from the celestial equator. | The equator and its relationship to the resulting boundaries. |
| Campanus | Divisions derived from the prime vertical, the east–zenith–west circle. | The reference circle and its spatial subdivisions. |

Sources: [Wikipedia — House systems](https://en.wikipedia.org/wiki/House_(astrology)#Systems_of_house_division) and [Astrodienst — house-system definitions, section 6.2](https://www.astro.com/swisseph/swisseph.htm).

Whole Sign is a reasonable opening example because its alignment is easy to inspect, not because the application ranks it as more valid. All listed systems remain equally accessible. In particular, do not force the Midheaven to become the tenth-house boundary in systems where it is not. [Wikipedia — The MC in non-quadrant house systems](https://en.wikipedia.org/wiki/House_(astrology)#The_MC_in_non-quadrant_house_systems).

### All three rendering modes are retained

| Rendering | Appearance and interaction | Design question it helps evaluate |
|---|---|---|
| **Volumes / wedges** | Translucent angular regions extend through the scene. Boundary faces and restrained fill give selected houses spatial presence. | Does seeing an occupied region make house membership easier to understand? |
| **Boundary arcs** | The sphere carries clean boundary curves. Regions fill softly on hover or selection. | Can the division remain legible with minimal visual obstruction? |
| **Layered shells** | House regions appear as translucent curved panels on an enclosing shell. Selected panels can lift or separate slightly, retaining guides to their original positions. | Does separating overlapping surfaces improve inspection and depth perception? |

These are user-facing alternatives, not disposable experiments awaiting a single winner. Switching preserves selection, viewpoint and the active system. Opacity and contextual filling are adjustable. An optional hybrid combines boundary arcs with a selected volume.

Shell separation is explicitly a display aid, not a claim that houses occupy different distances from Earth. House identity remains recognisable across all modes through numbers, boundary labels and consistent styling. Do not equate “House 1” with “Aries” through colour or naming.

### Spatial honesty: show the convention, not an invented cosmic structure

A house volume is a visual representation of an astrological rule, not a physical compartment. Moreover, house placement based on zodiac longitude can differ from a full spatial placement that considers an object’s latitude. Astrodienst explicitly documents that distinction. [Reference: Astrodienst — house position of a planet, section 6.5](https://www.astro.com/swisseph/swisseph.htm).

For this brief, the default is **chart-style house placement by zodiac longitude**, embedded in 3D. All three rendering modes depict that same assignment rule. Their extensions away from the ecliptic are identified as a display convention.

A **Show construction** action reveals the selected system’s actual defining geometry or timing guides in the same scene. It does not silently substitute a different placement method. Boundary arcs must not be described as universally great circles, nor should time-based constructions be illustrated as arbitrary equal wedges.

Any future latitude-aware house-placement alternative must be named as a different calculation convention—not disguised as a visual style.

### Comparing systems without leaving the scene

Hold time, location and viewpoint fixed. Show one system as the primary overlay and a second as ghosted boundaries. Highlight only changed regions and changed assignments by default. A small comparison summary links each change back to its location in space.

Changing systems must not animate the planets into new positions. The classification changes around them. A switch between systems is also not an event on the timeline: use a crossfade or clearly labelled comparison transition rather than implying a physical transformation.

Some systems have limitations at high latitudes. When a selected construction is undefined, explain that state and retain the rest of the scene. Never silently display another house system under the requested name. [Reference: Astrodienst — house calculation limitations](https://www.astro.com/swisseph/swephprg.htm).

## 7. Aspects: legible relationships, not decorative spaghetti

Start with the five major longitude aspects: conjunction, sextile, square, trine and opposition, associated with 0°, 60°, 90°, 120° and 180°. The permitted departure from an exact aspect—the orb—is an explicit setting, not an invisible universal constant. [Wikipedia — Astrological aspect](https://en.wikipedia.org/wiki/Astrological_aspect).

Render relationships as thick, translucent strands with a narrower readable centre. Colour, a small symbol and a text label identify the relationship. Gentle curves may improve legibility, but the route of a strand is not itself a physical path or measurement.

Selecting a body brightens its relationships and quiets unrelated ones. Selecting a connection isolates its endpoints and shows the aspect name, actual longitude separation, target angle, distance from exactness, allowed orb and attributed meaning. Background aspects can remain faint, be filtered by type, or be limited to the selected body.

**A crucial measurement distinction:** standard longitude aspects are not necessarily the shortest angular separation between the two actual sky positions. On selection, show the relevant longitude anchors and measured arc on the existing ecliptic. Keep the bodies at their sky positions. Do not imply that the curved connector’s apparent 3D angle proves the aspect. [Wikipedia — Astrological aspect](https://en.wikipedia.org/wiki/Astrological_aspect); [Wikipedia — Ecliptic coordinates](https://en.wikipedia.org/wiki/Ecliptic_coordinate_system).

Conjunctions need a halo or bracket so a near-zero-length link remains selectable. Opposition links must remain inspectable when Earth obscures their middle. Overlapping objects should receive offset labels with leader lines, not altered celestial positions.

During playback, an aspect may brighten as it approaches exactness and soften as it moves away. The legend calls this **closeness to exact angle**, not “energy” or proven influence. Avoid directional pulses that imply a force travelling between planets.

## 8. Timeline and motion trails

The timeline supports direct scrubbing, forward and reverse playback, stepping, visible speed and selectable windows from minutes through years. Fine movement should remain possible around the birth anchor. Changing the time scale must not unexpectedly jump the current moment.

The default is **one moving moment**: all positions and classifications refer to the displayed time. The birth anchor is a return point, not an undisclosed second chart. Comparing a fixed natal sky with another date would be a separate, explicitly labelled feature, outside this brief’s core scope.

### Trails explain movement rather than merely decorating it

A trail shows a selected object’s sampled sky positions across a named interval. Use fading solid marks for the past and a distinguishable dashed treatment for future positions. Time ticks, direction arrows and the interval label remain readable. Future positions represent calculated celestial motion, not predictions about a person.

Offer two clearly named references: **Relative to the local horizon** and **Relative to the stars**. The first emphasises the sweep through the local sky; the second makes longer-term planetary movement easier to inspect. Switching reference rebuilds the trail and explains what is being held fixed. These are frame choices within the same spatial environment, not new chart pages.

An apparent retrograde loop should be described as a change in apparent motion, not a planet reversing its orbit. [NASA — What does it mean for Mercury to be in retrograde?](https://starchild.gsfc.nasa.gov/docs/StarChild/questions/question46.html).

House-boundary history is available for the selected boundary as a short series of time-labelled ghosts. Avoid leaving twelve accumulating sheets across the entire scene. Traces must break at discontinuities or undefined states rather than drawing fictitious continuous movement through them.

Changing the observer location resets or explicitly recomputes the trail; the application must not combine unrelated viewpoints without saying so.

## 9. Selection and explanation

Hover offers a brief identity preview and coordinated highlighting. Click or tap pins the selection and opens the inspector. Focus through keyboard navigation provides equivalent information. Only deliberate actions move the camera.

Selecting Mars, for example, can simultaneously highlight its actual marker, longitude anchor, sign segment, house region, aspects and trail. The inspector explains those connections without requiring the user to switch modes or memorise a symbol key.

Explanations follow a consistent progression:

| Inspector layer | Question answered | Example contents |
|---|---|---|
| **What it is** | What am I looking at? | Name, plain-language definition and kind of object. |
| **How it is placed or defined** | Why is it here? | Current values, chosen system and visible construction guides. |
| **Traditional interpretation** | What does this tradition associate with it? | A short attributed explanation, with alternatives where relevant. |
| **Sources** | Where does this explanation come from? | Direct article or section links and source-role labels. |

A persistent **Show me in the scene** action highlights the exact feature discussed. Interpretation remains directly available; it is not a reward for completing an astronomy lesson.

### Example aspect card

*Illustrative values only; not a calculated birth chart.*

> **Square — selected pair**  
> Longitude separation: **91.4°**  
> Exact target: **90°** · Departure from exactness: **1.4°**  
> Demonstration tolerance: **±6°**  
> **Definition:** This pair qualifies under the selected tolerance.  
> **Traditional interpretation:** Astrodienst describes squares as challenging or tension-producing relationships. This is an interpretation, not a measured physical force.  
> **Actions:** Show measured arc · Isolate pair · Show motion · Read sources

Sources: [Wikipedia — Astrological aspect](https://en.wikipedia.org/wiki/Astrological_aspect) and [Astrodienst — Introduction to aspects](https://www.astro.com/astrology/in_aspect_e.htm).

A planet being “in Libra” is a calculated classification under a chosen zodiac convention. What that placement supposedly says about a person is a separate interpretive claim. The inspector must preserve that distinction.

## 10. Art direction and visual hierarchy

**Direction: a precise futuristic observatory with a restrained mystical atmosphere.**

Use midnight navy, near-black and deep indigo as the foundation; pale neutral text; and controlled cyan, violet, teal and warm-gold accents. Transparent surfaces should suggest illuminated glass rather than opaque game objects.

Glow is selective. A clear line core must remain visible inside a soft halo. Reserve the strongest contrast for the selected object and the information explaining it. Keep stars restrained enough that boundaries and labels remain legible.

Use readable contemporary typography. Traditional glyphs provide recognition, but always have accessible names. Avoid faux-ancient fonts, ornamental rune borders, dense cockpit decoration and decorative symbols that look like meaningful data.

The hierarchy is **selection → relevant relationships → reference geometry → atmosphere**. Within that hierarchy, users remain free to increase or reduce layer visibility. A compact live legend explains active colours, shapes, line types and any quantity mapped to brightness.

There should be no good/bad moral colour code for aspects and no shared colour scheme that accidentally teaches houses and signs as identical. Touch targets can be generous even where the visible geometry is fine.

The atmosphere should invite curiosity, not make a stronger claim than the explanatory text.

## 11. Sourcing and linked knowledge

### Every substantive explanation has an inspectable source

Every astronomical concept, astrological definition, interpretive statement and historical claim displayed in the application needs a directly accessible link. A general bibliography alone is insufficient.

Concept names in the inspector link to Wikipedia by default where its article is appropriate. Specialist sources supplement definitions, competing traditions and house constructions. Links open without losing the current exploration.

Live calculated values require provenance of a different kind: their active inputs, selected convention and the source behind the calculation. Do not imply that a Wikipedia page independently confirms a user-specific placement. Ordinary interface controls and original rendering choices are design features, not historical claims needing unrelated citations.

Source labels distinguish **astronomy/reference**, **astrological definition**, **interpretive tradition** and **evidence assessment**. A practitioner source can establish what that practitioner teaches; it cannot by itself establish that the claimed effect occurs.

Wikipedia is an entry point, not permission to reproduce unsupported statements. Check relevant passages against specialist references, disclose meaningful disagreement, and avoid unsupported composite interpretations. Keep summaries in original wording and attribute images or reused material appropriately.

### Linked source map for the application

| Content area | Starting references |
|---|---|
| Sky and orientation | [Celestial sphere](https://en.wikipedia.org/wiki/Celestial_sphere), [Horizontal coordinates](https://en.wikipedia.org/wiki/Horizontal_coordinate_system), [Ecliptic](https://en.wikipedia.org/wiki/Ecliptic), [Ecliptic coordinates](https://en.wikipedia.org/wiki/Ecliptic_coordinate_system) |
| Zodiac and constellations | [Astrological signs](https://en.wikipedia.org/wiki/Astrological_sign), [Zodiac](https://en.wikipedia.org/wiki/Zodiac), [IAU constellations](https://www.iau.org/IAU/IAU/Astronomy-FAQs/Constellations.aspx) |
| Houses and reference points | [House systems](https://en.wikipedia.org/wiki/House_(astrology)#Systems_of_house_division), [Ascendant](https://en.wikipedia.org/wiki/Ascendant), [Astrodienst: Medium Coeli](https://www.astro.com/astrowiki/en/Medium_Coeli), [Astrodienst: construction reference](https://www.astro.com/swisseph/swisseph.htm) |
| Bodies and relationships | [Planets in astrology](https://en.wikipedia.org/wiki/Planets_in_astrology), [Astrological aspects](https://en.wikipedia.org/wiki/Astrological_aspect), [Astrodienst: aspect interpretations](https://www.astro.com/astrology/in_aspect_e.htm) |
| Motion and time | [Apparent retrograde motion](https://en.wikipedia.org/wiki/Apparent_retrograde_motion), [NASA: retrograde explanation](https://starchild.gsfc.nasa.gov/docs/StarChild/questions/question46.html), [IANA: historical time zones](https://www.iana.org/time-zones) |
| Context and evidence | [Western astrology](https://en.wikipedia.org/wiki/Western_astrology), [History of astrology](https://en.wikipedia.org/wiki/History_of_astrology), [Astrology and science](https://en.wikipedia.org/wiki/Astrology_and_science) |

Each supported sign, house, body, aspect and house system needs a specific content entry with a definition, spatial explanation, attributed interpretation where applicable, and relevant source links. A link to a category overview is not sufficient support for every specific claim within that category.

## 12. Accessibility, responsiveness and recovery

All important functions work without hovering or precisely clicking a thin 3D line. A searchable object list supplies another route to selection and focuses the same object in the scene. It is an accessibility aid, not a replacement wheel.

Use colour together with names, numbers, symbols or line patterns. Provide keyboard navigation, visible focus, readable contrast, adjustable label size, reduced motion and a way to pause all nonessential animation. Screen-reader descriptions expose the selected object, current placement, active system and meaningful changes without announcing every animation frame.

On smaller screens, the same scene remains central. Tools collapse into drawers, explanations use a bottom sheet, and the timeline stays accessible. Essential information must not depend on simultaneous three-column viewing.

The scene needs clear states for an unresolved place, uncertain time, unsupported date, undefined house construction, unavailable source and interrupted position update. Never leave old geometry on screen as though it represents newly entered inputs. When results are pending, identify that state and pause animation rather than inventing continuity.

## 13. Experience checks and scope

The defining capabilities belong in the design from the outset: globe-based location selection, date/time input, a continuous spatial sky, embedded signs and houses, all three house-rendering modes, selectable house systems, aspect links, motion trails, contextual explanations and inline sources.

Traditional chart wheels, compatibility scoring, personality verdicts, accounts, social feeds and a full Solar System simulator are not part of the brief. Additional zodiac traditions, asteroids and fixed-natal-versus-transit comparisons are separate extensions, not assumptions hidden in the core experience.

### Evaluation scenarios

| Scenario | What a successful design demonstrates |
|---|---|
| Enter a moment and move the observer | The user understands the location change and can distinguish it from merely rotating the camera. |
| Switch house systems at a fixed moment | Boundaries and classifications change without suggesting that planets have moved. |
| Switch all three house renderings | The presentation changes while values and assignments remain identical. |
| Select an aspect | The user can identify the objects, inspect the correct measured relationship and reach its interpretation and source. |
| Scrub a short and then a long interval | The user can read direction, time scale and trail reference without confusing apparent motion with an orbital reversal. |
| Inspect a below-horizon object or invalid construction | The interface explains the state rather than hiding the object or fabricating a result. |

No house-rendering mode wins merely by looking most impressive in a screenshot. Evaluate each for recognising membership, tracing boundaries, understanding depth, selecting objects and comparing systems. Different modes may remain useful for different questions—and keeping that choice is an intended outcome.

The strongest success criterion is that a new user can point to something in the scene and explain **what it represents, what changes it, and where its interpretation comes from**, without consulting a traditional chart.

> **Mystery in the atmosphere; clarity in the instrument.**
