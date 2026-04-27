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
 * @typedef {object} CopiedFeedback
 * @property {string} key Row/result/action key receiving copied feedback.
 * @property {number} expiresAt Millisecond timestamp when feedback should disappear.
 */

export function buildVisibleRows({ corpusResults = [], typedUrlCandidate = null, copiedFeedback = null } = {}) {
  throw new Error('not implemented: buildVisibleRows')
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
  throw new Error('not implemented: isCopiedFeedbackVisible')
}
