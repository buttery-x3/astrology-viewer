# Reproducible ephemeris build

The application owns `native/spatial_ephemeris.c` and vendors the unmodified C/header files needed from Swiss Ephemeris `v2.10.3bfinal`, commit `f4dcd18e8005dde95fd8a8d2312ed12f9accd1b0`. Preserve `vendor/swisseph/LICENSE` and `agpl-3.0.txt`. The project uses the AGPL route.

Install Emscripten **4.0.23**, following its official emsdk instructions. A checkout at `.tools/emsdk` is supported; otherwise set `EMSDK` to the SDK directory. Run `emsdk install 4.0.23` and `emsdk activate 4.0.23`. Use an installed Python 3 runtime (set `EMSDK_PYTHON` if it is not on PATH).

```text
npm ci
node scripts/build-ephemeris.mjs
npm test
npm run check
npm run m0
```

The generated ES module and WASM are committed so normal app builds do not require a C compiler. `build-manifest.json` records the exact compiler, flags, binary byte lengths, and SHA-256 hashes. Runtime data files are checked against `public/data/ephemeris/manifest.json` before mounting in MEMFS. No runtime CDN is used.

The reference fixture generator uses the official Windows `swetest.exe` from the same source revision; place it at `.tools/swetest.exe` and run `node scripts/generate-native-fixtures.mjs`. It uses `-utc`, not `-ut`, matching the binding's UTC-to-TT/UT1 boundary, and explicitly pins `-tidacc-25.8` to the binding's fixed DE431 tidal model. Without the explicit model, the CLI recomputes TT differently after UTC conversion. Native versus WASM tests establish integration agreement; they do not independently establish physical-model accuracy.

Compiler installation and generated-output checks are separate from standard TypeScript application development. No local toolkit directories are committed.
