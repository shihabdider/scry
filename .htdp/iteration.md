# Iteration

anchor: 052c4778b1980ebaf69f661802a8aaf5d08195a6
started: 2026-06-08T00:49:56Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript
transparent: true
worktree-mode: false
worktree-name: none
integration-target: none

## Source Artifacts

- PRD: none
- Project DSL: .dsl.md

## Problem

Add a local-only hidden `favorites` search mode to Scry. Users can save URL-bearing pages/targets into a local favorites list, enter favorites with `:f` through `:favorite` + `Enter`, search saved favorites with Scry's existing URL recall behavior, exit favorites with `Tab` to the previous public mode, and remove selected favorites with one-level popup-session undo from list-selection mode.

Functional checkpoint: In Chrome, a user can add the current tab via a new unbound extension command, add page/link/image/video/audio/frame URLs via the right-click menu, type `:f` + `Enter` in Scry to view/search saved favorites, press `Tab` to leave favorites, and in favorites list-selection mode use `x remove` plus `u undo`.

## Data Definition Plan

Use data-definition-driven stubbing because this JavaScript extension change is additive. Add a `FavoriteUrl` / stored favorites data definition with URL, normalized key, title, added/updated timestamp, and local ordering semantics. Add pure normalization/upsert/remove/undo-adjacent helpers around favorites. Add a `favorites` hidden search mode while preserving the public `recent -> closed -> deep` cycle. Add a command parser for `:f[avorite]` entry. Add platform adapters for `chrome.storage.local` favorites, background command/context-menu saves, and popup loading/removal/undo. Reuse `buildHistoryIndex` / `searchHistory` by converting favorites into history-like entries with recency based on favorite update time.

## Ledger

### Knowns

- Public modes are `recent`, `closed`, and `deep`, cycled with `Tab` / `Shift+Tab`.
- `favorites` must be hidden from public mode cycling and entered by prefix command `:f` through `:favorite` + `Enter`.
- Entering favorites clears the input and shows all favorites.
- `Tab` in favorites exits back to the previous public mode.
- Favorites must be local extension data shared by popup/background using `chrome.storage.local`.
- A new unbound Chrome command saves the current active tab.
- Context menu saves URL-bearing contexts: page, link, image, video, audio, frame.
- Duplicate favorite saves update metadata and move the URL to the top.
- In favorites list-selection mode, selected favorite shows `x remove`; removal is immediate and `u undo` restores the most recently removed favorite for the current popup session.

### Constraints

- Keep Scry local-only: no external network calls, host permissions, content scripts, options page, or bookmark API dependency.
- Use Scry's existing URL acceptance/opening rules for favorites eligibility.
- Preserve existing public mode behavior, history/closed/deep ranking, typed URL action, copy/edit hints, and selection learning outside favorites.
- Run `npm test` and `npm run check` after implementation.

### Unknowns That Matter

- [resolved] Storage means `chrome.storage.local`, not DOM `window.localStorage`.
- [resolved] `Tab` from favorites returns to the previous public mode.
- [resolved] Entering favorites clears the input.
- [resolved] Keyboard add command has no default shortcut.
- [resolved] Context menu targets are page, link, image, video, audio, and frame.
- [resolved] Duplicate saves update metadata and move to top.
- [resolved] URL eligibility follows Scry's existing URL acceptance/opening rules.
- [resolved] Removal is included via `x remove` in favorites list-selection mode with one-level `u undo`.

### Out of Scope

- Syncing favorites across browsers/accounts beyond Chrome extension local storage.
- Importing/exporting or full favorite management UI.
- Persistent undo after closing the popup.
- Content scripts, host permissions, options pages, external network calls, or filesystem/bookmark API integration.
- Making favorites reachable by public mode `Tab` cycling.

### Assumptions

- Favorite recency should use the latest save/update time for empty-query ordering.
- Background save feedback can be minimal for this pass because the requested checkpoint is functional local saving/searching, not rich notifications.
- One-level undo only needs to be represented in popup memory; after undo, the restored favorite returns with its previous metadata.

### Decisions

- 2026-06-08T00:49:56Z — Completed alignment with the user and proceeding with the above feature contract.

### Look Back

- Phase 1 added HtDP data definitions and stubs for `FavoriteUrl`, stored favorites, hidden search mode state, favorites command parsing, storage adapters, background command/context-menu seams, and popup favorites state.
- Phase 2 implemented local `chrome.storage.local` favorites, `:f` through `:favorite` entry, hidden favorites search/results, Tab exit to the previous public mode, unbound active-tab save command, URL-bearing context menus, selected-row `x remove`, and one-level popup-session `u undo` with visible feedback.
- Phase 3 abstracted shared search-mode badge/header construction and cached mode loading transitions after all feature tests passed.
- Verification passed with `npm test` (384 tests), `npm run check`, and HtDP `final_preverify`.
- Cleanup removed unintended `.codegraph` artifacts from the final commit while keeping the repo-root `htdp.json` verifier config created for this HtDP workflow.
