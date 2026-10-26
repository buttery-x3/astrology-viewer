# M10 final source-archive rebuild

The source archive for settled M10 candidate `6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd` was independently extracted, installed and rebuilt successfully on Windows with Node 24.15.0, npm 11.12.1 and pinned Vite 8.3.5. Exact hashes, command statuses, sizes and retained-data checks are recorded in [M10-source-archive.json](M10-source-archive.json).

This record supersedes the earlier `a2ef959` archive audit after the final terminal card spacing repair and complete CI result collection. Earlier evidence remains scoped to its recorded source revision. This audit covers `6c1a0cb`; later reporting commits do not change which archive was tested.

The archive was extracted into a fresh OS temporary directory outside the repository after checking all 493 unique paths and entry types. Only regular files and directories were accepted. All 443 source-file paths and 50 directory paths matched the exact release tree: 442 files matched their Git blob hashes, and `source-revision.txt` contained the expected full revision after Git export substitution. None of the 8 checked directories, including the project and its ancestors, contained `.git`.

The extracted project initially contained no `node_modules` or `.tools`. Its independent `npm ci --no-audit --no-fund` installed 217 packages; the resulting dependency directory was ordinary and did not link to the repository installation. The ordinary `npm run build` used a filtered environment, no revision override, no local-source override and no native engine compiler. Every command below returned exit code 0; the JSON record retains command durations and stdout/stderr hashes.

| Verified item | Result |
| --- | --- |
| Source archive SHA-256 | `883420968c5a6d4b4b4a6eff397f5c1fac94d920afc6122079613de76acc3ef3` |
| Release manifest SHA-256 | `161997ac33ec307a556a8999a9989f7c5f8e69a340364f718a789a5b0eb16c00` |
| Release source tree | `02970a9f388aa475c656ba9920b05feae92d8d0e` |
| Compiled revision and footer | Full `6c1a0cbc9632944db7e1a8916c2b9c12befc9cfd`; footer derives `Build 6c1a0cb` from that value |
| WASM source, rebuilt asset and released asset | All 392,316 bytes; SHA-256 `a2aaedc3f371af501d2dfd61258a8160c873b0df3ea94ad568377df4353fb88e` |
| Complete release manifest | All 108 listed files/encoded variants match their recorded hashes and lengths |
| Retained figures | 88 figures, 219 polylines, 695 segments, 710 unique HIP endpoints and 9 supporting stars |
| Figure asset SHA-256 | `cc67ca70fcee802d658d62a39a138ecdc67884e6cca6bb4ee38389762b98c958` |
| Content | 320 entries, 90 sources, 120 body-in-sign and 120 body-in-house entries; all 96 canonical-page budgets pass |
| Almanac additions | 15 entries, 154 derived words against the 180-word editorial budget |
| Original 305 cards | Unchanged title/summary/claim semantic hash `4bb6fa0c4329ce21bb9bc8c0814ebf62640248394c671fe94f4d03e60623775b` |

The figure audit independently compared every retained ordered polyline with the pinned Stellarium v26.2 source after applying the retained HIP-to-HYG map. All 710 endpoints resolve within the unchanged 2,865-star catalogue plus nine supporting records. Both retained upstream files match their pinned SHA-256, byte length and Git blob identity. The figure manifest, topology, description and packaged Stellarium/HYG CC BY-SA 4.0 notice are retained. The original 33 MB HYG CSV was not downloaded or reimported; this verifies the retained map, source hashes and catalogue endpoint coverage.

```text
npm ci --no-audit --no-fund
npm run build
node scripts/verify-assets.mjs
npm run validate:content
npm run validate:notices
```

The notice check covered 53 production dependency records: 50 supplied full notice files and 3 explicitly recorded upstream shorthand/banner cases. All 56 packaged dependency notice/metadata files match the independently installed locked packages. All eight identity manifests, including the lockfile and content manifest, match the source and packaged copies. Every retained data/toolchain notice also matches its source manifest and packaged bytes.

This audit rebuilt the ordinary frontend. Its source link targets the full revision on GitHub; the packaged release's compile configuration targets its local `/source` endpoint. Main-JavaScript byte identity between those configurations is therefore not claimed. WASM identity was checked byte for byte. No browser rendering, server rebuild or native engine recompilation was performed here. Packaged browser and native-zoom validation are separate records. Human claim-to-passage editorial review, licensing clearance and the other external acceptance gates remain outside this audit.
