import test from 'node:test'
import assert from 'node:assert/strict'

import { resultNavigationCommandForKey } from '../src/panel/app.js'

test('resultNavigationCommandForKey maps search-focus keys to focusSearch', () => {
  assert.equal(resultNavigationCommandForKey({ key: 'i' }), 'focusSearch')
  assert.equal(resultNavigationCommandForKey({ key: 'I' }), 'focusSearch')
  assert.equal(resultNavigationCommandForKey({ key: '/' }), 'focusSearch')
})

test('resultNavigationCommandForKey maps Escape to leavePanelFocus', () => {
  assert.equal(resultNavigationCommandForKey({ key: 'Escape' }), 'leavePanelFocus')
})

test('resultNavigationCommandForKey keeps selected-row commands distinct', () => {
  assert.equal(resultNavigationCommandForKey({ key: 'y' }), 'copySelected')
  assert.equal(resultNavigationCommandForKey({ key: 'c' }), 'editSelectedUrl')
  assert.equal(resultNavigationCommandForKey({ key: 'j' }), 'moveNext')
  assert.equal(resultNavigationCommandForKey({ key: 'k' }), 'movePrevious')
  assert.equal(resultNavigationCommandForKey({ key: 'l' }), 'nextPage')
  assert.equal(resultNavigationCommandForKey({ key: 'h' }), 'previousPage')
  assert.equal(resultNavigationCommandForKey({ key: 'Enter' }), 'openSelected')
})

test('resultNavigationCommandForKey ignores normal typing, unknown keys, and missing keys', () => {
  assert.equal(resultNavigationCommandForKey({ key: 'a' }), 'ignore')
  assert.equal(resultNavigationCommandForKey({ key: ' ' }), 'ignore')
  assert.equal(resultNavigationCommandForKey({ key: '/open' }), 'ignore')
  assert.equal(resultNavigationCommandForKey({}), 'ignore')
})
