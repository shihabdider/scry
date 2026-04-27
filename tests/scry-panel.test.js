import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVisibleRows } from '../src/core/rows.js'
import { ScryPanelApp } from '../src/panel/app.js'
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
