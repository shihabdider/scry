import test from 'node:test'
import assert from 'node:assert/strict'

import { createModeCache } from '../src/core/search-modes.js'

test('createModeCache initializes one idle state for each search mode', () => {
  const cache = createModeCache()

  assert.deepEqual(Object.keys(cache), ['recent', 'deep', 'closed'])
  assert.deepEqual(cache, {
    recent: { mode: 'recent', status: 'idle', index: null, error: null, loadedAt: null },
    deep: { mode: 'deep', status: 'idle', index: null, error: null, loadedAt: null },
    closed: { mode: 'closed', status: 'idle', index: null, error: null, loadedAt: null },
  })
})

test('createModeCache returns independent mutable popup-session cache slots', () => {
  const first = createModeCache()
  const second = createModeCache()
  const index = { builtAt: 123, entries: [] }
  const error = new Error('closed sessions unavailable')

  first.deep.status = 'ready'
  first.deep.index = index
  first.deep.loadedAt = 456
  first.closed.status = 'error'
  first.closed.error = error

  assert.notEqual(first, second)
  assert.notEqual(first.recent, first.deep)
  assert.notEqual(first.recent, second.recent)
  assert.equal(first.deep.index, index)
  assert.equal(first.closed.error, error)
  assert.deepEqual(first.recent, { mode: 'recent', status: 'idle', index: null, error: null, loadedAt: null })
  assert.deepEqual(second, {
    recent: { mode: 'recent', status: 'idle', index: null, error: null, loadedAt: null },
    deep: { mode: 'deep', status: 'idle', index: null, error: null, loadedAt: null },
    closed: { mode: 'closed', status: 'idle', index: null, error: null, loadedAt: null },
  })
})
