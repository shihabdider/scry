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

function createSessionsOnlyChrome(getRecentlyClosed) {
  return {
    sessions: {
      getRecentlyClosed,
      restore() {
        assert.fail('loadClosedMode must not restore recently closed sessions')
      },
    },
  }
}

function entrySummary(entry) {
  return {
    url: entry.url,
    title: entry.title,
    visitCount: entry.visitCount,
    lastVisitTime: entry.lastVisitTime,
  }
}

test('loadClosedMode marks the recently closed popup-session corpus loading while Chrome sessions are in flight', async () => {
  const document = createScryDocument()
  const sessionCalls = []
  const recentlyClosed = createDeferred()
  const chromeApi = createSessionsOnlyChrome((...args) => {
    sessionCalls.push(args)
    return recentlyClosed.promise
  })
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const state = app.searchCache.modes.closed
  const standaloneClosedAtSeconds = Math.floor((now - 5_000) / 1_000)
  const windowClosedAtSeconds = Math.floor((now - 60_000) / 1_000)

  const loadingPromise = app.loadClosedMode(state)

  assert.equal(state.status, 'loading')
  assert.equal(state.index, null)
  assert.equal(state.error, null)
  assert.equal(state.loadedAt, null)
  const inFlightPromise = state.loadingPromise
  assert.ok(inFlightPromise instanceof Promise)
  assert.equal(app.loading, true)
  assert.deepEqual(sessionCalls, [[]])

  recentlyClosed.resolve([
    {
      tab: { url: 'https://example.com/solo', title: 'Solo tab' },
      lastModified: standaloneClosedAtSeconds,
    },
    {
      window: {
        tabs: [
          { url: 'https://example.com/a', title: 'Window A' },
          { url: 'https://example.com/b', title: 'Window B' },
        ],
      },
      lastModified: windowClosedAtSeconds,
    },
  ])
  const [loaded, inFlightLoaded] = await Promise.all([loadingPromise, inFlightPromise])

  assert.equal(loaded, state)
  assert.equal(inFlightLoaded, state)
  assert.equal(state.status, 'ready')
  assert.deepEqual(state.index.entries.map(entrySummary), [
    {
      url: 'https://example.com/solo',
      title: 'Solo tab',
      visitCount: 1,
      lastVisitTime: standaloneClosedAtSeconds * 1_000,
    },
    {
      url: 'https://example.com/a',
      title: 'Window A',
      visitCount: 1,
      lastVisitTime: windowClosedAtSeconds * 1_000,
    },
    {
      url: 'https://example.com/b',
      title: 'Window B',
      visitCount: 1,
      lastVisitTime: windowClosedAtSeconds * 1_000,
    },
  ])
  assert.equal(state.index.builtAt, now)
  assert.equal(state.error, null)
  assert.equal(state.loadedAt, now)
  assert.equal(state.loadingPromise, null)
  assert.equal(app.loading, false)
  assert.equal(app.index, state.index)
})

test('loadClosedMode stores a ready empty recently closed index when Chrome sessions are empty', async () => {
  const document = createScryDocument()
  const chromeApi = createSessionsOnlyChrome(() => Promise.resolve([]))
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const state = createSearchModeState('closed')

  const loaded = await app.loadClosedMode(state)

  assert.equal(loaded, state)
  assert.equal(state.status, 'ready')
  assert.deepEqual(state.index.entries, [])
  assert.equal(state.index.builtAt, now)
  assert.equal(state.error, null)
  assert.equal(state.loadedAt, now)
  assert.equal(state.loadingPromise, null)
  assert.equal(app.index, state.index)
})

test('loadClosedMode records an error state when recently closed sessions cannot be loaded', async () => {
  const document = createScryDocument()
  const failure = new Error('sessions unavailable')
  const chromeApi = createSessionsOnlyChrome(() => Promise.reject(failure))
  const app = new ScryPanelApp({ document, chromeApi, clock: () => now, windowApi: { blur() {} } })
  const state = createSearchModeState('closed')

  const loaded = await app.loadClosedMode(state)

  assert.equal(loaded, state)
  assert.equal(state.status, 'error')
  assert.equal(state.index, null)
  assert.equal(state.error, failure)
  assert.equal(state.loadedAt, null)
  assert.equal(state.loadingPromise, null)
  assert.equal(app.loading, false)
  assert.equal(app.index, null)
})
