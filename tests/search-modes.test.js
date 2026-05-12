import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createHistoryCorpusState,
  HISTORY_CORPUS_ID,
  historyCorpusStatusText,
  historySearchHeaderModel,
  historySearchSurfaceModel,
} from '../src/core/search-modes.js'

test('createHistoryCorpusState initializes the idle popup-session history corpus', () => {
  assert.deepEqual(createHistoryCorpusState(), {
    corpus: HISTORY_CORPUS_ID,
    status: 'idle',
    index: null,
    error: null,
    loadedAt: null,
  })
})

test('createHistoryCorpusState returns independent mutable corpus state objects', () => {
  const first = createHistoryCorpusState()
  const second = createHistoryCorpusState()
  const index = { builtAt: 123, entries: [] }
  const error = new Error('history unavailable')

  first.status = 'ready'
  first.index = index
  first.loadedAt = 456
  second.status = 'error'
  second.error = error

  assert.notEqual(first, second)
  assert.equal(first.index, index)
  assert.equal(second.error, error)
  assert.deepEqual(createHistoryCorpusState(), {
    corpus: 'history',
    status: 'idle',
    index: null,
    error: null,
    loadedAt: null,
  })
})

function historyCorpusState({ status = 'idle', entries = null, error = null } = {}) {
  return {
    corpus: 'history',
    status,
    index: entries === null ? null : { builtAt: 123, entries },
    error,
    loadedAt: status === 'ready' ? 456 : null,
  }
}

test('historyCorpusStatusText reports single history surface status text', () => {
  assert.equal(historyCorpusStatusText(null), 'History not loaded')
  assert.equal(historyCorpusStatusText(historyCorpusState()), 'History not loaded')
  assert.equal(historyCorpusStatusText(historyCorpusState({ status: 'loading' })), 'Loading history…')
  assert.equal(historyCorpusStatusText(historyCorpusState({ status: 'ready', entries: [] })), '0 history URLs')
  assert.equal(historyCorpusStatusText(historyCorpusState({ status: 'ready', entries: [{}] })), '1 history URL')
  assert.equal(historyCorpusStatusText(historyCorpusState({ status: 'ready', entries: [{}, {}] })), '2 history URLs')
  assert.equal(historyCorpusStatusText(historyCorpusState({ status: 'error', error: new Error('history unavailable') })), 'History unavailable')
})

test('historySearchSurfaceModel builds a non-clickable history corpus badge model', () => {
  assert.deepEqual(historySearchSurfaceModel(null), {
    label: 'history',
    corpus: 'history',
    status: 'idle',
    clickable: false,
    modeSwitchHint: '',
    statusText: 'History not loaded',
  })

  assert.equal(historySearchSurfaceModel(historyCorpusState({ status: 'loading' })).statusText, 'Loading history…')
  assert.equal(historySearchSurfaceModel(historyCorpusState({ status: 'ready', entries: [{}, {}] })).statusText, '2 history URLs')
  assert.equal(historySearchSurfaceModel(historyCorpusState({ status: 'error' })).statusText, 'History unavailable')
})

test('historySearchHeaderModel builds the single Search history header without switch hints', () => {
  assert.deepEqual(historySearchHeaderModel(null), {
    beforeMode: 'Search',
    modeBadgeLabel: 'history',
    corpus: 'history',
    afterMode: '',
    modeSwitchHint: '',
    status: 'idle',
    statusText: 'History not loaded',
  })

  const model = historySearchHeaderModel(historyCorpusState({ status: 'ready', entries: [{}, {}, {}] }), { realResultCount: 1 })
  assert.equal(model.statusText, '3 history URLs')
  assert.equal(model.modeBadgeLabel, 'history')
  assert.equal(model.modeSwitchHint, '')
  assert.equal('realResultCount' in model, false)
})
