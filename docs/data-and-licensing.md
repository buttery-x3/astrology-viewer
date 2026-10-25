# Data, licensing, and provenance readiness

Reviewed 25 October 2026. This records decisions and source checks for M0; it is not a claim that every future asset has been downloaded, validated, or cleared for release. Exact installed versions and asset checksums belong in the build/data manifests. User decisions: AGPL-compatible open source, 1900–2100 inclusive, online location lookup, all 240 placement interpretations, and concise interactive construction guides.

## Astronomy and application source

Select the Swiss Ephemeris AGPL route. Preserve Astrodienst's copyright and dual-licensing notices, retain the upstream version/revision and the narrow wrapper's source, and publish reproducible build instructions with the distributed application. The upstream notice requires choosing the licence before distribution or public service activation. The application's AGPL licence does not replace notices for third-party components. [Upstream licence](https://github.com/aloistr/swisseph/blob/master/LICENSE), [AGPL-3.0 text](https://www.gnu.org/licenses/agpl-3.0.html).

Provide an obvious **Source and licences** link in the released application that resolves to its corresponding release source, including wrapper, build scripts, lockfile, and necessary data preparation instructions. Review the exact shipped revision and assets before tagging a release. Avoid a generic repository link that later points only to unrelated HEAD.

For the ten requested bodies, evaluate the planetary and lunar Swiss files covering the full interval; do not fetch the asteroid catalogue. Store original URL, upstream revision, SHA-256, byte length, coverage, and applicable notice for each shipped file. Astrodienst identifies its GitHub `ephe` directory as an official download location. Actual coverage must be checked through the engine/file metadata and boundary fixtures. Inspect the returned ephemeris flags; a missing file that falls back to another model must fail the strict Swiss mode. [Official file locations](https://www.astro.com/ftp/swisseph/ephe/).

## Civil time and geographic identity

M2 implements a dedicated civil-time adapter with **pinned IANA 2026e rule data**. It imports Moment 0.6.5's no-data entry point and loads the committed custom packed artifact, preserving second-level offsets and transitions. Candidate enumeration and rule round trips identify gaps and folds without choosing a fold side or shifting a gap. `src/lib/time/data/manifest.json` records the exact IANA archive URLs/checksums, build options, rule range, output hash, and verification counts. The artifact contains 598 explicit identities in 402,780 uncompressed bytes; the supported calculation interval remains 1900–2100 UTC. [Moment Timezone data loading and zone API](https://momentjs.com/timezone/docs/).

Full year coverage and historical zone identity remain separate questions. The completed M2 pipeline runs unmodified IANA `ziguard.awk` with `PACKRATDATA=backzone PACKRATLIST=zone.tab`, compiles pinned `zic` using Emscripten 4.0.23, and expands exact transitions from 1899-01-01 through 2102-01-01 to guard the UTC entry boundaries. It independently verifies 64,774 periods with Python `ZoneInfo.from_file`, then checks every Moment packing round trip. Historical fixtures distinguish Amsterdam (+00:19:32), Aden (+02:59:54), Riyadh (+03:06:52), and Accra (−00:00:52) in 1900 and preserve second-resolution gaps/folds. Repeated builds produced the same output hash. Build instructions, provenance, verification commands, and remaining historical uncertainty are documented in [the timezone build](timezone-build.md). The ordinary Moment bundle is intentionally excluded because its compilation omits `backzone`. [Pinned Moment compilation source](https://github.com/moment/moment-timezone/blob/0.6.5/tasks/data-zic.js), [Pinned IANA build options](https://github.com/eggert/tz/blob/2026e/Makefile).

Use a separate, server-side coordinate lookup based on the **comprehensive** timezone-boundary-builder product. `geo-tz/all` is a viable adapter; its default entry point uses zones merged since 1970. Pin the package, boundary release and checksum, return every candidate at a border, and permit an explicit IANA-zone or UTC-offset override. Keep the large indexed geography outside the browser bundle. [geo-tz entry points](https://github.com/evansiroky/node-geo-tz#entry-points).

The comprehensive boundary product retains more zone identities than its reduced products, but it is an approximate geography, not a dated atlas of every 1900–2100 political boundary. The code generator uses MIT; the generated timezone database uses **ODbL-1.0**. Preserve attribution and the applicable database licence and provide derivative-data preparation/source where required. [Boundary variants](https://github.com/evansiroky/timezone-boundary-builder#different-types-of-release-data-products), [Data licence](https://github.com/evansiroky/timezone-boundary-builder/blob/master/DATA_LICENSE).

IANA explicitly limits reliable worldwide historical coverage, particularly before 1970; `backzone` is less reliable. A successful lookup cannot certify a historic birth record. Preserve provenance and user corrections and mark uncertain civil time. Future rules through 2100 are projections of the pinned release, which may later change. [IANA scope and accuracy](https://data.iana.org/time-zones/theory.html).

## Credential-free development lookup

Use the replaceable Open-Meteo geocoding search adapter for noncommercial development: its search endpoint needs no key and returns WGS84 city coordinates and an IANA-zone candidate. Attribute Open-Meteo and GeoNames. Validate and resolve that candidate through the pinned rule/geography layers; it is not itself a historical conversion service. Do not send birth dates or names. [API and attribution](https://open-meteo.com/en/docs/geocoding-api).

The free API has noncommercial and request-volume conditions. Cache repeated queries, cancel superseded requests, use explicit search submission, and preserve manual coordinate/zone entry on failure. Commercial hosting requires an eligible paid/self-hosted/replacement provider configuration. Open-source code status alone does not establish noncommercial use. Provider limits and availability must be checked for deployment. [Open-Meteo service terms](https://open-meteo.com/en/terms).

Public Nominatim is not the default. Its policy disallows autocomplete and imposes application-wide rate, identification, and attribution requirements, including special restrictions for AI-generated generic integrations. Any future adoption must deliberately meet that policy. [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).

## Content and sky assets

Maintain independent source records for calculation definitions, astronomy facts, tradition descriptions, and evidence statements. A citation is permission to link, not permission to copy prose. Write original concise explanations; record exact sections supporting each substantive claim. Body-in-sign and body-in-house coverage requires 120 entries each, with claim-level sources and an explicit review status. A populated schema cannot substitute for editorial support.

M3 ships an attributed magnitude ≤5.5 subset of HYG v4.1, pinned to source commit `c7f7f883fe678cc7680169a50ccd7dcc49b060ce` and source/derived SHA-256 hashes. Its 2,865 stars retain J2000 Cartesian positions and pc/year velocities. Directions propagate linearly with catalogue proper motion; annual aberration/parallax, light deflection, extinction and variable brightness are omitted. HYG's stated zero radial-velocity assumption remains where a measurement is unavailable. The derived catalogue remains **CC BY-SA 4.0**; application AGPL does not replace this data licence. `scripts/prepare-sky-data.mjs` reproduces the extraction and `src/lib/scene/data/sky-data-manifest.json` records notices and changes. [Pinned HYG documentation](https://github.com/astronexus/HYG-Database/blob/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/README.md), [Pinned licence](https://github.com/astronexus/HYG-Database/blob/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/LICENSE).

M3 uses Pierre Barbier's Delporte boundary compilation and label centres under **CC BY-SA 4.0**, with author attribution, changes, source hashes and derived hashes in the same manifest. The author-provided J2000 samples follow the B1875 meridian/parallel boundaries through the documented transformation; the app does not replace original small-circle segments with arbitrary great-circle endpoint joins. Eighty-nine polygon pieces represent 88 constellations, retaining both Serpens regions. No constellation artwork is copied. [Boundary method and data](https://pbarbier.com/constellations/boundaries.html), [Explicit reuse terms](https://pbarbier.com/terms.html).

## Evidence needed before release

| Item | Required evidence |
|---|---|
| Calculation engine | Exact upstream source, wrapper/build provenance, native/WASM comparison, all ten bodies/seven systems, explicit failure and fallback handling |
| Data files | Original URLs, coverage, sizes, checksums, applicable notices, reproducible asset manifest |
| Historical time | Locked rule version/hash, historical-build decision, gap/fold/non-hour/second-offset fixtures, geographic ambiguity/override checks |
| Online lookup | Validated response/error handling, credentials-free local path, production provider configuration and attribution |
| Sky and content | Asset/source manifest, confirmed reuse terms, epoch policy, complete sourced content coverage |
| Performance | Saved measured environment, run parameters, cold/warm timings, bytes, memory method and batch throughput |

Targets in the implementation plan remain targets until measurements are saved. A documentation source check, installed dependency, or successful build does not establish numerical accuracy, public-service suitability, or measured browser performance.
