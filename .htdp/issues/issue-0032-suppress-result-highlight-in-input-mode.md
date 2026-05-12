---
id: issue-0032
status: ready
type: bug
mode: AFK
source_prd: null
depends_on:
  - issue-0018
remote:
  github: null
---

# Suppress result highlight in input mode

## What to build

Separate Scry's visual selection from its internal selected row while the search input is active. In input/search mode, no result row should look highlighted and selected-row action hints should stay hidden. Pressing `Escape` or the first down-arrow from the input should enter normal/result-navigation mode and highlight the first visible item; once in normal mode, existing navigation and action keys such as `y`, `c`, `j`, `k`, and `Escape` should work.

## Acceptance examples

- [ ] Given Scry opens with the search input focused and results are visible, then no result row has the selected highlight, no result button exposes `aria-current="true"`, and selected-only action hints are hidden.
- [ ] Given the user types and results rerender while the input remains focused, then the result list still has no visible highlighted item.
- [ ] Given the input is focused, when the user presses `Escape`, then Scry enters normal/result-navigation mode, focuses the results area or first row, and highlights the first visible item.
- [ ] Given the input is focused, when the user presses `ArrowDown` or `Ctrl+N`, then Scry enters normal/result-navigation mode and highlights the first visible item without skipping to the second row.
- [ ] Given Scry is already in normal/result-navigation mode, when the user presses arrow keys or `j`/`k`, then existing result navigation behavior continues to move the highlighted selection.
- [ ] Given Scry entered normal mode via `Escape` or down-arrow, when the user presses `y`, `c`, or result-mode `Escape`, then the normal-mode copy/edit/quit commands work without returning focus to the input first.

## Data definition impact

Expected clarification to the focus/selection state invariant: `selectedIndex` may remain an internal default for actions, but selected visual state and selected-only hints should render only when `focusMode === 'results'` (normal mode). No persistent data changes are expected.

## HtDP entry note

Start from the focus lifecycle in `src/panel/app.js`, the `.selected` rendering in `renderResults`, selected action hints from `src/core/rows.js`, and panel tests around Escape, arrow keys, and result-navigation shortcuts. Preserve the existing two-step Escape close behavior from `issue-0018`/`issue-0024`. The key product change is that input mode should feel like editing text, not like the first result is already active; entering normal mode should make selection visible and enable normal-mode commands. This issue is intended to complete in one HtDP iteration and one commit.

## Verification

Run:

```bash
npm test
npm run check
```

Expected coverage:

- Search/input mode renders visible rows without selected styling, `aria-current`, or selected-only hints.
- Typing/rerendering in input mode does not reintroduce a highlight.
- `Escape` from input mode highlights/focuses the first row in result-navigation mode.
- First `ArrowDown`/`Ctrl+N` from input mode enters result-navigation mode and highlights the first row without skipping.
- Result-navigation arrow keys and `y`/`c`/`Escape` shortcuts still work after the transition.

Manual check: open Scry, type a query, confirm no highlighted row while the cursor is in the input, press down-arrow, then press `y` or `c` and confirm the first row receives the normal-mode action.

## Blocked by

- `issue-0018` for the existing search/results focus lifecycle. It is already accepted in the manifest.

## HtDP iterations

- None yet. After implementation, record the single issue commit in the manifest and optionally reference it here.

## Out of scope

- Changing search ranking, corpus loading, or mode removal.
- Redesigning result styles beyond suppressing selected state in input mode.
- Changing mouse hover/click behavior.
