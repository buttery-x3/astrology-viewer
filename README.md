# Spatial Astrology Explorer

A desktop-browser spatial instrument for exploring tropical astrology as an inspectable overlay on a geocentric celestial sphere.

Development follows the approved [implementation plan](IMPLEMENTATION_PLAN.md), with milestone evidence and review status in [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md). The original [design brief](docs/source/spatial_astrology_design_brief.md) is preserved for acceptance review.

Requires Node 24.15.0. Install with `npm ci`, start the application with `npm run dev`, and build with `npm run build`. Run checks with `npm run check`, `npm run lint`, and `npm test`. Install the test browser with `node scripts/install-browsers.mjs chromium`, then run `npm run test:browser` against the production bundle.

Milestone results are in [M0 feasibility](docs/reports/M0.md) and [M1 foundation](docs/reports/M1.md); compiler rebuild instructions are in [docs/m0-build.md](docs/m0-build.md).

Application source is AGPL-3.0-only. Upstream source/data and asset notices remain separately identified; see [data and licensing](docs/data-and-licensing.md).
