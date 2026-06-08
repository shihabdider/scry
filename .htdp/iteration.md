# Iteration

anchor: 94a293fff2e89b7ad522a3a16a6c2ebcbc854811
started: 2026-06-08T02:31:53Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript
transparent: true
worktree-mode: false
worktree-name: none
integration-target: none

## Source Artifacts

- PRD: none

## Problem

Prevent Scry from persisting incognito browsing-derived URLs while still allowing the extension popup and commands to work in incognito. Passive history search remains in-memory; persistent writes that could capture incognito sites must be skipped when their source is an incognito tab or incognito extension popup.

Functional checkpoint: With the extension allowed in incognito, opening Scry in an incognito window still lets the user search/open URLs, but selecting a result from the incognito popup does not write selection-learning data, and Alt+Shift+F/context-menu favorite saves from incognito tabs no-op without writing `chrome.storage.local`. Normal-window favorites and selection learning continue to work.

## Data Definition Plan

Add or reuse a small incognito-context data definition representing Chrome's incognito signals: a popup/extension context flag (`chrome.extension.inIncognitoContext`) and tab-origin flags (`tab.incognito`). Use it at storage-write boundaries only. Background favorite save targets should reject incognito tabs before URL normalization/storage. Popup selection-learning should open the selected row as before but skip `recordSelection`/`saveSelectionData` when the popup is in an incognito extension context. Keep history fetch/index behavior unchanged because Scry does not persist fetched history and Chrome history does not include incognito visits.

## Ledger

### Knowns

- Scry currently fetches Chrome history into an in-memory index via `chrome.history.search`.
- Persistent local writes currently include favorites in `chrome.storage.local` and selection-learning data in `chrome.storage.local`.
- Favorites can currently be saved from the active tab command and context menus.
- Selection learning is written after opening a real result row.
- The extension should remain local-only and continue working in incognito.

### Constraints

- Do not add external network calls, host permissions, content scripts, or options pages.
- Do not disable incognito operation; only skip privacy-sensitive persistent writes from incognito contexts.
- Preserve normal-window behavior.
- Run `npm test` and `npm run check` after implementation.

### Unknowns That Matter

- [resolved] Interpret “not store those sites” as avoiding persistent writes derived from incognito tabs/popups, not disabling in-memory search/open behavior.

### Out of Scope

- Removing any incognito URLs that may already have been stored before this change.
- Changing Chrome's own history/session APIs or browser-level incognito behavior.
- Hiding regular-window favorites/selection data from incognito search UI.

### Assumptions

- `chrome.extension.inIncognitoContext` is the appropriate popup-context signal when available.
- `tab.incognito === true` is the appropriate background tab-source signal for command/context-menu saves.

### Decisions

- 2026-06-08T02:31:53Z — Start a fresh HtDP iteration for incognito privacy write suppression.

### Look Back

- Phase 1 added an `IncognitoContext` data definition and wishes for extension-context detection, tab-origin detection, persistence policy, incognito-aware favorite targets, and incognito-safe selection learning.
- Phase 2 implemented `src/platform/incognito-context.js`, guarded background favorite save targets when `tab.incognito === true`, and guarded popup selection-learning writes when `chrome.extension.inIncognitoContext === true`.
- Phase 3 abstracted duplicated incognito-context construction into a shared helper.
- Verification passed with `npm test` (403 tests), `npm run check`, and HtDP `final_preverify`.
- Cleanup removed unintended `.codegraph` artifacts from this checkpoint.
