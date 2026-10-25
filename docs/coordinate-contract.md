# Coordinate and civil-time contract

M0 establishes pure transforms and explicit conversion boundaries. These functions
operate on directions; distances and the radius of the schematic Earth or sky do
not change a body's altitude, sign, or house membership.

## Units, handedness, and axes

- All public angles use degrees. Right ascension is degrees rather than hours.
- Longitudes and right ascension normalize into `[0, 360)`. Signed shortest turns
  use `[-180, 180)`, with an exactly opposite direction represented by `-180`.
- Ecliptic latitude and equatorial declination preserve their signed values.
  Neither is discarded when placing a body on the celestial sphere.
- Geographic latitude is north-positive and geographic longitude east-positive.
- The astronomical Cartesian frame is right-handed: `+X` is the reference equinox,
  `+Y` is right ascension 90 degrees, and `+Z` is the north celestial pole.
- Three.js uses the right-handed adapter `(x, y, z) -> (x, z, -y)`; the north
  celestial pole becomes Three.js `+Y`. The inverse is `(x, y, z) -> (x, -z, y)`.
- Calculations retain JavaScript double precision. GPU buffers may be reduced to
  single precision only after classification and direction transforms.

Non-finite angles and vectors, zero-length directions, and invalid latitudes are
errors. Pole longitude conventionally returns zero. Zenith and nadir have
`azimuthDeg: null`, since a unique azimuth does not exist there.

## Ecliptic, equatorial, and fixed frames

`eclipticToEquatorial` applies the right-handed rotation about `+X` by the supplied
obliquity. Its inverse rotates by the negative obliquity. The caller must supply
the obliquity matching the epoch and mean/true convention of the input. M0 does
not silently supply a constant J2000 obliquity to coordinates of another date.

The application world has a fixed J2000-aligned equatorial orientation. Apparent
equatorial coordinates of date must not be drawn directly in that world frame.
`EquatorialFrameTransform` records the TT Julian date, whether the of-date frame
is mean or true, a source identifier, and a row-major 3-by-3 rotation matrix from
that frame into the fixed J2000 orientation. `createEquatorialFrameTransform`
requires a proper orthonormal matrix with determinant `+1`; both directions are
available and tested.

The ephemeris adapter supplies this rotation from its documented precession and
nutation model. A frame-consistent engine output in J2000 orientation is also
usable directly when labelled with that frame. A mean precession-only rotation
must not be presented as a complete true-of-date transformation. Aberration and
other apparent-direction corrections are properties of the body's direction;
they are not recreated by a generic frame rotation. The M0 pure module contains
no competing approximate precession or nutation model. Its known-angle fixture
tests the rotation contract, not the astronomical correctness of an engine model.

## Observer orientation and the horizon

`equatorialToHorizon` takes equatorial coordinates of date, an observer location,
and Greenwich sidereal time in degrees. True/apparent input requires matching
apparent sidereal time; mean input requires matching mean sidereal time. The
ephemeris boundary owns that choice and records its provenance.

For observer latitude `phi` and local sidereal angle
`theta = Greenwich sidereal angle + east-positive longitude`, the astronomical
basis vectors expressed in the of-date equatorial frame are:

```text
east  = (-sin(theta),                 cos(theta),                0)
north = (-sin(phi) * cos(theta),     -sin(phi) * sin(theta),      cos(phi))
up    = ( cos(phi) * cos(theta),      cos(phi) * sin(theta),      sin(phi))
```

Dot products with these vectors produce local east/north/up. Altitude is
`atan2(up, hypot(east, north))`; azimuth is `atan2(east, north)` normalized into
`[0,360)`. Thus north is 0 degrees, east 90, south 180, and west 270. The inverse
uses the transpose of this orthonormal basis. At a geographic pole the chosen
longitude defines the otherwise arbitrary horizontal meridian convention.

`geographicToEquatorialVector` gives the same `up` normal for the schematic globe
marker. A plane through the sky's mathematical centre with that normal therefore
agrees exactly with the altitude calculation. A tangent patch translated to the
globe surface is illustrative and never decides whether a body is above the
geocentric horizon. Observer sky cameras remain at the directional sphere's
mathematical centre; decorative geometry must not introduce parallax.

There is no atmospheric refraction, terrain masking, topocentric parallax, or
visibility prediction in this horizon transform.

## Civil-time resolution

`resolveCivilTime` accepts numeric Gregorian fields plus either an IANA zone ID
or an explicit east-positive manual UTC offset. Numeric construction avoids
browser-dependent date-string parsing. Invalid calendar dates, overflowed clock
fields, fractional fields, and literal second 60 are rejected rather than
normalized. Minute precision is preserved by omitting the optional seconds field.

The adapter loads the committed custom **IANA 2026e** dataset through Moment's
no-data entry point. The reproducible M2 build uses the upstream
`PACKRATDATA=backzone PACKRATLIST=zone.tab` policy, preserves 598 explicit
identities, and expands rules from 1899 through 2101 to guard the supported UTC
boundaries. The manifest records source/output hashes and build options; see
[the timezone build](timezone-build.md). The adapter enumerates every distinct
offset in each complete rule table, constructs a UTC candidate for that offset,
and checks the candidate against the rule active at that instant. Results are:

| Status | Meaning |
| --- | --- |
| `unique` | Exactly one valid supported UTC candidate |
| `ambiguous` | Multiple UTC candidates, sorted earlier first; no candidate selected implicitly |
| `nonexistent` | No candidate because a civil clock interval was skipped; known transition bounds are included |
| `invalid` | Invalid input, unknown zone, invalid manual offset, or all converted candidates outside the supported UTC interval |

Each candidate retains its east-positive offset, abbreviation, UTC ISO timestamp,
epoch milliseconds, and supported-range flag. If an unusual fold crosses the
range boundary, all candidates remain visible and the ambiguity is preserved.
The chosen candidate must itself have `withinSupportedRange: true` before a
calculation can be committed.

The interval is **1900-01-01T00:00:00Z inclusive to
2101-01-01T00:00:00Z exclusive**. This check applies after conversion; local dates
at the very end of 1899 or beginning of 2101 can legitimately fall inside it.
Manual offsets allow whole minutes from UTC−14:00 through UTC+14:00 and explicitly
override zone rules, including gaps and folds. Packaged IANA offsets retain
historical seconds even though the manual-entry interface uses whole minutes.

Every result records the tzdata version, adapter version, calendar, and source.
Dates before 1970 carry a historical-data warning. M2 preserves additional
backzone histories that the ordinary Moment dataset merges, including Amsterdam,
Aden, and Accra. These histories can still be uncertain and do not establish
which jurisdiction used an old birth record or supply dated political boundaries.
Before 1960, the UTC label is a computational reference, not a claim that a
historical UTC clock existed. Future zone rules are marked as projections
relative to an injectable clock. These limitations are separate from birth-time
uncertainty and from numerical precision. Manual override remains available when
a reliable historical offset is known.

UTC, UT1, and TT stay distinct at the ephemeris boundary. This module resolves a
civil input to its UTC-labelled reference and never substitutes that timestamp
for TT or silently handles leap seconds.

## Verification and primary references

The domain suite checks cardinal directions, both hemispheres, geographic
longitude sign, equinoxes and solstices, off-ecliptic latitude, pole singularities,
angular normalization, frame round trips, horizon-plane consistency, Sydney and
New York folds/gaps, Lord Howe's half-hour transitions, Apia's skipped civil day,
historical second-resolution offsets and transitions, additional backzone
identities, Gregorian century leap rules, UTC range boundaries, and manual
overrides. The custom data build independently verifies every period with
Python's public `ZoneInfo.from_file` API before checking Moment packing round
trips; this validates integration with the selected source, not the historical
accuracy of every source record.

- [Moment Timezone: zone object, offset sign, and data loading](https://momentjs.com/timezone/docs/).
- [Moment Timezone: data and historical accuracy limitations](https://momentjs.com/timezone/guides/).
- [US Naval Observatory: altitude and azimuth from sidereal time](https://aa.usno.navy.mil/faq/alt_az).

These document the underlying conventions. Native-versus-WASM ephemeris fixture
agreement and the engine's astronomical frame-model validation are separate M0
checks owned by the calculation adapter.
