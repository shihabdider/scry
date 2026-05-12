---
id: issue-0033
status: ready
type: bug
mode: AFK
source_prd: null
depends_on:
  - issue-0018
remote:
  github: null
---

# Fix result navigation reset and arrow keys

## What to build

Correct the input/result-navigation lifecycle after `issue-0032` feedback. Returning to the search input from result-navigation mode should immediately remove visible result selection and reset the internal selection/page to the top. Arrow keys should operate in normal/result-navigation mode like `j`/`k`, and arrow keys from the input should enter result-navigation mode instead of mutating a hidden selection.

## Acceptance examples

- [ ] Given the user enters result-navigation mode and a row is highlighted, when they press `i` or `/`, then focus returns to the search input, no row remains highlighted, selected-only hints are hidden, and selection/page reset to the top.
- [ ] Given the search input is focused, when the user presses `ArrowDown`, `ArrowUp`, `Ctrl+N`, or `Ctrl+P`, then Scry enters result-navigation mode at the first visible row.
- [ ] Given Scry is in result-navigation mode, when the user presses `ArrowDown` or `Ctrl+N`, then the selection moves like `j`.
- [ ] Given Scry is in result-navigation mode, when the user presses `ArrowUp` or `Ctrl+P`, then the selection moves like `k`.
- [ ] Given normal typing keys are pressed in result-navigation mode, then they remain ignored unless they are defined normal-mode shortcuts.

## Data definition impact

No persistent data changes. This clarifies the transient focus/selection invariant introduced by `issue-0032`: input mode has no visual selected row and resets the normal-mode entry point to the top; result-navigation mode maps arrow-key commands to the same movement commands as `j`/`k`.

## HtDP entry note

This is a corrective follow-up to human evaluation feedback for `issue-0032`. Start from `src/panel/app.js`, `tests/result-navigation-command.test.js`, and `tests/scry-panel.test.js`. Preserve the single deep-history corpus behavior from `issue-0030` and keep the local-only extension boundary. This issue is intended to complete in one HtDP iteration and one commit.

## Verification

Run:

```bash
npm test
npm run check
```

Expected coverage:

- `i`/`/` from result-navigation mode clear visible selected styling and reset selection/page.
- Arrow-key and Ctrl+N/Ctrl+P command mapping is covered.
- Arrow keys from input enter result-navigation mode at the first visible row.
- Arrow keys continue moving selection in result-navigation mode.

Manual check: open Scry, press `Esc`, navigate, press `i`, confirm no highlighted row in input mode, then press down/up arrows and confirm they move the normal-mode selector.

## Blocked by

- `issue-0018` for the accepted focus lifecycle.

## HtDP iterations

- None yet. After implementation, record the single issue commit in the manifest and optionally reference it here.

## Out of scope

- Changing history corpus loading or ranking.
- Adding the recently closed ranking boost.
- Redesigning visual result styles beyond the selected-state reset.
