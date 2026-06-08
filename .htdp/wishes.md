## Wish List

### Layer 1 (implement first)
- `incognitoContextFromExtension({ chromeApi = chrome } = {}): IncognitoContext` in `src/platform/incognito-context.js`
  Purpose: Build the popup/extension IncognitoContext from `chrome.extension.inIncognitoContext`, defaulting absent Chrome signals to non-incognito.
  Functional Examples: function design comment/docstring added near stub; input coverage includes extension flag false, extension flag true, and missing extension signal.
  Template: design comment/skeleton added near stub
  Depends on: none
- `incognitoContextFromTab(tab, { extensionInIncognitoContext = false } = {}): IncognitoContext` in `src/platform/incognito-context.js`
  Purpose: Build an IncognitoContext from a Chrome tab-like object and optional extension-context flag.
  Functional Examples: function design comment/docstring added near stub; input coverage includes tab.incognito false, tab.incognito true, present extension flag, and null tab.
  Template: design comment/skeleton added near stub
  Depends on: none
- `allowsBrowsingDataPersistence(context): boolean` in `src/platform/incognito-context.js`
  Purpose: Return true only when both Chrome incognito signals are false so Scry may persist browsing-derived favorites or selection learning.
  Functional Examples: function design comment/docstring added near stub; input coverage includes all four boolean combinations of extensionInIncognitoContext and tabIncognito.
  Template: design comment/skeleton added near stub
  Depends on: none

### Layer 0 (implement last)
- `favoriteTargetFromActiveTab(tab): import('./src/core/favorites.js').FavoriteSaveTarget | null` in `background.js`
  Purpose: Produce a favorite save target for a normal active tab, but reject incognito tabs before favorite URL normalization or storage.
  Functional Examples: function design comment/docstring updated near function; input coverage includes normal tab with title, normal tab without title, missing URL, and incognito tab.
  Template: design comment/template updated near function
  Depends on: incognitoContextFromTab, allowsBrowsingDataPersistence
- `favoriteTargetFromContextMenu(info, tab): import('./src/core/favorites.js').FavoriteSaveTarget | null` in `background.js`
  Purpose: Produce a context-menu favorite save target for normal tabs, but reject incognito tab-origin context-menu clicks before favorite URL normalization or storage.
  Functional Examples: function design comment/docstring updated near function; input coverage includes page/link/image/frame contexts, unknown menu item, and incognito tab.
  Template: design comment/template updated near function
  Depends on: incognitoContextFromTab, allowsBrowsingDataPersistence
- `ScryPanelApp.openSelected({ newTab }): Promise<void>` in `src/panel/app.js`
  Purpose: Open the selected row as before, while recording and saving selection learning only when the popup extension context is non-incognito.
  Functional Examples: function design comment/docstring added near function; input coverage includes normal real row, incognito real row, synthetic typed URL row, and no selected row URL.
  Template: design comment/template added near function
  Depends on: incognitoContextFromExtension, allowsBrowsingDataPersistence

## Data Definitions Created/Modified
- `src/platform/incognito-context.js`: added DataDefinition `IncognitoContext` for Chrome incognito signals (`extensionInIncognitoContext`, `tabIncognito`) with normal, extension-incognito, tab-incognito, and combined examples.
- `src/platform/incognito-context.js`: added FunctionDesign stubs for deriving incognito context from extension and tab signals and deciding whether browsing-derived persistence is allowed.
- `background.js`: updated FunctionDesign comments/templates for active-tab and context-menu favorite target creation, plus handler examples, to cover incognito no-op behavior.
- `src/panel/app.js`: added FunctionDesign comment/template for `ScryPanelApp.openSelected` covering incognito selection-learning no-op behavior.

## Assertion Changes Flagged
None

## Assumptions / Interpretations
- Missing Chrome incognito signals are interpreted as `false` so existing normal-window behavior and current test fakes remain valid.
- “Use it at storage-write boundaries only” is interpreted as guarding browsing-derived persistence writes: favorite saves from tab/context-menu origins and popup selection-learning writes. History reads/indexing and stored-favorite remove/undo flows remain unchanged.
- Popup selection-learning uses `chrome.extension.inIncognitoContext`; background favorite saves use `tab.incognito` as the source-of-URL signal.
- Incognito favorite save no-op means no storage write and no success badge feedback, because no `FavoriteUrl` is saved.

## Notes
- Verification run: `npm run check` passed; `npm test` passed.
- New helper stubs are intentionally not wired into production paths yet; Layer 0 wishes perform that integration.
- Pre-existing HtDP state changes (`.htdp/iteration.md`, `.htdp/status.md`) were present before these edits; only `.htdp/wishes.md` was written for this task.
