# Sun identity and local-date clarity follow-up

The supplied screenshots show the inspector's selected entity as **Tropical sign — Sagittarius**, while the Sun remains a small point on the opposite part of the projected sphere. A circular selection highlight around a sign glyph and hidden far-side body captions made that selection too easy to mistake for the Sun.

The same screenshots show a correct conversion: 27 April 1987 at 02:00 in Melbourne (UTC+10) is 26 April at 16:00 UTC. The previous header emphasized UTC while the input emphasized local time, making the calendar-day difference look like a lost date.

## Changes

- Body captions include names. The Sun and selected body also display their current tropical sign and degree at their actual scene positions. Body captions remain eligible on the far hemisphere; real Earth occlusion and collision layout still apply, with leaders connecting displaced labels to unchanged markers.
- A selected sign caption includes its name and identifies it as a sign. Sign selection highlights its sector without the circular point highlight used for celestial objects.
- The context bar and saved birth anchor emphasize local date/time, retaining their explicit UTC equivalents. The form shows both clocks as the same instant and explains a calendar-date rollover when present.
- Caption text reuses its canvas. A size change disposes and replaces the owned GPU texture because WebGL2 texture storage is immutable; same-size updates reuse it. This was corrected during independent review before publishing.

## Verification

The exact Melbourne regression observes real WebGL submissions for the **Sun · Taurus 5.89°** caption while **Sagittarius** is independently selected, checks the Taurus anchor against the native frame, and directly asserts no GL errors after caption-width changes. A second browser workflow verifies the local input, UTC preview, local-first header and saved anchor. Existing eclipse overlap, transparent-Earth picking and graphics recovery cases also pass their targeted run.

Full production, numerical, type/lint and remote CI results are recorded in the pull request. The calculation convention and astronomical body positions are unchanged.
