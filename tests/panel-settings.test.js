import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVisibleRows } from '../src/core/rows.js'
import { normalizeScrySettings, SCRY_SETTINGS_STORAGE_KEY } from '../src/core/settings.js'
import { ScryPanelApp } from '../src/panel/app.js'
import { createScryDocument, dispatchKeydown } from './helpers/fake-dom.js'

const now = Date.parse('2026-07-02T00:00:00Z')

function searchResult(index) {
  return {
    key: `https://example.com/${index}`,
    url: `https://example.com/${index}`,
    displayUrl: `example.com/${index}`,
    title: `Example ${index}`,
    visitsLabel: '1 visit',
    lastVisitedLabel: 'now',
    urlHtml: `example.com/${index}`,
    titleHtml: `Example ${index}`,
  }
}

function appendSearchHeader(document) {
  const header = document.createElement('div')
  header.setAttribute('id', 'search-header')

  const before = document.createElement('span')
  before.setAttribute('id', 'search-header-before')

  const modeIndicator = document.createElement('button')
  modeIndicator.setAttribute('id', 'mode-indicator')

  const after = document.createElement('span')
  after.setAttribute('id', 'search-header-after')

  const hint = document.createElement('span')
  hint.setAttribute('id', 'mode-switch-hint')

  const count = document.createElement('span')
  count.setAttribute('id', 'result-count')

  header.append(before, modeIndicator, after, hint, count)
  document.body.append(header)
  return { modeIndicator, hint }
}

function panelChrome(slot = {}) {
  const listeners = []
  return {
    listeners,
    chromeApi: {
      history: {
        async search() {
          return []
        },
      },
      storage: {
        local: {
          async get(key) {
            return { [key]: slot[key] }
          },
          async set(value) {
            Object.assign(slot, value)
          },
        },
        onChanged: {
          addListener(listener) {
            listeners.push(listener)
          },
          removeListener(listener) {
            const index = listeners.indexOf(listener)
            if (index >= 0) listeners.splice(index, 1)
          },
        },
      },
      tabs: {
        async query() {
          return []
        },
      },
      runtime: {},
    },
  }
}

function appWithRows({ settings = null } = {}) {
  const document = createScryDocument()
  const header = appendSearchHeader(document)
  const chrome = panelChrome(settings ? { [SCRY_SETTINGS_STORAGE_KEY]: settings } : {})
  const app = new ScryPanelApp({ document, chromeApi: chrome.chromeApi, clock: () => now, windowApi: { blur() {} } })
  app.results = Array.from({ length: 7 }, (_, index) => searchResult(index + 1))
  app.visibleRows = buildVisibleRows({ corpusResults: app.results, now })
  app.selectedIndex = 0
  app.pageIndex = 0
  return { app, document, header, chrome }
}

test('ScryPanelApp.applySettings updates visible key-hint labels', () => {
  const { app, document, header } = appWithRows()
  const settings = normalizeScrySettings({
    version: 1,
    shortcuts: {
      switchMode: 'Alt+M',
      copySelected: 'Alt+C',
      editSelectedUrl: 'Alt+E',
      previousPage: 'Alt+K',
      nextPage: 'Alt+J',
    },
  })

  app.applySettings(settings)

  assert.equal(header.hint.textContent, 'Alt+M')
  assert.equal(document.querySelector('#previous-page-button').textContent, 'Alt+K previous')
  assert.equal(document.querySelector('#next-page-button').textContent, 'Alt+J next')
  assert.match(document.querySelector('#results').children[0].children[0].innerHTML, /Alt\+C copy/)
  assert.match(document.querySelector('#results').children[0].children[0].innerHTML, /Alt\+E edit URL/)
})

test('ScryPanelApp loads saved settings before rendering popup hints', async () => {
  const settings = normalizeScrySettings({ version: 1, shortcuts: { switchMode: 'Alt+M' } })
  const { app, header } = appWithRows({ settings })

  await app.loadSettings()

  assert.equal(app.settings.shortcuts.switchMode, 'Alt+M')
  assert.equal(header.hint.textContent, 'Alt+M')
})

test('ScryPanelApp watches local settings changes and updates shortcuts', () => {
  const { app, header, chrome } = appWithRows()
  app.bindSettingsStorageChanges()

  chrome.listeners[0]({
    [SCRY_SETTINGS_STORAGE_KEY]: {
      newValue: { version: 1, shortcuts: { switchMode: 'Alt+M' } },
    },
  }, 'local')

  assert.equal(app.settings.shortcuts.switchMode, 'Alt+M')
  assert.equal(header.hint.textContent, 'Alt+M')
})

test('plain custom row shortcuts still type normally in the search input', () => {
  const { app, document } = appWithRows()
  app.applySettings({ version: 1, shortcuts: { copySelected: 'c', switchMode: 'm' } })
  app.bindEvents()
  app.copySelectedRow = async () => {
    throw new Error('plain text input should not copy')
  }
  app.handleFilterModeShortcut = async () => {
    throw new Error('plain text input should not switch modes')
  }

  const copyLetter = dispatchKeydown(document.querySelector('#search-input'), 'c')
  const switchLetter = dispatchKeydown(document.querySelector('#search-input'), 'm')

  assert.equal(copyLetter.defaultPrevented, false)
  assert.equal(switchLetter.defaultPrevented, false)
})

test('custom mode switch shortcut works in the search input and the replaced default stops switching', () => {
  const { app, document } = appWithRows()
  app.applySettings({ version: 1, shortcuts: { switchMode: 'Alt+M' } })
  app.bindEvents()
  app.handleFilterModeShortcut = async () => {
    app.searchMode = 'closed'
  }

  const oldShortcut = dispatchKeydown(document.querySelector('#search-input'), 'q', { ctrlKey: true })
  assert.equal(oldShortcut.defaultPrevented, false)
  assert.equal(app.searchMode, 'history')

  const newShortcut = dispatchKeydown(document.querySelector('#search-input'), 'm', { altKey: true })
  assert.equal(newShortcut.defaultPrevented, true)
  assert.equal(app.searchMode, 'closed')
})
