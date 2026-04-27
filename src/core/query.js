const TOKEN_PATTERN = /[a-z0-9]+/gi

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
    key: queryKey(tokens),
  }
}

export function queryKey(tokens) {
  return (tokens ?? []).join(' ')
}

export function isNumericToken(token) {
  return /^\d+$/.test(token)
}
