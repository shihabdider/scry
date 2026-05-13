export const HISTORY_MODE = 'history'
export const CLOSED_MODE = 'closed'
export const SEARCH_MODES = [HISTORY_MODE, CLOSED_MODE]

/**
 * @typedef {'history'|'closed'} SearchMode
 */

/**
 * @typedef {'idle'|'loading'|'ready'|'error'} SearchModeStatus
 */

/**
 * One popup-session corpus cache. `history` is backed by deep Chrome history
 * (`fetchHistory({ deep: true })`); `closed` is backed by flattened Chrome
 * recently closed tab/window sessions. Both are cached in memory for the popup
 * lifetime and neither represents the removed legacy `recent` or explicit
 * `deep` modes.
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
 * @property {{ history: SearchModeState, closed: SearchModeState }} modes Per-mode popup-session cache state.
 */

/**
 * @typedef {object} SearchSurfaceModel
 * @property {SearchMode} label Compact visible active mode label.
 * @property {SearchMode} mode Active mode represented by the surface.
 * @property {SearchModeStatus} status Current active mode load status.
 * @property {boolean} clickable Whether the badge cycles to the other mode.
 * @property {string} modeSwitchHint Keyboard/click hint for cycling history/closed without changing the query.
 * @property {string} statusText Accessible/status text for the active corpus.
 */

/**
 * @typedef {object} SearchHeaderModel
 * @property {string} beforeMode Visible header text before the corpus badge, normally "Search".
 * @property {SearchMode} modeBadgeLabel Active corpus badge label.
 * @property {SearchMode} mode Active corpus represented by the badge.
 * @property {string} afterMode Visible header text after the corpus badge, normally empty.
 * @property {string} modeSwitchHint Keyboard/click hint for cycling history/closed without changing the query.
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
    activeMode,
    modes: {
      history: createSearchModeState(HISTORY_MODE),
      closed: createSearchModeState(CLOSED_MODE),
    },
  }
}

export function searchModeStatusText(state) {
  const mode = state?.mode === CLOSED_MODE ? CLOSED_MODE : HISTORY_MODE
  const status = state?.status ?? 'idle'
  const entryCount = Array.isArray(state?.index?.entries) ? state.index.entries.length : 0
  const urlWord = entryCount === 1 ? 'URL' : 'URLs'
  const textByMode = {
    history: {
      idle: 'History not loaded',
      loading: 'Loading history…',
      ready: `${entryCount} history ${urlWord}`,
      error: 'History unavailable',
    },
    closed: {
      idle: 'Recently closed URLs not loaded',
      loading: 'Loading recently closed URLs…',
      ready: `${entryCount} recently closed ${urlWord}`,
      error: 'Recently closed URLs unavailable',
    },
  }
  const text = textByMode[mode]

  return text[status] ?? text.idle
}

function activeSearchModeStateOrDefault(cache) {
  const activeMode = cache?.activeMode
  if (activeMode !== HISTORY_MODE && activeMode !== CLOSED_MODE) return createSearchModeState(HISTORY_MODE)

  const state = cache?.modes?.[activeMode]
  if (state?.mode !== activeMode) return createSearchModeState(HISTORY_MODE)

  return state
}

export function searchSearchSurfaceModel(cache, { realResultCount = 0 } = {}) {
  void realResultCount
  const state = activeSearchModeStateOrDefault(cache)
  const mode = state.mode === CLOSED_MODE ? CLOSED_MODE : HISTORY_MODE

  return {
    label: mode,
    mode,
    status: state.status ?? 'idle',
    clickable: true,
    modeSwitchHint: 'Tab / Shift+Tab',
    statusText: searchModeStatusText(state),
  }
}

export function searchSearchHeaderModel(cache, { realResultCount = 0 } = {}) {
  void realResultCount
  const surface = searchSearchSurfaceModel(cache)

  return {
    beforeMode: 'Search',
    modeBadgeLabel: surface.label,
    mode: surface.mode,
    afterMode: '',
    modeSwitchHint: surface.modeSwitchHint,
    status: surface.status,
    statusText: surface.statusText,
  }
}

export function nextSearchMode(currentMode, direction = 1) {
  const currentIndex = SEARCH_MODES.indexOf(currentMode)
  if (currentIndex < 0) return HISTORY_MODE

  const step = direction < 0 ? -1 : 1
  const nextIndex = (currentIndex + step + SEARCH_MODES.length) % SEARCH_MODES.length
  return SEARCH_MODES[nextIndex]
}
