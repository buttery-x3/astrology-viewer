# Content, source access and licence audit

Reviewed during M9 integration on 26 October 2026. This is an engineering inventory of supplied notices and observed provenance, not a new claim of legal clearance. The final production source revision is recorded by the release-build process, separately from the historical contract citation below.

## Claim support and navigation

The catalogue has 305 fixed reviewed cards and 89 attributed claim sources. Body-in-sign and body-in-house coverage remains 120 each; 65 concepts cover the ten bodies, twelve signs/houses, five aspects, seven systems and reference/evidence/time concepts. Claims retain role, source passage, author/publisher, tradition and review date. Existing publisher-access limits in curation-provenance remain explicit. A release link probe does not replace reading a supporting passage.

Here, `reviewed` records agent source curation and engineering validation; no completed human editor is claimed. Plan section 10's human claim-to-passage review remains a release gate for all 305 entries and supplementary explanatory claims. The human reviewer must retain and resolve the documented publisher-outage/indexed-text cases rather than treating automated coverage, source availability or a passing budget check as editorial approval.

Wikipedia links are concept navigation, separate from claim citations. The integrated map covers all 65 concepts plus Earth, observer and constellation overview routes. Requested article URLs were opened and their topics checked during preparation; known redirects are recorded in the navigation manifest. No Wikipedia prose or images are imported. The links do not verify a visitor's calculated numbers or establish an interpretive effect; current primary references and practitioner citations continue to support their existing respective roles.

No substantive claim text changed during release pinning. The canonical-page budget/hash manifest was regenerated with the existing validator: all 91 canonical source pages remain within their limits. Supplementary accounting for M3 definitions, M5 construction stages and the calculation provenance panel is retained. Navigation data receives its own file hash without becoming a new claim source.

## Corresponding source

Historical project citations are pinned to reviewed M8 merge `0ea709fdff33ac11aed696fcb0b60f17e0fad477`. GitHub file reads verified `IMPLEMENTATION_PLAN.md`, `docs/coordinate-contract.md`, `docs/house-construction-contract.md`, `src/lib/domain/chart.ts`, `src/lib/domain/house-geometry.ts` and the prior catalogue at that exact revision. The previous `8e6f7fac` references were valid historical M5 sources; this is controlled release pinning, not a claim that those paths were broken.

The application's Source and licences link has a different purpose: it must identify the actual built release revision, including new M9 files. Inject that revision at build time or resolve an immutable release tag. Do not substitute the earlier M8 citation SHA for the entire M9 corresponding source. A local development fallback may remain clearly documented. Retain source, wrapper, build instructions, lockfile and asset preparation manifests together.

## Separate licence scopes

| Component/data | Existing recorded terms and release check |
|---|---|
| Owned application and wrapper | AGPL-3.0-only application licence; corresponding source access required by the chosen distribution/service model. Retain the Swiss vendor notice independently. |
| Swiss Ephemeris source and model files | Chosen upstream AGPL route, exact vendored revision and file checksums. Preserve the original dual-licensing/copyright notice and upstream licence text; application metadata does not replace it. |
| Browser/server dependencies | `docs/third-party/npm-production-notices.json` records all 53 installed production package identities, the lockfile hash and supplied notice bytes. Fifty provide standalone licence/notice files. Three upstream packages supply a declaration/banner without a complete standalone licence file; these cases are explicit in the inventory and accompanying README. Development-only tooling has its own licence scope. |
| HYG star subset | CC BY-SA 4.0 per the pinned HYG manifest; preserve attribution, extraction changes, hashes, epoch/proper-motion policy and reproducible preparation source. |
| Barbier constellation boundaries/centres | CC BY-SA 4.0 per the source manifest; retain author, exact files, changes and the boundary-transform policy. |
| Natural Earth coastline | Recorded public-domain data terms and Made with Natural Earth attribution; preserve the pinned revision/hash and geographic limitation. |
| IANA historic timezone rules | Retain the pinned release/archive/build provenance, included licence information and explicit uncertainty policy; current geography is not a dated atlas. |
| Geographic timezone database | Comprehensive timezone-boundary-builder via geo-tz/all uses ODbL 1.0 data independently of MIT generator/runtime code. Preserve OpenStreetMap/data attribution and applicable database notices/source obligations. |
| Place lookup | Open-Meteo/GeoNames attribution and noncommercial free-service conditions remain operational requirements. Open-source code status alone does not establish eligibility for commercial free-service use. |
| NASA/JPL Horizons fixtures | Public numerical API responses retained as independently generated references, with request URLs, raw hashes and source identities. Acknowledge Horizons. Do not claim NASA/JPL endorsement or silently apply the owned-code AGPL notice to third-party response text. |
| Wikipedia navigation | Article-title links only. No article text/media is redistributed; future copied content would require its own applicable reuse review. |

Existing primary references for these recorded terms are in `docs/data-and-licensing.md` and the engine/sky/timezone manifests. The inaccessible attempted SSD terms URL is not treated as verified evidence. The official Horizons manual/API documentation and NASA/JPL policy references should remain distinct from any unverified blanket public-domain claim about every returned header.

## Reproduction and remaining external evidence

Run `npx tsx scripts/validate-content.ts`, `node scripts/prepare-third-party-notices.mjs --check` and `npx vitest run tests/numerical/horizons.test.ts tests/content/wikipedia.test.ts`. These checks are offline and use actual installed/committed inputs. The notice inventory deliberately fails on a newly missing upstream notice rather than silently generalising its three reviewed shorthand cases.

The [Horizons report](horizons-validation.md) records the measured 80-row results and frame/time limits. Production source access is checked by the release-build workflow against the actual production revision. Browser/GPU/manual screen-reader/user-evaluation evidence belongs in the release verification report; automated checks do not claim unperformed manual research or browser testing.
