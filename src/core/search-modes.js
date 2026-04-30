export const SEARCH_MODES = Object.freeze(['recent', 'closed', 'deep'])
export const DEFAULT_SEARCH_MODE = 'recent'

/**
 * Ordered search corpus variants. Public cycling/enumeration order is recent -> closed -> deep.
 * @typedef {'recent'|'closed'|'deep'} SearchMode
 */

/**
 * @typedef {'idle'|'loading'|'ready'|'error'} ModeLoadStatus
 */

/**
 * @typedef {object} SearchModeState
 * @property {SearchMode} mode Mode this state belongs to.
 * @property {ModeLoadStatus} status Load status for this popup-session cache slot.
 * @property {import('./search.js').HistoryIndex | null} index In-memory index for the mode when ready.
 * @property {Error | null} error Last mode-local load error, if any.
 * @property {number | null} loadedAt Millisecond timestamp when index became ready.
 */

/**
 * @typedef {Object.<SearchMode, SearchModeState>} SearchModeCache
 */

/**
 * @typedef {object} ModeIndicatorModel
 * @property {string} label Compact visible badge label, for example "[recent]".
 * @property {SearchMode} mode Active mode.
 * @property {ModeLoadStatus} status Active mode load status.
 * @property {boolean} clickable Whether clicking should cycle to the next mode.
 * @property {string} modeSwitchHint Compact adjacent hint for changing modes, for example "Tab/Shift+Tab".
 * @property {string} statusText Accessible/status text for the active mode.
 */

/**
 * @typedef {object} HeaderSearchContextModel
 * @property {string} beforeMode Visible header text before the mode badge, normally "Search".
 * @property {string} modeBadgeLabel Bracketed clickable active-mode label, for example "[recent]".
 * @property {SearchMode} mode Active mode represented by the badge.
 * @property {string} afterMode Visible header text after the mode badge, normally "history".
 * @property {string} modeSwitchHint Hint shown on or immediately adjacent to the badge.
 * @property {number} realResultCount Count of visible real URL result rows, excluding synthetic action rows.
 * @property {string} realResultCountLabel Right-aligned human-readable result-count text.
 * @property {ModeLoadStatus} status Active mode load status.
 * @property {string} statusText Accessible/status text for the active mode.
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

export function searchHeaderModel(mode, state, { realResultCount = 0 } = {}) {
  throw new Error('not implemented: searchHeaderModel')
}

export function modeIndicatorModel(mode, state) {
  const activeMode = SEARCH_MODES.includes(mode) ? mode : DEFAULT_SEARCH_MODE
  const status = state?.status ?? 'idle'
  const entryCount = Array.isArray(state?.index?.entries) ? state.index.entries.length : 0
  const urlWord = entryCount === 1 ? 'URL' : 'URLs'
  const text = {
    recent: {
      idle: 'Recent history not loaded',
      loading: 'Loading recent history…',
      ready: `${entryCount} recent history ${urlWord}`,
      error: 'Recent history unavailable',
    },
    closed: {
      idle: 'Recently closed URLs not loaded',
      loading: 'Loading recently closed URLs…',
      ready: `${entryCount} recently closed ${urlWord}`,
      error: 'Recently closed URLs unavailable',
    },
    deep: {
      idle: 'Deep history not loaded',
      loading: 'Loading deep history…',
      ready: `${entryCount} deep history ${urlWord}`,
      error: 'Deep history unavailable',
    },
  }[activeMode]

  return {
    label: `[${activeMode}]`,
    mode: activeMode,
    status,
    clickable: true,
    modeSwitchHint: 'Tab/Shift+Tab',
    statusText: text[status] ?? text.idle,
  }
}
