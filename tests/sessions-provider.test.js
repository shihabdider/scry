import test from 'node:test'
import assert from 'node:assert/strict'

import { CLOSED_SESSION_WINDOW_MS, fetchRecentlyClosed, flattenClosedSessions } from '../src/platform/sessions-provider.js'

test('fetchRecentlyClosed returns Chrome recently closed records through the injected sessions API', async () => {
  const recentlyClosed = [
    { tab: { url: 'https://example.com/docs', title: 'Docs' }, lastModified: 1_234 },
    { window: { tabs: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }] }, lastModified: 1_235 },
  ]
  const calls = []
  const chromeApi = {
    sessions: {
      getRecentlyClosed(...args) {
        calls.push(args)
        return Promise.resolve(recentlyClosed)
      },
      restore() {
        assert.fail('fetchRecentlyClosed must not restore closed sessions')
      },
    },
  }

  const result = await fetchRecentlyClosed({ chromeApi })

  assert.equal(result, recentlyClosed)
  assert.deepEqual(calls, [[]])
})

test('fetchRecentlyClosed returns an empty recently closed record list unchanged', async () => {
  const recentlyClosed = []
  const chromeApi = {
    sessions: {
      getRecentlyClosed() {
        return Promise.resolve(recentlyClosed)
      },
      restore() {
        assert.fail('fetchRecentlyClosed must not restore closed sessions')
      },
    },
  }

  assert.equal(await fetchRecentlyClosed({ chromeApi }), recentlyClosed)
})

test('fetchRecentlyClosed propagates Chrome sessions failures', async () => {
  const error = new Error('sessions unavailable')
  const chromeApi = {
    sessions: {
      getRecentlyClosed() {
        return Promise.reject(error)
      },
      restore() {
        assert.fail('fetchRecentlyClosed must not restore closed sessions')
      },
    },
  }

  await assert.rejects(fetchRecentlyClosed({ chromeApi }), (thrown) => thrown === error)
})

test('flattenClosedSessions flattens recent closed tabs and window tabs into history-like entries', () => {
  const now = 1_700_000_000_000
  const standaloneClosedAtSeconds = Math.floor((now - 5_000) / 1_000)
  const windowClosedAtSeconds = Math.floor((now - 60_000) / 1_000)

  const result = flattenClosedSessions(
    [
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
    ],
    { now },
  )

  assert.deepEqual(result, [
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
})

test('flattenClosedSessions filters records without known top-level timestamps or outside the 24 hour window', () => {
  const now = 1_700_000_000_000
  const recentSeconds = Math.floor((now - 5_000) / 1_000)
  const boundarySeconds = Math.floor((now - CLOSED_SESSION_WINDOW_MS) / 1_000)
  const oldSeconds = Math.floor((now - CLOSED_SESSION_WINDOW_MS - 1_000) / 1_000)
  const futureSeconds = Math.floor((now + 1_000) / 1_000)

  const result = flattenClosedSessions(
    [
      { tab: { url: 'https://example.com/no-top-level', title: 'No top level', lastModified: recentSeconds } },
      { window: { tabs: [{ url: 'https://example.com/window-no-top-level', title: 'Nested only' }], lastModified: recentSeconds } },
      { tab: { url: 'https://example.com/old', title: 'Old' }, lastModified: oldSeconds },
      { tab: { url: 'https://example.com/future', title: 'Future' }, lastModified: futureSeconds },
      { tab: { url: 'https://example.com/boundary', title: 'Boundary' }, lastModified: boundarySeconds },
    ],
    { now },
  )

  assert.deepEqual(result, [
    {
      url: 'https://example.com/boundary',
      title: 'Boundary',
      visitCount: 1,
      lastVisitTime: boundarySeconds * 1_000,
    },
  ])
})

test('flattenClosedSessions returns URL entries only and skips tabs without URLs', () => {
  const now = 1_700_000_000_000
  const closedAtSeconds = Math.floor((now - 5_000) / 1_000)

  const result = flattenClosedSessions(
    [
      { window: { tabs: [{ title: 'Untitled' }, { url: '', title: 'Empty URL' }, { url: 'https://example.com/kept', title: 'Kept' }] }, lastModified: closedAtSeconds },
      { window: { tabs: [] }, lastModified: closedAtSeconds },
      { lastModified: closedAtSeconds },
    ],
    { now },
  )

  assert.deepEqual(result, [
    {
      url: 'https://example.com/kept',
      title: 'Kept',
      visitCount: 1,
      lastVisitTime: closedAtSeconds * 1_000,
    },
  ])
})

test('flattenClosedSessions returns an empty list for empty recently closed records', () => {
  assert.deepEqual(flattenClosedSessions([], { now: 1_700_000_000_000 }), [])
})
