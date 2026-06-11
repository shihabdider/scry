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

function appendSearchHeader(document) {
  const header = document.createElement('div')
  header.setAttribute('id', 'search-header')

  const before = document.createElement('span')
  before.setAttribute('id', 'search-header-before')

  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')
  modeIndicator.hidden = true

  const after = document.createElement('span')
  after.setAttribute('id', 'search-header-after')

  const hint = document.createElement('span')
  hint.setAttribute('id', 'mode-switch-hint')

  const count = document.createElement('span')
  count.setAttribute('id', 'result-count')

  header.append(before, modeIndicator, after, hint, count)
  document.body.append(header)
  return { before, modeIndicator, after, hint, count }
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

test('activeSearchModeState returns the default history popup-session search corpus state', () => {
  const document = createScryDocument()
  const app = new ScryPanelApp({ document, chromeApi: createPanelChrome([]), clock: () => now, windowApi: { blur() {} } })

  assert.equal(app.activeSearchModeState(), app.searchCache.modes.history)
  assert.equal(app.activeSearchModeState()?.mode, 'history')
})

test('activeSearchModeState returns the closed popup-session search corpus state when active', () => {
  const document = createScryDocument()
  const app = new ScryPanelApp({ document, chromeApi: createPanelChrome([]), clock: () => now, windowApi: { blur() {} } })

  app.searchCache.activeMode = 'closed'

  assert.equal(app.activeSearchModeState(), app.searchCache.modes.closed)
  assert.equal(app.activeSearchModeState()?.mode, 'closed')
})

test('activeSearchModeState returns null when there is no active history or closed cache state', () => {
  const document = createScryDocument()
  const app = new ScryPanelApp({ document, chromeApi: createPanelChrome([]), clock: () => now, windowApi: { blur() {} } })

  app.searchCache = null
  assert.equal(app.activeSearchModeState(), null)

  app.searchCache = { activeMode: 'recent', modes: { history: {}, closed: {} } }
  assert.equal(app.activeSearchModeState(), null)
})

test('emptyQuerySortForMode uses frecency for the default history popup-session corpus', () => {
  const document = createScryDocument()
  const app = new ScryPanelApp({ document, chromeApi: createPanelChrome([]), clock: () => now, windowApi: { blur() {} } })

  assert.equal(app.emptyQuerySortForMode(), 'frecency')
  assert.equal(app.emptyQuerySortForMode('history'), 'frecency')
})

test('emptyQuerySortForMode uses recency for recently closed empty-query results', () => {
  const document = createScryDocument()
  const app = new ScryPanelApp({ document, chromeApi: createPanelChrome([]), clock: () => now, windowApi: { blur() {} } })

  assert.equal(app.emptyQuerySortForMode('closed'), 'recency')

  app.searchMode = 'closed'
  assert.equal(app.emptyQuerySortForMode(), 'recency')
})

test('resultMessagesForMode uses history copy by default', () => {
  const document = createScryDocument()
  const app = new ScryPanelApp({ document, chromeApi: createPanelChrome([]), clock: () => now, windowApi: { blur() {} } })

  assert.deepEqual(app.resultMessagesForMode(), {
    empty: 'No history results yet.',
    noMatches: 'No matches in history.',
    error: 'History unavailable.',
  })
  assert.deepEqual(app.resultMessagesForMode('history'), {
    empty: 'No history results yet.',
    noMatches: 'No matches in history.',
    error: 'History unavailable.',
  })
})

test('resultMessagesForMode uses recently closed copy when closed mode is active or requested', () => {
  const document = createScryDocument()
  const app = new ScryPanelApp({ document, chromeApi: createPanelChrome([]), clock: () => now, windowApi: { blur() {} } })

  assert.deepEqual(app.resultMessagesForMode('closed'), {
    empty: 'No recently closed URLs yet.',
    noMatches: 'No matches in recently closed URLs.',
    error: 'Recently closed URLs unavailable.',
  })

  app.searchMode = 'closed'
  assert.deepEqual(app.resultMessagesForMode(), {
    empty: 'No recently closed URLs yet.',
    noMatches: 'No matches in recently closed URLs.',
    error: 'Recently closed URLs unavailable.',
  })
})

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
  app.focusMode = 'results'

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

test('renderResults adds selected real-row action hints to the meta line only on the selected row', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const first = searchResult('first-hintless-row')
  const selected = searchResult('selected-real-row')
  app.results = [first, selected]
  app.visibleRows = buildVisibleRows({ corpusResults: [first, selected] })
  app.selectedIndex = 1
  app.focusMode = 'results'

  app.renderResults()

  const results = document.querySelector('#results')
  const firstButton = results.children[0].children[0]
  const selectedButton = results.children[1].children[0]
  const firstHtml = firstButton.innerHTML
  const selectedHtml = selectedButton.innerHTML

  assert.doesNotMatch(results.children[0].className, /\bselected\b/)
  assert.equal(firstButton.getAttribute('aria-current'), 'false')
  assert.doesNotMatch(firstHtml, /\by copy\b/)
  assert.doesNotMatch(firstHtml, /\bc edit URL\b/)
  assert.match(results.children[1].className, /\bselected\b/)
  assert.equal(selectedButton.getAttribute('aria-current'), 'true')
  assert.match(selectedHtml, /class="result-meta"[\s\S]*3 visits · now[\s\S]*y copy[\s\S]*c edit URL/)
})

test('renderResults suppresses selected styling, aria-current, and selected-row hints in input mode', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const first = searchResult('input-mode-first')
  const selectedActionTarget = searchResult('input-mode-action-target')
  app.results = [first, selectedActionTarget]
  app.visibleRows = buildVisibleRows({ corpusResults: [first, selectedActionTarget] })
  app.selectedIndex = 1
  app.focusMode = 'search'

  app.renderResults()

  const results = document.querySelector('#results')
  assert.equal(app.selectedIndex, 1)
  assert.doesNotMatch(results.children[0].className, /\bselected\b/)
  assert.doesNotMatch(results.children[1].className, /\bselected\b/)
  assert.equal(results.children[0].children[0].getAttribute('aria-current'), 'false')
  assert.equal(results.children[1].children[0].getAttribute('aria-current'), 'false')
  assert.doesNotMatch(results.children[0].children[0].innerHTML, /\by copy\b/)
  assert.doesNotMatch(results.children[0].children[0].innerHTML, /\bc edit URL\b/)
  assert.doesNotMatch(results.children[1].children[0].innerHTML, /\by copy\b/)
  assert.doesNotMatch(results.children[1].children[0].innerHTML, /\bc edit URL\b/)
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
  app.searchCache.activeMode = 'closed'
  app.searchCache.modes.history = { ...app.searchCache.modes.history, status: 'ready', index: staleIndex, loadedAt: now }
  app.searchCache.modes.closed = { ...app.searchCache.modes.closed, status: 'error', index: null, error: new Error('sessions unavailable') }
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

test('switchSearchMode shows closed errors with a typed URL row while preserving the history cache', async () => {
  const document = createScryDocument()
  appendSearchHeader(document)
  const chromeApi = createPanelChrome([])
  chromeApi.history.search = async () => [historyEntry(1)]
  chromeApi.sessions = {
    getRecentlyClosed() {
      return Promise.reject(new Error('sessions unavailable'))
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.start()
  const input = document.querySelector('#search-input')
  const historyIndex = app.searchCache.modes.history.index
  input.value = 'typed.example/path#fragment'

  const closedState = await app.switchSearchMode('closed')

  assert.equal(closedState.status, 'error')
  assert.equal(app.searchMode, 'closed')
  assert.equal(app.index, null)
  assert.deepEqual(app.results, [])
  assert.equal(app.message.textContent, 'Recently closed URLs unavailable.')
  assert.equal(app.visibleRows[0]?.kind, 'open-typed-url')
  assert.deepEqual(app.visibleRows[0]?.candidate, {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  })
  assert.equal(app.searchCache.modes.history.index, historyIndex)

  const historyState = await app.switchSearchMode('history')

  assert.equal(historyState.status, 'ready')
  assert.equal(historyState.index, historyIndex)
  assert.equal(app.index, historyIndex)
  assert.equal(app.searchMode, 'history')
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

test('openSelected opens a real visible row in an incognito popup without recording selection learning', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  chromeApi.extension = { inIncognitoContext: true }
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
  const existingSelectionData = {
    version: 1,
    aggregates: {
      'docs install': {
        [docsResult.key]: {
          count: 2,
          lastSelectedAt: now - 1,
          selectedAt: [now - 2, now - 1],
        },
      },
    },
  }
  const originalSelectionData = structuredClone(existingSelectionData)
  app.selectionData = existingSelectionData
  app.input.value = 'docs install'
  app.results = [docsResult]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 0
  let updateCalls = 0
  app.updateResults = () => {
    updateCalls++
  }

  await app.openSelected({ newTab: false })

  assert.deepEqual(chromeApi.tabs.updated, [
    { id: 101, change: { url: 'https://example.com/docs?tab=readme' } },
  ])
  assert.deepEqual(chromeApi.tabs.opened, [])
  assert.equal(app.selectionData, existingSelectionData)
  assert.deepEqual(app.selectionData, originalSelectionData)
  assert.deepEqual(selectionWrites, [])
  assert.equal(updateCalls, 0)
  assert.equal(windowApi.closeCalls, 1)
})

test('openSelected opens a real favorites-mode row in an incognito popup and records selection learning', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  chromeApi.extension = { inIncognitoContext: true }
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
  const favoriteResult = {
    ...searchResult('secret'),
    key: 'https://secret.example/',
    url: 'https://secret.example/',
    displayUrl: 'secret.example',
    title: 'Secret',
    urlHtml: 'secret.example',
    titleHtml: 'Secret',
  }
  app.searchMode = 'favorites'
  app.input.value = 'secret favorite'
  app.results = [favoriteResult]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 0
  let updateCalls = 0
  app.updateResults = () => {
    updateCalls++
  }

  await app.openSelected({ newTab: false })

  const expectedSelectionData = {
    version: 1,
    aggregates: {
      'secret favorite': {
        [favoriteResult.key]: {
          count: 1,
          lastSelectedAt: now,
          selectedAt: [now],
        },
      },
    },
  }
  assert.deepEqual(chromeApi.tabs.updated, [
    { id: 101, change: { url: 'https://secret.example/' } },
  ])
  assert.deepEqual(chromeApi.tabs.opened, [])
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

test('result navigation i returns to search input, resets top selection, and clears selected row rendering', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  input.value = 'github issue'
  input.setSelectionRange(0, 0)
  app.results = Array.from({ length: 8 }, (_, index) => searchResult(`input-return-${index + 1}`))
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 7
  app.pageIndex = 1
  app.focusMode = 'results'
  app.renderResults()
  const selectedButton = document.activeElement
  assert.match(app.resultsList.children[1].className, /\bselected\b/)
  app.bindEvents()

  const event = dispatchKeydown(selectedButton, 'i')

  assert.equal(event.defaultPrevented, true)
  assert.equal(app.focusMode, 'search')
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.equal(document.activeElement, input)
  assert.equal(input.value, 'github issue')
  assert.equal(input.selectionStart, input.value.length)
  assert.equal(input.selectionEnd, input.value.length)
  for (const item of app.resultsList.children) {
    assert.doesNotMatch(item.className, /\bselected\b/)
    assert.equal(item.children[0].getAttribute('aria-current'), 'false')
    assert.doesNotMatch(item.children[0].innerHTML, /\by copy\b/)
    assert.doesNotMatch(item.children[0].innerHTML, /\bc edit URL\b/)
  }
})

test('result navigation slash returns to search input without changing the query or triggering row actions', () => {
  const document = createScryDocument()
  const writes = []
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({
    document,
    chromeApi,
    clock: () => now,
    windowApi: { blur() {} },
    navigatorApi: createClipboardNavigator(writes),
  })
  const input = document.querySelector('#search-input')
  app.results = [searchResult('first'), searchResult('second')]
  app.visibleRows = buildVisibleRows({ corpusResults: app.results })
  app.selectedIndex = 1
  app.focusMode = 'results'
  input.value = 'github issue'
  input.setSelectionRange(0, 0)
  app.renderResults()
  const selectedButton = document.activeElement
  app.bindEvents()

  const event = dispatchKeydown(selectedButton, '/')

  assert.equal(event.defaultPrevented, true)
  assert.equal(app.focusMode, 'search')
  assert.equal(app.selectedIndex, 0)
  assert.equal(app.pageIndex, 0)
  assert.equal(document.activeElement, input)
  assert.equal(input.value, 'github issue')
  assert.equal(input.selectionStart, input.value.length)
  assert.equal(input.selectionEnd, input.value.length)
  for (const item of app.resultsList.children) {
    assert.doesNotMatch(item.className, /\bselected\b/)
    assert.equal(item.children[0].getAttribute('aria-current'), 'false')
  }
  assert.deepEqual(chromeApi.tabs.opened, [])
  assert.deepEqual(chromeApi.tabs.updated, [])
  assert.deepEqual(writes, [])
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

test('focusResults enters result-navigation mode from search mode by selecting and focusing the first visible row', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.visibleRows = buildVisibleRows({ corpusResults: [searchResult('first'), searchResult('second')] })
  app.selectedIndex = 1
  app.focusMode = 'search'

  const firstButton = appendFocusableRow(app.resultsList, { visibleRowIndex: 0 })
  appendFocusableRow(app.resultsList, { visibleRowIndex: 1 })

  app.focusResults()

  assert.equal(app.focusMode, 'results')
  assert.equal(app.selectedIndex, 0)
  assert.equal(document.activeElement, firstButton)
})

test('focusResults preserves the current selected row when already in result-navigation mode', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.visibleRows = buildVisibleRows({ corpusResults: [searchResult('first'), searchResult('second')] })
  app.selectedIndex = 1
  app.focusMode = 'results'

  appendFocusableRow(app.resultsList, { visibleRowIndex: 0 })
  const secondButton = appendFocusableRow(app.resultsList, { visibleRowIndex: 1 })

  app.focusResults()

  assert.equal(app.focusMode, 'results')
  assert.equal(app.selectedIndex, 1)
  assert.equal(document.activeElement, secondButton)
})

test('focusResults enters result-navigation mode and focuses the list when there are no visible rows', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.visibleRows = []
  app.results = []
  app.selectedIndex = 3
  app.focusMode = 'search'

  app.focusResults()

  assert.equal(app.focusMode, 'results')
  assert.equal(document.activeElement, app.resultsList)
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

test('typing slash in search input is not intercepted as a mode shortcut', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const input = document.querySelector('#search-input')
  app.bindEvents()
  app.focusSearch()

  const event = dispatchKeydown(input, '/')

  assert.equal(event.defaultPrevented, false)
  assert.equal(app.focusMode, 'search')
  assert.equal(document.activeElement, input)
})

test('ArrowDown from the search input enters result navigation before arrow-key navigation continues', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([historyEntry(1), historyEntry(2), historyEntry(3)])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.start()
  const input = document.querySelector('#search-input')
  assert.equal(document.activeElement, input)

  const event = dispatchKeydown(input, 'ArrowDown')

  assert.equal(event.defaultPrevented, true)
  assert.equal(app.focusMode, 'results')
  assert.equal(app.selectedIndex, 0)
  assert.equal(document.activeElement?.dataset.resultIndex, '0')

  const downAgain = dispatchKeydown(document.activeElement, 'ArrowDown')

  assert.equal(downAgain.defaultPrevented, true)
  assert.equal(app.selectedIndex, 1)
  assert.equal(document.activeElement?.dataset.resultIndex, '1')

  const upAgain = dispatchKeydown(document.activeElement, 'ArrowUp')

  assert.equal(upAgain.defaultPrevented, true)
  assert.equal(app.selectedIndex, 0)
  assert.equal(document.activeElement?.dataset.resultIndex, '0')
})

test('Ctrl+N from the search input enters result navigation without advancing past the first visible row', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([historyEntry(1), historyEntry(2), historyEntry(3)])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.start()
  const input = document.querySelector('#search-input')
  app.selectedIndex = 2

  const event = dispatchKeydown(input, 'n', { ctrlKey: true })

  assert.equal(event.defaultPrevented, true)
  assert.equal(app.focusMode, 'results')
  assert.equal(app.selectedIndex, 0)
  assert.equal(document.activeElement?.dataset.resultIndex, '0')
})

test('ArrowUp and Ctrl+P from the search input enter result navigation at the first visible row', async () => {
  const arrowDocument = createScryDocument()
  const arrowChromeApi = createPanelChrome([historyEntry(1), historyEntry(2), historyEntry(3)])
  const arrowApp = new ScryPanelApp({ document: arrowDocument, chromeApi: arrowChromeApi, clock: () => now, windowApi: { blur() {} } })

  await arrowApp.start()
  const arrowInput = arrowDocument.querySelector('#search-input')
  arrowApp.selectedIndex = 2

  const arrowEvent = dispatchKeydown(arrowInput, 'ArrowUp')

  assert.equal(arrowEvent.defaultPrevented, true)
  assert.equal(arrowApp.focusMode, 'results')
  assert.equal(arrowApp.selectedIndex, 0)
  assert.equal(arrowDocument.activeElement?.dataset.resultIndex, '0')

  const ctrlDocument = createScryDocument()
  const ctrlChromeApi = createPanelChrome([historyEntry(1), historyEntry(2), historyEntry(3)])
  const ctrlApp = new ScryPanelApp({ document: ctrlDocument, chromeApi: ctrlChromeApi, clock: () => now, windowApi: { blur() {} } })

  await ctrlApp.start()
  const ctrlInput = ctrlDocument.querySelector('#search-input')
  ctrlApp.selectedIndex = 2

  const ctrlEvent = dispatchKeydown(ctrlInput, 'p', { ctrlKey: true })

  assert.equal(ctrlEvent.defaultPrevented, true)
  assert.equal(ctrlApp.focusMode, 'results')
  assert.equal(ctrlApp.selectedIndex, 0)
  assert.equal(ctrlDocument.activeElement?.dataset.resultIndex, '0')
})

test('ArrowDown from the search input enters result navigation and focuses the list when no rows are visible', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.start()
  const input = document.querySelector('#search-input')
  assert.equal(app.visibleRows.length, 0)

  const event = dispatchKeydown(input, 'ArrowDown')

  assert.equal(event.defaultPrevented, true)
  assert.equal(app.focusMode, 'results')
  assert.equal(document.activeElement, app.resultsList)
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

test('Escape moves from search entry to result navigation, then result Escape closes without row actions', async () => {
  const document = createScryDocument()
  const writes = []
  const chromeApi = createPanelChrome([historyEntry(1), historyEntry(2)])
  const windowApi = {
    blurCalls: 0,
    closeCalls: 0,
    blur() { this.blurCalls++ },
    close() { this.closeCalls++ },
  }
  const app = new ScryPanelApp({
    document,
    chromeApi,
    clock: () => now,
    windowApi,
    navigatorApi: createClipboardNavigator(writes),
  })

  await app.start()
  const input = document.querySelector('#search-input')
  assert.equal(document.activeElement, input)

  input.value = 'scry'
  dispatchInput(input)
  const searchEscape = dispatchKeydown(input, 'Escape')

  assert.equal(searchEscape.defaultPrevented, true)
  assert.equal(app.focusMode, 'results')
  assert.equal(input.value, 'scry')
  assert.equal(document.activeElement?.dataset.resultIndex, '0')

  const resultEscape = dispatchKeydown(document.activeElement, 'Escape')

  assert.equal(resultEscape.defaultPrevented, true)
  assert.equal(app.focusMode, 'blurred')
  assert.equal(document.activeElement, null)
  assert.equal(windowApi.blurCalls, 0)
  assert.equal(windowApi.closeCalls, 1)
  assert.equal(input.value, 'scry')
  assert.deepEqual(chromeApi.tabs.opened, [])
  assert.deepEqual(chromeApi.tabs.updated, [])
  assert.deepEqual(writes, [])
})

test('Escape from result navigation falls back to window blur when close is unavailable', () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const windowApi = {
    blurCalls: 0,
    blur() { this.blurCalls++ },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi })
  app.focusMode = 'results'
  app.results = []
  app.visibleRows = []
  app.selectedIndex = 0
  app.resultsList.focus()
  app.bindEvents()

  const event = dispatchKeydown(app.resultsList, 'Escape')

  assert.equal(event.defaultPrevented, true)
  assert.equal(app.focusMode, 'blurred')
  assert.equal(document.activeElement, null)
  assert.equal(windowApi.blurCalls, 1)
})

test('double Escape leaves the panel even when there are no visible result rows', async () => {
  const document = createScryDocument()
  const chromeApi = createPanelChrome([])
  const windowApi = {
    closeCalls: 0,
    close() { this.closeCalls++ },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi })

  await app.start()
  const input = document.querySelector('#search-input')
  assert.equal(document.activeElement, input)
  assert.equal(app.visibleRows.length, 0)

  const searchEscape = dispatchKeydown(input, 'Escape')

  assert.equal(searchEscape.defaultPrevented, true)
  assert.equal(app.focusMode, 'results')
  assert.equal(document.activeElement, app.resultsList)
  assert.equal(app.visibleRows.length, 0)

  const resultEscape = dispatchKeydown(app.resultsList, 'Escape')

  assert.equal(resultEscape.defaultPrevented, true)
  assert.equal(app.focusMode, 'blurred')
  assert.equal(document.activeElement, null)
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

test('ensureSearchModeReady loads and reuses history and closed popup-session search corpora', async () => {
  const document = createScryDocument()
  const historyCalls = []
  const sessionCalls = []
  const chromeApi = createPanelChrome([])
  chromeApi.history.search = async (query) => {
    historyCalls.push(query)
    return [historyEntry(1)]
  }
  chromeApi.sessions = {
    getRecentlyClosed(...args) {
      sessionCalls.push(args)
      return Promise.resolve([
        {
          tab: { url: 'https://example.com/closed', title: 'Closed tab' },
          lastModified: Math.floor(now / 1_000),
        },
      ])
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  const firstHistory = await app.ensureSearchModeReady('history')
  const secondHistory = await app.ensureSearchModeReady('history')
  const firstClosed = await app.ensureSearchModeReady('closed')
  const secondClosed = await app.ensureSearchModeReady('closed')

  assert.equal(firstHistory, secondHistory)
  assert.equal(firstHistory.status, 'ready')
  assert.equal(firstHistory.mode, 'history')
  assert.equal(firstHistory.index.entries.length, 1)
  assert.equal(firstClosed, secondClosed)
  assert.equal(firstClosed.status, 'ready')
  assert.equal(firstClosed.mode, 'closed')
  assert.equal(firstClosed.index.entries.length, 1)
  assert.equal(app.searchMode, 'closed')
  assert.equal(app.searchCache.activeMode, 'closed')
  assert.equal(app.index, firstClosed.index)
  assert.deepEqual(historyCalls, [
    { text: '', startTime: 0, maxResults: 100_000 },
  ])
  assert.deepEqual(sessionCalls, [[]])
})

test('ensureSearchModeReady normalizes legacy modes to the default history corpus', async () => {
  const document = createScryDocument()
  const historyCalls = []
  const chromeApi = createPanelChrome([])
  chromeApi.history.search = async (query) => {
    historyCalls.push(query)
    return [historyEntry(1)]
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.searchCache = null
  app.searchMode = 'recent'

  const state = await app.ensureSearchModeReady('deep')

  assert.equal(state.status, 'ready')
  assert.equal(state.mode, 'history')
  assert.equal(app.searchMode, 'history')
  assert.equal(app.searchCache.activeMode, 'history')
  assert.deepEqual(historyCalls, [
    { text: '', startTime: 0, maxResults: 100_000 },
  ])
})

test('renderSearchSurface renders a clickable two-mode corpus badge and switch hint', () => {
  const document = createScryDocument()
  const { modeIndicator, after, hint, count } = appendSearchHeader(document)
  const app = new ScryPanelApp({ document, chromeApi: createPanelChrome([]), clock: () => now, windowApi: { blur() {} } })
  app.searchCache.modes.history = {
    ...app.searchCache.modes.history,
    status: 'ready',
    index: buildHistoryIndex([historyEntry(1), historyEntry(2)], { now }),
    loadedAt: now,
  }

  const model = app.renderSearchSurface()

  assert.deepEqual(model, {
    label: 'history',
    mode: 'history',
    status: 'ready',
    clickable: true,
    modeSwitchHint: 'Tab / Shift+Tab',
    statusText: '2 history URLs',
  })
  assert.equal(modeIndicator.textContent, 'history')
  assert.equal(modeIndicator.dataset.corpus, 'history')
  assert.equal(modeIndicator.dataset.mode, 'history')
  assert.equal(modeIndicator.dataset.clickable, 'true')
  assert.equal(modeIndicator.disabled, false)
  assert.equal(modeIndicator.getAttribute('aria-label'), 'history; 2 history URLs')
  assert.equal(after.textContent, '')
  assert.equal(hint.hidden, false)
  assert.equal(hint.textContent, 'Tab / Shift+Tab')
  assert.equal(count.textContent, '2 history URLs')
  assert.equal(document.querySelector('#search-input').getAttribute('aria-label'), 'Search history')
})

test('start loads selection data and the deep history corpus by default', async () => {
  const document = createScryDocument()
  const { modeIndicator } = appendSearchHeader(document)
  const historyCalls = []
  const chromeApi = createPanelChrome([])
  chromeApi.history.search = async (query) => {
    historyCalls.push(query)
    return [historyEntry(1), historyEntry(2)]
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.start()

  assert.deepEqual(historyCalls, [
    { text: '', startTime: 0, maxResults: 100_000 },
  ])
  assert.equal(app.searchCache.modes.history.status, 'ready')
  assert.equal(app.searchCache.modes.history.index.entries.length, 2)
  assert.equal(app.index, app.searchCache.modes.history.index)
  assert.equal(app.searchMode, 'history')
  assert.equal(modeIndicator.dataset.corpus, 'history')
  assert.equal(modeIndicator.dataset.mode, 'history')
  assert.equal(modeIndicator.dataset.clickable, 'true')
})

test('Tab, Shift+Tab, and corpus badge clicks switch between history and closed without changing the query', async () => {
  const document = createScryDocument()
  const { modeIndicator } = appendSearchHeader(document)
  const historyCalls = []
  const sessionCalls = []
  const chromeApi = createPanelChrome([])
  chromeApi.history.search = async (query) => {
    historyCalls.push(query)
    return [historyEntry(1)]
  }
  chromeApi.sessions = {
    getRecentlyClosed(...args) {
      sessionCalls.push(args)
      return Promise.resolve([
        {
          tab: { url: 'https://example.com/closed', title: 'Closed tab' },
          lastModified: Math.floor(now / 1_000),
        },
      ])
    },
  }
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })

  await app.start()
  const input = document.querySelector('#search-input')
  input.value = 'scry issue'
  const tab = dispatchKeydown(input, 'Tab')
  await settle()
  const shiftTab = dispatchKeydown(input, 'Tab', { shiftKey: true })
  await settle()
  const click = modeIndicator.dispatchEvent({ type: 'click', bubbles: true })
  await settle()

  assert.equal(tab.defaultPrevented, true)
  assert.equal(shiftTab.defaultPrevented, true)
  assert.equal(click, false)
  assert.equal(input.value, 'scry issue')
  assert.equal(app.searchMode, 'closed')
  assert.equal(app.searchCache.modes.history.status, 'ready')
  assert.equal(app.searchCache.modes.closed.status, 'ready')
  assert.equal(modeIndicator.dataset.corpus, 'closed')
  assert.deepEqual(historyCalls, [
    { text: '', startTime: 0, maxResults: 100_000 },
  ])
  assert.deepEqual(sessionCalls, [[]])
})
