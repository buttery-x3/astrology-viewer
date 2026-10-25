# Spatial Astrology Explorer

A desktop-browser spatial instrument for exploring tropical astrology as an inspectable overlay on a geocentric celestial sphere.

Development follows the approved [implementation plan](IMPLEMENTATION_PLAN.md), with milestone evidence and review status in [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md). The original [design brief](docs/source/spatial_astrology_design_brief.md) is preserved for acceptance review.

Requires Node 24.15.0. Install with `npm ci`, start the application with `npm run dev`, and build with `npm run build`. Run checks with `npm run check`, `npm run lint`, and `npm test`. Install the test browser with `node scripts/install-browsers.mjs chromium`, then run `npm run test:browser` against the production bundle.

The current app includes historical local-time input, place/globe lookup, an immutable session birth anchor, real star/constellation overlays, selectable spatial references and seven house systems across three display modes with ghost comparison. Milestone results and outstanding work are recorded in the [implementation status](docs/IMPLEMENTATION_STATUS.md). Calculation compiler instructions are in [docs/m0-build.md](docs/m0-build.md), historical time preparation in [docs/timezone-build.md](docs/timezone-build.md), and sky extraction in `scripts/prepare-sky-data.mjs`.

Development and preview include a location API. Chart calculation stays in the browser; only place queries or coordinates are sent for lookup. Manual coordinate/zone/offset entry remains available. Open-Meteo's default search endpoint is for noncommercial development; production hosting/provider configuration is a release milestone.

Application source is AGPL-3.0-only. Upstream source/data and asset notices remain separately identified; see [data and licensing](docs/data-and-licensing.md).
