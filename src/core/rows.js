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
  throw new Error('not implemented: rowOpenUrl')
}

export function rowSelectionLearningKey(row) {
  throw new Error('not implemented: rowSelectionLearningKey')
}

export function rowEditableText(row) {
  throw new Error('not implemented: rowEditableText')
}

export function isCopiedFeedbackVisible(row, copiedFeedback, now = Date.now()) {
  throw new Error('not implemented: isCopiedFeedbackVisible')
}
