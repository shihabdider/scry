import test from 'node:test'
import assert from 'node:assert/strict'

import {
  favoritesModeIndicatorModel,
  favoritesSearchHeaderModel,
  hiddenSearchModeExitTarget,
  isHiddenSearchMode,
} from '../src/core/search-modes.js'

test('isHiddenSearchMode recognizes favorites as hidden', () => {
  assert.equal(isHiddenSearchMode('favorites'), true)
})

test('isHiddenSearchMode rejects public history mode', () => {
  assert.equal(isHiddenSearchMode('history'), false)
})

test('isHiddenSearchMode rejects invalid mode names', () => {
  assert.equal(isHiddenSearchMode('archived'), false)
})

test('hiddenSearchModeExitTarget restores previous history mode', () => {
  assert.equal(hiddenSearchModeExitTarget('history'), 'history')
})

test('hiddenSearchModeExitTarget restores previous closed mode', () => {
  assert.equal(hiddenSearchModeExitTarget('closed'), 'closed')
})

test('hiddenSearchModeExitTarget defaults hidden favorites mode to history', () => {
  assert.equal(hiddenSearchModeExitTarget('favorites'), 'history')
})

test('hiddenSearchModeExitTarget defaults null to history', () => {
  assert.equal(hiddenSearchModeExitTarget(null), 'history')
})

test('favoritesModeIndicatorModel returns an idle favorites badge for null state', () => {
  assert.deepEqual(favoritesModeIndicatorModel(null), {
    label: 'favorites',
    mode: 'favorites',
    status: 'idle',
    clickable: false,
    modeSwitchHint: 'Tab to return',
    statusText: 'Favorites not loaded',
  })
})

test('favoritesModeIndicatorModel reports loading favorites status text', () => {
  assert.deepEqual(
    favoritesModeIndicatorModel({ mode: 'favorites', status: 'loading', index: null, error: null, loadedAt: null }),
    {
      label: 'favorites',
      mode: 'favorites',
      status: 'loading',
      clickable: false,
      modeSwitchHint: 'Tab to return',
      statusText: 'Loading favorites…',
    },
  )
})

test('favoritesModeIndicatorModel reports ready favorites counts', () => {
  assert.deepEqual(
    favoritesModeIndicatorModel({ mode: 'favorites', status: 'ready', index: { builtAt: 1, entries: [{}, {}] }, error: null, loadedAt: 1 }),
    {
      label: 'favorites',
      mode: 'favorites',
      status: 'ready',
      clickable: false,
      modeSwitchHint: 'Tab to return',
      statusText: '2 favorite URLs',
    },
  )
})

test('favoritesModeIndicatorModel reports favorites storage errors as unavailable', () => {
  assert.deepEqual(
    favoritesModeIndicatorModel({ mode: 'favorites', status: 'error', index: null, error: new Error('storage unavailable'), loadedAt: null }),
    {
      label: 'favorites',
      mode: 'favorites',
      status: 'error',
      clickable: false,
      modeSwitchHint: 'Tab to return',
      statusText: 'Favorites unavailable',
    },
  )
})

test('favoritesSearchHeaderModel builds an idle hidden favorites search header', () => {
  assert.deepEqual(favoritesSearchHeaderModel(null), {
    beforeMode: 'Search',
    modeBadgeLabel: 'favorites',
    mode: 'favorites',
    afterMode: 'favorites',
    modeSwitchHint: 'Tab to return',
    status: 'idle',
    statusText: 'Favorites not loaded',
  })
})

test('favoritesSearchHeaderModel reports ready singleton favorites status', () => {
  assert.deepEqual(
    favoritesSearchHeaderModel({ mode: 'favorites', status: 'ready', index: { builtAt: 1, entries: [{}] }, error: null, loadedAt: 1 }),
    {
      beforeMode: 'Search',
      modeBadgeLabel: 'favorites',
      mode: 'favorites',
      afterMode: 'favorites',
      modeSwitchHint: 'Tab to return',
      status: 'ready',
      statusText: '1 favorite URL',
    },
  )
})
