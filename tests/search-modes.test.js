import test from 'node:test'
import assert from 'node:assert/strict'

import { createModeCache, cycleSearchMode, modeIndicatorModel, searchHeaderModel } from '../src/core/search-modes.js'

test('createModeCache initializes one idle state for each search mode', () => {
  const cache = createModeCache()

  assert.deepEqual(Object.keys(cache), ['recent', 'closed', 'deep'])
  assert.deepEqual(cache, {
    recent: { mode: 'recent', status: 'idle', index: null, error: null, loadedAt: null },
    closed: { mode: 'closed', status: 'idle', index: null, error: null, loadedAt: null },
    deep: { mode: 'deep', status: 'idle', index: null, error: null, loadedAt: null },
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
    closed: { mode: 'closed', status: 'idle', index: null, error: null, loadedAt: null },
    deep: { mode: 'deep', status: 'idle', index: null, error: null, loadedAt: null },
  })
})

test('cycleSearchMode cycles forward through recent, closed, deep', () => {
  assert.equal(cycleSearchMode('recent'), 'closed')
  assert.equal(cycleSearchMode('closed'), 'deep')
  assert.equal(cycleSearchMode('deep'), 'recent')
})

test('cycleSearchMode cycles backward through recent, deep, closed', () => {
  assert.equal(cycleSearchMode('recent', { direction: -1 }), 'deep')
  assert.equal(cycleSearchMode('deep', { direction: -1 }), 'closed')
  assert.equal(cycleSearchMode('closed', { direction: -1 }), 'recent')
})

test('cycleSearchMode defaults invalid current modes to recent', () => {
  assert.equal(cycleSearchMode('archived'), 'recent')
  assert.equal(cycleSearchMode(undefined), 'recent')
  assert.equal(cycleSearchMode(null, { direction: -1 }), 'recent')
})

function modeState(mode, { status = 'idle', entries = null, error = null } = {}) {
  return {
    mode,
    status,
    index: entries === null ? null : { builtAt: 123, entries },
    error,
    loadedAt: status === 'ready' ? 456 : null,
  }
}

test('modeIndicatorModel returns plain clickable badge labels and the mode-switch hint for every search mode', () => {
  assert.deepEqual(modeIndicatorModel('recent', modeState('recent')), {
    label: 'recent',
    mode: 'recent',
    status: 'idle',
    clickable: true,
    modeSwitchHint: 'Tab/Shift+Tab',
    statusText: 'Recent history not loaded',
  })
  assert.deepEqual(modeIndicatorModel('closed', modeState('closed')), {
    label: 'closed',
    mode: 'closed',
    status: 'idle',
    clickable: true,
    modeSwitchHint: 'Tab/Shift+Tab',
    statusText: 'Recently closed URLs not loaded',
  })
  assert.deepEqual(modeIndicatorModel('deep', modeState('deep')), {
    label: 'deep',
    mode: 'deep',
    status: 'idle',
    clickable: true,
    modeSwitchHint: 'Tab/Shift+Tab',
    statusText: 'Deep history not loaded',
  })
})

test('modeIndicatorModel treats a null state as the active mode idle badge', () => {
  assert.deepEqual(modeIndicatorModel('recent', null), {
    label: 'recent',
    mode: 'recent',
    status: 'idle',
    clickable: true,
    modeSwitchHint: 'Tab/Shift+Tab',
    statusText: 'Recent history not loaded',
  })
})

test('modeIndicatorModel reports loading text for active mode loads', () => {
  assert.equal(modeIndicatorModel('recent', modeState('recent', { status: 'loading' })).statusText, 'Loading recent history…')
  assert.equal(modeIndicatorModel('deep', modeState('deep', { status: 'loading' })).statusText, 'Loading deep history…')
  assert.equal(modeIndicatorModel('closed', modeState('closed', { status: 'loading' })).statusText, 'Loading recently closed URLs…')
})

test('modeIndicatorModel reports ready text with active corpus counts', () => {
  assert.equal(modeIndicatorModel('recent', modeState('recent', { status: 'ready', entries: [{}, {}] })).statusText, '2 recent history URLs')
  assert.equal(modeIndicatorModel('deep', modeState('deep', { status: 'ready', entries: [{}] })).statusText, '1 deep history URL')
  assert.equal(modeIndicatorModel('closed', modeState('closed', { status: 'ready', entries: [] })).statusText, '0 recently closed URLs')
})

test('modeIndicatorModel reports mode-local errors without disabling mode switching', () => {
  assert.deepEqual(modeIndicatorModel('closed', modeState('closed', { status: 'error', error: new Error('sessions unavailable') })), {
    label: 'closed',
    mode: 'closed',
    status: 'error',
    clickable: true,
    modeSwitchHint: 'Tab/Shift+Tab',
    statusText: 'Recently closed URLs unavailable',
  })
})

test('searchHeaderModel builds a sparse Search mode history model with active-mode status text', () => {
  assert.deepEqual(searchHeaderModel('recent', null), {
    beforeMode: 'Search',
    modeBadgeLabel: 'recent',
    mode: 'recent',
    afterMode: 'history',
    modeSwitchHint: 'Tab/Shift+Tab',
    status: 'idle',
    statusText: 'Recent history not loaded',
  })
})

test('searchHeaderModel uses corpus total status text instead of caller-supplied visible result counts', () => {
  const readyRecent = modeState('recent', { status: 'ready', entries: [{}, {}, {}, {}, {}] })
  const model = searchHeaderModel('recent', readyRecent, { realResultCount: 1 })

  assert.equal(model.statusText, '5 recent history URLs')
  assert.equal(model.modeBadgeLabel, 'recent')
  assert.equal('realResultCount' in model, false)
  assert.equal('realResultCountLabel' in model, false)
})

test('searchHeaderModel preserves mode-specific loading and error status text', () => {
  assert.deepEqual(
    {
      modeBadgeLabel: searchHeaderModel('deep', modeState('deep', { status: 'loading' })).modeBadgeLabel,
      status: searchHeaderModel('deep', modeState('deep', { status: 'loading' })).status,
      statusText: searchHeaderModel('deep', modeState('deep', { status: 'loading' })).statusText,
      modeSwitchHint: searchHeaderModel('deep', modeState('deep', { status: 'loading' })).modeSwitchHint,
    },
    {
      modeBadgeLabel: 'deep',
      status: 'loading',
      statusText: 'Loading deep history…',
      modeSwitchHint: 'Tab/Shift+Tab',
    },
  )

  assert.deepEqual(
    {
      modeBadgeLabel: searchHeaderModel('closed', modeState('closed', { status: 'error', error: new Error('sessions unavailable') })).modeBadgeLabel,
      status: searchHeaderModel('closed', modeState('closed', { status: 'error', error: new Error('sessions unavailable') })).status,
      statusText: searchHeaderModel('closed', modeState('closed', { status: 'error', error: new Error('sessions unavailable') })).statusText,
    },
    {
      modeBadgeLabel: 'closed',
      status: 'error',
      statusText: 'Recently closed URLs unavailable',
    },
  )
})
