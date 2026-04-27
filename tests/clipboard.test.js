import test from 'node:test'
import assert from 'node:assert/strict'

import { writeClipboardText } from '../src/platform/clipboard.js'

test('writeClipboardText writes the URL through the injected navigator clipboard API', async () => {
  const calls = []
  const resolvedValue = { copied: true }
  const clipboard = {
    writeText(text) {
      assert.equal(this, clipboard)
      calls.push(text)
      return Promise.resolve(resolvedValue)
    },
  }

  const result = await writeClipboardText('https://example.com/docs?tab=readme', {
    navigatorApi: { clipboard },
  })

  assert.equal(result, resolvedValue)
  assert.deepEqual(calls, ['https://example.com/docs?tab=readme'])
})

test('writeClipboardText passes empty text through to the clipboard boundary', async () => {
  const calls = []
  const navigatorApi = {
    clipboard: {
      writeText(text) {
        calls.push(text)
        return Promise.resolve()
      },
    },
  }

  await writeClipboardText('', { navigatorApi })

  assert.deepEqual(calls, [''])
})

test('writeClipboardText propagates clipboard write failures', async () => {
  const denied = new Error('clipboard permission denied')
  const navigatorApi = {
    clipboard: {
      writeText() {
        return Promise.reject(denied)
      },
    },
  }

  await assert.rejects(writeClipboardText('https://example.com/private', { navigatorApi }), (thrown) => thrown === denied)
})

test('writeClipboardText rejects with a useful error when the clipboard API is unavailable', async () => {
  const unavailableNavigators = [null, {}, { clipboard: {} }, { clipboard: { writeText: null } }]

  for (const navigatorApi of unavailableNavigators) {
    await assert.rejects(
      writeClipboardText('https://example.com/docs', { navigatorApi }),
      /clipboard API unavailable: navigator\.clipboard\.writeText/i,
    )
  }
})
