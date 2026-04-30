---
id: issue-0026
status: draft
type: feature
mode: AFK
source_prd: null
depends_on: []
remote:
  github: null
---

# Use recent, closed, deep mode order

## What to build

Change the search-mode ordering so `[closed]` is second and `[deep]` is third. Forward cycling should be `recent -> closed -> deep -> recent`; reverse cycling should be `recent -> deep -> closed -> recent`. The order should be consistent for keyboard cycling, clickable badge cycling, cache initialization order where visible to tests, and any UI copy that lists the modes.

## Acceptance examples

- [ ] Given Scry starts, then the default mode is still `recent`.
- [ ] Given focus is in the search input and the current mode is `recent`, when the user presses `Tab`, then the active mode becomes `closed`.
- [ ] Given the current mode is `closed`, when the user presses `Tab`, then the active mode becomes `deep`.
- [ ] Given the current mode is `deep`, when the user presses `Tab`, then the active mode becomes `recent`.
- [ ] Given focus is in the search input and the current mode is `recent`, when the user presses `Shift+Tab`, then the active mode becomes `deep`.
- [ ] Given the mode badge is clicked repeatedly, then it follows the same `recent -> closed -> deep -> recent` order as `Tab`.
- [ ] Given tests or UI enumerate modes, then they list `recent`, `closed`, and `deep` in that order.
- [ ] Given a query is present during any mode switch, then the query is preserved and the selection/page reset behavior remains unchanged.

## Data definition impact

Expected change to the `SearchMode` ordering constant only. The set of variants remains `recent`, `closed`, and `deep`; their loading states, corpora, and cache shape should not otherwise change.

## HtDP entry note

Start from the search mode model in `src/core/search-modes.js` and the panel tests that exercise mode cycling. This is an ordering slice: do not change what each mode loads, how closed sessions are flattened, or how deep history is fetched.

If an older issue still describes `recent -> deep -> closed`, treat this issue as the newer product direction for ordering.

## Verification

Run:

```bash
npm test
npm run check
```

Expected test coverage:

- `SEARCH_MODES`/cache key order is `recent`, `closed`, `deep`.
- Forward and reverse mode cycling match the new order.
- Panel `Tab`, `Shift+Tab`, and mode-badge click behavior use the same order.
- Query preservation and selected-result reset behavior still pass existing mode-switch tests.

Manual check after implementation: load Scry, press `Tab` repeatedly from recent mode, and verify the visible badge advances to closed before deep.

## Blocked by

- None - can start immediately.

## HtDP iterations

- None yet.

## Out of scope

- Adding or removing search modes.
- Changing mode labels beyond what is needed for the new order.
- Changing lazy loading, caching, ranking, or result rendering for any mode.
