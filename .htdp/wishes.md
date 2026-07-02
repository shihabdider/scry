## Wish List

### Layer 5 (implement first)
- `normalizeShortcutChord(chord: string): string` in `src/core/settings.js`
  Purpose: Canonicalize human-readable shortcut chords into one stable display/matching label.
  Cases:
  - `Ctrl+Q`, `ctrl + q`, `Control+q` -> `Ctrl+Q`.
  - `Shift+Tab` -> `Shift+Tab` with modifier order preserved canonically.
  - `x` -> `x` as a plain key shortcut.
  - empty, modifier-only, or unknown key text -> invalid chord result/error for callers to surface.
  Depends on: none

### Layer 4
- `keyboardEventMatchesShortcut(event: KeyboardEvent, shortcut: string): boolean` in `src/core/settings.js`
  Purpose: Match normalized shortcut labels against `KeyboardEvent` key/modifier data.
  Cases:
  - Ctrl key plus `q` -> matches `Ctrl+Q` and not `Q`.
  - Shift plus Tab -> matches `Shift+Tab` and not `Tab`.
  - plain `x` -> matches `x`; Ctrl/Alt/Meta/Shift plus `x` does not.
  - malformed shortcut string -> false rather than throwing during popup handling.
  Depends on: normalizeShortcutChord

- `normalizeScrySettings(rawSettings: unknown): ScrySettings` in `src/core/settings.js`
  Purpose: Convert missing, partial, legacy, or malformed stored settings into a complete versioned settings record.
  Cases:
  - missing storage value -> default version-1 settings.
  - partial shortcuts map -> normalized custom values plus defaults for missing ids.
  - malformed shortcut values -> default for that shortcut.
  - unknown settings version -> safe default/migration path without corrupting local storage.
  Depends on: normalizeShortcutChord

- `shortcutLabel(settings: ScrySettings, shortcutId: ScryShortcutId): string` in `src/core/settings.js`
  Purpose: Return the configured display label for a shortcut id with default fallback.
  Cases:
  - custom `copySelected: "Alt+C"` -> `Alt+C`.
  - missing shortcut id value -> default label for that id.
  - unknown shortcut id -> empty label or safe default without crashing rendering.
  Depends on: normalizeScrySettings

### Layer 3
- `loadScrySettings({ chromeApi }: { chromeApi?: object }): Promise<ScrySettings>` in `src/platform/settings-store.js`
  Purpose: Load normalized Scry settings from `chrome.storage.local` only.
  Cases:
  - storage key absent -> resolves default settings.
  - storage key present with valid shortcuts -> resolves normalized custom settings.
  - storage read failure -> rejects so panel/options can show or fall back deliberately.
  Depends on: normalizeScrySettings

- `saveScrySettings(settings: ScrySettings, { chromeApi }: { chromeApi?: object }): Promise<void>` in `src/platform/settings-store.js`
  Purpose: Persist normalized Scry settings to local extension storage.
  Cases:
  - valid customized shortcuts -> writes under `scry.settings` only.
  - partial/malformed settings argument -> writes normalized settings, not raw input.
  - Chrome storage failure -> rejects without mutating caller state.
  Depends on: normalizeScrySettings, scrySettingsStorageWrite

- `resetScrySettings({ chromeApi }: { chromeApi?: object }): Promise<ScrySettings>` in `src/platform/settings-store.js`
  Purpose: Restore default settings in local storage and return the normalized defaults.
  Cases:
  - existing custom settings -> overwritten with defaults.
  - no existing settings -> writes defaults idempotently.
  - storage failure -> rejects.
  Depends on: saveScrySettings

- `watchScrySettings(listener: Function, { chromeApi }: { chromeApi?: object }): Function` in `src/platform/settings-store.js`
  Purpose: Subscribe to local-storage settings changes and return an unsubscribe function.
  Cases:
  - `scry.settings` changes in local area -> listener receives normalized settings.
  - unrelated storage change -> ignored.
  - missing Chrome change API -> returns a no-op unsubscribe.
  Depends on: normalizeScrySettings

- `scrySettingsStorageWrite(settings: ScrySettings): object` in `src/platform/settings-store.js`
  Purpose: Build the exact local-storage write shape for Scry settings.
  Cases:
  - default settings -> `{ "scry.settings": defaultSettings }`.
  - customized settings -> same key with normalized shortcut map.
  Depends on: normalizeScrySettings

- `resultNavigationCommandForSettings(event: KeyboardEvent, settings: ScrySettings): ResultNavigationCommand` in `src/panel/app.js`
  Purpose: Translate row/navigation keyboard events through the configured shortcuts.
  Cases:
  - configured `nextPage: "Alt+J"` -> Alt+J produces `nextPage`; old Ctrl+D does not unless kept as compatibility fallback.
  - configured `copySelected: "c"` -> plain c copies from result focus while typing in the search input remains text input.
  - Escape/Enter defaults -> preserve close/open behavior under default settings.
  Depends on: keyboardEventMatchesShortcut

- `favoriteResultNavigationCommandForSettings(event: KeyboardEvent, context: object, settings: ScrySettings): ResultNavigationCommand` in `src/panel/app.js`
  Purpose: Add configured favorites remove/undo shortcuts to settings-aware row navigation.
  Cases:
  - favorites mode, selected result, configured remove `r` -> `removeSelectedFavorite`.
  - undo available, configured undo `Ctrl+Z` -> `undoFavoriteRemoval`.
  - search input focused -> plain remove/undo letters are not intercepted as row actions.
  Depends on: resultNavigationCommandForSettings, keyboardEventMatchesShortcut

- `isFilterModeSwitchShortcutForSettings(event: KeyboardEvent, settings: ScrySettings): boolean` in `src/panel/app.js`
  Purpose: Detect the configured mode-switch shortcut for public mode cycling and favorites exit.
  Cases:
  - default Ctrl+Q -> true for Ctrl+Q.
  - custom Alt+M -> true for Alt+M and false for Ctrl+Q.
  - malformed event -> false.
  Depends on: keyboardEventMatchesShortcut

- `selectedRowActionHintsForSettings(row: VisibleRow, options: object, settings: ScrySettings): RowActionHint[]` in `src/core/rows.js`
  Purpose: Render selected-row copy/edit hints with configured shortcut labels.
  Cases:
  - selected copyable/editable row -> labels use configured copy/edit chords.
  - selected typed-URL row -> copy hint only.
  - unselected row -> no hints.
  Depends on: shortcutLabel

- `selectedFavoriteRowActionHintsForSettings(row: VisibleRow, options: object, settings: ScrySettings): RowActionHint[]` in `src/core/rows.js`
  Purpose: Render favorites remove/undo hints with configured labels while preserving ordinary row hints.
  Cases:
  - selected favorite row -> copy/edit plus configured remove label.
  - undo available -> configured undo label appears after remove.
  - outside favorites mode or unselected -> no favorites-only hints.
  Depends on: selectedRowActionHintsForSettings, shortcutLabel

- `searchSearchSurfaceModelForSettings(cache: PopupSessionSearchCache, settings: ScrySettings, options?: object): SearchSurfaceModel` in `src/core/search-modes.js`
  Purpose: Build mode badge/surface data with the configured mode-switch hint.
  Cases:
  - public history/closed mode -> `modeSwitchHint` uses configured switch label.
  - hidden favorites mode -> hint uses configured switch label plus return copy.
  - missing settings -> default Ctrl+Q label.
  Depends on: shortcutLabel

- `searchSearchHeaderModelForSettings(cache: PopupSessionSearchCache, settings: ScrySettings, options?: object): SearchHeaderModel` in `src/core/search-modes.js`
  Purpose: Build search-header data with configured mode-switch labels.
  Cases:
  - custom switch label -> header hint text and accessible labels reflect it.
  - hidden favorites -> return hint reflects same configured shortcut.
  Depends on: searchSearchSurfaceModelForSettings

- `shortcutSettingsViewModel(settings: ScrySettings): ShortcutSettingsViewModel` in `src/options/app.js`
  Purpose: Derive the options-page form fields from normalized settings.
  Cases:
  - defaults -> one field for each `SCRY_SHORTCUT_IDS` entry with default value.
  - custom settings -> field values show custom normalized labels.
  - invalid/missing settings -> default field values.
  Depends on: normalizeScrySettings, shortcutLabel

- `scrySettingsFromShortcutForm(form: HTMLFormElement): ScrySettings` in `src/options/app.js`
  Purpose: Convert submitted options-page shortcut inputs into normalized settings.
  Cases:
  - edited valid fields -> returns version-1 settings with normalized shortcuts.
  - untouched fields -> returns defaults.
  - invalid chord field -> reports/throws validation without writing malformed settings.
  Depends on: normalizeShortcutChord, normalizeScrySettings

### Layer 2
- `ScryOptionsApp.start(): Promise<void>` in `src/options/app.js`
  Purpose: Wire the options page to load, save, validate, and reset settings using local storage only.
  Cases:
  - opening options with no saved settings -> form shows defaults.
  - saving valid custom shortcuts -> writes local settings and shows success status.
  - reset button -> writes defaults and refreshes the form.
  - invalid input or storage failure -> shows error status and does not silently lose existing settings.
  Depends on: loadScrySettings, saveScrySettings, resetScrySettings, shortcutSettingsViewModel, scrySettingsFromShortcutForm

### Layer 1
- `ScryPanelApp.loadSettings(): Promise<void>` in `src/panel/app.js`
  Purpose: Load normalized settings before the popup translates keys or renders key hints.
  Cases:
  - no saved settings -> popup keeps current default shortcuts/hints.
  - saved custom settings -> initial popup render uses custom labels and keyboard handling.
  - load failure -> safe fallback to defaults without preventing history search from loading.
  Depends on: loadScrySettings

- `ScryPanelApp.bindSettingsStorageChanges(): void` in `src/panel/app.js`
  Purpose: Keep an already-open popup in sync with local settings changes.
  Cases:
  - options page saves shortcuts while popup is open -> popup updates labels and handling.
  - unrelated storage changes -> ignored.
  - popup teardown/no change API -> no crash.
  Depends on: watchScrySettings, ScryPanelApp.applySettings

- `ScryPanelApp.applySettings(settings: ScrySettings): void` in `src/panel/app.js`
  Purpose: Replace active popup settings and rerender all shortcut-derived UI.
  Cases:
  - custom mode switch -> search header hint updates.
  - custom row-action/favorite shortcuts -> selected row hints update.
  - custom pagination shortcuts -> pagination button labels update.
  Depends on: normalizeScrySettings, searchSearchHeaderModelForSettings, selectedFavoriteRowActionHintsForSettings

### Layer 0 (implement last)
- `settings propagation assertions` in `tests/` for popup/options/settings modules
  Purpose: Prove changed options shortcuts propagate to popup labels and keyboard handling after reopen or storage change.
  Cases:
  - save custom mode switch in options, reopen popup -> new mode-switch label appears and old shortcut no longer switches.
  - save custom copy/edit/page shortcuts -> selected-row hints and pagination labels show configured labels and handlers use them.
  - save custom favorites remove/undo shortcuts -> favorites selected-row hints and focused-row handling use configured labels.
  - reset settings -> popup returns to default labels/handling.
  Depends on: ScryOptionsApp.start, ScryPanelApp.loadSettings, ScryPanelApp.bindSettingsStorageChanges, ScryPanelApp.applySettings

## Data Definitions Created/Modified
- `src/core/settings.js`: added versioned `ScrySettings`, `ScryShortcuts`, `ScryShortcutId`, default shortcut map, storage key, and pure shortcut/settings functions.
- `src/platform/settings-store.js`: added local `chrome.storage.local` settings persistence and change-watch functions.
- `options.html`, `src/options/app.js`, `src/options/main.js`, `src/options/styles.css`: added local MV3 options-page shell and options app/view-model implementation.
- `manifest.json`: added `options_page: "options.html"` while preserving existing local-only permissions and no host/content-script surface.
- `src/panel/app.js`, `src/core/rows.js`, `src/core/search-modes.js`: added settings-aware keyboard handling, row hints, search surface labels, storage-change propagation, and pagination labels.

## Assertion Changes Flagged
- `tests/extension-contract.test.js`: changed the manifest contract from asserting no `options_page` to expecting `manifest.options_page === "options.html"` because this requirement explicitly adds an options page.

## Assumptions / Interpretations
- Internal Scry shortcuts are local Scry settings, not Chrome `commands` API suggested keys.
- The configurable map covers primary internal command-palette actions; existing non-visible compatibility aliases can remain fallback behavior unless implementation chooses to model them explicitly.
- Invalid shortcut input should not be persisted; the options page should surface validation instead.

## Notes
- Plain-letter shortcuts apply when result rows are focused; the search input preserves normal text entry.
- Verification run: `npm run check` and `npm test` (430 tests).
