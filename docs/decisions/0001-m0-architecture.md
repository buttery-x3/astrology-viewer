# ADR 0001 — M0 calculation, time, and data architecture

Date: 25 October 2026. Status: accepted direction; individual feasibility results are recorded by the executable M0 checks and generated evidence, not inferred from this ADR.

## Context

The approved release is a desktop browser explorer with mouse and keyboard control, one continuous Three.js scene, ten bodies, seven house systems, 1900–2100 dates, concise interactive construction guides, and 240 body-placement interpretations. The user approved AGPL-compatible open source and online lookup. The design brief is product evidence; the user's instructions authorize implementation and the development-branch review process.

The main feasibility risks are engine/file integration, silent ephemeris or house fallbacks, UTC/UT1/TT confusion, historical civil-time ambiguity, geographic zone identity, and rendering computation on the input thread.

## Decision

Use Svelte, Vite, TypeScript, and direct Three.js. Keep domain calculation independent of Svelte/Three objects. A single module worker initially owns a pinned Swiss Ephemeris WASM instance and performs chart/trail work. Use an owned minimal C wrapper where feasible; accept a third-party distribution only after its source, reproducibility, licences, API/error coverage, and data loading satisfy the same evidence gates. Do not select an alternative engine merely to avoid exposing a failure.

Store immutable chart snapshots tagged with the exact request revision and engine/data/convention provenance. The coordinator discards superseded responses. Presentation changes do not recalculate astronomical positions. Missing ephemeris files, unsupported geometry, and undefined houses are explicit result states. Any engine-generated replacement house cusps must not be presented as the requested polar system.

Adopt tropical, apparent geocentric positions and longitude-based house membership. Keep Julian dates for UTC-labelled input, UT1 Earth rotation, and TT ephemeris calculation distinct at the adapter boundary; use documented Swiss conversion/model functions. Keep doubles until GPU buffer conversion. The separate frame contract owns axes, handedness, longitude signs, epochs, and horizontal transforms.

Use pinned Moment Timezone rules behind a replaceable civil-time interface. The adapter returns zero, one, or multiple matching instants for civil fields, requiring a visible choice for ambiguity. Use the full dataset as the initial implementation and document whether a custom `backzone` build is required to preserve historical identity. Exact package version alone is insufficient: record tzdata version, packed-data checksum, build options, and coverage. [Moment data API](https://momentjs.com/timezone/docs/), [IANA historical limitations](https://data.iana.org/time-zones/theory.html).

Separate place search, coordinate-to-zone identity, and historical offset resolution. Default local noncommercial search to Open-Meteo with no account, through a provider interface. Use a small Node lookup endpoint with `geo-tz/all` comprehensive geography for arbitrary coordinates. This avoids shipping its large filesystem-backed indexed geography to each browser. Retain multiple zones and manual correction. Provider search output is a suggestion, not a verified civil-time answer. [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api), [geo-tz comprehensive product](https://github.com/evansiroky/node-geo-tz#comprehensive).

Select AGPL for the application with preserved dependency notices and corresponding source. Keep ODbL geographic databases and other separately licensed assets identified in their own manifests. For source/data choices and deployment conditions, see [data and licensing readiness](../data-and-licensing.md).

## Consequences and deferred decisions

- A static application can calculate charts locally, while geographic lookup may need a separately hosted Node endpoint. Production endpoint and paid-provider selection remain deployment configuration decisions.
- The initial one-worker/single-threaded WASM design avoids shared-memory hosting requirements. Add workers or alternate build modes only after measurements justify them.
- Moment is isolated so a future civil-time API can replace it without changing saved input semantics; browser `Intl` data is not a reproducible substitute for the pinned rules.
- Comprehensive current zone polygons improve identifier coverage but do not establish historical geographic boundaries. Historical uncertainty and explicit offsets remain part of the product.
- Source-linked original content and data attribution are release work, not generated placeholders counted as complete.
- Camera frame rate, browser WASM startup, and peak memory remain unverified until measured in a named browser/environment. Native throughput and package byte size cannot stand in for those measurements.

## M0 completion evidence

The M0 report must link actual results for all ten bodies and seven systems, at least one polar undefined case, native/WASM comparisons with matching flags/data, frame/time fixtures, worker execution, and strict missing-file handling. Save repeatable byte/timing measurements and state precisely which memory/GPU/browser checks remain unavailable. Record the engine/data/build pins and historical lookup strategy before expanding the application foundation.

If the selected environment cannot complete a gate, report it as incomplete and resolve it through build/runtime setup or an explicit reviewed architecture revision. This ADR does not waive the approved milestone acceptance criteria.
