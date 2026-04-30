---
id: issue-0025
status: draft
type: feature
mode: AFK
source_prd: null
depends_on: []
remote:
  github: null
---

# Integrate key hints into the command-palette UI

## What to build

Remove the footer key-hint line and move only the useful hints into the UI elements they describe. Replace the current standalone `Search browser history` label with a compact mode/result row that reads like `Search [recent] history`, where the mode badge is the existing clickable mode control. Put the current result count right-aligned on that same row, and place the `Tab`/`Shift+Tab` mode-switch hint on or next to the mode badge.

Keep the UI sparse and old-Google-like: no new card chrome, no host permissions, no options page, and no external UI dependencies.

## Acceptance examples

- [ ] Given the popup is rendered, then the old footer hint line is absent and no visible footer text mentions `⌘K`, `Esc`, `j/k`, `h/l`, or `Enter`.
- [ ] Given Scry is in recent mode, then the label row reads as `Search [recent] history` with `[recent]` rendered as the clickable mode badge.
- [ ] Given Scry is in closed mode, then the label row reads as `Search [closed] history` with the same badge treatment.
- [ ] Given Scry is in deep mode, then the label row reads as `Search [deep] history` with the same badge treatment.
- [ ] Given the mode badge is visible, then the `Tab`/`Shift+Tab` mode-switch hint is visible on or immediately adjacent to that badge rather than in the footer.
- [ ] Given results are rendered, then the current real URL result count is shown right-aligned on the mode/result row; synthetic rows such as `Open typed URL` do not inflate the count.
- [ ] Given the search input is empty, then its placeholder includes the `i` hint for returning to search from result/navigation mode and uses a space-separated URL-fragment example.
- [ ] Given a real result row is selected, then its bottom/meta row includes selected-row hints for `y copy` and `c edit URL`.
- [ ] Given a selected row does not support editing back into the search input, then the selected-row hints omit `c edit URL` while still showing available actions such as `y copy`.
- [ ] Given a result row is not selected, then it does not show the selected-row `y`/`c` hints.
- [ ] Given pagination is visible, then `h`/`l` hints remain integrated into the previous/next page buttons rather than returning to a global footer.

## Data definition impact

Expected UI model changes only:

- A header/search context model that combines active mode label, mode-switch hint, and current result count.
- A selected-row action-hint model derived from row capabilities, e.g. copyable URL and editable corpus URL.
- Possible adjustment to the mode indicator label from `mode: recent` to bracket labels like `[recent]`.

No new persistent data is expected.

## HtDP entry note

Use the current popup DOM in `popup.html`, `src/panel/app.js`, and `src/panel/styles.css` as the entry point. This is a UI integration slice, not a keyboard-behavior slice: only move or remove hint text unless a small model function is needed to compute visible counts or selected-row capabilities.

Treat the result count as the number of real URL results currently in the active result set, excluding synthetic action rows. Preserve accessible labeling for the search input even if the visible label is restructured.

## Verification

Run:

```bash
npm test
npm run check
```

Expected test coverage:

- Popup HTML or panel render tests assert the footer hint text is gone.
- Mode/result row text and badge labels for recent, closed, and deep modes.
- Right-aligned result count source excludes `Open typed URL` rows.
- Placeholder contains the `i` hint and a space-separated example.
- Selected real result row shows `y copy` and `c edit URL`; unselected rows do not.
- Selected non-editable row omits unsupported `c edit URL`.
- CSS tests preserve dense old-Google styling and avoid card-like chrome.

Manual check after implementation: open Scry and verify the mode row, count alignment, input placeholder, selected-row hints, and absence of the footer in the loaded popup.

## Blocked by

- None - can start immediately.

## HtDP iterations

- None yet.

## Out of scope

- Adding new keyboard shortcuts.
- Changing the behavior of `Esc`, `Tab`, `Shift+Tab`, `i`, `/`, `y`, `c`, `h`, `j`, `k`, `l`, or `Enter`.
- Changing search ranking or history/session loading.
- Adding animations, cards, side panels, options pages, or external assets.
