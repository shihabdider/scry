---
id: issue-0030
status: ready
type: feature
mode: AFK
source_prd: null
depends_on: []
remote:
  github: null
---

# Use cached deep history by default

## What to build

Simplify Scry's history search so the normal/default corpus is deep browser history instead of a bounded recent-history mode. The popup should load and reuse one in-memory deep-history index for the popup session, and the UI should stop presenting `recent`, `closed`, and `deep` as peer search modes.

## Acceptance examples

- [ ] Given Scry starts, when the initial history corpus loads, then Chrome history is queried as deep history (`startTime: 0` with the existing deep limit or equivalent) rather than the bounded recent-history window.
- [ ] Given an old URL outside the previous recent-history window, when the user searches for it in the default input, then it can appear without switching modes.
- [ ] Given the default corpus is already ready in the current popup session, when results refresh or the user continues typing, then Scry reuses the in-memory index instead of re-querying Chrome history.
- [ ] Given the user presses `Tab`/`Shift+Tab` or clicks the old mode badge area, then Scry no longer cycles `recent`, `closed`, or `deep` modes or changes the active corpus.
- [ ] Given the header/status renders, then it communicates a single history search surface without a misleading mode-switch hint.

## Data definition impact

Expected simplification from the current `SearchMode` union/cache (`recent`/`closed`/`deep`) toward a single popup-session history corpus state. Keep the index in memory only; do not persist a full browser-history index.

## HtDP entry note

Start from `src/core/search-modes.js`, `src/panel/app.js`, `src/platform/history-provider.js`, and the panel tests around mode loading/cycling. This issue supersedes the product behavior accepted in `issue-0023` and `issue-0026`: deep history should be the default surface rather than an explicit mode, and the mode selector should not remain as a redundant UI. Keep Scry local-only and avoid external network calls, host permissions, content scripts, or options pages. This issue is intended to complete in one HtDP iteration and one commit.

## Verification

Run:

```bash
npm test
npm run check
```

Expected coverage:

- Startup/default loading uses deep-history query bounds and caches the result for the popup session.
- Old-history results are searchable without a mode switch.
- `Tab`, `Shift+Tab`, and badge clicks no longer cycle mode state.
- Header/status copy no longer advertises `recent`/`closed`/`deep` mode switching.

Manual check: open Scry, confirm the default search can find an older history item and no mode-cycling affordance changes the corpus.

## Blocked by

- None - can start immediately.

## HtDP iterations

- None yet. After implementation, record the single issue commit in the manifest and optionally reference it here.

## Out of scope

- Adding the recently closed ranking boost; that is covered by `issue-0031`.
- Persisting the full deep-history index across popup sessions.
- Changing token parsing, exact phrase matching, website filters, or selection-learning semantics.
