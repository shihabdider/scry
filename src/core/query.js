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
 * @property {string[]} tokens Backward-compatible unquoted token list used by existing ranking.
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
  const tokens = tokenizeText(raw)
  return {
    raw,
    tokens,
    unquotedTokens: tokens,
    exactPhrases: [],
    key: queryKey(tokens),
  }
}

export function parseExactPhrases(query) {
  throw new Error('not implemented: parseExactPhrases')
}

export function normalizeExactPhrase(rawText) {
  throw new Error('not implemented: normalizeExactPhrase')
}

export function queryKey(tokens) {
  return (tokens ?? []).join(' ')
}

export function isNumericToken(token) {
  return /^\d+$/.test(token)
}
