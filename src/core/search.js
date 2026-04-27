import { formatAge, formatVisits, highlightText } from './format.js'
import { isNumericToken, parseQuery } from './query.js'
import { selectionBoost } from './selection-learning.js'
import { buildSegments, middleTruncate, normalizeHistoryUrl } from './url.js'

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
 * @typedef {object} HistoryIndex
 * @property {number} builtAt Millisecond timestamp when this in-memory index was built.
 * @property {object[]} entries Normalized URL entries with precomputed searchable segments.
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

export function searchParsedHistory(index, parsedQuery, { now = Date.now(), limit = DEFAULT_LIMIT, selections } = {}) {
  throw new Error('not implemented: searchParsedHistory')
}

function isOrderedAbbreviation(token, value) {
  if (token.length < 2 || token.length > 4) return false
  if (value.includes(token)) return false

  let cursor = 0
  for (const char of token) {
    const pos = value.indexOf(char, cursor)
    if (pos === -1) return false
    cursor = pos + 1
  }
  return true
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
  return FIELD_PRIORITY[segment.field] * 10 + tier
}

function compareMatch(a, b) {
  if (!a) return b ? -1 : 0
  if (!b) return 1
  if (a.strength !== b.strength) return a.strength - b.strength
  if (a.tier !== b.tier) return a.tier - b.tier
  return b.segment.order - a.segment.order
}

function bestTokenMatch(entry, token) {
  let best = null
  for (const segment of entry.segments) {
    const tier = matchTier(token, segment.token)
    if (!tier) continue
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

function bestOrderedUrlMatches(entry, tokens) {
  const urlSegments = entry.segments.filter((segment) => URL_FIELDS.has(segment.field))
  let previousOrder = -1
  let previousMatchedOrder = null
  const ordered = []
  let adjacentPairs = 0
  let tierSum = 0

  for (const token of tokens) {
    let best = null
    for (const segment of urlSegments) {
      if (segment.order <= previousOrder) continue
      const tier = matchTier(token, segment.token)
      if (!tier) continue
      const candidate = {
        token,
        field: segment.field,
        tier,
        strength: matchStrength(segment, tier),
        segment,
      }
      if (compareMatch(candidate, best) > 0) best = candidate
    }

    if (!best) continue
    if (previousMatchedOrder != null && best.segment.order === previousMatchedOrder + 1) adjacentPairs++
    previousOrder = best.segment.order
    previousMatchedOrder = best.segment.order
    tierSum += best.tier
    ordered.push(best)
  }

  return { ordered, adjacentPairs, tierSum }
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

function rankTupleFor(entry, tokens, selections, now) {
  const matches = tokens.map((token) => bestTokenMatch(entry, token))
  const coverage = matches.filter(Boolean).length
  if (coverage === 0) return null

  const orderedUrl = bestOrderedUrlMatches(entry, tokens)
  const strengths = matches.filter(Boolean).map((match) => match.strength)
  const tiers = matches.filter(Boolean).map((match) => match.tier)
  const exactSegmentCount = matches.filter((match) => match?.tier === TIER.exact && URL_FIELDS.has(match.field)).length
  const urlChosenCount = matches.filter((match) => match && URL_FIELDS.has(match.field)).length
  const queryOnlyPenalty = matches.some((match) => match?.field === 'query') ? -1 : 0
  const selection = selectionBoost(selections, tokens, entry.key, now)

  return {
    tuple: [
      coverage === tokens.length ? 1 : 0,
      coverage,
      orderedUrl.ordered.length,
      orderedUrl.adjacentPairs,
      Math.min(...strengths),
      strengths.reduce((sum, value) => sum + value, 0),
      orderedUrl.tierSum,
      exactSegmentCount,
      urlChosenCount,
      queryOnlyPenalty,
      usageScore(entry, now),
      selection,
    ],
    debug: {
      tokens,
      coverage,
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
    debug,
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
  }))

  entries.sort((a, b) => b.lastVisitTime - a.lastVisitTime)
  return { builtAt: now, entries }
}

export function searchHistory(index, query, { now = Date.now(), limit = DEFAULT_LIMIT, selections } = {}) {
  const parsed = parseQuery(query)
  const tokens = parsed.tokens

  if (!tokens.length) {
    return [...(index?.entries ?? [])]
      .map((entry) => ({ entry, score: frecencyScore(entry, now) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry, score }) => toResult(entry, { tokens, now, debug: { mode: 'frecency', score } }))
  }

  return [...(index?.entries ?? [])]
    .map((entry) => {
      const rank = rankTupleFor(entry, tokens, selections, now)
      return rank ? { entry, rank } : null
    })
    .filter(Boolean)
    .sort((a, b) => {
      const tuple = compareTuple(a.rank.tuple, b.rank.tuple)
      if (tuple !== 0) return tuple
      return a.entry.displayUrl.localeCompare(b.entry.displayUrl)
    })
    .slice(0, limit)
    .map(({ entry, rank }) => toResult(entry, { tokens, now, debug: rank.debug }))
}

export const __testing = {
  matchTier,
  frecencyScore,
}
