## Wish List

### Layer 4 (implement first)
- `normalizeExactPhrase(rawText)` in `src/core/query.js`
  Purpose: Build an `ExactPhrase` from quoted text by collapsing whitespace, preserving punctuation, and setting the smart-case/case-sensitive flag.
  Depends on: none

- `collectExactPhraseEvidence(entry, exactPhrases)` in `src/core/search.js`
  Purpose: For one indexed URL entry, require every exact phrase to match contiguous normalized text in either display URL or title and return field/position evidence.
  Depends on: none

- `compareQuoteEvidence(a, b)` in `src/core/search.js`
  Purpose: Compare quote-match evidence so URL phrase matches outrank title-only matches and earlier positions break close ties.
  Depends on: none

- `toResult(entry, { tokens = [], now = Date.now(), debug = {} } = {})` in `src/core/search.js`
  Purpose: Preserve result display fields while carrying quote-match evidence in debug output for development inspection.
  Depends on: none

- `createTypedUrlCandidate(input)` in `src/core/url.js`
  Purpose: Conservatively detect URL-like search text and return display input plus a normalized navigable URL, adding `https://` for schemeless hosts.
  Depends on: none

- `rowOpenUrl(row)` in `src/core/rows.js`
  Purpose: Return the full navigable URL for either a real corpus result row or the synthetic `Open typed URL` row.
  Depends on: none

- `rowSelectionLearningKey(row)` in `src/core/rows.js`
  Purpose: Return the normalized selection-learning key for real corpus rows and no key for synthetic typed URL rows.
  Depends on: none

- `rowEditableText(row)` in `src/core/rows.js`
  Purpose: Return the display URL text used by the `c` change action for real rows while making synthetic typed URL rows a no-op.
  Depends on: none

- `isCopiedFeedbackVisible(row, copiedFeedback, now = Date.now())` in `src/core/rows.js`
  Purpose: Decide whether the transient copied marker is active for a visible row at the current time.
  Depends on: none

- `createModeCache()` in `src/core/search-modes.js`
  Purpose: Initialize a per-popup-session cache with `recent`, `deep`, and `closed` entries in idle/loading/ready/error-capable states.
  Depends on: none

- `cycleSearchMode(currentMode, { direction = 1 } = {})` in `src/core/search-modes.js`
  Purpose: Cycle the `SearchMode` enum forward or backward in `recent -> deep -> closed -> recent` order.
  Depends on: none

- `modeIndicatorModel(mode, state)` in `src/core/search-modes.js`
  Purpose: Produce the compact clickable mode indicator label and status model for the active search mode.
  Depends on: none

- `fetchRecentlyClosed({ chromeApi = chrome } = {})` in `src/platform/sessions-provider.js`
  Purpose: Isolate the Chrome `sessions.getRecentlyClosed` call behind a local adapter for closed-mode URL recall.
  Depends on: none

- `flattenClosedSessions(recentlyClosed, { now = Date.now() } = {})` in `src/platform/sessions-provider.js`
  Purpose: Flatten recently closed tab/window records into history-like URL entries, filtering to known top-level `lastModified` within 24 hours.
  Depends on: none

- `writeClipboardText(text, { navigatorApi = globalThis.navigator } = {})` in `src/platform/clipboard.js`
  Purpose: Copy a URL to the browser clipboard through an injectable local boundary for the `y` action.
  Depends on: none

- `resetSelectionForModeSwitch()` in `src/panel/app.js`
  Purpose: Reset selected row and page to the top when switching modes while preserving the current query.
  Depends on: none

- `focusSearch()` in `src/panel/app.js`
  Purpose: Enter search/insert mode and place the cursor at the end when invoked by `i` or `c`, while keeping normal input typing unchanged.
  Depends on: none

- `docs/action-popup-alignment.md` in `docs/action-popup-alignment.md`
  Purpose: Document whether Chrome action popup alignment is controllable; if unsupported, record the Chrome limitation and popup-preserving workaround.
  Depends on: none

### Layer 3
- `parseExactPhrases(query)` in `src/core/query.js`
  Purpose: Split live query text into unquoted search text plus complete quoted exact phrases, treating incomplete quotes as ordinary text.
  Depends on: normalizeExactPhrase

- `parseQuery(query)` in `src/core/query.js`
  Purpose: Return the full `ParsedQuery` with unquoted tokens, exact phrases, and a selection-learning key based on unquoted tokens.
  Depends on: parseExactPhrases

- `searchParsedHistory(index, parsedQuery, { now = Date.now(), limit = DEFAULT_LIMIT, selections } = {})` in `src/core/search.js`
  Purpose: Search an index from parsed query data by hard-filtering exact phrases, ranking quote-only queries by quote quality plus frecency, and preserving existing token ranking for mixed queries.
  Depends on: collectExactPhraseEvidence, compareQuoteEvidence

- `buildVisibleRows({ corpusResults = [], typedUrlCandidate = null, copiedFeedback = null } = {})` in `src/core/rows.js`
  Purpose: Build the visible row union, pinning a selected synthetic `Open typed URL` row above paginated real corpus rows when a typed URL candidate exists.
  Depends on: isCopiedFeedbackVisible

- `selectedVisibleRow()` in `src/panel/app.js`
  Purpose: Return the currently selected visible row across both synthetic typed URL action rows and real corpus result rows.
  Depends on: buildVisibleRows

- `ensureSearchModeReady(mode)` in `src/panel/app.js`
  Purpose: Lazily load and cache the active mode's index for this popup session, using history for recent/deep and sessions flattening for closed.
  Depends on: createModeCache, fetchRecentlyClosed, flattenClosedSessions

- `renderModeIndicator()` in `src/panel/app.js`
  Purpose: Render the active mode label/status and clickable mode affordance without reviving the legacy zero-results-only deep-search button.
  Depends on: modeIndicatorModel

### Layer 2
- `searchHistory(index, query, { now = Date.now(), limit = DEFAULT_LIMIT, selections } = {})` in `src/core/search.js`
  Purpose: Preserve the public search API while delegating to parsed-query search so quoted exact phrases integrate with existing ranking.
  Depends on: parseQuery, searchParsedHistory

- `recordSelection(data, { query, tokens, urlKey, selectedAt = Date.now() })` in `src/core/selection-learning.js`
  Purpose: Record selection learning from the parsed query identity used by the new query model while remaining bypassed for synthetic typed URL rows.
  Depends on: parseQuery

- `updateVisibleRows()` in `src/panel/app.js`
  Purpose: Convert current corpus results and current input into visible rows, including typed URL candidate and copied feedback state.
  Depends on: createTypedUrlCandidate, buildVisibleRows

- `copySelectedRow()` in `src/panel/app.js`
  Purpose: Copy the selected row's full normalized URL, set transient copied feedback for about 1.2 seconds, and keep focus/mode unchanged.
  Depends on: selectedVisibleRow, rowOpenUrl, writeClipboardText

- `changeSelectedRowToSearch()` in `src/panel/app.js`
  Purpose: Put the selected real result's display URL into the search input, focus search at the end, and immediately refresh live results; no-op for synthetic rows.
  Depends on: selectedVisibleRow, rowEditableText, updateResults

- `switchSearchMode(mode)` in `src/panel/app.js`
  Purpose: Switch to `recent`, `deep`, or `closed`, preserving query, resetting selection/page, ensuring the mode cache is ready, and refreshing rows.
  Depends on: ensureSearchModeReady, resetSelectionForModeSwitch, renderModeIndicator, updateResults

- `loadHistory({ deep })` in `src/panel/app.js`
  Purpose: Migrate the legacy deep-boolean load path onto the mode cache so recent/deep/closed mode loading is lazy, cached, and mode-local.
  Depends on: ensureSearchModeReady

- `openSelected({ newTab })` in `src/panel/app.js`
  Purpose: Open real or synthetic selected rows with current-tab/new-tab behavior, recording selection learning only for real corpus results.
  Depends on: selectedVisibleRow, rowOpenUrl, rowSelectionLearningKey

### Layer 1
- `updateResults()` in `src/panel/app.js`
  Purpose: Search the active mode's current index, then rebuild visible rows and render the updated UI without losing mode/query state.
  Depends on: searchHistory, updateVisibleRows

- `pageCount()` in `src/panel/app.js`
  Purpose: Compute page count for real corpus results while excluding the pinned synthetic typed URL row from pagination.
  Depends on: updateVisibleRows

- `pageStart()` in `src/panel/app.js`
  Purpose: Compute the first real corpus result index on the current page while visible rows may include a pinned synthetic row.
  Depends on: pageCount

- `clampPageIndex()` in `src/panel/app.js`
  Purpose: Keep the current page within valid corpus-result page bounds after mode switches, query edits, and typed-row insertion/removal.
  Depends on: pageCount

- `ensureSelectedVisible()` in `src/panel/app.js`
  Purpose: Keep keyboard selection visible across paginated corpus rows while respecting an always-visible pinned typed URL row.
  Depends on: pageStart, clampPageIndex

- `moveSelection(delta)` in `src/panel/app.js`
  Purpose: Move selection through the visible row union, including the synthetic row when present and all real corpus rows.
  Depends on: ensureSelectedVisible

- `movePage(delta)` in `src/panel/app.js`
  Purpose: Page through real corpus results without letting the synthetic typed URL row affect page counts.
  Depends on: pageCount, pageStart

- `focusSelectedResult()` in `src/panel/app.js`
  Purpose: Focus the selected DOM row whether it represents a synthetic typed URL action or a real corpus result.
  Depends on: selectedVisibleRow

- `renderPagination()` in `src/panel/app.js`
  Purpose: Render page controls and labels for real corpus results only, excluding the pinned typed URL row.
  Depends on: pageCount

- `renderResults()` in `src/panel/app.js`
  Purpose: Render visible rows for real results and synthetic typed URL actions, including copied feedback and mode-appropriate empty/error messages.
  Depends on: updateVisibleRows, renderPagination

- `renderLoading()` in `src/panel/app.js`
  Purpose: Show mode-specific loading state for recent/deep/closed while hiding stale deep-search fallback UI.
  Depends on: renderModeIndicator

### Layer 0 (implement last)
- `start()` in `src/panel/app.js`
  Purpose: Start Scry in recent mode, initialize selection data and mode cache, load only the recent corpus, and render the mode indicator.
  Depends on: createModeCache, ensureSearchModeReady, renderModeIndicator, updateResults

- `bindEvents()` in `src/panel/app.js`
  Purpose: Wire Tab/Shift+Tab mode switching from search input, clickable mode indicator cycling, and result-mode `i`/`y`/`c` actions.
  Depends on: switchSearchMode, copySelectedRow, changeSelectedRowToSearch, focusSearch

- `handlePanelKeydown(event)` in `src/panel/app.js`
  Purpose: Implement result-navigation mode semantics: `Esc` remains actionable without closing, `i` returns to search, `y` copies, `c` changes real rows, and existing j/k/h/l/Enter behavior remains.
  Depends on: copySelectedRow, changeSelectedRowToSearch, focusSearch, openSelected

- `manifest.permissions: string[]` in `manifest.json`
  Purpose: Add Chrome `sessions` permission for closed-mode URL recall while preserving the popup boundary and no host permissions/content scripts/options page.
  Depends on: fetchRecentlyClosed, flattenClosedSessions

- `popup mode indicator/footer markup` in `popup.html`
  Purpose: Replace the stale zero-results-only deep-search affordance with a visible clickable mode indicator and update footer hints for `i`, `y`, `c`, and non-closing result-mode `Esc`.
  Depends on: renderModeIndicator, bindEvents

- `popup row/action styles` in `src/panel/styles.css`
  Purpose: Style the pinned `Open typed URL` action row and inline copied feedback while preserving Scry's sparse old-Google popup aesthetic.
  Depends on: renderResults

## Data Definitions Created/Modified
- `src/core/query.js`: added `ExactPhrase`, `ParsedQuery`, and `QueryPhraseParse` JSDoc definitions; added `parseExactPhrases` and `normalizeExactPhrase` stubs; extended `parseQuery` with `unquotedTokens` and `exactPhrases` placeholder fields.
- `src/core/search.js`: added `HistoryIndex`, `SearchResult`, `ExactPhraseEvidence`, and `QuoteMatchResult` JSDoc definitions; added quote evidence/search stubs.
- `src/core/url.js`: added `TypedUrlCandidate` JSDoc definition and `createTypedUrlCandidate` stub.
- `src/core/rows.js`: created visible row union definitions for real corpus rows vs synthetic `Open typed URL` rows, plus copied-feedback definitions and row helper stubs.
- `src/core/search-modes.js`: created `SearchMode`, mode cache, mode state, and mode indicator definitions plus search-mode helper stubs.
- `src/platform/sessions-provider.js`: created closed-session record definitions and stubs for recently closed URL fetching/flattening.
- `src/platform/clipboard.js`: created injectable clipboard adapter stub for the `y` action.
- `src/panel/app.js`: added popup-session state placeholders for `searchMode`, `modeCache`, `visibleRows`, and `copiedFeedback`; added app-level stubs for mode switching, visible rows, copying, and changing rows.

## Assertion Changes Flagged
- `tests/extension-contract.test.js:15`: `assert.deepEqual([...manifest.permissions].sort(), ['history', 'storage', 'tabs'].sort())` — closed mode requires adding `sessions` to the expected permission set while preserving no host permissions/content scripts/options page.
- `tests/scry-panel.test.js:98`: `assert.equal(document.activeElement, null)` — issue-0001/0021 supersedes the old second-Esc close path; result-mode `Esc` should keep the selected row actionable.
- `tests/scry-panel.test.js:99`: `assert.equal(windowApi.blurCalls, 1)` — result-mode `Esc` should not blur/close Scry under the accepted popup interaction model.

## Assumptions / Interpretations
- The stale side-panel keep-open criterion in `issue-0007` is superseded: Scry remains a Chrome action popup, and I did not add side panel APIs or persistent keep-open-after-navigation behavior.
- I treated the current `tabs` permission as part of the existing accepted popup implementation because `openUrl` uses `chrome.tabs` for current-tab/new-tab navigation; the constraint means no tabs-as-search-results and no new tab corpus.
- I modeled quoted exact phrases as hard filters over display URL and title only, with match evidence stored in debug/ranking data rather than rendered in the normal UI.
- I modeled `Open typed URL` as a synthetic visible row, not a corpus result, so it is excluded from pagination and selection learning.
- I kept selection-learning query identity centered on unquoted tokens in the Phase 1 data model; if exact phrase selections should learn separately, `ParsedQuery.key`/`recordSelection` need a different key design.
- I modeled closed mode as a URL corpus adapter over Chrome sessions records only; it does not restore sessions or add session/window action rows.
- I left Chrome action popup alignment as a documentation/investigation wish because there is no runtime data path to stub without first confirming browser support.

## Notes
- Verification after Phase 1 stubbing: `npm test` passes (16 tests) and `npm run check` passes.
- No test files were edited in this phase; the flagged assertions are existing expectations that conflict with the new accepted behavior or required permission.
- Existing unimplemented stubs intentionally throw `not implemented` and are not wired into the current runtime path yet, so current tests remain runnable.
