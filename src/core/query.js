const TOKEN_PATTERN = /[a-z0-9]+/gi

/**
 * @typedef {object} ExactPhrase
 * @property {string} rawText Original text between the complete quote delimiters.
 * @property {string} matchText Whitespace-normalized phrase text used for exact matching.
 * @property {boolean} caseSensitive Smart-case flag: true when rawText contains uppercase letters.
 */

/**
 * @typedef {object} ParsedQuery
 * @property {string} raw Original query text.
 * @property {string[]} tokens Backward-compatible unquoted token list used by existing ranking; space-separated URL fragments are the primary user syntax while punctuation such as `*` remains tolerated.
 * @property {string[]} unquotedTokens Tokens outside complete quoted phrases.
 * @property {ExactPhrase[]} exactPhrases Complete quoted phrases that must match exactly.
 * @property {string} key Selection-learning key derived from unquotedTokens.
 */

/**
 * @typedef {object} QueryPhraseParse
 * @property {string} unquotedText Query text after removing complete quoted phrases.
 * @property {ExactPhrase[]} exactPhrases Complete quoted exact phrases.
 * @property {boolean} hasIncompleteQuote True when live input contains an unfinished quote.
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
  const tokens = tokenizeText(unquotedText)
  return {
    raw,
    tokens,
    unquotedTokens: tokens,
    exactPhrases,
    key: queryKey(tokens),
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

export function isNumericToken(token) {
  return /^\d+$/.test(token)
}
