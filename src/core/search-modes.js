export const SEARCH_MODES = Object.freeze(['recent', 'deep', 'closed'])
export const DEFAULT_SEARCH_MODE = 'recent'

/**
 * @typedef {'recent'|'deep'|'closed'} SearchMode
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
 * @property {string} label Compact visible label, for example "mode: recent".
 * @property {SearchMode} mode Active mode.
 * @property {ModeLoadStatus} status Active mode load status.
 * @property {boolean} clickable Whether clicking should cycle to the next mode.
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
    deep: {
      idle: 'Deep history not loaded',
      loading: 'Loading deep history…',
      ready: `${entryCount} deep history ${urlWord}`,
      error: 'Deep history unavailable',
    },
    closed: {
      idle: 'Recently closed URLs not loaded',
      loading: 'Loading recently closed URLs…',
      ready: `${entryCount} recently closed ${urlWord}`,
      error: 'Recently closed URLs unavailable',
    },
  }[activeMode]

  return {
    label: `mode: ${activeMode}`,
    mode: activeMode,
    status,
    clickable: true,
    statusText: text[status] ?? text.idle,
  }
}
