import test from 'node:test'
import assert from 'node:assert/strict'

import { selectedFavoriteRowActionHints, selectedRowActionHints } from '../src/core/rows.js'

const resultRow = {
  kind: 'result',
  key: 'result:https://example.com/docs',
  copied: false,
  result: {
    key: 'https://example.com/docs',
    url: 'https://example.com/docs',
    displayUrl: 'example.com/docs',
  },
}

test('selectedFavoriteRowActionHints returns no hints for an unselected favorites row', () => {
  assert.deepEqual(
    selectedFavoriteRowActionHints(resultRow, { selected: false, inFavoritesMode: true, canUndoFavoriteRemoval: true }),
    [],
  )
})

test('selectedFavoriteRowActionHints preserves public-mode selected row hints', () => {
  assert.deepEqual(
    selectedFavoriteRowActionHints(resultRow, { selected: true, inFavoritesMode: false, canUndoFavoriteRemoval: true }),
    selectedRowActionHints(resultRow, { selected: true }),
  )
})

test('selectedFavoriteRowActionHints adds remove after ordinary hints in favorites mode', () => {
  assert.deepEqual(
    selectedFavoriteRowActionHints(resultRow, { selected: true, inFavoritesMode: true, canUndoFavoriteRemoval: false }),
    [
      { action: 'copy', key: 'Ctrl+Y', label: 'copy' },
      { action: 'edit-url', key: 'Ctrl+E', label: 'edit URL' },
      { action: 'remove-favorite', key: 'Ctrl+X', label: 'remove' },
    ],
  )
})

test('selectedFavoriteRowActionHints adds both remove and undo hints in favorites mode with undo available', () => {
  assert.deepEqual(
    selectedFavoriteRowActionHints(resultRow, { selected: true, inFavoritesMode: true, canUndoFavoriteRemoval: true }),
    [
      { action: 'copy', key: 'Ctrl+Y', label: 'copy' },
      { action: 'edit-url', key: 'Ctrl+E', label: 'edit URL' },
      { action: 'remove-favorite', key: 'Ctrl+X', label: 'remove' },
      { action: 'undo-remove-favorite', key: 'Ctrl+U', label: 'undo' },
    ],
  )
})
