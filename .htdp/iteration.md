# Iteration

anchor: b5b8f4e02d0134de7908cf9a26987f32d96e18e1
started: 2026-04-30T04:48:22Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript
transparent: true

## Source Artifacts

- PRD: none
- Issue: .htdp/issues/issue-0021-add-i-key-to-return-from-results-to-search.md
- Issue: .htdp/issues/issue-0024-restore-double-escape-popup-close.md
- Issue: .htdp/issues/issue-0025-integrate-key-hints-into-command-palette-ui.md
- Issue: .htdp/issues/issue-0026-use-recent-closed-deep-mode-order.md
- Issue: .htdp/issues/issue-0027-make-space-primary-query-separator.md
- Architecture review: none

## Problem

Implement the five latest Scry popup keyboard/UI issues: add `/` as a focus-search shortcut alongside `i`; restore double-Escape so Escape from result/navigation mode closes or leaves the popup; remove the footer key-hint line and integrate useful hints into the UI; change search-mode order to recent, closed, deep; and make space-separated URL-fragment queries the primary documented syntax while keeping existing punctuation-tolerant parsing.

## Data Definition Plan

Use data-definition-driven stubbing because this is JavaScript and the relevant definitions are JSDoc/domain models rather than compiler-enforced types. Update existing models rather than adding persistent data: `SearchMode` ordering changes to recent/closed/deep; result/navigation key handling gains `/` as focus-search and `Esc` as close/leave; the mode indicator/header model should support bracket labels like `[recent]`, a mode-switch hint, and a real-result count; selected visible rows should expose action hints derived from row capabilities (`y copy`, plus `c edit URL` only for editable real result rows); `ParsedQuery` remains unchanged because tokenization already treats spaces as separators.

## Polya Ledger

### Knowns

- `i` already returns from result/navigation mode to the search input; `/` does not yet.
- `Esc` from search enters result/navigation mode; `Esc` from result/navigation currently keeps focus on the selected result instead of closing.
- Mode order is currently `recent -> deep -> closed`; product direction is `recent -> closed -> deep`.
- Query tokenization already treats spaces and `*` as token separators; current UI/docs still promote `*`.
- Footer hints still exist and tests currently assert that footer.
- Baseline before this iteration: `npm test` passed with 184 tests and `npm run check` passed.
- Worktree was already dirty before this implementation request in `src/core/search.js`, `src/panel/app.js`, `tests/scry-core.test.js`, and `tests/scry-panel.test.js`; preserve existing behavior unless in scope.

### Constraints

- Keep Scry a local-only Chrome MV3 popup command palette.
- Avoid external network calls, host permissions, content scripts, and options pages.
- Preserve old-Google sparse styling and avoid card-like UI chrome.
- Preserve selected-row actions: `y` copy, `c` edit URL, `h/l` page.
- Preserve ranking, history/session loading, selection learning, and result open behavior.
- Run `npm test` and `npm run check` after implementation changes.

### Unknowns That Matter

- [resolved] Scope means issues `0021`, `0024`, `0025`, `0026`, and `0027`, not all open `.htdp/issues`.
- [resolved] `*` remains tolerated for backward compatibility; it should not be rejected, just removed from primary UI/docs examples.
- [resolved] Real result count excludes synthetic rows such as `Open typed URL`.
- [resolved] Placeholder may mention both `i` and `/` as focus-search shortcuts.

### Out of Scope

- Rejecting `*` input.
- Changing search ranking, selection learning semantics, history/session loading, or result open destination.
- Adding settings, slash-prefixed command syntax, web search, bookmarks, tabs, options pages, content scripts, or external assets.
- Implementing older broad/HITL issues outside `0021`, `0024`, `0025`, `0026`, and `0027`.

### Assumptions

- The old mode status text can remain available in accessible labels/title/status text, but the visible row should be `Search [mode] history` plus right-aligned result count and mode-switch hint.
- Selected-row hints appear only on the currently selected visible row.
- `y copy` is available for any selected row with an openable/copyable URL, including the synthetic typed URL row; `c edit URL` is available only when `rowEditableText` returns a value.
- Existing `h/l` hints in pagination buttons already satisfy the integrated pagination-hint requirement.

### Alternatives Considered

- Remove punctuation separators from tokenization — rejected because issue explicitly allows backward-compatible `*` tolerance and changing tokenization would broaden risk.
- Keep `mode: recent` text and add label words around it — rejected because the issue gives bracket labels like `[recent]` as the target row treatment.
- Keep visible footer and duplicate hints in row UI — rejected because the issue asks to remove footer hints.
- Put selected-row actions in a global row below results — rejected because the issue asks to put `y/c` into the selected result list item bottom row.
- Chosen: reuse existing row/mode/focus models with small additive helper/model changes and update UI copy/tests/docs.

### Decision Log

- 2026-04-30T04:48:22Z — user chose to start fresh and implement issues `0021`, `0024`, `0025`, `0026`, and `0027`.
- 2026-04-30T04:48:22Z — user confirmed the Phase 0 understanding with `go`.
- 2026-04-30T04:55:42Z — stubber completed 11 wishes across 4 layers and flagged expected assertion changes for new mode order, Escape-close behavior, and integrated/no-footer UI hints.
- 2026-04-30T04:56:00Z — user approved proceeding to Phase 2 with the flagged assertion changes.
- 2026-04-30T06:30:00Z — final verification item 1 failed: bracket characters were only notation for a badge, not literal label text; the right-aligned header count should be the active corpus/status total formerly shown next to the Scry title, not the current filtered visible-result count.

### Look Back

- Phase 3 abstractor extracted shared `escapeHtml` usage into `src/core/format.js` import reuse and `modeIndicatorModelFromHeaderModel` in `src/panel/app.js`.
- HtDP status updates for class-method wishes were repaired after wrapper regressions; source/test verification remained clean.
- Final acceptance audit found and fixed remaining static footer/star-placeholder/README copy gaps for issues 0025 and 0027.
- Final test audit removed stubber TODO acceptance tests after adding/confirming real coverage; `npm test` now reports 0 todo tests.
- Human final verification corrected the badge/count interpretation: badge text should be plain mode text and header count should show active mode total/status text.
