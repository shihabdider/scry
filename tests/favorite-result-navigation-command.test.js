import test from 'node:test'
import assert from 'node:assert/strict'

import { favoriteResultNavigationCommandForKey } from '../src/panel/app.js'

test('favoriteResultNavigationCommandForKey maps x to remove in favorites mode when removal is available', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'x' },
      { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: false },
    ),
    'removeSelectedFavorite',
  )
})

test('favoriteResultNavigationCommandForKey maps u to undo in favorites mode when undo is available', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'u' },
      { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: true },
    ),
    'undoFavoriteRemoval',
  )
})

test('favoriteResultNavigationCommandForKey ignores u in favorites mode when no undo is available', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'u' },
      { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: false },
    ),
    'ignore',
  )
})

test('favoriteResultNavigationCommandForKey preserves existing y copy fallback', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'y' },
      { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: true },
    ),
    'copySelected',
  )
})

test('favoriteResultNavigationCommandForKey ignores public-mode x', () => {
  assert.equal(
    favoriteResultNavigationCommandForKey(
      { key: 'x' },
      { inFavoritesMode: false, canRemoveFavorite: true, canUndoFavoriteRemoval: true },
    ),
    'ignore',
  )
})
