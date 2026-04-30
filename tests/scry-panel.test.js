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

function appendFocusableRow(resultsList, dataset = {}) {
  const item = resultsList.ownerDocument.createElement('li')
  const button = resultsList.ownerDocument.createElement('button')
  button.type = 'button'
  for (const [key, value] of Object.entries(dataset)) {
    button.dataset[key] = String(value)
  }
  item.append(button)
  resultsList.append(item)
  return button
}

function createTimerApi() {
  const timers = []
  return {
    timers,
    setTimeout(callback, delay) {
      const timer = { callback, delay, cleared: false, unref() {} }
      timers.push(timer)
      return timer
    },
    clearTimeout(timer) {
      timer.cleared = true
    },
    run(timer) {
      if (!timer.cleared) timer.callback()
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

test('renderPagination hides controls when only a synthetic typed URL row is visible', () => {
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

  app.renderPagination()

  assert.equal(app.pagination.hidden, true)
  assert.equal(app.pageStatus.textContent, 'No results')
  assert.equal(app.previousPageButton.disabled, true)
  assert.equal(app.nextPageButton.disabled, true)
})

test('renderPagination hides controls for one real-result page when a typed URL row is pinned', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 6 }, (_, index) => searchResult(`pagination-boundary-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })

  app.renderPagination()

  assert.equal(app.pagination.hidden, true)
  assert.equal(app.pageStatus.textContent, 'Page 1 of 1')
  assert.equal(app.previousPageButton.disabled, true)
  assert.equal(app.nextPageButton.disabled, true)
})

test('renderPagination derives labels and visibility from visible real corpus rows', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 7 }, (_, index) => searchResult(`visible-pagination-${index + 1}`))
  app.results = []
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })
  app.pageIndex = 1

  app.renderPagination()

  assert.equal(app.pagination.hidden, false)
  assert.equal(app.pageStatus.textContent, 'Page 2 of 2')
  assert.equal(app.previousPageButton.disabled, false)
  assert.equal(app.nextPageButton.disabled, true)
})

test('renderPagination preserves normal multi-page result list controls', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const corpusResults = Array.from({ length: 7 }, (_, index) => searchResult(`normal-pagination-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults })

  app.renderPagination()

  assert.equal(app.pagination.hidden, false)
  assert.equal(app.pageStatus.textContent, 'Page 1 of 2')
  assert.equal(app.previousPageButton.disabled, true)
  assert.equal(app.nextPageButton.disabled, false)
})

test('renderResults pins an Open typed URL action above the current real-result page', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 7 }, (_, index) => searchResult(`render-page-${index + 1}`))
  app.input.value = 'typed.example/path'
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })
  app.pageIndex = 1
  app.selectedIndex = 7

  app.renderResults()

  const results = document.querySelector('#results')
  assert.equal(results.childElementCount, 2)

  const typedItem = results.children[0]
  const typedButton = typedItem.children[0]
  assert.match(typedItem.className, /\bresult\b/)
  assert.match(typedItem.className, /\bresult-action\b/)
  assert.match(typedItem.className, /\bopen-typed-url\b/)
  assert.equal(typedButton.dataset.visibleRowIndex, '0')
  assert.equal(typedButton.dataset.resultIndex, '0')
  assert.equal(typedButton.dataset.rowKind, 'open-typed-url')
  assert.match(typedButton.innerHTML, /Open typed URL/)
  assert.match(typedButton.innerHTML, /typed\.example\/path/)

  const realItem = results.children[1]
  const realButton = realItem.children[0]
  assert.match(realItem.className, /\bselected\b/)
  assert.equal(realButton.dataset.visibleRowIndex, '7')
  assert.equal(realButton.dataset.resultIndex, '7')
  assert.equal(realButton.dataset.rowKind, 'result')
  assert.match(realButton.innerHTML, new RegExp(corpusResults[6].urlHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(realButton.innerHTML, new RegExp(corpusResults[6].titleHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(realButton.innerHTML, /3 visits · now/)
  assert.equal(app.pageStatus.textContent, 'Page 2 of 2')
  assert.equal(app.deepSearchButton.hidden, true)
})

test('renderResults shows copied feedback inline only on the copied visible row', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const copiedResult = searchResult('copied-row')
  app.input.value = 'typed.example/path'
  app.results = [copiedResult]
  app.visibleRows = buildVisibleRows({
    corpusResults: [copiedResult],
    typedUrlCandidate,
    copiedFeedback: { key: 'result:https://example.com/copied-row', expiresAt: now + 1_000 },
    now,
  })
  app.selectedIndex = 1

  app.renderResults()

  const results = document.querySelector('#results')
  const typedItem = results.children[0]
  const copiedItem = results.children[1]
  assert.doesNotMatch(typedItem.className, /\bcopied\b/)
  assert.doesNotMatch(typedItem.children[0].innerHTML, /result-copied-feedback/)
  assert.match(copiedItem.className, /\bcopied\b/)
  assert.match(copiedItem.children[0].innerHTML, /class="result-copied-feedback"/)
  assert.match(copiedItem.children[0].innerHTML, />copied</)
})

test('renderResults uses mode-appropriate empty messages and keeps the old deep-search fallback hidden', () => {
  const cases = [
    ['recent', 'scry', 'No matches in recent history.'],
    ['deep', 'scry', 'No matches in deep history.'],
    ['closed', 'scry', 'No matches in recently closed URLs.'],
    ['recent', '', 'No recent history results yet.'],
    ['deep', '', 'No deep history results yet.'],
    ['closed', '', 'No recently closed URLs yet.'],
  ]

  for (const [mode, query, expectedMessage] of cases) {
    const document = createScryDocument()
    const chromeApi = createPanelChrome([])
    const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
    app.searchMode = mode
    app.deep = mode === 'deep'
    app.input.value = query
    app.results = []
    app.visibleRows = []
    app.deepSearchButton.hidden = false

    app.renderResults()

    assert.equal(app.message.hidden, false, mode)
    assert.equal(app.message.textContent, expectedMessage, mode)
    assert.equal(app.resultsList.childElementCount, 0, mode)
    assert.equal(app.deepSearchButton.hidden, true, mode)
  }
})

test('renderLoading uses the active search mode for loading copy and clears stale result UI', () => {
  const cases = [
    ['recent', true, 'Loading recent history…', 'Indexing recent browser history…'],
    ['deep', false, 'Loading deep history…', 'Searching all available history. This can take a moment.'],
    ['closed', true, 'Loading recently closed URLs…', 'Loading recently closed URLs…'],
  ]

  for (const [mode, legacyDeepFlag, expectedStatus, expectedMessage] of cases) {
    const document = createScryDocument()
    const chromeApi = createPanelChrome([])
    const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
    app.searchMode = mode
    app.deep = legacyDeepFlag
    app.deepSearchButton.hidden = false
    app.pagination.hidden = false
    appendFocusableRow(app.resultsList, { resultIndex: 0 })

    app.renderLoading()

    assert.equal(app.status.textContent, expectedStatus, mode)
    assert.equal(app.message.hidden, false, mode)
    assert.equal(app.message.textContent, expectedMessage, mode)
    assert.equal(app.resultsList.childElementCount, 0, mode)
    assert.equal(app.deepSearchButton.hidden, true, mode)
    assert.equal(app.pagination.hidden, true, mode)
  }
})

test('renderLoading marks the mode indicator as loading for the active mode', () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  modeIndicator.hidden = true
  document.body.append(modeIndicator)
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.searchMode = 'closed'
  app.modeCache = {
    closed: { mode: 'closed', status: 'loading', index: null, error: null, loadedAt: null },
  }

  app.renderLoading()

  assert.equal(modeIndicator.hidden, false)
  assert.equal(modeIndicator.textContent, '[closed]')
  assert.equal(modeIndicator.dataset.mode, 'closed')
  assert.equal(modeIndicator.dataset.status, 'loading')
  assert.equal(modeIndicator.dataset.clickable, 'true')
  assert.equal(modeIndicator.disabled, false)
  assert.equal(modeIndicator.title, 'Loading recently closed URLs…')
  assert.equal(modeIndicator.getAttribute('aria-disabled'), 'false')
  assert.equal(modeIndicator.getAttribute('aria-label'), '[closed]; Loading recently closed URLs…')
  assert.equal(app.status.textContent, 'Loading recently closed URLs…')
})

test('renderResults reports active mode errors while still rendering a typed URL action row', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/error',
    normalizedUrl: 'https://typed.example/error',
    key: 'https://typed.example/error',
  }
  app.searchMode = 'closed'
  app.modeCache = {
    closed: { mode: 'closed', status: 'error', index: null, error: new Error('sessions unavailable'), loadedAt: null },
  }
  app.input.value = 'typed.example/error'
  app.results = []
  app.visibleRows = buildVisibleRows({ corpusResults: [], typedUrlCandidate })
  app.deepSearchButton.hidden = false

  app.renderResults()

  assert.equal(app.message.hidden, false)
  assert.equal(app.message.textContent, 'Recently closed URLs unavailable.')
  assert.equal(app.resultsList.childElementCount, 1)
  assert.equal(app.resultsList.children[0].children[0].dataset.rowKind, 'open-typed-url')
  assert.equal(app.deepSearchButton.hidden, true)
})

test('ensureSelectedVisible leaves the always-visible typed URL row on the current page', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 13 }, (_, index) => searchResult(`typed-pinned-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })
  app.pageIndex = 1
  app.selectedIndex = 0

  app.ensureSelectedVisible()

  assert.equal(app.pageIndex, 1)
})

test('ensureSelectedVisible maps selected visible real rows to paginated corpus rows when a typed URL row is pinned', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 13 }, (_, index) => searchResult(`visible-real-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })

  // Visible index 6 is the sixth real row because index 0 is the pinned typed URL row.
  app.pageIndex = 0
  app.selectedIndex = 6
  app.ensureSelectedVisible()
  assert.equal(app.pageIndex, 0)

  // The same visible row should force page 0 when the current page is later.
  app.pageIndex = 1
  app.ensureSelectedVisible()
  assert.equal(app.pageIndex, 0)

  // Visible index 7 is the first real row on page 2.
  app.pageIndex = 0
  app.selectedIndex = 7
  app.ensureSelectedVisible()
  assert.equal(app.pageIndex, 1)
})

test('ensureSelectedVisible preserves legacy selected result pagination without a typed URL row', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const corpusResults = Array.from({ length: 13 }, (_, index) => searchResult(`legacy-visible-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults })

  app.pageIndex = 0
  app.selectedIndex = 6
  app.ensureSelectedVisible()
  assert.equal(app.pageIndex, 1)

  app.selectedIndex = 5
  app.ensureSelectedVisible()
  assert.equal(app.pageIndex, 0)
})

test('movePage selects the first visible real result when a typed URL row is pinned', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 13 }, (_, index) => searchResult(`paged-visible-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })
  app.pageIndex = 0
  app.selectedIndex = 0
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  app.movePage(1)

  assert.equal(app.pageIndex, 1)
  assert.equal(app.selectedIndex, 7)
  assert.equal(app.selectedVisibleRow(), app.visibleRows[7])
  assert.equal(app.visibleRows[7].result, corpusResults[6])
  assert.equal(renderCalls, 1)

  app.movePage(-1)

  assert.equal(app.pageIndex, 0)
  assert.equal(app.selectedIndex, 1)
  assert.equal(app.selectedVisibleRow(), app.visibleRows[1])
  assert.equal(app.visibleRows[1].result, corpusResults[0])
  assert.equal(renderCalls, 2)
})

test('movePage preserves legacy result indexes when no typed URL row is present', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const corpusResults = Array.from({ length: 13 }, (_, index) => searchResult(`legacy-page-move-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = []
  app.pageIndex = 0
  app.selectedIndex = 0
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  app.movePage(1)

  assert.equal(app.pageIndex, 1)
  assert.equal(app.selectedIndex, 6)
  assert.deepEqual(app.selectedVisibleRow(), {
    kind: 'result',
    key: 'result:https://example.com/legacy-page-move-7',
    result: corpusResults[6],
    copied: false,
  })
  assert.equal(renderCalls, 1)
})

test('movePage ignores a pinned typed URL row when deciding whether another page exists', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 6 }, (_, index) => searchResult(`single-real-page-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })
  app.pageIndex = 0
  app.selectedIndex = 0
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  app.movePage(1)

  assert.equal(app.pageIndex, 0)
  assert.equal(app.selectedIndex, 0)
  assert.equal(renderCalls, 0)
})

test('moveSelection wraps through the full visible row union when a typed URL row is pinned', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const firstResult = searchResult('visible-move-first')
  const secondResult = searchResult('visible-move-second')
  app.results = [firstResult, secondResult]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results, typedUrlCandidate })
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  app.selectedIndex = 2
  app.moveSelection(1)
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.selectedVisibleRow(), app.visibleRows[0])

  app.moveSelection(-1)
  assert.equal(app.selectedIndex, 2)
  assert.equal(app.selectedVisibleRow(), app.visibleRows[2])
  assert.equal(renderCalls, 2)
})

test('moveSelection keeps a moved real visible row on screen when a typed URL row shifts indexes', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResults = Array.from({ length: 13 }, (_, index) => searchResult(`moved-visible-${index + 1}`))
  app.results = corpusResults
  app.visibleRows = buildVisibleRows({ corpusResults, typedUrlCandidate })
  app.pageIndex = 0
  app.selectedIndex = 6
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  app.moveSelection(1)

  assert.equal(app.selectedIndex, 7)
  assert.equal(app.pageIndex, 1)
  assert.equal(app.selectedVisibleRow(), app.visibleRows[7])
  assert.equal(renderCalls, 1)
})

test('moveSelection can select the only synthetic visible row without real results', () => {
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
  app.selectedIndex = 0
  app.pageIndex = 42
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  app.moveSelection(1)

  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.equal(app.selectedVisibleRow(), app.visibleRows[0])
  assert.equal(renderCalls, 1)
})

test('moveSelection preserves legacy result wrapping when visible rows are not populated yet', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const firstResult = searchResult('legacy-move-first')
  const secondResult = searchResult('legacy-move-second')
  app.results = [firstResult, secondResult]
  app.visibleRows = []
  app.selectedIndex = 1
  let renderCalls = 0
  app.renderResults = () => {
    renderCalls++
  }

  app.moveSelection(1)

  assert.equal(app.selectedIndex, 0)
  assert.deepEqual(app.selectedVisibleRow(), {
    kind: 'result',
    key: 'result:https://example.com/legacy-move-first',
    result: firstResult,
    copied: false,
  })
  assert.equal(renderCalls, 1)
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

test('updateResults sorts closed mode empty-query results by most recent first', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  const closedIndex = buildHistoryIndex([
    {
      url: 'https://closed.example/recent-one-off',
      title: 'Recent one off',
      visitCount: 1,
      lastVisitTime: now - 5 * 60 * 1000,
    },
    {
      url: 'https://closed.example/older-recurring',
      title: 'Older recurring',
      visitCount: 12,
      lastVisitTime: now - 60 * 60 * 1000,
    },
  ], { now })
  app.modeCache = {
    recent: { mode: 'recent', status: 'idle', index: null, error: null, loadedAt: null },
    deep: { mode: 'deep', status: 'idle', index: null, error: null, loadedAt: null },
    closed: { mode: 'closed', status: 'ready', index: closedIndex, error: null, loadedAt: now },
  }
  app.searchMode = 'closed'
  input.value = ''
  app.renderResults = () => {}

  app.updateResults()

  assert.deepEqual(app.results.map((result) => result.url), [
    'https://closed.example/recent-one-off',
    'https://closed.example/older-recurring',
  ])
  assert.equal(app.results[0].debug.mode, 'recency')
})

test('input events debounce result refresh while resetting navigation immediately', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const timerApi = createTimerApi()
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { ...timerApi, blur() {} } })
  const input = document.querySelector('#search-input')
  app.selectedIndex = 4
  app.pageIndex = 2
  let refreshCalls = 0
  app.updateResults = () => {
    refreshCalls++
  }
  app.bindEvents()

  input.value = 'docs'
  dispatchInput(input)
  input.value = 'docs install'
  dispatchInput(input)

  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.equal(refreshCalls, 0)
  assert.equal(timerApi.timers.length, 2)
  assert.equal(timerApi.timers[0].cleared, true)

  timerApi.run(timerApi.timers[0])
  assert.equal(refreshCalls, 0)

  timerApi.run(timerApi.timers[1])
  assert.equal(refreshCalls, 1)
})

test('search input Enter flushes a pending URL refresh before opening the typed URL row', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const timerApi = createTimerApi()
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { ...timerApi, blur() {} } })
  const input = document.querySelector('#search-input')
  app.bindEvents()

  input.value = 'typed.example/path#fragment'
  dispatchInput(input)
  const event = dispatchKeydown(input, 'Enter')
  await settle()

  assert.equal(event.defaultPrevented, true)
  assert.equal(timerApi.timers.length, 1)
  assert.equal(timerApi.timers[0].cleared, true)
  assert.deepEqual(chromeApi.tabs.opened, [
    { url: 'https://typed.example/path', active: true },
  ])
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

test('Tab and Shift+Tab in the search input cycle modes while preserving the query and resetting position', async () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  document.body.append(modeIndicator)
  const input = document.querySelector('#search-input')
  input.value = 'issue 2'
  const historyCalls = []
  const recentlyClosedCalls = []
  const chromeApi = {
    history: {
      async search(query) {
        historyCalls.push(query)
        return [historyEntry(1)]
      },
    },
    sessions: {
      async getRecentlyClosed() {
        recentlyClosedCalls.push('getRecentlyClosed')
        return [
          {
            lastModified: now / 1_000 - 60,
            tab: { url: 'https://closed.example/issue-2', title: 'Closed issue 2' },
          },
        ]
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.selectedIndex = 5
  app.pageIndex = 2
  app.bindEvents()

  const forwardEvent = dispatchKeydown(input, 'Tab')
  await settle()

  assert.equal(forwardEvent.defaultPrevented, true)
  assert.equal(input.value, 'issue 2')
  assert.equal(app.searchMode, 'closed')
  assert.equal(app.deep, false)
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.deepEqual(historyCalls, [])
  assert.deepEqual(recentlyClosedCalls, ['getRecentlyClosed'])
  assert.equal(modeIndicator.dataset.mode, 'closed')
  assert.equal(modeIndicator.dataset.status, 'ready')

  input.value = 'issue 1'
  app.selectedIndex = 3
  app.pageIndex = 1

  const backwardEvent = dispatchKeydown(input, 'Tab', { shiftKey: true })
  await settle()

  assert.equal(backwardEvent.defaultPrevented, true)
  assert.equal(input.value, 'issue 1')
  assert.equal(app.searchMode, 'recent')
  assert.equal(app.deep, false)
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.deepEqual(historyCalls, [
    { text: '', startTime: now - 90 * 24 * 60 * 60 * 1_000, maxResults: 10_000 },
  ])
  assert.deepEqual(recentlyClosedCalls, ['getRecentlyClosed'])
  assert.equal(modeIndicator.dataset.mode, 'recent')
  assert.equal(modeIndicator.dataset.status, 'ready')
})

test('clicking the mode indicator cycles to the next mode instead of relying on the legacy deep-search fallback', async () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  document.body.append(modeIndicator)
  const input = document.querySelector('#search-input')
  input.value = 'issue 2'
  const deepSearchButton = document.querySelector('#deep-search-button')
  deepSearchButton.hidden = false
  const historyCalls = []
  const recentlyClosedCalls = []
  const chromeApi = {
    history: {
      async search(query) {
        historyCalls.push(query)
        return [historyEntry(1)]
      },
    },
    sessions: {
      async getRecentlyClosed() {
        recentlyClosedCalls.push('getRecentlyClosed')
        return [
          {
            lastModified: now / 1_000 - 60,
            tab: { url: 'https://closed.example/issue-2', title: 'Closed issue 2' },
          },
        ]
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.selectedIndex = 4
  app.pageIndex = 2
  app.bindEvents()

  const clickEvent = { type: 'click', bubbles: true, metaKey: false, ctrlKey: false }
  modeIndicator.dispatchEvent(clickEvent)
  await settle()

  assert.equal(input.value, 'issue 2')
  assert.equal(app.searchMode, 'closed')
  assert.equal(app.deep, false)
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.deepEqual(historyCalls, [])
  assert.deepEqual(recentlyClosedCalls, ['getRecentlyClosed'])
  assert.equal(modeIndicator.textContent, '[closed]')
  assert.equal(modeIndicator.dataset.mode, 'closed')
  assert.equal(modeIndicator.dataset.status, 'ready')
  assert.equal(deepSearchButton.hidden, true)
})

test('result navigation i returns to search input and leaves normal input typing to the input', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  input.value = 'github issue'
  input.setSelectionRange(0, 0)
  const selectedButton = appendFocusableRow(app.resultsList, { resultIndex: 0 })
  document.activeElement = selectedButton
  app.focusMode = 'results'
  app.bindEvents()

  const event = dispatchKeydown(selectedButton, 'i')

  assert.equal(event.defaultPrevented, true)
  assert.equal(app.focusMode, 'search')
  assert.equal(document.activeElement, input)
  assert.equal(input.selectionStart, input.value.length)
  assert.equal(input.selectionEnd, input.value.length)
})

test('result navigation y copies the selected row URL without changing search focus state', async () => {
  const document = createScryDocument()
  const writes = []
  const scheduledTimers = []
  const chromeApi = createPanelChrome([])
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
  const firstResult = searchResult('first')
  const secondResult = searchResult('second')
  app.results = [firstResult, secondResult]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 1
  app.focusMode = 'results'
  app.renderResults = () => {
    app.updateVisibleRows()
  }
  const selectedButton = appendFocusableRow(app.resultsList, { resultIndex: 1 })
  document.activeElement = selectedButton
  app.bindEvents()

  const event = dispatchKeydown(selectedButton, 'y')
  await settle()

  assert.equal(event.defaultPrevented, true)
  assert.deepEqual(writes, ['https://example.com/second?tab=readme'])
  assert.deepEqual(app.copiedFeedback, {
    key: 'result:https://example.com/second',
    expiresAt: now + 1_200,
  })
  assert.equal(app.visibleRows[1].copied, true)
  assert.equal(scheduledTimers.length, 1)
  assert.equal(app.focusMode, 'results')
})

test('result navigation c changes a selected real row into the focused search text', () => {
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
  app.focusMode = 'results'
  input.value = 'docs install'
  const selectedButton = appendFocusableRow(app.resultsList, { resultIndex: 1 })
  document.activeElement = selectedButton
  let refreshCalls = 0
  app.updateResults = () => {
    refreshCalls++
  }
  app.bindEvents()

  const event = dispatchKeydown(selectedButton, 'c')

  assert.equal(event.defaultPrevented, true)
  assert.equal(input.value, 'example.com/docs?tab=readme')
  assert.equal(refreshCalls, 1)
  assert.equal(app.focusMode, 'search')
  assert.equal(document.activeElement, input)
  assert.equal(input.selectionStart, input.value.length)
  assert.equal(input.selectionEnd, input.value.length)
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
  assert.equal(modeIndicator.textContent, '[deep]')
  assert.equal(modeIndicator.dataset.mode, 'deep')
  assert.equal(modeIndicator.dataset.status, 'ready')
  assert.equal(modeIndicator.dataset.clickable, 'true')
  assert.equal(modeIndicator.disabled, false)
  assert.equal(modeIndicator.getAttribute('aria-disabled'), 'false')
  assert.equal(modeIndicator.getAttribute('aria-label'), '[deep]; 2 deep history URLs')
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

  assert.equal(modeIndicator.textContent, '[recent]')
  assert.equal(modeIndicator.dataset.status, 'idle')
  assert.equal(document.querySelector('#status').textContent, 'Recent history not loaded')
})

test('start initializes recent mode cache and renders the mode indicator before selection storage resolves', async () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  modeIndicator.hidden = true
  document.body.append(modeIndicator)
  const input = document.querySelector('#search-input')
  let resolveSelectionLoad
  const selectionLoad = new Promise((resolve) => {
    resolveSelectionLoad = resolve
  })
  const historyCalls = []
  let sessionsCalls = 0
  const chromeApi = {
    history: {
      async search(query) {
        historyCalls.push(query)
        return [historyEntry(1)]
      },
    },
    sessions: {
      async getRecentlyClosed() {
        sessionsCalls++
        return []
      },
    },
    storage: {
      local: {
        async get(key) {
          assert.equal(key, SELECTION_STORAGE_KEY)
          return selectionLoad
        },
        async set() {},
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.searchMode = 'closed'
  app.deep = true

  const started = app.start()

  assert.equal(app.searchMode, 'recent')
  assert.equal(app.deep, false)
  assert.equal(app.focusMode, 'search')
  assert.equal(document.activeElement, input)
  assert.equal(app.modeCache.recent.status, 'idle')
  assert.equal(app.modeCache.deep.status, 'idle')
  assert.equal(app.modeCache.closed.status, 'idle')
  assert.equal(modeIndicator.hidden, false)
  assert.equal(modeIndicator.textContent, '[recent]')
  assert.equal(modeIndicator.dataset.mode, 'recent')
  assert.equal(modeIndicator.dataset.status, 'idle')
  assert.equal(document.querySelector('#status').textContent, 'Recent history not loaded')
  assert.deepEqual(historyCalls, [])
  assert.equal(sessionsCalls, 0)

  resolveSelectionLoad({})
  await started
})

test('start loads selection data and only the bounded recent corpus through the mode cache', async () => {
  const document = createScryDocument()
  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  document.body.append(modeIndicator)
  const historyCalls = []
  let sessionsCalls = 0
  const storedSelectionData = {
    version: 1,
    aggregates: {
      issue: {
        'https://github.com/shihabdider/scry/issues/1': {
          count: 2,
          lastSelectedAt: now - 1_000,
          selectedAt: [now - 2_000, now - 1_000],
        },
      },
    },
  }
  const chromeApi = {
    history: {
      async search(query) {
        historyCalls.push(query)
        return [historyEntry(1)]
      },
    },
    sessions: {
      async getRecentlyClosed() {
        sessionsCalls++
        return []
      },
    },
    storage: {
      local: {
        async get(key) {
          assert.equal(key, SELECTION_STORAGE_KEY)
          return { [SELECTION_STORAGE_KEY]: storedSelectionData }
        },
        async set() {},
      },
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.start()

  assert.deepEqual(app.selectionData, storedSelectionData)
  assert.deepEqual(historyCalls, [
    { text: '', startTime: now - 90 * 24 * 60 * 60 * 1_000, maxResults: 10_000 },
  ])
  assert.equal(sessionsCalls, 0)
  assert.equal(app.searchMode, 'recent')
  assert.equal(app.deep, false)
  assert.equal(app.modeCache.recent.status, 'ready')
  assert.equal(app.modeCache.deep.status, 'idle')
  assert.equal(app.modeCache.closed.status, 'idle')
  assert.equal(app.index, app.modeCache.recent.index)
  assert.equal(app.results.length, 1)
  assert.equal(app.visibleRows.length, 1)
  assert.equal(modeIndicator.dataset.mode, 'recent')
  assert.equal(modeIndicator.dataset.status, 'ready')
  assert.equal(document.querySelector('#status').textContent, '1 recent history URL')
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

test('focusSearch retries do not keep forcing the cursor to the end once the input is focused', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  input.value = 'example.com/docs?tab=readme'
  app.focusMode = 'results'

  app.focusSearch()
  input.setSelectionRange(7, 7)
  await wait(80)

  assert.equal(document.activeElement, input)
  assert.equal(input.selectionStart, 7)
  assert.equal(input.selectionEnd, 7)
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

test('focusSelectedResult focuses a selected real row by visible row index', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const result = searchResult('visited')
  app.visibleRows = buildVisibleRows({ corpusResults: [result], typedUrlCandidate })
  app.selectedIndex = 1

  const resultsList = document.querySelector('#results')
  appendFocusableRow(resultsList, { resultIndex: 0 })
  const selectedButton = appendFocusableRow(resultsList, { resultIndex: 1 })

  app.focusSelectedResult()

  assert.equal(document.activeElement, selectedButton)
})

test('focusSelectedResult focuses a selected synthetic typed URL row by equivalent visible row index', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  app.visibleRows = buildVisibleRows({ corpusResults: [searchResult('visited')], typedUrlCandidate })
  app.selectedIndex = 0

  const resultsList = document.querySelector('#results')
  const selectedButton = appendFocusableRow(resultsList, { visibleRowIndex: 0 })
  appendFocusableRow(resultsList, { visibleRowIndex: 1 })

  app.focusSelectedResult()

  assert.equal(document.activeElement, selectedButton)
})

test('focusSelectedResult falls back to the results list when the selected row button is absent', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.visibleRows = buildVisibleRows({ corpusResults: [searchResult('visited')] })
  app.selectedIndex = 0

  const resultsList = document.querySelector('#results')

  app.focusSelectedResult()

  assert.equal(document.activeElement, resultsList)
})

test('focusSelectedResult falls back to the results list for a stale selected index', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.visibleRows = []
  app.results = []
  app.selectedIndex = 0

  const resultsList = document.querySelector('#results')
  appendFocusableRow(resultsList, { resultIndex: 0 })

  app.focusSelectedResult()

  assert.equal(document.activeElement, resultsList)
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

test('result navigation shortcuts are ignored when the search input is focused', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  app.results = [searchResult('first'), searchResult('second')]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 0
  app.focusMode = 'results'
  app.bindEvents()
  input.focus()

  const event = dispatchKeydown(input, 'j')

  assert.equal(event.defaultPrevented, false)
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.focusMode, 'results')
  assert.equal(document.activeElement, input)
})

test('result navigation shortcuts are ignored outside result navigation mode', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.results = [searchResult('first'), searchResult('second')]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 0
  app.focusMode = 'search'
  const selectedButton = appendFocusableRow(app.resultsList, { resultIndex: 0 })
  document.activeElement = selectedButton
  app.bindEvents()

  const event = dispatchKeydown(selectedButton, 'j')

  assert.equal(event.defaultPrevented, false)
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.focusMode, 'search')
  assert.equal(document.activeElement, selectedButton)
})

test('unmodified Enter in the search input opens the selected result in a new active tab and closes the command palette', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([historyEntry(1), historyEntry(2)])
  const windowApi = {
    closeCalls: 0,
    close() {
      this.closeCalls++
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi })

  await app.start()
  const input = document.querySelector('#search-input')
  assert.equal(document.activeElement, input)
  const selectedUrl = app.selectedVisibleRow().result.url

  dispatchKeydown(input, 'Enter')
  await settle()

  assert.deepEqual(chromeApi.tabs.opened, [
    { url: selectedUrl, active: true },
  ])
  assert.deepEqual(chromeApi.tabs.updated, [])
  assert.equal(windowApi.closeCalls, 1)
})

test('Escape moves from search entry to result navigation, then keeps the selected result actionable', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([historyEntry(1), historyEntry(2)])
  const windowApi = {
    blurCalls: 0,
    closeCalls: 0,
    blur() { this.blurCalls++ },
    close() { this.closeCalls++ },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi })

  await app.start()
  const input = document.querySelector('#search-input')
  assert.equal(document.activeElement, input)

  input.value = 'scry'
  dispatchInput(input)
  const searchEscape = dispatchKeydown(input, 'Escape')

  assert.equal(searchEscape.defaultPrevented, true)
  assert.equal(app.focusMode, 'results')
  assert.equal(document.activeElement?.dataset.resultIndex, '0')

  const resultEscape = dispatchKeydown(document.activeElement, 'Escape')

  assert.equal(resultEscape.defaultPrevented, true)
  assert.equal(app.focusMode, 'results')
  assert.equal(document.activeElement?.dataset.resultIndex, '0')
  assert.equal(windowApi.blurCalls, 0)
  assert.equal(windowApi.closeCalls, 0)
  const selectedUrl = app.selectedVisibleRow().result.url

  dispatchKeydown(document.activeElement, 'Enter')
  await settle()

  assert.deepEqual(chromeApi.tabs.opened, [
    { url: selectedUrl, active: true },
  ])
  assert.deepEqual(chromeApi.tabs.updated, [])
  assert.equal(windowApi.closeCalls, 1)
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

test('j/k navigate results and unmodified Enter opens the selected result in a new active tab then closes the command palette', async () => {
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
  const selectedUrl = app.selectedVisibleRow().result.url

  dispatchKeydown(document.activeElement, 'Enter')
  await settle()

  assert.deepEqual(chromeApi.tabs.opened, [
    { url: selectedUrl, active: true },
  ])
  assert.deepEqual(chromeApi.tabs.updated, [])
  assert.equal(document.activeElement, null)
  assert.equal(windowApi.closeCalls, 1)
})
