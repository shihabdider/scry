# Iteration

anchor: 1d5dfbf23c3ce75b23055ab9722e1f8d3306ce0c
started: 2026-05-12T11:20:00Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript
transparent: true

## Source Artifacts

- PRD: none
- Issue: .htdp/issues/issue-0032-suppress-result-highlight-in-input-mode.md
- Architecture review: none
- Project DSL: .htdp/DSL.json

## Problem

Scry should distinguish text-entry/input mode from normal result-navigation mode visually and behaviorally. While the search input is focused, no result row should render as selected or show selected-only action hints. Pressing Escape or the first down-arrow/Ctrl+N from the input should enter normal/result-navigation mode and make the first visible row the selected highlighted row so normal-mode commands such as y, c, j/k, and Escape work.

## Data Definition Plan

Use data-definition-driven stubbing because the JavaScript code is untyped and the change clarifies existing UI state rather than adding compiled types. Refine the existing `FocusMode` / `selectedIndex` relationship with a derived render-time selected state: `selectedIndex` may remain the internal action target, but visual selection, `aria-current`, and selected-only hints should be active only when `focusMode === 'results'`. Add or adjust input key transition helpers so Escape and first down-arrow from search mode enter results mode with selectedIndex reset to the first visible row, while subsequent normal-mode navigation continues to move the selected row.

## Polya Ledger

### Knowns

- The current panel has `focusMode` variants `search`, `results`, and `blurred`.
- The current panel keeps `selectedIndex = 0` by default and renders `.selected` whenever a visible row index equals `selectedIndex`.
- Result-mode commands (`y`, `c`, `j`, `k`, `h`, `l`, Enter, Escape) are handled only when `focusMode === 'results'` and the input is not focused.
- The user finds it confusing for the first item to appear highlighted while focus is still in the input.
- The user wants Escape or down-arrow from input mode to switch into normal mode and highlight the first item.

### Constraints

- Preserve the existing two-step Escape behavior: Escape from input enters result/navigation mode; Escape from result/navigation mode closes/leaves the popup.
- Preserve normal-mode actions (`y`, `c`, result-mode Escape, hjkl, Enter) once result-navigation mode is active.
- Keep Scry local-only; no network calls, host permissions, content scripts, options pages, or product-boundary expansion.
- Run `npm test` and `npm run check` after implementation.
- Complete exactly one issue-boundary commit for issue-0032.

### Unknowns That Matter

- None open. The issue acceptance criteria define the behavior needed for implementation.

### Out of Scope

- Changing search ranking, corpus loading, or history/search-mode behavior.
- Redesigning result styles beyond suppressing selected state in input mode.
- Changing mouse click behavior or typed URL/open result semantics.

### Assumptions

- The first down-arrow/Ctrl+N from input mode should not advance past the first row; it should enter normal mode with the first row selected.
- Up-arrow/Ctrl+P from input mode may continue to use existing movement semantics unless tests or code reveal a safer symmetric treatment is needed.
- Internal `selectedIndex` can remain 0 during input mode for Enter/open behavior; only visual/accessibility selected affordances are suppressed until normal mode.

### Alternatives Considered

- Set `selectedIndex` to `-1` during input mode — rejected because it would disrupt existing Enter/open and typed URL row actions unless many call sites special-case no selection.
- Add a separate `hasVisualSelection`/render helper derived from `focusMode` — chosen because it preserves internal action targeting while making selection visibility mode-specific.
- Blur input immediately whenever results rerender — rejected because typing should remain uninterrupted in input mode.

### Decision Log

- 2026-05-12T11:20:00Z — user requested execution after issue decomposition; proceeding autonomously on ready issue-0032 as the smallest independent UX slice.

### Look Back

- Phase 1 introduced derived render-time selection data so input mode can keep an internal action target without rendering selected UI.
- Phase 2 implemented first-row result-navigation entry for Escape and ArrowDown/Ctrl+N from input mode, preserving normal-mode selected-row actions afterward.
- Phase 3 found no useful abstraction opportunity; the tiny shared input transition sequence is clearer inline.
- Final symbolic verification passed with `npm test` and `npm run check`.
