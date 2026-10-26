# Independent view layer memory

26 October 2026. Implements the user's follow-up correction to [M10 rectifications](../plans/M10-rectifications.md).

Each view has a complete, independently initialized layer profile. Outside starts with aspects on and asterisms off; Earth starts with astrocartography on and house sections/aspects/asterisms off; Observer starts with asterisms on and aspects/Earth projections off. Other reference layers retain their established initial values.

Changing any reference toggle saves that choice for the current mode. Explicitly returning or reselecting restores the mode's own choices. In particular, Observer's asterisms do not enable them in Outside or Earth. Deliberate customizations in those views remain remembered independently. Memory lasts for the current exploration session; chart data and personal context are not persisted. Appearance sliders, per-body/per-angle filters and calculation settings remain shared.

Temporary globe picking and internal geographic focus carry the current visible layers without copying a whole profile into another mode's saved state. Subsequent feature-enabling commands update only their named destination bits. Snapshot updates preserve profiles and view changes issue no chart calculation.

Focused validation: 18 explorer state tests pass, including cross-mode isolation, same-view re-entry, temporary transitions and snapshot retention. Three Chromium workflows pass for real controls, same-view globe reframing and geographic focus. Type/Svelte checking reports 0 errors and 0 warnings; changed-file lint passes. Independent source review found no substantive issue. Existing browser assertions were amended where the requested memory behavior supersedes the previous forced-reset behavior; unrelated geometry, moment and focus assertions remain.

No full release validation or M10 integration was performed. Main remains untouched.
