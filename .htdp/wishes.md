## Wish List

### Layer 2 (implement first)
- `deriveResultRenderSelection(selection: { focusMode: FocusMode, selectedIndex: number }): ResultRenderSelection` in `src/panel/app.js`
  Purpose: Derive render-time selection from focus mode so `visualSelectedIndex` is `selectedIndex` only in result-navigation mode and `null` in input/blurred modes.
  Depends on: none
- `enterResultsModeSelection(state: { visibleRows: VisibleRow[] }): EnterResultsModeSelection|null` in `src/panel/app.js`
  Purpose: Compute the focus/selection transition from input mode to result-navigation mode, selecting the first visible row when any row exists.
  Depends on: none

### Layer 1
- `isVisibleRowSelectedForRender(visibleRowIndex: number, renderSelection: ResultRenderSelection): boolean` in `src/panel/app.js`
  Purpose: Decide whether a rendered row should receive selected-only UI state (`.selected`, `aria-current="true"`, and selected-row hints) by comparing its index to `visualSelectedIndex`.
  Depends on: deriveResultRenderSelection
- `ScryPanelApp.focusResults(): void` in `src/panel/app.js`
  Purpose: Enter result-navigation mode from input mode by resetting selection to the first visible row before focusing the selected result/list, while preserving result-mode focus behavior.
  Depends on: enterResultsModeSelection
- `ScryPanelApp.renderResults(): void` in `src/panel/app.js`
  Purpose: Render result rows with selected styling, `aria-current`, and selected-only action hints only when the derived render selection says a row is visually selected.
  Depends on: deriveResultRenderSelection, isVisibleRowSelectedForRender

### Layer 0 (implement last)
- `ScryPanelApp.bindEvents(): void` in `src/panel/app.js`
  Purpose: Route Escape and the first ArrowDown/Ctrl+N from the focused search input into result-navigation mode without advancing past the first visible row, while leaving subsequent normal-mode navigation unchanged.
  Depends on: ScryPanelApp.focusResults

## Data Definitions Created/Modified
- `src/panel/app.js`: refined `FocusMode` JSDoc with the invariant that visual selection is active only in `results` mode.
- `src/panel/app.js`: added `ResultRenderSelection` and `EnterResultsModeSelection` JSDoc data definitions.
- `src/panel/app.js`: added stubs for `deriveResultRenderSelection`, `isVisibleRowSelectedForRender`, and `enterResultsModeSelection`.
- `.htdp/DSL.json`: added durable vocabulary for `input mode` and `result-navigation mode`.

## Assertion Changes Flagged
- None

## Assumptions / Interpretations
- I interpreted “first visible row” as index `0` in `visibleRows`, including the synthetic “Open typed URL” action row when it is visible.
- I kept `selectedIndex` as the internal action target in input mode, per the task, rather than introducing an unselected sentinel such as `-1`.
- I interpreted ArrowUp/Ctrl+P from input mode as outside the requested transition change; the wish list targets Escape and ArrowDown/Ctrl+N exactly as specified.

## Notes
- `npm run check` and `npm test` pass after adding the unused stubs and data definitions.
