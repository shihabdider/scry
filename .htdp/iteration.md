# Iteration

anchor: 9a4b904bdcd58af5529e33972601f73b03cd2732
started: 2026-04-27T18:29:21Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript
transparent: true

## Source Artifacts

- Issue: .htdp/issues/issue-0001-result-actions-url-edit-flow.md
- Issue: .htdp/issues/issue-0002-search-modes-recent-deep-closed.md
- Issue: .htdp/issues/issue-0003-quoted-exact-matching.md
- Issue: .htdp/issues/issue-0004-build-scry-history-first-url-recall-extension.md
- Issue: .htdp/issues/issue-0007-open-selected-history-results-from-the-side-panel.md
- Issue: .htdp/issues/issue-0012-add-explicit-deep-search-for-expanded-history.md
- Issue: .htdp/issues/issue-0014-harden-privacy-source-isolation-and-finish-acceptance-coverage.md
- Issue: .htdp/issues/issue-0021-add-i-key-to-return-from-results-to-search.md
- Issue: .htdp/issues/issue-0022-investigate-right-aligning-scry-popup-to-extension-anchor.md
- Issue: .htdp/issues/issue-0023-make-deep-search-an-explicit-search-mode.md

## Problem

Implement all open Scry issues in dependency order while preserving the accepted Chrome action-popup product direction. The work spans query precision, Vim-style result actions and typed URL affordances, explicit recent/deep/closed search modes, privacy/source-isolation acceptance coverage, and popup-alignment investigation/documentation. Side panel behavior is deprecated and must not be reintroduced.

## Data Definition Plan

Dependency tree:

- Root product boundary: Scry remains a local-only MV3 Chrome action popup for history-first URL recall.
  - Parent/coverage: issue-0004 parent PRD and issue-0014 acceptance/privacy coverage.
  - Query/search branch: issue-0003 quoted exact matching.
    - Add parsed query representation separating unquoted tokens from complete quoted exact phrases.
    - Add exact phrase representation with raw text, whitespace-normalized match text, smart-case flag, and match evidence.
  - Result/action row branch: issue-0021 then issue-0001.
    - Add visible row/result union for real corpus results vs synthetic `Open typed URL` action rows.
    - Add typed URL candidate representation with display input and normalized navigable URL.
    - Update focus-mode semantics to search/results with no Esc-driven close path in result mode.
    - Add transient copied-feedback state keyed by row/result/action.
  - Search-mode branch: issue-0023, issue-0012, then issue-0002.
    - Add `SearchMode` enum/variant: `recent`, `deep`, `closed`.
    - Add per-popup-session mode cache keyed by mode with idle/loading/ready/error state.
    - Add closed-session adapter flattening Chrome sessions tab/window records into the existing normalized URL-entry shape, filtering to known `lastModified` within 24 hours.
    - Add mode indicator model and mode-switch behavior preserving query while resetting selected row/page.
  - Platform/investigation branch: issue-0022.
    - Determine whether Chrome action popup alignment is controllable. If unsupported, document the limitation and viable workaround; do not pivot away from popup.
  - Stale issue handling: issue-0007.
    - Mark as superseded/stale in interpretation: side panel is deprecated; do not implement a persistent side panel or keep-open-after-navigation requirement.

## Polya Ledger

### Knowns

- Scry is currently a plain JavaScript MV3 Chrome action popup, not a side panel.
- Baseline verification passes: `npm test` and `npm run check`.
- Existing code has recent/deep history fetching, result opening, selection learning, pagination, hjkl navigation, and popup-close-after-open behavior.
- Open issue `issue-0002` explicitly depends on `issue-0001` for typed URL row integration across modes.
- `issue-0023`/`issue-0012`/`issue-0004` overlap on making Deep Search explicit rather than a zero-results fallback.
- `issue-0021` is a subset of `issue-0001` result/action keyboard behavior.
- Chrome popup right alignment may be browser-controlled and may result in documentation-only work.

### Constraints

- Keep the product as a Chrome action popup; side panel is deprecated.
- Preserve local-only behavior: no external network calls.
- Do not add host permissions, content scripts, options page, bookmarks, tabs-as-search-results, commands, or web search fallback.
- Full closed-mode implementation may add Chrome `sessions` permission only for recently closed URL corpus support.
- Do not persist a full history index; deep/closed corpora are per-popup-session cache only.
- Closed mode is URL recall only; do not restore sessions.
- Opening real results records selection learning; opening synthetic typed URL row does not.
- Run `npm test` and `npm run check` through HtDP verification hooks.

### Unknowns That Matter

- [resolved] Side-panel keep-open behavior: user confirmed side panel is completely deprecated; keep popup architecture and treat issue-0007 as stale/superseded.
- [open] Chrome action popup right alignment support: must be investigated against Chrome extension API constraints; implementation depends on support.

### Out of Scope

- Reintroducing Chrome side panel UI.
- Restoring recently closed tabs/windows as sessions.
- Persisting an all-history or closed-session index across popup sessions.
- Escaped quotes inside quoted phrases.
- General command palette actions beyond the issue-defined URL open/yank/change and mode switching.
- External/web search, bookmarks, tab search, host permissions, content scripts, or options UI.

### Assumptions

- Full all-open batch includes draft and triage issues, but stale/overlapping artifacts should be resolved according to the accepted popup direction rather than implemented literally when contradictory.
- `issue-0002` should be implemented fully with `recent`, `deep`, and `closed` modes, including `sessions` permission, because user chose the full batch.
- `Esc` from search moves to result mode; `Esc` in result mode remains in Scry/actionable per issue-0001, superseding older popup-close-on-second-Esc behavior.
- Mode switching is available only while the search input is focused, plus clickable mode indicator.
- The current popup-close-after-opening behavior remains acceptable for normal result opens unless changed by an issue; the side-panel keep-open criterion is stale.

### Alternatives Considered

- Minimal `recent|deep` modes only — rejected because user selected full all-open batch.
- Full `recent|deep|closed` modes — chosen because it satisfies issue-0002 and organizes the Deep Search work as a dependency branch.
- Reintroduce side panel for keep-open-after-navigation — rejected by user; side panel is deprecated.
- Best-effort popup keep-open — rejected as stale issue interpretation; Chrome action popups are browser-controlled.

### Decision Log

- 2026-04-27T18:29:21Z — user selected full all-open batch but requested dependency-tree organization.
- 2026-04-27T18:29:21Z — configured HtDP mode autonomous and transparent true in AGENTS.md.
- 2026-04-27T18:29:21Z — user confirmed side panel is completely deprecated; keep popup architecture and treat side-panel keep-open as stale/superseded.
- 2026-04-27T18:37:36Z — Phase 1 stubber completed 50 wishes across 5 layers and flagged three existing test assertions whose oracles must change for sessions permission and non-closing result-mode Escape.
- 2026-04-27T18:40:00Z — user accepted flagged oracle changes: add `sessions` permission expectation and replace result-mode second-Escape close/blur assertions with non-closing actionable behavior.
- 2026-04-27T21:20:00Z — Phase 2 implementation completed all 50 wishes; final_preverify hook passed after correcting a temporary manifest shortcut regression back to Cmd/Ctrl+K.

### Look Back

- Leave empty for now.
