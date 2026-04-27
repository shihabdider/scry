# Chrome action popup alignment

## Conclusion

Chrome action popup alignment is not controllable from a Manifest V3 extension. Scry cannot use a supported Chrome extension API to right-align the browser-owned action popup bubble to the extension toolbar anchor.

Scry should therefore keep its current runtime behavior: a Chrome action popup declared by `action.default_popup` and opened through Chrome's `_execute_action` command / toolbar action. Issue-0022 is resolved as an unsupported browser-placement request, not as a runtime positioning change.

## API surface checked

Supported extension APIs can choose which document is shown, but they do not expose popup geometry, alignment, anchor-side, or x/y placement controls:

- `action.default_popup` in `manifest.json` declares the popup HTML document only.
- `chrome.action.setPopup()` changes the popup document URL only.
- `chrome.action.getPopup()` reads the popup document URL only.
- `chrome.action.openPopup()` can ask Chrome to open the action popup, but does not accept coordinates or alignment options.

The resulting action popup placement is browser-controlled. Chrome decides where the toolbar popup bubble appears relative to the extension action icon and the browser window.

## Chosen workaround: preserve the action popup

The practical popup-preserving workaround is to keep using the Chrome action popup and adjust layout within the popup:

- choose the popup document width/height in `popup.html` / CSS;
- align command-palette content to the popup's right edge with CSS when that improves the visual feel;
- use internal padding, max-width, and result-row layout to avoid depending on browser bubble placement.

This preserves the popup lifecycle Scry relies on: `Command+K` opens the action popup, focus starts in the command palette, `Esc` / focus-away can close the popup, and no host permissions, content scripts, external network calls, options page, or side panel are required.

## Non-chosen alternatives

- A separate extension window created with `chrome.windows.create({ type: "popup", ... })` can be positioned more directly, but it is no longer the Chrome action popup anchored to the toolbar action and would change lifecycle, focus, and window-management behavior.
- `chrome.sidePanel` is a different extension surface, not a popup-preserving workaround. Scry's side panel is deprecated and should not be revived for this issue.
- A content-script overlay could control page-relative placement, but it would cross Scry's local popup boundary and require content-script/host-permission behavior that the product intentionally avoids.
