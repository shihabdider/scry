export const HISTORY_CORPUS_ID = 'history'

/**
 * @typedef {'history'} HistoryCorpusId
 */

/**
 * @typedef {'idle'|'loading'|'ready'|'error'} HistoryCorpusStatus
 */

/**
 * The single popup-session history search corpus. It is backed by Chrome
 * history loaded with deep bounds (`startTime: 0`) and cached in memory only.
 * @typedef {object} HistoryCorpusState
 * @property {HistoryCorpusId} corpus Fixed single corpus identifier.
 * @property {HistoryCorpusStatus} status Load status for the popup-session history cache.
 * @property {import('./search.js').HistoryIndex | null} index In-memory history index when ready.
 * @property {Error | null} error Last history load error, if any.
 * @property {number | null} loadedAt Millisecond timestamp when the index became ready.
 */

/**
 * @typedef {object} HistorySearchSurfaceModel
 * @property {string} label Compact visible corpus label.
 * @property {HistoryCorpusId} corpus Single corpus represented by the surface.
 * @property {HistoryCorpusStatus} status Current corpus load status.
 * @property {boolean} clickable Always false; the single surface has no corpus cycling action.
 * @property {string} modeSwitchHint Always empty; Tab/Shift+Tab are not corpus-switch hints.
 * @property {string} statusText Accessible/status text for the history surface.
 */

/**
 * @typedef {object} HistorySearchHeaderModel
 * @property {string} beforeMode Visible header text before the corpus badge, normally "Search".
 * @property {string} modeBadgeLabel Plain active corpus label, normally "history".
 * @property {HistoryCorpusId} corpus Single corpus represented by the badge.
 * @property {string} afterMode Visible header text after the corpus badge, normally empty.
 * @property {string} modeSwitchHint Always empty; the header must not advertise switching.
 * @property {HistoryCorpusStatus} status Current corpus load status.
 * @property {string} statusText Right-aligned accessible/status text for the history surface.
 */

export function createHistoryCorpusState() {
  return {
    corpus: HISTORY_CORPUS_ID,
    status: 'idle',
    index: null,
    error: null,
    loadedAt: null,
  }
}

export function historyCorpusStatusText(state) {
  const status = state?.status ?? 'idle'
  const entryCount = Array.isArray(state?.index?.entries) ? state.index.entries.length : 0
  const urlWord = entryCount === 1 ? 'URL' : 'URLs'

  switch (status) {
    case 'loading':
      return 'Loading history…'
    case 'ready':
      return `${entryCount} history ${urlWord}`
    case 'error':
      return 'History unavailable'
    case 'idle':
    default:
      return 'History not loaded'
  }
}

export function historySearchSurfaceModel(state, { realResultCount = 0 } = {}) {
  void realResultCount
  const status = state?.status ?? 'idle'
  return {
    label: HISTORY_CORPUS_ID,
    corpus: HISTORY_CORPUS_ID,
    status,
    clickable: false,
    modeSwitchHint: '',
    statusText: historyCorpusStatusText(state),
  }
}

export function historySearchHeaderModel(state, { realResultCount = 0 } = {}) {
  void realResultCount
  const surface = historySearchSurfaceModel(state)
  return {
    beforeMode: 'Search',
    modeBadgeLabel: surface.label,
    corpus: surface.corpus,
    afterMode: '',
    modeSwitchHint: '',
    status: surface.status,
    statusText: surface.statusText,
  }
}
