## Wish List

### Layer 3 (implement first)
- `modeIndicatorModel(mode: SearchMode, state: SearchModeState | null): ModeIndicatorModel` in `src/core/search-modes.js`
  Purpose: Return bracketed active-mode badge labels like `[recent]`, include the mode-switch hint, and preserve active-mode status text for accessibility/status UI.
  Depends on: none
- `resultNavigationCommandForKey(event: KeyboardEvent | { key?: string }): ResultNavigationCommand` in `src/panel/app.js`
  Purpose: Classify result/navigation-mode keys so `i` and `/` map to focus-search, `Escape` maps to leave/close, and selected-row actions/navigation remain distinct from normal input typing.
  Depends on: none
- `selectedRowActionHints(row: VisibleRow | null, options?: SelectedRowActionHintOptions): RowActionHint[]` in `src/core/rows.js`
  Purpose: Derive selected-row hints from row capabilities: show `y copy` for copyable selected rows and `c edit URL` only for selected editable real result rows.
  Depends on: none

### Layer 2
- `searchHeaderModel(mode: SearchMode, state: SearchModeState | null, options?: { realResultCount?: number }): HeaderSearchContextModel` in `src/core/search-modes.js`
  Purpose: Build the header model for `Search [mode] history`, the adjacent `Tab/Shift+Tab` hint, active-mode status text, and the right-aligned real URL result count.
  Depends on: modeIndicatorModel
- `ScryPanelApp.handlePanelKeydown(event: KeyboardEvent): void` in `src/panel/app.js`
  Purpose: Execute result/navigation commands, including `/` and `i` focusing search with cursor-at-end behavior and `Escape` leaving/closing via `leavePanelFocus` without triggering row actions.
  Depends on: resultNavigationCommandForKey
- `ScryPanelApp.renderModeIndicatorElement(model: ModeIndicatorModel): void` in `src/panel/app.js`
  Purpose: Render the mode badge with bracket label, clickability/status datasets, and accessible label/title compatible with the integrated header row.
  Depends on: modeIndicatorModel

### Layer 1
- `ScryPanelApp.renderSearchHeader(): HeaderSearchContextModel` in `src/panel/app.js`
  Purpose: Render or update the sparse header row so it reads like `Search [recent] history`, shows the mode-switch hint near the badge, and right-aligns the real result count.
  Depends on: searchHeaderModel, renderModeIndicatorElement
- `ScryPanelApp.renderResults(): void` in `src/panel/app.js`
  Purpose: Integrate selected-row action hints into the bottom/meta line of selected visible rows while keeping unselected rows hint-free and excluding synthetic rows from the real result count.
  Depends on: selectedRowActionHints, renderSearchHeader
- `ScryPanelApp.renderLoading(): ModeIndicatorModel` in `src/panel/app.js`
  Purpose: Keep the integrated header, badge status, and result-count/status area consistent while a mode is loading and stale results are cleared.
  Depends on: renderSearchHeader

### Layer 0 (implement last)
- `ScryPanelApp.renderModeIndicator(): ModeIndicatorModel` in `src/panel/app.js`
  Purpose: Coordinate mode status updates with the new integrated header model wherever mode state changes, including startup, mode switches, loading, ready, and error states.
  Depends on: renderSearchHeader, renderModeIndicatorElement
- `ScryPanelApp.updateResults(): void` in `src/panel/app.js`
  Purpose: Refresh search results and visible rows while preserving ranking/selection behavior and ensuring the header's real result count reflects the current active result set.
  Depends on: renderResults, renderSearchHeader

## Data Definitions Created/Modified
- `src/core/search-modes.js`: reordered `SEARCH_MODES` to `recent`, `closed`, `deep`; updated `SearchMode` JSDoc ordering; extended `ModeIndicatorModel`; added `HeaderSearchContextModel`; added stub `searchHeaderModel`.
- `src/core/rows.js`: added `RowActionHint` and `SelectedRowActionHintOptions` JSDoc models; added stub `selectedRowActionHints`.
- `src/panel/app.js`: added `FocusMode` and `ResultNavigationCommand` JSDoc models; added stub `resultNavigationCommandForKey`; added stub method `ScryPanelApp.renderSearchHeader`.
- `src/core/query.js`: clarified `ParsedQuery.tokens` documentation so space-separated URL fragments are primary while punctuation such as `*` remains tolerated.

## Assertion Changes Flagged
- `tests/search-modes.test.js:9`: `assert.deepEqual(Object.keys(cache), ['recent', 'deep', 'closed'])` — expected order must become `recent`, `closed`, `deep`.
- `tests/search-modes.test.js:42-51`: `cycleSearchMode` assertions still encode `recent -> deep -> closed`; they need the new forward/reverse order.
- `tests/scry-panel.test.js:2049-2055`: `Tab` from `recent` still expects `deep`; it needs to expect `closed` and use a closed-session fixture rather than deep-history calls.
- `tests/scry-panel.test.js:2070-2074`: follow-up `Shift+Tab` expectations depend on the old first hop and need review after the new `recent -> closed -> deep` order.
- `tests/scry-panel.test.js:2106-2112`: mode-badge click still expects `deep`; it needs to expect `closed` and closed-session loading/status.
- `tests/scry-panel.test.js:2665-2669`: result-mode `Escape` currently asserts the popup stays in results mode with no close; it must assert `leavePanelFocus`/close-or-blur behavior.
- `tests/extension-contract.test.js:33-34`: static popup mode markup still asserts `mode: recent`; it needs the bracket/header treatment.
- `tests/extension-contract.test.js:41-50`: footer hint assertions must be removed or inverted because the footer key-hint line should be absent.

## Assumptions / Interpretations
- I interpreted the integrated header model as separate text parts (`Search`, `[mode]`, `history`) so the existing clickable mode badge can remain the badge element.
- I used `Tab/Shift+Tab` as the canonical hint string in the model because the issue text names those keys; the renderer may choose equivalent glyphs if tests allow it.
- I interpreted the real result count as the current visible row set filtered to `kind === 'result'`, excluding `open-typed-url` synthetic rows.
- I interpreted `y copy` as available for any selected row with a URL from `rowOpenUrl`, including typed-URL rows, and `c edit URL` as available only when `rowEditableText` returns text.
- I left `ParsedQuery` behavior unchanged and only documented the primary space-separated syntax because current tokenization already tolerates spaces and `*`.
- I added acceptance coverage as `test.todo` stubs rather than changing existing assertions in the stubber phase.

## Notes
- Added `tests/acceptance-issues-0021-0027.todo.test.js` with non-failing TODO acceptance-test stubs for all five issues.
- `npm run check` passes after the stubs.
- `npm test` currently fails 5 legacy assertions caused by the deliberate `SearchMode` ordering data-definition change; the failing assertion areas are listed above.
- The worktree already had unrelated dirty changes in source/test files before this stubber pass; I did not attempt to revert or normalize them.
