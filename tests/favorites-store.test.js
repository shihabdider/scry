import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FAVORITES_STORAGE_KEY,
  loadStoredFavorites,
  removeStoredFavoriteByKey,
  restoreStoredFavoriteRemoval,
  saveFavoriteTarget,
  saveStoredFavorites,
} from '../src/platform/favorites-store.js'

const exampleFavorite = {
  key: 'https://example.com/docs',
  url: 'https://example.com/docs',
  displayUrl: 'example.com/docs',
  title: 'Example docs',
  addedAt: 1_000,
  updatedAt: 1_000,
}
const previousExampleFavorite = {
  ...exampleFavorite,
  title: 'Previous example docs',
}
const olderFavorite = {
  key: 'https://older.example/docs',
  url: 'https://older.example/docs',
  displayUrl: 'older.example/docs',
  title: 'Older docs',
  addedAt: 500,
  updatedAt: 500,
}
const tabTarget = {
  url: 'https://example.com/docs',
  title: 'Example docs',
  source: 'tab',
}
const refreshedTarget = {
  url: 'https://Example.com/docs/?utm_source=news#intro',
  title: 'Example docs updated',
  source: 'tab',
}
const invalidTarget = {
  url: '',
  title: 'Missing URL',
  source: 'page',
}

function storageWith(slot) {
  const getKeys = []
  const writes = []
  return {
    getKeys,
    writes,
    chromeApi: {
      storage: {
        local: {
          async get(key) {
            getKeys.push(key)
            return slot
          },
          async set(value) {
            writes.push(value)
          },
        },
      },
    },
  }
}

test('loadStoredFavorites resolves to an empty list when the storage key is missing', async () => {
  const storage = storageWith({})

  assert.deepEqual(await loadStoredFavorites({ chromeApi: storage.chromeApi }), [])
  assert.deepEqual(storage.getKeys, [FAVORITES_STORAGE_KEY])
})

test('loadStoredFavorites resolves to the stored favorites array when present', async () => {
  const storage = storageWith({ [FAVORITES_STORAGE_KEY]: [exampleFavorite] })

  assert.deepEqual(await loadStoredFavorites({ chromeApi: storage.chromeApi }), [exampleFavorite])
})

test('loadStoredFavorites defaults a malformed storage value to an empty list', async () => {
  const storage = storageWith({ [FAVORITES_STORAGE_KEY]: 'not a list' })

  assert.deepEqual(await loadStoredFavorites({ chromeApi: storage.chromeApi }), [])
})

test('saveStoredFavorites writes an empty favorites list under the Scry favorites key', async () => {
  const storage = storageWith({})

  await saveStoredFavorites([], { chromeApi: storage.chromeApi })

  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [] }])
})

test('saveStoredFavorites writes a singleton favorites list under the Scry favorites key', async () => {
  const storage = storageWith({})

  await saveStoredFavorites([exampleFavorite], { chromeApi: storage.chromeApi })

  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [exampleFavorite] }])
})

test('saveFavoriteTarget persists the first saved favorite and resolves to it', async () => {
  const storage = storageWith({})
  const saved = await saveFavoriteTarget(tabTarget, { chromeApi: storage.chromeApi, now: 2_000 })
  const expectedFavorite = {
    ...exampleFavorite,
    addedAt: 2_000,
    updatedAt: 2_000,
  }

  assert.deepEqual(saved, expectedFavorite)
  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [expectedFavorite] }])
})

test('saveFavoriteTarget refreshes duplicate favorites while preserving addedAt and moving to top', async () => {
  const storage = storageWith({ [FAVORITES_STORAGE_KEY]: [previousExampleFavorite, olderFavorite] })
  const saved = await saveFavoriteTarget(refreshedTarget, { chromeApi: storage.chromeApi, now: 5_000 })
  const expectedFavorite = {
    ...exampleFavorite,
    title: 'Example docs updated',
    addedAt: previousExampleFavorite.addedAt,
    updatedAt: 5_000,
  }

  assert.deepEqual(saved, expectedFavorite)
  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [expectedFavorite, olderFavorite] }])
})

test('saveFavoriteTarget leaves storage unchanged for an invalid target', async () => {
  const storage = storageWith({ [FAVORITES_STORAGE_KEY]: [exampleFavorite] })

  assert.equal(await saveFavoriteTarget(invalidTarget, { chromeApi: storage.chromeApi, now: 6_000 }), null)
  assert.deepEqual(storage.writes, [])
})

test('removeStoredFavoriteByKey persists singleton removal and returns undo data', async () => {
  const storage = storageWith({ [FAVORITES_STORAGE_KEY]: [exampleFavorite] })

  assert.deepEqual(await removeStoredFavoriteByKey(exampleFavorite.key, { chromeApi: storage.chromeApi }), {
    favorites: [],
    undo: { favorite: exampleFavorite, index: 0 },
  })
  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [] }])
})

test('removeStoredFavoriteByKey leaves storage unchanged when the key is missing', async () => {
  const storage = storageWith({ [FAVORITES_STORAGE_KEY]: [exampleFavorite] })

  assert.deepEqual(await removeStoredFavoriteByKey('missing', { chromeApi: storage.chromeApi }), {
    favorites: [exampleFavorite],
    undo: null,
  })
  assert.deepEqual(storage.writes, [])
})

test('removeStoredFavoriteByKey resolves empty favorites when storage is missing and key is missing', async () => {
  const storage = storageWith({})

  assert.deepEqual(await removeStoredFavoriteByKey('missing', { chromeApi: storage.chromeApi }), {
    favorites: [],
    undo: null,
  })
  assert.deepEqual(storage.writes, [])
})

test('restoreStoredFavoriteRemoval leaves storage unchanged when undo is absent', async () => {
  const storage = storageWith({ [FAVORITES_STORAGE_KEY]: [] })

  assert.deepEqual(await restoreStoredFavoriteRemoval(null, { chromeApi: storage.chromeApi }), {
    favorites: [],
    undo: null,
  })
  assert.deepEqual(storage.writes, [])
})

test('restoreStoredFavoriteRemoval restores a present removal and consumes undo', async () => {
  const storage = storageWith({ [FAVORITES_STORAGE_KEY]: [olderFavorite] })

  assert.deepEqual(
    await restoreStoredFavoriteRemoval({ favorite: exampleFavorite, index: 0 }, { chromeApi: storage.chromeApi }),
    {
      favorites: [exampleFavorite, olderFavorite],
      undo: null,
    },
  )
  assert.deepEqual(storage.writes, [{ [FAVORITES_STORAGE_KEY]: [exampleFavorite, olderFavorite] }])
})
