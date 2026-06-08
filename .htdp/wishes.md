## Wish List

### Layer 4 (implement first)
- `parseFavoritesCommand(input: string): FavoritesCommandParse` in `src/core/favorites-command.js`
  Purpose: Parse a submitted input as the hidden favorites entry command when it is exactly `:f` through `:favorite`.
  Functional Examples: function design comment/docstring added near stub; input coverage includes shortest/full command, whitespace, non-command text, and invalid plural command.
  Template: design comment/skeleton added near stub
  Depends on: none
- `favoriteFromSaveTarget(target: FavoriteSaveTarget, options?: { now?: number }): FavoriteUrl | null` in `src/core/favorites.js`
  Purpose: Normalize a URL-bearing Chrome tab/context target into a stored favorite, or reject ineligible targets.
  Functional Examples: function design comment/docstring added near stub; input coverage includes tab target, image target with title fallback, and missing URL.
  Template: design comment/skeleton added near stub
  Depends on: none
- `upsertFavoriteUrl(favorites: StoredFavorites, favorite: FavoriteUrl): StoredFavorites` in `src/core/favorites.js`
  Purpose: Add or refresh one favorite while preserving unique keys and moving the saved URL to the top.
  Functional Examples: function design comment/docstring added near stub; input coverage includes empty, distinct existing favorite, and duplicate existing favorite.
  Template: design comment/skeleton added near stub
  Depends on: none
- `removeFavoriteByKey(favorites: StoredFavorites, key: string): FavoriteRemovalResult` in `src/core/favorites.js`
  Purpose: Remove a favorite by normalized key and return a one-level undo payload when removal succeeds.
  Functional Examples: function design comment/docstring added near stub; input coverage includes empty list, singleton removal, middle removal, and missing key.
  Template: design comment/skeleton added near stub
  Depends on: none
- `restoreRemovedFavorite(favorites: StoredFavorites, undo: FavoriteRemovalUndo): FavoriteUndoResult` in `src/core/favorites.js`
  Purpose: Consume one popup-session removal undo and restore the removed favorite into the stored list.
  Functional Examples: function design comment/docstring added near stub; input coverage includes absent undo, present undo at index 0, and out-of-range restore index.
  Template: design comment/skeleton added near stub
  Depends on: none
- `favoritesToHistoryEntries(favorites: StoredFavorites): object[]` in `src/core/favorites.js`
  Purpose: Convert stored favorites into history-like entries so Scry can reuse its existing URL recall index/search.
  Functional Examples: function design comment/docstring added near stub; input coverage includes empty, singleton, and multiple favorites.
  Template: design comment/skeleton added near stub
  Depends on: none
- `isHiddenSearchMode(mode: unknown): boolean` in `src/core/search-modes.js`
  Purpose: Determine whether a value names a hidden Scry search mode.
  Functional Examples: function design comment/docstring added near stub; input coverage includes favorites, public recent, and invalid mode.
  Template: design comment/skeleton added near stub
  Depends on: none
- `hiddenSearchModeExitTarget(previousMode: SearchMode | null | undefined): PublicSearchMode` in `src/core/search-modes.js`
  Purpose: Compute the public mode to restore when Tab exits hidden favorites mode.
  Functional Examples: function design comment/docstring added near stub; input coverage includes recent, closed, favorites, and null.
  Template: design comment/skeleton added near stub
  Depends on: none
- `favoritesModeIndicatorModel(state: SearchModeState | null): ModeIndicatorModel` in `src/core/search-modes.js`
  Purpose: Build the hidden favorites badge/status model with local favorite counts and Tab-return hint.
  Functional Examples: function design comment/docstring added near stub; input coverage includes null/idle, loading, ready count, and error status.
  Template: design comment/skeleton added near stub
  Depends on: none
- `selectedFavoriteRowActionHints(row: VisibleRow, state?: FavoriteRowActionState): RowActionHint[]` in `src/core/rows.js`
  Purpose: Add `x remove` and one-level `u undo` hints for selected favorites without changing public-mode hints.
  Functional Examples: function design comment/docstring added near stub; input coverage includes unselected row, public mode, favorites without undo, and favorites with undo.
  Template: design comment/skeleton added near stub
  Depends on: none
- `favoriteResultNavigationCommandForKey(event: KeyboardEvent, state?: { inFavoritesMode?: boolean, canRemoveFavorite?: boolean, canUndoFavoriteRemoval?: boolean }): ResultNavigationCommand` in `src/panel/app.js`
  Purpose: Translate favorites list-selection keys `x` and `u` while preserving existing result-navigation commands.
  Functional Examples: function design comment/docstring added near stub; input coverage includes x remove, u undo present/absent, y copy fallback, and public-mode x ignored.
  Template: design comment/skeleton added near stub
  Depends on: none
- `loadStoredFavorites(options?: { chromeApi?: object }): Promise<StoredFavorites>` in `src/platform/favorites-store.js`
  Purpose: Load the local favorites array from `chrome.storage.local`, defaulting missing/malformed storage to an empty list.
  Functional Examples: function design comment/docstring added near stub; input coverage includes missing storage key, present favorites array, and malformed value.
  Template: design comment/skeleton added near stub
  Depends on: none
- `saveStoredFavorites(favorites: StoredFavorites, options?: { chromeApi?: object }): Promise<void>` in `src/platform/favorites-store.js`
  Purpose: Persist the complete local favorites list under Scry's favorites storage key.
  Functional Examples: function design comment/docstring added near stub; input coverage includes empty list and singleton list writes.
  Template: design comment/skeleton added near stub
  Depends on: none
- `favoriteTargetFromActiveTab(tab: object): FavoriteSaveTarget | null` in `background.js`
  Purpose: Convert the active tab from the unbound command into a favorites save target.
  Functional Examples: function design comment/docstring added near stub; input coverage includes tab with title, tab without title, and missing URL.
  Template: design comment/skeleton added near stub
  Depends on: none
- `favoriteTargetFromContextMenu(info: ChromeContextMenuFavoriteInfo, tab: object): FavoriteSaveTarget | null` in `background.js`
  Purpose: Convert a Chrome context-menu click into the corresponding URL-bearing favorite save target.
  Functional Examples: function design comment/docstring added near stub; input coverage includes page, link, image, frame, and unknown menu item cases.
  Template: design comment/skeleton added near stub
  Depends on: none
- `registerFavoriteContextMenus(options?: { chromeApi?: object }): void` in `background.js`
  Purpose: Register Scry favorites context-menu items for page/link/image/video/audio/frame URL targets.
  Functional Examples: function design comment/docstring added near stub; input coverage includes all six URL-bearing context variants.
  Template: design comment/skeleton added near stub
  Depends on: none

### Layer 3
- `favoritesSearchHeaderModel(state: SearchModeState | null): HeaderSearchContextModel` in `src/core/search-modes.js`
  Purpose: Build the hidden favorites search header from the favorites badge/status model.
  Functional Examples: function design comment/docstring added near stub; input coverage includes null/idle and ready singleton favorites state.
  Template: design comment/skeleton added near stub
  Depends on: favoritesModeIndicatorModel
- `buildFavoritesIndex(favorites: StoredFavorites, options?: { now?: number }): HistoryIndex` in `src/core/favorites.js`
  Purpose: Build a searchable favorites index by feeding history-like favorite entries into the existing history index builder.
  Functional Examples: function design comment/docstring added near stub; input coverage includes empty, singleton, and multiple favorites.
  Template: design comment/skeleton added near stub
  Depends on: favoritesToHistoryEntries
- `saveFavoriteTarget(target: FavoriteSaveTarget, options?: { chromeApi?: object, now?: number }): Promise<FavoriteUrl | null>` in `src/platform/favorites-store.js`
  Purpose: Save a target into local favorites storage, refreshing duplicates and preserving local recency order.
  Functional Examples: function design comment/docstring added near stub; input coverage includes first save, duplicate refresh, and invalid target.
  Template: design comment/skeleton added near stub
  Depends on: loadStoredFavorites, favoriteFromSaveTarget, upsertFavoriteUrl, saveStoredFavorites
- `removeStoredFavoriteByKey(key: string, options?: { chromeApi?: object }): Promise<FavoriteRemovalResult>` in `src/platform/favorites-store.js`
  Purpose: Remove a selected favorite from local storage and return popup-session undo data.
  Functional Examples: function design comment/docstring added near stub; input coverage includes successful singleton removal, missing key, and missing storage.
  Template: design comment/skeleton added near stub
  Depends on: loadStoredFavorites, removeFavoriteByKey, saveStoredFavorites
- `restoreStoredFavoriteRemoval(undo: FavoriteRemovalUndo, options?: { chromeApi?: object }): Promise<FavoriteUndoResult>` in `src/platform/favorites-store.js`
  Purpose: Restore the latest popup-session favorite removal to local storage and consume undo.
  Functional Examples: function design comment/docstring added near stub; input coverage includes absent undo and present undo restore.
  Template: design comment/skeleton added near stub
  Depends on: loadStoredFavorites, restoreRemovedFavorite, saveStoredFavorites

### Layer 2
- `handleFavoriteCommand(command: string, options?: { chromeApi?: object, now?: number }): Promise<FavoriteUrl | null>` in `background.js`
  Purpose: Handle the unbound active-tab save command by querying the active tab and saving it as a favorite.
  Functional Examples: function design comment/docstring added near stub; input coverage includes matching command, unknown command, and active tab without URL.
  Template: design comment/skeleton added near stub
  Depends on: favoriteTargetFromActiveTab, saveFavoriteTarget
- `handleFavoriteContextMenuClick(info: ChromeContextMenuFavoriteInfo, tab: object, options?: { chromeApi?: object, now?: number }): Promise<FavoriteUrl | null>` in `background.js`
  Purpose: Handle a Scry favorites context-menu click by saving the clicked URL target locally.
  Functional Examples: function design comment/docstring added near stub; input coverage includes page target, link target, and unknown info no-op.
  Template: design comment/skeleton added near stub
  Depends on: favoriteTargetFromContextMenu, saveFavoriteTarget
- `ensureFavoritesModeReady(): Promise<SearchModeState>` in `src/panel/app.js`
  Purpose: Load local stored favorites, build a favorites search index, and store it in the hidden mode cache.
  Functional Examples: function design comment/docstring added near stub; input coverage includes empty favorites, singleton favorite, and storage failure.
  Template: design comment/skeleton added near stub
  Depends on: loadStoredFavorites, buildFavoritesIndex, favoritesSearchHeaderModel
- `exitFavoritesModeToPreviousPublicMode(): Promise<SearchModeState>` in `src/panel/app.js`
  Purpose: Leave hidden favorites mode and activate the remembered public mode, defaulting safely to recent.
  Functional Examples: function design comment/docstring added near stub; input coverage includes previous recent, previous closed, and invalid previous mode.
  Template: design comment/skeleton added near stub
  Depends on: hiddenSearchModeExitTarget
- `removeSelectedFavorite(): Promise<void>` in `src/panel/app.js`
  Purpose: Remove the selected favorite row from local storage, remember one undo, and refresh favorites results.
  Functional Examples: function design comment/docstring added near stub; input coverage includes selected favorite, no selected result, and outside favorites mode.
  Template: design comment/skeleton added near stub
  Depends on: removeStoredFavoriteByKey
- `undoLastFavoriteRemoval(): Promise<void>` in `src/panel/app.js`
  Purpose: Restore the latest popup-session removed favorite, consume undo, and refresh favorites results.
  Functional Examples: function design comment/docstring added near stub; input coverage includes present undo, absent undo, and outside favorites mode.
  Template: design comment/skeleton added near stub
  Depends on: restoreStoredFavoriteRemoval

### Layer 1
- `enterFavoritesMode(): Promise<SearchModeState>` in `src/panel/app.js`
  Purpose: Enter hidden favorites from the current public mode, clear the command input, load favorites, and show all favorites.
  Functional Examples: function design comment/docstring added near stub; input coverage includes entering from recent with `:f`, entering from closed with `:favorite`, and empty stored favorites.
  Template: design comment/skeleton added near stub
  Depends on: ensureFavoritesModeReady
- `handleSearchInputTab(options?: { shiftKey?: boolean }): Promise<void>` in `src/panel/app.js`
  Purpose: Make Tab exit favorites to the previous public mode while preserving public recent -> closed -> deep cycling outside favorites.
  Functional Examples: function design comment/docstring added near stub; input coverage includes favorites exit with/without Shift and public forward/backward cycling.
  Template: design comment/skeleton added near stub
  Depends on: isHiddenSearchMode, exitFavoritesModeToPreviousPublicMode
- `installFavoriteBackgroundHandlers(options?: { chromeApi?: object }): void` in `background.js`
  Purpose: Install background listeners for context-menu registration, context-menu saves, and active-tab save commands.
  Functional Examples: function design comment/docstring added near stub; input coverage includes runtime install, command listener, and context-menu click listener.
  Template: design comment/skeleton added near stub
  Depends on: registerFavoriteContextMenus, handleFavoriteCommand, handleFavoriteContextMenuClick

### Layer 0 (implement last)
- `handleSearchInputEnter(): Promise<void>` in `src/panel/app.js`
  Purpose: Route submitted `:f` through `:favorite` commands into hidden favorites mode and otherwise preserve existing selected-row open behavior.
  Functional Examples: function design comment/docstring added near stub; input coverage includes shortest command, full command, and ordinary query/open behavior.
  Template: design comment/skeleton added near stub
  Depends on: parseFavoritesCommand, enterFavoritesMode

## Data Definitions Created/Modified
- `src/core/favorites.js`: added `FavoriteSource`, `FavoriteSaveTarget`, `FavoriteUrl`, `StoredFavorites`, `FavoriteRemovalUndo`, `FavoriteRemovalResult`, and `FavoriteUndoResult` with HtDP-style interpretations and data examples.
- `src/core/favorites-command.js`: added `FavoritesCommandParse` for `:f` through `:favorite` command parsing.
- `src/core/search-modes.js`: added `PublicSearchMode`, `HiddenSearchMode`, expanded `SearchMode`, HtDP-style mode/cache/header comments, and hidden favorites constants while preserving `SEARCH_MODES = ['recent', 'closed', 'deep']`.
- `src/core/rows.js`: extended `RowActionHint` for favorites remove/undo actions and added `FavoriteRowActionState`.
- `src/platform/favorites-store.js`: added `FavoritesStorageSlot` and `FavoriteStorageWrite` for `chrome.storage.local` favorites persistence.
- `background.js`: added `FavoriteContextMenuContext`, `FavoriteCommandName`, and `ChromeContextMenuFavoriteInfo` for background command/context-menu seams.
- `src/panel/app.js`: extended `ResultNavigationCommand`, added `FavoritesPanelState`, and added popup-session fields `previousPublicSearchMode` and `favoriteRemovalUndo`.
- `manifest.json`: added a module background service worker and unbound `save-current-tab-as-favorite` Chrome command.

## Assertion Changes Flagged
None

## Assumptions / Interpretations
- I represented stored favorites as an array under `chrome.storage.local` key `scryFavorites` rather than a versioned wrapper object to keep the data shape minimal.
- I interpreted duplicate saves as preserving the original `addedAt`, refreshing URL/title/display metadata and `updatedAt`, and moving the favorite to index 0.
- I interpreted favorites search recency as `FavoriteUrl.updatedAt` mapped to history-like `lastVisitTime` with `visitCount: 1` when reusing Scry's history index/search.
- I interpreted `:f` through `:favorite` as whole trimmed input commands; inputs like `:favorites` or `:favorite docs` remain ordinary search text because entering favorites clears the command input.
- I used `normalizeHistoryUrl` as the favorite URL eligibility/normalization seam because favorites are converted into history-like entries. Alternative: use the stricter typed-URL acceptance rules.
- I left `manifest.permissions` unchanged during stubbing to keep existing assertion contracts green; implementing context-menu saves will likely require adding the Chrome `contextMenus` permission and updating the manifest contract assertion under human/test review.

## Notes
- Verification run: `npm run check` passed.
- Verification run: `npm test` passed (279 tests).
- New stubs intentionally throw if called; they are not wired into current public behavior yet.
