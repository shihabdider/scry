import test from 'node:test'
import assert from 'node:assert/strict'

import { parseQuery } from '../src/core/query.js'
import { recordSelection } from '../src/core/selection-learning.js'

const selectedAt = Date.parse('2026-04-27T12:00:00Z')
const urlKey = 'https://github.com/mskilab-org/repo/issues/13'

const learnedOnce = {
  count: 1,
  lastSelectedAt: selectedAt,
  selectedAt: [selectedAt],
}

test('recordSelection preserves token-based learning for existing callers', () => {
  const data = recordSelection(undefined, {
    tokens: ['github', 'issue', '13'],
    urlKey,
    selectedAt,
  })

  assert.deepEqual(data, {
    version: 1,
    aggregates: {
      'github issue 13': {
        [urlKey]: learnedOnce,
      },
    },
  })
})

test('recordSelection learns from parsed query unquoted identity', () => {
  const data = recordSelection(undefined, {
    query: parseQuery('github "MSKILAB-org/repo" issue'),
    urlKey,
    selectedAt,
  })

  assert.deepEqual(data, {
    version: 1,
    aggregates: {
      'github issue': {
        [urlKey]: learnedOnce,
      },
    },
  })
})

test('recordSelection skips parsed queries without unquoted identity', () => {
  const existing = {
    version: 1,
    aggregates: {
      github: {
        'https://github.com/other/repo': {
          count: 2,
          lastSelectedAt: selectedAt - 1,
          selectedAt: [selectedAt - 2, selectedAt - 1],
        },
      },
    },
  }

  assert.deepEqual(
    recordSelection(existing, {
      query: parseQuery('"MSKILAB-org/repo"'),
      urlKey,
      selectedAt,
    }),
    existing,
  )
})

test('recordSelection bypasses synthetic typed URL rows when no urlKey is provided', () => {
  const existing = {
    version: 1,
    aggregates: {
      docs: {
        'https://example.com/docs': learnedOnce,
      },
    },
  }

  assert.deepEqual(
    recordSelection(existing, {
      query: parseQuery('docs'),
      selectedAt,
    }),
    existing,
  )
})
