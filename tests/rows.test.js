import test from 'node:test'
import assert from 'node:assert/strict'

import { rowOpenUrl } from '../src/core/rows.js'

test('rowOpenUrl returns the real corpus result URL', () => {
  const row = {
    kind: 'result',
    key: 'result:https://example.com/docs',
    copied: false,
    result: {
      key: 'https://example.com/docs',
      url: 'https://example.com/docs?tab=readme',
      displayUrl: 'example.com/docs?tab=readme',
      title: 'Example docs',
      visitCount: 3,
      visitsLabel: '3 visits',
      lastVisitTime: 0,
      lastVisitedLabel: 'now',
      urlHtml: 'example.com/docs?tab=readme',
      titleHtml: 'Example docs',
      debug: {},
    },
  }

  assert.equal(rowOpenUrl(row), 'https://example.com/docs?tab=readme')
})

test('rowOpenUrl returns the synthetic typed URL candidate normalized URL', () => {
  const row = {
    kind: 'open-typed-url',
    key: 'open-typed-url:https://example.com/docs',
    copied: false,
    candidate: {
      displayInput: 'example.com/docs',
      normalizedUrl: 'https://example.com/docs',
      key: 'https://example.com/docs',
    },
  }

  assert.equal(rowOpenUrl(row), 'https://example.com/docs')
})

test('rowOpenUrl returns null for null or malformed rows', () => {
  const malformedRows = [
    null,
    undefined,
    {},
    { kind: 'unknown', url: 'https://example.com/ignore-me' },
    { kind: 'result' },
    { kind: 'result', result: null },
    { kind: 'result', result: {} },
    { kind: 'open-typed-url' },
    { kind: 'open-typed-url', candidate: null },
    { kind: 'open-typed-url', candidate: {} },
  ]

  for (const row of malformedRows) {
    assert.equal(rowOpenUrl(row), null)
  }
})
