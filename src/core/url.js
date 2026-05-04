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

/**
 * @typedef {object} WebsiteNameCandidates
 * @property {string} hostname Lowercase hostname with a common leading `www` label removed when present.
 * @property {string} rootName Deterministic local root-name candidate used for bracketed website filters.
 * @property {string[]} labels Lowercase hostname labels available for equivalent host-label matching.
 * @property {string[]} matchCandidates Deduplicated lowercase candidates a WebsiteFilter may prefix-match.
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
  const text = String(input ?? '').trim()
  if (!text || /\s/.test(text)) return null

  const hasExplicitScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(text)
  let parsed

  if (hasExplicitScheme) {
    if (!/^https?:\/\//i.test(text)) return null
    try {
      parsed = new URL(text)
    } catch {
      return null
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) return null
  } else {
    const schemelessHost = extractSchemelessHost(text)
    if (!schemelessHost || !isSchemelessHostLike(schemelessHost)) return null

    try {
      parsed = new URL(`https://${text}`)
    } catch {
      return null
    }
  }

  parsed.protocol = parsed.protocol.toLowerCase()
  parsed.hostname = parsed.hostname.toLowerCase()
  parsed.hash = ''

  const normalizedUrl = parsed.toString()
  return {
    displayInput: toDisplayUrl(parsed),
    normalizedUrl,
    key: normalizedUrl,
  }

  function extractSchemelessHost(urlText) {
    const authority = urlText.split(/[/?#]/, 1)[0]
    if (authority.startsWith('[')) {
      const bracketEnd = authority.indexOf(']')
      return bracketEnd === -1 ? '' : authority.slice(0, bracketEnd + 1)
    }
    return authority.split(':', 1)[0]
  }

  function isSchemelessHostLike(hostname) {
    const host = hostname.toLowerCase()
    return host === 'localhost' || isIpv4Address(host) || isBracketedIpv6Address(host) || isDomainName(host)
  }

  function isIpv4Address(hostname) {
    const parts = hostname.split('.')
    return parts.length === 4 && parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
  }

  function isBracketedIpv6Address(hostname) {
    return hostname.startsWith('[') && hostname.endsWith(']') && hostname.includes(':')
  }

  function isDomainName(hostname) {
    if (!hostname.includes('.')) return false

    const labels = hostname.split('.')
    const validLabel = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
    if (!labels.every((label) => label.length > 0 && label.length <= 63 && validLabel.test(label))) return false

    const tld = labels.at(-1)
    return /^[a-z]{2,}$/.test(tld) || /^xn--[a-z0-9-]{2,}$/.test(tld)
  }
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

export function websiteNameCandidatesForUrl(url) {
  let parsed
  try {
    parsed = new URL(String(url ?? ''))
  } catch {
    return websiteNameCandidatesForHostname('')
  }

  return websiteNameCandidatesForHostname(parsed.hostname)
}

export function websiteNameCandidatesForHostname(hostname) {
  const text = String(hostname ?? '').trim().toLowerCase().replace(/\.+$/g, '')
  const labels = text.split('.').filter(Boolean)
  if (labels[0] === 'www' && labels.length > 1) labels.shift()

  const normalizedHostname = labels.join('.')
  if (!normalizedHostname) {
    return {
      hostname: '',
      rootName: '',
      labels: [],
      matchCandidates: [],
    }
  }

  const rootName = isOpaqueHost(normalizedHostname) || labels.length === 1 ? normalizedHostname : labels.at(-2)
  const candidates = [rootName, normalizedHostname]

  if (!isOpaqueHost(normalizedHostname) && labels.length > 1) {
    for (let index = 0; index < labels.length - 1; index++) {
      candidates.push(labels.slice(index).join('.'))
    }
    candidates.push(...labels.slice(0, -1))
  }

  return {
    hostname: normalizedHostname,
    rootName,
    labels,
    matchCandidates: [...new Set(candidates.filter(Boolean))],
  }

  function isOpaqueHost(host) {
    return host.includes(':') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
  }
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
