import test from 'node:test'
import assert from 'node:assert/strict'

import { createSearchModeState } from '../src/core/search-modes.js'
import { ScryPanelApp } from '../src/panel/app.js'
import { createScryDocument } from './helpers/fake-dom.js'

const now = Date.parse('2026-04-27T00:00:00Z')

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

function historyEntry(index) {
  return {
    url: `https://github.com/shihabdider/scry/issues/${index}`,
    title: `Scry issue ${index}`,
    visitCount: index,
    lastVisitTime: now - index * 1_000,
  }
}

function createHistoryOnlyChrome(historySearch) {
  return {
    history: {
      search: historySearch,
    },
  }
}

test('loadHistoryMode marks the history popup-session corpus loading while deep Chrome history is in flight', async () => {
  const document = createScryDocument()
  const historyCalls = []
  const deepHistory = createDeferred()
  const chromeApi = createHistoryOnlyChrome(async (query) => {
    historyCalls.push(query)
    return deepHistory.promise
  })
  const clockValues = [now, now + 500]
  const app = new ScryPanelApp({ document, chromeApi, clock: () => clockValues.shift() ?? now + 500, windowApi: { blur() {} } })
  const state = app.searchCache.modes.history

  const loadingPromise = app.loadHistoryMode(state)

  assert.equal(state.status, 'loading')
  assert.equal(state.index, null)
  assert.equal(state.error, null)
  assert.equal(state.loadedAt, null)
  const inFlightPromise = state.loadingPromise
  assert.ok(inFlightPromise instanceof Promise)
  assert.equal(app.loading, true)
  assert.deepEqual(historyCalls, [
    { text: '', startTime: 0, maxResults: 100_000 },
  ])

  deepHistory.resolve([historyEntry(1), historyEntry(2)])
  const [loaded, inFlightLoaded] = await Promise.all([loadingPromise, inFlightPromise])

  assert.equal(loaded, state)
  assert.equal(inFlightLoaded, state)
  assert.equal(state.status, 'ready')
  assert.equal(state.index.entries.length, 2)
  assert.equal(state.index.builtAt, now + 500)
  assert.equal(state.error, null)
  assert.equal(state.loadedAt, now + 500)
  assert.equal(state.loadingPromise, null)
  assert.equal(app.loading, false)
  assert.equal(app.index, state.index)
})

test('loadHistoryMode stores a ready empty history index when deep Chrome history is empty', async () => {
  const document = createScryDocument()
  const chromeApi = createHistoryOnlyChrome(async () => [])
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const state = createSearchModeState('history')

  const loaded = await app.loadHistoryMode(state)

  assert.equal(loaded, state)
  assert.equal(state.status, 'ready')
  assert.deepEqual(state.index.entries, [])
  assert.equal(state.index.builtAt, now)
  assert.equal(state.error, null)
  assert.equal(state.loadedAt, now)
  assert.equal(state.loadingPromise, null)
  assert.equal(app.index, state.index)
})

test('loadHistoryMode records an error state when deep Chrome history cannot be loaded', async () => {
  const document = createScryDocument()
  const failure = new Error('history unavailable')
  const chromeApi = createHistoryOnlyChrome(async () => {
    throw failure
  })
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const state = createSearchModeState('history')

  const loaded = await app.loadHistoryMode(state)

  assert.equal(loaded, state)
  assert.equal(state.status, 'error')
  assert.equal(state.index, null)
  assert.equal(state.error, failure)
  assert.equal(state.loadedAt, null)
  assert.equal(state.loadingPromise, null)
  assert.equal(app.loading, false)
  assert.equal(app.index, null)
})
