import test from 'node:test'
import assert from 'node:assert/strict'

import {
  favoriteTargetFromActiveTab,
  favoriteTargetFromContextMenu,
  handleFavoriteCommand,
  handleFavoriteContextMenuClick,
  installFavoriteBackgroundHandlers,
  registerFavoriteContextMenus,
} from '../background.js'
import { FAVORITES_STORAGE_KEY } from '../src/platform/favorites-store.js'

function listenerEvent() {
  const listeners = []
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener)
    },
  }
}

function storageWith(slot) {
  let currentSlot = slot
  const getKeys = []
  const writes = []
  const chromeApi = {
    storage: {
      local: {
        async get(key) {
          getKeys.push(key)
          return currentSlot
        },
        async set(value) {
          writes.push(value)
          currentSlot = { ...currentSlot, ...value }
        },
      },
    },
  }

  return { chromeApi, getKeys, writes, currentSlot: () => currentSlot }
}

function favoriteSaveChrome({ slot = {}, tabs = [] } = {}) {
  const storage = storageWith(slot)
  const tabQueries = []
  storage.chromeApi.tabs = {
    async query(query) {
      tabQueries.push(query)
      return tabs
    },
  }

  return { ...storage, tabQueries }
}

test('favoriteTargetFromActiveTab produces a tab save target with title', () => {
  assert.deepEqual(
    favoriteTargetFromActiveTab({ url: 'https://example.com/docs', title: 'Example docs' }),
    { url: 'https://example.com/docs', title: 'Example docs', source: 'tab' },
  )
})

test('favoriteTargetFromActiveTab keeps title undefined when Chrome omits it', () => {
  assert.deepEqual(
    favoriteTargetFromActiveTab({ url: 'https://example.com/docs' }),
    { url: 'https://example.com/docs', title: undefined, source: 'tab' },
  )
})

test('favoriteTargetFromActiveTab rejects a tab without a URL', () => {
  assert.equal(favoriteTargetFromActiveTab({ title: 'Missing URL' }), null)
})

test('favoriteTargetFromContextMenu produces a page save target', () => {
  assert.deepEqual(
    favoriteTargetFromContextMenu(
      { menuItemId: 'scry-save-favorite:page', pageUrl: 'https://example.com/docs' },
      { title: 'Example docs' },
    ),
    { url: 'https://example.com/docs', title: 'Example docs', source: 'page' },
  )
})

test('favoriteTargetFromContextMenu produces a link save target', () => {
  assert.deepEqual(
    favoriteTargetFromContextMenu(
      { menuItemId: 'scry-save-favorite:link', linkUrl: 'https://example.com/download' },
      { title: 'Example docs' },
    ),
    { url: 'https://example.com/download', title: 'Example docs', source: 'link' },
  )
})

test('favoriteTargetFromContextMenu produces an image save target from srcUrl', () => {
  assert.deepEqual(
    favoriteTargetFromContextMenu(
      { menuItemId: 'scry-save-favorite:image', srcUrl: 'https://cdn.example.com/img.png' },
      { title: 'Example docs' },
    ),
    { url: 'https://cdn.example.com/img.png', title: 'Example docs', source: 'image' },
  )
})

test('favoriteTargetFromContextMenu produces a frame save target from frameUrl', () => {
  assert.deepEqual(
    favoriteTargetFromContextMenu(
      { menuItemId: 'scry-save-favorite:frame', frameUrl: 'https://frame.example.com/' },
      { title: 'Frame host' },
    ),
    { url: 'https://frame.example.com/', title: 'Frame host', source: 'frame' },
  )
})

test('favoriteTargetFromContextMenu rejects unknown Scry favorite menu items', () => {
  assert.equal(
    favoriteTargetFromContextMenu(
      { menuItemId: 'unknown', pageUrl: 'https://example.com/docs' },
      { title: 'Example docs' },
    ),
    null,
  )
})

test('registerFavoriteContextMenus removes old items and creates one local save item for each URL-bearing context', () => {
  const created = []
  let removeAllCalls = 0
  const chromeApi = {
    contextMenus: {
      removeAll() {
        removeAllCalls++
      },
      create(item) {
        created.push(item)
      },
    },
  }

  registerFavoriteContextMenus({ chromeApi })

  assert.equal(removeAllCalls, 1)
  assert.deepEqual(created.map((item) => item.id), [
    'scry-save-favorite:page',
    'scry-save-favorite:link',
    'scry-save-favorite:image',
    'scry-save-favorite:video',
    'scry-save-favorite:audio',
    'scry-save-favorite:frame',
  ])
})

test('registerFavoriteContextMenus creates menu items with one matching Chrome context each', () => {
  const created = []
  const chromeApi = {
    contextMenus: {
      removeAll() {},
      create(item) {
        created.push(item)
      },
    },
  }

  registerFavoriteContextMenus({ chromeApi })

  assert.deepEqual(created.map((item) => item.contexts), [
    ['page'],
    ['link'],
    ['image'],
    ['video'],
    ['audio'],
    ['frame'],
  ])
})

test('handleFavoriteCommand queries the active tab and saves a matching command target locally', async () => {
  const chrome = favoriteSaveChrome({
    tabs: [{ url: 'https://Example.com/docs?utm_source=news#intro', title: 'Example docs' }],
  })
  const expectedFavorite = {
    key: 'https://example.com/docs',
    url: 'https://example.com/docs',
    displayUrl: 'example.com/docs',
    title: 'Example docs',
    addedAt: 2_000,
    updatedAt: 2_000,
  }

  assert.deepEqual(
    await handleFavoriteCommand('save-current-tab-as-favorite', { chromeApi: chrome.chromeApi, now: 2_000 }),
    expectedFavorite,
  )
  assert.deepEqual(chrome.tabQueries, [{ active: true, currentWindow: true }])
  assert.deepEqual(chrome.writes, [{ [FAVORITES_STORAGE_KEY]: [expectedFavorite] }])
})

test('handleFavoriteCommand no-ops an unknown command without querying tabs or writing storage', async () => {
  const chrome = favoriteSaveChrome({ tabs: [{ url: 'https://example.com/docs', title: 'Example docs' }] })

  assert.equal(await handleFavoriteCommand('unknown', { chromeApi: chrome.chromeApi, now: 2_000 }), null)
  assert.deepEqual(chrome.tabQueries, [])
  assert.deepEqual(chrome.writes, [])
})

test('handleFavoriteCommand resolves to null when the active tab has no URL', async () => {
  const chrome = favoriteSaveChrome({ tabs: [{ title: 'Missing URL' }] })

  assert.equal(
    await handleFavoriteCommand('save-current-tab-as-favorite', { chromeApi: chrome.chromeApi, now: 2_000 }),
    null,
  )
  assert.deepEqual(chrome.tabQueries, [{ active: true, currentWindow: true }])
  assert.deepEqual(chrome.writes, [])
})

test('handleFavoriteContextMenuClick saves a page target locally', async () => {
  const storage = storageWith({})
  const expectedFavorite = {
    key: 'https://example.com/docs',
    url: 'https://example.com/docs',
    displayUrl: 'example.com/docs',
    title: 'Example docs',
    addedAt: 2_000,
    updatedAt: 2_000,
  }

  assert.deepEqual(
    await handleFavoriteContextMenuClick(
      { menuItemId: 'scry-save-favorite:page', pageUrl: 'https://example.com/docs' },
      { title: 'Example docs' },
      { chromeApi: storage.chromeApi, now: 2_000 },
    ),
    expectedFavorite,
  )
  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [expectedFavorite] }])
})

test('handleFavoriteContextMenuClick saves a link target locally', async () => {
  const storage = storageWith({})
  const expectedFavorite = {
    key: 'https://example.com/download',
    url: 'https://example.com/download',
    displayUrl: 'example.com/download',
    title: 'Example docs',
    addedAt: 2_000,
    updatedAt: 2_000,
  }

  assert.deepEqual(
    await handleFavoriteContextMenuClick(
      { menuItemId: 'scry-save-favorite:link', linkUrl: 'https://example.com/download' },
      { title: 'Example docs' },
      { chromeApi: storage.chromeApi, now: 2_000 },
    ),
    expectedFavorite,
  )
  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [expectedFavorite] }])
})

test('handleFavoriteContextMenuClick no-ops an unknown menu item without writing storage', async () => {
  const storage = storageWith({})

  assert.equal(
    await handleFavoriteContextMenuClick(
      { menuItemId: 'unknown', pageUrl: 'https://example.com/docs' },
      { title: 'Example docs' },
      { chromeApi: storage.chromeApi, now: 2_000 },
    ),
    null,
  )
  assert.deepEqual(storage.writes, [])
})

test('installFavoriteBackgroundHandlers registers context menus on install and startup', () => {
  const created = []
  let removeAllCalls = 0
  const chromeApi = {
    runtime: {
      onInstalled: listenerEvent(),
      onStartup: listenerEvent(),
    },
    commands: {
      onCommand: listenerEvent(),
    },
    contextMenus: {
      onClicked: listenerEvent(),
      removeAll() {
        removeAllCalls++
      },
      create(item) {
        created.push(item)
      },
    },
  }

  installFavoriteBackgroundHandlers({ chromeApi })
  chromeApi.runtime.onInstalled.listeners[0]()
  chromeApi.runtime.onStartup.listeners[0]()

  assert.equal(chromeApi.runtime.onInstalled.listeners.length, 1)
  assert.equal(chromeApi.runtime.onStartup.listeners.length, 1)
  assert.equal(removeAllCalls, 2)
  assert.deepEqual(created.map((item) => item.id), [
    'scry-save-favorite:page',
    'scry-save-favorite:link',
    'scry-save-favorite:image',
    'scry-save-favorite:video',
    'scry-save-favorite:audio',
    'scry-save-favorite:frame',
    'scry-save-favorite:page',
    'scry-save-favorite:link',
    'scry-save-favorite:image',
    'scry-save-favorite:video',
    'scry-save-favorite:audio',
    'scry-save-favorite:frame',
  ])
})

test('installFavoriteBackgroundHandlers routes command events to the active-tab favorite handler', async () => {
  const chrome = favoriteSaveChrome({
    tabs: [{ url: 'https://example.com/docs', title: 'Example docs' }],
  })
  chrome.chromeApi.runtime = {
    onInstalled: listenerEvent(),
    onStartup: listenerEvent(),
  }
  chrome.chromeApi.commands = {
    onCommand: listenerEvent(),
  }
  chrome.chromeApi.contextMenus = {
    onClicked: listenerEvent(),
  }

  installFavoriteBackgroundHandlers({ chromeApi: chrome.chromeApi })
  const saved = await chrome.chromeApi.commands.onCommand.listeners[0]('save-current-tab-as-favorite')

  assert.deepEqual(saved, {
    key: 'https://example.com/docs',
    url: 'https://example.com/docs',
    displayUrl: 'example.com/docs',
    title: 'Example docs',
    addedAt: saved.addedAt,
    updatedAt: saved.updatedAt,
  })
  assert.equal(typeof saved.addedAt, 'number')
  assert.deepEqual(chrome.tabQueries, [{ active: true, currentWindow: true }])
  assert.deepEqual(chrome.currentSlot()[FAVORITES_STORAGE_KEY].map((favorite) => favorite.key), ['https://example.com/docs'])
})

test('installFavoriteBackgroundHandlers routes context-menu click events to the context favorite handler', async () => {
  const storage = storageWith({})
  storage.chromeApi.runtime = {
    onInstalled: listenerEvent(),
    onStartup: listenerEvent(),
  }
  storage.chromeApi.commands = {
    onCommand: listenerEvent(),
  }
  storage.chromeApi.contextMenus = {
    onClicked: listenerEvent(),
  }

  installFavoriteBackgroundHandlers({ chromeApi: storage.chromeApi })
  const saved = await storage.chromeApi.contextMenus.onClicked.listeners[0](
    { menuItemId: 'scry-save-favorite:link', linkUrl: 'https://example.com/download' },
    { title: 'Example docs' },
  )

  assert.deepEqual(saved, {
    key: 'https://example.com/download',
    url: 'https://example.com/download',
    displayUrl: 'example.com/download',
    title: 'Example docs',
    addedAt: saved.addedAt,
    updatedAt: saved.updatedAt,
  })
  assert.equal(typeof saved.updatedAt, 'number')
  assert.deepEqual(storage.currentSlot()[FAVORITES_STORAGE_KEY].map((favorite) => favorite.key), ['https://example.com/download'])
})
