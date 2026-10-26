# Development and validation

- Keep `main` untouched. Use the established review branches and `codex/development` integration process.
- During product iteration, run focused checks for the changed behavior. Do not repeat the full packaged browser matrix, independent archive rebuild, performance stress runs or cold-load probes after every edit.
- Preserve the existing regression coverage and assertions. Pruning validation means deferring broad runs, not deleting tests or weakening requirements.
- Run the complete release validation once the candidate has settled, or when the user explicitly requests it. Apply the PR label `full-release-validation` to trigger it once, or use the workflow's manual `full_release` input when available. Ordinary pushes and pull requests run source/type/lint/content/asset checks. Adding the label triggers the broad run; leaving it attached does not rerun it on each push.
- State incomplete validation honestly. Passing an earlier revision does not establish a pass for later changes.
