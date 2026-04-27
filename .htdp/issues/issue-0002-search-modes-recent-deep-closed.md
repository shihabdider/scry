---
id: issue-0002
status: draft
type: feature
mode: AFK
source_prd: null
depends_on:
  - issue-0001
remote:
  github: null
---

# Add recent, deep, and closed search modes

## What to build

Replace the current one-off deep-search button model with explicit mutually exclusive search modes: `recent`, `deep`, and `closed`.

Scry should start in `recent` mode using the existing recent-history corpus. While the search box is focused, `Tab` cycles modes forward (`recent -> deep -> closed -> recent`) and `Shift+Tab` cycles backward. Switching modes preserves the current query, resets selected result/page to the top, and lets the typed-URL action row remain auto-selected when the query is URL-like. A compact clickable mode indicator such as `mode: recent` should show the active mode and cycle modes on click.

Load each mode lazily on first entry and cache its index for the current popup session. `deep` should use all available history with the current deep-history limit. `closed` should use Chrome sessions data, flatten recently closed tabs/windows into URL results, and search those URLs exactly like other Scry corpus results. Closed mode is URL recall only; it should not restore Chrome tab/window session state.

Add Chrome's `sessions` permission for true recently closed URL support. Closed-mode entries should be included only when the top-level closed session timestamp is known and within the last 24 hours. Unknown-timestamp entries should be excluded so they cannot bypass the 24-hour gate. Real closed-mode result selections should record into the existing local selection-learning aggregates keyed by normalized URL.

## Acceptance examples

- [ ] Given the extension manifest, then permissions include `sessions` and still do not include host permissions or external network access.
- [ ] Given Scry has just opened, then it starts in `recent` mode and does not load `deep` or `closed` data until those modes are entered.
- [ ] Given focus is in the search box, when the user presses `Tab`, then Scry cycles `recent -> deep -> closed -> recent`, preserving the query and resetting selected result/page.
- [ ] Given focus is in the search box, when the user presses `Shift+Tab`, then Scry cycles `recent -> closed -> deep -> recent`, preserving the query and resetting selected result/page.
- [ ] Given a URL-like query is present during a mode switch, then the pinned `Open typed URL` row remains visible and selected in every mode.
- [ ] Given the user enters `deep` mode for the first time, then Scry loads the deep history corpus and caches it for later switches within the same popup session.
- [ ] Given the user enters `closed` mode for the first time, then Scry calls the Chrome sessions API, flattens standalone tabs and window tabs into normal URL results, and caches the resulting index for the popup session.
- [ ] Given a recently closed window contains multiple tabs, then closed mode shows one URL result per tab rather than a restorable window result.
- [ ] Given a closed session has `lastModified` within the last 24 hours, then its tab URLs may appear in closed-mode search results.
- [ ] Given a closed session has missing `lastModified` or a timestamp older than 24 hours, then its URLs do not appear in closed-mode search results.
- [ ] Given a closed-mode real result is opened, then it uses the same current-tab/new-tab behavior as history results and records selection learning in the same local aggregate store.
- [ ] Given the mode indicator is clicked, then Scry cycles to the next mode and updates the visible mode label/status.

## Data definition impact

Expected new or changed data definitions:

- A `SearchMode` variant/enum with `recent`, `deep`, and `closed`.
- A per-popup-session corpus/index cache keyed by search mode, with loading/error state per mode.
- A closed-session-to-URL-entry adapter that flattens `chrome.sessions.getRecentlyClosed` tab/window records into the same normalized URL-entry shape used by history search.
- A mode-aware status/indicator model that replaces the current deep-search button state.

## HtDP entry note

Implement the mode-model vertical slice after or alongside the result-action row model. Preserve Scry's URL-first local-only product boundary. `closed` mode should not add a session-restoration result type; it is only a corpus of recently closed URLs that can be opened/copied/changed like any other URL. Mode switching is available only from search-box focus via `Tab`/`Shift+Tab`, plus the clickable mode indicator.

Keep startup fast by loading recent history only at popup start. Lazy-load and cache `deep` and `closed` per popup session. If a mode load fails, keep the failure local to that mode and show a useful status/message without breaking other modes.

## Verification

Run:

```bash
npm test
npm run check
```

Expected test coverage:

- Manifest contract includes `sessions` and still excludes host permissions/network calls.
- Mode cycling order, reverse cycling, query preservation, and selection/page reset.
- Lazy loading and cache reuse for `deep` and `closed`.
- Closed-session flattening for standalone tabs and multi-tab windows.
- Strict 24-hour filtering by known top-level `lastModified`; unknown timestamps excluded.
- Mode indicator click behavior and labels/status text.
- Existing result open/selection-learning behavior still works for real results in all modes.

Manual check after implementation: load the unpacked extension, cycle modes with `Tab`/`Shift+Tab`, verify first deep/closed entry may load, subsequent switches are instant, and closed mode shows URLs you recently closed rather than restoring sessions.

## Blocked by

- issue-0001 for the final intended interaction with the pinned `Open typed URL` row across modes. The mode model can be developed independently if that integration is stubbed or deferred.

## HtDP iterations

- None yet.

## Out of scope

- Restoring closed tabs/windows as Chrome sessions.
- Combining corpora such as recent+closed or deep+closed.
- Loading all corpora at startup.
- Quoted exact matching.
