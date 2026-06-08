/**
 * An IncognitoContext is an object:
 * - extensionInIncognitoContext: boolean
 * - tabIncognito: boolean
 *
 * Interpretation:
 * Represents Chrome's incognito signals visible at Scry's local persistence boundaries. The
 * extension flag comes from chrome.extension.inIncognitoContext for popup/extension pages and is
 * the signal used to suppress implicit public-mode selection learning from an incognito popup. The
 * tab flag comes from Chrome tab.incognito for URL-bearing active-tab or context-menu origins; it
 * records provenance for explicit favorite saves but does not by itself make an explicit save
 * ineligible. Policy functions decide which signal matters for each write kind.
 *
 * Examples:
 * - { extensionInIncognitoContext: false, tabIncognito: false } represents a normal-window popup or tab origin where public selection learning and explicit favorites saves are allowed.
 * - { extensionInIncognitoContext: true, tabIncognito: false } represents an incognito extension popup where public-mode selection learning is skipped.
 * - { extensionInIncognitoContext: false, tabIncognito: true } represents a URL supplied by an incognito tab to an explicit background favorite command or context-menu click.
 * - { extensionInIncognitoContext: true, tabIncognito: true } represents both extension and tab incognito signals being present; explicit favorite saves may still proceed while implicit public-mode learning is suppressed.
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
 * IncognitoContext import('../core/search-modes.js').SearchMode -> boolean
 *
 * Produces whether Scry may persist implicit selection learning for an opened row in the active
 * search mode. Public modes must not learn from an incognito context; hidden favorites mode may
 * learn because it is based on explicitly saved local favorites.
 *
 * Functional Examples:
 * - allowsImplicitSelectionLearningPersistence({ extensionInIncognitoContext: false, tabIncognito: false }, "recent") should produce true.
 * - allowsImplicitSelectionLearningPersistence({ extensionInIncognitoContext: true, tabIncognito: false }, "recent") should produce false.
 * - allowsImplicitSelectionLearningPersistence({ extensionInIncognitoContext: false, tabIncognito: true }, "closed") should produce false.
 * - allowsImplicitSelectionLearningPersistence({ extensionInIncognitoContext: true, tabIncognito: true }, "deep") should produce false.
 * - allowsImplicitSelectionLearningPersistence({ extensionInIncognitoContext: true, tabIncognito: true }, "favorites") should produce true.
 *
 * Template:
 * Compose IncognitoContext with SearchMode:
 * - branch on public SearchMode variants versus hidden favorites
 * - for "recent", "closed", and "deep", allow only when both incognito signals are false
 * - for "favorites", allow because favorites are explicit local data
 */
export function allowsImplicitSelectionLearningPersistence(context, mode) {
  if (mode === 'favorites') return true

  return !context.extensionInIncognitoContext && !context.tabIncognito
}

