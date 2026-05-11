const TOKEN_PATTERN = /[a-z0-9]+/gi

/**
 * @typedef {object} ExactPhrase
 * @property {string} rawText Original text between the complete quote delimiters.
 * @property {string} matchText Whitespace-normalized phrase text used for exact matching.
 * @property {boolean} caseSensitive Smart-case flag: true when rawText contains uppercase letters.
 */

/**
 * @typedef {object} WebsiteFilter
 * @property {string} rawText Original text before the colon delimiter, or inside legacy bracket delimiters.
 * @property {string} matchText Lowercase token text used to match local hostname/root-name candidates.
 */

/**
 * @typedef {object} ParsedQuery
 * @property {string} raw Original query text.
 * @property {string[]} tokens Backward-compatible unquoted token list used by existing ranking; space-separated URL fragments are the primary user syntax while punctuation such as `*` remains tolerated.
 * @property {string[]} unquotedTokens Tokens outside complete quoted phrases and website filters.
 * @property {ExactPhrase[]} exactPhrases Complete quoted phrases that must match exactly.
 * @property {WebsiteFilter[]} websiteFilters Colon-marked website-name filters that hard-filter URL hostname/root candidates before ranking.
 * @property {string} key Selection-learning key derived from unquotedTokens and websiteFilters so filtered and unfiltered intents remain distinct.
 */

/**
 * @typedef {object} QueryPhraseParse
 * @property {string} unquotedText Query text after removing complete quoted phrases.
 * @property {ExactPhrase[]} exactPhrases Complete quoted exact phrases.
 * @property {boolean} hasIncompleteQuote True when live input contains an unfinished quote.
 */

/**
 * @typedef {object} QueryWebsiteFilterParse
 * @property {string} unfilteredText Query text after removing colon-marked website filters; legacy incomplete brackets remain in this text for forgiving live search.
 * @property {WebsiteFilter[]} websiteFilters Parsed website-name filters.
 */

export function tokenizeText(value) {
  if (!value) return []
  return String(value)
    .toLowerCase()
    .match(TOKEN_PATTERN) ?? []
}

export function parseQuery(query) {
  const raw = String(query ?? '')
  const { unquotedText, exactPhrases } = parseExactPhrases(raw)
  const { unfilteredText, websiteFilters } = parseWebsiteFilters(unquotedText)
  const tokens = tokenizeText(unfilteredText)
  return {
    raw,
    tokens,
    unquotedTokens: tokens,
    exactPhrases,
    websiteFilters,
    key: queryKeyWithWebsiteFilters(tokens, websiteFilters),
  }
}

export function parseExactPhrases(query) {
  const text = String(query ?? '')
  const exactPhrases = []
  let unquotedText = ''
  let index = 0

  while (index < text.length) {
    const quoteIndex = text.indexOf('"', index)
    if (quoteIndex === -1) {
      unquotedText += text.slice(index)
      break
    }

    unquotedText += text.slice(index, quoteIndex)

    const closingQuoteIndex = text.indexOf('"', quoteIndex + 1)
    if (closingQuoteIndex === -1) {
      unquotedText += text.slice(quoteIndex)
      break
    }

    exactPhrases.push(normalizeExactPhrase(text.slice(quoteIndex + 1, closingQuoteIndex)))

    const previousChar = unquotedText.at(-1)
    const nextChar = text.at(closingQuoteIndex + 1)
    if (previousChar && nextChar && !/\s/.test(previousChar) && !/\s/.test(nextChar)) {
      unquotedText += ' '
    }

    index = closingQuoteIndex + 1
  }

  return {
    unquotedText,
    exactPhrases,
    hasIncompleteQuote: false,
  }
}

export function normalizeExactPhrase(rawText) {
  const text = String(rawText ?? '')
  return {
    rawText: text,
    matchText: text.replace(/\s+/g, ' ').trim(),
    caseSensitive: text !== text.toLowerCase(),
  }
}

export function queryKey(tokens) {
  return (tokens ?? []).join(' ')
}

export function parseWebsiteFilters(query) {
  const text = String(query ?? '')
  const colonParse = parseColonWebsiteFilters(text)
  const legacyBracketParse = parseLegacyBracketWebsiteFilters(colonParse.unfilteredText)

  return {
    unfilteredText: legacyBracketParse.unfilteredText,
    websiteFilters: [...colonParse.websiteFilters, ...legacyBracketParse.websiteFilters],
  }
}

function parseColonWebsiteFilters(text) {
  const websiteFilters = []
  let unfilteredText = text

  while (true) {
    const parsed = splitLeadingColonWebsiteFilter(unfilteredText)
    if (!parsed) break

    if (parsed.filter.matchText) websiteFilters.push(parsed.filter)
    unfilteredText = parsed.unfilteredText
  }

  return {
    unfilteredText,
    websiteFilters,
  }
}

function splitLeadingColonWebsiteFilter(text) {
  const match = text.match(/^(\s*)([^\s:|\/\[\]"]+):/)
  if (!match) return null

  const afterColonText = text.slice(match[0].length)
  if (afterColonText.startsWith('/')) return null

  const rawText = match[2]
  return {
    filter: normalizeWebsiteFilter(rawText),
    unfilteredText: `${match[1]}${afterColonText.replace(/^\s+/, '')}`,
  }
}

function parseLegacyBracketWebsiteFilters(text) {
  const websiteFilters = []
  let unfilteredText = ''
  let index = 0

  while (index < text.length) {
    const openingBracketIndex = text.indexOf('[', index)
    if (openingBracketIndex === -1) {
      unfilteredText += text.slice(index)
      break
    }

    unfilteredText += text.slice(index, openingBracketIndex)

    const closingBracketIndex = text.indexOf(']', openingBracketIndex + 1)
    if (closingBracketIndex === -1) {
      unfilteredText += text.slice(openingBracketIndex)
      break
    }

    const filter = normalizeWebsiteFilter(text.slice(openingBracketIndex + 1, closingBracketIndex))
    if (filter.matchText) {
      websiteFilters.push(filter)
    }

    unfilteredText = addFilterBoundarySpaceIfNeeded(unfilteredText, text.at(closingBracketIndex + 1))
    index = closingBracketIndex + 1
  }

  return {
    unfilteredText,
    websiteFilters,
  }
}

function addFilterBoundarySpaceIfNeeded(unfilteredText, nextChar) {
  const previousChar = unfilteredText.at(-1)
  if (previousChar && nextChar && !/\s/.test(previousChar) && !/\s/.test(nextChar)) {
    return `${unfilteredText} `
  }
  return unfilteredText
}

export function normalizeWebsiteFilterMatchText(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function normalizeWebsiteFilter(rawText) {
  const text = String(rawText ?? '')
  return {
    rawText: text,
    matchText: normalizeWebsiteFilterMatchText(text),
  }
}

export function queryKeyWithWebsiteFilters(tokens, websiteFilters) {
  const tokenPart = queryKey(tokens)
  const filterParts = (websiteFilters ?? [])
    .map((filter) => normalizeWebsiteFilterMatchText(filter?.matchText))
    .filter(Boolean)
    .sort()
    .map((matchText) => `${matchText}:`)

  return [...filterParts, tokenPart].filter(Boolean).join(' ')
}

export function isNumericToken(token) {
  return /^\d+$/.test(token)
}
