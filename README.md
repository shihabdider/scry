# Scry

Scry is a personal Manifest V3 Chrome extension for history-first URL recall. It opens a focused popup command palette with `Command+K`, indexes recent browser history, and lets you reopen exact pages from remembered URL fragments such as:

```text
git*skilift*issues*13
```

The v1 product is intentionally narrow:

- browser history only;
- no bookmarks, tabs, commands, or web search fallback;
- URL-first ranking and display;
- local-only selection learning;
- old-school Google-inspired UI.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click **Load unpacked**.
4. Select this repository directory.
5. Open Scry with `Command+K`; close the popup with `Esc` or by focusing the page.

If Chrome reports a shortcut conflict, remap Scry at `chrome://extensions/shortcuts`.

## Development

No build step is required; the extension loads the source ES modules directly.

```bash
npm test
npm run check
```

## Privacy

Scry does not declare host permissions, does not inject content scripts, and does not perform external network requests. It reads Chrome history for local search and stores only Scry-specific selection-learning aggregates in `chrome.storage.local`.
