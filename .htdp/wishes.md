## Wish List

### Layer 2 (implement first)
- `nextSearchMode(currentMode: SearchMode, direction?: number): SearchMode` in `src/core/search-modes.js`
  Purpose: Cycle exactly between `history` and `closed`, using Shift+Tab/backward direction without introducing legacy `recent` or explicit `deep` modes.
  Depends on: none
- `searchModeStatusText(state: SearchModeState | null): string` in `src/core/search-modes.js`
  Purpose: Produce mode-specific status text for idle/loading/ready/error history and recently closed caches, including ready entry counts.
  Depends on: none
- `ScryPanelApp.activeSearchModeState(): SearchModeState | null` in `src/panel/app.js`
  Purpose: Return the cache state for the currently active `history` or `closed` popup-session corpus.
  Depends on: none
- `ScryPanelApp.emptyQuerySortForMode(mode?: SearchMode): 'frecency' | 'recency'` in `src/panel/app.js`
  Purpose: Select frecency ordering for default deep history and pure recency ordering for recently closed empty-query results.
  Depends on: none
- `ScryPanelApp.resultMessagesForMode(mode?: SearchMode): { empty: string, noMatches: string, error: string }` in `src/panel/app.js`
  Purpose: Provide user-visible empty/no-match/error messages that distinguish history from recently closed mode.
  Depends on: none
- `ScryPanelApp.loadHistoryMode(state: SearchModeState): Promise<SearchModeState>` in `src/panel/app.js`
  Purpose: Load deep Chrome history with `fetchHistory({ deep: true })`, build an index, and update the history cache state for this popup lifetime.
  Depends on: none
- `ScryPanelApp.loadClosedMode(state: SearchModeState): Promise<SearchModeState>` in `src/panel/app.js`
  Purpose: Load Chrome recently closed sessions, flatten them into history-like entries, build an index, and update the closed cache state for this popup lifetime.
  Depends on: none

### Layer 1
- `searchSearchSurfaceModel(cache: PopupSessionSearchCache | null, options?: { realResultCount?: number }): SearchSurfaceModel` in `src/core/search-modes.js`
  Purpose: Build the clickable active corpus badge model for the two-mode history/closed cycle while preserving the current query.
  Depends on: searchModeStatusText, nextSearchMode
- `ScryPanelApp.ensureSearchModeReady(mode?: SearchMode): Promise<SearchModeState>` in `src/panel/app.js`
  Purpose: Reuse a ready/in-flight per-mode cache or dispatch the appropriate loader for `history` or `closed`.
  Depends on: activeSearchModeState, loadHistoryMode, loadClosedMode

### Layer 0 (implement last)
- `searchSearchHeaderModel(cache: PopupSessionSearchCache | null, options?: { realResultCount?: number }): SearchHeaderModel` in `src/core/search-modes.js`
  Purpose: Build the search header view model from the active two-mode surface, including badge label, switch hint, status, and accessibility text.
  Depends on: searchSearchSurfaceModel
- `ScryPanelApp.switchSearchMode(mode: SearchMode): Promise<SearchModeState>` in `src/panel/app.js`
  Purpose: Change the active corpus to `history` or `closed` without changing the query, load/reuse that corpus, refresh results, and render the popup.
  Depends on: ensureSearchModeReady, activeSearchModeState, emptyQuerySortForMode, resultMessagesForMode
- `ScryPanelApp.cycleSearchMode(direction?: number): Promise<SearchModeState>` in `src/panel/app.js`
  Purpose: Handle Tab, Shift+Tab, and badge clicks by cycling between the two corpora and delegating to mode switching.
  Depends on: nextSearchMode, switchSearchMode
- `ScryPanelApp.loadDefaultSearchMode(): Promise<SearchModeState>` in `src/panel/app.js`
  Purpose: Load the default `history` corpus on popup startup using the same two-mode switching/cache path.
  Depends on: switchSearchMode

## Data Definitions Created/Modified
- `src/core/search-modes.js`: replaced single `HistoryCorpusState` model with `SearchMode`, `SearchModeState`, `PopupSessionSearchCache`, `SearchSurfaceModel`, and `SearchHeaderModel` for exactly `history` and `closed`.
- `src/panel/app.js`: changed `ScryPanelApp` state to own a two-mode popup-session search cache and added stubs/templates for mode loading, switching, active-state lookup, result ordering, and mode-specific messages.
- `popup.html`: restored the popup badge/hint data shape for a clickable two-mode history/closed cycle.
- `.htdp/DSL.json`: updated popup-session corpus vocabulary from a single history corpus to two popup-session search corpora.

## Assertion Changes Flagged
- `tests/search-modes.test.js`: existing assertions/imports describe `createHistoryCorpusState`, non-clickable history-only badge/header models, and must be rewritten for `SearchModeState`/`PopupSessionSearchCache` and the clickable two-mode cycle.
- `tests/extension-contract.test.js:31`: assertion currently rejects `data-mode`; new popup badge uses mode/corpus data for the active two-mode cycle.
- `tests/extension-contract.test.js:54`: assertion currently requires a hidden empty switch hint; new requirement needs a visible Tab/Shift+Tab history↔closed hint.
- `tests/scry-panel.test.js:2107`: test name/assertions cover only `ensureHistoryCorpusReady`; needs replacement with two-mode cache readiness coverage.
- `tests/scry-panel.test.js:2130`: test asserts disabled single-history badge and no switch hint; needs clickable two-mode badge/header expectations.
- `tests/scry-panel.test.js:2165`: test asserts startup loads only the deep history corpus; should assert default history cache in the two-mode structure.
- `tests/scry-panel.test.js:2188`: test asserts Tab/badge clicks are swallowed; should assert they switch `history`/`closed` without changing the query.

## Assumptions / Interpretations
- I interpreted `history` as the default active mode at popup startup because the requirement says cached deep history remains the default.
- I interpreted the per-mode loading promise as a `loadingPromise` property on each `SearchModeState`, rather than separate app-level promise fields, to keep loading state colocated with each corpus.
- I kept the existing hidden legacy deep-search DOM section untouched except for the badge/header data shape because the issue scope allowed `popup.html` but did not explicitly ask to remove the already-hidden fallback markup.

## Notes
- `node --check src/core/search-modes.js` and `node --check src/panel/app.js` pass.
- `npm test` currently fails as expected because the created stubs throw and several tests still assert the old single-history corpus contract.
