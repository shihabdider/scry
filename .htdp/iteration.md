# Iteration

anchor: 9018c9412dc18b0fbdbbdbc897ccc0a0204f2a56
started: 2026-07-02T15:24:42Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript/HTML/CSS/JSON
transparent: true
architecture-style: existing
architecture-scope: local settings/options surface
worktree-mode: false
worktree-name: none
integration-target: none

## Source Artifacts
- PRD: none
- Architecture: none

## Problem

Add a local Chrome MV3 options page for Scry settings, especially internal command-palette keyboard shortcuts. Shortcut changes should propagate naturally to popup keyboard handling and key-hint labels.

Functional checkpoint: Save custom shortcut settings from the extension options page, then use the popup and see/use the configured labels for mode switching, row actions, pagination, and favorites remove/undo shortcuts.

## Data Definition Plan

Introduce a versioned `ScrySettings` record in `chrome.storage.local` under `scry.settings`. The v1 settings record contains a normalized shortcut map keyed by Scry command identifiers. Shortcut chords are stored as canonical human-readable labels (for example `Ctrl+Q`, `Alt+J`, `Shift+Tab`, `x`) and matched against `KeyboardEvent` modifier/key fields. Popup view models and row hints receive the active settings so labels and keyboard handlers derive from the same data. The options page reads, validates, saves, and resets the settings locally.

## Ledger
### Knowns
- Existing popup key handling is local JavaScript and can be made settings-aware.
- Chrome global command shortcuts (`Command+K`, favorite command) cannot be programmatically remapped by a custom options page; Chrome owns those at `chrome://extensions/shortcuts`.
- The extension already has `storage` permission.

### Constraints
- Keep Scry local-only and avoid host permissions, content scripts, and external network calls.
- An options page is explicitly requested for this issue and is therefore in scope.
- Preserve default shortcut behavior and existing key-hint labels when no settings are saved.
- Keep plain text typing in the search input modeless; plain-letter row shortcuts apply only when results are focused.
- Run `npm test` and `npm run check` after implementation.

### Unknowns That Matter
- None.

### Out of Scope
- Programmatically changing Chrome extension command shortcuts.
- Adding sync/cloud settings or external docs links.
- Adding non-shortcut user preferences beyond the initial settings/options framework.

### Assumptions
- A form-based options page with editable shortcut chord labels is sufficient for the first settings surface.
- Invalid shortcut entries should be rejected by the options page rather than persisted.
- Existing arrow/Ctrl-N/Ctrl-P compatibility movement shortcuts may remain when the primary movement shortcut is still at its default.

### Decisions
- 2026-07-02T15:24:42Z — Model settings as versioned local storage data with a shortcut map.
- 2026-07-02T15:40:00Z — Keep Chrome global shortcut remapping out of Scry settings and explain the Chrome shortcut page in the local options UI.
- 2026-07-02T16:05:00Z — Protect search input text entry from plain-letter configured row shortcuts.

### Look Back
- Added `options.html` and `src/options/*` for loading, saving, validating, and resetting shortcut settings.
- Added pure shortcut normalization/matching and settings storage modules.
- Threaded settings through popup keyboard translation, search surface models, row-action hints, pagination labels, and storage-change propagation.
- Added focused coverage for settings normalization, persistence, options app behavior, and popup propagation.
