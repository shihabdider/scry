import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFavoritesIndex,
  favoriteFromSaveTarget,
  favoritesToHistoryEntries,
  removeFavoriteByKey,
  restoreRemovedFavorite,
  upsertFavoriteUrl,
} from '../src/core/favorites.js'
import { searchHistory } from '../src/core/search.js'

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
const refreshedExampleFavorite = {
  ...exampleFavorite,
  title: 'Example docs updated',
  addedAt: 5_000,
  updatedAt: 5_000,
}
const refreshedExampleFavoriteWithPreviousAddedAt = {
  ...refreshedExampleFavorite,
  addedAt: previousExampleFavorite.addedAt,
}
const newerFavorite = {
  key: 'https://newer.example/docs',
  url: 'https://newer.example/docs',
  displayUrl: 'newer.example/docs',
  title: 'Newer docs',
  addedAt: 2_000,
  updatedAt: 2_000,
}
const olderFavorite = {
  key: 'https://older.example/docs',
  url: 'https://older.example/docs',
  displayUrl: 'older.example/docs',
  title: 'Older docs',
  addedAt: 500,
  updatedAt: 500,
}

test('favoriteFromSaveTarget normalizes a tab target into a stored favorite', () => {
  assert.deepEqual(
    favoriteFromSaveTarget(
      { url: 'https://Example.com/docs/?utm_source=news#intro', title: 'Example Docs', source: 'tab' },
      { now: 2_000 },
    ),
    {
      key: 'https://example.com/docs',
      url: 'https://example.com/docs',
      displayUrl: 'example.com/docs',
      title: 'Example Docs',
      addedAt: 2_000,
      updatedAt: 2_000,
    },
  )
})

test('favoriteFromSaveTarget falls back to displayUrl for an image target without title text', () => {
  assert.deepEqual(
    favoriteFromSaveTarget(
      { url: 'https://cdn.example.com/image.png', title: '', source: 'image' },
      { now: 3_000 },
    ),
    {
      key: 'https://cdn.example.com/image.png',
      url: 'https://cdn.example.com/image.png',
      displayUrl: 'cdn.example.com/image.png',
      title: 'cdn.example.com/image.png',
      addedAt: 3_000,
      updatedAt: 3_000,
    },
  )
})

test('favoriteFromSaveTarget rejects a target without a URL', () => {
  assert.equal(favoriteFromSaveTarget({ url: '', title: 'Missing URL', source: 'page' }, { now: 4_000 }), null)
})

test('upsertFavoriteUrl adds one favorite to an empty list', () => {
  assert.deepEqual(upsertFavoriteUrl([], exampleFavorite), [exampleFavorite])
})

test('upsertFavoriteUrl puts a distinct existing favorite behind the newly saved favorite', () => {
  assert.deepEqual(upsertFavoriteUrl([olderFavorite], newerFavorite), [newerFavorite, olderFavorite])
})

test('upsertFavoriteUrl refreshes an existing key while preserving its original addedAt', () => {
  assert.deepEqual(
    upsertFavoriteUrl([olderFavorite, previousExampleFavorite], refreshedExampleFavorite),
    [refreshedExampleFavoriteWithPreviousAddedAt, olderFavorite],
  )
})

test('removeFavoriteByKey leaves an empty favorites list unchanged', () => {
  assert.deepEqual(removeFavoriteByKey([], 'https://example.com/docs'), { favorites: [], undo: null })
})

test('removeFavoriteByKey removes a singleton favorite and produces undo data', () => {
  assert.deepEqual(removeFavoriteByKey([exampleFavorite], exampleFavorite.key), {
    favorites: [],
    undo: { favorite: exampleFavorite, index: 0 },
  })
})

test('removeFavoriteByKey removes a middle favorite and remembers its previous index', () => {
  assert.deepEqual(removeFavoriteByKey([newerFavorite, olderFavorite], olderFavorite.key), {
    favorites: [newerFavorite],
    undo: { favorite: olderFavorite, index: 1 },
  })
})

test('removeFavoriteByKey leaves favorites unchanged when the key is missing', () => {
  assert.deepEqual(removeFavoriteByKey([exampleFavorite], 'https://missing.example/'), {
    favorites: [exampleFavorite],
    undo: null,
  })
})

test('restoreRemovedFavorite leaves favorites unchanged when undo is absent', () => {
  assert.deepEqual(restoreRemovedFavorite([], null), { favorites: [], undo: null })
})

test('restoreRemovedFavorite restores a removed favorite at index zero', () => {
  assert.deepEqual(restoreRemovedFavorite([olderFavorite], { favorite: newerFavorite, index: 0 }), {
    favorites: [newerFavorite, olderFavorite],
    undo: null,
  })
})

test('restoreRemovedFavorite clamps an out-of-range restore index to the end', () => {
  assert.deepEqual(restoreRemovedFavorite([newerFavorite], { favorite: olderFavorite, index: 9 }), {
    favorites: [newerFavorite, olderFavorite],
    undo: null,
  })
})

test('favoritesToHistoryEntries converts an empty favorites list to no raw entries', () => {
  assert.deepEqual(favoritesToHistoryEntries([]), [])
})

test('favoritesToHistoryEntries converts a singleton favorite to a history-like entry', () => {
  assert.deepEqual(favoritesToHistoryEntries([exampleFavorite]), [
    {
      url: exampleFavorite.url,
      title: exampleFavorite.title,
      visitCount: 1,
      lastVisitTime: exampleFavorite.updatedAt,
    },
  ])
})

test('favoritesToHistoryEntries preserves multiple favorites order and updatedAt recency', () => {
  assert.deepEqual(favoritesToHistoryEntries([newerFavorite, olderFavorite]), [
    {
      url: newerFavorite.url,
      title: newerFavorite.title,
      visitCount: 1,
      lastVisitTime: newerFavorite.updatedAt,
    },
    {
      url: olderFavorite.url,
      title: olderFavorite.title,
      visitCount: 1,
      lastVisitTime: olderFavorite.updatedAt,
    },
  ])
})

test('buildFavoritesIndex builds an empty history index for no favorites', () => {
  assert.deepEqual(buildFavoritesIndex([], { now: 10_000 }), { builtAt: 10_000, entries: [] })
})

test('buildFavoritesIndex includes a singleton favorite as a searchable history entry', () => {
  const index = buildFavoritesIndex([exampleFavorite], { now: 10_000 })

  assert.equal(index.builtAt, 10_000)
  assert.equal(index.entries.length, 1)
  assert.equal(index.entries[0].key, exampleFavorite.key)
  assert.equal(index.entries[0].title, exampleFavorite.title)
  assert.equal(index.entries[0].lastVisitTime, exampleFavorite.updatedAt)
})

test('buildFavoritesIndex makes multiple favorites searchable by URL fragments and titles', () => {
  const index = buildFavoritesIndex([newerFavorite, olderFavorite], { now: 10_000 })

  assert.deepEqual(searchHistory(index, 'newer', { now: 10_000 }).map((result) => result.url), [newerFavorite.url])
  assert.deepEqual(searchHistory(index, 'Older', { now: 10_000 }).map((result) => result.url), [olderFavorite.url])
})
