---
id: issue-0031
status: ready
type: feature
mode: AFK
source_prd: null
depends_on:
  - issue-0030
remote:
  github: null
---

# Restore recently closed browsing mode

## What to build

Keep the cached deep Chrome history corpus as Scry's default `history` mode, and add back a separate `closed` mode for browsing/searching recently closed tabs and windows. The popup should cycle only between `history` and `closed` with Tab / Shift+Tab and the corpus badge click path.

Closed mode should load local Chrome sessions via the existing sessions provider, flatten valid tabs/windows into history-shaped entries, build an in-memory index for the popup session, and search that index with the existing query, exact phrase, website filter, typed URL row, pagination, result-navigation, and selection-learning behavior. Empty closed-mode queries should be ordered by recency so the mode is useful as a recently closed history list.

## Acceptance examples

- [ ] Given Scry starts, when the default corpus loads, then the active mode is `history`, Chrome history is requested with deep bounds, and no recent-vs-deep mode split is exposed.
- [ ] Given the search input is focused, when the user presses Tab or Shift+Tab, then Scry switches between `history` and `closed` without changing the query.
- [ ] Given the corpus badge is clicked, then Scry switches between `history` and `closed` using the same popup-session caches.
- [ ] Given `closed` mode is active with an empty query, then flattened recently closed tabs/windows appear in recency order.
- [ ] Given query tokens, exact phrases, website filters, or a typed URL input are used in `closed` mode, then they compose with the existing search/result rendering behavior.
- [ ] Given closed sessions fail to load, then closed mode renders a local error state while switching back to `history` still uses the cached deep-history corpus.

## Data definition impact

Replace the single `HistoryCorpusState` with a small two-mode popup-session cache: `history` is backed by deep Chrome history; `closed` is backed by flattened recently closed sessions. Restore mode/header view models for a two-mode cycle while avoiding the old `recent`/`deep` variants.

## HtDP entry note

Implement after `issue-0030` has established cached deep history as the default corpus. Start from `src/core/search-modes.js`, `src/panel/app.js`, `src/platform/sessions-provider.js`, `popup.html`, and tests that currently assert the single disabled history badge. Preserve local-only MV3 behavior and keep Chrome `sessions`/`history` access within the existing extension boundary. This issue is intended to complete in one HtDP iteration and one commit.

## Verification

Run:

```bash
npm test
npm run check
```

Expected coverage:

- Core mode models expose exactly `history` and `closed` with accessible status text and switch hints.
- Panel startup loads cached deep history by default.
- Tab / Shift+Tab and badge click switch between cached `history` and `closed` corpora.
- Closed mode loads/handles sessions data and failures locally.
- Popup contract exposes a clickable corpus badge and no visible legacy deep-search fallback.

Manual check: close a tab, open Scry, switch to `closed`, and confirm the recently closed URL/title can be browsed or searched.

## Blocked by

- `issue-0030` must be accepted or explicitly waived so cached deep history remains the default corpus baseline.

## HtDP iterations

- None yet. After implementation, record the single issue commit in the manifest and optionally reference it here.

## Out of scope

- Restoring the old `recent` or separate `deep` modes.
- Recently closed ranking boosts inside the default `history` mode.
- Persisting recently closed metadata beyond the popup session.
- Changing Chrome permissions beyond existing local history/sessions needs.
