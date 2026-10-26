# M10 final source-archive rebuild

The frontend source archive for revision `6cfa912f72eafce86b2f17c205e5c65d4d21c172` was independently extracted, installed and rebuilt successfully on Windows with Node 24.15.0, npm 11.12.1 and pinned Vite 8.3.5. Exact hashes, file sizes, manifest identities and retained-data checks are recorded in [M10-source-archive.json](M10-source-archive.json).

The archive was extracted into a fresh OS temporary directory, outside the repository, after checking its 435 listed paths. Neither the extracted source nor any ancestor contained `.git`. Its `node_modules` was installed by `npm ci --no-audit --no-fund` (217 packages); it was not linked to the repository installation. The expanded `source-revision.txt` contained the full release revision. The ordinary `npm run build` used no revision override, local-source override or native engine compiler and returned exit code 0.

| Verified item | Result |
| --- | --- |
| Source archive SHA-256 | `cf63f28bedfea91b1c8a270c67c5923b861320a7ec1728468a3e3dc3acadf3ef` |
| Release source tree | `1067f95f63a1980b225cf57eb800fc0360ac3248` |
| Compiled revision and footer | Full `6cfa912f72eafce86b2f17c205e5c65d4d21c172`; compiled footer derives `Build 6cfa912` from that value |
| WASM source, rebuilt asset and released asset | All 392,316 bytes; SHA-256 `a2aaedc3f371af501d2dfd61258a8160c873b0df3ea94ad568377df4353fb88e` |
| Complete release manifest | All 108 listed files/encoded variants match their recorded hashes and lengths |
| Retained figures | 88 figures, 219 polylines, 695 segments, 710 unique HIP endpoints and nine supporting stars |
| Figure asset SHA-256 | `cc67ca70fcee802d658d62a39a138ecdc67884e6cca6bb4ee38389762b98c958` |
| Content | 320 entries, 90 sources, 120 body-in-sign and 120 body-in-house entries; all 96 canonical-page budgets pass |
| Almanac additions | 15 entries, 154 derived words against the 180-word editorial budget |
| Original 305 cards | Unchanged title/summary/claim semantic hash `4bb6fa0c4329ce21bb9bc8c0814ebf62640248394c671fe94f4d03e60623775b` |

The figure audit independently compared every retained polyline with the pinned Stellarium v26.2 source after applying the retained HIP-to-HYG map. All 710 endpoints resolve within the unchanged 2,865-star catalogue plus the nine supporting records. Both upstream source files retain their pinned SHA-256, byte length and Git blob identity. The archive retains the figure manifest, compact topology and upstream description; the release separately retains the Stellarium/HYG CC BY-SA 4.0 notice, whose bytes also match the source notice manifest. The original 33 MB HYG CSV was not downloaded or reimported for this check; the retained endpoint map and catalogue vectors were verified. This check establishes retained provenance, rather than legal clearance.

The following archived commands all returned exit code 0 after installation:

```text
npm run build
node scripts/verify-assets.mjs
npm run validate:content
npm run validate:notices
```

The notice check covered 53 production dependency records: 50 supplied full notice files and three explicitly recorded upstream shorthand/banner cases. All eight release identity manifests, including the archived lockfile and content manifest, matched the artifact identities.

This audit rebuilt the ordinary frontend. Its source link correctly targets the full revision on GitHub; the packaged release's compile configuration instead targets its local `/source` endpoint. Consequently, main-JavaScript byte identity between those two configurations is not claimed. WASM identity was checked byte for byte. No browser rendering, server rebuild or native engine recompilation was performed here; packaged browser validation is recorded separately. Human claim-to-passage editorial review and the other external acceptance gates remain outside this audit.
