# Supplied npm production notices

`npm-production-notices.json` preserves the supplied top-level licence/notice text,
package identity, author metadata, download URL and installed lockfile hash for
all 53 production package records. Regenerate it with
`node scripts/prepare-third-party-notices.mjs`; check it without writing with the
same command plus `--check`. The script performs no network requests.

Fifty records include standalone licence/notice files. The published
`is-reference@3.0.3` and `locate-character@3.0.0` packages instead state MIT in
their README and package metadata. `stream-source@0.3.5` declares BSD-3-Clause in
package metadata; its distributed bundle carries `Copyright 2017 Mike Bostock`.
The inventory preserves those exact supplied declarations/banner and author
metadata, labels their narrower scope, and does not invent missing copyright
dates or represent a shorthand declaration as a complete licence document.
The tagged upstream trees for [is-reference](https://github.com/Rich-Harris/is-reference/tree/v3.0.3)
and [stream-source](https://github.com/mbostock/stream-source/tree/v0.3.5) were
also checked and do not contain a standalone licence file. The standard
identifiers refer to [MIT](https://spdx.org/licenses/MIT.html) and
[BSD-3-Clause](https://spdx.org/licenses/BSD-3-Clause.html); those links are not
invented package-specific notices.

This inventory concerns installed production package records, including
transitive server dependencies and compiler code packaged by Svelte. It is not
an assertion that every recorded file enters the browser bundle. The original
package notices remain in installed packages; preserve this inventory with the
source distribution. Development tooling, Swiss Ephemeris, compiler runtime,
sky assets, timezone databases, external services and referenced publisher
articles have separate scopes described in [data and licensing](../data-and-licensing.md)
and the [M9 source audit](../reports/content-source-licence-audit.md).
