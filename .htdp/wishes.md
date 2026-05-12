## Wish List

### Layer 0
- `HistoryCorpusState` and history surface models in `src/core/search-modes.js`
  Purpose: Replace recent/closed/deep search modes with one popup-session history corpus and non-clicking history surface/header models.
  Depends on: none
- `ScryPanelApp` history corpus loading/rendering in `src/panel/app.js`
  Purpose: Load deep Chrome history by default, cache it in memory for the popup session, render a single Search history surface, and swallow old corpus switch inputs.
  Depends on: HistoryCorpusState and history surface models
- Single-corpus tests and static popup contract updates
  Purpose: Delete obsolete mode-selection expectations and cover deep-by-default loading, cache reuse, disabled corpus badge, and swallowed Tab/badge switching.
  Depends on: ScryPanelApp history corpus loading/rendering

## Data Definitions Created/Modified

- `src/core/search-modes.js`: removed `SearchMode` / `SearchModeCache` exports and replaced them with `HistoryCorpusState`, `HistorySearchSurfaceModel`, and `HistorySearchHeaderModel`.
- `src/panel/app.js`: removed `searchMode`, `modeCache`, `deep`, and recently closed mode loading from panel state; added `historyCorpusState` and `historyCorpusLoadPromise`.
- `.htdp/DSL.json`: added `popup-session history corpus` vocabulary.

## Assertion Changes Flagged

- Obsolete tests that asserted recent/closed/deep mode cycling were removed or rewritten to assert the single history corpus behavior.

## Assumptions / Interpretations

- The old mode indicator element remains as a disabled history corpus badge to avoid unnecessary layout churn.
- `loadHistory()` and `switchSearchMode()` are retained as compatibility wrappers that always route to the same default history corpus; they do not expose mode selection.

## Notes

- `npm run check` passes.
- `npm test` passes.
