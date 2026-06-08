import { saveFavoriteTarget } from './src/platform/favorites-store.js'
import { allowsBrowsingDataPersistence, incognitoContextFromTab } from './src/platform/incognito-context.js'

const FAVORITE_CONTEXT_MENU_ID_PREFIX = 'scry-save-favorite:'
const FAVORITE_CONTEXT_MENU_CONTEXTS = Object.freeze(['page', 'link', 'image', 'video', 'audio', 'frame'])
const FAVORITE_SAVE_FEEDBACK_BADGE_TEXT = '✓'
const FAVORITE_SAVE_FEEDBACK_BADGE_BACKGROUND_COLOR = '#188038'
const FAVORITE_SAVE_FEEDBACK_DURATION_MS = 1_500

/**
 * A FavoriteContextMenuContext is one of:
 * - "page"
 * - "link"
 * - "image"
 * - "video"
 * - "audio"
 * - "frame"
 *
 * Interpretation:
 * Represents the Chrome context-menu contexts that can supply a URL-bearing target for local Scry
 * favorites. Each context maps to the corresponding FavoriteSource in stored save targets.
 *
 * Examples:
 * - "page" represents saving the pageUrl from a right-click on a page.
 * - "link" represents saving linkUrl from a right-clicked anchor.
 * - "frame" represents saving frameUrl from a right-clicked frame.
 *
 * @typedef {'page'|'link'|'image'|'video'|'audio'|'frame'} FavoriteContextMenuContext
 */

/**
 * A FavoriteCommandName is one of:
 * - "save-current-tab-as-favorite"
 *
 * Interpretation:
 * Represents the Chrome extension command that saves the active tab to local favorites.
 * The command is suggested as Alt+Shift+F so users can test it immediately and remap it in Chrome if desired.
 *
 * Examples:
 * - "save-current-tab-as-favorite" represents saving the current active tab.
 *
 * @typedef {'save-current-tab-as-favorite'} FavoriteCommandName
 */

/**
 * A ChromeContextMenuFavoriteInfo is an object:
 * - menuItemId: string
 * - pageUrl?: string
 * - linkUrl?: string
 * - srcUrl?: string
 * - frameUrl?: string
 *
 * Interpretation:
 * Represents the subset of Chrome's context-menu click info needed to create a local favorite save
 * target. Different URL fields are present for different FavoriteContextMenuContext variants.
 *
 * Examples:
 * - { menuItemId: "scry-save-favorite:page", pageUrl: "https://example.com/docs" } saves a page URL.
 * - { menuItemId: "scry-save-favorite:link", linkUrl: "https://example.com/download" } saves a link URL.
 * - { menuItemId: "scry-save-favorite:image", srcUrl: "https://cdn.example.com/img.png" } saves an image URL.
 *
 * @typedef {object} ChromeContextMenuFavoriteInfo
 * @property {string} menuItemId Menu item id identifying the favorites context variant.
 * @property {string | undefined} pageUrl Page URL supplied by Chrome.
 * @property {string | undefined} linkUrl Link URL supplied by Chrome.
 * @property {string | undefined} srcUrl Source URL for image/video/audio contexts.
 * @property {string | undefined} frameUrl Frame URL supplied by Chrome.
 */

/**
 * object -> import('./src/core/favorites.js').FavoriteSaveTarget | null
 *
 * Produces a FavoriteSaveTarget for a non-incognito active tab command, or null when Chrome did not
 * provide a URL-bearing active tab or the tab is incognito.
 *
 * Functional Examples:
 * - favoriteTargetFromActiveTab({ url: "https://example.com/docs", title: "Example docs", incognito: false }) should produce { url: "https://example.com/docs", title: "Example docs", source: "tab" }.
 * - favoriteTargetFromActiveTab({ url: "https://example.com/docs" }) should produce { url: "https://example.com/docs", title: undefined, source: "tab" }.
 * - favoriteTargetFromActiveTab({ title: "Missing URL" }) should produce null.
 * - favoriteTargetFromActiveTab({ url: "https://secret.example/", title: "Secret", incognito: true }) should produce null.
 *
 * Template:
 * Compose IncognitoContext with the active tab object fields:
 * - build IncognitoContext from tab.incognito
 * - when browsing data persistence is not allowed, produce null
 * - when tab.url is a non-empty string, build a FavoriteSaveTarget with source "tab"
 * - otherwise produce null
 */
export function favoriteTargetFromActiveTab(tab) {
  const context = incognitoContextFromTab(tab)
  if (!allowsBrowsingDataPersistence(context)) return null

  if (typeof tab?.url !== 'string' || tab.url.length === 0) return null

  return {
    url: tab.url,
    title: typeof tab?.title === 'string' ? tab.title : undefined,
    source: 'tab',
  }
}

/**
 * ChromeContextMenuFavoriteInfo object -> import('./src/core/favorites.js').FavoriteSaveTarget | null
 *
 * Produces a FavoriteSaveTarget from a non-incognito Chrome context-menu click by choosing the URL
 * field that corresponds to the clicked favorite menu item.
 *
 * Functional Examples:
 * - favoriteTargetFromContextMenu({ menuItemId: "scry-save-favorite:page", pageUrl: "https://example.com/docs" }, { title: "Example docs", incognito: false }) should produce { url: "https://example.com/docs", title: "Example docs", source: "page" }.
 * - favoriteTargetFromContextMenu({ menuItemId: "scry-save-favorite:link", linkUrl: "https://example.com/download" }, { title: "Example docs" }) should produce { url: "https://example.com/download", title: "Example docs", source: "link" }.
 * - favoriteTargetFromContextMenu({ menuItemId: "scry-save-favorite:image", srcUrl: "https://cdn.example.com/img.png" }, { title: "Example docs" }) should produce { url: "https://cdn.example.com/img.png", title: "Example docs", source: "image" }.
 * - favoriteTargetFromContextMenu({ menuItemId: "scry-save-favorite:frame", frameUrl: "https://frame.example.com/" }, { title: "Frame host" }) should produce { url: "https://frame.example.com/", title: "Frame host", source: "frame" }.
 * - favoriteTargetFromContextMenu({ menuItemId: "unknown", pageUrl: "https://example.com/docs" }, { title: "Example docs" }) should produce null.
 * - favoriteTargetFromContextMenu({ menuItemId: "scry-save-favorite:page", pageUrl: "https://secret.example/" }, { title: "Secret", incognito: true }) should produce null.
 *
 * Template:
 * Compose IncognitoContext with FavoriteContextMenuContext as an itemization:
 * - build IncognitoContext from tab.incognito
 * - when browsing data persistence is not allowed, produce null
 * - parse the context from info.menuItemId
 * - for page use pageUrl; for link use linkUrl; for image/video/audio use srcUrl; for frame use frameUrl
 * - when the chosen URL is a non-empty string, build a FavoriteSaveTarget with tab title fallback
 * - otherwise produce null
 */
export function favoriteTargetFromContextMenu(info, tab) {
  const context = incognitoContextFromTab(tab)
  if (!allowsBrowsingDataPersistence(context)) return null

  const menuItemId = typeof info?.menuItemId === 'string' ? info.menuItemId : ''
  if (!menuItemId.startsWith(FAVORITE_CONTEXT_MENU_ID_PREFIX)) return null

  const source = menuItemId.slice(FAVORITE_CONTEXT_MENU_ID_PREFIX.length)
  if (!FAVORITE_CONTEXT_MENU_CONTEXTS.includes(source)) return null

  const urlBySource = {
    page: info?.pageUrl,
    link: info?.linkUrl,
    image: info?.srcUrl,
    video: info?.srcUrl,
    audio: info?.srcUrl,
    frame: info?.frameUrl,
  }
  const url = urlBySource[source]
  if (typeof url !== 'string' || url.length === 0) return null

  return {
    url,
    title: typeof tab?.title === 'string' ? tab.title : undefined,
    source,
  }
}

/**
 * { chromeApi?: object } -> void
 *
 * Registers local Scry favorites context-menu items for page, link, image, video, audio, and frame
 * URL-bearing targets.
 *
 * Functional Examples:
 * - registerFavoriteContextMenus({ chromeApi }) should remove existing Scry favorite menu items and create one item for each FavoriteContextMenuContext.
 * - registerFavoriteContextMenus({ chromeApi }) should create items whose contexts are ["page"], ["link"], ["image"], ["video"], ["audio"], and ["frame"] respectively.
 *
 * Template:
 * Follow the collection of FavoriteContextMenuContext variants:
 * - iterate page/link/image/video/audio/frame
 * - create a deterministic menu id for each context
 * - call chrome.contextMenus.create for each local save item
 */
export function registerFavoriteContextMenus({ chromeApi = chrome } = {}) {
  const contextMenus = chromeApi?.contextMenus
  if (!contextMenus || typeof contextMenus.create !== 'function') return

  try {
    contextMenus.removeAll?.()
  } catch {
    // Fake or restricted Chrome APIs may not support removal; creating defensively is enough here.
  }

  for (const context of FAVORITE_CONTEXT_MENU_CONTEXTS) {
    contextMenus.create({
      id: `${FAVORITE_CONTEXT_MENU_ID_PREFIX}${context}`,
      title: `Save ${context} to Scry favorites`,
      contexts: [context],
    })
  }
}

function invokeChromeAction(action, methodName, details) {
  const method = action?.[methodName]
  if (typeof method !== 'function') return false

  try {
    const maybePromise = method.call(action, details)
    maybePromise?.catch?.(() => {})
    return true
  } catch {
    return false
  }
}

/**
 * FavoriteUrl | null { chromeApi?: object, windowApi?: object, durationMs?: number } -> boolean
 *
 * Shows short local extension-icon feedback after a favorite is saved, returning true when the
 * badge feedback could be started.
 *
 * Functional Examples:
 * - showFavoriteSaveFeedback(exampleFavorite, { chromeApi, windowApi }) should set a green “✓” badge and schedule it to clear.
 * - showFavoriteSaveFeedback(null, { chromeApi, windowApi }) should not touch the badge and should return false.
 * - showFavoriteSaveFeedback(exampleFavorite, { chromeApiWithoutAction, windowApi }) should return false.
 *
 * Template:
 * Follow optional favorite/action data:
 * - when favorite or chrome.action.setBadgeText is absent, return false
 * - set a green check badge on the extension action
 * - schedule badge text clearing after a short delay
 */
export function showFavoriteSaveFeedback(favorite, { chromeApi = chrome, windowApi = globalThis, durationMs = FAVORITE_SAVE_FEEDBACK_DURATION_MS } = {}) {
  if (!favorite) return false

  const action = chromeApi?.action
  if (typeof action?.setBadgeText !== 'function') return false

  invokeChromeAction(action, 'setBadgeBackgroundColor', { color: FAVORITE_SAVE_FEEDBACK_BADGE_BACKGROUND_COLOR })
  invokeChromeAction(action, 'setBadgeText', { text: FAVORITE_SAVE_FEEDBACK_BADGE_TEXT })

  const timerApi = typeof windowApi?.setTimeout === 'function' ? windowApi : globalThis
  if (typeof timerApi?.setTimeout === 'function' && durationMs > 0) {
    const timer = timerApi.setTimeout.call(timerApi, () => {
      invokeChromeAction(action, 'setBadgeText', { text: '' })
    }, durationMs)
    timer?.unref?.()
  }

  return true
}

/**
 * string { chromeApi?: object, now?: number, windowApi?: object } -> Promise<import('./src/core/favorites.js').FavoriteUrl | null>
 *
 * Handles the Alt+Shift+F Chrome command for saving the current active tab to local Scry favorites.
 *
 * Functional Examples:
 * - handleFavoriteCommand("save-current-tab-as-favorite", { chromeApi, now: 2_000 }) should query the active tab, save it with source "tab", and resolve to the saved FavoriteUrl.
 * - handleFavoriteCommand("unknown", { chromeApi, now: 2_000 }) should not query tabs or write storage and should resolve to null.
 * - handleFavoriteCommand("save-current-tab-as-favorite", { chromeApiWithNoActiveUrl, now: 2_000 }) should resolve to null.
 * - handleFavoriteCommand("save-current-tab-as-favorite", { chromeApiWithIncognitoActiveTab, now: 2_000 }) should query the active tab, write no storage, and resolve to null.
 *
 * Template:
 * Follow FavoriteCommandName as an itemization:
 * - when command is save-current-tab-as-favorite, query the active tab
 * - convert the tab with incognito-aware favoriteTargetFromActiveTab
 * - when a target is present, call saveFavoriteTarget(target, { chromeApi, now })
 * - otherwise return null
 */
export async function handleFavoriteCommand(command, { chromeApi = chrome, now = Date.now(), windowApi = globalThis } = {}) {
  if (command !== 'save-current-tab-as-favorite') return null

  const queryTabs = chromeApi?.tabs?.query
  if (typeof queryTabs !== 'function') return null

  const tabs = await queryTabs.call(chromeApi.tabs, { active: true, currentWindow: true })
  const target = favoriteTargetFromActiveTab(Array.isArray(tabs) ? tabs[0] : null)
  if (!target) return null

  const saved = await saveFavoriteTarget(target, { chromeApi, now })
  showFavoriteSaveFeedback(saved, { chromeApi, windowApi })
  return saved
}

/**
 * ChromeContextMenuFavoriteInfo object { chromeApi?: object, now?: number, windowApi?: object } -> Promise<import('./src/core/favorites.js').FavoriteUrl | null>
 *
 * Handles a Scry favorites context-menu click by saving the clicked URL-bearing target to local
 * extension storage.
 *
 * Functional Examples:
 * - handleFavoriteContextMenuClick(pageInfo, tab, { chromeApi, now: 2_000 }) should save the page target and resolve to the saved FavoriteUrl.
 * - handleFavoriteContextMenuClick(linkInfo, tab, { chromeApi, now: 2_000 }) should save the link target and resolve to the saved FavoriteUrl.
 * - handleFavoriteContextMenuClick(unknownInfo, tab, { chromeApi, now: 2_000 }) should not write storage and should resolve to null.
 * - handleFavoriteContextMenuClick(pageInfo, incognitoTab, { chromeApi, now: 2_000 }) should write no storage and resolve to null.
 *
 * Template:
 * Compose incognito-aware context-menu parsing and storage:
 * - favoriteTargetFromContextMenu(info, tab)
 * - when target is null, return null
 * - otherwise call saveFavoriteTarget(target, { chromeApi, now })
 */
export async function handleFavoriteContextMenuClick(info, tab, { chromeApi = chrome, now = Date.now(), windowApi = globalThis } = {}) {
  const target = favoriteTargetFromContextMenu(info, tab)
  if (!target) return null

  const saved = await saveFavoriteTarget(target, { chromeApi, now })
  showFavoriteSaveFeedback(saved, { chromeApi, windowApi })
  return saved
}

/**
 * { chromeApi?: object } -> void
 *
 * Installs the background service-worker listeners that keep favorites local-only: context-menu
 * registration, context-menu click saves, and the active-tab save command.
 *
 * Functional Examples:
 * - installFavoriteBackgroundHandlers({ chromeApi }) should register context menus when the extension is installed.
 * - installFavoriteBackgroundHandlers({ chromeApi }) should register context menus when Chrome starts up.
 * - installFavoriteBackgroundHandlers({ chromeApi }) should route chrome.commands.onCommand events to handleFavoriteCommand.
 * - installFavoriteBackgroundHandlers({ chromeApi }) should route chrome.contextMenus.onClicked events to handleFavoriteContextMenuClick.
 *
 * Template:
 * Follow the background integration seams:
 * - attach runtime.onInstalled listener to registerFavoriteContextMenus
 * - attach runtime.onStartup listener to registerFavoriteContextMenus
 * - attach commands.onCommand listener to handleFavoriteCommand
 * - attach contextMenus.onClicked listener to handleFavoriteContextMenuClick
 */
export function installFavoriteBackgroundHandlers({ chromeApi = chrome, windowApi = globalThis } = {}) {
  const registerMenus = () => registerFavoriteContextMenus({ chromeApi })

  chromeApi?.runtime?.onInstalled?.addListener?.(registerMenus)
  chromeApi?.runtime?.onStartup?.addListener?.(registerMenus)
  chromeApi?.commands?.onCommand?.addListener?.((command) => handleFavoriteCommand(command, { chromeApi, windowApi }))
  chromeApi?.contextMenus?.onClicked?.addListener?.((info, tab) => handleFavoriteContextMenuClick(info, tab, { chromeApi, windowApi }))
}

if (typeof chrome !== 'undefined') {
  installFavoriteBackgroundHandlers({ chromeApi: chrome })
}
