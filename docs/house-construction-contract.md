# House construction guides

M5 adds independent, selected-cusp construction guides. The M4 longitude
extensions remain display regions; they are never reused as a substitute for a
house method's actual defining geometry.

`buildHouseConstruction(snapshot, result, settings)` reconstructs all twelve
indexed cusp longitudes before producing the selected guide. Whole Sign, Equal
and Porphyry use the requested system's returned angle anchors; the other methods
derive intersections or roots from observer orientation, true obliquity and
apparent sidereal time. Returned cusp values are comparison targets, never solver
seeds. `cuspChecks` exposes each comparison and `maxResidualDeg` covers all twelve.

The allowed maximum absolute circular residual is **0.01°**. A disagreement
produces `incomplete`, retains the numerical comparison and withholds geometry.
An undefined requested result, invalid longitude partition or singular defining
projection produces `undefined`. No Porphyry substitute or equal-wedge surrogate
is installed. A valid body and other valid reference layers remain independent.

## Stages and geometry

The builder returns all three sourced stages: reference, division/timing and
ecliptic intersection. Each line and marker has a stable construction ID, role
and stage; the scene controls visibility. All point coordinates are unit
astronomical vectors in the shared fixed J2000 orientation. Closed lines omit a
repeated final endpoint. Small circles remain offset small circles, not great
circles through the sphere's centre.

- Whole Sign and Equal show their actual longitude divisions from the returned
  system's Ascendant convention. Porphyry shows the directed quadrant and thirds.
- Regiomontanus and Campanus show their equatorial or prime-vertical division
  points and defining circles through the north/south horizon axis. Ecliptic
  intersection branches retain the signed projection through that axis, including
  the native reversed polar progression.
- Placidus uses the selected cusp's own declination circle and solves its
  semi-diurnal/semi-nocturnal time fraction independently. Opposite cusps have
  their own declinations and complementary semi-arcs.
- Koch derives the Midheaven degree's rising semi-arc, then intersects horizons
  at the method's negative or positive sidereal shifts. C11/C12 use past shifts;
  C2/C3 use future shifts, with opposite cusps sharing those defining planes.

Selected C1/C4/C7/C10 guides explain that these are angle anchors requiring no
timed trisection. Selecting C11, C12, C2 or C3 exposes the temporal mechanism.
System-specific polar angle conventions are stated when they differ from the
literal geometric eastern Ascendant or upper-meridian transit used by M3.

## Timing-circle display convention

Timing-circle markers illustrate Earth's rotation **relative to a held current
horizon**. They do not show a fixed ecliptic degree moving against the stars or
the ecliptic. For a current local sidereal angle theta and illustrative hour angle
H, the displayed point uses right ascension `theta − H` at the relevant constant
declination. Its current-horizon position then represents that hour angle.

Koch's shifted horizon planes use their actual past/future rotational
orientations in the fixed axes. Its separate MC timing arc is a local reference
used to explain the shift fractions. The selected date's ecliptic/frame is held
fixed while illustrating this construction; the sweep does not recalculate a
sequence of civil timestamps. Angular durations divided by 15 are explicitly
**sidereal hours**, not ordinary UTC elapsed hours.

## Sweep and validation

`ConstructionSettings` has `enabled`, `boundaryHouse` (1–12), `stage` (0–2) and
`progress` (0–1). The default is disabled, C1, final stage, full progress. Enabled
and stage affect presentation only. Progress moves a division marker, time marker
or shifted plane, while final native/computed cusp values and residuals remain
unchanged. The final intersection is separately identified. Neither the current
chart inputs nor selection/camera state are changed by the domain builder.

Geometry paths and stage explanations refer to the primary `HouseResult` passed
to the builder, including its own indexed angle convention. Comparison-system
ghosts are not silently used as a construction source.

## Reproducible native fixtures and verification

Run `npx tsx scripts/generate-construction-fixtures.ts` from the repository root.
It verifies the pinned official Swiss Ephemeris 2.10.03 `swetest.exe` checksum and
ephemeris-file hashes, records every native command, and writes
`tests/fixtures/construction-native.json`. UTC input and explicit DE431 tidal
acceleration (`-tidacc-25.8`) match the owned WASM adapter. The fixture provenance
contains exact binary/source/data references; failed native substitute cusps are
discarded.

The committed fixture has 92 observer/instant cases and 644 requested house
results. It includes all M0 dates and observers, both hemispheres near and within
the polar circle, reversed polar conventions, the equator, ±89.9°, and latitudes
immediately on either side of the date's polar-circle threshold (±0.00001° and
±0.00000001° in each hemisphere at four sidereal orientations). It retains the
full case inventory from the independent feasibility spike.

Run `npx vitest run tests/domain/house-construction.test.ts`. The suite compares
all twelve reconstructed cusps per defined native result, all seven selected
guides at every indexed cusp, unit/frame invariants, actual Placidus time
fractions, Koch shifted-plane intersections, reversed R/C defining planes,
progress invariance and incomplete/undefined states. Native-versus-guide
agreement uses the same Swiss astronomical model; it is not independent
astronomical validation or evidence for an astrological interpretation.

## Source attribution

Calculation explanations cite pinned
[`swehouse.c`, CalcH](https://github.com/aloistr/swisseph/blob/f4dcd18e8005dde95fd8a8d2312ed12f9accd1b0/swehouse.c),
with the exact method case/default and opposite-cusp assignment. UI timing and
sweep conventions cite this project contract. The shared Swiss manual is not
used for additional M5 prose, preserving its existing M3/M6 editorial budget.
M5's three-stage method explanations contain 132 derived whitespace words across
all seven systems; the staged M6 Whole Sign card adds 16 words on the same pinned
source page. Integration must also retain the shared polar/anchor-note budget
and count identical logical claims once wherever they are displayed.
