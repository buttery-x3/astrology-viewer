# M10 constellation figures and content package

Implemented in the isolated codex/m10-constellation-figures worktree. This report covers data, renderer-module and content readiness; root scene/App integration and actual browser/visual acceptance are separate M10 packages.

- Pinned Stellarium release 26.2 commit 2b10b1a3bb534eb4e7586751054bf67b36c22e53; upstream data licence explicitly CC BY-SA 4.0. Full original source/description and blob/SHA256 identities are retained. No illustrations are included.
- Preserved 88 figures, 219 ordered polylines and 695 source segments. All 710 HIP endpoints map uniquely to the checksum-verified existing HYG v4.1 source: 701 existing bright stars and 9 separate support records, maximum magnitude 6.65. Default 2,865-star data is unchanged. No duplicate or reversed undirected segment occurs within a source figure.
- Compact derived asset: 34915 bytes; SHA256 cc67ca70fcee802d658d62a39a138ecdc67884e6cca6bb4ee38389762b98c958. Import reproduced exactly from the pinned source and failed-identifier tests verify no missing/ambiguous positional substitute.
- Endpoint and spherical-arc checks cover every figure at 1900, J2000 and 2100. Renderer tests cover 710/9 dot switching, metadata, linked constellation selection, viewport line widths and stable buffers across changed dates.
- Catalogue 1.1.0 contains 320 cards/90 sources, preserving all 305 prior titles/claims and 240 placement entries. Fifteen new astrocartography entries derive 154 words from one Theresa Reed Almanac page; all 96 canonical source-page budgets remain within limits. Fourteen original project explanations reuse registered claim IDs, with code/registry correspondence.
- Validation: 528 source tests across 40 files passed; Svelte/TypeScript checks had 0 errors/0 warnings; ESLint passed; asset/notice hashes and content gates passed. The full suite’s local HTTP/junction tests require the ordinary authorized host environment; restricted sandbox denials were rerun successfully without changing their assertions.

No physical GPU, frame-time, hover UX, integrated canvas picking, Safari, screen-reader, participant or human editorial acceptance is claimed by these module tests. Those remain recorded in M10 integration and external release gates.
