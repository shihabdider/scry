import { tokenizeText } from './query.js'

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  'igshid',
  'ref',
  'spm',
])

/**
 * @typedef {object} TypedUrlCandidate
 * @property {string} displayInput User-editable URL-like text shown in the search box/action row.
 * @property {string} normalizedUrl Full navigable URL opened/copied by the synthetic action row.
 * @property {string} key Stable normalized URL key; typed rows do not use it for selection learning.
 */

function isTrackingParam(name) {
  const lower = name.toLowerCase()
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)
}

export function normalizeHistoryUrl(rawUrl) {
  const input = String(rawUrl ?? '').trim()
  if (!input) return null

  let parsed
  try {
    parsed = new URL(input)
  } catch {
    return null
  }

  parsed.protocol = parsed.protocol.toLowerCase()
  parsed.hostname = parsed.hostname.toLowerCase()
  if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
    parsed.port = ''
  }
  parsed.hash = ''

  const params = []
  for (const [name, value] of parsed.searchParams.entries()) {
    if (!isTrackingParam(name)) params.push([name, value])
  }
  params.sort(([aName, aValue], [bName, bValue]) => `${aName}=${aValue}`.localeCompare(`${bName}=${bValue}`))
  parsed.search = ''
  for (const [name, value] of params) {
    parsed.searchParams.append(name, value)
  }

  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '') || '/'
  }

  return {
    key: parsed.toString(),
    url: parsed.toString(),
    displayUrl: toDisplayUrl(parsed),
  }
}

export function createTypedUrlCandidate(input) {
  throw new Error('not implemented: createTypedUrlCandidate')
}

export function toDisplayUrl(urlLike) {
  let parsed
  try {
    parsed = urlLike instanceof URL ? urlLike : new URL(String(urlLike))
  } catch {
    return String(urlLike ?? '')
  }

  const path = parsed.pathname === '/' ? '' : parsed.pathname
  return `${parsed.host}${path}${parsed.search}`
}

export function buildSegments(url, title = '') {
  const parsed = new URL(url)
  const segments = []
  let order = 0

  for (const token of tokenizeText(parsed.hostname)) {
    segments.push({ token, field: 'host', order: order++ })
  }

  for (const part of parsed.pathname.split('/')) {
    for (const token of tokenizeText(part)) {
      segments.push({ token, field: 'path', order: order++ })
    }
  }

  for (const [name, value] of parsed.searchParams.entries()) {
    for (const token of tokenizeText(name)) {
      segments.push({ token, field: 'query', order: order++ })
    }
    for (const token of tokenizeText(value)) {
      segments.push({ token, field: 'query', order: order++ })
    }
  }

  for (const token of tokenizeText(title)) {
    segments.push({ token, field: 'title', order: order++ })
  }

  return segments
}

export function middleTruncate(value, maxLength = 96) {
  const text = String(value ?? '')
  if (text.length <= maxLength) return text
  if (maxLength <= 1) return '…'.slice(0, maxLength)

  const budget = maxLength - 1
  const startLength = Math.ceil(budget * 0.58)
  const endLength = budget - startLength
  return `${text.slice(0, startLength)}…${text.slice(text.length - endLength)}`
}
