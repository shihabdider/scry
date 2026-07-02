## Architecture
- style: existing
- scope: none
- reference: none

## Core/Shell Model
- Model: not selected; no app state changes
- Event: not selected
- Effect: not selected
- View: not selected
- Runtime: existing Chrome MV3 manifest/action surfaces
- Interface adapters: Chrome reads manifest icon maps for extension and toolbar/action UI
- Effect adapters: none
- Exceptions: None

## Wish List

### Layer 2 (implement first)
- `ExtensionIconAssetSet(sourcePng: PNG): icons/*.png` in `icons/`
  Purpose: Materialize Scry icon PNG assets from the provided 512x512 source at Chrome manifest sizes.
  Cases:
  - present 512x512 RGBA source PNG -> create valid `icons/scry-16.png`, `icons/scry-32.png`, `icons/scry-48.png`, and `icons/scry-128.png` with matching pixel dimensions.
  - missing or unreadable source PNG -> stop rather than committing broken manifest icon references.
  - generated sizes -> preserve the source image content without cropping or changing aspect ratio.
  Depends on: none

### Layer 1
- `manifest.icons` and `manifest.action.default_icon` in `manifest.json`
  Purpose: Reference the generated Scry icon assets as both the extension icon set and the Chrome action/toolbar icon set.
  Cases:
  - top-level `icons` -> includes keys `16`, `32`, `48`, and `128` mapped to the generated files.
  - `action.default_icon` -> includes the same generated icon files while preserving `default_title` and `default_popup`.
  - existing manifest permissions, commands, background service worker, and local-only boundary -> unchanged.
  Depends on: ExtensionIconAssetSet

### Layer 0 (implement last)
- `extension icon contract assertions` in `tests/extension-contract.test.js`
  Purpose: Guard that the manifest icon maps point at existing PNG files with the expected dimensions.
  Cases:
  - every manifest `icons` path exists and has PNG dimensions matching its numeric key -> test passes.
  - every `action.default_icon` path exists and has PNG dimensions matching its numeric key -> test passes.
  - missing file, non-PNG file, or mismatched dimensions -> test fails before manual Chrome loading.
  Depends on: manifest.icons and manifest.action.default_icon

## Data Definitions Created/Modified
- Planned `icons/` asset data: `ExtensionIconAssetSet` with `16`, `32`, `48`, and `128` PNG variants generated from `/var/folders/03/1mx3lhxn07580wmwrmjky0xh0000gn/T/pi-clipboard-e24bcc21-bfc6-4169-8d27-7542aefe0658.png`.
- Planned `manifest.json` data: top-level `icons` and `action.default_icon` maps from Chrome icon size keys to the generated asset paths.

## Assertion Changes Flagged
- None

## Assumptions / Interpretations
- Use `16`, `32`, `48`, and `128` as the minimal shared size set for top-level extension icons and the action icon.
- Reuse the same generated PNG files for `icons` and `action.default_icon` so Chrome uses the provided image consistently.
- No host permissions, content scripts, options page, network behavior, or app state changes are needed.

## Notes
- Source image was checked with `file` and is a 512x512 PNG.
- Stubber verification: `npm test` and `npm run check` passed after writing this wish list.
- After implementation, load the unpacked extension in Chrome and confirm the extension/action icon uses the provided image.
- Commit and push only after implementation and verification; avoid including unrelated untracked files unless intentionally part of the change.
