import test from 'node:test'
import assert from 'node:assert/strict'

import { formatAge, highlightText } from '../src/core/format.js'
import { recordSelection } from '../src/core/selection-learning.js'
import { buildHistoryIndex, searchHistory } from '../src/core/search.js'
import { middleTruncate } from '../src/core/url.js'

const now = Date.parse('2026-04-27T00:00:00Z')

function indexOf(entries) {
  return buildHistoryIndex(entries, { now })
}

test('conservative URL normalization deduplicates fragments and tracking parameters while preserving meaningful query strings', () => {
  const index = indexOf([
    {
      url: 'https://GitHub.com/shihabdider/skilift/issues/13/?utm_source=newsletter#discussion',
      title: 'Older noisy copy',
      visitCount: 2,
      lastVisitTime: now - 2_000,
    },
    {
      url: 'https://github.com/shihabdider/skilift/issues/13?filter=mine',
      title: 'Meaningful query copy',
      visitCount: 3,
      lastVisitTime: now - 1_000,
    },
    {
      url: 'https://github.com/shihabdider/skilift/issues/13?filter=mine&utm_medium=email#x',
      title: 'Latest meaningful query copy',
      visitCount: 5,
      lastVisitTime: now,
    },
  ])

  assert.equal(index.entries.length, 2)
  const queryEntry = index.entries.find((entry) => entry.displayUrl.includes('filter=mine'))
  assert.equal(queryEntry.visitCount, 8)
  assert.equal(queryEntry.title, 'Latest meaningful query copy')
})

test('empty query returns frecent defaults rather than pure recency or pure frequency', () => {
  const index = indexOf([
    {
      url: 'https://example.com/recent-one-off',
      title: 'Recent one off',
      visitCount: 1,
      lastVisitTime: now - 5 * 60 * 1000,
    },
    {
      url: 'https://example.com/recent-recurring',
      title: 'Recent recurring',
      visitCount: 12,
      lastVisitTime: now - 60 * 60 * 1000,
    },
    {
      url: 'https://example.com/stale-popular',
      title: 'Stale popular',
      visitCount: 500,
      lastVisitTime: now - 80 * 24 * 60 * 60 * 1000,
    },
  ])

  const results = searchHistory(index, '', { now })

  assert.equal(results[0].url, 'https://example.com/recent-recurring')
  assert.equal(results.at(-1).url, 'https://example.com/stale-popular')
})

test('ordered URL recall finds a visited GitHub issue from remembered fragments', () => {
  const index = indexOf([
    {
      url: 'https://github.com/shihabdider/skilift/issues/13',
      title: 'Fix launcher ranking · shihabdider/skilift',
      visitCount: 8,
      lastVisitTime: now - 2 * 60 * 60 * 1000,
    },
    {
      url: 'https://github.com/shihabdider/skitools/issues/13',
      title: 'A similar repo',
      visitCount: 40,
      lastVisitTime: now - 10 * 60 * 1000,
    },
  ])

  const results = searchHistory(index, 'git*skilift*issues*13', { now })

  assert.equal(results[0].url, 'https://github.com/shihabdider/skilift/issues/13')
  assert.equal(results[0].debug.orderedUrlCoverage, 4)
})

test('constrained abbreviation matching supports gh*issu without an alias table', () => {
  const index = indexOf([
    {
      url: 'https://github.com/shihabdider/skilift/issues/13',
      title: 'Skilift issue',
      visitCount: 3,
      lastVisitTime: now,
    },
  ])

  const results = searchHistory(index, 'gh*issu', { now })

  assert.equal(results[0].url, 'https://github.com/shihabdider/skilift/issues/13')
  assert.deepEqual(
    results[0].debug.matches.map((match) => match.tier),
    ['abbreviation', 'prefix'],
  )
})

test('guarded substring matching can find remembered middle fragments without broad two-letter noise', () => {
  const index = indexOf([
    {
      url: 'https://github.com/shihabdider/skilift',
      title: 'Skilift repository',
      visitCount: 3,
      lastVisitTime: now,
    },
  ])

  assert.equal(searchHistory(index, 'lift', { now })[0].url, 'https://github.com/shihabdider/skilift')
  assert.equal(searchHistory(index, 'ft', { now }).length, 0)
})

test('exact numeric URL segment outranks numeric prefix even when the prefix target is more visited and recent', () => {
  const index = indexOf([
    {
      url: 'https://github.com/shihabdider/skilift/issues/130',
      title: 'Very popular newer issue',
      visitCount: 200,
      lastVisitTime: now,
    },
    {
      url: 'https://github.com/shihabdider/skilift/issues/13',
      title: 'Exact issue',
      visitCount: 1,
      lastVisitTime: now - 10 * 24 * 60 * 60 * 1000,
    },
  ])

  const results = searchHistory(index, 'issues 13', { now })

  assert.equal(results[0].url, 'https://github.com/shihabdider/skilift/issues/13')
})

test('adjacent path coherence beats scattered title/query evidence', () => {
  const index = indexOf([
    {
      url: 'https://github.com/shihabdider/skilift/issues/13',
      title: 'Exact issue path',
      visitCount: 2,
      lastVisitTime: now - 10_000,
    },
    {
      url: 'https://github.com/shihabdider/skilift/pull/13?filter=issues',
      title: 'Mentions issues elsewhere',
      visitCount: 100,
      lastVisitTime: now,
    },
  ])

  const results = searchHistory(index, 'issues 13', { now })

  assert.equal(results[0].url, 'https://github.com/shihabdider/skilift/issues/13')
  assert.equal(results[0].debug.adjacentPairs, 1)
})

test('query-string matches are searchable but lower priority than host and path matches', () => {
  const index = indexOf([
    {
      url: 'https://example.com/search?q=skilift',
      title: 'Search result page',
      visitCount: 100,
      lastVisitTime: now,
    },
    {
      url: 'https://github.com/shihabdider/skilift',
      title: 'Repo page',
      visitCount: 1,
      lastVisitTime: now - 30 * 24 * 60 * 60 * 1000,
    },
  ])

  const results = searchHistory(index, 'skilift', { now })

  assert.equal(results[0].url, 'https://github.com/shihabdider/skilift')
  assert.equal(results[1].url, 'https://example.com/search?q=skilift')
})

test('selection learning reorders close candidates but cannot override stronger URL text evidence', () => {
  const index = indexOf([
    {
      url: 'https://github.com/shihabdider/skilift',
      title: 'Skilift',
      visitCount: 5,
      lastVisitTime: now,
    },
    {
      url: 'https://github.com/shihabdider/skitools',
      title: 'Skitools',
      visitCount: 5,
      lastVisitTime: now,
    },
  ])

  const selectedSkitools = recordSelection(undefined, {
    query: 'ski',
    urlKey: 'https://github.com/shihabdider/skitools',
    selectedAt: now,
  })

  assert.equal(searchHistory(index, 'ski', { now, selections: selectedSkitools })[0].url, 'https://github.com/shihabdider/skitools')
  assert.equal(searchHistory(index, 'skilift', { now, selections: selectedSkitools })[0].url, 'https://github.com/shihabdider/skilift')
})

test('display helpers use compact old-Google-friendly output', () => {
  assert.equal(formatAge(now - 60 * 60 * 1000, now), '1h ago')
  assert.equal(formatAge(now - 10 * 24 * 60 * 60 * 1000, now), '10d ago')
  const truncated = middleTruncate('github.com/shihabdider/skilift/issues/13/comments/123456789', 36)
  assert.ok(truncated.length <= 36)
  assert.ok(truncated.startsWith('github.com/'))
  assert.ok(truncated.endsWith('123456789'))
  assert.ok(truncated.includes('…'))
  assert.equal(highlightText('github.com/shihabdider/skilift/issues/13', ['gh', 'issu']), '<b>g</b>it<b>h</b>ub.com/shihabdider/skilift/<b>issu</b>es/13')
})
