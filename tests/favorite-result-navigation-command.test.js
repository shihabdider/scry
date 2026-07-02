import test from 'node:test'
import assert from 'node:assert/strict'

import { favoriteResultNavigationCommandForKey } from '../src/panel/app.js'

test('favoriteResultNavigationCommandForKey maps Ctrl+X to remove in favorites mode when removal is available', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'x', ctrlKey: true },
      { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: false },
    ),
    'removeSelectedFavorite',
  )
})

test('favoriteResultNavigationCommandForKey maps Ctrl+U to undo in favorites mode when undo is available', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'u', ctrlKey: true },
      { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: true },
    ),
    'undoFavoriteRemoval',
  )
})

test('favoriteResultNavigationCommandForKey uses Ctrl+U as previous page when no undo is available', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'u', ctrlKey: true },
      { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: false },
    ),
    'previousPage',
  )
})

test('favoriteResultNavigationCommandForKey ignores plain favorite action letters', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'x' },
      { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: true },
    ),
    'ignore',
  )
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'u' },
      { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: true },
    ),
    'ignore',
  )
})

test('favoriteResultNavigationCommandForKey preserves Ctrl+Y copy fallback', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'y', ctrlKey: true },
      { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: true },
    ),
    'copySelected',
  )
})

test('favoriteResultNavigationCommandForKey ignores public-mode Ctrl+X', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'x', ctrlKey: true },
      { inFavoritesMode: false, canRemoveFavorite: true, canUndoFavoriteRemoval: true },
    ),
    'ignore',
  )
})
