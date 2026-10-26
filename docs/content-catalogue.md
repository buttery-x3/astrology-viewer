# Static interpretation and concept catalogue

The versioned catalogue contains **320 entries and 90 attributed source records**:
120 body-in-sign placements, 120 body-in-house placements, 65 original concepts
and 15 astrocartography entries. The
concept set includes ten body identities/roles, twelve signs, twelve houses, five
major aspects, seven house systems, thirteen spatial references/angles and six
evidence/time/frame/convention concepts. All application text is local static
content; no visitor input is sent to a content service and no interpretation is
generated at runtime.

`src/lib/content/data/catalogue.json` and `sources.json` are the reviewed source
of truth. The curation provenance file records the research-input fingerprints
and review method. These historical cache paths identify the reviewed inputs;
the ignored research cache is not needed to run, build or validate the release.
`manifest.json` freezes catalogue version, coverage, review date and SHA256 hashes.

`wikipedia-links.json` is a separate, navigation-only map for all 80 non-placement concepts/themes plus
Earth, observer location and constellation regions. It adds general concept
entry points without importing article prose/images, claiming placement-specific
support, or changing the 89 claim sources and canonical-page word budgets.
`getWikipediaOverviews` exposes these fixed links; the inspector labels them
"Wikipedia concept overview" separately from each claim's primary/practitioner
citation. The manifest hashes the navigation file independently.

Historical project-rule citations use reviewed M8 commit
`0ea709fdff33ac11aed696fcb0b60f17e0fad477`, after checking every target path at
that revision. The application's source footer and catalogue-record link instead
identify the actual build revision; historical citation pins do not substitute
for the corresponding source of a later release.

## Claim roles and attribution

M10 catalogue version 1.1.0 preserves every original 305 card's title, summary and
claim text. It adds `astro:overview`, ten `astro:body:*` themes and four
`astro:angle:ac|dc|mc|ic` themes, all labelled traditional interpretation.
Theresa Reed's bylined Almanac overview/planetary/cardinal passages support the
154-word combined original summary. Planet/angle cards reuse those exact
entries; they do not invent a separate prediction for each of the forty pairs.
The page's suggested influence distance, parans and credited images are excluded.

`getSupplementalClaim` exposes immutable registered explanatory text, including
the original construction-stage claims. `project-explanations.ts` supplies the
original M10 feature/layer paragraphs through `getProjectExplanation`; exact
code/registry correspondence is validated. Hiding citations in a hover preview
does not remove the underlying claim references or the inspector's attribution.
The fifteen new Wikipedia links are navigation only, to the locational astrology
article's Astrocartography section; they supply no placement-specific evidence.

Each substantive card paragraph has its own text, role, source IDs and exact
source-section locator. The summary is the same claim text joined for alternate
presentation; it is not additional unsourced prose. The six roles are astronomy,
traditional interpretation, calculation method, scientific evidence, civil-time
data and explorer convention. A body's physical identity and attributed
astrological role remain separate claims, even within the same card. Placement
claims retain their practitioner source and tradition rather than asserting a
measured personality or predictive effect.

Cafe Astrology source metadata distinguishes site authorship from an explicit
individual article byline. Skyscript review metadata records where the actual
primary-page paragraph was read through indexed text during publisher outages.
The scientific-evidence card reports Carlson's specific chart/personality matching
task and its tested-condition limit, without claiming one experiment decides
every possible astrological proposition. Short original paraphrases and source
links are used; no source article or image is bundled. Project and data licences
do not relicense the referenced publishers' original articles.

The catalogue's `reviewed` status records agent source curation and engineering
checks. It does not establish a completed human editorial review. The approved
plan separately requires a human to check each cited passage against its claim;
that claim-to-passage review remains a release gate. The recorded Skyscript
publisher outages and indexed-text review cases must remain visible to that
reviewer and receive direct passage verification when available.

## Runtime interface and undefined placements

Import `getContent`, `getSource` and `getClaimSources` from `src/lib/content`.
Every exposed record is deeply frozen. Local startup validation checks structure,
review status, exact inventory, metadata identity, attribution, source references
and combined canonical-page budgets before the catalogue can be used.

`resolveBodyContent(body, houseResult, provisional)` uses the calculated longitude
and the existing house classifier. It returns the physical/body, sign and two
specific placement cards. An undefined or absent house result returns null house
cards and an explicit reason while retaining body/sign content. Provisional time
adds a qualification; it does not invent a more certain birth time or hide the
underlying convention. Unsupported content IDs return undefined rather than a
generated replacement.

## Editorial budgets across the application

`word-budgets.json` counts each unique logical claim once per canonical source
page. Repeated summary/claim representations and identical M3 scene definitions
do not count twice. URL fragments and tracking queries share a page budget;
Skyscript host and legacy path aliases collapse. Semantic PDF download query
parameters are retained so different documents are not conflated.

The supplementary registry includes M5 construction explanations/shared notes
and CalculationProvenance's three time-model branches plus coordinate note. They
are not additional catalogue entries. This prevents prose outside cards from
silently consuming a second budget on the same external source page. Current
combined Swiss budgets are 175 words for pinned `swehouse.c`, 163 for
`swisseph.htm` and 92 for `swephprg.htm`. Every one of the 91 canonical pages stays
within its 180-word editorial target and 200-word hard limit.

FeatureInspector's schematic observer/sign explanations and HouseInspector's
membership/display explanations cite the owned coordinate/chart/house-geometry
rules. Those product conventions are not attributed to the external Swiss
manual. Numerical provenance and actual method explanations retain their
separate numerical references.

## Validation and updates

Run `npx tsx scripts/validate-content.ts`. The command validates the catalogue,
verifies source-code correspondence for reused M3 claims, M5 explanations/notes
and provenance paragraphs, recomputes canonical-page budgets and checks the
manifest hashes. CI runs this command independently of the browser. It performs
no network requests; a successful HTTP response cannot establish editorial
support for a claim.

After an intentional, reviewed content update, run the same command with
`--write` to regenerate budgets and manifest hashes. Do not use regeneration to
bypass missing coverage, source/role errors or excessive page budgets. Future
editorial releases should update the catalogue version and review date together.
Controlled link maintenance can check external availability separately; a
temporary publisher outage does not cause runtime content fetching or missing
local explanatory text.

`tests/content` covers all 240 placement resolutions, exact coverage, claim-role
separation, mutation resistance, undefined/provisional states, source/budget
failures and aspect selection across orb crossings. The aspect presentation
module keeps longitude-based eligibility separate from the actual three-
dimensional sky angle and retains selected pair details outside the current orb.
