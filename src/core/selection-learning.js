import { normalizeWebsiteFilterMatchText, parseQuery, parseWebsiteFilters, queryKey, queryKeyWithWebsiteFilters } from './query.js'

/**
 * @typedef {object} SelectionIntentKeyParts
 * @property {string[]} tokens Ordinary unquoted query tokens participating in learned intent overlap.
 * @property {import('./query.js').WebsiteFilter[]} websiteFilters Website filters that must remain distinct from unfiltered intents.
 */

export function emptySelectionData() {
  return { version: 1, aggregates: {} }
}

export function normalizeSelectionData(data) {
  if (!data || typeof data !== 'object') return emptySelectionData()
  return {
    version: 1,
    aggregates: data.aggregates && typeof data.aggregates === 'object' ? data.aggregates : {},
  }
}

export function recordSelection(data, { query, tokens, urlKey, selectedAt = Date.now() }) {
  const normalized = normalizeSelectionData(data)
  if (!urlKey) return normalized

  const key = (() => {
    if (query && typeof query === 'object' && !Array.isArray(query)) {
      if (typeof query.key === 'string') return query.key
      const parts = selectionIntentKeyParts(query)
      return queryKeyWithWebsiteFilters(parts.tokens, parts.websiteFilters)
    }
    if (query !== undefined) return parseQuery(query).key
    return queryKey(tokens)
  })()
  if (!key) return normalized

  const byQuery = { ...(normalized.aggregates[key] ?? {}) }
  const current = byQuery[urlKey] ?? { count: 0, lastSelectedAt: 0, selectedAt: [] }
  const selectedAtList = Array.isArray(current.selectedAt) ? current.selectedAt.slice(-19) : []
  selectedAtList.push(selectedAt)

  byQuery[urlKey] = {
    count: (Number(current.count) || 0) + 1,
    lastSelectedAt: Math.max(Number(current.lastSelectedAt) || 0, selectedAt),
    selectedAt: selectedAtList,
  }

  return {
    version: 1,
    aggregates: {
      ...normalized.aggregates,
      [key]: byQuery,
    },
  }
}

export function selectionIntentKeyParts(parsedQuery) {
  if (Array.isArray(parsedQuery)) {
    return { tokens: parsedQuery.slice(), websiteFilters: [] }
  }

  if (!parsedQuery || typeof parsedQuery !== 'object') {
    return { tokens: [], websiteFilters: [] }
  }

  const tokens = Array.isArray(parsedQuery.unquotedTokens)
    ? parsedQuery.unquotedTokens
    : Array.isArray(parsedQuery.tokens)
      ? parsedQuery.tokens
      : []
  const websiteFilters = Array.isArray(parsedQuery.websiteFilters) ? parsedQuery.websiteFilters : []

  return {
    tokens: tokens.slice(),
    websiteFilters: websiteFilters.slice(),
  }
}

export function selectionIntentKeysOverlap(currentParts, storedKey) {
  if (typeof storedKey !== 'string') return false

  const normalizedFilterSet = (websiteFilters) => [
    ...new Set(
      (Array.isArray(websiteFilters) ? websiteFilters : [])
        .map((filter) => normalizeWebsiteFilterMatchText(filter?.matchText))
        .filter(Boolean),
    ),
  ].sort()

  const storedFilterParse = parseWebsiteFilters(storedKey)
  const storedParts = {
    tokens: storedFilterParse.unfilteredText.split(/\s+/).filter(Boolean),
    websiteFilters: storedFilterParse.websiteFilters,
  }

  const currentTokens = Array.isArray(currentParts?.tokens) ? currentParts.tokens : []
  const currentFilters = normalizedFilterSet(currentParts?.websiteFilters)
  const storedFilters = normalizedFilterSet(storedParts.websiteFilters)

  if (currentFilters.length || storedFilters.length) {
    if (currentFilters.length !== storedFilters.length) return false
    for (let i = 0; i < currentFilters.length; i++) {
      if (currentFilters[i] !== storedFilters[i]) return false
    }
  }

  return tokenPatternsOverlap(currentTokens, storedParts.tokens)
}

function tokenPatternsOverlap(aTokens, bTokens) {
  if (aTokens.length !== bTokens.length) return false
  for (let i = 0; i < aTokens.length; i++) {
    const a = aTokens[i]
    const b = bTokens[i]
    if (!(a.startsWith(b) || b.startsWith(a))) return false
  }
  return true
}

export function selectionBoost(data, tokens, urlKey, now = Date.now()) {
  const normalized = normalizeSelectionData(data)
  const currentParts = selectionIntentKeyParts(tokens)
  if ((!currentParts.tokens.length && !currentParts.websiteFilters.length) || !urlKey) return 0

  let boost = 0
  for (const [storedKey, byUrl] of Object.entries(normalized.aggregates)) {
    const aggregate = byUrl?.[urlKey]
    if (!aggregate) continue
    if (!selectionIntentKeysOverlap(currentParts, storedKey)) continue

    const countBoost = Math.min(12, Math.log1p(Number(aggregate.count) || 0) * 6)
    const ageDays = Math.max(0, (now - (Number(aggregate.lastSelectedAt) || 0)) / 86_400_000)
    const recencyBoost = Math.max(0, 4 - ageDays / 14)
    boost = Math.max(boost, countBoost + recencyBoost)
  }

  return boost
}
