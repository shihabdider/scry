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
  throw new Error('not implemented: cycleSearchMode')
}

export function modeIndicatorModel(mode, state) {
  throw new Error('not implemented: modeIndicatorModel')
}
