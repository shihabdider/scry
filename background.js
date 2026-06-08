import { saveFavoriteTarget } from './src/platform/favorites-store.js'

const FAVORITE_CONTEXT_MENU_ID_PREFIX = 'scry-save-favorite:'
const FAVORITE_CONTEXT_MENU_CONTEXTS = Object.freeze(['page', 'link', 'image', 'video', 'audio', 'frame'])

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
 * Represents the unbound Chrome extension command that saves the active tab to local favorites.
 * The command has no default shortcut; users may bind one in Chrome if desired.
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
 * Produces a FavoriteSaveTarget for the active tab command, or null when Chrome did not provide a
 * URL-bearing active tab.
 *
 * Functional Examples:
 * - favoriteTargetFromActiveTab({ url: "https://example.com/docs", title: "Example docs" }) should produce { url: "https://example.com/docs", title: "Example docs", source: "tab" }.
 * - favoriteTargetFromActiveTab({ url: "https://example.com/docs" }) should produce { url: "https://example.com/docs", title: undefined, source: "tab" }.
 * - favoriteTargetFromActiveTab({ title: "Missing URL" }) should produce null.
 *
 * Template:
 * Follow the active tab object fields:
 * - when tab.url is a non-empty string, build a FavoriteSaveTarget with source "tab"
 * - otherwise produce null
 */
export function favoriteTargetFromActiveTab(tab) {
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
 * Produces a FavoriteSaveTarget from a Chrome context-menu click by choosing the URL field that
 * corresponds to the clicked favorite menu item.
 *
 * Functional Examples:
 * - favoriteTargetFromContextMenu({ menuItemId: "scry-save-favorite:page", pageUrl: "https://example.com/docs" }, { title: "Example docs" }) should produce { url: "https://example.com/docs", title: "Example docs", source: "page" }.
 * - favoriteTargetFromContextMenu({ menuItemId: "scry-save-favorite:link", linkUrl: "https://example.com/download" }, { title: "Example docs" }) should produce { url: "https://example.com/download", title: "Example docs", source: "link" }.
 * - favoriteTargetFromContextMenu({ menuItemId: "scry-save-favorite:image", srcUrl: "https://cdn.example.com/img.png" }, { title: "Example docs" }) should produce { url: "https://cdn.example.com/img.png", title: "Example docs", source: "image" }.
 * - favoriteTargetFromContextMenu({ menuItemId: "scry-save-favorite:frame", frameUrl: "https://frame.example.com/" }, { title: "Frame host" }) should produce { url: "https://frame.example.com/", title: "Frame host", source: "frame" }.
 * - favoriteTargetFromContextMenu({ menuItemId: "unknown", pageUrl: "https://example.com/docs" }, { title: "Example docs" }) should produce null.
 *
 * Template:
 * Follow FavoriteContextMenuContext as an itemization:
 * - parse the context from info.menuItemId
 * - for page use pageUrl; for link use linkUrl; for image/video/audio use srcUrl; for frame use frameUrl
 * - when the chosen URL is a non-empty string, build a FavoriteSaveTarget with tab title fallback
 * - otherwise produce null
 */
export function favoriteTargetFromContextMenu(info, tab) {
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

/**
 * string { chromeApi?: object, now?: number } -> Promise<import('./src/core/favorites.js').FavoriteUrl | null>
 *
 * Handles the unbound Chrome command for saving the current active tab to local Scry favorites.
 *
 * Functional Examples:
 * - handleFavoriteCommand("save-current-tab-as-favorite", { chromeApi, now: 2_000 }) should query the active tab, save it with source "tab", and resolve to the saved FavoriteUrl.
 * - handleFavoriteCommand("unknown", { chromeApi, now: 2_000 }) should not query tabs or write storage and should resolve to null.
 * - handleFavoriteCommand("save-current-tab-as-favorite", { chromeApiWithNoActiveUrl, now: 2_000 }) should resolve to null.
 *
 * Template:
 * Follow FavoriteCommandName as an itemization:
 * - when command is save-current-tab-as-favorite, query the active tab
 * - convert the tab with favoriteTargetFromActiveTab
 * - when a target is present, call saveFavoriteTarget(target, { chromeApi, now })
 * - otherwise return null
 */
export async function handleFavoriteCommand(command, { chromeApi = chrome, now = Date.now() } = {}) {
  if (command !== 'save-current-tab-as-favorite') return null

  const queryTabs = chromeApi?.tabs?.query
  if (typeof queryTabs !== 'function') return null

  const tabs = await queryTabs.call(chromeApi.tabs, { active: true, currentWindow: true })
  const target = favoriteTargetFromActiveTab(Array.isArray(tabs) ? tabs[0] : null)
  if (!target) return null

  return saveFavoriteTarget(target, { chromeApi, now })
}

/**
 * ChromeContextMenuFavoriteInfo object { chromeApi?: object, now?: number } -> Promise<import('./src/core/favorites.js').FavoriteUrl | null>
 *
 * Handles a Scry favorites context-menu click by saving the clicked URL-bearing target to local
 * extension storage.
 *
 * Functional Examples:
 * - handleFavoriteContextMenuClick(pageInfo, tab, { chromeApi, now: 2_000 }) should save the page target and resolve to the saved FavoriteUrl.
 * - handleFavoriteContextMenuClick(linkInfo, tab, { chromeApi, now: 2_000 }) should save the link target and resolve to the saved FavoriteUrl.
 * - handleFavoriteContextMenuClick(unknownInfo, tab, { chromeApi, now: 2_000 }) should not write storage and should resolve to null.
 *
 * Template:
 * Compose context-menu parsing and storage:
 * - favoriteTargetFromContextMenu(info, tab)
 * - when target is null, return null
 * - otherwise call saveFavoriteTarget(target, { chromeApi, now })
 */
export async function handleFavoriteContextMenuClick(info, tab, { chromeApi = chrome, now = Date.now() } = {}) {
  const target = favoriteTargetFromContextMenu(info, tab)
  if (!target) return null

  return saveFavoriteTarget(target, { chromeApi, now })
}

/**
 * { chromeApi?: object } -> void
 *
 * Installs the background service-worker listeners that keep favorites local-only: context-menu
 * registration, context-menu click saves, and the unbound active-tab save command.
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
export function installFavoriteBackgroundHandlers({ chromeApi = chrome } = {}) {
  const registerMenus = () => registerFavoriteContextMenus({ chromeApi })

  chromeApi?.runtime?.onInstalled?.addListener?.(registerMenus)
  chromeApi?.runtime?.onStartup?.addListener?.(registerMenus)
  chromeApi?.commands?.onCommand?.addListener?.((command) => handleFavoriteCommand(command, { chromeApi }))
  chromeApi?.contextMenus?.onClicked?.addListener?.((info, tab) => handleFavoriteContextMenuClick(info, tab, { chromeApi }))
}

if (typeof chrome !== 'undefined') {
  installFavoriteBackgroundHandlers({ chromeApi: chrome })
}
