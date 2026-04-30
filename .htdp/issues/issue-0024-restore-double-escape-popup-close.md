---
id: issue-0024
status: draft
type: bug
mode: AFK
source_prd: null
depends_on:
  - issue-0018
remote:
  github: null
---

# Restore double-Escape popup close behavior

## What to build

Scry should again support the two-step Escape flow: `Esc` from search/input mode enters result/navigation mode, and `Esc` from result/navigation mode closes or leaves the popup. In the user's terms, Escape in "normal" mode should quit Scry. This should work in addition to the existing Command-K open/toggle behavior managed by the extension.

## Acceptance examples

- [ ] Given the search input is focused, when the user presses `Esc`, then Scry enters result/navigation mode, focuses the selected result or result list, preserves the query, and keeps the popup open.
- [ ] Given Scry is already in result/navigation mode, when the user presses `Esc`, then Scry requests popup close with `window.close()` when available.
- [ ] Given Scry is already in result/navigation mode and `window.close()` is unavailable, when the user presses `Esc`, then Scry falls back to leaving panel focus via blur behavior.
- [ ] Given there are no visible result rows, when the user presses `Esc` once from search and again from result/navigation mode, then the second `Esc` still closes or leaves the popup.
- [ ] Given the selected result row has focus, when the user presses `Esc`, then Scry does not open, copy, or edit the selected result.
- [ ] Given Scry is opened or toggled by Command-K, then this Escape flow does not regress initial search focus or the extension shortcut contract.

## Data definition impact

Expected clarification to the existing focus-mode state machine: `search --Esc--> results/normal --Esc--> blurred/closed`. No new persistent data is expected.

## HtDP entry note

Start from the current popup focus lifecycle in `src/panel/app.js`. The goal is a narrow behavior fix: result/navigation mode should treat `Esc` as quit/leave, not as a no-op refocus. Preserve the first-Escape transition out of the search input, result activation behavior, and local-only extension boundaries.

## Verification

Run:

```bash
npm test
npm run check
```

Expected test coverage:

- First `Esc` from the input enters result/navigation mode and preserves query text.
- Second `Esc` from result/navigation mode calls `window.close()` when present.
- Fallback blur behavior is used when `window.close()` is absent.
- No selected-row action fires on `Esc` from result/navigation mode.

Manual check after implementation: load the unpacked extension, open Scry with Command-K, type a query, press `Esc` once to browse results, then press `Esc` again and confirm the popup closes.

## Blocked by

- issue-0018 for the underlying Escape focus lifecycle. Current repository behavior can be inspected directly because that issue is marked done.

## HtDP iterations

- None yet.

## Out of scope

- Changing Command-K registration or Chrome shortcut settings.
- Redesigning visible key hints.
- Changing result navigation, copy, edit, or open shortcuts.
