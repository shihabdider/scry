import { parseQuery, queryKey } from './query.js'

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
      return queryKey(query.unquotedTokens ?? query.tokens)
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
  const currentTokens = tokens ?? []
  if (!currentTokens.length || !urlKey) return 0

  let boost = 0
  for (const [storedKey, byUrl] of Object.entries(normalized.aggregates)) {
    const aggregate = byUrl?.[urlKey]
    if (!aggregate) continue

    const storedTokens = storedKey.split(' ').filter(Boolean)
    if (!tokenPatternsOverlap(currentTokens, storedTokens)) continue

    const countBoost = Math.min(12, Math.log1p(Number(aggregate.count) || 0) * 6)
    const ageDays = Math.max(0, (now - (Number(aggregate.lastSelectedAt) || 0)) / 86_400_000)
    const recencyBoost = Math.max(0, 4 - ageDays / 14)
    boost = Math.max(boost, countBoost + recencyBoost)
  }

  return boost
}
