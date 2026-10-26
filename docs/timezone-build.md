# Reproducible historical timezone data

The application loads a committed, custom Moment-compatible dataset generated
from **IANA tzcode/tzdata 2026e** with the upstream build policy
`PACKRATDATA=backzone PACKRATLIST=zone.tab DATAFORM=main`. It retains the additional
histories for the identities listed in `zone.tab`, including Amsterdam, Aden,
and Accra. Every tailored name gets its own packed record; no reduction based on
post-1970 equivalence is applied.

The ordinary Moment bundle and Python `tzdata` package both use compilation
defaults that omit these additional histories. The application therefore imports
Moment's no-data entry point and loads only this custom artifact. Code needing
zone names or UTC-to-civil labels must use `timeZoneDatabase` exported by
`src/lib/time/civil-time.ts`; importing the main `moment-timezone` entry point can
load its ordinary dataset over the shared singleton.

## Build and verification

Normal development uses the committed JSON and requires no compiler or Python.
Check its manifest and representative known historical/future fixtures with:

```text
node scripts/build-timezones.mjs --check
```

To regenerate from source, install the pinned Emscripten **4.0.23** toolchain and
Python **3.13.x**. A local `.tools/emsdk` checkout and its bundled Python are
detected automatically; `EMSDK` and `EMSDK_PYTHON` override these paths. POSIX awk
is required for IANA's own tailoring script. On Windows, the script detects
`C:/Program Files/Git/usr/bin/awk.exe`; `AWK` can specify another compatible awk.
Run:

```text
npm ci
node scripts/build-timezones.mjs
node scripts/build-timezones.mjs --check
npm test -- tests/domain/civil-time.test.ts tests/domain/historical-timezones.test.ts
```

The build downloads two exact IANA archives and verifies their recorded SHA-256
hashes before using them. Downloads, extracted sources, the compiler, TZif files,
and unpacked intermediates stay in ignored `.cache/timezones/2026e`; no timezone
toolchain is shipped to the browser. `src/lib/time/data/manifest.json` records the
URLs, hashes, tailoring policy, compiler flags, coverage, counts, and output hash.

1. Run the unmodified upstream `ziguard.awk` with the selected PACKRAT policy.
2. Compile unmodified `zic.c` to build-only Node/WASM using Emscripten. The small
   `native/zic-portability.c` shim makes unsupported Node/WASM filesystem links
   report `ENOTSUP`, allowing zic's existing byte-copy fallback for aliases.
3. Run `zic -b fat -r@-2240524800/@4165516800`. These bounds are 1899-01-01 through
   2102-01-01, with a guard year on each side of the application range. zic expands
   recurring future rules to the upper boundary. The app does not implement its
   own POSIX rule interpreter or freeze zones at the 32-bit 2038 boundary.
4. Parse the TZif 64-bit block into offset/abbreviation periods. Independently
   compare each period's start, following second, and final second against
   Python's public `ZoneInfo.from_file` implementation reading those same TZif
   files. The recorded build verified **64,774 periods across 598 identities**.
5. Use the pinned Moment 0.6.5 packing utility and verify every packed period
   round-trips to the same offset, abbreviation, and transition millisecond.
   Packing retains **one-second** precision, including fractional-minute offsets.

The output is **402,780 uncompressed bytes**. Its SHA-256 is recorded in the
manifest; regenerate twice and compare the output hash when changing the build.
No build timestamps or absolute machine paths enter the generated artifacts.

## Reference fixtures and limits

For local noon on 1900-01-01, the pinned source yields:

| Identity | Offset east of UTC | UTC reference |
| --- | --- | --- |
| Europe/Amsterdam | +00:19:32 | 11:40:28 |
| Asia/Aden | +02:59:54 | 09:00:06 |
| Asia/Riyadh | +03:06:52 | 08:53:08 |
| Africa/Accra | −00:00:52 | 12:00:52 |
| Europe/Paris | +00:09:21 | 11:50:39 |

Regression tests also preserve Amsterdam's 28-second gap in 1937, Aden's
six-second gap in 1950, Paris's second-resolution fold in 1911, modern DST
folds/gaps, skipped days, and future rules at 2100.

These fixtures establish correct use of the selected dataset. IANA describes
backzone as out-of-scope and often uncertain. Retaining its histories does not
certify the accuracy of a historical birth record or reconstruct dated political
boundaries. The application continues to display historical uncertainty, retain
manual offset overrides, and mark future rules as projections.

IANA's code and data used here are public domain according to their distribution
notice; preserve the archive/source references. Moment and its packing utilities
use MIT. No Python or Emscripten runtime is included in the application artifact.

Primary sources:

- [IANA 2026e release and downloads](https://www.iana.org/time-zones/releases/2026e).
- [IANA build policy for PACKRATDATA/PACKRATLIST](https://github.com/eggert/tz/blob/2026e/Makefile).
- [IANA historical backzone records](https://github.com/eggert/tz/blob/2026e/backzone).
- [IANA scope and historical accuracy](https://data.iana.org/time-zones/theory.html).
- [Moment 0.6.5 source compilation inputs](https://github.com/moment/moment-timezone/blob/0.6.5/tasks/data-zic.js).
- [Moment 0.6.5 second-precision packing implementation](https://github.com/moment/moment-timezone/blob/0.6.5/moment-timezone-utils.js).
- [Python tzdata 2026.5 default build](https://github.com/python/tzdata/blob/2026.5/update.py).
