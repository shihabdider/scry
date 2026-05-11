import test from 'node:test'
import assert from 'node:assert/strict'

import { formatAge, highlightText } from '../src/core/format.js'
import { normalizeExactPhrase, normalizeWebsiteFilter, parseExactPhrases, parseQuery, parseWebsiteFilters, queryKeyWithWebsiteFilters } from '../src/core/query.js'
import { recordSelection } from '../src/core/selection-learning.js'
import {
  __testing,
  buildHistoryIndex,
  collectExactPhraseEvidence,
  collectWebsiteFilterEvidence,
  compareQuoteEvidence,
  entryMatchesWebsiteFilters,
  applyWebsiteFilters,
  searchHistory,
  searchParsedHistory,
} from '../src/core/search.js'
import {
  createTypedUrlCandidate,
  middleTruncate,
  websiteNameCandidatesForHostname,
  websiteNameCandidatesForLocalFileUrl,
  websiteNameCandidatesForUrl,
} from '../src/core/url.js'

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

test('website filter normalization preserves raw filter contents and lowercases match text', () => {
  assert.deepEqual(normalizeWebsiteFilter('GitHub'), {
    rawText: 'GitHub',
    matchText: 'github',
  })
})

test('website filter normalization trims outer whitespace for hostname matching', () => {
  assert.deepEqual(normalizeWebsiteFilter('  GitHub.COM\n'), {
    rawText: '  GitHub.COM\n',
    matchText: 'github.com',
  })
})

test('website filter normalization keeps empty filter contents ineffective', () => {
  assert.deepEqual(normalizeWebsiteFilter(' \n\t '), {
    rawText: ' \n\t ',
    matchText: '',
  })
})

test('website-filter query keys preserve legacy token-only identity', () => {
  assert.equal(queryKeyWithWebsiteFilters(['git', 'issues', '13'], []), 'git issues 13')
  assert.equal(queryKeyWithWebsiteFilters([], []), '')
})

test('website-filter query keys distinguish colon-filtered intent from ordinary tokens', () => {
  assert.equal(queryKeyWithWebsiteFilters([], [normalizeWebsiteFilter('Git')]), 'git:')
  assert.notEqual(queryKeyWithWebsiteFilters([], [normalizeWebsiteFilter('Git')]), queryKeyWithWebsiteFilters(['git'], []))
})

test('website-filter query keys use normalized stable colon filters with ordinary tokens', () => {
  assert.equal(
    queryKeyWithWebsiteFilters(['issues', '13'], [normalizeWebsiteFilter('Docs'), normalizeWebsiteFilter('  GitHub.COM\n')]),
    'docs: github.com: issues 13',
  )
  assert.equal(
    queryKeyWithWebsiteFilters(['issues', '13'], [normalizeWebsiteFilter('  github.com\n'), normalizeWebsiteFilter('docs')]),
    'docs: github.com: issues 13',
  )
})

test('website filter parsing leaves ordinary query text unchanged', () => {
  assert.deepEqual(parseWebsiteFilters('github repo issue'), {
    unfilteredText: 'github repo issue',
    websiteFilters: [],
  })
})

test('website filter parsing removes leading colon filters and normalizes each filter', () => {
  assert.deepEqual(parseWebsiteFilters('Git: issues 13'), {
    unfilteredText: 'issues 13',
    websiteFilters: [normalizeWebsiteFilter('Git')],
  })
  assert.deepEqual(parseWebsiteFilters('Git:scry'), {
    unfilteredText: 'scry',
    websiteFilters: [normalizeWebsiteFilter('Git')],
  })
  assert.deepEqual(parseWebsiteFilters('Git:Docs:issue'), {
    unfilteredText: 'issue',
    websiteFilters: [normalizeWebsiteFilter('Git'), normalizeWebsiteFilter('Docs')],
  })
})

test('website filter parsing treats colon without query text as a filter-only search', () => {
  assert.deepEqual(parseWebsiteFilters('git:'), {
    unfilteredText: '',
    websiteFilters: [normalizeWebsiteFilter('git')],
  })
})

test('website filter parsing requires colon filters to be leading site prefixes without URL-scheme slashes', () => {
  assert.deepEqual(parseWebsiteFilters('alpha git: beta'), {
    unfilteredText: 'alpha git: beta',
    websiteFilters: [],
  })
  assert.deepEqual(parseWebsiteFilters('https://github.com/shihabdider/scry'), {
    unfilteredText: 'https://github.com/shihabdider/scry',
    websiteFilters: [],
  })
})

test('website filter parsing treats legacy incomplete brackets as ordinary unfiltered text', () => {
  assert.deepEqual(parseWebsiteFilters('[git'), {
    unfilteredText: '[git',
    websiteFilters: [],
  })
  assert.deepEqual(parseWebsiteFilters('git: beta [docs'), {
    unfilteredText: 'beta [docs',
    websiteFilters: [normalizeWebsiteFilter('git')],
  })
})

test('website filter parsing keeps unfiltered tokens separated around adjacent legacy filters', () => {
  assert.deepEqual(parseWebsiteFilters('alpha[git]omega'), {
    unfilteredText: 'alpha omega',
    websiteFilters: [normalizeWebsiteFilter('git')],
  })
  assert.deepEqual(parseWebsiteFilters('alpha[git][docs]omega'), {
    unfilteredText: 'alpha omega',
    websiteFilters: [normalizeWebsiteFilter('git'), normalizeWebsiteFilter('docs')],
  })
})

test('website filter parsing omits empty normalized filters while removing complete legacy brackets', () => {
  assert.deepEqual(parseWebsiteFilters('alpha[  \n\t ]omega'), {
    unfilteredText: 'alpha omega',
    websiteFilters: [],
  })
})

test('website filter parsing still accepts complete legacy bracket filters for stored keys', () => {
  assert.deepEqual(parseWebsiteFilters('alpha [git] beta [docs]'), {
    unfilteredText: 'alpha  beta ',
    websiteFilters: [normalizeWebsiteFilter('git'), normalizeWebsiteFilter('docs')],
  })
})

test('exact phrase parsing leaves ordinary unquoted query text unchanged', () => {
  assert.deepEqual(parseExactPhrases('github repo issue'), {
    unquotedText: 'github repo issue',
    exactPhrases: [],
    hasIncompleteQuote: false,
  })
})

test('exact phrase parsing removes complete quoted phrases and normalizes each phrase', () => {
  assert.deepEqual(parseExactPhrases('github "MSKILAB-org/repo" issue "pull\n requests"'), {
    unquotedText: 'github  issue ',
    exactPhrases: [
      {
        rawText: 'MSKILAB-org/repo',
        matchText: 'MSKILAB-org/repo',
        caseSensitive: true,
      },
      {
        rawText: 'pull\n requests',
        matchText: 'pull requests',
        caseSensitive: false,
      },
    ],
    hasIncompleteQuote: false,
  })
})

test('exact phrase parsing treats an unfinished quote as ordinary unquoted text without warning', () => {
  assert.deepEqual(parseExactPhrases('"github.com/mskilab'), {
    unquotedText: '"github.com/mskilab',
    exactPhrases: [],
    hasIncompleteQuote: false,
  })
})

test('exact phrase parsing preserves complete phrases before an unfinished ordinary quote segment', () => {
  assert.deepEqual(parseExactPhrases('github "pull requests" "mskilab'), {
    unquotedText: 'github  "mskilab',
    exactPhrases: [
      {
        rawText: 'pull requests',
        matchText: 'pull requests',
        caseSensitive: false,
      },
    ],
    hasIncompleteQuote: false,
  })
})

test('exact phrase parsing does not treat backslashes as quote escapes', () => {
  assert.deepEqual(parseExactPhrases(String.raw`alpha "one \" omega`), {
    unquotedText: 'alpha  omega',
    exactPhrases: [
      {
        rawText: 'one \\',
        matchText: 'one \\',
        caseSensitive: false,
      },
    ],
    hasIncompleteQuote: false,
  })
})

test('exact phrase parsing keeps unquoted tokens separated around adjacent quoted text', () => {
  assert.deepEqual(parseExactPhrases('alpha"discard"omega'), {
    unquotedText: 'alpha omega',
    exactPhrases: [
      {
        rawText: 'discard',
        matchText: 'discard',
        caseSensitive: false,
      },
    ],
    hasIncompleteQuote: false,
  })
})

test('query parsing preserves unquoted search tokens and derives the learning key from them', () => {
  assert.deepEqual(parseQuery(' GitHub PR-13 README '), {
    raw: ' GitHub PR-13 README ',
    tokens: ['github', 'pr', '13', 'readme'],
    unquotedTokens: ['github', 'pr', '13', 'readme'],
    exactPhrases: [],
    websiteFilters: [],
    key: 'github pr 13 readme',
  })
})

test('query parsing separates complete quoted phrases from unquoted ranking tokens', () => {
  assert.deepEqual(parseQuery('github "MSKILAB-org/repo" issue "pull\n requests"'), {
    raw: 'github "MSKILAB-org/repo" issue "pull\n requests"',
    tokens: ['github', 'issue'],
    unquotedTokens: ['github', 'issue'],
    exactPhrases: [normalizeExactPhrase('MSKILAB-org/repo'), normalizeExactPhrase('pull\n requests')],
    websiteFilters: [],
    key: 'github issue',
  })
})

test('query parsing uses an empty learning key when all text is quoted', () => {
  assert.deepEqual(parseQuery('"github.com/mskilab-org/repo"'), {
    raw: '"github.com/mskilab-org/repo"',
    tokens: [],
    unquotedTokens: [],
    exactPhrases: [normalizeExactPhrase('github.com/mskilab-org/repo')],
    websiteFilters: [],
    key: '',
  })
})

test('query parsing treats incomplete quotes as ordinary unquoted text', () => {
  assert.deepEqual(parseQuery('github "pull requests'), {
    raw: 'github "pull requests',
    tokens: ['github', 'pull', 'requests'],
    unquotedTokens: ['github', 'pull', 'requests'],
    exactPhrases: [],
    websiteFilters: [],
    key: 'github pull requests',
  })
})

test('query parsing separates complete website filters from unquoted ranking tokens', () => {
  assert.deepEqual(parseQuery('Git: Docs: issue'), {
    raw: 'Git: Docs: issue',
    tokens: ['issue'],
    unquotedTokens: ['issue'],
    exactPhrases: [],
    websiteFilters: [normalizeWebsiteFilter('Git'), normalizeWebsiteFilter('Docs')],
    key: 'docs: git: issue',
  })
})

test('query parsing uses a colon after the site query for website filtering', () => {
  assert.deepEqual(parseQuery('git: issues 13'), {
    raw: 'git: issues 13',
    tokens: ['issues', '13'],
    unquotedTokens: ['issues', '13'],
    exactPhrases: [],
    websiteFilters: [normalizeWebsiteFilter('git')],
    key: 'git: issues 13',
  })
  assert.deepEqual(parseQuery('git:scry'), {
    raw: 'git:scry',
    tokens: ['scry'],
    unquotedTokens: ['scry'],
    exactPhrases: [],
    websiteFilters: [normalizeWebsiteFilter('git')],
    key: 'git: scry',
  })
})

test('query parsing treats legacy incomplete website brackets as ordinary unquoted text', () => {
  assert.deepEqual(parseQuery('git: beta [docs'), {
    raw: 'git: beta [docs',
    tokens: ['beta', 'docs'],
    unquotedTokens: ['beta', 'docs'],
    exactPhrases: [],
    websiteFilters: [normalizeWebsiteFilter('git')],
    key: 'git: beta docs',
  })
})

test('query parsing preserves colon text inside complete exact phrases', () => {
  assert.deepEqual(parseQuery('"github Git: issue" Docs: readme'), {
    raw: '"github Git: issue" Docs: readme',
    tokens: ['readme'],
    unquotedTokens: ['readme'],
    exactPhrases: [normalizeExactPhrase('github Git: issue')],
    websiteFilters: [normalizeWebsiteFilter('Docs')],
    key: 'docs: readme',
  })
})

test('query parsing preserves incomplete quote behavior while applying website filters', () => {
  assert.deepEqual(parseQuery('Docs: github "pull requests'), {
    raw: 'Docs: github "pull requests',
    tokens: ['github', 'pull', 'requests'],
    unquotedTokens: ['github', 'pull', 'requests'],
    exactPhrases: [],
    websiteFilters: [normalizeWebsiteFilter('Docs')],
    key: 'docs: github pull requests',
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

test('website filter evidence vacuously matches an empty filter list', () => {
  assert.deepEqual(collectWebsiteFilterEvidence({ websiteName: websiteNameCandidatesForHostname('') }, []), {
    matched: true,
    evidence: [],
  })
})

test('website filter evidence records the first prefix-matching website-name candidate per filter', () => {
  const entry = { websiteName: websiteNameCandidatesForHostname('Docs.GitHub.COM') }
  const rootFilter = normalizeWebsiteFilter('Git')
  const rootDomainFilter = normalizeWebsiteFilter('github.c')
  const subdomainFilter = normalizeWebsiteFilter('docs.g')

  assert.deepEqual(collectWebsiteFilterEvidence(entry, [rootFilter, rootDomainFilter, subdomainFilter]), {
    matched: true,
    evidence: [
      { filter: rootFilter, candidate: 'github' },
      { filter: rootDomainFilter, candidate: 'github.com' },
      { filter: subdomainFilter, candidate: 'docs.github.com' },
    ],
  })
})

test('website filter evidence requires every non-empty filter to match as a hard filter', () => {
  const entry = { websiteName: websiteNameCandidatesForHostname('github.com') }

  assert.deepEqual(collectWebsiteFilterEvidence(entry, [normalizeWebsiteFilter('git'), normalizeWebsiteFilter('docs')]), {
    matched: false,
    evidence: [],
  })
})

test('website filter evidence treats empty filters as ineffective while missing candidates fail non-empty filters', () => {
  const emptyFilter = normalizeWebsiteFilter('   ')
  const gitFilter = normalizeWebsiteFilter('git')

  assert.deepEqual(collectWebsiteFilterEvidence({ websiteName: websiteNameCandidatesForHostname('github.com') }, [emptyFilter, gitFilter]), {
    matched: true,
    evidence: [{ filter: gitFilter, candidate: 'github' }],
  })
  assert.deepEqual(collectWebsiteFilterEvidence({}, [gitFilter]), {
    matched: false,
    evidence: [],
  })
})

test('entry website filter matching accepts missing or empty filters as no hard filter', () => {
  assert.equal(entryMatchesWebsiteFilters({}, []), true)
  assert.equal(entryMatchesWebsiteFilters({}, [normalizeWebsiteFilter('   ')]), true)
})

test('entry website filter matching accepts only entries that satisfy every non-empty filter', () => {
  const entry = { websiteName: websiteNameCandidatesForHostname('docs.github.com') }

  assert.equal(entryMatchesWebsiteFilters(entry, [normalizeWebsiteFilter('git'), normalizeWebsiteFilter('docs.g')]), true)
  assert.equal(entryMatchesWebsiteFilters(entry, [normalizeWebsiteFilter('git'), normalizeWebsiteFilter('linear')]), false)
})

test('entry website filter matching rejects non-empty filters when an entry has no website candidates', () => {
  assert.equal(entryMatchesWebsiteFilters({}, [normalizeWebsiteFilter('git')]), false)
})

test('apply website filters returns every entry in order when filters are empty or missing', () => {
  const entries = [
    { id: 'first', websiteName: websiteNameCandidatesForHostname('github.com') },
    { id: 'second', websiteName: websiteNameCandidatesForHostname('example.com') },
  ]

  assert.deepEqual(applyWebsiteFilters(entries, []), entries)
  assert.deepEqual(applyWebsiteFilters(entries), entries)
})

test('apply website filters keeps only entries satisfying every non-empty website filter', () => {
  const entries = [
    { id: 'docs-github', websiteName: websiteNameCandidatesForHostname('docs.github.com') },
    { id: 'github', websiteName: websiteNameCandidatesForHostname('github.com') },
    { id: 'docs-linear', websiteName: websiteNameCandidatesForHostname('docs.linear.app') },
    { id: 'missing-candidates' },
  ]

  assert.deepEqual(
    applyWebsiteFilters(entries, [normalizeWebsiteFilter('git'), normalizeWebsiteFilter('docs.g')]).map((entry) => entry.id),
    ['docs-github'],
  )
})

test('apply website filters ignores empty filters while preserving matching entry order', () => {
  const entries = [
    { id: 'gitter', websiteName: websiteNameCandidatesForHostname('gitter.com') },
    { id: 'example', websiteName: websiteNameCandidatesForHostname('example.com') },
    { id: 'gitopia', websiteName: websiteNameCandidatesForHostname('gitopia.com') },
  ]

  assert.deepEqual(
    applyWebsiteFilters(entries, [normalizeWebsiteFilter('   '), normalizeWebsiteFilter('git')]).map((entry) => entry.id),
    ['gitter', 'gitopia'],
  )
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

test('parsed unquoted search preserves existing token ranking behavior', () => {
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

  assert.deepEqual(
    searchParsedHistory(index, parseQuery('issues 13'), { now }).map((result) => result.url),
    searchHistory(index, 'issues 13', { now }).map((result) => result.url),
  )
})

test('website-filter-only parsed search uses empty-query ordering within the filtered set', () => {
  const index = indexOf([
    {
      url: 'https://example.com/newest-overall',
      title: 'Newest overall must be filtered out',
      visitCount: 1000,
      lastVisitTime: now,
    },
    {
      url: 'https://github.com/org/newer',
      title: 'Newer matching GitHub page',
      visitCount: 1,
      lastVisitTime: now - 60_000,
    },
    {
      url: 'https://docs.github.com/org/older',
      title: 'Older matching GitHub docs page',
      visitCount: 1,
      lastVisitTime: now - 120_000,
    },
  ])

  const results = searchParsedHistory(index, parseQuery('git:'), { now, emptyQuerySort: 'recency' })

  assert.deepEqual(
    results.map((result) => result.url),
    ['https://github.com/org/newer', 'https://docs.github.com/org/older'],
  )
  assert.deepEqual(
    results.map((result) => result.debug.mode),
    ['recency', 'recency'],
  )
})

test('website-filter parsed search preserves token ranking within matching websites', () => {
  const index = indexOf([
    {
      url: 'https://linear.app/acme/issues/13',
      title: 'Perfect non-Git match must be filtered out',
      visitCount: 1000,
      lastVisitTime: now,
    },
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

  const results = searchParsedHistory(index, parseQuery('git: issues 13'), { now })

  assert.deepEqual(
    results.map((result) => result.url),
    [
      'https://github.com/shihabdider/skilift/issues/13',
      'https://github.com/shihabdider/skilift/pull/13?filter=issues',
    ],
  )
  assert.deepEqual(results[0].debug.tokens, ['issues', '13'])
})

test('website-filter parsed search accepts adjacent colon query text', () => {
  const index = indexOf([
    {
      url: 'https://learn.example.com/scry',
      title: 'Scry training outside Git sites must be filtered out',
      visitCount: 1000,
      lastVisitTime: now,
    },
    {
      url: 'https://github.com/shihabdider/scry',
      title: 'Scry repository',
      visitCount: 1,
      lastVisitTime: now - 10_000,
    },
  ])

  const results = searchParsedHistory(index, parseQuery('git:scry'), { now })

  assert.deepEqual(results.map((result) => result.url), ['https://github.com/shihabdider/scry'])
  assert.deepEqual(results[0].debug.tokens, ['scry'])
  assert.deepEqual(results[0].debug.websiteFilterEvidence.evidence[0].candidate, 'github')
})

test('website-filter-only parsed search matches local file URL candidates', () => {
  const index = indexOf([
    {
      url: 'https://example.com/newest-overall',
      title: 'Newest overall must be filtered out',
      visitCount: 1000,
      lastVisitTime: now,
    },
    {
      url: 'file:///Users/user1/Downloads/older.pdf',
      title: 'Older local file',
      visitCount: 1,
      lastVisitTime: now - 120_000,
    },
    {
      url: 'file:///Users/user1/Downloads/newer.pdf',
      title: 'Newer local file',
      visitCount: 1,
      lastVisitTime: now - 60_000,
    },
  ])

  const results = searchParsedHistory(index, parseQuery('file:'), { now, emptyQuerySort: 'recency' })

  assert.deepEqual(results.map((result) => result.url), [
    'file:///Users/user1/Downloads/newer.pdf',
    'file:///Users/user1/Downloads/older.pdf',
  ])
  assert.deepEqual(results[0].debug.websiteFilterEvidence.evidence[0].candidate, 'file')
})

test('website-filter parsed search composes local file filters with ordinary token ranking', () => {
  const index = indexOf([
    {
      url: 'file:///Users/user1/Downloads/books/Precalculus%20mathematics%20in%20a%20nutshell.pdf',
      title: 'Precalculus mathematics in a nutshell',
      visitCount: 1,
      lastVisitTime: now - 60_000,
    },
    {
      url: 'file:///Users/user1/Downloads/books/Geometry.pdf',
      title: 'Geometry notes',
      visitCount: 1000,
      lastVisitTime: now,
    },
    {
      url: 'https://example.com/precalculus',
      title: 'Precalculus web result must be filtered out',
      visitCount: 1000,
      lastVisitTime: now,
    },
  ])

  const results = searchParsedHistory(index, parseQuery('file: precalculus'), { now })

  assert.deepEqual(results.map((result) => result.url), [
    'file:///Users/user1/Downloads/books/Precalculus%20mathematics%20in%20a%20nutshell.pdf',
  ])
  assert.deepEqual(results[0].debug.tokens, ['precalculus'])
  assert.deepEqual(results[0].debug.websiteFilterEvidence.evidence[0].candidate, 'file')
})

test('website-filter parsed search requires both colon filters and exact phrases', () => {
  const index = indexOf([
    {
      url: 'https://github.com/org/pulls',
      title: 'Pull requests',
      visitCount: 1,
      lastVisitTime: now - 60_000,
    },
    {
      url: 'https://example.com/pulls',
      title: 'Pull requests',
      visitCount: 1000,
      lastVisitTime: now,
    },
    {
      url: 'https://github.com/org/issues',
      title: 'Issues without the phrase',
      visitCount: 1000,
      lastVisitTime: now,
    },
  ])

  const results = searchParsedHistory(index, parseQuery('git: "pull requests"'), { now })

  assert.deepEqual(results.map((result) => result.url), ['https://github.com/org/pulls'])
  assert.equal(results[0].debug.mode, 'quoted')
  assert.equal(results[0].debug.quoteEvidence.evidence[0].field, 'title')
})

test('website-filter token search keeps selection learning distinct from unfiltered intent', () => {
  const index = indexOf([
    {
      url: 'https://github.com/acme/a/issues',
      title: 'Issues',
      visitCount: 1,
      lastVisitTime: now,
    },
    {
      url: 'https://github.com/acme/b/issues',
      title: 'Issues',
      visitCount: 1,
      lastVisitTime: now,
    },
  ])
  const unfilteredUrlKey = index.entries.find((entry) => entry.url === 'https://github.com/acme/a/issues').key
  const filteredUrlKey = index.entries.find((entry) => entry.url === 'https://github.com/acme/b/issues').key
  const selections = {
    version: 1,
    aggregates: {
      issues: {
        [unfilteredUrlKey]: { count: 20, lastSelectedAt: now, selectedAt: [now] },
      },
      'git: issues': {
        [filteredUrlKey]: { count: 1, lastSelectedAt: now, selectedAt: [now] },
      },
    },
  }

  const results = searchParsedHistory(index, parseQuery('git: issues'), { now, selections })

  assert.equal(results[0].url, 'https://github.com/acme/b/issues')
  assert.ok(results[0].debug.selectionBoost > 0)
  assert.equal(results[1].debug.selectionBoost, 0)
})

test('public search handles quote-only exact phrases through parsed search', () => {
  const index = indexOf([
    {
      url: 'https://example.com/alpha-reference',
      title: 'Old URL phrase',
      visitCount: 1,
      lastVisitTime: now - 30 * 24 * 60 * 60 * 1000,
    },
    {
      url: 'https://example.com/reference',
      title: 'Alpha reference',
      visitCount: 100,
      lastVisitTime: now,
    },
    {
      url: 'https://example.com/no-match',
      title: 'Different reference',
      visitCount: 1000,
      lastVisitTime: now,
    },
  ])

  const results = searchHistory(index, '"alpha"', { now })

  assert.deepEqual(
    results.map((result) => result.url),
    ['https://example.com/alpha-reference', 'https://example.com/reference'],
  )
  assert.equal(results[0].debug.mode, 'quoted')
  assert.equal(results[0].debug.quoteEvidence.evidence[0].field, 'displayUrl')
  assert.equal(results[1].debug.quoteEvidence.evidence[0].field, 'title')
})

test('public search combines unquoted token ranking with quoted exact phrase filtering', () => {
  const index = indexOf([
    {
      url: 'https://example.com/alpha',
      title: 'Issues from title only',
      visitCount: 500,
      lastVisitTime: now,
    },
    {
      url: 'https://github.com/org/issues/13',
      title: 'Alpha tracking',
      visitCount: 1,
      lastVisitTime: now - 30 * 24 * 60 * 60 * 1000,
    },
    {
      url: 'https://github.com/org/issues/99',
      title: 'No quoted phrase',
      visitCount: 1000,
      lastVisitTime: now,
    },
  ])

  const results = searchHistory(index, 'issues "alpha"', { now })

  assert.deepEqual(
    results.map((result) => result.url),
    ['https://github.com/org/issues/13', 'https://example.com/alpha'],
  )
  assert.deepEqual(results[0].debug.tokens, ['issues'])
  assert.equal(results[0].debug.mode, 'mixed')
  assert.equal(results[0].debug.quoteEvidence.evidence[0].field, 'title')
  assert.equal(results[1].debug.quoteEvidence.evidence[0].field, 'displayUrl')
})

test('quote-only parsed search hard-filters entries and ranks URL phrase matches before fresher title matches', () => {
  const index = indexOf([
    {
      url: 'https://example.com/alpha-reference',
      title: 'Old URL phrase',
      visitCount: 1,
      lastVisitTime: now - 30 * 24 * 60 * 60 * 1000,
    },
    {
      url: 'https://example.com/reference',
      title: 'Alpha reference',
      visitCount: 100,
      lastVisitTime: now,
    },
    {
      url: 'https://example.com/no-match',
      title: 'Different reference',
      visitCount: 1000,
      lastVisitTime: now,
    },
  ])

  const results = searchParsedHistory(index, parseQuery('"alpha"'), { now })

  assert.deepEqual(
    results.map((result) => result.url),
    ['https://example.com/alpha-reference', 'https://example.com/reference'],
  )
  assert.equal(results[0].debug.quoteEvidence.evidence[0].field, 'displayUrl')
  assert.equal(results[1].debug.quoteEvidence.evidence[0].field, 'title')
  assert.equal(results[0].urlHtml.includes('<b>'), false)
  assert.equal(results[1].titleHtml.includes('<b>'), false)
})

test('quote-only parsed search uses frecency after quote quality ties', () => {
  const index = indexOf([
    {
      url: 'https://example.com/alpha-old',
      title: 'Alpha old',
      visitCount: 500,
      lastVisitTime: now - 100 * 24 * 60 * 60 * 1000,
    },
    {
      url: 'https://example.com/alpha-new',
      title: 'Alpha new',
      visitCount: 1,
      lastVisitTime: now - 5 * 60 * 1000,
    },
  ])

  const results = searchParsedHistory(index, parseQuery('"alpha"'), { now })

  assert.deepEqual(
    results.map((result) => result.url),
    ['https://example.com/alpha-new', 'https://example.com/alpha-old'],
  )
  assert.equal(results[0].debug.mode, 'quoted')
  assert.equal(typeof results[0].debug.frecencyScore, 'number')
})

test('mixed parsed search filters by exact phrases while unquoted token ranking stays primary', () => {
  const index = indexOf([
    {
      url: 'https://example.com/alpha',
      title: 'Issues from title only',
      visitCount: 500,
      lastVisitTime: now,
    },
    {
      url: 'https://github.com/org/issues/13',
      title: 'Alpha tracking',
      visitCount: 1,
      lastVisitTime: now - 30 * 24 * 60 * 60 * 1000,
    },
    {
      url: 'https://github.com/org/issues/99',
      title: 'No quoted phrase',
      visitCount: 1000,
      lastVisitTime: now,
    },
  ])

  const results = searchParsedHistory(index, parseQuery('issues "alpha"'), { now })

  assert.deepEqual(
    results.map((result) => result.url),
    ['https://github.com/org/issues/13', 'https://example.com/alpha'],
  )
  assert.deepEqual(results[0].debug.tokens, ['issues'])
  assert.equal(results[0].debug.quoteEvidence.evidence[0].field, 'title')
  assert.equal(results[1].debug.quoteEvidence.evidence[0].field, 'displayUrl')
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

test('history index entries include website-name candidates alongside existing searchable segments', () => {
  const index = indexOf([
    {
      url: 'https://Docs.GitHub.COM/pulls?tab=open#top',
      title: 'Open pull requests',
      visitCount: 1,
      lastVisitTime: now,
    },
  ])

  assert.equal(index.entries.length, 1)
  assert.deepEqual(index.entries[0].websiteName, {
    hostname: 'docs.github.com',
    rootName: 'github',
    labels: ['docs', 'github', 'com'],
    matchCandidates: ['github', 'docs.github.com', 'github.com', 'docs'],
  })
  assert.ok(index.entries[0].segments.some((segment) => segment.field === 'host' && segment.token === 'github'))
  assert.ok(index.entries[0].segments.some((segment) => segment.field === 'title' && segment.token === 'pull'))
})

test('history index website-name candidates follow normalized aggregate URLs', () => {
  const index = indexOf([
    {
      url: 'https://WWW.GitHub.COM/issues/13/?utm_source=newsletter#discussion',
      title: 'Older noisy copy',
      visitCount: 2,
      lastVisitTime: now - 2_000,
    },
    {
      url: 'https://www.github.com/issues/13#latest',
      title: 'Latest normalized copy',
      visitCount: 3,
      lastVisitTime: now,
    },
  ])

  assert.equal(index.entries.length, 1)
  assert.equal(index.entries[0].url, 'https://www.github.com/issues/13')
  assert.equal(index.entries[0].visitCount, 5)
  assert.equal(index.entries[0].title, 'Latest normalized copy')
  assert.deepEqual(index.entries[0].websiteName, websiteNameCandidatesForUrl(index.entries[0].url))
  assert.deepEqual(index.entries[0].websiteName.matchCandidates, ['github', 'github.com'])
})

test('website name candidates derive lowercase host and root candidates for domain hostnames', () => {
  assert.deepEqual(websiteNameCandidatesForHostname('GitHub.COM'), {
    hostname: 'github.com',
    rootName: 'github',
    labels: ['github', 'com'],
    matchCandidates: ['github', 'github.com'],
  })
})

test('website name candidates ignore common leading www before deriving root candidates', () => {
  assert.deepEqual(websiteNameCandidatesForHostname('WWW.GitHub.COM'), {
    hostname: 'github.com',
    rootName: 'github',
    labels: ['github', 'com'],
    matchCandidates: ['github', 'github.com'],
  })
})

test('website name candidates include subdomain and root-domain candidates for prefix website filters', () => {
  assert.deepEqual(websiteNameCandidatesForHostname('Docs.GitHub.COM'), {
    hostname: 'docs.github.com',
    rootName: 'github',
    labels: ['docs', 'github', 'com'],
    matchCandidates: ['github', 'docs.github.com', 'github.com', 'docs'],
  })
})

test('website name candidates handle single-label and empty hostnames deterministically', () => {
  assert.deepEqual(websiteNameCandidatesForHostname('localhost'), {
    hostname: 'localhost',
    rootName: 'localhost',
    labels: ['localhost'],
    matchCandidates: ['localhost'],
  })
  assert.deepEqual(websiteNameCandidatesForHostname('  '), {
    hostname: '',
    rootName: '',
    labels: [],
    matchCandidates: [],
  })
})

test('website name candidates for URLs derive candidates from parsed URL hostnames', () => {
  assert.deepEqual(websiteNameCandidatesForUrl('https://Docs.GitHub.COM/pulls?tab=open#top'), {
    hostname: 'docs.github.com',
    rootName: 'github',
    labels: ['docs', 'github', 'com'],
    matchCandidates: ['github', 'docs.github.com', 'github.com', 'docs'],
  })
})

test('website name candidates for URLs ignore common www hostnames after local URL parsing', () => {
  assert.deepEqual(websiteNameCandidatesForUrl('http://WWW.GitHub.COM:80/issues/13'), {
    hostname: 'github.com',
    rootName: 'github',
    labels: ['github', 'com'],
    matchCandidates: ['github', 'github.com'],
  })
})

test('website name candidates for local file URLs use the scheme-derived file candidate', () => {
  assert.deepEqual(websiteNameCandidatesForLocalFileUrl(new URL('file:///Users/user1/Downloads/report.pdf')), {
    hostname: '',
    rootName: 'file',
    labels: [],
    matchCandidates: ['file'],
  })
})

test('website name candidates for URLs route valid local file URLs to the file candidate', () => {
  assert.deepEqual(websiteNameCandidatesForUrl('file:///Users/user1/Downloads/report.pdf'), {
    hostname: '',
    rootName: 'file',
    labels: [],
    matchCandidates: ['file'],
  })
})

test('website name candidates for local file URLs do not derive candidates from filesystem path text', () => {
  assert.deepEqual(
    websiteNameCandidatesForLocalFileUrl(
      new URL(
        'file:///Users/user1/Downloads/books/Precalculus%20mathematics%20in%20a%20nutshell%20%20geometry,%20algebra,%20trigonometry.pdf',
      ),
    ),
    {
      hostname: '',
      rootName: 'file',
      labels: [],
      matchCandidates: ['file'],
    },
  )
})

test('website filter evidence prefix-matches the local file candidate', () => {
  const entry = { websiteName: websiteNameCandidatesForLocalFileUrl(new URL('file:///Users/user1/Downloads/report.pdf')) }
  const fileFilter = normalizeWebsiteFilter('fil')

  assert.deepEqual(collectWebsiteFilterEvidence(entry, [fileFilter]), {
    matched: true,
    evidence: [{ filter: fileFilter, candidate: 'file' }],
  })
})

test('website name candidates for URLs return safe empty candidates for invalid or hostless URLs', () => {
  const emptyCandidates = {
    hostname: '',
    rootName: '',
    labels: [],
    matchCandidates: [],
  }

  assert.deepEqual(websiteNameCandidatesForUrl('not a url'), emptyCandidates)
  assert.deepEqual(websiteNameCandidatesForUrl('data:text/plain,hello'), emptyCandidates)
  assert.deepEqual(websiteNameCandidatesForUrl(null), emptyCandidates)
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

test('empty query can sort by pure recency for closed URL mode callers', () => {
  const index = indexOf([
    {
      url: 'https://example.com/recent-one-off',
      title: 'Recent one off',
      visitCount: 1,
      lastVisitTime: now - 5 * 60 * 1000,
    },
    {
      url: 'https://example.com/older-recurring',
      title: 'Older recurring',
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

  const results = searchHistory(index, '', { now, emptyQuerySort: 'recency' })

  assert.deepEqual(results.map((result) => result.url), [
    'https://example.com/recent-one-off',
    'https://example.com/older-recurring',
    'https://example.com/stale-popular',
  ])
  assert.equal(results[0].debug.mode, 'recency')
})

test('space-separated URL fragments find a visited GitHub issue from remembered fragments', () => {
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

  const results = searchHistory(index, 'git skilift issues 13', { now })

  assert.equal(results[0].url, 'https://github.com/shihabdider/skilift/issues/13')
  assert.equal(results[0].debug.orderedUrlCoverage, 4)
})

test('starred URL fragments remain tolerated for backward compatibility', () => {
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

  const spaceSeparatedResults = searchHistory(index, 'git skilift issues 13', { now })
  const starredResults = searchHistory(index, 'git*skilift*issues*13', { now })

  assert.equal(starredResults[0].url, 'https://github.com/shihabdider/skilift/issues/13')
  assert.equal(starredResults[0].url, spaceSeparatedResults[0].url)
  assert.equal(starredResults[0].debug.orderedUrlCoverage, 4)
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
