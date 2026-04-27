import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchRecentlyClosed } from '../src/platform/sessions-provider.js'

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
