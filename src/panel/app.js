import { parseQuery } from '../core/query.js'
import { buildVisibleRows, rowEditableText, rowOpenUrl, rowSelectionLearningKey, selectedRowActionHints } from '../core/rows.js'
import { escapeHtml } from '../core/format.js'
import { recordSelection } from '../core/selection-learning.js'
import { createTypedUrlCandidate } from '../core/url.js'
import { buildHistoryIndex, searchHistory } from '../core/search.js'
import { CLOSED_MODE, createPopupSessionSearchCache, HISTORY_MODE, nextSearchMode, searchSearchHeaderModel, searchSearchSurfaceModel } from '../core/search-modes.js'
import { fetchHistory } from '../platform/history-provider.js'
import { fetchRecentlyClosed, flattenClosedSessions } from '../platform/sessions-provider.js'
import { loadSelectionData, saveSelectionData } from '../platform/selection-store.js'
import { openUrl } from '../platform/tabs.js'
import { writeClipboardText } from '../platform/clipboard.js'

const SEARCH_LIMIT = 100
const RESULTS_PER_PAGE = 6
const INPUT_UPDATE_DEBOUNCE_MS = 80
const FOCUS_RETRY_DELAYS_MS = [0, 50, 150, 300, 600, 1000]
const COPY_FEEDBACK_DURATION_MS = 1_200

/**
 * @typedef {'search'|'results'|'blurred'} FocusMode
 *
 * Search mode means text-entry/input mode: selectedIndex may still name the
 * internal action target, but no row is visually selected. Results mode means
 * normal/result-navigation mode: selectedIndex is both the action target and
 * the visually highlighted row. Blurred mode means the panel has yielded focus.
 */

/**
 * @typedef {object} ResultRenderSelection
 * @property {FocusMode} focusMode Current focus lifecycle mode.
 * @property {number} selectedIndex Internal selected row/action target.
 * @property {number|null} visualSelectedIndex Visible highlighted row index, or null when input/blurred mode suppresses visual selection.
 */

/**
 * @typedef {object} EnterResultsModeSelection
 * @property {'results'} focusMode Normal/result-navigation mode after leaving text entry.
 * @property {number} selectedIndex First visible row index selected for normal-mode commands.
 */

/**
 * @typedef {'ignore'|'focusSearch'|'leavePanelFocus'|'copySelected'|'editSelectedUrl'|'moveNext'|'movePrevious'|'nextPage'|'previousPage'|'openSelected'} ResultNavigationCommand
 */

/**
 * @typedef {import('../core/search-modes.js').SearchMode} SearchMode
 * @typedef {import('../core/search-modes.js').PopupSessionSearchCache} PopupSessionSearchCache
 *
 * `ScryPanelApp` owns exactly two popup-session search corpora: the default
 * `history` cache loaded from deep Chrome history, and the `closed` cache
 * loaded from Chrome sessions. Switching mode changes only the active corpus;
 * it must preserve the current query and reuse a ready in-memory index.
 */

/**
 * @param {{ focusMode: FocusMode, selectedIndex: number }} selection
 * @returns {ResultRenderSelection}
 */
export function deriveResultRenderSelection(selection) {
  return {
    focusMode: selection.focusMode,
    selectedIndex: selection.selectedIndex,
    visualSelectedIndex: selection.focusMode === 'results' ? selection.selectedIndex : null,
  }
}

/**
 * @param {number} visibleRowIndex
 * @param {ResultRenderSelection} renderSelection
 * @returns {boolean}
 */
export function isVisibleRowSelectedForRender(visibleRowIndex, renderSelection) {
  return renderSelection.visualSelectedIndex !== null && visibleRowIndex === renderSelection.visualSelectedIndex
}

/**
 * @param {{ visibleRows: import('../core/rows.js').VisibleRow[] }} state
 * @returns {EnterResultsModeSelection|null}
 */
export function enterResultsModeSelection(state) {
  if (state.visibleRows.length === 0) return null

  return {
    focusMode: 'results',
    selectedIndex: 0,
  }
}

export function resultNavigationCommandForKey(event) {
  const key = typeof event?.key === 'string' ? event.key.toLowerCase() : ''

  if (event?.ctrlKey && key === 'n') return 'moveNext'
  if (event?.ctrlKey && key === 'p') return 'movePrevious'

  switch (key) {
    case 'i':
    case '/':
      return 'focusSearch'
    case 'escape':
      return 'leavePanelFocus'
    case 'y':
      return 'copySelected'
    case 'c':
      return 'editSelectedUrl'
    case 'j':
    case 'arrowdown':
      return 'moveNext'
    case 'k':
    case 'arrowup':
      return 'movePrevious'
    case 'l':
      return 'nextPage'
    case 'h':
      return 'previousPage'
    case 'enter':
      return 'openSelected'
    default:
      return 'ignore'
  }
}

export class ScryPanelApp {
  constructor({ document, chromeApi = chrome, clock = () => Date.now(), windowApi = globalThis.window, navigatorApi = globalThis.navigator } = {}) {
    this.document = document
    this.chromeApi = chromeApi
    this.clock = clock
    this.windowApi = windowApi
    this.navigatorApi = navigatorApi
    this.index = null
    this.loading = false
    this.searchCache = createPopupSessionSearchCache({ activeMode: HISTORY_MODE })
    this.searchMode = this.searchCache.activeMode
    this.results = []
    this.selectedIndex = 0
    this.pageIndex = 0
    this.focusMode = 'search'
    this.visibleRows = []
    this.copiedFeedback = null
    this.focusRequestId = 0
    this.inputResultsUpdateRequest = null
    this.selectionData = undefined

    this.input = document.querySelector('#search-input')
    this.status = document.querySelector('#status')
    this.message = document.querySelector('#message')
    this.resultsList = document.querySelector('#results')
    this.deepSearchButton = document.querySelector('#deep-search-button')
    this.pagination = document.querySelector('#pagination')
    this.previousPageButton = document.querySelector('#previous-page-button')
    this.pageStatus = document.querySelector('#page-status')
    this.nextPageButton = document.querySelector('#next-page-button')
  }

  async start() {
    this.bindEvents()
    this.searchCache = createPopupSessionSearchCache({ activeMode: HISTORY_MODE })
    this.searchMode = this.searchCache.activeMode
    this.index = null
    this.renderSearchSurface()
    this.focusSearch()
    this.selectionData = await loadSelectionData({ chromeApi: this.chromeApi })
    await this.loadHistory()
  }

  bindEvents() {
    this.input.addEventListener('input', () => {
      this.selectedIndex = 0
      this.pageIndex = 0
      this.scheduleInputResultsUpdate()
    })

    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        this.flushPendingInputResultsUpdate()
        void this.cycleSearchMode(event.shiftKey ? -1 : 1)
      } else if (event.key === 'ArrowDown' || (event.ctrlKey && event.key.toLowerCase() === 'n')) {
        event.preventDefault()
        this.flushPendingInputResultsUpdate()
        this.focusResults()
      } else if (event.key === 'ArrowUp' || (event.ctrlKey && event.key.toLowerCase() === 'p')) {
        event.preventDefault()
        this.flushPendingInputResultsUpdate()
        this.focusResults()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        this.flushPendingInputResultsUpdate()
        void this.openSelected({ newTab: true })
      } else if (event.key === 'Escape') {
        event.preventDefault()
        this.flushPendingInputResultsUpdate()
        this.focusResults()
      }
    })

    this.resultsList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-result-index]')
      if (!button) return
      this.selectedIndex = Number(button.dataset.resultIndex)
      void this.openSelected({ newTab: event.metaKey || event.ctrlKey })
    })

    const modeIndicator = this.document.querySelector('#mode-indicator')
    modeIndicator?.addEventListener('click', (event) => {
      event.preventDefault()
      void this.cycleSearchMode(1)
    })

    this.deepSearchButton.addEventListener('click', (event) => {
      this.ignoreCorpusSwitchInput(event)
    })

    this.previousPageButton?.addEventListener('click', () => {
      this.movePage(-1)
    })

    this.nextPageButton?.addEventListener('click', () => {
      this.movePage(1)
    })

    this.document.addEventListener('keydown', (event) => {
      this.handlePanelKeydown(event)
    })
  }

  async loadHistory(_options = {}) {
    return this.loadDefaultSearchMode()
  }

  async loadDefaultSearchMode() {
    return this.switchSearchMode(HISTORY_MODE)
  }

  async cycleSearchMode(direction = 1) {
    const nextMode = nextSearchMode(this.searchMode, direction)
    return this.switchSearchMode(nextMode)
  }

  async switchSearchMode(mode) {
    this.selectedIndex = 0
    this.pageIndex = 0

    const readyPromise = this.ensureSearchModeReady(mode)
    const activeState = this.activeSearchModeState()
    if (activeState?.status === 'loading') this.renderLoading()

    let readyState
    try {
      readyState = await readyPromise
    } catch (error) {
      readyState = this.activeSearchModeState()
      if (readyState) {
        readyState.status = 'error'
        readyState.index = null
        readyState.error = error
        readyState.loadedAt = null
        readyState.loadingPromise = null
      }
    }

    if (readyState?.status === 'ready') {
      this.updateResults()
    } else {
      this.index = null
      this.results = []
      this.visibleRows = []
      this.renderResults()
    }

    return readyState
  }

  async ensureSearchModeReady(mode = this.searchMode) {
    if (!this.searchCache?.modes?.history || !this.searchCache?.modes?.closed) {
      this.searchCache = createPopupSessionSearchCache({ activeMode: HISTORY_MODE })
    }

    const normalizedMode = mode === CLOSED_MODE ? CLOSED_MODE : HISTORY_MODE
    this.searchCache.activeMode = normalizedMode
    this.searchMode = normalizedMode

    const state = this.searchCache.modes[normalizedMode]
    if (state.status === 'ready') {
      this.index = state.index
      return state
    }
    if (state.status === 'loading' && state.loadingPromise) return state.loadingPromise

    return normalizedMode === CLOSED_MODE
      ? this.loadClosedMode(state)
      : this.loadHistoryMode(state)
  }

  async ensureHistoryCorpusReady() {
    return this.ensureSearchModeReady(HISTORY_MODE)
  }

  async loadSearchModeState(state, loadRawEntries) {
    state.status = 'loading'
    state.error = null
    state.index = null
    state.loadedAt = null
    this.loading = true

    const loadingPromise = (async () => {
      try {
        const { rawEntries, loadedAt } = await loadRawEntries()
        const index = buildHistoryIndex(rawEntries, { now: loadedAt })

        state.status = 'ready'
        state.index = index
        state.error = null
        state.loadedAt = loadedAt
        this.index = index
      } catch (error) {
        state.status = 'error'
        state.index = null
        state.error = error
        state.loadedAt = null
        this.index = null
      } finally {
        state.loadingPromise = null
        this.loading = false
      }

      return state
    })()

    state.loadingPromise = loadingPromise
    return loadingPromise
  }

  async loadHistoryMode(state) {
    return this.loadSearchModeState(state, async () => {
      const requestedAt = this.clock()
      const rawEntries = await fetchHistory({ chromeApi: this.chromeApi, now: requestedAt, deep: true })
      return { rawEntries, loadedAt: this.clock() }
    })
  }

  async loadClosedMode(state) {
    return this.loadSearchModeState(state, async () => {
      const recentlyClosed = await fetchRecentlyClosed({ chromeApi: this.chromeApi })
      const loadedAt = this.clock()
      const rawEntries = flattenClosedSessions(recentlyClosed, { now: loadedAt })
      return { rawEntries, loadedAt }
    })
  }

  ignoreCorpusSwitchInput(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
  }

  activeSearchModeState() {
    const cache = this.searchCache
    const activeMode = cache?.activeMode

    if (activeMode !== HISTORY_MODE && activeMode !== CLOSED_MODE) return null

    return cache?.modes?.[activeMode] ?? null
  }

  emptyQuerySortForMode(mode = this.searchMode) {
    return mode === CLOSED_MODE ? 'recency' : 'frecency'
  }

  resultMessagesForMode(mode = this.searchMode) {
    const messagesByMode = {
      history: {
        empty: 'No history results yet.',
        noMatches: 'No matches in history.',
        error: 'History unavailable.',
      },
      closed: {
        empty: 'No recently closed URLs yet.',
        noMatches: 'No matches in recently closed URLs.',
        error: 'Recently closed URLs unavailable.',
      },
    }

    return mode === CLOSED_MODE ? messagesByMode.closed : messagesByMode.history
  }

  renderSearchSurface() {
    if (this.deepSearchButton) this.deepSearchButton.hidden = true

    const cache = this.searchCache ?? createPopupSessionSearchCache({ activeMode: HISTORY_MODE })
    const headerModel = searchSearchHeaderModel(cache, { realResultCount: this.visibleResultCount() })
    const surfaceModel = searchSearchSurfaceModel(cache, { realResultCount: this.visibleResultCount() })

    const before = this.document.querySelector('#search-header-before')
    if (before) before.textContent = headerModel.beforeMode

    const after = this.document.querySelector('#search-header-after')
    if (after) after.textContent = headerModel.afterMode

    const hint = this.document.querySelector('#mode-switch-hint')
    if (hint) {
      hint.textContent = headerModel.modeSwitchHint
      hint.hidden = !headerModel.modeSwitchHint
      hint.setAttribute('aria-hidden', 'true')
    }

    const resultCount = this.document.querySelector('#result-count')
    if (resultCount) {
      resultCount.textContent = headerModel.statusText
      resultCount.setAttribute('aria-label', headerModel.statusText)
      resultCount.setAttribute('role', 'status')
      resultCount.setAttribute('aria-live', 'polite')
    }

    const headerLabel = [headerModel.beforeMode, headerModel.modeBadgeLabel, headerModel.afterMode].filter(Boolean).join(' ')
    const searchHeader = this.document.querySelector('#search-header')
    if (searchHeader) {
      searchHeader.hidden = false
      searchHeader.setAttribute('aria-label', `${headerLabel}; ${headerModel.statusText}`)
    }

    this.input?.setAttribute('aria-label', headerLabel)
    if (this.status) this.setStatus(headerModel.statusText)

    this.renderHistoryCorpusIndicator(surfaceModel)

    return surfaceModel
  }

  renderHistoryCorpusIndicator(model) {
    const indicator = this.document.querySelector('#mode-indicator')
    if (!indicator) return

    const ariaLabel = [model.label, model.statusText].filter(Boolean).join('; ')

    indicator.hidden = false
    indicator.textContent = model.label
    delete indicator.dataset.mode
    indicator.dataset.mode = model.mode
    indicator.dataset.corpus = model.mode
    indicator.dataset.status = model.status
    indicator.dataset.clickable = String(model.clickable)
    indicator.disabled = !model.clickable
    indicator.title = model.statusText
    indicator.setAttribute('aria-disabled', model.clickable ? 'false' : 'true')
    indicator.setAttribute('aria-label', ariaLabel)
  }

  updateVisibleRows() {
    const typedUrlCandidate = createTypedUrlCandidate(this.input.value)
    this.visibleRows = buildVisibleRows({
      corpusResults: this.results,
      typedUrlCandidate,
      copiedFeedback: this.copiedFeedback,
      now: this.clock(),
    })
  }

  selectedVisibleRow() {
    const visibleRows = Array.isArray(this.visibleRows) && this.visibleRows.length > 0
      ? this.visibleRows
      : buildVisibleRows({ corpusResults: this.results, copiedFeedback: this.copiedFeedback })

    if (!Number.isInteger(this.selectedIndex)) return null
    if (this.selectedIndex < 0 || this.selectedIndex >= visibleRows.length) return null

    return visibleRows[this.selectedIndex] ?? null
  }

  async copySelectedRow() {
    const row = this.selectedVisibleRow()
    const url = rowOpenUrl(row)
    const rowKey = row?.key
    if (!url || typeof rowKey !== 'string' || !rowKey) return

    await writeClipboardText(url, { navigatorApi: this.navigatorApi })

    const copiedFeedback = {
      key: rowKey,
      expiresAt: this.clock() + COPY_FEEDBACK_DURATION_MS,
    }
    this.copiedFeedback = copiedFeedback
    this.updateVisibleRows()
    this.renderResults()

    const timeoutApi = typeof this.windowApi?.setTimeout === 'function' ? this.windowApi : globalThis
    const setCopyFeedbackTimeout = timeoutApi?.setTimeout
    if (typeof setCopyFeedbackTimeout !== 'function') return

    const timer = setCopyFeedbackTimeout.call(timeoutApi, () => {
      if (this.copiedFeedback !== copiedFeedback) return

      this.copiedFeedback = null
      this.updateVisibleRows()
      this.renderResults()
    }, COPY_FEEDBACK_DURATION_MS)
    timer?.unref?.()
  }

  changeSelectedRowToSearch() {
    const editableText = rowEditableText(this.selectedVisibleRow())
    if (!editableText) return

    this.cancelPendingInputResultsUpdate()
    this.input.value = editableText
    this.focusSearch()
    this.updateResults()
  }

  scheduleInputResultsUpdate() {
    this.cancelPendingInputResultsUpdate()

    const timerApi = typeof this.windowApi?.setTimeout === 'function' ? this.windowApi : globalThis
    const request = { timer: null, timerApi }
    this.inputResultsUpdateRequest = request

    request.timer = timerApi.setTimeout.call(timerApi, () => {
      if (this.inputResultsUpdateRequest !== request) return

      this.inputResultsUpdateRequest = null
      this.updateResults()
    }, INPUT_UPDATE_DEBOUNCE_MS)
    request.timer?.unref?.()
  }

  cancelPendingInputResultsUpdate() {
    const request = this.inputResultsUpdateRequest
    if (!request) return false

    this.inputResultsUpdateRequest = null
    const clearTimerApi = typeof request.timerApi?.clearTimeout === 'function' ? request.timerApi : globalThis
    if (request.timer && typeof clearTimerApi?.clearTimeout === 'function') {
      clearTimerApi.clearTimeout.call(clearTimerApi, request.timer)
    }
    return true
  }

  flushPendingInputResultsUpdate() {
    if (!this.cancelPendingInputResultsUpdate()) return false

    this.updateResults()
    return true
  }

  updateResults() {
    this.cancelPendingInputResultsUpdate()
    const activeState = this.activeSearchModeState()
    const currentIndex = activeState?.status === 'ready'
      ? activeState.index
      : null

    this.index = currentIndex ?? null
    this.results = currentIndex
      ? searchHistory(currentIndex, this.input.value, {
        now: this.clock(),
        limit: SEARCH_LIMIT,
        selections: this.selectionData,
        emptyQuerySort: this.emptyQuerySortForMode(this.searchMode),
      })
      : []

    this.updateVisibleRows()
    const rowCount = this.visibleRows.length
    if (this.selectedIndex >= rowCount) this.selectedIndex = Math.max(0, rowCount - 1)
    if (this.selectedIndex < 0) this.selectedIndex = 0
    this.ensureSelectedVisible()
    this.renderResults()
  }

  visibleResultCount() {
    return Array.isArray(this.visibleRows) && this.visibleRows.length > 0
      ? this.visibleRows.filter((row) => row?.kind === 'result').length
      : this.results.length
  }

  pageCount() {
    return Math.max(1, Math.ceil(this.visibleResultCount() / RESULTS_PER_PAGE))
  }

  clampedPageIndex(pageCount = this.pageCount()) {
    const rawPageIndex = Number.isFinite(this.pageIndex) ? Math.trunc(this.pageIndex) : 0
    return Math.min(Math.max(0, rawPageIndex), pageCount - 1)
  }

  pageStart() {
    return this.clampedPageIndex() * RESULTS_PER_PAGE
  }

  clampPageIndex() {
    this.pageIndex = this.clampedPageIndex()
  }

  ensureSelectedVisible() {
    this.clampPageIndex()

    let selectedResultIndex = this.selectedIndex
    const visibleRows = Array.isArray(this.visibleRows) && this.visibleRows.length > 0
      ? this.visibleRows
      : null

    if (visibleRows?.some((row) => row?.kind === 'open-typed-url')) {
      const selectedRow = visibleRows[this.selectedIndex] ?? null
      if (selectedRow?.kind === 'open-typed-url') return
      if (selectedRow?.kind !== 'result') return

      selectedResultIndex = -1
      for (let index = 0; index <= this.selectedIndex; index++) {
        if (visibleRows[index]?.kind === 'result') selectedResultIndex++
      }
    }

    if (!Number.isInteger(selectedResultIndex) || selectedResultIndex < 0) return
    if (!this.results.length && !visibleRows?.some((row) => row?.kind === 'result')) return

    const start = this.pageStart()
    const end = start + RESULTS_PER_PAGE
    if (selectedResultIndex < start || selectedResultIndex >= end) {
      this.pageIndex = Math.floor(selectedResultIndex / RESULTS_PER_PAGE)
      this.clampPageIndex()
    }
  }

  moveSelection(delta) {
    const rowCount = Array.isArray(this.visibleRows) && this.visibleRows.length > 0
      ? this.visibleRows.length
      : this.results.length

    if (!rowCount) return
    this.selectedIndex = (this.selectedIndex + delta + rowCount) % rowCount
    this.ensureSelectedVisible()
    this.renderResults()
  }

  movePage(delta) {
    const visibleRows = Array.isArray(this.visibleRows) && this.visibleRows.length > 0
      ? this.visibleRows
      : null
    const hasVisibleResults = visibleRows?.some((row) => row?.kind === 'result') ?? false
    if (!hasVisibleResults && !this.results.length) return

    const nextPage = Math.min(Math.max(0, this.pageIndex + delta), this.pageCount() - 1)
    if (nextPage === this.pageIndex) return

    this.pageIndex = nextPage
    const firstResultIndex = this.pageStart()
    if (visibleRows) {
      let resultIndex = 0
      for (const [visibleIndex, row] of visibleRows.entries()) {
        if (row?.kind !== 'result') continue
        if (resultIndex === firstResultIndex) {
          this.selectedIndex = visibleIndex
          this.renderResults()
          return
        }
        resultIndex++
      }
    }

    this.selectedIndex = firstResultIndex
    this.renderResults()
  }

  handlePanelKeydown(event) {
    if (this.focusMode !== 'results') return
    if (event.target === this.input || this.document.activeElement === this.input) return

    const command = resultNavigationCommandForKey(event)
    if (command === 'ignore') return

    event.preventDefault()

    switch (command) {
      case 'focusSearch':
        this.focusSearch()
        break
      case 'leavePanelFocus':
        this.leavePanelFocus()
        break
      case 'copySelected':
        void this.copySelectedRow()
        break
      case 'editSelectedUrl':
        this.changeSelectedRowToSearch()
        break
      case 'moveNext':
        this.moveSelection(1)
        break
      case 'movePrevious':
        this.moveSelection(-1)
        break
      case 'nextPage':
        this.movePage(1)
        break
      case 'previousPage':
        this.movePage(-1)
        break
      case 'openSelected':
        void this.openSelected({ newTab: true })
        break
    }
  }

  focusSearch() {
    this.focusMode = 'search'
    this.selectedIndex = 0
    this.pageIndex = 0
    this.renderResults()
    const requestId = ++this.focusRequestId
    const inputIsFocused = () => this.document.activeElement === this.input
    const placeCursorAtEnd = () => {
      if (typeof this.input.setSelectionRange !== 'function') return

      const cursorPosition = this.input.value.length
      try {
        this.input.setSelectionRange(cursorPosition, cursorPosition)
      } catch {
        // Some input-like elements do not support text selection.
      }
    }
    const focusInputAtEnd = () => {
      this.input.focus({ preventScroll: true })
      placeCursorAtEnd()
    }

    focusInputAtEnd()
    for (const delay of FOCUS_RETRY_DELAYS_MS) {
      const timer = setTimeout(() => {
        if (this.focusMode !== 'search' || this.focusRequestId !== requestId) return
        if (inputIsFocused()) return
        focusInputAtEnd()
      }, delay)
      timer.unref?.()
    }
  }

  cancelSearchFocusRequests() {
    this.focusRequestId++
  }

  focusResults() {
    this.cancelSearchFocusRequests()

    if (this.focusMode === 'search') {
      const transition = enterResultsModeSelection({ visibleRows: this.visibleRows })
      if (transition) {
        this.focusMode = transition.focusMode
        this.selectedIndex = transition.selectedIndex
      } else {
        this.focusMode = 'results'
      }
    } else {
      this.focusMode = 'results'
    }

    this.focusSelectedResult()
  }

  focusSelectedResult() {
    const selectedRow = this.selectedVisibleRow()
    if (selectedRow && Number.isInteger(this.selectedIndex)) {
      const selectors = [
        `[data-visible-row-index="${this.selectedIndex}"]`,
        `[data-result-index="${this.selectedIndex}"]`,
      ]

      for (const selector of selectors) {
        const selected = this.resultsList.querySelector(selector)
        if (selected) {
          selected.focus()
          return
        }
      }
    }

    this.resultsList.focus?.()
  }

  leavePanelFocus() {
    this.cancelPendingInputResultsUpdate()
    this.cancelSearchFocusRequests()
    this.focusMode = 'blurred'
    this.document.activeElement?.blur?.()
    if (this.windowApi?.close) {
      this.windowApi.close()
      return
    }
    this.windowApi?.blur?.()
  }

  async openSelected({ newTab }) {
    const row = this.selectedVisibleRow()
    const url = rowOpenUrl(row)
    if (!url) return

    await openUrl(url, { chromeApi: this.chromeApi, newTab })

    const urlKey = rowSelectionLearningKey(row)
    if (urlKey) {
      this.selectionData = recordSelection(this.selectionData, {
        query: parseQuery(this.input.value),
        urlKey,
        selectedAt: this.clock(),
      })
      await saveSelectionData(this.selectionData, { chromeApi: this.chromeApi })
      this.updateResults()
    }

    this.leavePanelFocus()
  }

  renderLoading() {
    this.results = []
    this.visibleRows = []
    if (this.resultsList) this.resultsList.innerHTML = ''
    if (this.deepSearchButton) this.deepSearchButton.hidden = true
    if (this.pagination) this.pagination.hidden = true
    if (this.pageStatus) this.pageStatus.textContent = 'Loading…'
    if (this.previousPageButton) this.previousPageButton.disabled = true
    if (this.nextPageButton) this.nextPageButton.disabled = true

    const model = this.renderSearchSurface()
    if (this.message) this.showMessage(model.statusText)
    return model
  }

  renderResults() {
    const query = this.input.value.trim()
    const corpusState = this.activeSearchModeState()
    const messages = this.resultMessagesForMode(this.searchMode)

    const copiedMarker = (row) => row?.copied
      ? '<span class="result-copied-feedback">copied</span>'
      : ''

    const actionHintsHtml = (row, selected) => {
      const hints = selectedRowActionHints(row, { selected })
      if (hints.length === 0) return ''

      return hints.map((hint) => {
        const action = escapeHtml(hint.action)
        const key = escapeHtml(hint.key)
        const label = escapeHtml(hint.label)
        return `<span class="result-action-hint" data-action="${action}">${key} ${label}</span>`
      }).join(' · ')
    }

    const metaHtml = (meta, row, selected) => {
      const escapedMeta = escapeHtml(meta)
      const hints = actionHintsHtml(row, selected)
      return [escapedMeta, hints].filter(Boolean).join(' · ')
    }

    const realResultHtml = (row, selected = false) => {
      const result = row?.result ?? {}
      const meta = [result.visitsLabel, result.lastVisitedLabel]
        .filter((part) => typeof part === 'string' && part)
        .join(' · ')

      return `
        ${copiedMarker(row)}
        <span class="result-url">${result.urlHtml ?? escapeHtml(result.displayUrl ?? result.url)}</span>
        <span class="result-title">${result.titleHtml ?? escapeHtml(result.title)}</span>
        <span class="result-meta">${metaHtml(meta, row, selected)}</span>
      `
    }

    const typedUrlHtml = (row, selected = false) => {
      const candidate = row?.candidate ?? {}
      const displayInput = candidate.displayInput ?? candidate.normalizedUrl ?? ''
      const normalizedUrl = candidate.normalizedUrl ?? displayInput

      return `
        ${copiedMarker(row)}
        <span class="result-url open-typed-url-url">${escapeHtml(displayInput)}</span>
        <span class="result-title open-typed-url-title">Open typed URL</span>
        <span class="result-meta open-typed-url-meta">${metaHtml(normalizedUrl, row, selected)}</span>
      `
    }

    let visibleRows = Array.isArray(this.visibleRows) ? this.visibleRows : []
    if (corpusState?.status === 'error') {
      const typedUrlCandidate = createTypedUrlCandidate(this.input.value)
      visibleRows = buildVisibleRows({
        corpusResults: [],
        typedUrlCandidate,
        copiedFeedback: this.copiedFeedback,
        now: this.clock(),
      })
      this.visibleRows = visibleRows
    } else if (visibleRows.length === 0) {
      visibleRows = buildVisibleRows({
        corpusResults: this.results,
        typedUrlCandidate: createTypedUrlCandidate(this.input.value),
        copiedFeedback: this.copiedFeedback,
        now: this.clock(),
      })
      this.visibleRows = visibleRows
    }

    const hasRealRows = visibleRows.some((row) => row?.kind === 'result')

    this.message.hidden = true
    this.resultsList.innerHTML = ''

    if (corpusState?.status === 'error') {
      this.showMessage(messages.error)
    } else if (!hasRealRows) {
      this.showMessage(query ? messages.noMatches : messages.empty)
    }

    this.ensureSelectedVisible()
    const renderSelection = deriveResultRenderSelection({
      focusMode: this.focusMode,
      selectedIndex: this.selectedIndex,
    })
    const fragment = this.document.createDocumentFragment()
    const start = this.pageStart()
    const end = start + RESULTS_PER_PAGE
    let realRowIndex = 0

    for (const [visibleRowIndex, row] of visibleRows.entries()) {
      if (row?.kind === 'result') {
        const currentRealRowIndex = realRowIndex
        realRowIndex++
        if (currentRealRowIndex < start || currentRealRowIndex >= end) continue
      } else if (row?.kind !== 'open-typed-url') {
        continue
      }

      const selected = isVisibleRowSelectedForRender(visibleRowIndex, renderSelection)
      const classes = ['result']
      if (row.kind === 'open-typed-url') classes.push('result-action', 'open-typed-url')
      if (selected) classes.push('selected')
      if (row.copied) classes.push('copied')

      const item = this.document.createElement('li')
      item.className = classes.join(' ')

      const button = this.document.createElement('button')
      button.type = 'button'
      button.className = row.kind === 'open-typed-url'
        ? 'result-button open-typed-url-button'
        : 'result-button'
      button.dataset.resultIndex = String(visibleRowIndex)
      button.dataset.visibleRowIndex = String(visibleRowIndex)
      button.dataset.rowKind = row.kind
      button.dataset.rowKey = row.key ?? ''
      button.setAttribute('aria-current', selected ? 'true' : 'false')
      button.setAttribute('aria-label', row.kind === 'open-typed-url'
        ? `Open typed URL ${row.candidate?.normalizedUrl ?? ''}`.trim()
        : `${row.result?.displayUrl ?? row.result?.url ?? row.result?.title ?? 'History result'}`)
      button.innerHTML = row.kind === 'open-typed-url' ? typedUrlHtml(row, selected) : realResultHtml(row, selected)

      item.append(button)
      fragment.append(item)
    }

    this.resultsList.append(fragment)
    if (this.focusMode === 'results') this.focusSelectedResult()

    this.renderPagination()
    this.renderSearchSurface()
    if (this.deepSearchButton) this.deepSearchButton.hidden = true
  }

  renderPagination() {
    if (!this.pagination || !this.pageStatus) return

    const resultCount = this.visibleResultCount()
    const pageCount = this.pageCount()
    const pageIndex = this.clampedPageIndex(pageCount)

    this.pagination.hidden = resultCount === 0 || pageCount <= 1
    this.pageStatus.textContent = resultCount ? `Page ${pageIndex + 1} of ${pageCount}` : 'No results'
    if (this.previousPageButton) this.previousPageButton.disabled = pageIndex === 0
    if (this.nextPageButton) this.nextPageButton.disabled = pageIndex >= pageCount - 1
  }

  showMessage(text) {
    this.message.textContent = text
    this.message.hidden = false
  }

  setStatus(text) {
    this.status.textContent = text
  }
}
