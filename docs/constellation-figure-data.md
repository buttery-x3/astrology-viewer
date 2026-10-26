# Modern Western constellation figures

The M10 figure layer imports only the 88 constellation topologies in Stellarium
v26.2's `skycultures/modern/index.json`, pinned to release commit
`2b10b1a3bb534eb4e7586751054bf67b36c22e53`. The unmodified source and its full
description are retained in `vendor/stellarium-modern/`. Their Git blob IDs,
SHA256 hashes and byte lengths appear in `src/lib/scene/data/figure-manifest.json`.
The upstream description explicitly assigns **CC BY-SA 4.0** to text/data;
illustrations use a separate licence and are not included.

There are 219 source polylines, 695 ordered segments and 710 distinct HIP
endpoints. The import joins each HIP identifier to exactly one row of the
existing HYG v4.1 source, using its already pinned SHA256. It does not find a
nearby star or omit an unresolved endpoint. Every endpoint resolves uniquely.
Of those endpoints, 701 already occur in the magnitude ≤5.5 subset; nine support
stars are retained separately, with the faintest at magnitude 6.65. This does
not alter the default 2,865-star catalogue or import other Stellarium asterisms.
Serpens retains its two disconnected paths under one constellation identity.

The compact derived asset stores ordered HYG-ID paths, the HIP/HYG crosswalk and
the nine support records. Both the existing star renderer and figure endpoints
use `catalogueStarDirection`: mean J2000 axes, the same catalogue epoch and linear
Cartesian proper motion. Figures do not receive a second precession rotation.
Short great-circle arcs between endpoints are an original display convention,
not official IAU boundaries or a claim that one cultural figure is universal.
When the general star layer is off, the figure layer draws its 710 endpoint dots;
when it is on, only the nine additional support dots are needed.

Reproduce from the original catalogue already fetched for the M3 sky build:

```powershell
$env:HYG_SOURCE_PATH='D:\path\to\verified\hygdata_v41.csv'
node scripts/prepare-constellation-figures.mjs --write
node scripts/prepare-constellation-figures.mjs
node scripts/verify-assets.mjs
```

Without the environment override, the source path is `.tools/sky-source/`.
The command does not fetch floating upstream data. Missing data, changed source
bytes, ambiguous identifiers and missing endpoints fail explicitly. Normal
offline tests and asset verification use the committed compact asset and
retained Stellarium source; they do not require the 33 MB HYG source or network.

Attribution remains accessible through the data manifest/source inspector and
the standalone release's `licences/data-terms/Stellarium-modern-NOTICE.txt`.
The derived data remains CC BY-SA 4.0, alongside the HYG source's own CC BY-SA 4.0
terms. Application AGPL metadata does not replace either data licence. This is
an engineering provenance record, not a new assertion of legal clearance.

Unit tests compare every ordered connection to the retained raw source and
check exact endpoint/dot alignment at 1900, J2000 and 2100. Renderer tests cover
independent visibility, linked selection, metadata, responsive line width and
stable reusable buffers. Actual integrated canvas/browser validation is recorded
by M10 integration; an isolated renderer test is not evidence of that workflow.
