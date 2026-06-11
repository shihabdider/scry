import test from 'node:test'
import assert from 'node:assert/strict'

import { parseFavoritesCommand } from '../src/core/favorites-command.js'

test('parseFavoritesCommand accepts the shortest favorites command', () => {
  assert.deepEqual(parseFavoritesCommand(':f'), {
    kind: 'enter-favorites',
    raw: ':f',
    commandText: ':f',
  })
})

test('parseFavoritesCommand accepts intermediate favorites command prefixes with surrounding whitespace', () => {
  assert.deepEqual(parseFavoritesCommand(' :fav '), {
    kind: 'enter-favorites',
    raw: ' :fav ',
    commandText: ':fav',
  })
})

test('parseFavoritesCommand accepts the full favorites command', () => {
  assert.deepEqual(parseFavoritesCommand(':favorite'), {
    kind: 'enter-favorites',
    raw: ':favorite',
    commandText: ':favorite',
  })
})

test('parseFavoritesCommand rejects the invalid plural favorites command', () => {
  assert.deepEqual(parseFavoritesCommand(':favorites'), {
    kind: 'not-favorites-command',
    raw: ':favorites',
  })
})

test('parseFavoritesCommand leaves ordinary search text as not a favorites command', () => {
  assert.deepEqual(parseFavoritesCommand('git issues'), {
    kind: 'not-favorites-command',
    raw: 'git issues',
  })
})
