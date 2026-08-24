import { formatAge, formatVisits, highlightText } from './format.js'
import { isNumericToken, normalizeWebsiteFilterMatchText, parseQuery } from './query.js'
import { selectionBoost } from './selection-learning.js'
import { buildSegments, middleTruncate, normalizeHistoryUrl, websiteNameCandidatesForUrl } from './url.js'

const DEFAULT_LIMIT = 30
const URL_FIELDS = new Set(['host', 'path'])

const FIELD_PRIORITY = {
  host: 4,
  path: 4,
  title: 2,
  query: 1,
}

const TIER = {
  none: 0,
  substring: 1,
  abbreviation: 2,
  prefix: 3,
  exact: 4,
}

/**
 * @typedef {object} HistoryIndexEntry
 * @property {string} key Normalized URL key.
 * @property {string} url Full normalized navigable URL.
 * @property {string} displayUrl Display URL used for result rendering and phrase evidence.
 * @property {string} title Result title.
 * @property {number} visitCount Visit count aggregate.
 * @property {number} lastVisitTime Last visit timestamp.
 * @property {object[]} segments Precomputed token segments for existing unquoted token ranking.
 * @property {import('./url.js').WebsiteNameCandidates} websiteName Website hostname/root-name candidates for website filters.
 */

/**
 * @typedef {object} HistoryIndex
 * @property {number} builtAt Millisecond timestamp when this in-memory index was built.
 * @property {HistoryIndexEntry[]} entries Normalized URL entries with precomputed searchable segments and website-name candidates.
 */

/**
 * @typedef {object} WebsiteFilterEvidence
 * @property {import('./query.js').WebsiteFilter} filter Website filter that matched.
 * @property {string} candidate Host/root candidate that satisfied the filter.
 */

/**
 * @typedef {object} SearchResult
 * @property {string} key Normalized URL key.
 * @property {string} url Full normalized navigable URL.
 * @property {string} displayUrl Truncated display URL.
 * @property {string} title Result title.
 * @property {number} visitCount Visit count aggregate.
 * @property {string} visitsLabel Human-readable visit count.
 * @property {number} lastVisitTime Last visit timestamp.
 * @property {string} lastVisitedLabel Human-readable recency label.
 * @property {string} urlHtml Highlighted display URL HTML.
 * @property {string} titleHtml Highlighted title HTML.
 * @property {object} debug Internal ranking explanation.
 */

/**
 * @typedef {object} ExactPhraseEvidence
 * @property {import('./query.js').ExactPhrase} phrase Phrase that matched.
 * @property {'displayUrl'|'title'} field Field containing the phrase match.
 * @property {number} position Character offset of the normalized phrase match.
 */

/**
 * @typedef {object} QuoteMatchResult
 * @property {boolean} matched True only when every exact phrase has evidence.
 * @property {ExactPhraseEvidence[]} evidence Match evidence, one item per phrase.
 * @property {number[]} qualityTuple URL-over-title and earlier-position ranking tuple.
 */

export function collectExactPhraseEvidence(entry, exactPhrases) {
  const normalizeFieldText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
  const fields = [
    { name: 'displayUrl', text: normalizeFieldText(entry?.displayUrl) },
    { name: 'title', text: normalizeFieldText(entry?.title) },
  ]
  const evidence = []

  for (const phrase of exactPhrases ?? []) {
    const matchText = String(phrase?.matchText ?? '')
    const needle = phrase?.caseSensitive ? matchText : matchText.toLowerCase()
    let match = null

    for (const field of fields) {
      const haystack = phrase?.caseSensitive ? field.text : field.text.toLowerCase()
      const position = haystack.indexOf(needle)
      if (position === -1) continue

      match = { phrase, field: field.name, position }
      break
    }

    if (!match) return { matched: false, evidence: [], qualityTuple: [] }
    evidence.push(match)
  }

  const totalPosition = evidence.reduce((sum, match) => sum + match.position, 0)

  return {
    matched: true,
    evidence,
    qualityTuple: [
      evidence.filter((match) => match.field === 'displayUrl').length,
      totalPosition === 0 ? 0 : -totalPosition,
    ],
  }
}

export function compareQuoteEvidence(a, b) {
  return compareTuple(a?.qualityTuple ?? [], b?.qualityTuple ?? [])
}

export function collectWebsiteFilterEvidence(entry, websiteFilters) {
  const candidates = Array.isArray(entry?.websiteName?.matchCandidates)
    ? entry.websiteName.matchCandidates.map(normalizeWebsiteFilterMatchText).filter(Boolean)
    : []
  const evidence = []

  for (const filter of websiteFilters ?? []) {
    const matchText = normalizeWebsiteFilterMatchText(filter?.matchText)
    if (!matchText) continue

    const candidate = candidates.find((candidate) => candidate.startsWith(matchText))
    if (!candidate) return { matched: false, evidence: [] }

    evidence.push({ filter, candidate })
  }

  return { matched: true, evidence }
}

export function entryMatchesWebsiteFilters(entry, websiteFilters) {
  return collectWebsiteFilterEvidence(entry, websiteFilters).matched
}

export function applyWebsiteFilters(entries, websiteFilters) {
  const allEntries = entries ?? []
  const hasActiveFilter = (websiteFilters ?? []).some((filter) => normalizeWebsiteFilterMatchText(filter?.matchText))
  if (!hasActiveFilter) return allEntries

  return allEntries.filter((entry) => entryMatchesWebsiteFilters(entry, websiteFilters))
}

export function searchParsedHistory(
  index,
  parsedQuery,
  { now = Date.now(), limit = DEFAULT_LIMIT, selections, emptyQuerySort = 'frecency' } = {},
) {
  const tokens = Array.isArray(parsedQuery?.unquotedTokens)
    ? parsedQuery.unquotedTokens
    : Array.isArray(parsedQuery?.tokens)
      ? parsedQuery.tokens
      : []
  const exactPhrases = Array.isArray(parsedQuery?.exactPhrases) ? parsedQuery.exactPhrases : []
  const websiteFilters = Array.isArray(parsedQuery?.websiteFilters) ? parsedQuery.websiteFilters : []
  const hasWebsiteFilters = websiteFilters.some((filter) => normalizeWebsiteFilterMatchText(filter?.matchText))
  const entries = [...applyWebsiteFilters(index?.entries ?? [], websiteFilters)]
  const selectionIntent = parsedQuery && typeof parsedQuery === 'object' && !Array.isArray(parsedQuery) ? parsedQuery : { tokens, websiteFilters }
  const debugWithWebsiteFilters = (entry, debug) =>
    hasWebsiteFilters
      ? {
          ...debug,
          websiteFilterEvidence: collectWebsiteFilterEvidence(entry, websiteFilters),
        }
      : debug

  if (!exactPhrases.length) {
    if (!tokens.length) {
      if (emptyQuerySort === 'recency') {
        return entries
          .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
          .slice(0, limit)
          .map((entry) =>
            toResult(entry, {
              tokens,
              now,
              debug: debugWithWebsiteFilters(entry, { mode: 'recency', score: entry.lastVisitTime }),
            }),
          )
      }

      return entries
        .map((entry) => ({ entry, score: frecencyScore(entry, now) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ entry, score }) => toResult(entry, { tokens, now, debug: debugWithWebsiteFilters(entry, { mode: 'frecency', score }) }))
    }

    return entries
      .map((entry) => {
        const rank = rankTupleFor(entry, tokens, selections, now, selectionIntent)
        return rank ? { entry, rank } : null
      })
      .filter(Boolean)
      .sort(compareRankedEntryMatches())
      .slice(0, limit)
      .map(({ entry, rank }) => toResult(entry, { tokens, now, debug: debugWithWebsiteFilters(entry, rank.debug) }))
  }

  const quoteMatches = entries
    .map((entry) => {
      const quoteEvidence = collectExactPhraseEvidence(entry, exactPhrases)
      return quoteEvidence.matched ? { entry, quoteEvidence } : null
    })
    .filter(Boolean)

  if (!tokens.length) {
    return quoteMatches
      .map(({ entry, quoteEvidence }) => ({
        entry,
        quoteEvidence,
        score: frecencyScore(entry, now),
      }))
      .sort((a, b) => {
        const quote = compareQuoteEvidence(a.quoteEvidence, b.quoteEvidence)
        if (quote !== 0) return quote
        const score = b.score - a.score
        if (score !== 0) return score
        return a.entry.displayUrl.localeCompare(b.entry.displayUrl)
      })
      .slice(0, limit)
      .map(({ entry, quoteEvidence, score }) =>
        toResult(entry, {
          tokens,
          now,
          debug: debugWithWebsiteFilters(entry, { mode: 'quoted', quoteEvidence, score, frecencyScore: score }),
        }),
      )
  }

  return quoteMatches
    .map(({ entry, quoteEvidence }) => {
      const rank = rankTupleFor(entry, tokens, selections, now, selectionIntent)
      if (!rank) return null
      return { entry, quoteEvidence, rank }
    })
    .filter(Boolean)
    .sort(compareRankedEntryMatches((a, b) => compareQuoteEvidence(a.quoteEvidence, b.quoteEvidence)))
    .slice(0, limit)
    .map(({ entry, quoteEvidence, rank }) =>
      toResult(entry, {
        tokens,
        now,
        debug: debugWithWebsiteFilters(entry, { ...rank.debug, mode: 'mixed', quoteEvidence }),
      }),
    )
}

function isOrderedAbbreviation(token, value) {
  if (token.length < 2 || token.length > 4) return false
  if (!/^[a-z]+$/.test(token) || !/^[a-z]+$/.test(value)) return false
  if (value.includes(token) || value[0] !== token[0]) return false

  let cursor = 0
  let firstPosition = null
  let lastPosition = null
  for (const char of token) {
    const position = value.indexOf(char, cursor)
    if (position === -1) return false
    if (firstPosition === null) firstPosition = position
    lastPosition = position
    cursor = position + 1
  }

  const matchedSpan = lastPosition - firstPosition + 1
  return matchedSpan - token.length <= 2
}

function matchTier(token, value) {
  if (!token || !value) return TIER.none

  const numeric = isNumericToken(token)
  if (value === token) return TIER.exact
  if (value.startsWith(token)) return TIER.prefix
  if (numeric) return TIER.none
  if (isOrderedAbbreviation(token, value)) return TIER.abbreviation
  if (token.length >= 3 && value.includes(token)) return TIER.substring
  return TIER.none
}

function matchStrength(segment, tier) {
  return tier * 10 + FIELD_PRIORITY[segment.field]
}

function compareMatch(a, b) {
  if (!a) return b ? -1 : 0
  if (!b) return 1
  if (a.strength !== b.strength) return a.strength - b.strength
  if (a.tier !== b.tier) return a.tier - b.tier
  return b.segment.order - a.segment.order
}

function bestSegmentMatch(segments, token, { afterOrder = null } = {}) {
  let best = null
  for (const segment of segments) {
    if (afterOrder !== null && segment.order <= afterOrder) continue
    const tier = matchTier(token, segment.token)
    if (!tier || (tier === TIER.abbreviation && segment.field === 'query')) continue
    const candidate = {
      token,
      field: segment.field,
      tier,
      strength: matchStrength(segment, tier),
      segment,
    }
    if (compareMatch(candidate, best) > 0) best = candidate
  }
  return best
}

function bestTokenMatch(entry, token) {
  return bestSegmentMatch(entry.segments, token)
}

function orderedMatchesForSegments(segments, tokens) {
  let previousOrder = -1
  let previousMatchedOrder = null
  const ordered = []
  let adjacentPairs = 0
  let tierSum = 0

  for (const token of tokens) {
    const best = bestSegmentMatch(segments, token, { afterOrder: previousOrder })

    if (!best) continue
    if (previousMatchedOrder != null && best.segment.order === previousMatchedOrder + 1) adjacentPairs++
    previousOrder = best.segment.order
    previousMatchedOrder = best.segment.order
    tierSum += best.tier
    ordered.push(best)
  }

  return { ordered, adjacentPairs, tierSum }
}

function bestOrderedUrlMatches(entry, tokens) {
  return orderedMatchesForSegments(
    entry.segments.filter((segment) => URL_FIELDS.has(segment.field)),
    tokens,
  )
}

function compareCoherence(a, b) {
  return compareTuple(
    [a.ordered.length, a.adjacentPairs, a.tierSum, FIELD_PRIORITY[a.field]],
    [b.ordered.length, b.adjacentPairs, b.tierSum, FIELD_PRIORITY[b.field]],
  )
}

function bestSameFieldMatches(entry, tokens) {
  let best = null

  for (const field of Object.keys(FIELD_PRIORITY)) {
    const coherence = {
      field,
      ...orderedMatchesForSegments(
        entry.segments.filter((segment) => segment.field === field),
        tokens,
      ),
    }
    if (!best || compareCoherence(coherence, best) < 0) best = coherence
  }

  return best
}

function usageScore(entry, now) {
  const ageDays = Math.max(0, (now - entry.lastVisitTime) / 86_400_000)
  const recency = 80 / (1 + ageDays / 3)
  const visits = Math.min(35, Math.log1p(entry.visitCount) * 9)
  return recency + visits
}

function frecencyScore(entry, now) {
  const ageDays = Math.max(0, (now - entry.lastVisitTime) / 86_400_000)
  const recent = 120 / (1 + ageDays / 2.5)
  const frequency = Math.min(45, Math.log1p(entry.visitCount) * 10)
  return recent + frequency
}

function rankTupleFor(entry, tokens, selections, now, selectionIntent = tokens) {
  const matches = tokens.map((token) => bestTokenMatch(entry, token))
  const coverage = matches.filter(Boolean).length
  if (coverage === 0) return null

  const orderedUrl = bestOrderedUrlMatches(entry, tokens)
  const sameField = bestSameFieldMatches(entry, tokens)
  const strengths = matches.filter(Boolean).map((match) => match.strength)
  const tiers = matches.filter(Boolean).map((match) => match.tier)
  const exactSegmentCount = matches.filter((match) => match?.tier === TIER.exact && URL_FIELDS.has(match.field)).length
  const urlChosenCount = matches.filter((match) => match && URL_FIELDS.has(match.field)).length
  const queryOnlyPenalty = matches.some((match) => match?.field === 'query') ? -1 : 0
  const selection = selectionBoost(selections, selectionIntent, entry.key, now)

  return {
    tuple: [
      coverage === tokens.length ? 1 : 0,
      coverage,
      Math.min(...tiers),
      tiers.reduce((sum, value) => sum + value, 0),
      sameField.ordered.length,
      sameField.adjacentPairs,
      sameField.tierSum,
      orderedUrl.ordered.length,
      orderedUrl.adjacentPairs,
      orderedUrl.tierSum,
      Math.min(...strengths),
      strengths.reduce((sum, value) => sum + value, 0),
      exactSegmentCount,
      urlChosenCount,
      queryOnlyPenalty,
      usageScore(entry, now),
      selection,
    ],
    debug: {
      tokens,
      coverage,
      sameFieldCoverage: sameField.ordered.length,
      sameFieldAdjacentPairs: sameField.adjacentPairs,
      sameField: sameField.field,
      orderedUrlCoverage: orderedUrl.ordered.length,
      adjacentPairs: orderedUrl.adjacentPairs,
      matches: matches.map((match) =>
        match
          ? {
              token: match.token,
              matched: match.segment.token,
              field: match.field,
              tier: Object.entries(TIER).find(([, value]) => value === match.tier)?.[0] ?? 'unknown',
              strength: match.strength,
            }
          : null,
      ),
      usageScore: usageScore(entry, now),
      selectionBoost: selection,
    },
  }
}

function compareRankedEntryMatches(...tieBreakers) {
  return (a, b) => {
    const tuple = compareTuple(a.rank.tuple, b.rank.tuple)
    if (tuple !== 0) return tuple

    for (const tieBreaker of tieBreakers) {
      const result = tieBreaker(a, b)
      if (result !== 0) return result
    }

    return a.entry.displayUrl.localeCompare(b.entry.displayUrl)
  }
}

function compareTuple(a, b) {
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function toResult(entry, { tokens = [], now = Date.now(), debug = {} } = {}) {
  const displayUrl = middleTruncate(entry.displayUrl, 112)
  const title = entry.title || entry.displayUrl
  const resultDebug = debug ?? {}
  return {
    key: entry.key,
    url: entry.url,
    displayUrl,
    title,
    visitCount: entry.visitCount,
    visitsLabel: formatVisits(entry.visitCount),
    lastVisitTime: entry.lastVisitTime,
    lastVisitedLabel: formatAge(entry.lastVisitTime, now),
    urlHtml: highlightText(displayUrl, tokens),
    titleHtml: highlightText(title, tokens),
    debug: resultDebug,
  }
}

export function buildHistoryIndex(rawEntries, { now = Date.now() } = {}) {
  const byUrl = new Map()

  for (const raw of rawEntries ?? []) {
    const normalized = normalizeHistoryUrl(raw.url)
    if (!normalized) continue

    const visitCount = Math.max(1, Number(raw.visitCount) || 1)
    const lastVisitTime = Number(raw.lastVisitTime) || now
    const existing = byUrl.get(normalized.key)

    if (!existing) {
      byUrl.set(normalized.key, {
        key: normalized.key,
        url: normalized.url,
        displayUrl: normalized.displayUrl,
        title: raw.title || normalized.displayUrl,
        visitCount,
        lastVisitTime,
      })
      continue
    }

    existing.visitCount += visitCount
    if (lastVisitTime >= existing.lastVisitTime) {
      existing.lastVisitTime = lastVisitTime
      existing.title = raw.title || existing.title
      existing.url = normalized.url
      existing.displayUrl = normalized.displayUrl
    }
  }

  const entries = Array.from(byUrl.values()).map((entry) => ({
    ...entry,
    segments: buildSegments(entry.url, entry.title),
    websiteName: websiteNameCandidatesForUrl(entry.url),
  }))

  entries.sort((a, b) => b.lastVisitTime - a.lastVisitTime)
  return { builtAt: now, entries }
}

export function searchHistory(
  index,
  query,
  { now = Date.now(), limit = DEFAULT_LIMIT, selections, emptyQuerySort = 'frecency' } = {},
) {
  return searchParsedHistory(index, parseQuery(query), { now, limit, selections, emptyQuerySort })
}

export const __testing = {
  matchTier,
  frecencyScore,
  toResult,
}
