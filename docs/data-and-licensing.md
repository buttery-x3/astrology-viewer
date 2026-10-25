# Data, licensing, and provenance readiness

Reviewed 25 October 2026. This records decisions and source checks for M0; it is not a claim that every future asset has been downloaded, validated, or cleared for release. Exact installed versions and asset checksums belong in the build/data manifests. User decisions: AGPL-compatible open source, 1900–2100 inclusive, online location lookup, all 240 placement interpretations, and concise interactive construction guides.

## Astronomy and application source

Select the Swiss Ephemeris AGPL route. Preserve Astrodienst's copyright and dual-licensing notices, retain the upstream version/revision and the narrow wrapper's source, and publish reproducible build instructions with the distributed application. The upstream notice requires choosing the licence before distribution or public service activation. The application's AGPL licence does not replace notices for third-party components. [Upstream licence](https://github.com/aloistr/swisseph/blob/master/LICENSE), [AGPL-3.0 text](https://www.gnu.org/licenses/agpl-3.0.html).

Provide an obvious **Source and licences** link in the released application that resolves to its corresponding release source, including wrapper, build scripts, lockfile, and necessary data preparation instructions. Review the exact shipped revision and assets before tagging a release. Avoid a generic repository link that later points only to unrelated HEAD.

For the ten requested bodies, evaluate the planetary and lunar Swiss files covering the full interval; do not fetch the asteroid catalogue. Store original URL, upstream revision, SHA-256, byte length, coverage, and applicable notice for each shipped file. Astrodienst identifies its GitHub `ephe` directory as an official download location. Actual coverage must be checked through the engine/file metadata and boundary fixtures. Inspect the returned ephemeris flags; a missing file that falls back to another model must fail the strict Swiss mode. [Official file locations](https://www.astro.com/ftp/swisseph/ephe/).

## Civil time and geographic identity

Use a dedicated civil-time adapter with **pinned rule data**. Load the full `moment-timezone` dataset initially; its ten-year and 1970–2030 builds do not meet the release range. Record the exact lockfile package, `moment.tz.version`, `moment.tz.dataVersion`, packed-data hash, supported interval, and build options. Preserve historic second-level offsets. Enumerate possible offsets and round-trip the requested civil fields to detect gaps and folds; do not accept Moment's default ambiguous-time choice. [Moment Timezone data loading and zone API](https://momentjs.com/timezone/docs/).

Full year coverage and historical zone identity are separate questions. Moment's upstream data compilation lists ordinary tzdb region files and `backward`, with no `backzone`. A pinned full bundle alone therefore does not establish retained pre-1970 histories for every geographic identifier. Assess a reproducible custom packed build from an exact IANA source release, using `PACKRATDATA=backzone` and `PACKRATLIST=zone.tab`, and test histories that ordinary links merge. Treat this as a data-build verification gate; do not describe it as completed until the artefact and reference fixtures exist. [Moment compilation source](https://github.com/moment/moment-timezone/blob/develop/tasks/data-zic.js), [IANA build options](https://github.com/eggert/tz/blob/main/Makefile).

Use a separate, server-side coordinate lookup based on the **comprehensive** timezone-boundary-builder product. `geo-tz/all` is a viable adapter; its default entry point uses zones merged since 1970. Pin the package, boundary release and checksum, return every candidate at a border, and permit an explicit IANA-zone or UTC-offset override. Keep the large indexed geography outside the browser bundle. [geo-tz entry points](https://github.com/evansiroky/node-geo-tz#entry-points).

The comprehensive boundary product retains more zone identities than its reduced products, but it is an approximate geography, not a dated atlas of every 1900–2100 political boundary. The code generator uses MIT; the generated timezone database uses **ODbL-1.0**. Preserve attribution and the applicable database licence and provide derivative-data preparation/source where required. [Boundary variants](https://github.com/evansiroky/timezone-boundary-builder#different-types-of-release-data-products), [Data licence](https://github.com/evansiroky/timezone-boundary-builder/blob/master/DATA_LICENSE).

IANA explicitly limits reliable worldwide historical coverage, particularly before 1970; `backzone` is less reliable. A successful lookup cannot certify a historic birth record. Preserve provenance and user corrections and mark uncertain civil time. Future rules through 2100 are projections of the pinned release, which may later change. [IANA scope and accuracy](https://data.iana.org/time-zones/theory.html).

## Credential-free development lookup

Use the replaceable Open-Meteo geocoding search adapter for noncommercial development: its search endpoint needs no key and returns WGS84 city coordinates and an IANA-zone candidate. Attribute Open-Meteo and GeoNames. Validate and resolve that candidate through the pinned rule/geography layers; it is not itself a historical conversion service. Do not send birth dates or names. [API and attribution](https://open-meteo.com/en/docs/geocoding-api).

The free API has noncommercial and request-volume conditions. Cache repeated queries, cancel superseded requests, use explicit search submission, and preserve manual coordinate/zone entry on failure. Commercial hosting requires an eligible paid/self-hosted/replacement provider configuration. Open-source code status alone does not establish noncommercial use. Provider limits and availability must be checked for deployment. [Open-Meteo service terms](https://open-meteo.com/en/terms).

Public Nominatim is not the default. Its policy disallows autocomplete and imposes application-wide rate, identification, and attribution requirements, including special restrictions for AI-generated generic integrations. Any future adoption must deliberately meet that policy. [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).

## Content and sky assets

Maintain independent source records for calculation definitions, astronomy facts, tradition descriptions, and evidence statements. A citation is permission to link, not permission to copy prose. Write original concise explanations; record exact sections supporting each substantive claim. Body-in-sign and body-in-house coverage requires 120 entries each, with claim-level sources and an explicit review status. A populated schema cannot substitute for editorial support.

Use an attributed real star catalogue with an explicit epoch and proper-motion policy. HYG is a candidate; its former GitHub project redirects future updates to Codeberg. Inspect the selected version's data licence and component provenance before extracting the bright-star subset. No HYG file is cleared merely by this recommendation. [Maintainer notice](https://github.com/astronexus/HYG-Database), [Current HYG home](https://codeberg.org/astronexus/hyg).

Constellation regions must use declared-frame boundary coordinates and record source/reuse rights separately from any artwork. The IAU defines 88 sky regions and does not prescribe stick figures. Link to its reference material; do not copy page imagery into the app without rights. [IAU constellation reference](https://www.iau.org/IAU/IAU/Astronomy-FAQs/Constellations.aspx).

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
