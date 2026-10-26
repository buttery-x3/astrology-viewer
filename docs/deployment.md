# Production release and hosting

The release artifact runs on Node **24.15 or later within major 24**. Ordinary `npm ci` and `npm run build` use committed WASM/data; Emscripten and `.tools` are only needed when rebuilding the numerical engine or civil-time data. `npm run preview` is a development preview. The production listener is the separately bundled `server.mjs` described here.

## Build the exact source revision

1. Install the locked dependencies with `npm ci` and run the repository checks.
2. Commit the reviewed source. The release builder refuses modified or untracked source files, identifies the commit and tree, builds the client/server into a new ignored directory, and checks the tree again after build hooks.
3. Run `npm run release:build`. The output is `.cache/releases/<40-character-commit>/`. A revision's output must not already exist; failed attempts are preserved for inspection. Use a fresh checkout/output directory when repeating a release.
4. Copy that complete directory to the deployment host, run `npm ci --omit=dev` inside it, then `npm start`. No compiler, development dependency, or source checkout is required to serve the artifact.

The generated package contains the built app, production server, dependency lock, retained notices, eight data/build identity hashes, and **the exact committed source archive**. The archive contains native source, wrapper, build/data preparation scripts, original notices and lockfile. Its hash and commit are linked from the app's **Source and licences** footer at `/source`; `/release-manifest.json` exposes file provenance. The release build sets both the footer and editorial source links to the built revision. An ordinary Vite build infers Git HEAD unless `VITE_BUILD_REVISION` explicitly overrides it. Git archive's built-in `export-subst` attribute expands `source-revision.txt` to the archived commit, so `npm run build` from extracted source retains that exact identity without Git metadata. The archive receives no manual TAR modification. Only a source copy without Git metadata and without an expanded identity uses the known baseline fallback; malformed archive identity or broken checkout metadata fails explicitly.

The server verifies every original file and compressed representation against the manifest before listening. It independently verifies the installed comprehensive geographic data. Do not edit release files or encodings after packaging. Make changes in source and construct a new release. This is integrity and correspondence checking, not a detached cryptographic signature or an attestation by a third party.

## Listener and HTTPS configuration

Defaults are `HOST=127.0.0.1`, `PORT=8080`. Set backend variables in the process environment (the server does not automatically load `.env`; Node's `--env-file` option can load a host-managed file). Local HTTP is accepted only for loopback host names. For a public deployment, set `PUBLIC_ORIGIN=https://your-host.example` and choose one of these arrangements:

- Direct TLS: set `HOST`, `HTTPS_CERT_FILE`, and `HTTPS_KEY_FILE`. Certificate/key paths refer to host-managed files outside the release. Both files are required.
- TLS reverse proxy: keep the Node listener on a private interface, set `PUBLIC_ORIGIN`, and set `TRUST_PROXY` to the exact proxy IP or comma-separated IPs. `loopback` trusts only 127.0.0.1 and ::1; `none` is the default. Wildcards and IP ranges are not accepted. Forward `X-Forwarded-Proto: https` and a correctly appended `X-Forwarded-For` chain. Restrict direct access to the Node port in the host firewall.

Forwarded headers have no authority from other socket peers. The nearest untrusted address in the proxy chain supplies the rate-limit identity. HTTP requests to an HTTPS public origin redirect there; HSTS is emitted only on a secure request. The proxy must preserve these security and cache headers. It must also disable query-string/request-body access logs for the geographic endpoints, or redact their values: the Node listener itself does not log request URLs, searches, coordinates, or private error details.

The CSP permits local scripts/workers and WebAssembly compilation, without JavaScript `unsafe-eval`. It permits inline styles used by the rendered UI, and only same-origin connections unless a separate lookup origin was explicitly included at build time. WASM is served as `application/wasm`. Permissions policy disables browser camera, microphone and automatic geolocation. Chart calculations stay in browser workers.

## Geographic provider and limits

`GEOCODING_MODE` selects `free` (default), `customer`, or `disabled`. Free mode uses Open-Meteo's geocoding endpoint; its hosted free service has noncommercial and volume conditions. Open-source licensing alone does not establish noncommercial hosting. Customer mode uses the documented customer endpoint and requires backend-only `GEOCODING_API_KEY`. Disabled mode preserves manual coordinate/zone entry and the local comprehensive coordinate-to-zone endpoint. No provider credential belongs in a `VITE_*` variable or client bundle. [Provider API](https://open-meteo.com/en/docs/geocoding-api), [current provider plans](https://open-meteo.com/en/pricing).

The process enforces these configurable bounds:

| Variable | Default | Meaning |
|---|---:|---|
| `LOOKUP_PER_CLIENT_PER_MINUTE` | 60 | Client token budget; place search costs 3, local timezone lookup costs 1 |
| `SEARCH_PER_MINUTE` | 60 | Global upstream search token budget |
| `SEARCH_PER_DAY` | 9000 free / 100000 customer | Global upstream search count, reset at UTC midnight |

Budgets are process-local and reset on restart. Use one process for these guarantees or add a shared gateway quota across replicas and other applications using the same provider account. The bounded client table fails closed when full. Limits do not replace the provider's account-wide terms. Responses use `429` and `Retry-After`; manual entry remains available.

The API accepts only a bounded place query or numeric latitude/longitude. It rejects duplicate/extra fields, dates and chart payloads. Upstream responses have a 64 KiB streaming byte cap and a six-second deadline. Geographic responses are `no-store`. By default, the app and API share an origin. A deliberately separate service can set one exact `CORS_ORIGIN`; credentials are never enabled. Set `VITE_LOOKUP_BASE_URL` **before building** to that service's HTTPS origin/path so the CSP includes it. Changing this client setting requires a new release.

## Compression, caching and operational checks

Packaging precompresses eligible app files with gzip and Brotli when smaller, before recording checksums. The listener negotiates actual representations, sends the original MIME, `Content-Encoding`, `Vary: Accept-Encoding`, representation-specific ETags, and encoded lengths. HEAD and 304 responses have no body. The source `.tar.gz` is already compressed and is not compressed again.

Bundler-generated hashed assets and the exact source archive are immutable. Ephemeris URLs carry their manifest SHA-256 query; only a matching hash receives immutable caching. Unversioned data and HTML revalidate. Unknown routes never fall back to HTML. Only manifest-listed app, source and licence files are web-accessible; server files, lockfiles, environment files and the filesystem are not exposed.

Run `npm run release:verify` to test the latest built artifact. The verifier copies it to a unique OS-temporary directory outside the repository, installs its own locked production dependencies with scripts disabled, starts the integrity-checked production listener, sets `RELEASE_BASE_URL` for the browser runner, and removes the isolated copy after stopping its processes. It does not inherit provider keys or Node module-path overrides. An explicit artifact directory can be the first argument. Browser arguments pass through, for example `npm run release:verify -- --config playwright.cross-browser.config.ts --project=firefox`. Install the requested browser engines first using the repository's browser installer. Place-search workflows use test responses and the verification server disables upstream search.

`npm run release:verify -- --latency-probe` and `--cold-load-probe` run the fixed measurement harnesses against that same independently installed artifact instead of browser workflows. Reports go under `BROWSER_OUTPUT_DIR` or `.cache/release-probes`. The cold-load method is documented in [cold-load measurement](cold-load-measurement.md). Run these during a quiet CPU/GPU window.

After deployment, check `/`, `/source`, `/release-manifest.json`, a worker, WASM and a versioned ephemeris URL over the actual HTTPS endpoint. Check Brotli/gzip response headers and transferred bytes through the deployed proxy. Both browser configs also accept `RELEASE_BASE_URL` for an existing listener and then omit the Vite preview server. Cold-scene and compressed-transfer targets remain measurements to record with browser/hardware/network settings; a build's estimated gzip sizes are not evidence of served transfer or GPU performance. No external hosting destination is selected by this repository.

## Notices and source access

The application and Swiss engine use AGPL-3.0-only; retain the source offer for the exact running revision. Other notices remain independent: Emscripten's MIT/NCSA licences and AUTHORS, musl and compiler-rt runtime notices, production dependency notices, IANA terms, ODbL geographic attribution, and CC BY-SA sky-data terms. `licences/dependency-notices.json` records the locked installed packages and distributed notice basis. Original metadata/readmes are retained where a dependency tarball has no separate notice file. Data manifests retain original sources, transformations, attribution and hashes. The data terms do not change to AGPL when bundled with the app. See [data and licensing](data-and-licensing.md) and `vendor/notices/manifest.json`.
