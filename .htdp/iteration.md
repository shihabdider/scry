# Iteration

anchor: 0e9005df3f91c397e0c42cdebef23363dd5a8235
started: 2026-06-08T02:57:42Z
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

Correct Scry's incognito behavior: public search modes must not persist incognito/public-mode usage history from an incognito popup, but explicit favorites saves must still work for incognito URLs.

Functional checkpoint: With Scry enabled in incognito, the popup continues to search/open in public modes without writing selection-learning data from the incognito popup. Pressing `Alt+Shift+F` on an incognito tab or using a Scry favorite context-menu item in incognito still saves that URL to local favorites, because favorites are explicit user saves. Normal-window behavior remains unchanged.

## Data Definition Plan

Reuse the `IncognitoContext` data definition for Chrome's extension-context signal. Narrow the persistence policy so it applies only to implicit public-mode selection-learning writes, not to explicit favorite saves. Remove the tab-incognito rejection from background favorite target creation and update tests to treat incognito favorite saves as allowed. In `ScryPanelApp.openSelected`, allow selection learning in non-public/hidden favorites mode, but skip it in public modes when `chrome.extension.inIncognitoContext` is true.

## Ledger

### Knowns

- Chrome public history APIs do not store incognito visits as browser history.
- Scry public modes (`recent`, `closed`, `deep`) should not add their own persistent selection-learning record from an incognito popup.
- Favorites are explicit user-saved URLs and should be allowed from incognito tabs.
- Prior implementation overcorrected by rejecting incognito favorite saves.

### Constraints

- Keep Scry local-only: no external network calls, host permissions, content scripts, or options pages.
- Preserve normal-window behavior.
- Preserve incognito popup search/open behavior.
- Run `npm test` and `npm run check` after implementation.

### Unknowns That Matter

- [resolved] User wants incognito favorites saves allowed while public-mode implicit history/learning writes are suppressed.

### Out of Scope

- Purging existing stored data.
- Changing Chrome's own incognito history/session behavior.
- Adding separate favorite visibility or storage partitioning.

### Assumptions

- Favorites mode is hidden/non-public and represents explicit saved URLs, so its own usage may continue to use normal ranking behavior.
- `chrome.extension.inIncognitoContext` remains the appropriate popup-context signal for suppressing public-mode selection learning.

### Decisions

- 2026-06-08T02:57:42Z — Correct previous interpretation: only public-mode implicit history/learning should be suppressed; explicit incognito favorite saves should work.

### Look Back

- Phase 1 narrowed the incognito persistence policy to implicit selection-learning by search mode, and corrected favorite target design comments to allow incognito URL-bearing tabs/context menus.
- Phase 2 implemented `allowsImplicitSelectionLearningPersistence`, removed the background incognito favorite-save rejection, and updated `ScryPanelApp.openSelected` so incognito public modes skip selection learning while incognito favorites mode can still learn from explicit favorites usage.
- Cleanup removed the stale broad `allowsBrowsingDataPersistence` helper to avoid conflicting with explicit incognito favorite saves.
- Phase 3 abstracted shared background favorite target creation and save-with-feedback tails.
- Verification passed with `npm test` (408 tests), `npm run check`, and HtDP `final_preverify`.
