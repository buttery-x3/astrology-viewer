# M10 terminal relationship headroom: scoped amendment

Source **`ca39e0f25602b4ca32b5a04793cdfde326ec7e62`** passes the focused 504×308 CSS / Large regression in Chromium, Firefox and WebKit on Windows, and both affected installed-Chrome native **1024×768 / 200% / Large** states. The long relationship card is **480×261.44 CSS pixels**, ending at **y=273.44** inside the 308-pixel viewport. Its reading font remains **14.625 CSS pixels** and every registered paragraph remains complete.

This amendment records two native states and six previews. The other six combinations in the [earlier eight-state report](M10-native-zoom-rectified.md) were not rerun. **Linux CI acceptance remains pending its separate rerun**; the Windows checks here do not establish a Linux pass. The [structured record](M10-native-zoom-headroom-amendment.json) binds this result to exact source and screenshot hashes.

## Regression and change

[CI run 40279259335](https://github.com/buttery-x3/astrology-viewer/actions/runs/40279259335) exposed Linux Chromium wrapping that the previous Windows native pass did not catch: review recorded a card bottom of 318.8125 against an allowed 309 at 504×308 CSS pixels with Large text. That failure is retained as a regression finding; it is not overwritten by this scoped pass.

The terminal full-width relationship composition now uses a 1.25 line height on the reading container, complete paragraph and inline heading, 5px card padding, 4px reading padding, and 3px reading margins. This reduces the measured Windows relationship height from 285.75 to 261.44, reserving 24.31 CSS pixels for platform wrapping. Font sizes, registered prose, measured-height fallback behavior and keyboard assertions are unchanged. Ordinary compositions that do not enter the terminal class are unaffected by these selectors.

## Executed checks

- `npm run check`: Svelte and TypeScript pass with zero errors or warnings.
- Targeted ESLint, Prettier and `git diff --check`: pass.
- `playwright.cross-browser.config.ts tests/browser/m10-hover.spec.ts --grep "complete long relationship fits"`: **3/3 pass**, no retries, skips or flaky results, in 22.0 seconds on Windows. The existing bounds, complete paragraph endings, text-line visibility, 14.625px font, “and”, focus, description and Escape assertions are retained.
- Native validator with `--native-case=1024x768-large` and exact source guard: **2/2 states and 6/6 previews pass**; zero page errors.

## Genuine native 200% zoom

Installed Chrome **156.0.8078.47** ran headed with `viewport:null` in a fresh owned profile. The actual Appearance → Page zoom control was set to 200%. Outer bounds stayed **1024×768**, inner width changed **1008 → 504**, DPR changed **1 → 2**, and `visualViewport.scale` stayed **1**. Inner height changed **617 → 308**. Window bounds and full viewport screenshots used CDP; no emulated viewport, device scale, CSS zoom or pinch zoom was applied.

| View, Large text | Sun height | Relationship height | Relationship bottom | Venus AC height | Result |
| ---------------- | ---------: | ------------------: | ------------------: | --------------: | ------ |
| Earth            |     294.29 |              261.44 |              273.44 |          210.14 | Pass   |
| Outside          |     294.29 |              261.44 |              273.44 |          210.14 | Pass   |

All six previews pass exact text comparison with the claim registry, paragraph line bounds, no hidden text or clipping, no card/wrapper scrolling, pointer retention, text selection, keyboard-origin focus, `aria-describedby`, Escape dismissal and description restoration. Header, reflow and Inspector checks pass in both views. No technical footer or F2 scroll tab stop was introduced. Claim registry hashes are identical to the previous eight-state evidence.

Eight served Vite raw-source hashes matched disk, and all ten recorded source/data hashes and the Git revision remained unchanged. The local build footer identified `ca39e0f`. Chrome closed, its owned temporary profile was removed after resolved-path containment verification, and the owned local server stopped before the GPU window was released.

## Evidence

- [Actual 200% setting](assets/m10-headroom-native-200-settings-1024.png).
- Complete relationship: [Earth](assets/m10-headroom-native-200-earth-aspect.png), [Outside](assets/m10-headroom-native-200-outside-aspect.png).
- [Exact scoped validator](M10-native-zoom-headroom-validator.mjs), used with the GPU-clearance flag and a matching source-revision guard.

All 17 raw screenshots, served-source responses and full measurements remain in `.cache/m10-native-zoom-rectified/ca39e0f2-2026-10-26T06-36-36-581Z/`. The focused engine JSON remains at `.cache/m10-terminal-headroom-engines.json`; both raw records and all retained captures have SHA-256 hashes in the structured amendment. Historical reports and captures are unchanged.
