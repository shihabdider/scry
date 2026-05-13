# Iteration

anchor: db176a9bd3449152decb47dc332e0ab35e54c0d6
started: 2026-05-12T21:13:50Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript
transparent: true

## Source Artifacts

- PRD: none
- Issue: .htdp/issues/issue-0031-restore-recently-closed-browsing-mode.md
- Architecture review: none
- Project DSL: .htdp/DSL.json

## Problem

Restore a closed-only browsing/searching mode while preserving the cached deep-history default introduced by issue-0030. Scry should expose exactly two popup-session corpora: `history` (default, deep Chrome history) and `closed` (flattened Chrome recently closed tabs/windows). Tab, Shift+Tab, and the corpus badge should switch between these two corpora without changing the query.

## Data Definition Plan

Replace the single `HistoryCorpusState` view model with a two-mode popup-session cache. `SearchMode` should be `history | closed`; each `SearchModeState` tracks `status`, `index`, `error`, and `loadedAt`. Header/badge models should advertise a clickable corpus switch for `history` and `closed` only, not the old `recent` or `deep` variants. `ScryPanelApp` should load `history` from `fetchHistory({ deep: true })`, load `closed` from `fetchRecentlyClosed()` plus `flattenClosedSessions()`, search closed mode with `emptyQuerySort: 'recency'`, and reuse each ready mode's in-memory index for the popup session.

## Polya Ledger

### Knowns

- User confirmed the plan to keep cached deep history as the default history mode and restore a separate recently closed mode.
- The restored mode cycle should be two modes only: `history` and `closed`.
- Existing sessions provider exposes `fetchRecentlyClosed()` and `flattenClosedSessions()` for local Chrome sessions data.
- Existing search supports `emptyQuerySort: 'recency'`, which matches the desired recently closed browsing behavior.
- issue-0030 has been accepted as the baseline for cached deep-history default.

### Constraints

- Preserve the local-only MV3 boundary: no external network calls, host permissions, content scripts, options pages, or new permissions.
- Do not restore the old `recent` vs `deep` split; only `history` and `closed` should be user-visible corpora.
- Preserve query text, exact phrases, website filters, typed URL rows, pagination, selection learning, input mode, and result-navigation mode behavior while switching corpora.
- Closed mode failures should be local to the closed corpus; switching back to history should continue to use the cached deep-history corpus.
- Run `npm test` and `npm run check` after implementation.
- Complete exactly one issue-boundary commit for issue-0031.

### Unknowns That Matter

- None open. User confirmed the two-mode `history`/`closed` plan.

### Out of Scope

- Restoring old `recent` mode.
- Restoring old explicit `deep` mode; `history` is already deep by default.
- Recently closed ranking boosts inside the default history mode.
- Persisting either corpus index beyond the popup session.
- Changing permissions beyond the existing history/sessions/storage/tabs set.

### Assumptions

- The existing `#mode-indicator` DOM and CSS can become a clickable corpus badge again.
- The hidden deep-search fallback button can remain hidden and ignored for compatibility with existing markup/tests.
- Search-mode compatibility method names may remain if useful, but public behavior should expose `history`/`closed`, not `recent`/`deep`.

### Alternatives Considered

- Restore the old `recent -> closed -> deep` cycle — rejected because issue-0030 intentionally made deep history the default and removed the recent/deep split.
- Keep one corpus and add a ranking boost only — rejected for this request because the user wants to browse recently closed history directly.
- Chosen: two cached popup-session corpora, `history` and `closed`, with cycling UI restored only between those modes.

### Decision Log

- 2026-05-12T21:12:07Z — issue-0030 accepted as cached deep-history baseline; user requested a follow-up to restore closed-only browsing.
- 2026-05-12T21:13:50Z — user confirmed two-mode plan (`history` and `closed`) by replying "go".

### Look Back

- Restored a two-mode popup-session search cache: `history` remains the default deep-history corpus, and `closed` loads flattened Chrome recently closed tabs/windows.
- Restored Tab, Shift+Tab, and corpus badge switching between `history` and `closed` while preserving the query.
- Closed mode uses pure recency ordering for empty queries; history mode keeps frecency ordering.
- Abstractor extracted `ScryPanelApp.loadSearchModeState(state, loadRawEntries)` to share loading/error/index state transitions between history and closed loaders.
- Final symbolic verification passed with `npm test` (279 tests) and `npm run check` before human eval.
