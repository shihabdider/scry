/**
 * An IncognitoContext is an object:
 * - extensionInIncognitoContext: boolean
 * - tabIncognito: boolean
 *
 * Interpretation:
 * Represents Chrome's incognito signals visible at Scry persistence boundaries. The extension flag
 * comes from chrome.extension.inIncognitoContext for popup/extension pages; the tab flag comes from
 * Chrome tab.incognito for URL-bearing tab or context-menu origins. Any true flag means Scry may
 * open/search as usual but must not persist browsing-derived favorites or selection-learning data.
 *
 * Examples:
 * - { extensionInIncognitoContext: false, tabIncognito: false } represents a normal-window popup or tab origin where persistence is allowed.
 * - { extensionInIncognitoContext: true, tabIncognito: false } represents an incognito extension popup with no specific tab-origin signal.
 * - { extensionInIncognitoContext: false, tabIncognito: true } represents a URL supplied by an incognito tab to a background command or context-menu click.
 * - { extensionInIncognitoContext: true, tabIncognito: true } represents both extension and tab incognito signals being present.
 *
 * @typedef {object} IncognitoContext
 * @property {boolean} extensionInIncognitoContext Whether Chrome reports this extension context is incognito.
 * @property {boolean} tabIncognito Whether Chrome reports the URL-bearing source tab is incognito.
 */

/**
 * { extensionInIncognitoContext?: boolean, tabIncognito?: boolean } -> IncognitoContext
 *
 * Produces an IncognitoContext by normalizing raw Chrome incognito signals to booleans.
 *
 * Functional Examples:
 * - makeIncognitoContext({ extensionInIncognitoContext: true }) should produce { extensionInIncognitoContext: true, tabIncognito: false }.
 * - makeIncognitoContext({ tabIncognito: true }) should produce { extensionInIncognitoContext: false, tabIncognito: true }.
 * - makeIncognitoContext({ extensionInIncognitoContext: 1, tabIncognito: "yes" }) should produce { extensionInIncognitoContext: true, tabIncognito: true }.
 *
 * Template:
 * Follow the IncognitoContext fields:
 * - normalize extensionInIncognitoContext with Boolean
 * - normalize tabIncognito with Boolean
 * - build the IncognitoContext object
 */
function makeIncognitoContext({ extensionInIncognitoContext = false, tabIncognito = false } = {}) {
  return {
    extensionInIncognitoContext: Boolean(extensionInIncognitoContext),
    tabIncognito: Boolean(tabIncognito),
  }
}

/**
 * { chromeApi?: object } -> IncognitoContext
 *
 * Produces an IncognitoContext from chrome.extension.inIncognitoContext when only the popup or
 * extension-page context is available.
 *
 * Functional Examples:
 * - incognitoContextFromExtension({ chromeApi: { extension: { inIncognitoContext: false } } }) should produce { extensionInIncognitoContext: false, tabIncognito: false }.
 * - incognitoContextFromExtension({ chromeApi: { extension: { inIncognitoContext: true } } }) should produce { extensionInIncognitoContext: true, tabIncognito: false }.
 * - incognitoContextFromExtension({ chromeApi: {} }) should produce { extensionInIncognitoContext: false, tabIncognito: false }.
 *
 * Template:
 * Follow the optional chrome extension signal:
 * - read chromeApi.extension.inIncognitoContext
 * - normalize the value to a boolean extensionInIncognitoContext field
 * - set tabIncognito to false because no tab origin is available
 */
export function incognitoContextFromExtension({ chromeApi = chrome } = {}) {
  return makeIncognitoContext({ extensionInIncognitoContext: chromeApi?.extension?.inIncognitoContext })
}

/**
 * object { extensionInIncognitoContext?: boolean } -> IncognitoContext
 *
 * Produces an IncognitoContext from a Chrome tab-like object, preserving an optional extension
 * incognito signal supplied by the caller.
 *
 * Functional Examples:
 * - incognitoContextFromTab({ url: "https://example.com/docs", incognito: false }) should produce { extensionInIncognitoContext: false, tabIncognito: false }.
 * - incognitoContextFromTab({ url: "https://secret.example/", incognito: true }) should produce { extensionInIncognitoContext: false, tabIncognito: true }.
 * - incognitoContextFromTab({ url: "https://example.com/docs" }, { extensionInIncognitoContext: true }) should produce { extensionInIncognitoContext: true, tabIncognito: false }.
 * - incognitoContextFromTab(null) should produce { extensionInIncognitoContext: false, tabIncognito: false }.
 *
 * Template:
 * Follow the tab-like object and optional extension signal:
 * - read tab.incognito when present
 * - normalize tabIncognito and extensionInIncognitoContext to booleans
 * - combine both fields into IncognitoContext
 */
export function incognitoContextFromTab(tab, { extensionInIncognitoContext = false } = {}) {
  return makeIncognitoContext({ extensionInIncognitoContext, tabIncognito: tab?.incognito })
}

/**
 * IncognitoContext -> boolean
 *
 * Produces whether Scry may persist browsing-derived data for the given Chrome incognito signals.
 * Persistence is allowed only when both the extension context and source tab are non-incognito.
 *
 * Functional Examples:
 * - allowsBrowsingDataPersistence({ extensionInIncognitoContext: false, tabIncognito: false }) should produce true.
 * - allowsBrowsingDataPersistence({ extensionInIncognitoContext: true, tabIncognito: false }) should produce false.
 * - allowsBrowsingDataPersistence({ extensionInIncognitoContext: false, tabIncognito: true }) should produce false.
 * - allowsBrowsingDataPersistence({ extensionInIncognitoContext: true, tabIncognito: true }) should produce false.
 *
 * Template:
 * Follow the compound IncognitoContext fields:
 * - if extensionInIncognitoContext is true, persistence is not allowed
 * - if tabIncognito is true, persistence is not allowed
 * - otherwise persistence is allowed
 */
export function allowsBrowsingDataPersistence(context) {
  return !context.extensionInIncognitoContext && !context.tabIncognito
}
