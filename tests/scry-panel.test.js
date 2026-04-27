import test from 'node:test'
import assert from 'node:assert/strict'

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
