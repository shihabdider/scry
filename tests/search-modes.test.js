import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CLOSED_MODE,
  createPopupSessionSearchCache,
  createSearchModeState,
  HISTORY_MODE,
  nextSearchMode,
  SEARCH_MODES,
  searchModeStatusText,
  searchSearchHeaderModel,
  searchSearchSurfaceModel,
} from '../src/core/search-modes.js'

test('createSearchModeState initializes an idle popup-session search corpus', () => {
  assert.deepEqual(createSearchModeState(HISTORY_MODE), {
    mode: HISTORY_MODE,
    status: 'idle',
    index: null,
    error: null,
    loadedAt: null,
    loadingPromise: null,
  })
})

test('createPopupSessionSearchCache initializes exactly history and closed popup-session corpora', () => {
  assert.deepEqual(SEARCH_MODES, [HISTORY_MODE, CLOSED_MODE])
  assert.deepEqual(createPopupSessionSearchCache(), {
    activeMode: HISTORY_MODE,
    modes: {
      history: createSearchModeState(HISTORY_MODE),
      closed: createSearchModeState(CLOSED_MODE),
    },
  })
})

test('searchModeStatusText describes history cache status and ready entry counts', () => {
  assert.equal(searchModeStatusText(null), 'History not loaded')
  assert.equal(searchModeStatusText(createSearchModeState(HISTORY_MODE)), 'History not loaded')
  assert.equal(searchModeStatusText({ ...createSearchModeState(HISTORY_MODE), status: 'loading' }), 'Loading history…')
  assert.equal(
    searchModeStatusText({ ...createSearchModeState(HISTORY_MODE), status: 'ready', index: { builtAt: 100, entries: [] } }),
    '0 history URLs',
  )
  assert.equal(
    searchModeStatusText({ ...createSearchModeState(HISTORY_MODE), status: 'ready', index: { builtAt: 100, entries: [{}] } }),
    '1 history URL',
  )
  assert.equal(
    searchModeStatusText({ ...createSearchModeState(HISTORY_MODE), status: 'ready', index: { builtAt: 100, entries: [{}, {}] } }),
    '2 history URLs',
  )
  assert.equal(searchModeStatusText({ ...createSearchModeState(HISTORY_MODE), status: 'error' }), 'History unavailable')
})

test('searchModeStatusText describes recently closed cache status and ready entry counts', () => {
  assert.equal(searchModeStatusText(createSearchModeState(CLOSED_MODE)), 'Recently closed URLs not loaded')
  assert.equal(searchModeStatusText({ ...createSearchModeState(CLOSED_MODE), status: 'loading' }), 'Loading recently closed URLs…')
  assert.equal(
    searchModeStatusText({ ...createSearchModeState(CLOSED_MODE), status: 'ready', index: { builtAt: 100, entries: [] } }),
    '0 recently closed URLs',
  )
  assert.equal(
    searchModeStatusText({ ...createSearchModeState(CLOSED_MODE), status: 'ready', index: { builtAt: 100, entries: [{}] } }),
    '1 recently closed URL',
  )
  assert.equal(
    searchModeStatusText({ ...createSearchModeState(CLOSED_MODE), status: 'ready', index: { builtAt: 100, entries: [{}, {}] } }),
    '2 recently closed URLs',
  )
  assert.equal(searchModeStatusText({ ...createSearchModeState(CLOSED_MODE), status: 'error' }), 'Recently closed URLs unavailable')
})

test('searchSearchSurfaceModel describes the active popup-session corpus badge', () => {
  const cache = createPopupSessionSearchCache({ activeMode: CLOSED_MODE })
  cache.modes.closed = {
    ...createSearchModeState(CLOSED_MODE),
    status: 'ready',
    index: { builtAt: 100, entries: [{}, {}] },
    loadedAt: 100,
  }

  assert.deepEqual(searchSearchSurfaceModel(cache), {
    label: CLOSED_MODE,
    mode: CLOSED_MODE,
    status: 'ready',
    clickable: true,
    modeSwitchHint: 'Tab / Shift+Tab',
    statusText: '2 recently closed URLs',
  })
})

test('searchSearchSurfaceModel defaults invalid cache input to an idle history badge', () => {
  assert.deepEqual(searchSearchSurfaceModel(null), {
    label: HISTORY_MODE,
    mode: HISTORY_MODE,
    status: 'idle',
    clickable: true,
    modeSwitchHint: 'Tab / Shift+Tab',
    statusText: 'History not loaded',
  })
  assert.deepEqual(searchSearchSurfaceModel({ activeMode: 'recent', modes: {} }), {
    label: HISTORY_MODE,
    mode: HISTORY_MODE,
    status: 'idle',
    clickable: true,
    modeSwitchHint: 'Tab / Shift+Tab',
    statusText: 'History not loaded',
  })
})

test('searchSearchHeaderModel describes the active popup-session corpus header', () => {
  const cache = createPopupSessionSearchCache({ activeMode: HISTORY_MODE })
  cache.modes.history = {
    ...createSearchModeState(HISTORY_MODE),
    status: 'ready',
    index: { builtAt: 100, entries: [{}] },
    loadedAt: 100,
  }

  assert.deepEqual(searchSearchHeaderModel(cache), {
    beforeMode: 'Search',
    modeBadgeLabel: HISTORY_MODE,
    mode: HISTORY_MODE,
    afterMode: '',
    modeSwitchHint: 'Tab / Shift+Tab',
    status: 'ready',
    statusText: '1 history URL',
  })
})

test('nextSearchMode defaults to cycling forward from history to closed', () => {
  assert.equal(nextSearchMode(HISTORY_MODE), CLOSED_MODE)
})

test('nextSearchMode cycles forward between only history and closed', () => {
  assert.equal(nextSearchMode(HISTORY_MODE, 1), CLOSED_MODE)
  assert.equal(nextSearchMode(CLOSED_MODE, 1), HISTORY_MODE)
})

test('nextSearchMode supports Shift+Tab/backward cycling between only history and closed', () => {
  assert.equal(nextSearchMode(HISTORY_MODE, -1), CLOSED_MODE)
  assert.equal(nextSearchMode(CLOSED_MODE, -1), HISTORY_MODE)
})

test('nextSearchMode normalizes unknown legacy modes back to history', () => {
  assert.equal(nextSearchMode('recent', 1), HISTORY_MODE)
  assert.equal(nextSearchMode('deep', -1), HISTORY_MODE)
})
