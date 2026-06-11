export const HISTORY_MODE = 'history'
export const CLOSED_MODE = 'closed'
export const SEARCH_MODES = Object.freeze([HISTORY_MODE, CLOSED_MODE])
export const PUBLIC_SEARCH_MODES = SEARCH_MODES
export const DEFAULT_SEARCH_MODE = HISTORY_MODE
export const FAVORITES_SEARCH_MODE = 'favorites'
export const HIDDEN_SEARCH_MODES = Object.freeze([FAVORITES_SEARCH_MODE])
export const ALL_SEARCH_MODES = Object.freeze([...SEARCH_MODES, ...HIDDEN_SEARCH_MODES])

/**
 * A PublicSearchMode is one of:
 * - "history"
 * - "closed"
 *
 * Interpretation:
 * Represents a search corpus reachable by public Tab / Shift+Tab cycling. `history` is the single
 * browser-history surface backed by a deep in-memory Chrome history cache; `closed` searches local
 * recently closed tab/window sessions. The removed legacy `recent` and explicit `deep` modes are
 * normalized back to `history`.
 *
 * Examples:
 * - "history" searches all available browser history cached for the popup session.
 * - "closed" searches recently closed tabs/windows.
 *
 * @typedef {'history'|'closed'} PublicSearchMode
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
 * - "history" represents the default public mode.
 * - "favorites" represents the hidden local favorites mode.
 *
 * @typedef {PublicSearchMode | HiddenSearchMode} SearchMode
 */

/**
 * A SearchModeStatus is one of:
 * - "idle"
 * - "loading"
 * - "ready"
 * - "error"
 *
 * Interpretation:
 * Represents the popup-session loading state for one SearchMode cache slot.
 *
 * @typedef {'idle'|'loading'|'ready'|'error'} SearchModeStatus
 */

/**
 * One popup-session corpus cache. `history` is backed by deep Chrome history
 * (`fetchHistory({ deep: true })`); `closed` is backed by flattened Chrome
 * recently closed tab/window sessions; `favorites` is a hidden, explicit local
 * favorites corpus. All indexes are cached in memory for the popup lifetime.
 *
 * @typedef {object} SearchModeState
 * @property {SearchMode} mode Search corpus identifier.
 * @property {SearchModeStatus} status Load status for this popup-session cache.
 * @property {import('./search.js').HistoryIndex | null} index In-memory search index when ready.
 * @property {Error | null} error Last load error for this mode, if any.
 * @property {number | null} loadedAt Millisecond timestamp when this mode became ready.
 * @property {Promise<SearchModeState> | null} loadingPromise In-flight load promise reused while this mode is loading.
 */

/**
 * @typedef {object} PopupSessionSearchCache
 * @property {SearchMode} activeMode Currently visible popup-session corpus.
 * @property {{ history: SearchModeState, closed: SearchModeState, favorites?: SearchModeState }} modes Per-mode popup-session cache state.
 */

/**
 * @typedef {object} SearchSurfaceModel
 * @property {string} label Compact visible active mode label.
 * @property {SearchMode} mode Active mode represented by the surface.
 * @property {SearchModeStatus} status Current active mode load status.
 * @property {boolean} clickable Whether the badge cycles through public modes.
 * @property {string} modeSwitchHint Keyboard/click hint for changing modes.
 * @property {string} statusText Accessible/status text for the active corpus.
 */

/**
 * @typedef {object} SearchHeaderModel
 * @property {string} beforeMode Visible header text before the corpus badge, normally "Search".
 * @property {string} modeBadgeLabel Active corpus badge label.
 * @property {SearchMode} mode Active corpus represented by the badge.
 * @property {string} afterMode Visible header text after the corpus badge.
 * @property {string} modeSwitchHint Keyboard/click hint for changing modes.
 * @property {SearchModeStatus} status Current active corpus load status.
 * @property {string} statusText Right-aligned accessible/status text for the active corpus.
 */

export function createSearchModeState(mode) {
  return {
    mode,
    status: 'idle',
    index: null,
    error: null,
    loadedAt: null,
    loadingPromise: null,
  }
}

export function createPopupSessionSearchCache({ activeMode = HISTORY_MODE } = {}) {
  return {
    activeMode: normalizeSearchMode(activeMode),
    modes: {
      history: createSearchModeState(HISTORY_MODE),
      closed: createSearchModeState(CLOSED_MODE),
    },
  }
}

export function createModeCache() {
  return createPopupSessionSearchCache().modes
}

export function isHiddenSearchMode(mode) {
  return HIDDEN_SEARCH_MODES.includes(mode)
}

export function isPublicSearchMode(mode) {
  return PUBLIC_SEARCH_MODES.includes(mode)
}

export function normalizeSearchMode(mode) {
  if (mode === CLOSED_MODE) return CLOSED_MODE
  if (mode === FAVORITES_SEARCH_MODE) return FAVORITES_SEARCH_MODE
  return HISTORY_MODE
}

export function hiddenSearchModeExitTarget(previousMode) {
  return isPublicSearchMode(previousMode) ? previousMode : DEFAULT_SEARCH_MODE
}

function indexedStatusText(state, statusTextForCount) {
  const status = state?.status ?? 'idle'
  const entryCount = Array.isArray(state?.index?.entries) ? state.index.entries.length : 0
  const urlWord = entryCount === 1 ? 'URL' : 'URLs'
  const text = statusTextForCount(entryCount, urlWord)

  return text[status] ?? text.idle
}

export function searchModeStatusText(state) {
  const mode = state?.mode === CLOSED_MODE
    ? CLOSED_MODE
    : state?.mode === FAVORITES_SEARCH_MODE
      ? FAVORITES_SEARCH_MODE
      : HISTORY_MODE

  const textByMode = {
    history: (entryCount, urlWord) => ({
      idle: 'History not loaded',
      loading: 'Loading history…',
      ready: `${entryCount} history ${urlWord}`,
      error: 'History unavailable',
    }),
    closed: (entryCount, urlWord) => ({
      idle: 'Recently closed URLs not loaded',
      loading: 'Loading recently closed URLs…',
      ready: `${entryCount} recently closed ${urlWord}`,
      error: 'Recently closed URLs unavailable',
    }),
    favorites: (entryCount, urlWord) => ({
      idle: 'Favorites not loaded',
      loading: 'Loading favorites…',
      ready: `${entryCount} favorite ${urlWord}`,
      error: 'Favorites unavailable',
    }),
  }

  return indexedStatusText(state, textByMode[mode])
}

function activeSearchModeStateOrDefault(cache) {
  const activeMode = normalizeSearchMode(cache?.activeMode)
  const state = cache?.modes?.[activeMode]
  if (state?.mode !== activeMode) return createSearchModeState(activeMode)

  return state
}

function modeIndicatorModelFromStatusText(mode, state, { label = mode, clickable, modeSwitchHint, statusTextForCount }) {
  const status = state?.status ?? 'idle'

  return {
    label,
    mode,
    status,
    clickable,
    modeSwitchHint,
    statusText: indexedStatusText(state, statusTextForCount),
  }
}

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

export function favoritesSearchHeaderModel(state) {
  return searchHeaderModelFromIndicator(favoritesModeIndicatorModel(state), 'favorites')
}

export function modeIndicatorModel(mode, state) {
  const activeMode = isPublicSearchMode(mode) ? mode : DEFAULT_SEARCH_MODE
  const statusTextForCount = {
    history: (entryCount, urlWord) => ({
      idle: 'History not loaded',
      loading: 'Loading history…',
      ready: `${entryCount} history ${urlWord}`,
      error: 'History unavailable',
    }),
    closed: (entryCount, urlWord) => ({
      idle: 'Recently closed URLs not loaded',
      loading: 'Loading recently closed URLs…',
      ready: `${entryCount} recently closed ${urlWord}`,
      error: 'Recently closed URLs unavailable',
    }),
  }[activeMode]

  return modeIndicatorModelFromStatusText(activeMode, state, {
    clickable: true,
    modeSwitchHint: 'Tab / Shift+Tab',
    statusTextForCount,
  })
}

export function searchHeaderModel(mode, state, { realResultCount = 0 } = {}) {
  void realResultCount
  return searchHeaderModelFromIndicator(modeIndicatorModel(mode, state), '')
}

export function searchSearchSurfaceModel(cache, { realResultCount = 0 } = {}) {
  void realResultCount
  const state = activeSearchModeStateOrDefault(cache)
  if (state.mode === FAVORITES_SEARCH_MODE) return favoritesModeIndicatorModel(state)

  return modeIndicatorModel(state.mode, state)
}

export function searchSearchHeaderModel(cache, { realResultCount = 0 } = {}) {
  void realResultCount
  const state = activeSearchModeStateOrDefault(cache)
  if (state.mode === FAVORITES_SEARCH_MODE) return favoritesSearchHeaderModel(state)

  return searchHeaderModel(state.mode, state)
}

export function nextSearchMode(currentMode, direction = 1) {
  const currentIndex = SEARCH_MODES.indexOf(currentMode)
  if (currentIndex < 0) return HISTORY_MODE

  const step = direction < 0 ? -1 : 1
  const nextIndex = (currentIndex + step + SEARCH_MODES.length) % SEARCH_MODES.length
  return SEARCH_MODES[nextIndex]
}

export function cycleSearchMode(currentMode, { direction = 1 } = {}) {
  return nextSearchMode(currentMode, direction)
}
