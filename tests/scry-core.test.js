import test from 'node:test'
import assert from 'node:assert/strict'

import { formatAge, highlightText } from '../src/core/format.js'
import { normalizeExactPhrase } from '../src/core/query.js'
import { recordSelection } from '../src/core/selection-learning.js'
import { __testing, buildHistoryIndex, collectExactPhraseEvidence, compareQuoteEvidence, searchHistory } from '../src/core/search.js'
import { createTypedUrlCandidate, middleTruncate } from '../src/core/url.js'

const now = Date.parse('2026-04-27T00:00:00Z')

function indexOf(entries) {
  return buildHistoryIndex(entries, { now })
}

test('exact phrase normalization collapses whitespace and preserves the raw quoted text', () => {
  assert.deepEqual(normalizeExactPhrase('  pull \n\t requests  '), {
    rawText: '  pull \n\t requests  ',
    matchText: 'pull requests',
    caseSensitive: false,
  })
})

test('exact phrase normalization preserves URL punctuation for phrase matching', () => {
  assert.deepEqual(normalizeExactPhrase('github.com/mskilab-org/repo?tab=pull_requests'), {
    rawText: 'github.com/mskilab-org/repo?tab=pull_requests',
    matchText: 'github.com/mskilab-org/repo?tab=pull_requests',
    caseSensitive: false,
  })
})

test('exact phrase normalization enables case-sensitive matching when raw text contains uppercase', () => {
  assert.deepEqual(normalizeExactPhrase('MSKILAB-org/repo'), {
    rawText: 'MSKILAB-org/repo',
    matchText: 'MSKILAB-org/repo',
    caseSensitive: true,
  })
})

test('exact phrase normalization treats empty quoted phrases as case-insensitive empty text', () => {
  assert.deepEqual(normalizeExactPhrase('   '), {
    rawText: '   ',
    matchText: '',
    caseSensitive: false,
  })
})

test('exact phrase evidence matches display URL punctuation with field and normalized position', () => {
  const entry = indexOf([
    {
      url: 'https://github.com/mskilab-org/repo/issues/13?tab=pull_requests',
      title: 'Issue 13',
      visitCount: 1,
      lastVisitTime: now,
    },
  ]).entries[0]
  const phrase = normalizeExactPhrase('mskilab-org/repo/issues/13?tab=pull_requests')

  const result = collectExactPhraseEvidence(entry, [phrase])

  assert.equal(result.matched, true)
  assert.deepEqual(result.evidence, [{ phrase, field: 'displayUrl', position: 11 }])
})

test('exact phrase evidence collapses field whitespace but preserves punctuation', () => {
  const entry = indexOf([
    {
      url: 'https://example.com/pull-requests',
      title: 'Pull   requests:\nreview\tqueue',
      visitCount: 1,
      lastVisitTime: now,
    },
  ]).entries[0]

  assert.deepEqual(collectExactPhraseEvidence(entry, [normalizeExactPhrase('pull requests: review queue')]).evidence, [
    { phrase: normalizeExactPhrase('pull requests: review queue'), field: 'title', position: 0 },
  ])
  assert.deepEqual(collectExactPhraseEvidence(entry, [normalizeExactPhrase('pull requests review queue')]), {
    matched: false,
    evidence: [],
    qualityTuple: [],
  })
})

test('exact phrase evidence follows smart-case matching rules', () => {
  const entry = indexOf([
    {
      url: 'https://example.com/actions',
      title: 'GitHub Actions dashboard',
      visitCount: 1,
      lastVisitTime: now,
    },
  ]).entries[0]

  assert.deepEqual(collectExactPhraseEvidence(entry, [normalizeExactPhrase('github actions')]).evidence, [
    { phrase: normalizeExactPhrase('github actions'), field: 'title', position: 0 },
  ])
  assert.deepEqual(collectExactPhraseEvidence(entry, [normalizeExactPhrase('github Actions')]), {
    matched: false,
    evidence: [],
    qualityTuple: [],
  })
})

test('exact phrase evidence requires every phrase as a hard filter', () => {
  const entry = indexOf([
    {
      url: 'https://example.com/docs',
      title: 'Release notes alpha',
      visitCount: 1,
      lastVisitTime: now,
    },
  ]).entries[0]

  assert.deepEqual(
    collectExactPhraseEvidence(entry, [
      normalizeExactPhrase('example.com/docs'),
      normalizeExactPhrase('release notes'),
      normalizeExactPhrase('missing phrase'),
    ]),
    { matched: false, evidence: [], qualityTuple: [] },
  )
})

test('exact phrase evidence prefers display URL over title and records earliest field position', () => {
  const entry = indexOf([
    {
      url: 'https://example.com/alpha/path/alpha',
      title: 'alpha appears earlier in the title',
      visitCount: 1,
      lastVisitTime: now,
    },
  ]).entries[0]
  const phrase = normalizeExactPhrase('alpha')

  const result = collectExactPhraseEvidence(entry, [phrase])

  assert.deepEqual(result.evidence, [{ phrase, field: 'displayUrl', position: 12 }])
  assert.deepEqual(result.qualityTuple, [1, -12])
})

test('exact phrase evidence ignores raw URL fragments outside display URL and title', () => {
  const entry = {
    url: 'https://example.com/docs#secret phrase',
    displayUrl: 'example.com/docs',
    title: 'Visible page',
  }

  assert.deepEqual(collectExactPhraseEvidence(entry, [normalizeExactPhrase('secret phrase')]), {
    matched: false,
    evidence: [],
    qualityTuple: [],
  })
})

test('exact phrase evidence vacuously matches when there are no exact phrases', () => {
  assert.deepEqual(collectExactPhraseEvidence({ displayUrl: 'example.com', title: 'Example' }, []), {
    matched: true,
    evidence: [],
    qualityTuple: [0, 0],
  })
})

test('quote evidence comparator sorts display URL phrase matches before title-only matches', () => {
  const phrase = normalizeExactPhrase('alpha')
  const displayUrlEvidence = collectExactPhraseEvidence({ displayUrl: 'example.com/alpha', title: 'Alpha page' }, [phrase])
  const titleOnlyEvidence = collectExactPhraseEvidence({ displayUrl: 'example.com/page', title: 'Alpha page' }, [phrase])

  assert.ok(compareQuoteEvidence(displayUrlEvidence, titleOnlyEvidence) < 0)
  assert.ok(compareQuoteEvidence(titleOnlyEvidence, displayUrlEvidence) > 0)
  assert.deepEqual([titleOnlyEvidence, displayUrlEvidence].sort(compareQuoteEvidence), [displayUrlEvidence, titleOnlyEvidence])
})

test('quote evidence comparator prefers earlier phrase positions among close matches', () => {
  const phrase = normalizeExactPhrase('alpha')
  const earlierEvidence = collectExactPhraseEvidence({ displayUrl: 'alpha.example.com/docs', title: 'Docs' }, [phrase])
  const laterEvidence = collectExactPhraseEvidence({ displayUrl: 'example.com/docs/alpha', title: 'Docs' }, [phrase])

  assert.ok(compareQuoteEvidence(earlierEvidence, laterEvidence) < 0)
  assert.ok(compareQuoteEvidence(laterEvidence, earlierEvidence) > 0)
  assert.deepEqual([laterEvidence, earlierEvidence].sort(compareQuoteEvidence), [earlierEvidence, laterEvidence])
})

test('quote evidence comparator ties equivalent quote quality including empty phrase sets', () => {
  const phrase = normalizeExactPhrase('alpha')
  const leftTitleEvidence = collectExactPhraseEvidence({ displayUrl: 'example.com/one', title: 'Alpha one' }, [phrase])
  const rightTitleEvidence = collectExactPhraseEvidence({ displayUrl: 'example.com/two', title: 'Alpha two' }, [phrase])
  const leftEmptyEvidence = collectExactPhraseEvidence({ displayUrl: 'example.com/one', title: 'One' }, [])
  const rightEmptyEvidence = collectExactPhraseEvidence({ displayUrl: 'example.com/two', title: 'Two' }, [])

  assert.equal(compareQuoteEvidence(leftTitleEvidence, rightTitleEvidence), 0)
  assert.equal(compareQuoteEvidence(leftEmptyEvidence, rightEmptyEvidence), 0)
})

test('result conversion carries quote-match debug evidence without rendering it', () => {
  const entry = indexOf([
    {
      url: 'https://example.com/alpha',
      title: 'Alpha page',
      visitCount: 7,
      lastVisitTime: now - 60 * 1000,
    },
  ]).entries[0]
  const quoteEvidence = collectExactPhraseEvidence(entry, [normalizeExactPhrase('example.com/alpha')])
  const debug = { mode: 'quoted', quoteEvidence, debugOnly: 'DO_NOT_RENDER' }

  const result = __testing.toResult(entry, { tokens: ['alpha'], now, debug })

  assert.equal(result.displayUrl, 'example.com/alpha')
  assert.equal(result.title, 'Alpha page')
  assert.equal(result.visitsLabel, '7 visits')
  assert.equal(result.lastVisitedLabel, '1m ago')
  assert.equal(result.urlHtml, 'example.com/<b>alpha</b>')
  assert.equal(result.titleHtml, '<b>Alpha</b> page')
  assert.deepEqual(result.debug, debug)
  assert.equal(result.urlHtml.includes('DO_NOT_RENDER'), false)
  assert.equal(result.titleHtml.includes('DO_NOT_RENDER'), false)
})

test('result conversion remains backward compatible when optional display inputs are absent', () => {
  const entry = {
    key: 'https://example.com/no-title',
    url: 'https://example.com/no-title',
    displayUrl: 'example.com/no-title',
    title: '',
    visitCount: 1,
    lastVisitTime: now,
  }

  const result = __testing.toResult(entry, { now })

  assert.equal(result.key, entry.key)
  assert.equal(result.url, entry.url)
  assert.equal(result.displayUrl, entry.displayUrl)
  assert.equal(result.title, entry.displayUrl)
  assert.equal(result.visitsLabel, '1 visit')
  assert.equal(result.lastVisitedLabel, 'now')
  assert.equal(result.urlHtml, entry.displayUrl)
  assert.equal(result.titleHtml, entry.displayUrl)
  assert.deepEqual(result.debug, {})
})

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

test('typed URL candidate accepts schemeless domains and adds https for navigation', () => {
  assert.deepEqual(createTypedUrlCandidate('github.com/mskilab-org/repo/pulls'), {
    displayInput: 'github.com/mskilab-org/repo/pulls',
    normalizedUrl: 'https://github.com/mskilab-org/repo/pulls',
    key: 'https://github.com/mskilab-org/repo/pulls',
  })
})

test('typed URL candidate accepts http and https URLs while displaying without protocol or fragment', () => {
  assert.deepEqual(createTypedUrlCandidate('https://github.com/mskilab-org/repo/pulls#discussion'), {
    displayInput: 'github.com/mskilab-org/repo/pulls',
    normalizedUrl: 'https://github.com/mskilab-org/repo/pulls',
    key: 'https://github.com/mskilab-org/repo/pulls',
  })
  assert.deepEqual(createTypedUrlCandidate('http://Example.com:80/docs?tab=readme#top'), {
    displayInput: 'example.com/docs?tab=readme',
    normalizedUrl: 'http://example.com/docs?tab=readme',
    key: 'http://example.com/docs?tab=readme',
  })
})

test('typed URL candidate accepts localhost and IP hosts with optional port, path, and query', () => {
  assert.deepEqual(createTypedUrlCandidate('localhost:3000/foo?tab=one'), {
    displayInput: 'localhost:3000/foo?tab=one',
    normalizedUrl: 'https://localhost:3000/foo?tab=one',
    key: 'https://localhost:3000/foo?tab=one',
  })
  assert.deepEqual(createTypedUrlCandidate('127.0.0.1:5173/test'), {
    displayInput: '127.0.0.1:5173/test',
    normalizedUrl: 'https://127.0.0.1:5173/test',
    key: 'https://127.0.0.1:5173/test',
  })
})

test('typed URL candidate rejects search text, slash-only shorthand, unsupported schemes, and empty input', () => {
  for (const input of ['', '   ', 'github scry issues', 'github/mskilab-org/repo', 'repo/issues', 'arbitrary text with spaces', 'ftp://example.com/file']) {
    assert.equal(createTypedUrlCandidate(input), null)
  }
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
