/**
 * @typedef {object} CorpusResultRow
 * @property {'result'} kind
 * @property {string} key Stable row key for focus/copy feedback.
 * @property {import('./search.js').SearchResult} result Real corpus search result.
 * @property {boolean} copied Whether transient copied feedback is active for this row.
 */

/**
 * @typedef {object} OpenTypedUrlRow
 * @property {'open-typed-url'} kind
 * @property {string} key Stable synthetic action key for focus/copy feedback.
 * @property {import('./url.js').TypedUrlCandidate} candidate Typed URL candidate to open/copy.
 * @property {boolean} copied Whether transient copied feedback is active for this row.
 */

/**
 * @typedef {CorpusResultRow | OpenTypedUrlRow} VisibleRow
 */

/**
 * @typedef {object} RowActionHint
 * @property {'copy'|'edit-url'} action Action represented by the hint.
 * @property {string} key Keyboard key shown to the user, for example "y" or "c".
 * @property {string} label Human-readable action label, for example "copy" or "edit URL".
 */

/**
 * @typedef {object} SelectedRowActionHintOptions
 * @property {boolean} [selected] Whether this visible row is the current selected row.
 */

/**
 * @typedef {object} CopiedFeedback
 * @property {string} key Row/result/action key receiving copied feedback.
 * @property {number} expiresAt Millisecond timestamp when feedback should disappear.
 */

export function buildVisibleRows({ corpusResults = [], typedUrlCandidate = null, copiedFeedback = null, now = Date.now() } = {}) {
  const rows = []

  if (typedUrlCandidate) {
    const typedUrlRow = {
      kind: 'open-typed-url',
      key: `open-typed-url:${typedUrlCandidate.key}`,
      candidate: typedUrlCandidate,
    }
    rows.push({
      ...typedUrlRow,
      copied: isCopiedFeedbackVisible(typedUrlRow, copiedFeedback, now),
    })
  }

  for (const result of corpusResults ?? []) {
    const resultRow = {
      kind: 'result',
      key: `result:${result.key}`,
      result,
    }
    rows.push({
      ...resultRow,
      copied: isCopiedFeedbackVisible(resultRow, copiedFeedback, now),
    })
  }

  return rows
}

export function selectedRowActionHints(row, { selected = false } = {}) {
  if (!selected) return []

  const hints = []
  if (rowOpenUrl(row)) hints.push({ action: 'copy', key: 'y', label: 'copy' })
  if (rowEditableText(row)) hints.push({ action: 'edit-url', key: 'c', label: 'edit URL' })

  return hints
}

export function rowOpenUrl(row) {
  if (row?.kind === 'result') {
    const url = row.result?.url
    return typeof url === 'string' && url ? url : null
  }

  if (row?.kind === 'open-typed-url') {
    const url = row.candidate?.normalizedUrl
    return typeof url === 'string' && url ? url : null
  }

  return null
}

export function rowSelectionLearningKey(row) {
  if (row?.kind !== 'result') return null

  const key = row.result?.key
  return typeof key === 'string' && key ? key : null
}

export function rowEditableText(row) {
  if (row?.kind !== 'result') return null

  const displayUrl = row.result?.displayUrl
  return typeof displayUrl === 'string' && displayUrl ? displayUrl : null
}

export function isCopiedFeedbackVisible(row, copiedFeedback, now = Date.now()) {
  const isVisibleRowKind = row?.kind === 'result' || row?.kind === 'open-typed-url'
  if (!isVisibleRowKind) return false

  const rowKey = row.key
  const feedbackKey = copiedFeedback?.key
  const expiresAt = copiedFeedback?.expiresAt

  if (typeof rowKey !== 'string' || !rowKey) return false
  if (typeof feedbackKey !== 'string' || !feedbackKey) return false
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return false
  if (typeof now !== 'number' || !Number.isFinite(now)) return false

  return rowKey === feedbackKey && now < expiresAt
}
