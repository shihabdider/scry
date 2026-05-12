# Iteration

anchor: 6ea9b7c39ee1a3c879886c71014883336813758b
started: 2026-05-12T19:45:00Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript
transparent: true

## Source Artifacts

- PRD: none
- Issue: .htdp/issues/issue-0030-use-cached-deep-history-by-default.md
- Architecture review: none
- Project DSL: .htdp/DSL.json

## Problem

Erase Scry's recent/closed/deep mode abstraction and use one popup-session history corpus by default. Startup should load Chrome history with deep bounds, cache the index in memory for the popup lifetime, and render a single non-cycling "Search history" surface. Tab/Shift+Tab and the old badge click path must no longer switch corpora.

## Data Definition Plan

Replace the old `SearchMode`/`SearchModeCache` model with a single `HistoryCorpusState` (`history`, `idle|loading|ready|error`, index, error, loadedAt) plus header/surface view models for the single history surface. In `ScryPanelApp`, replace `searchMode`, `modeCache`, `deep`, mode activation, and recently closed mode loading with `historyCorpusState` and `ensureHistoryCorpusReady()`, which always calls `fetchHistory({ deep: true })` and reuses the ready state. Keep recently closed ranking out of scope for issue-0031.

## Polya Ledger

### Knowns

- User clarified that we do want to erase the mode abstraction and that incremental compatibility with recent/closed/deep made the first attempt too slow and tangled.
- Current product direction: deep history is the default and only corpus surface for issue-0030.
- Recently closed should become a ranking signal later, not a separate mode here.
- The old mode badge DOM can remain as a non-clickable history corpus badge for minimal markup/style churn.

### Constraints

- Keep Scry local-only; no external network calls, host permissions, content scripts, options pages, or persisted full-history index.
- Use existing Chrome history deep bounds (`startTime: 0`, existing deep max results) through `fetchHistory({ deep: true })`.
- Preserve result navigation, input-mode highlight behavior from issue-0032, typed URL rows, pagination, selection learning, exact phrases, and website filters.
- Run `npm test` and `npm run check` after implementation.
- Complete exactly one issue-boundary commit for issue-0030.

### Unknowns That Matter

- None open. User explicitly chose the broad replacement/nuke strategy over incremental compatibility.

### Out of Scope

- Recently closed ranking boost or sessions API merge.
- Persisting the deep-history index across popup sessions.
- Ranking/parser/filter changes unrelated to corpus selection.
- Removing the historical `sessions` permission before issue-0031 decides how closed-session ranking is loaded.

### Assumptions

- Keeping the existing `#mode-indicator` element as a disabled `history` badge is acceptable because it no longer exposes a mode abstraction or switching behavior.
- Compatibility methods `loadHistory()` and `switchSearchMode()` may remain as no-op/default-history wrappers for internal callers/tests, but they do not preserve or expose recent/closed/deep modes.

### Alternatives Considered

- Continue the incremental HtDP-generated migration — rejected after it produced many serialized wishes, failing intermediate checks, and stale compatibility tests.
- Fully remove the badge element — rejected as unnecessary style/DOM churn for this slice; disabling it as a history corpus badge satisfies the behavior.
- Chosen: replace the mode module with single-corpus data definitions and simplify panel loading/rendering around that one state.

### Decision Log

- 2026-05-12T19:45:00Z — user confirmed the intended design is to erase the mode abstraction and approved resetting the tangled WIP for a direct replacement.

### Look Back

- Replaced `src/core/search-modes.js` with single history corpus data definitions and view models.
- Replaced panel mode state with one `historyCorpusState` loaded via deep history and cached for the popup session.
- Removed Tab/badge corpus cycling and rewrote obsolete mode tests into single-corpus coverage.
- Final symbolic verification passed with `npm run check` and `npm test`.
