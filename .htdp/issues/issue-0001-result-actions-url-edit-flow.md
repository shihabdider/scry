---
id: issue-0001
status: draft
type: feature
mode: AFK
source_prd: null
depends_on: []
remote:
  github: null
---

# Add result actions and editable typed-URL flow

## What to build

Add a Vim-flavored result-action flow to Scry's popup. From the search box, `Esc` should enter result-navigation mode without ever closing Scry. In result mode, `j/k` and `h/l` keep their navigation behavior, `i` returns focus to the search box with the cursor at the end, `y` yanks the selected URL, and `c` changes the selected real result into editable search text.

The `c` action should put the selected result's display URL into the search box, without protocol or fragment, focus the search box, place the cursor at the end, and immediately update live results. When the search box contains a conservative URL-like value, show a mildly distinct pinned `Open typed URL` action row above paginated corpus results. That row is auto-selected, excluded from page counts, opens the normalized typed URL with the same current-tab/new-tab behavior as normal results, and does not record selection-learning data.

The `y` action should copy the full normalized navigable URL with protocol. It should work for both real results and the synthetic `Open typed URL` row. Feedback should appear inline on the selected card as a small top-left `copied` marker for about 1.2 seconds, without closing Scry or changing focus. On the synthetic row, `c` is a no-op.

## Acceptance examples

- [ ] Given focus is in the search box, when the user presses `Esc`, then focus moves to the highlighted result and Scry remains open.
- [ ] Given focus is already in result-navigation mode, when the user presses `Esc`, then Scry does not close or blur and the selected result remains actionable.
- [ ] Given focus is in result-navigation mode, when the user presses `i`, then focus returns to the search box with the existing query preserved and the cursor at the end.
- [ ] Given a real result is selected in result-navigation mode, when the user presses `y`, then Scry copies the result's full normalized URL with protocol and shows `copied` on that result card for about 1.2 seconds.
- [ ] Given a real result is selected in result-navigation mode, when the user presses `c`, then the search box is focused, contains the selected result's display URL without protocol, and live results update immediately.
- [ ] Given the search text is URL-like, such as `github.com/mskilab-org/repo/pulls`, `https://github.com/mskilab-org/repo/pulls`, `localhost:3000/foo`, or `127.0.0.1:5173/test`, then a pinned selected `Open typed URL` action row appears above corpus results.
- [ ] Given the search text is not URL-like, such as `github scry issues`, `github/mskilab-org/repo`, `repo/issues`, or arbitrary text with spaces, then no `Open typed URL` action row appears.
- [ ] Given the `Open typed URL` row is selected, when the user presses `Enter`, then Scry opens the normalized typed URL in the current active tab; when the user presses `Cmd/Ctrl+Enter`, then Scry opens it in a new tab.
- [ ] Given the typed URL is schemeless, when it is opened, then Scry opens it as `https://...`.
- [ ] Given the `Open typed URL` row is selected, when the user presses `y`, then Scry copies the normalized typed URL and shows the same inline `copied` feedback.
- [ ] Given the `Open typed URL` row is selected, when the user presses `c`, then nothing meaningful changes.
- [ ] Given paginated corpus results and a URL-like query, then the `Open typed URL` row is always visible above the page and does not change the page count.

## Data definition impact

Expected new or changed data definitions:

- A distinct visible row/result variant for synthetic input actions, at minimum `Open typed URL`, separate from real corpus URL results.
- A normalized typed-URL representation that can distinguish the display input from the full URL opened/copied.
- Focus-mode semantics change: `search`/insert mode, `results` navigation mode, and no Esc-driven close path.
- Transient yank-feedback state keyed to the selected row/result/action.

## HtDP entry note

Implement the result-action/input-flow vertical slice without changing search corpora or quoted matching. Preserve the no-build MV3 extension shape and existing local-only behavior. `y` and `c` are active only in result-navigation mode. `c` inserts display URL text; `y` copies a full navigable URL. The typed URL action is an input affordance, not a history result, and should not affect selection learning.

Conservative URL-like detection should accept valid scheme URLs and schemeless host-like URLs where the first segment looks like a real domain, `localhost`, or an IP address with optional port/path/query. Avoid slash-only shorthand such as `github/repo`.

## Verification

Run:

```bash
npm test
npm run check
```

Expected test coverage:

- Panel keyboard flow for `Esc`, result-mode `Esc`, and `i`.
- `y`/`c` behavior for real results and synthetic typed URL row.
- URL-like detection and schemeless `https://` normalization.
- Synthetic row selection, opening, non-learning, visual/action metadata, and pagination exclusion.
- Clipboard behavior can be tested through an injected/fake clipboard boundary if direct browser clipboard APIs are not available in Node tests.

Manual check after implementation: load the unpacked extension, use `Command+K`, try `Esc -> j/k -> y`, `Esc -> c -> edit suffix -> Enter`, and verify Scry does not close on double Esc.

## Blocked by

- None - can start immediately.

## HtDP iterations

- None yet.

## Out of scope

- Search-mode switching between recent/deep/closed.
- Recently closed tab/session support.
- Quoted exact matching.
- General command palette actions beyond URL open/yank/change.
