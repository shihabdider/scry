import { parseFavoritesCommand } from '../core/favorites-command.js'
import { buildFavoritesIndex } from '../core/favorites.js'
import { parseQuery } from '../core/query.js'
import { buildVisibleRows, rowEditableText, rowOpenUrl, rowSelectionLearningKey, selectedFavoriteRowActionHints } from '../core/rows.js'
import { escapeHtml } from '../core/format.js'
import { recordSelection } from '../core/selection-learning.js'
import { createTypedUrlCandidate } from '../core/url.js'
import { buildHistoryIndex, searchHistory } from '../core/search.js'
import { CLOSED_MODE, createPopupSessionSearchCache, createSearchModeState, FAVORITES_SEARCH_MODE, hiddenSearchModeExitTarget, HISTORY_MODE, isHiddenSearchMode, nextSearchMode, searchSearchHeaderModel, searchSearchSurfaceModel } from '../core/search-modes.js'
import { fetchHistory } from '../platform/history-provider.js'
import { loadStoredFavorites, removeStoredFavoriteByKey, restoreStoredFavoriteRemoval } from '../platform/favorites-store.js'
import { fetchRecentlyClosed, flattenClosedSessions } from '../platform/sessions-provider.js'
import { loadSelectionData, saveSelectionData } from '../platform/selection-store.js'
import { openUrl } from '../platform/tabs.js'
import { writeClipboardText } from '../platform/clipboard.js'
import { allowsImplicitSelectionLearningPersistence, incognitoContextFromExtension } from '../platform/incognito-context.js'

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
 * A ResultNavigationCommand is one of:
 * - "ignore"
 * - "focusSearch"
 * - "leavePanelFocus"
 * - "copySelected"
 * - "editSelectedUrl"
 * - "removeSelectedFavorite"
 * - "undoFavoriteRemoval"
 * - "moveNext"
 * - "movePrevious"
 * - "nextPage"
 * - "previousPage"
 * - "openSelected"
 *
 * Interpretation:
 * Represents a list-selection keyboard action after raw key events are translated. Favorites adds
 * x remove and one-level u undo while preserving existing public-mode copy/edit/navigation/open
 * commands.
 *
 * @typedef {'ignore'|'focusSearch'|'leavePanelFocus'|'copySelected'|'editSelectedUrl'|'removeSelectedFavorite'|'undoFavoriteRemoval'|'moveNext'|'movePrevious'|'nextPage'|'previousPage'|'openSelected'} ResultNavigationCommand
 */

/**
 * A FavoritesPanelState is an object:
 * - previousPublicSearchMode: import('../core/search-modes.js').PublicSearchMode
 * - favoriteRemovalUndo: import('../core/favorites.js').FavoriteRemovalUndo
 *
 * Interpretation:
 * Represents popup-session state needed only by hidden favorites mode. previousPublicSearchMode is
 * where Tab returns after entering favorites; favoriteRemovalUndo is the one-level removal undo
 * available until it is consumed or replaced.
 *
 * @typedef {object} FavoritesPanelState
 * @property {import('../core/search-modes.js').PublicSearchMode} previousPublicSearchMode Public mode to restore when leaving favorites.
 * @property {import('../core/favorites.js').FavoriteRemovalUndo} favoriteRemovalUndo One-level popup-session removal undo.
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

/**
 * KeyboardEvent { inFavoritesMode: boolean, canRemoveFavorite: boolean, canUndoFavoriteRemoval: boolean } -> ResultNavigationCommand
 *
 * Produces the list-selection keyboard command for hidden favorites mode, including x remove and
 * one-level u undo, while preserving ordinary result-navigation commands for all other keys.
 *
 * Functional Examples:
 * - favoriteResultNavigationCommandForKey({ key: "x" }, { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: false }) should produce "removeSelectedFavorite".
 * - favoriteResultNavigationCommandForKey({ key: "u" }, { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: true }) should produce "undoFavoriteRemoval".
 * - favoriteResultNavigationCommandForKey({ key: "u" }, { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: false }) should produce "ignore".
 * - favoriteResultNavigationCommandForKey({ key: "y" }, { inFavoritesMode: true, canRemoveFavorite: true, canUndoFavoriteRemoval: true }) should produce "copySelected".
 * - favoriteResultNavigationCommandForKey({ key: "x" }, { inFavoritesMode: false, canRemoveFavorite: true, canUndoFavoriteRemoval: true }) should produce "ignore".
 *
 * Template:
 * Combine the key itemization with favorites state:
 * - if key is x and inFavoritesMode and canRemoveFavorite, produce removeSelectedFavorite
 * - if key is u and inFavoritesMode and canUndoFavoriteRemoval, produce undoFavoriteRemoval
 * - otherwise delegate to resultNavigationCommandForKey(event)
 */
export function favoriteResultNavigationCommandForKey(
  event,
  { inFavoritesMode = false, canRemoveFavorite = false, canUndoFavoriteRemoval = false } = {},
) {
  const key = typeof event?.key === 'string' ? event.key.toLowerCase() : ''

  if (key === 'x' && inFavoritesMode && canRemoveFavorite) {
    return 'removeSelectedFavorite'
  }
  if (key === 'u' && inFavoritesMode && canUndoFavoriteRemoval) {
    return 'undoFavoriteRemoval'
  }

  return resultNavigationCommandForKey(event)
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
    this.previousPublicSearchMode = HISTORY_MODE
    this.favoriteRemovalUndo = null

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

  get modeCache() {
    return this.searchCache?.modes ?? null
  }

  set modeCache(modes) {
    this.searchCache ??= createPopupSessionSearchCache({ activeMode: HISTORY_MODE })
    this.searchCache.modes = modes
  }

  async start() {
    this.bindEvents()
    this.searchCache = createPopupSessionSearchCache({ activeMode: HISTORY_MODE })
    this.searchMode = this.searchCache.activeMode
    this.previousPublicSearchMode = HISTORY_MODE
    this.favoriteRemovalUndo = null
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
        void this.handleSearchInputTab({ shiftKey: event.shiftKey })
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
        void this.handleSearchInputEnter()
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


  /**
   * void -> Promise<void>
   *
   * Handles Enter in the search input by entering hidden favorites for a favorites command, or by
   * preserving the existing behavior of opening the selected row in a new tab.
   *
   * Functional Examples:
   * - With input.value ":f", handleSearchInputEnter() should call enterFavoritesMode() and should not open the selected URL.
   * - With input.value " :favorite ", handleSearchInputEnter() should call enterFavoritesMode() and should not open the selected URL.
   * - With input.value ":favorites", handleSearchInputEnter() should flush pending results and openSelected({ newTab: true }) rather than enter favorites.
   * - With input.value "git issues", handleSearchInputEnter() should flush pending results and openSelected({ newTab: true }).
   *
   * Template:
   * Compose command parsing and existing open behavior:
   * - flushPendingInputResultsUpdate
   * - parseFavoritesCommand(input.value)
   * - if parse kind is enter-favorites, call enterFavoritesMode
   * - otherwise call openSelected({ newTab: true })
   */
  async handleSearchInputEnter() {
    this.flushPendingInputResultsUpdate()

    const commandParse = parseFavoritesCommand(this.input.value)
    if (commandParse.kind === 'enter-favorites') {
      await this.enterFavoritesMode()
      return
    }

    await this.openSelected({ newTab: true })
  }

  /**
   * { shiftKey?: boolean } -> Promise<void>
   *
   * Handles Tab in the search input by exiting hidden favorites to the previous public mode, or by
   * preserving public-mode cycling through history and recently closed URLs.
   *
   * Functional Examples:
   * - In favorites mode with previousPublicSearchMode "closed", handleSearchInputTab({ shiftKey: false }) should switch to "closed".
   * - In favorites mode with previousPublicSearchMode "history", handleSearchInputTab({ shiftKey: true }) should switch to "history"; Shift does not change hidden-mode exit target.
   * - In history public mode, handleSearchInputTab({ shiftKey: false }) should switch to "closed".
   * - In closed public mode, handleSearchInputTab({ shiftKey: false }) should switch to "history".
   *
   * Template:
   * Follow SearchMode as a union:
   * - when active mode is hidden favorites, call exitFavoritesModeToPreviousPublicMode
   * - otherwise call cycleSearchMode with the requested direction
   */
  async handleSearchInputTab({ shiftKey = false } = {}) {
    if (isHiddenSearchMode(this.searchMode)) {
      await this.exitFavoritesModeToPreviousPublicMode()
      return
    }

    await this.cycleSearchMode(shiftKey ? -1 : 1)
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

  /**
   * void -> Promise<import('../core/search-modes.js').SearchModeState>
   *
   * Enters or re-enters hidden favorites mode, remembers the current public mode when coming from
   * one, clears the command input, loads stored favorites into a searchable index, and shows all
   * favorites for an empty query.
   */
  async enterFavoritesMode() {
    if (!isHiddenSearchMode(this.searchMode)) {
      this.previousPublicSearchMode = hiddenSearchModeExitTarget(this.searchMode)
    }
    this.input.value = ''
    this.selectedIndex = 0
    this.pageIndex = 0

    const state = await this.ensureFavoritesModeReady()
    this.updateResults()
    this.renderSearchSurface()

    return state
  }

  /**
   * void -> Promise<import('../core/search-modes.js').SearchModeState>
   *
   * Leaves hidden favorites mode by activating the remembered previous public search mode.
   */
  async exitFavoritesModeToPreviousPublicMode() {
    const target = hiddenSearchModeExitTarget(this.previousPublicSearchMode)
    return this.switchSearchMode(target)
  }

  ensureSearchCache() {
    if (!this.searchCache?.modes?.history || !this.searchCache?.modes?.closed) {
      this.searchCache = createPopupSessionSearchCache({ activeMode: HISTORY_MODE })
    }

    return this.searchCache
  }

  async ensureSearchModeReady(mode = this.searchMode) {
    const cache = this.ensureSearchCache()
    const normalizedMode = mode === FAVORITES_SEARCH_MODE
      ? FAVORITES_SEARCH_MODE
      : mode === CLOSED_MODE
        ? CLOSED_MODE
        : HISTORY_MODE

    cache.activeMode = normalizedMode
    this.searchMode = normalizedMode

    if (!cache.modes[normalizedMode]) {
      cache.modes[normalizedMode] = createSearchModeState(normalizedMode)
    }

    const state = cache.modes[normalizedMode]
    if (state.status === 'ready') {
      this.index = state.index
      return state
    }
    if (state.status === 'loading' && state.loadingPromise) return state.loadingPromise

    if (normalizedMode === FAVORITES_SEARCH_MODE) return this.loadFavoritesMode(state)
    return normalizedMode === CLOSED_MODE
      ? this.loadClosedMode(state)
      : this.loadHistoryMode(state)
  }

  async ensureHistoryCorpusReady() {
    return this.ensureSearchModeReady(HISTORY_MODE)
  }

  async ensureFavoritesModeReady() {
    return this.ensureSearchModeReady(FAVORITES_SEARCH_MODE)
  }

  async loadSearchModeState(state, loadIndex) {
    state.status = 'loading'
    state.error = null
    state.index = null
    state.loadedAt = null
    this.loading = true

    const loadingPromise = (async () => {
      try {
        const { index, loadedAt } = await loadIndex()

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
      const loadedAt = this.clock()
      const index = buildHistoryIndex(rawEntries, { now: loadedAt })
      return { index, loadedAt }
    })
  }

  async loadClosedMode(state) {
    return this.loadSearchModeState(state, async () => {
      const recentlyClosed = await fetchRecentlyClosed({ chromeApi: this.chromeApi })
      const loadedAt = this.clock()
      const rawEntries = flattenClosedSessions(recentlyClosed, { now: loadedAt })
      const index = buildHistoryIndex(rawEntries, { now: loadedAt })
      return { index, loadedAt }
    })
  }

  async loadFavoritesMode(state) {
    return this.loadSearchModeState(state, async () => {
      const favorites = await loadStoredFavorites({ chromeApi: this.chromeApi })
      const loadedAt = this.clock()
      const index = buildFavoritesIndex(favorites, { now: loadedAt })
      return { index, loadedAt }
    })
  }

  ignoreCorpusSwitchInput(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
  }

  activeSearchModeState() {
    const cache = this.searchCache
    const activeMode = cache?.activeMode

    if (activeMode !== HISTORY_MODE && activeMode !== CLOSED_MODE && activeMode !== FAVORITES_SEARCH_MODE) return null

    return cache?.modes?.[activeMode] ?? null
  }

  emptyQuerySortForMode(mode = this.searchMode) {
    return mode === CLOSED_MODE || mode === FAVORITES_SEARCH_MODE ? 'recency' : 'frecency'
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
      favorites: {
        empty: 'No favorites saved yet.',
        noMatches: 'No matches in favorites.',
        error: 'Favorites unavailable.',
      },
    }

    if (mode === FAVORITES_SEARCH_MODE) return messagesByMode.favorites
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

  async reloadFavoritesModeResults() {
    const cache = this.ensureSearchCache()
    cache.modes[FAVORITES_SEARCH_MODE] = createSearchModeState(FAVORITES_SEARCH_MODE)

    const state = await this.ensureFavoritesModeReady()
    if (state.status === 'ready' && state.index) {
      this.updateResults()
    } else {
      this.results = []
      this.updateVisibleRows()
      this.renderResults()
    }

    this.renderSearchSurface()
    return state
  }

  /**
   * void -> Promise<void>
   *
   * Removes the selected favorite result from local storage, records one popup-session undo, and
   * refreshes the hidden favorites result list immediately.
   */
  async removeSelectedFavorite() {
    if (this.searchMode !== FAVORITES_SEARCH_MODE) return

    const row = this.selectedVisibleRow()
    if (row?.kind !== 'result') return

    const key = row.result?.key
    if (typeof key !== 'string' || !key) return

    const result = await removeStoredFavoriteByKey(key, { chromeApi: this.chromeApi })
    if (result.undo) this.favoriteRemovalUndo = result.undo

    await this.reloadFavoritesModeResults()
  }

  /**
   * void -> Promise<void>
   *
   * Restores the most recently removed favorite for this popup session, consumes the undo slot, and
   * refreshes the hidden favorites result list immediately.
   */
  async undoLastFavoriteRemoval() {
    if (this.searchMode !== FAVORITES_SEARCH_MODE) return
    if (!this.favoriteRemovalUndo) return

    const result = await restoreStoredFavoriteRemoval(this.favoriteRemovalUndo, { chromeApi: this.chromeApi })
    this.favoriteRemovalUndo = result.undo

    await this.reloadFavoritesModeResults()
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

    const selectedRow = this.selectedVisibleRow()
    const command = favoriteResultNavigationCommandForKey(event, {
      inFavoritesMode: this.searchMode === FAVORITES_SEARCH_MODE,
      canRemoveFavorite: selectedRow?.kind === 'result',
      canUndoFavoriteRemoval: Boolean(this.favoriteRemovalUndo),
    })
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
      case 'removeSelectedFavorite':
        void this.removeSelectedFavorite()
        break
      case 'undoFavoriteRemoval':
        void this.undoLastFavoriteRemoval()
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

  activeSearchMode() {
    if (this.searchMode === HISTORY_MODE || this.searchMode === CLOSED_MODE || this.searchMode === FAVORITES_SEARCH_MODE) return this.searchMode
    return HISTORY_MODE
  }

  async openSelected({ newTab }) {
    const row = this.selectedVisibleRow()
    const url = rowOpenUrl(row)
    if (!url) return

    await openUrl(url, { chromeApi: this.chromeApi, newTab })

    const urlKey = rowSelectionLearningKey(row)
    const incognitoContext = incognitoContextFromExtension({ chromeApi: this.chromeApi })
    if (urlKey && allowsImplicitSelectionLearningPersistence(incognitoContext, this.searchMode)) {
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
      const hints = selectedFavoriteRowActionHints(row, {
        selected,
        inFavoritesMode: this.searchMode === FAVORITES_SEARCH_MODE,
        canUndoFavoriteRemoval: Boolean(this.favoriteRemovalUndo),
      })
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
    const hasFavoriteRemovalUndo = this.searchMode === FAVORITES_SEARCH_MODE && Boolean(this.favoriteRemovalUndo)

    this.message.hidden = true
    this.resultsList.innerHTML = ''

    if (corpusState?.status === 'error') {
      this.showMessage(messages.error)
    } else if (!hasRealRows && hasFavoriteRemovalUndo) {
      this.showMessage('Removed favorite — u undo')
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
