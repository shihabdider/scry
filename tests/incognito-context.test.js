import test from 'node:test'
import assert from 'node:assert/strict'

import {
  allowsBrowsingDataPersistence,
  incognitoContextFromExtension,
  incognitoContextFromTab,
} from '../src/platform/incognito-context.js'

test('incognitoContextFromExtension produces a normal context when Chrome reports a normal extension page', () => {
  assert.deepEqual(incognitoContextFromExtension({ chromeApi: { extension: { inIncognitoContext: false } } }), {
    extensionInIncognitoContext: false,
    tabIncognito: false,
  })
})

test('incognitoContextFromExtension preserves a true extension incognito signal', () => {
  assert.deepEqual(incognitoContextFromExtension({ chromeApi: { extension: { inIncognitoContext: true } } }), {
    extensionInIncognitoContext: true,
    tabIncognito: false,
  })
})

test('incognitoContextFromExtension defaults a missing extension signal to a normal context', () => {
  assert.deepEqual(incognitoContextFromExtension({ chromeApi: {} }), {
    extensionInIncognitoContext: false,
    tabIncognito: false,
  })
})

test('incognitoContextFromTab produces a normal context for a normal tab', () => {
  assert.deepEqual(incognitoContextFromTab({ url: 'https://example.com/docs', incognito: false }), {
    extensionInIncognitoContext: false,
    tabIncognito: false,
  })
})

test('incognitoContextFromTab preserves a true tab incognito signal', () => {
  assert.deepEqual(incognitoContextFromTab({ url: 'https://secret.example/', incognito: true }), {
    extensionInIncognitoContext: false,
    tabIncognito: true,
  })
})

test('incognitoContextFromTab preserves the supplied extension incognito signal', () => {
  assert.deepEqual(
    incognitoContextFromTab(
      { url: 'https://example.com/docs' },
      { extensionInIncognitoContext: true },
    ),
    {
      extensionInIncognitoContext: true,
      tabIncognito: false,
    },
  )
})

test('incognitoContextFromTab defaults a missing tab to a normal context', () => {
  assert.deepEqual(incognitoContextFromTab(null), {
    extensionInIncognitoContext: false,
    tabIncognito: false,
  })
})

test('allowsBrowsingDataPersistence allows persistence when both incognito signals are false', () => {
  assert.equal(
    allowsBrowsingDataPersistence({ extensionInIncognitoContext: false, tabIncognito: false }),
    true,
  )
})

test('allowsBrowsingDataPersistence rejects persistence for an incognito extension context', () => {
  assert.equal(
    allowsBrowsingDataPersistence({ extensionInIncognitoContext: true, tabIncognito: false }),
    false,
  )
})

test('allowsBrowsingDataPersistence rejects persistence for an incognito tab context', () => {
  assert.equal(
    allowsBrowsingDataPersistence({ extensionInIncognitoContext: false, tabIncognito: true }),
    false,
  )
})

test('allowsBrowsingDataPersistence rejects persistence when both incognito signals are true', () => {
  assert.equal(
    allowsBrowsingDataPersistence({ extensionInIncognitoContext: true, tabIncognito: true }),
    false,
  )
})
