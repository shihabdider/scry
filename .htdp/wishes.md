## Wish List

### Layer 1 (implement first)
- `allowsImplicitSelectionLearningPersistence(context: IncognitoContext, mode: import('../core/search-modes.js').SearchMode): boolean` in `src/platform/incognito-context.js`
  Purpose: Decide whether an implicit selection-learning write may persist for the active mode: allow hidden favorites and non-incognito public modes, but reject public modes from incognito contexts.
  Functional Examples: function design comment/docstring added near stub; input coverage includes public `recent`, `closed`, and `deep` modes, hidden `favorites`, normal context, extension-incognito context, tab-incognito context, and combined incognito context.
  Template: design comment/skeleton added near stub
  Depends on: none
- `favoriteTargetFromActiveTab(tab: object): import('./src/core/favorites.js').FavoriteSaveTarget | null` in `background.js`
  Purpose: Produce a favorite save target for any URL-bearing active tab, including incognito tabs, and return null only when Chrome supplies no usable URL.
  Functional Examples: function design comment/docstring updated near function; input coverage includes normal tab with title, normal tab without title, missing URL, and incognito URL-bearing tab.
  Template: design comment/template updated near function
  Depends on: none
- `favoriteTargetFromContextMenu(info: ChromeContextMenuFavoriteInfo, tab: object): import('./src/core/favorites.js').FavoriteSaveTarget | null` in `background.js`
  Purpose: Produce a favorite save target for recognized URL-bearing context-menu items, including incognito tab-origin clicks, and return null for unknown menu items or missing URLs.
  Functional Examples: function design comment/docstring updated near function; input coverage includes page, link, image, video, audio, frame, unknown menu item, missing URL, and incognito page-origin click.
  Template: design comment/template updated near function
  Depends on: none

### Layer 0 (implement last)
- `ScryPanelApp.openSelected({ newTab }: { newTab: boolean }): Promise<void>` in `src/panel/app.js`
  Purpose: Open the selected row and record selection learning only for persistable real rows whose active mode/incognito context passes the narrowed implicit-learning policy.
  Functional Examples: function design comment/docstring updated near function; input coverage includes normal public real row, incognito public real row, incognito hidden favorites real row, synthetic typed URL row, and no selected URL.
  Template: design comment/template updated near function
  Depends on: allowsImplicitSelectionLearningPersistence
- `handleFavoriteCommand(command: string, options?: { chromeApi?: object, now?: number, windowApi?: object }): Promise<import('./src/core/favorites.js').FavoriteUrl | null>` in `background.js`
  Purpose: Handle the explicit save-current-tab command by saving any URL-bearing active tab, including incognito tabs, and showing favorite-save feedback.
  Functional Examples: function design comment/docstring updated near function; input coverage includes matching command, unknown command, missing active-tab URL, and incognito active-tab URL.
  Template: design comment/template updated near function
  Depends on: favoriteTargetFromActiveTab
- `handleFavoriteContextMenuClick(info: ChromeContextMenuFavoriteInfo, tab: object, options?: { chromeApi?: object, now?: number, windowApi?: object }): Promise<import('./src/core/favorites.js').FavoriteUrl | null>` in `background.js`
  Purpose: Handle explicit Scry favorite context-menu clicks by saving recognized URL-bearing targets, including incognito tab-origin URLs, and showing favorite-save feedback.
  Functional Examples: function design comment/docstring updated near function; input coverage includes page target, link target, unknown menu item, and incognito page target.
  Template: design comment/template updated near function
  Depends on: favoriteTargetFromContextMenu

## Data Definitions Created/Modified
- `src/platform/incognito-context.js`: updated DataDefinition `IncognitoContext` interpretation/examples to distinguish extension-context incognito suppression for implicit public-mode selection learning from tab-incognito provenance for explicit favorite saves.
- `src/platform/incognito-context.js`: added FunctionDesign and stub for `allowsImplicitSelectionLearningPersistence` to capture the narrowed mode-aware persistence policy.
- `background.js`: updated FunctionDesign comments/templates for favorite target creation and background handlers so incognito favorite saves are explicit allowed saves.
- `src/panel/app.js`: updated FunctionDesign comments/templates for `ScryPanelApp.openSelected` so public incognito popup learning is skipped while hidden favorites learning is allowed.

## Assertion Changes Flagged
None

## Assumptions / Interpretations
- I introduced `allowsImplicitSelectionLearningPersistence` rather than broadening `allowsBrowsingDataPersistence`, because the requirement narrows the policy to implicit selection-learning and explicit favorite saves should stop using the broad helper.
- I interpreted an incognito `tabIncognito` signal as suppressing implicit public-mode selection learning if such a context is ever supplied; `ScryPanelApp.openSelected` currently supplies only the extension-context signal, so this does not block explicit incognito favorite saves.
- I interpreted hidden `favorites` mode as explicit local-favorites usage, so selection learning from favorites mode may persist even when the popup is incognito.
- I interpreted allowed incognito favorite saves as using the same local favorites store as normal-window favorites, not a separate incognito-only store.

## Notes
- Verification after stub/comment changes: `npm run check` passed and `npm test` passed.
- Executable test assertions were not edited in this stubber pass; the implementer/test step should convert the new functional examples and update the current incognito-favorite no-op assertions.
