# Static interpretation and concept catalogue

The versioned catalogue contains **305 entries and 89 attributed source records**:
120 body-in-sign placements, 120 body-in-house placements and 65 concepts. The
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

## Claim roles and attribution

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
