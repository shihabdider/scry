import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVisibleRows } from '../src/core/rows.js'
import { ScryPanelApp } from '../src/panel/app.js'
import { FAVORITES_STORAGE_KEY } from '../src/platform/favorites-store.js'
import { createScryDocument, dispatchKeydown } from './helpers/fake-dom.js'

const now = Date.parse('2026-04-27T00:00:00Z')

const exampleFavorite = {
  key: 'https://example.com/docs',
  url: 'https://example.com/docs',
  displayUrl: 'example.com/docs',
  title: 'Example docs',
  addedAt: 1_000,
  updatedAt: 1_000,
}

const olderFavorite = {
  key: 'https://older.example/docs',
  url: 'https://older.example/docs',
  displayUrl: 'older.example/docs',
  title: 'Older docs',
  addedAt: 500,
  updatedAt: 500,
}

const publicResult = {
  key: 'https://public.example/docs',
  url: 'https://public.example/docs',
  displayUrl: 'public.example/docs',
  title: 'Public docs',
  visitCount: 1,
  visitsLabel: '1 visit',
  lastVisitTime: now,
  lastVisitedLabel: 'now',
  urlHtml: 'public.example/docs',
  titleHtml: 'Public docs',
  debug: {},
}

function favoritesChrome(favoritesOrSlot = []) {
  let slot = Array.isArray(favoritesOrSlot)
    ? { [FAVORITES_STORAGE_KEY]: favoritesOrSlot }
    : favoritesOrSlot
  const getKeys = []
  const writes = []
  const chromeApi = {
    storage: {
      local: {
        async get(key) {
          getKeys.push(key)
          return slot
        },
        async set(value) {
          writes.push(value)
          slot = { ...slot, ...value }
        },
      },
    },
  }

  return { chromeApi, getKeys, writes, slot: () => slot }
}

function panelApp(chromeApi) {
  return new ScryPanelApp({
    document: createScryDocument(),
    chromeApi,
    clock: () => now,
    windowApi: { blur() {} },
  })
}

async function settleAsyncPanelAction() {
  await new Promise((resolve) => setImmediate(resolve))
}

test('ensureFavoritesModeReady creates a ready favorites state for empty storage', async () => {
  const storage = favoritesChrome([])
  const app = panelApp(storage.chromeApi)

  const state = await app.ensureFavoritesModeReady()

  assert.equal(app.searchMode, 'favorites')
  assert.equal(app.loading, false)
  assert.equal(state.mode, 'favorites')
  assert.equal(state.status, 'ready')
  assert.deepEqual(state.index.entries, [])
  assert.equal(app.modeCache.favorites, state)
  assert.equal(app.index, state.index)
  assert.deepEqual(storage.getKeys, [FAVORITES_STORAGE_KEY])
})

test('ensureFavoritesModeReady builds a searchable index for a stored singleton favorite', async () => {
  const storage = favoritesChrome([exampleFavorite])
  const app = panelApp(storage.chromeApi)

  const state = await app.ensureFavoritesModeReady()
  app.input.value = 'docs'
  app.updateResults()

  assert.equal(state.status, 'ready')
  assert.equal(state.loadedAt, now)
  assert.deepEqual(state.index.entries.map((entry) => entry.key), [exampleFavorite.key])
  assert.deepEqual(app.results.map((result) => result.url), [exampleFavorite.url])
})

test('ensureFavoritesModeReady stores storage failures under favorites without changing ready public caches', async () => {
  const error = new Error('storage unavailable')
  const historyState = {
    mode: 'history',
    status: 'ready',
    index: { builtAt: now, entries: [publicResult] },
    error: null,
    loadedAt: now,
  }
  const app = panelApp({
    storage: {
      local: {
        async get() {
          throw error
        },
      },
    },
  })
  app.searchCache.modes.history = historyState
  app.index = historyState.index

  const state = await app.ensureFavoritesModeReady()

  assert.equal(state.mode, 'favorites')
  assert.equal(state.status, 'error')
  assert.equal(state.error, error)
  assert.equal(state.index, null)
  assert.equal(app.modeCache.history, historyState)
  assert.equal(historyState.status, 'ready')
})

test('exitFavoritesModeToPreviousPublicMode restores previous history mode', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.previousPublicSearchMode = 'history'
  let switchedTo = null
  app.switchSearchMode = async (mode) => {
    switchedTo = mode
    return { mode, status: 'ready', index: null, error: null, loadedAt: now }
  }

  await app.exitFavoritesModeToPreviousPublicMode()

  assert.equal(switchedTo, 'history')
})

test('exitFavoritesModeToPreviousPublicMode restores previous closed mode', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.previousPublicSearchMode = 'closed'
  let switchedTo = null
  app.switchSearchMode = async (mode) => {
    switchedTo = mode
    return { mode, status: 'ready', index: null, error: null, loadedAt: now }
  }

  await app.exitFavoritesModeToPreviousPublicMode()

  assert.equal(switchedTo, 'closed')
})

test('exitFavoritesModeToPreviousPublicMode defaults an invalid previous mode to history', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.previousPublicSearchMode = 'favorites'
  let switchedTo = null
  app.switchSearchMode = async (mode) => {
    switchedTo = mode
    return { mode, status: 'ready', index: null, error: null, loadedAt: now }
  }

  await app.exitFavoritesModeToPreviousPublicMode()

  assert.equal(switchedTo, 'history')
})

test('enterFavoritesMode from history clears the command, remembers history, loads favorites, and shows all favorites', async () => {
  const storage = favoritesChrome([exampleFavorite, olderFavorite])
  const app = panelApp(storage.chromeApi)
  app.searchMode = 'history'
  app.input.value = ':f'
  app.selectedIndex = 4
  app.pageIndex = 2

  const state = await app.enterFavoritesMode()

  assert.equal(app.previousPublicSearchMode, 'history')
  assert.equal(app.input.value, '')
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.equal(app.searchMode, 'favorites')
  assert.equal(state.status, 'ready')
  assert.deepEqual(storage.getKeys, [FAVORITES_STORAGE_KEY])
  assert.deepEqual(app.results.map((result) => result.url), [exampleFavorite.url, olderFavorite.url])
  assert.equal(app.resultsList.childElementCount, 2)
})

test('enterFavoritesMode from closed remembers closed while clearing a full favorites command', async () => {
  const storage = favoritesChrome([exampleFavorite])
  const app = panelApp(storage.chromeApi)
  app.searchMode = 'closed'
  app.input.value = ':favorite'
  app.selectedIndex = 3
  app.pageIndex = 1

  await app.enterFavoritesMode()

  assert.equal(app.previousPublicSearchMode, 'closed')
  assert.equal(app.input.value, '')
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.equal(app.searchMode, 'favorites')
  assert.deepEqual(app.results.map((result) => result.url), [exampleFavorite.url])
})

test('enterFavoritesMode while already in favorites preserves the previous public mode', async () => {
  const storage = favoritesChrome([exampleFavorite])
  const app = panelApp(storage.chromeApi)
  app.searchMode = 'favorites'
  app.previousPublicSearchMode = 'closed'
  app.input.value = ':f'

  await app.enterFavoritesMode()

  assert.equal(app.previousPublicSearchMode, 'closed')
  assert.equal(app.input.value, '')
  assert.equal(app.searchMode, 'favorites')
  assert.deepEqual(app.results.map((result) => result.url), [exampleFavorite.url])
})

test('enterFavoritesMode with empty storage shows the empty favorites message with no result rows', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.searchMode = 'history'
  app.input.value = ':f'

  await app.enterFavoritesMode()

  assert.equal(app.searchMode, 'favorites')
  assert.deepEqual(app.results, [])
  assert.equal(app.resultsList.childElementCount, 0)
  assert.equal(app.message.hidden, false)
  assert.equal(app.message.textContent, 'No favorites saved yet.')
})

test('search input Enter routes the shortest :f command into hidden favorites mode', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.input.value = ':f'
  let flushCalls = 0
  let enterCalls = 0
  let openCalls = 0
  app.flushPendingInputResultsUpdate = () => {
    flushCalls++
    return false
  }
  app.enterFavoritesMode = async () => {
    enterCalls++
    app.input.value = ''
    app.searchMode = 'favorites'
  }
  app.openSelected = async () => {
    openCalls++
  }
  app.bindEvents()

  const event = dispatchKeydown(app.input, 'Enter')
  await Promise.resolve()

  assert.equal(event.defaultPrevented, true)
  assert.equal(flushCalls, 1)
  assert.equal(enterCalls, 1)
  assert.equal(openCalls, 0)
  assert.equal(app.searchMode, 'favorites')
  assert.equal(app.input.value, '')
})

test('handleSearchInputEnter routes the full :favorite command into hidden favorites mode', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.input.value = ' :favorite '
  let enterCalls = 0
  let openCalls = 0
  app.enterFavoritesMode = async () => {
    enterCalls++
    app.input.value = ''
    app.searchMode = 'favorites'
  }
  app.openSelected = async () => {
    openCalls++
  }

  await app.handleSearchInputEnter()

  assert.equal(enterCalls, 1)
  assert.equal(openCalls, 0)
  assert.equal(app.searchMode, 'favorites')
  assert.equal(app.input.value, '')
})

test('handleSearchInputEnter treats invalid :favorites as ordinary search text', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.input.value = ':favorites'
  let flushCalls = 0
  let enterCalls = 0
  let openArgs = null
  app.flushPendingInputResultsUpdate = () => {
    flushCalls++
    return false
  }
  app.enterFavoritesMode = async () => {
    enterCalls++
  }
  app.openSelected = async (args) => {
    openArgs = args
  }

  await app.handleSearchInputEnter()

  assert.equal(flushCalls, 1)
  assert.equal(enterCalls, 0)
  assert.deepEqual(openArgs, { newTab: true })
  assert.equal(app.input.value, ':favorites')
})

test('handleSearchInputEnter preserves ordinary selected-row open behavior', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.input.value = 'git issues'
  let flushCalls = 0
  let enterCalls = 0
  let openArgs = null
  app.flushPendingInputResultsUpdate = () => {
    flushCalls++
    return true
  }
  app.enterFavoritesMode = async () => {
    enterCalls++
  }
  app.openSelected = async (args) => {
    openArgs = args
  }

  await app.handleSearchInputEnter()

  assert.equal(flushCalls, 1)
  assert.equal(enterCalls, 0)
  assert.deepEqual(openArgs, { newTab: true })
})

test('handleFilterModeShortcut exits favorites to the previous public mode', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.searchMode = 'favorites'
  app.previousPublicSearchMode = 'closed'
  let switchedTo = null
  app.switchSearchMode = async (mode) => {
    switchedTo = mode
    app.searchMode = mode
  }

  await app.handleFilterModeShortcut()

  assert.equal(switchedTo, 'closed')
  assert.equal(app.searchMode, 'closed')
})

test('handleFilterModeShortcut cycles public history forward to closed', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.searchMode = 'history'
  let switchedTo = null
  app.switchSearchMode = async (mode) => {
    switchedTo = mode
    app.searchMode = mode
  }

  await app.handleFilterModeShortcut()

  assert.equal(switchedTo, 'closed')
  assert.equal(app.searchMode, 'closed')
})

test('handleFilterModeShortcut cycles public closed forward to history', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.searchMode = 'closed'
  let switchedTo = null
  app.switchSearchMode = async (mode) => {
    switchedTo = mode
    app.searchMode = mode
  }

  await app.handleFilterModeShortcut()

  assert.equal(switchedTo, 'history')
  assert.equal(app.searchMode, 'history')
})

test('handleFilterModeShortcut can cycle public history backward to closed', async () => {
  const app = panelApp(favoritesChrome([]).chromeApi)
  app.searchMode = 'history'
  let switchedTo = null
  app.switchSearchMode = async (mode) => {
    switchedTo = mode
    app.searchMode = mode
  }

  await app.handleFilterModeShortcut({ direction: -1 })

  assert.equal(switchedTo, 'closed')
  assert.equal(app.searchMode, 'closed')
})

test('favorites search focus hides row-local x/u hints while keeping Ctrl row actions visible', async () => {
  const storage = favoritesChrome([exampleFavorite])
  const app = panelApp(storage.chromeApi)
  await app.ensureFavoritesModeReady()
  app.updateResults()
  app.selectedIndex = 0
  app.favoriteRemovalUndo = { favorite: olderFavorite, index: 1 }
  app.focusMode = 'search'

  app.renderResults()
  const searchHtml = app.resultsList.children[0].children[0].innerHTML

  assert.match(searchHtml, /Ctrl\+Y copy/)
  assert.match(searchHtml, /Ctrl\+E edit URL/)
  assert.doesNotMatch(searchHtml, /x remove/)
  assert.doesNotMatch(searchHtml, /u undo/)

  app.focusMode = 'results'
  app.renderResults()
  const resultHtml = app.resultsList.children[0].children[0].innerHTML

  assert.match(resultHtml, /x remove/)
  assert.match(resultHtml, /u undo/)
})

test('typing x in the favorites search input is not intercepted as a remove command', async () => {
  const storage = favoritesChrome([exampleFavorite])
  const app = panelApp(storage.chromeApi)
  app.bindEvents()
  await app.ensureFavoritesModeReady()
  app.updateResults()
  app.selectedIndex = 0
  app.input.focus()

  const event = dispatchKeydown(app.input, 'x')

  assert.equal(event.defaultPrevented, false)
  assert.deepEqual(storage.writes, [])
  assert.equal(app.favoriteRemovalUndo, null)
  assert.equal(app.searchMode, 'favorites')
})

test('removeSelectedFavorite removes a selected favorite, remembers one undo, and refreshes results', async () => {
  const storage = favoritesChrome([exampleFavorite, olderFavorite])
  const app = panelApp(storage.chromeApi)
  await app.ensureFavoritesModeReady()
  app.updateResults()
  app.selectedIndex = 0

  await app.removeSelectedFavorite()

  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [olderFavorite] }])
  assert.deepEqual(app.favoriteRemovalUndo, { favorite: exampleFavorite, index: 0 })
  assert.deepEqual(app.modeCache.favorites.index.entries.map((entry) => entry.key), [olderFavorite.key])
  assert.deepEqual(app.results.map((result) => result.url), [olderFavorite.url])
})

test('removeSelectedFavorite removing the last favorite shows undo feedback in the message area', async () => {
  const storage = favoritesChrome([exampleFavorite])
  const app = panelApp(storage.chromeApi)
  await app.ensureFavoritesModeReady()
  app.updateResults()
  app.selectedIndex = 0

  await app.removeSelectedFavorite()

  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [] }])
  assert.deepEqual(app.favoriteRemovalUndo, { favorite: exampleFavorite, index: 0 })
  assert.deepEqual(app.results, [])
  assert.equal(app.resultsList.childElementCount, 0)
  assert.equal(app.message.hidden, false)
  assert.equal(app.message.textContent, 'Removed favorite — u undo')
})

test('favorites undo key restores the last removed favorite and clears removal feedback', async () => {
  const storage = favoritesChrome([exampleFavorite])
  const app = panelApp(storage.chromeApi)
  app.bindEvents()
  await app.ensureFavoritesModeReady()
  app.updateResults()
  app.selectedIndex = 0
  app.focusResults()
  await app.removeSelectedFavorite()

  const event = dispatchKeydown(app.resultsList, 'u')
  await settleAsyncPanelAction()

  assert.equal(event.defaultPrevented, true)
  assert.equal(app.favoriteRemovalUndo, null)
  assert.deepEqual(storage.writes, [
    { [FAVORITES_STORAGE_KEY]: [] },
    { [FAVORITES_STORAGE_KEY]: [exampleFavorite] },
  ])
  assert.deepEqual(app.results.map((result) => result.url), [exampleFavorite.url])
  assert.equal(app.resultsList.childElementCount, 1)
  assert.equal(app.message.hidden, true)
})

test('removeSelectedFavorite leaves storage and undo unchanged when no selected result row exists', async () => {
  const storage = favoritesChrome([exampleFavorite])
  const app = panelApp(storage.chromeApi)
  const previousUndo = { favorite: olderFavorite, index: 0 }
  app.searchMode = 'favorites'
  app.favoriteRemovalUndo = previousUndo
  app.results = []
  app.visibleRows = []
  app.selectedIndex = 0

  await app.removeSelectedFavorite()

  assert.deepEqual(storage.writes, [])
  assert.equal(app.favoriteRemovalUndo, previousUndo)
})

test('removeSelectedFavorite is a no-op outside favorites mode', async () => {
  const storage = favoritesChrome([exampleFavorite])
  const app = panelApp(storage.chromeApi)
  const previousUndo = { favorite: olderFavorite, index: 0 }
  app.searchMode = 'history'
  app.favoriteRemovalUndo = previousUndo
  app.results = [publicResult]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 0

  await app.removeSelectedFavorite()

  assert.deepEqual(storage.writes, [])
  assert.equal(app.favoriteRemovalUndo, previousUndo)
  assert.deepEqual(app.results, [publicResult])
})

test('undoLastFavoriteRemoval restores a present undo, consumes it, and refreshes results', async () => {
  const storage = favoritesChrome([olderFavorite])
  const app = panelApp(storage.chromeApi)
  await app.ensureFavoritesModeReady()
  app.updateResults()
  app.favoriteRemovalUndo = { favorite: exampleFavorite, index: 0 }

  await app.undoLastFavoriteRemoval()

  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [exampleFavorite, olderFavorite] }])
  assert.equal(app.favoriteRemovalUndo, null)
  assert.deepEqual(app.modeCache.favorites.index.entries.map((entry) => entry.key), [exampleFavorite.key, olderFavorite.key])
  assert.deepEqual(app.results.map((result) => result.url), [exampleFavorite.url, olderFavorite.url])
})

test('undoLastFavoriteRemoval leaves storage and visible rows unchanged when undo is absent', async () => {
  const storage = favoritesChrome([exampleFavorite])
  const app = panelApp(storage.chromeApi)
  const visibleRows = buildVisibleRows({ corpusResults: [publicResult] })
  app.searchMode = 'favorites'
  app.favoriteRemovalUndo = null
  app.visibleRows = visibleRows

  await app.undoLastFavoriteRemoval()

  assert.deepEqual(storage.writes, [])
  assert.equal(app.visibleRows, visibleRows)
})

test('undoLastFavoriteRemoval consumes no undo outside favorites mode', async () => {
  const storage = favoritesChrome([olderFavorite])
  const app = panelApp(storage.chromeApi)
  const previousUndo = { favorite: exampleFavorite, index: 0 }
  app.searchMode = 'history'
  app.favoriteRemovalUndo = previousUndo

  await app.undoLastFavoriteRemoval()

  assert.deepEqual(storage.writes, [])
  assert.equal(app.favoriteRemovalUndo, previousUndo)
})
