import { DEFAULT_SCRY_SETTINGS, shortcutLabel } from './settings.js'

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
 * @property {'copy'|'edit-url'|'remove-favorite'|'undo-remove-favorite'} action Action represented by the hint.
 * @property {string} key Keyboard key shown to the user, for example "Ctrl+Y" or "Ctrl+E".
 * @property {string} label Human-readable action label, for example "copy" or "edit URL".
 */

/**
 * @typedef {object} SelectedRowActionHintOptions
 * @property {boolean} [selected] Whether this visible row is the current selected row.
 */

/**
 * A FavoriteRowActionState is an object:
 * - selected: boolean
 * - inFavoritesMode: boolean
 * - canUndoFavoriteRemoval: boolean
 *
 * Interpretation:
 * Represents the favorites-specific row-action context for a selected favorite row. Remove is offered
 * only for a selected stored favorite result in favorites mode; undo is offered when the current
 * popup session has one FavoriteRemovalUndo available.
 *
 * Examples:
 * - { selected: false, inFavoritesMode: true, canUndoFavoriteRemoval: true } represents an unselected row with no row-local hints.
 * - { selected: true, inFavoritesMode: true, canUndoFavoriteRemoval: false } represents a selected favorite that can be removed with Ctrl+X.
 * - { selected: true, inFavoritesMode: true, canUndoFavoriteRemoval: true } represents a selected favorite that can be removed and a prior removal that can be restored with Ctrl+U.
 *
 * @typedef {object} FavoriteRowActionState
 * @property {boolean} selected Whether this row is the current selected row.
 * @property {boolean} inFavoritesMode Whether the active mode is hidden favorites.
 * @property {boolean} canUndoFavoriteRemoval Whether one popup-session removal can be undone.
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

export function selectedRowActionHints(row, options = {}) {
  return selectedRowActionHintsForSettings(row, options, DEFAULT_SCRY_SETTINGS)
}

export function selectedRowActionHintsForSettings(row, { selected = false } = {}, settings = DEFAULT_SCRY_SETTINGS) {
  if (!selected) return []

  const hints = []
  const copyKey = shortcutLabel(settings, 'copySelected')
  const editKey = shortcutLabel(settings, 'editSelectedUrl')
  if (rowOpenUrl(row) && copyKey) hints.push({ action: 'copy', key: copyKey, label: 'copy' })
  if (rowEditableText(row) && editKey) hints.push({ action: 'edit-url', key: editKey, label: 'edit URL' })

  return hints
}

/**
 * VisibleRow FavoriteRowActionState -> RowActionHint[]
 *
 * Produces the selected-row action hints for favorites rows, adding configured remove and
 * one-level undo shortcuts without changing ordinary public-mode row hints.
 *
 * Functional Examples:
 * - selectedFavoriteRowActionHints(resultRow, { selected: false, inFavoritesMode: true, canUndoFavoriteRemoval: true }) should produce [].
 * - selectedFavoriteRowActionHints(resultRow, { selected: true, inFavoritesMode: false, canUndoFavoriteRemoval: true }) should produce selectedRowActionHints(resultRow, { selected: true }).
 * - selectedFavoriteRowActionHints(resultRow, { selected: true, inFavoritesMode: true, canUndoFavoriteRemoval: false }) should include { action: "remove-favorite", key: "Ctrl+X", label: "remove" } after the ordinary copy/edit hints.
 * - selectedFavoriteRowActionHints(resultRow, { selected: true, inFavoritesMode: true, canUndoFavoriteRemoval: true }) should include both { action: "remove-favorite", key: "Ctrl+X", label: "remove" } and { action: "undo-remove-favorite", key: "Ctrl+U", label: "undo" }.
 *
 * Template:
 * Combine VisibleRow and FavoriteRowActionState:
 * - start with selectedRowActionHints(row, { selected })
 * - if not selected or not inFavoritesMode, return ordinary hints
 * - if row is a real result, add remove-favorite
 * - if canUndoFavoriteRemoval, add undo-remove-favorite
 */
export function selectedFavoriteRowActionHintsForSettings(
  row,
  { selected = false, inFavoritesMode = false, canUndoFavoriteRemoval = false } = {},
  settings = DEFAULT_SCRY_SETTINGS,
) {
  const hints = selectedRowActionHintsForSettings(row, { selected }, settings)
  if (!selected || !inFavoritesMode) return hints

  const favoritesHints = [...hints]
  const removeKey = shortcutLabel(settings, 'removeSelectedFavorite')
  const undoKey = shortcutLabel(settings, 'undoFavoriteRemoval')
  if (row?.kind === 'result' && removeKey) {
    favoritesHints.push({ action: 'remove-favorite', key: removeKey, label: 'remove' })
  }
  if (canUndoFavoriteRemoval && undoKey) {
    favoritesHints.push({ action: 'undo-remove-favorite', key: undoKey, label: 'undo' })
  }

  return favoritesHints
}

export function selectedFavoriteRowActionHints(row, options = {}) {
  return selectedFavoriteRowActionHintsForSettings(row, options, DEFAULT_SCRY_SETTINGS)
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
