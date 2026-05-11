import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeWebsiteFilter, parseQuery } from '../src/core/query.js'
import { recordSelection, selectionBoost, selectionIntentKeyParts, selectionIntentKeysOverlap } from '../src/core/selection-learning.js'

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

test('recordSelection stores colon-filtered query strings under filter-distinct keys', () => {
  const data = recordSelection(undefined, {
    query: 'git: issues',
    urlKey,
    selectedAt,
  })

  assert.deepEqual(data, {
    version: 1,
    aggregates: {
      'git: issues': {
        [urlKey]: learnedOnce,
      },
    },
  })
  assert.equal(data.aggregates['git issues'], undefined)
})

test('recordSelection canonicalizes adjacent colon-filter query strings', () => {
  const data = recordSelection(undefined, {
    query: 'git:issues',
    urlKey,
    selectedAt,
  })

  assert.deepEqual(data, {
    version: 1,
    aggregates: {
      'git: issues': {
        [urlKey]: learnedOnce,
      },
    },
  })
})

test('recordSelection derives filter-aware keys from parsed query parts without a precomputed key', () => {
  const data = recordSelection(undefined, {
    query: {
      tokens: ['github', 'issues'],
      unquotedTokens: ['issues'],
      websiteFilters: [normalizeWebsiteFilter('Git')],
    },
    urlKey,
    selectedAt,
  })

  assert.deepEqual(data, {
    version: 1,
    aggregates: {
      'git: issues': {
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

test('selectionIntentKeyParts preserves legacy token arrays without website filters', () => {
  assert.deepEqual(selectionIntentKeyParts(['github', 'issue', '13']), {
    tokens: ['github', 'issue', '13'],
    websiteFilters: [],
  })
})

test('selectionIntentKeyParts prefers ordinary unquoted tokens and exposes website filters', () => {
  const gitFilter = normalizeWebsiteFilter('GitHub')

  assert.deepEqual(
    selectionIntentKeyParts({
      tokens: ['github', 'issues', '13'],
      unquotedTokens: ['issues', '13'],
      websiteFilters: [gitFilter],
    }),
    {
      tokens: ['issues', '13'],
      websiteFilters: [gitFilter],
    },
  )
})

test('selectionIntentKeyParts falls back to parsed token objects without website filters', () => {
  assert.deepEqual(selectionIntentKeyParts({ tokens: ['docs'] }), {
    tokens: ['docs'],
    websiteFilters: [],
  })
})

test('selectionIntentKeyParts handles empty or malformed parsed query data as empty intent parts', () => {
  assert.deepEqual(selectionIntentKeyParts(undefined), {
    tokens: [],
    websiteFilters: [],
  })
  assert.deepEqual(selectionIntentKeyParts({ tokens: 'docs', websiteFilters: 'github' }), {
    tokens: [],
    websiteFilters: [],
  })
})

test('selectionIntentKeysOverlap preserves legacy token prefix overlap for unfiltered keys', () => {
  assert.equal(
    selectionIntentKeysOverlap({ tokens: ['git', 'iss'], websiteFilters: [] }, 'github issues'),
    true,
  )
  assert.equal(
    selectionIntentKeysOverlap({ tokens: ['git'], websiteFilters: [] }, 'github issues'),
    false,
  )
})

test('selectionIntentKeysOverlap keeps filtered and unfiltered intents distinct', () => {
  assert.equal(
    selectionIntentKeysOverlap({ tokens: ['git'], websiteFilters: [] }, 'git:'),
    false,
  )
  assert.equal(
    selectionIntentKeysOverlap({ tokens: [], websiteFilters: [normalizeWebsiteFilter('Git')] }, 'git'),
    false,
  )
})

test('selectionIntentKeysOverlap allows token overlap when normalized website filter sets match', () => {
  assert.equal(
    selectionIntentKeysOverlap(
      {
        tokens: ['iss'],
        websiteFilters: [normalizeWebsiteFilter('GitHub.COM'), normalizeWebsiteFilter('Docs')],
      },
      'docs: github.com: issues',
    ),
    true,
  )
  assert.equal(
    selectionIntentKeysOverlap(
      { tokens: ['scr'], websiteFilters: [normalizeWebsiteFilter('Git')] },
      'git:scry',
    ),
    true,
  )
})

test('selectionIntentKeysOverlap rejects token overlap when website filter sets differ', () => {
  assert.equal(
    selectionIntentKeysOverlap(
      { tokens: ['iss'], websiteFilters: [normalizeWebsiteFilter('GitHub')] },
      'docs: issues',
    ),
    false,
  )
})

test('selectionIntentKeysOverlap supports matching filter-only intents', () => {
  assert.equal(
    selectionIntentKeysOverlap({ tokens: [], websiteFilters: [normalizeWebsiteFilter('Git')] }, 'git:'),
    true,
  )
  assert.equal(
    selectionIntentKeysOverlap({ tokens: [], websiteFilters: [normalizeWebsiteFilter('Git')] }, '[git]'),
    true,
  )
})

const boostForLearnedOnce = Math.log1p(learnedOnce.count) * 6 + 4

test('selectionBoost preserves legacy token-array learning', () => {
  const data = {
    version: 1,
    aggregates: {
      'github issues': {
        [urlKey]: learnedOnce,
      },
    },
  }

  assert.equal(selectionBoost(data, ['git', 'iss'], urlKey, selectedAt), boostForLearnedOnce)
  assert.equal(selectionBoost(data, ['git'], urlKey, selectedAt), 0)
})

test('selectionBoost accepts parsed filter-only query intents', () => {
  const data = {
    version: 1,
    aggregates: {
      'git:': {
        [urlKey]: learnedOnce,
      },
    },
  }

  assert.equal(selectionBoost(data, parseQuery('git:'), urlKey, selectedAt), boostForLearnedOnce)
  assert.equal(
    selectionBoost(data, { tokens: [], websiteFilters: [normalizeWebsiteFilter('Git')] }, urlKey, selectedAt),
    boostForLearnedOnce,
  )
})

test('selectionBoost keeps filtered and unfiltered learned intents distinct', () => {
  const unfilteredHighCount = {
    count: 20,
    lastSelectedAt: selectedAt,
    selectedAt: [selectedAt],
  }
  const data = {
    version: 1,
    aggregates: {
      issues: {
        [urlKey]: unfilteredHighCount,
      },
      'git: issues': {
        [urlKey]: learnedOnce,
      },
    },
  }

  assert.equal(selectionBoost(data, parseQuery('git: issues'), urlKey, selectedAt), boostForLearnedOnce)
  assert.equal(selectionBoost(data, parseQuery('git:issues'), urlKey, selectedAt), boostForLearnedOnce)
  assert.equal(selectionBoost(data, parseQuery('issues'), urlKey, selectedAt), Math.min(12, Math.log1p(20) * 6) + 4)
})

test('selectionBoost returns zero for empty intents and missing url keys', () => {
  const data = {
    version: 1,
    aggregates: {
      'git:': {
        [urlKey]: learnedOnce,
      },
    },
  }

  assert.equal(selectionBoost(data, [], urlKey, selectedAt), 0)
  assert.equal(selectionBoost(data, parseQuery('git:'), '', selectedAt), 0)
})
