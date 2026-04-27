export function formatAge(timestamp, now = Date.now()) {
  if (!timestamp) return 'unknown'
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return 'now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 60) return `${days}d ago`

  const months = Math.floor(days / 30)
  if (months < 24) return `${months}mo ago`

  const years = Math.floor(days / 365)
  return `${Math.max(1, years)}y ago`
}

export function formatVisits(count) {
  const n = Number(count) || 0
  return `${n} ${n === 1 ? 'visit' : 'visits'}`
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function markContiguous(lowerText, token, marks) {
  if (!token) return false
  let found = false
  let start = lowerText.indexOf(token)
  while (start !== -1) {
    found = true
    for (let i = start; i < start + token.length; i++) marks[i] = true
    start = lowerText.indexOf(token, start + 1)
  }
  return found
}

function markOrderedAbbreviation(lowerText, token, marks) {
  if (token.length < 2 || token.length > 4) return false
  let cursor = 0
  const positions = []
  for (const char of token) {
    const pos = lowerText.indexOf(char, cursor)
    if (pos === -1) return false
    positions.push(pos)
    cursor = pos + 1
  }
  for (const pos of positions) marks[pos] = true
  return true
}

export function highlightText(value, tokens) {
  const text = String(value ?? '')
  const lowerText = text.toLowerCase()
  const marks = new Array(text.length).fill(false)

  for (const token of tokens ?? []) {
    const contiguous = markContiguous(lowerText, token, marks)
    if (!contiguous) markOrderedAbbreviation(lowerText, token, marks)
  }

  let output = ''
  let bold = false
  for (let i = 0; i < text.length; i++) {
    if (marks[i] && !bold) {
      output += '<b>'
      bold = true
    } else if (!marks[i] && bold) {
      output += '</b>'
      bold = false
    }
    output += escapeHtml(text[i])
  }
  if (bold) output += '</b>'
  return output
}
