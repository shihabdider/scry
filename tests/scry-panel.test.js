import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVisibleRows } from '../src/core/rows.js'
import { buildHistoryIndex } from '../src/core/search.js'
import { ScryPanelApp } from '../src/panel/app.js'
import { SELECTION_STORAGE_KEY } from '../src/platform/selection-store.js'
import { createScryDocument, dispatchInput, dispatchKeydown } from './helpers/fake-dom.js'

const now = Date.parse('2026-04-27T00:00:00Z')

function createPanelChrome(historyEntries) {
  return {
    history: {
      async search() {
        return historyEntries
      },
    },
    storage: {
      local: {
        async get() {
          return {}
        },
        async set() {},
      },
    },
    tabs: {
      opened: [],
      updated: [],
      async query() {
        return [{ id: 101, windowId: 7 }]
      },
      async update(id, change) {
        this.updated.push({ id, change })
      },
      async create(change) {
        this.opened.push(change)
      },
    },
    runtime: {},
  }
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function historyEntry(index) {
  return {
    url: `https://github.com/shihabdider/scry/issues/${index}`,
    title: `Scry issue ${index}`,
    visitCount: index,
    lastVisitTime: now - index * 1_000,
  }
}

function searchResult(name) {
  return {
    key: `https://example.com/${name}`,
    url: `https://example.com/${name}?tab=readme`,
    displayUrl: `example.com/${name}?tab=readme`,
    title: `${name} docs`,
    visitCount: 3,
    visitsLabel: '3 visits',
    lastVisitTime: now,
    lastVisitedLabel: 'now',
    urlHtml: `example.com/${name}?tab=readme`,
    titleHtml: `${name} docs`,
    debug: {},
  }
}

function createClipboardNavigator(writes) {
  return {
    clipboard: {
      async writeText(text) {
        writes.push(text)
      },
    },
  }
}

test('updateVisibleRows pins a typed URL candidate above corpus results and selection follows visible row order', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const firstResult = searchResult('first')
  const secondResult = searchResult('second')
  app.input.value = 'typed.example/path'
  app.results = [firstResult, secondResult]
  app.copiedFeedback = { key: 'open-typed-url:https://typed.example/path', expiresAt: 9_999_999_999_999 }

  app.updateVisibleRows()

  assert.deepEqual(app.visibleRows, [
    {
      kind: 'open-typed-url',
      key: 'open-typed-url:https://typed.example/path',
      candidate: {
        displayInput: 'typed.example/path',
        normalizedUrl: 'https://typed.example/path',
        key: 'https://typed.example/path',
      },
      copied: true,
    },
    {
      kind: 'result',
      key: 'result:https://example.com/first',
      result: firstResult,
      copied: false,
    },
    {
      kind: 'result',
      key: 'result:https://example.com/second',
      result: secondResult,
      copied: false,
    },
  ])

  app.selectedIndex = 0
  assert.equal(app.selectedVisibleRow(), app.visibleRows[0])
  app.selectedIndex = 1
  assert.equal(app.selectedVisibleRow(), app.visibleRows[1])
  app.selectedIndex = 2
  assert.equal(app.selectedVisibleRow(), app.visibleRows[2])
})

test('updateVisibleRows keeps non-URL search queries as corpus result rows with copied feedback', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const firstResult = searchResult('first')
  const secondResult = searchResult('second')
  app.input.value = 'typed example docs'
  app.results = [firstResult, secondResult]
  app.copiedFeedback = { key: 'result:https://example.com/second', expiresAt: 9_999_999_999_999 }

  app.updateVisibleRows()

  assert.deepEqual(app.visibleRows, [
    {
      kind: 'result',
      key: 'result:https://example.com/first',
      result: firstResult,
      copied: false,
    },
    {
      kind: 'result',
      key: 'result:https://example.com/second',
      result: secondResult,
      copied: true,
    },
  ])
})

test('updateVisibleRows exposes a typed URL row when a URL-like query has no corpus results', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.input.value = 'https://typed.example/path#fragment'
  app.results = []

  app.updateVisibleRows()

  assert.deepEqual(app.visibleRows, [
    {
      kind: 'open-typed-url',
      key: 'open-typed-url:https://typed.example/path',
      candidate: {
        displayInput: 'typed.example/path',
        normalizedUrl: 'https://typed.example/path',
        key: 'https://typed.example/path',
      },
      copied: false,
    },
  ])
})

test('selectedVisibleRow returns the selected synthetic or real row in visible row order', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const firstResult = searchResult('first')
  const secondResult = searchResult('second')
  const visibleRows = buildVisibleRows({ corpusResults: [firstResult, secondResult], typedUrlCandidate })
  app.results = [firstResult, secondResult]
  app.visibleRows = visibleRows

  app.selectedIndex = 0
  assert.equal(app.selectedVisibleRow(), visibleRows[0])

  app.selectedIndex = 1
  assert.equal(app.selectedVisibleRow(), visibleRows[1])

  app.selectedIndex = 2
  assert.equal(app.selectedVisibleRow(), visibleRows[2])
})

test('pageCount counts visible real result rows and ignores a pinned typed URL row at the page boundary', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 6 }, (_, index) => searchResult(`page-boundary-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })

  assert.equal(app.pageCount(), 1)
})

test('pageCount computes multiple pages from visible real result rows', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 7 }, (_, index) => searchResult(`visible-page-${index + 1}`))
  app.results = []
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })

  assert.equal(app.pageCount(), 2)
})

test('pageStart ignores a pinned typed URL row when computing the real result page offset', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 7 }, (_, index) => searchResult(`page-start-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })

  app.pageIndex = 0
  assert.equal(app.pageStart(), 0)

  app.pageIndex = 1
  assert.equal(app.pageStart(), 6)
})

test('pageStart falls back to legacy real result indexing when visible rows are not populated yet', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.results = Array.from({ length: 7 }, (_, index) => searchResult(`legacy-start-${index + 1}`))
  app.visibleRows = []

  app.pageIndex = 0
  assert.equal(app.pageStart(), 0)

  app.pageIndex = 1
  assert.equal(app.pageStart(), 6)
})

test('pageStart clamps invalid page indexes to real result page bounds', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 7 }, (_, index) => searchResult(`bounded-start-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })

  app.pageIndex = -1
  assert.equal(app.pageStart(), 0)

  app.pageIndex = 99
  assert.equal(app.pageStart(), 6)

  app.results = []
  app.visibleRows = buildVisibleRows({ corpusResults: [], typedUrlCandidate })
  assert.equal(app.pageStart(), 0)
})

test('pageCount falls back to legacy results and keeps a one-page minimum', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.results = Array.from({ length: 7 }, (_, index) => searchResult(`legacy-page-${index + 1}`))
  app.visibleRows = []

  assert.equal(app.pageCount(), 2)

  app.results = []

  assert.equal(app.pageCount(), 1)
})

test('clampPageIndex clamps to real corpus result pages and ignores a pinned typed URL row', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 7 }, (_, index) => searchResult(`clamped-page-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })

  app.pageIndex = 99
  app.clampPageIndex()
  assert.equal(app.pageIndex, 1)

  app.pageIndex = -4
  app.clampPageIndex()
  assert.equal(app.pageIndex, 0)

  app.results = corpusResults.slice(0, 6)
  app.visibleRows = buildVisibleRows({ corpusResults: app.results, typedUrlCandidate })
  app.pageIndex = 1
  app.clampPageIndex()
  assert.equal(app.pageIndex, 0)
})

test('clampPageIndex preserves one-page minimum when only a synthetic typed URL row is visible', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  app.results = []
  app.visibleRows = buildVisibleRows({ corpusResults: [], typedUrlCandidate })

  app.pageIndex = 42
  app.clampPageIndex()

  assert.equal(app.pageIndex, 0)
  assert.equal(app.pageCount(), 1)
})

test('clampPageIndex normalizes invalid numeric page indexes consistently with pageStart', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const corpusResults = Array.from({ length: 13 }, (_, index) => searchResult(`normalized-page-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults })

  app.pageIndex = 1.75
  app.clampPageIndex()
  assert.equal(app.pageIndex, 1)
  assert.equal(app.pageStart(), 6)

  app.pageIndex = Number.NaN
  app.clampPageIndex()
  assert.equal(app.pageIndex, 0)
  assert.equal(app.pageStart(), 0)
})

// Compatibility: callers can use selectedVisibleRow before updateVisibleRows is wired in.
test('selectedVisibleRow wraps legacy result state when visible rows are not populated yet', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const firstResult = searchResult('first')
  const secondResult = searchResult('second')
  app.results = [firstResult, secondResult]
  app.visibleRows = []
  app.selectedIndex = 1

  assert.deepEqual(app.selectedVisibleRow(), {
    kind: 'result',
    key: 'result:https://example.com/second',
    result: secondResult,
    copied: false,
  })
})

test('updateResults searches the active cached mode index and rebuilds visible rows without changing mode or query', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  const recentIndex = buildHistoryIndex([historyEntry(1)], { now })
  const closedIndex = buildHistoryIndex([
    {
      url: 'https://closed.example/match',
      title: 'Closed tab match',
      visitCount: 1,
      lastVisitTime: now,
    },
  ], { now })
  app.modeCache = {
    recent: { mode: 'recent', status: 'ready', index: recentIndex, error: null, loadedAt: now },
    deep: { mode: 'deep', status: 'idle', index: null, error: null, loadedAt: null },
    closed: { mode: 'closed', status: 'ready', index: closedIndex, error: null, loadedAt: now },
  }
  app.searchMode = 'closed'
  app.deep = false
  app.index = recentIndex
  input.value = 'closed match'
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  app.updateResults()

  assert.equal(app.searchMode, 'closed')
  assert.equal(app.deep, false)
  assert.equal(input.value, 'closed match')
  assert.equal(app.index, closedIndex)
  assert.equal(app.results.length, 1)
  assert.equal(app.results[0].url, 'https://closed.example/match')
  assert.equal(app.visibleRows.length, 1)
  assert.equal(app.visibleRows[0].kind, 'result')
  assert.equal(app.visibleRows[0].result, app.results[0])
  assert.equal(renderCalls, 1)
})

test('updateResults safely renders an active mode with no index and keeps URL-like input as a typed row', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  const staleIndex = buildHistoryIndex([
    {
      url: 'https://typed.example/path',
      title: 'Stale recent typed URL',
      visitCount: 5,
      lastVisitTime: now,
    },
  ], { now })
  app.modeCache = {
    recent: { mode: 'recent', status: 'ready', index: staleIndex, error: null, loadedAt: now },
    deep: { mode: 'deep', status: 'idle', index: null, error: null, loadedAt: null },
    closed: { mode: 'closed', status: 'error', index: null, error: new Error('sessions unavailable'), loadedAt: null },
  }
  app.searchMode = 'closed'
  app.index = staleIndex
  app.results = [searchResult('stale')]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  input.value = 'typed.example/path#fragment'
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  app.updateResults()

  assert.equal(app.searchMode, 'closed')
  assert.equal(input.value, 'typed.example/path#fragment')
  assert.equal(app.index, null)
  assert.deepEqual(app.results, [])
  assert.equal(app.visibleRows.length, 1)
  assert.equal(app.visibleRows[0].kind, 'open-typed-url')
  assert.deepEqual(app.visibleRows[0].candidate, {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  })
  assert.equal(renderCalls, 1)
})

test('updateResults preserves legacy recent search behavior when only the current index exists', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  app.index = buildHistoryIndex([historyEntry(1), historyEntry(2)], { now })
  app.modeCache = null
  input.value = 'issue 2'
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  app.updateResults()

  assert.equal(app.searchMode, 'recent')
  assert.equal(input.value, 'issue 2')
  assert.equal(app.results[0].url, 'https://github.com/shihabdider/scry/issues/2')
  assert.equal(app.visibleRows.length, app.results.length)
  assert.equal(app.visibleRows[0].kind, 'result')
  assert.equal(app.visibleRows[0].result, app.results[0])
  assert.equal(renderCalls, 1)
})

test('selectedVisibleRow returns null when no visible row is selected', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const onlyResult = searchResult('only')
  app.visibleRows = buildVisibleRows({ corpusResults: [onlyResult] })

  app.selectedIndex = -1
  assert.equal(app.selectedVisibleRow(), null)

  app.selectedIndex = 1
  assert.equal(app.selectedVisibleRow(), null)

  app.visibleRows = []
  app.results = []
  app.selectedIndex = 0
  assert.equal(app.selectedVisibleRow(), null)
})

test('copySelectedRow copies a selected real result URL, marks copied feedback, then expires it without changing focus', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const writes = []
  const scheduledTimers = []
  const windowApi = {
    closeCalls: 0,
    blurCalls: 0,
    setTimeout(callback, delay) {
      scheduledTimers.push({ callback, delay })
      return { unref() {} }
    },
    close() {
      this.closeCalls++
    },
    blur() {
      this.blurCalls++
    },
  }
  const app = new ScryPanelApp({
    document,
    chromeApi,
    clock: () => now,
    windowApi,
    navigatorApi: createClipboardNavigator(writes),
  })
  const firstResult = searchResult('first')
  const secondResult = searchResult('second')
  app.results = [firstResult, secondResult]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 1
  app.focusMode = 'results'
  const activeElement = document.createElement('button')
  document.activeElement = activeElement
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
    app.updateVisibleRows()
  }

  await app.copySelectedRow()

  assert.deepEqual(writes, ['https://example.com/second?tab=readme'])
  assert.deepEqual(app.copiedFeedback, {
    key: 'result:https://example.com/second',
    expiresAt: now + 1_200,
  })
  assert.equal(app.visibleRows[1].copied, true)
  assert.equal(scheduledTimers.length, 1)
  assert.equal(scheduledTimers[0].delay, 1_200)
  assert.equal(renderCalls, 1)
  assert.equal(app.focusMode, 'results')
  assert.equal(document.activeElement, activeElement)
  assert.equal(windowApi.closeCalls, 0)
  assert.equal(windowApi.blurCalls, 0)

  scheduledTimers[0].callback()

  assert.equal(app.copiedFeedback, null)
  assert.equal(app.visibleRows[1].copied, false)
  assert.equal(renderCalls, 2)
  assert.equal(app.focusMode, 'results')
  assert.equal(document.activeElement, activeElement)
  assert.equal(windowApi.closeCalls, 0)
  assert.equal(windowApi.blurCalls, 0)
})

test('copySelectedRow copies the selected synthetic typed URL row normalized URL', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const writes = []
  const scheduledTimers = []
  const app = new ScryPanelApp({
    document,
    chromeApi,
    clock: () => now,
    windowApi: {
      setTimeout(callback, delay) {
        scheduledTimers.push({ callback, delay })
        return { unref() {} }
      },
      blur() {},
    },
    navigatorApi: createClipboardNavigator(writes),
  })
  app.input.value = 'typed.example/path#fragment'
  app.results = [searchResult('visited')]
  app.updateVisibleRows()
  app.selectedIndex = 0
  app.focusMode = 'search'
  const activeElement = app.input
  document.activeElement = activeElement
  app.renderResults = () => {
    app.updateVisibleRows()
  }

  await app.copySelectedRow()

  assert.deepEqual(writes, ['https://typed.example/path'])
  assert.deepEqual(app.copiedFeedback, {
    key: 'open-typed-url:https://typed.example/path',
    expiresAt: now + 1_200,
  })
  assert.equal(app.visibleRows[0].kind, 'open-typed-url')
  assert.equal(app.visibleRows[0].copied, true)
  assert.equal(scheduledTimers.length, 1)
  assert.equal(scheduledTimers[0].delay, 1_200)
  assert.equal(app.focusMode, 'search')
  assert.equal(document.activeElement, activeElement)
})

test('copySelectedRow is a no-op when no selected row has a copyable URL', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const writes = []
  const scheduledTimers = []
  const app = new ScryPanelApp({
    document,
    chromeApi,
    clock: () => now,
    windowApi: {
      setTimeout(callback, delay) {
        scheduledTimers.push({ callback, delay })
      },
      blur() {},
    },
    navigatorApi: createClipboardNavigator(writes),
  })
  app.visibleRows = []
  app.results = []
  app.selectedIndex = 0
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  await app.copySelectedRow()

  assert.deepEqual(writes, [])
  assert.equal(app.copiedFeedback, null)
  assert.equal(scheduledTimers.length, 0)
  assert.equal(renderCalls, 0)
})

test('openSelected opens the selected synthetic typed URL row without recording selection learning', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const selectionWrites = []
  chromeApi.storage.local.set = async (value) => {
    selectionWrites.push(value)
  }
  const windowApi = {
    closeCalls: 0,
    close() {
      this.closeCalls++
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi })
  const existingSelectionData = {
    version: 1,
    aggregates: {
      docs: {
        'https://example.com/visited': {
          count: 1,
          lastSelectedAt: now - 1,
          selectedAt: [now - 1],
        },
      },
    },
  }
  app.selectionData = existingSelectionData
  app.input.value = 'typed.example/path#fragment'
  app.results = [searchResult('visited')]
  app.updateVisibleRows()
  app.selectedIndex = 0
  let updateCalls = 0
  app.updateResults = () => {
    updateCalls++
  }

  await app.openSelected({ newTab: false })

  assert.deepEqual(chromeApi.tabs.updated, [
    { id: 101, change: { url: 'https://typed.example/path' } },
  ])
  assert.deepEqual(chromeApi.tabs.opened, [])
  assert.equal(app.selectionData, existingSelectionData)
  assert.deepEqual(selectionWrites, [])
  assert.equal(updateCalls, 0)
  assert.equal(windowApi.closeCalls, 1)
})

test('openSelected opens a real visible row in a new tab and records parsed unquoted selection learning', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const selectionWrites = []
  chromeApi.storage.local.set = async (value) => {
    selectionWrites.push(value)
  }
  const windowApi = {
    closeCalls: 0,
    close() {
      this.closeCalls++
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi })
  const docsResult = searchResult('docs')
  app.input.value = 'docs "Exact Phrase" install'
  app.results = [docsResult]
  app.visibleRows = buildVisibleRows({
    corpusResults: app.results,
    typedUrlCandidate: {
      displayInput: 'typed.example/path',
      normalizedUrl: 'https://typed.example/path',
      key: 'https://typed.example/path',
    },
  })
  app.selectedIndex = 1
  let updateCalls = 0
  app.updateResults = () => {
    updateCalls++
  }

  await app.openSelected({ newTab: true })

  const expectedSelectionData = {
    version: 1,
    aggregates: {
      'docs install': {
        [docsResult.key]: {
          count: 1,
          lastSelectedAt: now,
          selectedAt: [now],
        },
      },
    },
  }
  assert.deepEqual(chromeApi.tabs.opened, [
    { url: 'https://example.com/docs?tab=readme', active: true },
  ])
  assert.deepEqual(chromeApi.tabs.updated, [])
  assert.deepEqual(app.selectionData, expectedSelectionData)
  assert.deepEqual(selectionWrites, [{ [SELECTION_STORAGE_KEY]: expectedSelectionData }])
  assert.equal(updateCalls, 1)
  assert.equal(windowApi.closeCalls, 1)
})

test('openSelected is a no-op when no visible row is selected', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const selectionWrites = []
  chromeApi.storage.local.set = async (value) => {
    selectionWrites.push(value)
  }
  const windowApi = {
    closeCalls: 0,
    close() {
      this.closeCalls++
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi })
  app.results = []
  app.visibleRows = []
  app.selectedIndex = 0

  await app.openSelected({ newTab: true })

  assert.deepEqual(chromeApi.tabs.opened, [])
  assert.deepEqual(chromeApi.tabs.updated, [])
  assert.deepEqual(selectionWrites, [])
  assert.equal(windowApi.closeCalls, 0)
})

test('changeSelectedRowToSearch edits the search box to the selected real result display URL and refreshes immediately', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  const firstResult = searchResult('first')
  const docsResult = {
    ...searchResult('docs'),
    url: 'https://example.com/docs?tab=readme#install',
    displayUrl: 'example.com/docs?tab=readme',
    urlHtml: 'example.com/docs?tab=readme',
  }
  app.results = [firstResult, docsResult]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 1
  input.value = 'docs install'
  input.setSelectionRange(0, 0)
  app.focusMode = 'results'
  let refreshCalls = 0
  let refreshedQuery = null
  app.updateResults = () => {
    refreshCalls++
    refreshedQuery = input.value
  }

  app.changeSelectedRowToSearch()

  assert.equal(input.value, 'example.com/docs?tab=readme')
  assert.equal(refreshCalls, 1)
  assert.equal(refreshedQuery, 'example.com/docs?tab=readme')
  assert.equal(app.focusMode, 'search')
  assert.equal(document.activeElement, input)
  assert.equal(input.selectionStart, input.value.length)
  assert.equal(input.selectionEnd, input.value.length)
})

test('changeSelectedRowToSearch is a no-op for the synthetic typed URL row', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  const activeElement = document.createElement('button')
  input.value = 'typed.example/path#fragment'
  input.setSelectionRange(2, 4)
  app.results = [searchResult('visited')]
  app.updateVisibleRows()
  app.selectedIndex = 0
  app.focusMode = 'results'
  document.activeElement = activeElement
  let refreshCalls = 0
  app.updateResults = () => {
    refreshCalls++
  }

  app.changeSelectedRowToSearch()

  assert.equal(input.value, 'typed.example/path#fragment')
  assert.equal(refreshCalls, 0)
  assert.equal(app.focusMode, 'results')
  assert.equal(document.activeElement, activeElement)
  assert.equal(input.selectionStart, 2)
  assert.equal(input.selectionEnd, 4)
})

test('changeSelectedRowToSearch is a no-op when no visible row is selected', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  const activeElement = document.createElement('button')
  input.value = 'keep this query'
  input.setSelectionRange(1, 3)
  app.results = [searchResult('only')]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 42
  app.focusMode = 'results'
  document.activeElement = activeElement
  let refreshCalls = 0
  app.updateResults = () => {
    refreshCalls++
  }

  app.changeSelectedRowToSearch()

  assert.equal(input.value, 'keep this query')
  assert.equal(refreshCalls, 0)
  assert.equal(app.focusMode, 'results')
  assert.equal(document.activeElement, activeElement)
  assert.equal(input.selectionStart, 1)
  assert.equal(input.selectionEnd, 3)
})

test('mode switch reset returns selection and pagination to the top while keeping the query', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')

  input.value = 'github issue'
  app.selectedIndex = 5
  app.pageIndex = 2

  app.resetSelectionForModeSwitch()

  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.equal(input.value, 'github issue')
})

test('mode switch reset is harmless when already at the top with an empty query', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')

  input.value = ''
  app.selectedIndex = 0
  app.pageIndex = 0

  app.resetSelectionForModeSwitch()

  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.equal(input.value, '')
})

test('ensureSearchModeReady lazily loads recent history and reuses the popup-session ready index', async () => {
  const document = createScryDocument()
  const historyCalls = []
  const chromeApi = {
    history: {
      async search(query) {
        historyCalls.push(query)
        return [historyEntry(1)]
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.ensureSearchModeReady('recent')

  assert.equal(historyCalls.length, 1)
  assert.equal(historyCalls[0].maxResults, 10_000)
  assert.equal(historyCalls[0].startTime, now - 90 * 24 * 60 * 60 * 1_000)
  assert.equal(app.loading, false)
  assert.equal(app.deep, false)
  assert.equal(app.searchMode, 'recent')
  assert.equal(app.modeCache.recent.status, 'ready')
  assert.equal(app.modeCache.recent.error, null)
  assert.equal(app.modeCache.recent.loadedAt, now)
  assert.equal(app.modeCache.recent.index.entries.length, 1)
  assert.equal(app.index, app.modeCache.recent.index)

  await app.ensureSearchModeReady('recent')

  assert.equal(historyCalls.length, 1)
  assert.equal(app.index, app.modeCache.recent.index)
})

test('ensureSearchModeReady loads deep history separately from recent history', async () => {
  const document = createScryDocument()
  const historyCalls = []
  const chromeApi = {
    history: {
      async search(query) {
        historyCalls.push(query)
        return [historyEntry(query.startTime === 0 ? 2 : 1)]
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.ensureSearchModeReady('deep')

  assert.equal(historyCalls.length, 1)
  assert.deepEqual(historyCalls[0], { text: '', startTime: 0, maxResults: 100_000 })
  assert.equal(app.deep, true)
  assert.equal(app.searchMode, 'deep')
  assert.equal(app.modeCache.recent.status, 'idle')
  assert.equal(app.modeCache.deep.status, 'ready')
  assert.equal(app.modeCache.deep.index.entries.length, 1)
  assert.equal(app.index, app.modeCache.deep.index)
})

test('ensureSearchModeReady loads recently closed sessions through the sessions adapter', async () => {
  const document = createScryDocument()
  let sessionsCalls = 0
  const closedAtSeconds = now / 1_000 - 60
  const chromeApi = {
    history: {
      async search() {
        assert.fail('closed mode must not query Chrome history')
      },
    },
    sessions: {
      async getRecentlyClosed() {
        sessionsCalls++
        return [
          {
            lastModified: closedAtSeconds,
            tab: { url: 'https://closed.example/standalone', title: 'Standalone closed tab' },
          },
          {
            lastModified: closedAtSeconds - 10,
            window: {
              tabs: [
                { url: 'https://closed.example/window', title: 'Closed window tab' },
                { title: 'missing URL is skipped' },
              ],
            },
          },
        ]
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.ensureSearchModeReady('closed')

  assert.equal(sessionsCalls, 1)
  assert.equal(app.loading, false)
  assert.equal(app.deep, false)
  assert.equal(app.searchMode, 'closed')
  assert.equal(app.modeCache.closed.status, 'ready')
  assert.equal(app.modeCache.closed.error, null)
  assert.equal(app.modeCache.closed.loadedAt, now)
  assert.equal(app.index, app.modeCache.closed.index)
  assert.deepEqual(app.modeCache.closed.index.entries.map((entry) => entry.url), [
    'https://closed.example/standalone',
    'https://closed.example/window',
  ])
  assert.deepEqual(app.modeCache.closed.index.entries.map((entry) => entry.visitCount), [1, 1])
})

test('ensureSearchModeReady exposes loading state while a mode load is pending', async () => {
  const document = createScryDocument()
  let finishSearch
  const chromeApi = {
    history: {
      search() {
        return new Promise((resolve) => {
          finishSearch = resolve
        })
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  const loading = app.ensureSearchModeReady('recent')

  assert.equal(app.loading, true)
  assert.equal(app.modeCache.recent.status, 'loading')
  assert.equal(app.modeCache.recent.index, null)
  assert.equal(app.modeCache.recent.error, null)

  finishSearch([historyEntry(1)])
  await loading

  assert.equal(app.loading, false)
  assert.equal(app.modeCache.recent.status, 'ready')
})

test('ensureSearchModeReady stores mode-local errors without breaking other modes', async () => {
  const document = createScryDocument()
  const error = new Error('sessions unavailable')
  const chromeApi = {
    history: {
      async search() {
        return [historyEntry(3)]
      },
    },
    sessions: {
      async getRecentlyClosed() {
        throw error
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await assert.doesNotReject(app.ensureSearchModeReady('closed'))

  assert.equal(app.loading, false)
  assert.equal(app.index, null)
  assert.equal(app.modeCache.closed.status, 'error')
  assert.equal(app.modeCache.closed.index, null)
  assert.equal(app.modeCache.closed.error, error)
  assert.equal(app.modeCache.closed.loadedAt, null)

  await app.ensureSearchModeReady('recent')

  assert.equal(app.modeCache.closed.status, 'error')
  assert.equal(app.modeCache.closed.error, error)
  assert.equal(app.modeCache.recent.status, 'ready')
  assert.equal(app.index, app.modeCache.recent.index)
})

test('loadHistory maps legacy deep false to cached recent mode loading', async () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  document.body.append(modeIndicator)
  const historyCalls = []
  const chromeApi = {
    history: {
      async search(query) {
        historyCalls.push(query)
        return [historyEntry(1)]
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.loadHistory({ deep: false })
  const recentIndex = app.modeCache.recent.index

  assert.equal(historyCalls.length, 1)
  assert.equal(historyCalls[0].maxResults, 10_000)
  assert.equal(historyCalls[0].startTime, now - 90 * 24 * 60 * 60 * 1_000)
  assert.equal(app.loading, false)
  assert.equal(app.deep, false)
  assert.equal(app.searchMode, 'recent')
  assert.equal(app.modeCache.recent.status, 'ready')
  assert.equal(app.modeCache.recent.error, null)
  assert.equal(app.index, recentIndex)
  assert.equal(app.results.length, 1)
  assert.equal(modeIndicator.dataset.mode, 'recent')
  assert.equal(modeIndicator.dataset.status, 'ready')
  assert.equal(document.querySelector('#status').textContent, '1 recent history URL')

  await app.loadHistory({ deep: false })

  assert.equal(historyCalls.length, 1)
  assert.equal(app.index, recentIndex)
})

test('loadHistory maps legacy deep true to cached deep mode even when recent has matches', async () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  document.body.append(modeIndicator)
  const input = document.querySelector('#search-input')
  input.value = 'issue'
  const historyCalls = []
  const chromeApi = {
    history: {
      async search(query) {
        historyCalls.push(query)
        return [historyEntry(query.startTime === 0 ? 2 : 1)]
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.loadHistory({ deep: false })
  assert.equal(app.results.length, 1)
  assert.equal(app.results[0].url, 'https://github.com/shihabdider/scry/issues/1')

  await app.loadHistory({ deep: true })
  const deepIndex = app.modeCache.deep.index

  assert.deepEqual(historyCalls, [
    { text: '', startTime: now - 90 * 24 * 60 * 60 * 1_000, maxResults: 10_000 },
    { text: '', startTime: 0, maxResults: 100_000 },
  ])
  assert.equal(app.loading, false)
  assert.equal(app.deep, true)
  assert.equal(app.searchMode, 'deep')
  assert.equal(app.modeCache.recent.status, 'ready')
  assert.equal(app.modeCache.deep.status, 'ready')
  assert.equal(app.modeCache.deep.error, null)
  assert.equal(app.index, deepIndex)
  assert.equal(app.results.length, 1)
  assert.equal(app.results[0].url, 'https://github.com/shihabdider/scry/issues/2')
  assert.equal(modeIndicator.dataset.mode, 'deep')
  assert.equal(modeIndicator.dataset.status, 'ready')
  assert.equal(document.querySelector('#status').textContent, '1 deep history URL')

  await app.loadHistory({ deep: true })

  assert.equal(historyCalls.length, 2)
  assert.equal(app.index, deepIndex)
})

test('loadHistory keeps legacy deep load errors mode-local and can return to recent', async () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  document.body.append(modeIndicator)
  const input = document.querySelector('#search-input')
  input.value = 'typed.example/error'
  const error = new Error('history unavailable')
  const historyCalls = []
  const chromeApi = {
    history: {
      async search(query) {
        historyCalls.push(query)
        if (query.startTime === 0) throw error
        return [historyEntry(1)]
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.loadHistory({ deep: false })
  const recentIndex = app.modeCache.recent.index

  await assert.doesNotReject(app.loadHistory({ deep: true }))

  assert.equal(app.loading, false)
  assert.equal(app.searchMode, 'deep')
  assert.equal(app.deep, true)
  assert.equal(app.index, null)
  assert.equal(app.results.length, 0)
  assert.equal(app.visibleRows.length, 1)
  assert.equal(app.visibleRows[0].kind, 'open-typed-url')
  assert.equal(app.modeCache.deep.status, 'error')
  assert.equal(app.modeCache.deep.index, null)
  assert.equal(app.modeCache.deep.error, error)
  assert.equal(app.modeCache.recent.status, 'ready')
  assert.equal(modeIndicator.dataset.mode, 'deep')
  assert.equal(modeIndicator.dataset.status, 'error')
  assert.equal(document.querySelector('#status').textContent, 'Deep history unavailable')
  assert.equal(document.querySelector('#deep-search-button').hidden, true)

  await app.loadHistory({ deep: false })

  assert.equal(historyCalls.length, 2)
  assert.equal(app.searchMode, 'recent')
  assert.equal(app.deep, false)
  assert.equal(app.index, recentIndex)
  assert.equal(app.modeCache.deep.status, 'error')
  assert.equal(app.modeCache.deep.error, error)
})

test('switchSearchMode preserves query, resets top, lazy-loads the target mode, and refreshes results', async () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  document.body.append(modeIndicator)
  const input = document.querySelector('#search-input')
  input.value = 'issue 2'
  const historyCalls = []
  const chromeApi = {
    history: {
      async search(query) {
        historyCalls.push(query)
        return query.startTime === 0 ? [historyEntry(2)] : [historyEntry(1)]
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.results = [searchResult('stale')]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 4
  app.pageIndex = 2

  await app.switchSearchMode('deep')

  assert.equal(input.value, 'issue 2')
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.equal(app.searchMode, 'deep')
  assert.equal(app.deep, true)
  assert.deepEqual(historyCalls, [{ text: '', startTime: 0, maxResults: 100_000 }])
  assert.equal(app.modeCache.deep.status, 'ready')
  assert.equal(app.results.length, 1)
  assert.equal(app.results[0].url, 'https://github.com/shihabdider/scry/issues/2')
  assert.equal(app.visibleRows.length, 1)
  assert.equal(app.visibleRows[0].kind, 'result')
  assert.equal(app.visibleRows[0].result, app.results[0])
  assert.equal(modeIndicator.dataset.mode, 'deep')
  assert.equal(modeIndicator.dataset.status, 'ready')
  assert.equal(document.querySelector('#status').textContent, '1 deep history URL')
})

test('switchSearchMode reuses a ready mode index and keeps a typed URL row selected', async () => {
  const document = createScryDocument()
  const input = document.querySelector('#search-input')
  input.value = 'typed.example/path'
  let sessionsCalls = 0
  const chromeApi = {
    history: {
      async search() {
        assert.fail('ready closed mode must be reused without querying history')
      },
    },
    sessions: {
      async getRecentlyClosed() {
        sessionsCalls++
        return []
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.ensureSearchModeReady('closed')
  const readyClosedIndex = app.modeCache.closed.index
  app.searchMode = 'recent'
  app.index = null
  app.results = [searchResult('stale')]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 3
  app.pageIndex = 1

  await app.switchSearchMode('closed')

  assert.equal(sessionsCalls, 1)
  assert.equal(app.index, readyClosedIndex)
  assert.equal(input.value, 'typed.example/path')
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.equal(app.results.length, 0)
  assert.equal(app.visibleRows.length, 1)
  assert.equal(app.visibleRows[0].kind, 'open-typed-url')
  assert.equal(app.selectedVisibleRow(), app.visibleRows[0])
})

test('switchSearchMode handles mode-local load errors without breaking other modes', async () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  document.body.append(modeIndicator)
  const input = document.querySelector('#search-input')
  input.value = 'typed.example/error'
  const error = new Error('sessions unavailable')
  let historyCalls = 0
  const chromeApi = {
    history: {
      async search() {
        historyCalls++
        return [historyEntry(1)]
      },
    },
    sessions: {
      async getRecentlyClosed() {
        throw error
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  await app.ensureSearchModeReady('recent')
  app.results = [searchResult('stale')]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 2
  app.pageIndex = 1

  await assert.doesNotReject(app.switchSearchMode('closed'))

  assert.equal(app.modeCache.closed.status, 'error')
  assert.equal(app.modeCache.closed.error, error)
  assert.equal(app.modeCache.recent.status, 'ready')
  assert.equal(app.index, null)
  assert.equal(app.results.length, 0)
  assert.equal(app.visibleRows.length, 1)
  assert.equal(app.visibleRows[0].kind, 'open-typed-url')
  assert.equal(app.selectedVisibleRow(), app.visibleRows[0])
  assert.equal(modeIndicator.dataset.mode, 'closed')
  assert.equal(modeIndicator.dataset.status, 'error')
  assert.equal(document.querySelector('#status').textContent, 'Recently closed URLs unavailable')

  await app.switchSearchMode('recent')

  assert.equal(historyCalls, 1)
  assert.equal(app.modeCache.closed.status, 'error')
  assert.equal(app.modeCache.closed.error, error)
  assert.equal(app.modeCache.recent.status, 'ready')
  assert.equal(app.index, app.modeCache.recent.index)
})

test('renderModeIndicator renders the active mode label/status in dedicated popup markup', () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  modeIndicator.hidden = true
  document.body.append(modeIndicator)
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const deepSearchButton = document.querySelector('#deep-search-button')
  deepSearchButton.hidden = false
  deepSearchButton.textContent = 'Deep search all history'
  app.searchMode = 'deep'
  app.modeCache = {
    deep: {
      mode: 'deep',
      status: 'ready',
      index: { entries: [{}, {}] },
      error: null,
      loadedAt: now,
    },
  }

  app.renderModeIndicator()

  assert.equal(modeIndicator.hidden, false)
  assert.equal(modeIndicator.textContent, 'mode: deep')
  assert.equal(modeIndicator.dataset.mode, 'deep')
  assert.equal(modeIndicator.dataset.status, 'ready')
  assert.equal(modeIndicator.dataset.clickable, 'true')
  assert.equal(modeIndicator.disabled, false)
  assert.equal(modeIndicator.getAttribute('aria-disabled'), 'false')
  assert.equal(modeIndicator.getAttribute('aria-label'), 'mode: deep; 2 deep history URLs')
  assert.equal(modeIndicator.title, '2 deep history URLs')
  assert.equal(document.querySelector('#status').textContent, '2 deep history URLs')
  assert.equal(deepSearchButton.hidden, true)
  assert.equal(deepSearchButton.textContent, 'Deep search all history')
})

test('renderModeIndicator is safe before popup mode-indicator markup exists', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.searchMode = 'closed'
  app.modeCache = {
    closed: {
      mode: 'closed',
      status: 'error',
      index: null,
      error: new Error('sessions unavailable'),
      loadedAt: null,
    },
  }

  assert.equal(document.querySelector('#mode-indicator'), null)
  assert.doesNotThrow(() => app.renderModeIndicator())

  assert.equal(document.querySelector('#status').textContent, 'Recently closed URLs unavailable')
  assert.equal(document.querySelector('#deep-search-button').hidden, true)
})

test('renderModeIndicator falls back to the active mode idle status before cache initialization', () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  document.body.append(modeIndicator)
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  app.renderModeIndicator()

  assert.equal(modeIndicator.textContent, 'mode: recent')
  assert.equal(modeIndicator.dataset.status, 'idle')
  assert.equal(document.querySelector('#status').textContent, 'Recent history not loaded')
})

test('command palette keeps trying to focus search while Chrome is finishing popup open', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([historyEntry(1), historyEntry(2)])
  const input = document.querySelector('#search-input')
  const originalFocus = input.focus.bind(input)
  let focusAttempts = 0
  input.focus = () => {
    focusAttempts++
    if (focusAttempts >= 3) originalFocus()
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.start()
  assert.equal(document.activeElement, null)

  await wait(80)

  assert.equal(document.activeElement, input)
  assert.ok(focusAttempts >= 3)
})

test('focusSearch enters search mode, focuses the input, and places the cursor at the query end', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  input.value = 'github issue'
  input.setSelectionRange(2, 2)
  app.focusMode = 'results'

  app.focusSearch()

  assert.equal(app.focusMode, 'search')
  assert.equal(document.activeElement, input)
  assert.equal(input.selectionStart, input.value.length)
  assert.equal(input.selectionEnd, input.value.length)
})

test('focusSearch is safe when cursor placement is unavailable', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  input.value = 'scry'
  input.setSelectionRange = undefined

  assert.doesNotThrow(() => app.focusSearch())
  assert.equal(app.focusMode, 'search')
  assert.equal(document.activeElement, input)
})

test('typing i in search input is not intercepted as a mode shortcut', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  app.bindEvents()
  app.focusSearch()

  const event = dispatchKeydown(input, 'i')

  assert.equal(event.defaultPrevented, false)
  assert.equal(app.focusMode, 'search')
  assert.equal(document.activeElement, input)
})

test('Escape moves from search entry to result navigation, then closes or leaves the command palette', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([historyEntry(1), historyEntry(2)])
  const windowApi = { blurCalls: 0, blur() { this.blurCalls++ } }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi })

  await app.start()
  const input = document.querySelector('#search-input')
  assert.equal(document.activeElement, input)

  input.value = 'scry'
  dispatchInput(input)
  dispatchKeydown(input, 'Escape')

  assert.equal(document.activeElement?.dataset.resultIndex, '0')

  dispatchKeydown(document.activeElement, 'Escape')

  assert.equal(document.activeElement, null)
  assert.equal(windowApi.blurCalls, 1)
})

test('results are paged and h/l move between pages in result navigation mode', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome(Array.from({ length: 12 }, (_, index) => historyEntry(index + 1)))
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.start()

  const input = document.querySelector('#search-input')
  const results = document.querySelector('#results')
  const pageStatus = document.querySelector('#page-status')
  assert.ok(results.childElementCount > 0)
  assert.ok(results.childElementCount < 12)
  assert.equal(pageStatus.textContent, 'Page 1 of 2')
  const firstPageFirstIndex = results.children[0].children[0].dataset.resultIndex

  dispatchKeydown(input, 'Escape')
  dispatchKeydown(document.activeElement, 'l')

  assert.equal(pageStatus.textContent, 'Page 2 of 2')
  assert.notEqual(results.children[0].children[0].dataset.resultIndex, firstPageFirstIndex)

  dispatchKeydown(document.activeElement, 'h')

  assert.equal(pageStatus.textContent, 'Page 1 of 2')
  assert.equal(results.children[0].children[0].dataset.resultIndex, firstPageFirstIndex)
})

test('j/k navigate results and Enter opens the selected result then closes the command palette', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([historyEntry(1), historyEntry(2), historyEntry(3)])
  const windowApi = {
    closeCalls: 0,
    close() {
      this.closeCalls++
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi })

  await app.start()
  const input = document.querySelector('#search-input')

  dispatchKeydown(input, 'Escape')
  assert.equal(document.activeElement?.dataset.resultIndex, '0')

  dispatchKeydown(document.activeElement, 'j')
  assert.equal(document.activeElement?.dataset.resultIndex, '1')

  dispatchKeydown(document.activeElement, 'k')
  assert.equal(document.activeElement?.dataset.resultIndex, '0')

  dispatchKeydown(document.activeElement, 'Enter')
  await settle()

  assert.equal(chromeApi.tabs.updated.length, 1)
  assert.equal(document.activeElement, null)
  assert.equal(windowApi.closeCalls, 1)
})
