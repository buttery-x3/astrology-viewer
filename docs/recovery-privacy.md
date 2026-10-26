# Recovery and geographic lookup privacy

Chart and trail calculations run in local workers. Birth civil date/time, resolved UTC instants, house systems and chart values are worker messages, never geographic lookup parameters. The app does not persist birth contexts by default and has no analytics/error-reporting transport. Display preferences, when persisted, are separate from personal chart inputs.

## Network boundary

`lib/net/bounded-fetch.ts` is shared browser/server code for GET requests. It bounds **actual streamed bytes**, including responses without an honest `Content-Length`. A declared excessive length is rejected early. One deadline covers both obtaining headers and reading the entire body; a stalled/non-cooperating fetch or body cannot leave the caller waiting indefinitely. An explicit caller abort is preserved as a sanitized `AbortError`.

Readers are cancelled on failure, byte excess or interruption, and their locks are released. Timers and external abort listeners are removed on every exit. A response arriving after its deadline is discarded. HTTP and network errors contain fixed explanations and an optional HTTP status; they omit request URLs, response bodies and low-level fetch details. JSON decoding rejects malformed UTF-8 and invalid JSON before domain validation.

All requests omit credentials and suppress referrers. Location requests use `cache: 'no-store'`; the API also returns `Cache-Control: no-store`. Its bounded in-memory geographic lookup cache lasts at most one hour and contains only place queries or coordinates, never chart inputs. Numerical assets use normal HTTP caching so already loaded/cached data can keep working through interrupted connectivity.

The geographic boundary accepts only one of these strict shapes:

- Place search: a trimmed 2–100-character visible `q` string.
- Time-zone lookup: finite latitude −90° to +90° and longitude −180° to +180°. HTTP coordinate strings must be bounded decimal/scientific numeric text, excluding blank values, hexadecimal and non-finite values.

Unknown fields, including dates, UTC instants and chart objects, and duplicate HTTP query fields are rejected before an upstream request. The client builds query parameters from these validated values only. Lookup-base configuration rejects credentials, query strings and fragments. Server place search uses a fixed Open-Meteo origin and forwards only `name`, `count`, `language` and `format`; coordinates are resolved by the local comprehensive geographic boundary dataset.

Lookup responses are at most 64 KiB, eight places or ten distinct zone identifiers. Names, labels, identifiers and attribution strings have explicit length/character bounds, and response objects reject unknown fields. The server applies the same 64 KiB limit and a 6000 ms deadline to upstream place-search JSON. The client deadline is 8000 ms. Malformed, excessive, unavailable or rate-limited responses leave manual coordinates and a time zone/offset available through the existing form.

`createLocationClient({baseUrl?,fetch?,timeoutMs?})` provides injectable dependencies for tests and deployments. Existing `searchPlaces(query, signal?)` and `lookupTimezones(latitude, longitude, signal?)` exports use the configured client and preserve their public signatures.

## Calculation assets

Each of the three numerical asset downloads is capped at 2 MiB and 20000 ms by default. Their current sizes are 392316 bytes for WASM,484061 for planetary data and 1304771 for lunar data. An error aborts remaining downloads in the same group; retries start a fresh worker and fresh asset-loading attempt. Successful planetary/lunar downloads still undergo the existing pinned SHA-256 checks before native initialization. Missing/corrupt data never selects a numerical fallback.

`fetchEngineAssets(base?, {signal?, fetch?, timeoutMs?})` exposes cancellation/injection without changing engine calculations or fixtures. Offline cold loading remains outside the agreed scope. Once numerical data is loaded, chart exploration does not need place lookup or further numerical downloads.

## Worker deadlines and retry

The chart store uses a 30000 ms startup deadline and 5000 ms active-calculation deadline. `ExplorerStoreOptions.startupTimeoutMs` and `calculationTimeoutMs` override them for controlled tests or hosting needs. Timers are tied to the worker generation, worker object and requested revision. Superseding a request clears its prior timer; stale responses cannot clear a newer timer. Successful coherent responses, errors, restart and destruction clear active timers.

The trail service has a separate 30000 ms startup deadline. A body-trail job has its requested native computation budget plus 5000 ms for scheduling/protocol overhead; boundary history has 5000 ms. `TrailServiceOptions.startupTimeoutMs` and `jobTimeoutMs` provide test/deployment overrides. Trail/history timers are independent and tied to the worker generation and channel's job identifier. Partial progress does not extend the hard deadline. A hung shared trail worker is terminated, pending channels receive an explicit recoverable error, and completed numerical results remain usable. Late progress after a terminal error is ignored. Cancelling all work during startup terminates that unnecessary worker.

Timeouts retain the last verified chart snapshot or partial sampled interval with its actual context. They never relabel old geometry as a new calculation. Retry replaces the failed worker, registers new identifiers and clears prior timers/listeners. Destruction terminates workers and removes all deadlines/listeners. Playback observes chart errors and pauses through the existing application integration.

Overrides must be finite and between 1 and 120000 ms. The finite fetch/worker deadlines provide recovery when an engine load or native call stops responding; ordinary trail cancellation still happens cooperatively in bounded native-calculation batches described in [the trail contract](trail-contract.md).

## Verification

`tests/services/net.test.ts` checks streamed size enforcement, dishonest headers, stalled fetch/body deadlines, late-response disposal, caller cancellation, cleanup, asset-group aborts, strict geographic privacy boundaries and recoverable lookup failures. `tests/state/worker-recovery.test.ts` uses fake timers to verify startup/job hangs, retained context, supersession, independent channels, retry generations, terminal errors, cancellation and teardown. Existing numerical/native tests ensure the recovery changes do not alter calculated values.

Run `npx vitest run tests/services/net.test.ts tests/state/worker-recovery.test.ts` for the focused recovery suite.

