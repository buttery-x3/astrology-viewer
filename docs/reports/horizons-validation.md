# Independent Horizons fixture validation

All ten requested target centers were retrieved successfully for four fixed educational epochs. The integrated M9 harness repeated all 80 comparisons against newly calculated owned-engine snapshots. Its 81 tests pass: 80 numerical comparisons plus raw provenance/coverage verification. Stored historical engine snapshots are retained only as audit evidence, never used as numerical test expectations.

The owned Swiss engine passed every 60-arcsecond comparison. The largest same-label UT discrepancy is **13.879247 arcseconds**, for the Moon on 2100-01-01. Matching the engine's actual TT epoch reduces that case to a subarcsecond difference. Across all TT-aligned comparisons, the maximum is **0.560923 arcseconds**, for Uranus on 1900-01-01.

| Labelled input instant | Maximum separation, same-label UT | Maximum separation, TT-aligned |
| --- | ---: | ---: |
| 1900-01-01 00:00:00 | 0.560564″ | 0.560923″ |
| 2000-01-01 12:00:00 | 0.116485″ | 0.116485″ |
| 2026-10-25 00:00:00 | 0.061142″ | 0.061142″ |
| 2100-01-01 00:00:00 | 13.879247″ | 0.467685″ |

These are measured pairwise differences, not accuracy guarantees. The two runs comprise 40 comparisons each. No failed comparison was removed or loosened after observing the result.

## Reference conventions

Horizons observer quantity 31 provides apparent target-center longitude/latitude in the IAU76/80 ecliptic of date, including light-time, gravitational light deflection and stellar aberration. `CENTER=500@399` selects Earth's center; `APPARENT=AIRLESS` excludes atmospheric refraction. The requested Sun, Moon and planetary codes identify body centers, rather than substituting system barycenters. [JPL Horizons manual: major bodies, observing sites, quantity 31](https://ssd.jpl.nasa.gov/horizons/manual.html).

Horizons UT means UT1 before 1962 and UTC thereafter; unknown future leap seconds use the last known correction. The TT run instead uses each exact engine `julianDateTt`. Horizons and Swiss use different ecliptic/precession-nutation conventions, so subarcsecond residuals are retained rather than asserted to vanish. [JPL manual: time specification, reference frames, quantities 30–31](https://ssd.jpl.nasa.gov/horizons/manual.html).

Parameters use individually quoted numeric `TLIST` values, explicit `TIME_TYPE`, Gregorian calendar, labelled CSV and extra angular precision. Returned API signature **1.2** differs from the documentation's version heading **1.3**; the actual response shape was inspected and the parser explicitly accepts only the reviewed 1.2 signature. [JPL Horizons API: parameters, TLIST, output-version check](https://ssd-api.jpl.nasa.gov/doc/horizons.html).

## Actual provenance and limits

- Targets: Sun 10, Moon 301, Mercury 199, Venus 299, Mars 499, Jupiter 599, Saturn 699, Uranus 799, Neptune 899, Pluto 999. Every response's target ID, Earth-center header, geocentric site and airless flag are checked before comparison.
- Returned target/observer ephemeris source identifiers and the EOP file are preserved per response, not assumed globally. The responses use Earth source DE441; the outer-planet center solutions have their own identifiers, including `plu060_merged` for Pluto. Actual headers are in `fixtures.json` and unmodified raw responses.
- The 2100 engine input is explicitly `future-ut1-assumption`: ΔT is 93.182046 seconds. Horizons reports TDB−UTC of 69.183912 seconds at its same-label future epoch. These do not represent the same dynamical instant. The two runs retain this distinction instead of treating it as an angular-engine bug.
- The first TT query has a date label just before 1900 because the engine's historical ΔT is negative. The application input remains 1900-01-01 UT1-labelled. This is not an out-of-range application calculation.
- Output JD rounding is retained in each sample as `outputTimeDifferenceSeconds` and must remain under 0.864 milliseconds; this is far below the comparison's angular tolerance. The raw source JD and requested JD both remain available.
- The residual subarcsecond differences were not decomposed into individual ephemeris, frame-model and center-convention contributions. No explanation more precise than the evidence supports is claimed.
- Horizons is an external implementation and independently generated reference. Swiss and Horizons both draw on JPL dynamical ephemerides, so the results do not constitute independent validation of every underlying physical model. This audit principally checks the application's time/center/correction/frame integration.
- All requests use the four fixed public fixtures above. No user-entered date, birth time, observer location or chart is transmitted. The engine's dummy terrestrial observer is irrelevant to the geocentric longitudes/latitudes being compared.

## Files and offline reproduction

- `tests/fixtures/horizons/raw/*.json`: exact API response bytes and matching `.request.json` metadata with parameters, URL and retrieval date. Responses remain unmodified.
- `tests/fixtures/horizons/requests.json`: all twenty exact request URLs, raw SHA256 hashes, byte counts and actual API signatures.
- `tests/fixtures/horizons/fixtures.json`: forty UT plus forty TT-aligned longitude/latitude rows, source headers and source file identities.
- `scripts/horizons-reference.ts`: verifies raw hashes, API version, exact request parameters, target/site identity, row count, time alignment and numeric bounds; compares a newly calculated engine snapshot against each reference.
- `tests/numerical/horizons.test.ts`: checks complete provenance and all 80 current-engine comparisons offline.
- `scripts/validate-horizons.ts`: produces an optional fresh current-engine report. `comparison.json` retains the earlier audit; `current-comparison.json` records the repeated fresh-engine run.
- `scripts/prepare-horizons.ts` and `scripts/fetch-horizons.mjs`: explicit opt-in reference refresh tools writing only `.cache/horizons-refresh`. The fixed four educational dates cannot be replaced by visitor input.

From repository root:

```text
npx vitest run tests/numerical/horizons.test.ts
npx tsx scripts/validate-horizons.ts --report .cache/horizons-current-comparison.json
```

These commands do not use network access. A deliberate reference refresh starts with `npx tsx scripts/prepare-horizons.ts`, then `node scripts/fetch-horizons.mjs --allow-network`; requests are serial and existing files are retained only when their request arguments match. Review a refreshed response's source/time/frame conventions and raw provenance before promoting it into the tracked fixtures. CI uses reviewed committed responses. A changed API version or TT epoch model requires review; the harness does not silently loosen its checks or replace expected data.
