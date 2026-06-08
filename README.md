# Scry

Scry is a personal Manifest V3 Chrome extension for history-first URL recall with a small local favorites list. It opens a focused popup command palette with `Command+K`, indexes recent browser history, and lets you reopen exact pages from remembered URL fragments such as:

```text
git skilift issues 13
```

To narrow by site, put a colon after the site query: `git:` filters results to matching website names/roots such as github.com, gitter.com, or gitopia.com. `git: issues 13` composes the website filter with ordinary URL-fragment query terms, first limiting results to matching websites and then searching/ranking the remaining URLs for `issues 13`. `file:` filters local `file:///...` history URLs, and `file: precalculus` composes the local file filter with ordinary URL-fragment query terms.

Favorites are a hidden search mode rather than part of the normal `Tab` mode cycle. Type `:f`, `:fa`, … `:favorite` and press `Enter` to search locally saved favorites; press `Tab` from favorites to return to the previous public mode. Save favorites with the **Save the current tab to Scry favorites** extension command (`Alt+Shift+F`) or the **Save … to Scry favorites** right-click menu for page, link, image, video, audio, and frame URLs. A successful background save briefly shows a green `✓` badge on the Scry extension icon. In favorites list-selection mode, `x` removes the selected favorite and `u` restores the most recent removal for the current popup session.

The v1 product is intentionally narrow:

- browser history and local Scry favorites only;
- no Chrome bookmarks, content scripts, host permissions, options page, or web search fallback;
- URL-first ranking and display;
- local-only selection learning and favorites storage;
- old-school Google-inspired UI.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click **Load unpacked**.
4. Select this repository directory.
5. Open Scry with `Command+K`; close the popup with `Esc` or by focusing the page.
6. Save the current tab to favorites with `Alt+Shift+F`.

If Chrome reports a shortcut conflict, remap Scry at `chrome://extensions/shortcuts`.

## Development

No build step is required; the extension loads the source ES modules directly.

```bash
npm test
npm run check
```

## Privacy

Scry does not declare host permissions, does not inject content scripts, and does not perform external network requests. It reads Chrome history for local search and stores only Scry-specific selection-learning aggregates and favorites in `chrome.storage.local`.
