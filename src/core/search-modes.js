export const SEARCH_MODES = Object.freeze(['recent', 'closed', 'deep'])
export const PUBLIC_SEARCH_MODES = SEARCH_MODES
export const DEFAULT_SEARCH_MODE = 'recent'
export const FAVORITES_SEARCH_MODE = 'favorites'
export const HIDDEN_SEARCH_MODES = Object.freeze([FAVORITES_SEARCH_MODE])
export const ALL_SEARCH_MODES = Object.freeze([...SEARCH_MODES, ...HIDDEN_SEARCH_MODES])

/**
 * A PublicSearchMode is one of:
 * - "recent"
 * - "closed"
 * - "deep"
 *
 * Interpretation:
 * Represents a search corpus reachable by public Tab / Shift+Tab cycling. Public cycling order is
 * recent -> closed -> deep and must not include hidden modes.
 *
 * Examples:
 * - "recent" searches recent browser history.
 * - "closed" searches recently closed tabs/windows.
 * - "deep" searches all available browser history.
 *
 * @typedef {'recent'|'closed'|'deep'} PublicSearchMode
 */

/**
 * A HiddenSearchMode is one of:
 * - "favorites"
 *
 * Interpretation:
 * Represents a local-only search mode that is not reachable through public mode cycling. The
 * favorites mode is entered by the submitted command :f through :favorite and exits with Tab to
 * the previous PublicSearchMode.
 *
 * Examples:
 * - "favorites" searches locally stored FavoriteUrl records.
 *
 * @typedef {'favorites'} HiddenSearchMode
 */

/**
 * A SearchMode is one of:
 * - PublicSearchMode
 * - HiddenSearchMode
 *
 * Interpretation:
 * Represents any Scry search mode. Public modes are visible in the header cycle; hidden modes are
 * reached by explicit command and may keep separate popup-session state.
 *
 * Examples:
 * - "recent" represents the default public mode.
 * - "favorites" represents the hidden local favorites mode.
 *
 * @typedef {PublicSearchMode | HiddenSearchMode} SearchMode
 */

/**
 * A ModeLoadStatus is one of:
 * - "idle"
 * - "loading"
 * - "ready"
 * - "error"
 *
 * Interpretation:
 * Represents the popup-session loading state for one SearchMode cache slot.
 *
 * Examples:
 * - "idle" represents a mode that has not loaded yet.
 * - "ready" represents a mode with a built in-memory index.
 * - "error" represents a mode-local load failure.
 *
 * @typedef {'idle'|'loading'|'ready'|'error'} ModeLoadStatus
 */

/**
 * A SearchModeState is an object:
 * - mode: SearchMode
 * - status: ModeLoadStatus
 * - index: HistoryIndex | null
 * - error: Error | null
 * - loadedAt: number | null
 *
 * Interpretation:
 * Represents one popup-session cache slot for a search mode. Public modes index browser history or
 * closed sessions; favorites indexes StoredFavorites converted into history-like entries.
 *
 * Examples:
 * - { mode: "recent", status: "idle", index: null, error: null, loadedAt: null } represents an unloaded recent-history slot.
 * - { mode: "favorites", status: "ready", index: favoritesIndex, error: null, loadedAt: 5_000 } represents loaded local favorites.
 *
 * @typedef {object} SearchModeState
 * @property {SearchMode} mode Mode this state belongs to.
 * @property {ModeLoadStatus} status Load status for this popup-session cache slot.
 * @property {import('./search.js').HistoryIndex | null} index In-memory index for the mode when ready.
 * @property {Error | null} error Last mode-local load error, if any.
 * @property {number | null} loadedAt Millisecond timestamp when index became ready.
 */

/**
 * A SearchModeCache is an Object.<SearchMode, SearchModeState>.
 *
 * Interpretation:
 * Represents the popup-session cache of loaded indexes by mode. The public cache is initialized for
 * recent, closed, and deep; hidden mode state may be added for favorites without changing
 * SEARCH_MODES public cycling.
 *
 * Examples:
 * - { recent: idleRecent, closed: idleClosed, deep: idleDeep } represents the initial public cache.
 * - { recent: readyRecent, closed: idleClosed, deep: idleDeep, favorites: readyFavorites } represents a cache after entering favorites.
 *
 * @typedef {Object.<SearchMode, SearchModeState>} SearchModeCache
 */

/**
 * A ModeIndicatorModel is an object:
 * - label: string
 * - mode: SearchMode
 * - status: ModeLoadStatus
 * - clickable: boolean
 * - modeSwitchHint: string
 * - statusText: string
 *
 * Interpretation:
 * Represents the compact header badge for the active search mode. Public modes are clickable for
 * public cycling; favorites is hidden from public cycling and uses Tab as an exit hint.
 *
 * Examples:
 * - { label: "recent", mode: "recent", status: "ready", clickable: true, modeSwitchHint: "Tab/Shift+Tab", statusText: "12 recent history URLs" } represents a public mode badge.
 * - { label: "favorites", mode: "favorites", status: "ready", clickable: false, modeSwitchHint: "Tab to return", statusText: "2 favorite URLs" } represents the hidden favorites badge.
 *
 * @typedef {object} ModeIndicatorModel
 * @property {string} label Compact visible badge label, for example "recent".
 * @property {SearchMode} mode Active mode.
 * @property {ModeLoadStatus} status Active mode load status.
 * @property {boolean} clickable Whether clicking should cycle to the next public mode.
 * @property {string} modeSwitchHint Compact adjacent hint for changing modes, for example "Tab/Shift+Tab".
 * @property {string} statusText Accessible/status text for the active mode.
 */

/**
 * A HeaderSearchContextModel is an object:
 * - beforeMode: string
 * - modeBadgeLabel: string
 * - mode: SearchMode
 * - afterMode: string
 * - modeSwitchHint: string
 * - status: ModeLoadStatus
 * - statusText: string
 *
 * Interpretation:
 * Represents the accessible, visible search header text and status for the active mode.
 *
 * Examples:
 * - { beforeMode: "Search", modeBadgeLabel: "recent", mode: "recent", afterMode: "history", modeSwitchHint: "Tab/Shift+Tab", status: "idle", statusText: "Recent history not loaded" } represents the default header.
 * - { beforeMode: "Search", modeBadgeLabel: "favorites", mode: "favorites", afterMode: "favorites", modeSwitchHint: "Tab to return", status: "ready", statusText: "2 favorite URLs" } represents the hidden favorites header.
 *
 * @typedef {object} HeaderSearchContextModel
 * @property {string} beforeMode Visible header text before the mode badge, normally "Search".
 * @property {string} modeBadgeLabel Plain active-mode label, for example "recent".
 * @property {SearchMode} mode Active mode represented by the badge.
 * @property {string} afterMode Visible header text after the mode badge, normally "history".
 * @property {string} modeSwitchHint Hint shown on or immediately adjacent to the badge.
 * @property {ModeLoadStatus} status Active mode load status.
 * @property {string} statusText Right-aligned accessible/status text for the active mode.
 */

export function createModeCache() {
  return Object.fromEntries(
    SEARCH_MODES.map((mode) => [
      mode,
      { mode, status: 'idle', index: null, error: null, loadedAt: null },
    ]),
  )
}

export function cycleSearchMode(currentMode, { direction = 1 } = {}) {
  const currentIndex = SEARCH_MODES.indexOf(currentMode)
  if (currentIndex === -1) return DEFAULT_SEARCH_MODE

  const step = direction < 0 ? -1 : 1
  const nextIndex = (currentIndex + step + SEARCH_MODES.length) % SEARCH_MODES.length
  return SEARCH_MODES[nextIndex]
}

/**
 * unknown -> boolean
 *
 * Determines whether a value names a hidden Scry search mode.
 *
 * Functional Examples:
 * - isHiddenSearchMode("favorites") should produce true.
 * - isHiddenSearchMode("recent") should produce false.
 * - isHiddenSearchMode("archived") should produce false.
 *
 * Template:
 * Follow HiddenSearchMode as an itemization:
 * - compare the input with "favorites"
 * - reject public modes and non-string values
 */
export function isHiddenSearchMode(mode) {
  return HIDDEN_SEARCH_MODES.includes(mode)
}

/**
 * SearchMode | null | undefined -> PublicSearchMode
 *
 * Produces the public mode that favorites should return to when the user presses Tab from the
 * hidden favorites mode.
 *
 * Functional Examples:
 * - hiddenSearchModeExitTarget("recent") should produce "recent".
 * - hiddenSearchModeExitTarget("closed") should produce "closed".
 * - hiddenSearchModeExitTarget("favorites") should produce "recent".
 * - hiddenSearchModeExitTarget(null) should produce "recent".
 *
 * Template:
 * Follow SearchMode as a union:
 * - when previousMode is a PublicSearchMode, return it
 * - when previousMode is HiddenSearchMode, null, undefined, or invalid, return DEFAULT_SEARCH_MODE
 */
export function hiddenSearchModeExitTarget(previousMode) {
  return PUBLIC_SEARCH_MODES.includes(previousMode) ? previousMode : DEFAULT_SEARCH_MODE
}

/**
 * SearchMode SearchModeState { clickable: boolean, modeSwitchHint: string, statusTextForCount: function } -> ModeIndicatorModel
 *
 * Produces a mode badge by combining the shared indexed-mode status/count extraction with the
 * mode-specific copy and interaction behavior.
 *
 * Functional Examples:
 * - modeIndicatorModelFromStatusText("favorites", readyTwoEntryState, { clickable: false, modeSwitchHint: "Tab to return", statusTextForCount }) should produce a non-clickable favorites badge whose statusText is "2 favorite URLs".
 * - modeIndicatorModelFromStatusText("recent", null, { clickable: true, modeSwitchHint: "Tab/Shift+Tab", statusTextForCount }) should produce a clickable recent badge with idle status text.
 * - modeIndicatorModelFromStatusText("closed", errorState, { clickable: true, modeSwitchHint: "Tab/Shift+Tab", statusTextForCount }) should produce status "error" and fall back through the supplied error copy.
 *
 * Template:
 * Follow SearchModeState and ModeLoadStatus:
 * - read status from state, defaulting to idle
 * - count state.index.entries when present and choose singular/plural URL copy
 * - ask statusTextForCount for the mode-specific idle/loading/ready/error text
 * - build the shared ModeIndicatorModel shape
 */
function modeIndicatorModelFromStatusText(mode, state, { label = mode, clickable, modeSwitchHint, statusTextForCount }) {
  const status = state?.status ?? 'idle'
  const entryCount = Array.isArray(state?.index?.entries) ? state.index.entries.length : 0
  const urlWord = entryCount === 1 ? 'URL' : 'URLs'
  const text = statusTextForCount(entryCount, urlWord)

  return {
    label,
    mode,
    status,
    clickable,
    modeSwitchHint,
    statusText: text[status] ?? text.idle,
  }
}

/**
 * ModeIndicatorModel string -> HeaderSearchContextModel
 *
 * Produces the shared search header text model from a compact mode indicator and the noun phrase
 * shown after the mode badge.
 *
 * Functional Examples:
 * - searchHeaderModelFromIndicator(favoritesIndicator, "favorites") should produce beforeMode "Search", modeBadgeLabel from favoritesIndicator.label, afterMode "favorites", and the favorites status text.
 * - searchHeaderModelFromIndicator(recentIndicator, "history") should produce beforeMode "Search", modeBadgeLabel from recentIndicator.label, afterMode "history", and the recent status text.
 *
 * Template:
 * Follow HeaderSearchContextModel:
 * - set beforeMode to "Search"
 * - copy label/mode/modeSwitchHint/status/statusText from the indicator
 * - set afterMode from the supplied noun phrase
 */
function searchHeaderModelFromIndicator(indicator, afterMode) {
  return {
    beforeMode: 'Search',
    modeBadgeLabel: indicator.label,
    mode: indicator.mode,
    afterMode,
    modeSwitchHint: indicator.modeSwitchHint,
    status: indicator.status,
    statusText: indicator.statusText,
  }
}

/**
 * SearchModeState | null -> ModeIndicatorModel
 *
 * Produces the hidden favorites badge model, including local favorites counts and the Tab exit hint
 * instead of the public Tab/Shift+Tab cycle hint.
 *
 * Functional Examples:
 * - favoritesModeIndicatorModel(null) should produce a favorites idle badge with statusText "Favorites not loaded" and clickable false.
 * - favoritesModeIndicatorModel({ mode: "favorites", status: "loading", index: null, error: null, loadedAt: null }) should produce statusText "Loading favorites…".
 * - favoritesModeIndicatorModel({ mode: "favorites", status: "ready", index: { builtAt: 1, entries: [{}, {}] }, error: null, loadedAt: 1 }) should produce statusText "2 favorite URLs".
 * - favoritesModeIndicatorModel({ mode: "favorites", status: "error", index: null, error: new Error("storage unavailable"), loadedAt: null }) should produce statusText "Favorites unavailable".
 *
 * Template:
 * Follow ModeLoadStatus as an itemization through modeIndicatorModelFromStatusText:
 * - provide favorites-specific status copy
 * - provide non-clickable hidden-mode interaction fields
 * - reuse shared indexed-mode status/count extraction
 */
export function favoritesModeIndicatorModel(state) {
  return modeIndicatorModelFromStatusText(FAVORITES_SEARCH_MODE, state, {
    clickable: false,
    modeSwitchHint: 'Tab to return',
    statusTextForCount: (entryCount, urlWord) => ({
      idle: 'Favorites not loaded',
      loading: 'Loading favorites…',
      ready: `${entryCount} favorite ${urlWord}`,
      error: 'Favorites unavailable',
    }),
  })
}

/**
 * SearchModeState | null -> HeaderSearchContextModel
 *
 * Produces the search header model for hidden favorites mode.
 *
 * Functional Examples:
 * - favoritesSearchHeaderModel(null) should produce beforeMode "Search", modeBadgeLabel "favorites", afterMode "favorites", and statusText "Favorites not loaded".
 * - favoritesSearchHeaderModel({ mode: "favorites", status: "ready", index: { builtAt: 1, entries: [{}] }, error: null, loadedAt: 1 }) should produce statusText "1 favorite URL".
 *
 * Template:
 * Compose favoritesModeIndicatorModel and searchHeaderModelFromIndicator:
 * - build the favorites indicator
 * - copy shared indicator fields into HeaderSearchContextModel
 * - set afterMode to "favorites"
 */
export function favoritesSearchHeaderModel(state) {
  return searchHeaderModelFromIndicator(favoritesModeIndicatorModel(state), 'favorites')
}

export function searchHeaderModel(mode, state, { realResultCount = 0 } = {}) {
  void realResultCount
  return searchHeaderModelFromIndicator(modeIndicatorModel(mode, state), 'history')
}

export function modeIndicatorModel(mode, state) {
  const activeMode = SEARCH_MODES.includes(mode) ? mode : DEFAULT_SEARCH_MODE
  const statusTextForCount = {
    recent: (entryCount, urlWord) => ({
      idle: 'Recent history not loaded',
      loading: 'Loading recent history…',
      ready: `${entryCount} recent history ${urlWord}`,
      error: 'Recent history unavailable',
    }),
    closed: (entryCount, urlWord) => ({
      idle: 'Recently closed URLs not loaded',
      loading: 'Loading recently closed URLs…',
      ready: `${entryCount} recently closed ${urlWord}`,
      error: 'Recently closed URLs unavailable',
    }),
    deep: (entryCount, urlWord) => ({
      idle: 'Deep history not loaded',
      loading: 'Loading deep history…',
      ready: `${entryCount} deep history ${urlWord}`,
      error: 'Deep history unavailable',
    }),
  }[activeMode]

  return modeIndicatorModelFromStatusText(activeMode, state, {
    clickable: true,
    modeSwitchHint: 'Tab/Shift+Tab',
    statusTextForCount,
  })
}
