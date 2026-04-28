# Iteration

anchor: d3e520a23ff1decf30019f6dd64181475f184464
started: 2026-04-28T14:22:28Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript
transparent: true

## Source Artifacts

- PRD: none
- Issue: none
- Architecture review: none

## Problem

Change Scry's default Enter open behavior so pressing Enter on a selected row opens the URL in a new active tab instead of navigating the current active tab.

## Data Definition Plan

No new data definitions are required. The existing open behavior is controlled by the `newTab` boolean passed from Enter key handlers through `ScryPanelApp.openSelected` to `openUrl`, where `newTab: true` already creates an active tab. Update the Enter-key call sites and acceptance tests so unmodified Enter passes/uses the active-new-tab path.

## Polya Ledger

### Knowns

- `openUrl(url, { newTab: true })` already calls `chrome.tabs.create({ url, active: true })`.
- `openUrl(url, { newTab: false })` updates the current active tab when one exists.
- `ScryPanelApp` passes `event.metaKey || event.ctrlKey` for Enter in both search-input and result-navigation handlers, so unmodified Enter currently uses the current-tab path.
- Tests currently assert current-tab updates for Enter-driven opens.

### Constraints

- Keep Scry a local-only Chrome MV3 action popup.
- Do not add external network calls, host permissions, content scripts, or options pages.
- Preserve selection learning and popup-close behavior after opening.
- Run `npm test` and `npm run check` after implementation changes.

### Unknowns That Matter

- none

### Out of Scope

- Changing search modes, result ranking, selection learning semantics, or popup lifecycle.
- Changing mouse-click open behavior unless required by existing code structure.
- Adding a new user setting for open destination.

### Assumptions

- "Default Enter open action" means unmodified keyboard Enter in both search-input focus and result-navigation focus should open a new active tab.
- Existing modifier behavior can remain new-tab/open-active behavior because it already routes to `newTab: true`.
- Mouse click behavior is not part of this request.

### Alternatives Considered

- Change `openUrl` default to `newTab: true` — broader blast radius because any caller omitting or explicitly passing false semantics may change.
- Change `openSelected` default to `newTab: true` — moderate blast radius and still requires call-site audit.
- Change only Enter key handlers to request `newTab: true` — chosen as the smallest change matching the request.

### Decision Log

- 2026-04-28T14:22:28Z — started fresh HtDP iteration for the Enter open-destination change.

### Look Back

- Leave empty for now.
