# Earth projection and astrocartography contract

Two independent geometric results share a globe renderer. Both follow the displayed committed snapshot. No camera, hover or selection input enters their calculations.

`earth-projections.ts` projects the primary chart's existing constant-ecliptic-longitude partition. Every original fixed-J2000 surface direction is rotated into the true equatorial frame of date, then by negative GAST into Earth-fixed axes. The inverse applies those rotations in reverse order. Indexed intervals, clockwise polar partitions and explicit undefined results are preserved. The projection does not calculate relocated houses for geographic points. Near the projected ecliptic poles, house picking returns an explicit ambiguous-longitude result.

`astrocartography.ts` uses the body's apparent geocentric true-equatorial coordinates of date and matching apparent sidereal time. MC/IC use hour angles0°/180°. AC/DC are the actual body's geometric rising/setting loci, retaining body latitude. No refraction, terrain or topocentric parallax is introduced. Unlike a zero-ecliptic-latitude projection, this does not generally make a body's longitude equal the chart's ecliptic ASC/DSC.

For `L = RA − GAST` and declination δ, the body points toward Earth-fixed vector `p=(cosδ cosL, cosδ sinL, sinδ)`. Every geometric horizon location lies on `u·p=0`. Define `e=(−sinL,cosL,0)` and `q=(−sinδ cosL,−sinδ sinL,cosδ)`. The terminator is `u(t)=q cos(t)+e sin(t)`; negative t is the rising half, positive t the setting half. This parameterisation remains conditioned at tangencies and for declination0°, avoiding latitude-by-latitude `acos(−tanφ tanδ)` singularities. The two halves meet at tangent endpoints. A body exactly at a celestial pole has no ordinary rise/set crossing or unique upper/lower transit and returns explicit undefined lines. Geographic pole endpoints have conventional longitude, not an invented unique local meridian.

Each curve is sampled with a maximum2° central step by default, preserving exact great-circle conditions at vertices. Dateline crossings are split at an exact same-plane/y=0 intersection; duplicate zero-length seam segments are removed. Geographic data is unscaled and independent of rendering. `riseSetState` explicitly distinguishes ordinary crossing, tangency, always above/below, and an entire on-horizon degeneracy.

All domain vectors are **Earth-fixed astronomical axes**: +X Greenwich at the equator, +Y90°east, +Z geographic north. The renderer applies `astronomicalToThree` exactly once and attaches its group under the application's already rotated Earth group. Do not apply the date/GAST rotation again. Renderer entity anchors are Earth-local Three.js positions; convert them to world positions for camera focus. The root scene must call `faceCamera(camera)` before label layout/render and reject geographic raycaster intersections for which `isSurfaceHitVisible(worldPoint)` is false. Shader clipping alone cannot reject CPU raycast hits. This preserves front-side geographic identity with translucent Earth as well as opaque Earth.

The renderer owns64 stable entities:12 house regions,12 projected cusps, and40 body/angle lines. Settings and filters affect visibility/emphasis only. Turning off house projection cannot disable valid astrocartography. Astro paths cache only instant/GAST/geocentric-body dependencies; changing observer or house system retains the same geographic path bytes. House projection caches its actual frame/partition dependencies. Mesh and line buffers reuse capacity, and disposal is idempotent.

## Native reference evidence

`tests/fixtures/astrocartography-native.json` contains320 native reference samples: ten bodies × four line types × four dates × two ordinary points per line. Dates cover1900, the Melbourne1987 regression, the2024 eclipse and2100. The generator first computes geographic loci from the application's WASM snapshot, then passes those geographic coordinates to a separate Windows x64 executable built from unchanged pinned Swiss C sources. That executable computes geocentric equatorial coordinates independently and calls `swe_azalt` for true geometric altitude. Native calculations one second before/after each AC/DC sample verify rise/set direction.

Maximum native geometric-altitude residual was **1.1291e−13°**; maximum meridian hour-angle residual was **1.1369e−13°**. Both are below the planned1e−6° target. These are implementation/coordinate-convention checks using the same Swiss model, not independent physical ephemeris validation. The fixture records the probe/source hashes, native version2.10.03, flags2306, UT1/TT, GAST, coordinates and raw native altitude/azimuth. Source/probe hashes are checked by the normal test suite.

Do not use `swetest -fh` as an equivalent reference: its altitude output internally requests `SEFLG_TOPOCTR` before `swe_azalt`, even when ordinary printed equatorial coordinates are geocentric. The reference probe deliberately passes flags2306 and no topocentric correction. Swiss azimuth is measured south-to-west; the fixture records that convention explicitly and does not present it as the application's north-through-east azimuth.

To regenerate on Windows, use an existing Visual Studio x64 Developer Command Prompt from the repository root (the compiler is only required for regeneration):

```cmd
mkdir .cache\m10-native
cl /nologo /O2 /MD /D_CRT_SECURE_NO_WARNINGS /Ivendor\swisseph /Fo.cache\m10-native\ /Fe.cache\m10-native\astro-probe.exe tests\fixtures\astrocartography-native.c vendor\swisseph\swedate.c vendor\swisseph\swehouse.c vendor\swisseph\swejpl.c vendor\swisseph\swemmoon.c vendor\swisseph\swemplan.c vendor\swisseph\sweph.c vendor\swisseph\swephlib.c vendor\swisseph\swecl.c vendor\swisseph\swehel.c
npx tsx scripts/generate-astrocartography-fixtures.ts
```

Ordinary tests use the checked-in reference and need no native compiler. Synthetic tests independently cover cardinal solutions, both hemispheres, tangent/circumpolar/pole cases, dateline splits, full frame round trips and all existing native house partitions.

Primary formula/convention references: [USNO altitude and azimuth](https://aa.usno.navy.mil/faq/alt_az), [Swiss Ephemeris horizontal coordinates and apparent/geocentric flags](https://www.astro.com/swisseph/swephprg.htm), and the existing [coordinate contract](coordinate-contract.md).
