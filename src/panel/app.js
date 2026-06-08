import { parseFavoritesCommand } from '../core/favorites-command.js'
import { buildFavoritesIndex } from '../core/favorites.js'
import { parseQuery } from '../core/query.js'
import { buildVisibleRows, rowEditableText, rowOpenUrl, rowSelectionLearningKey, selectedFavoriteRowActionHints } from '../core/rows.js'
import { escapeHtml } from '../core/format.js'
import { recordSelection } from '../core/selection-learning.js'
import { createTypedUrlCandidate } from '../core/url.js'
import { buildHistoryIndex, searchHistory } from '../core/search.js'
import { createModeCache, cycleSearchMode, FAVORITES_SEARCH_MODE, favoritesSearchHeaderModel, hiddenSearchModeExitTarget, isHiddenSearchMode, modeIndicatorModel, searchHeaderModel } from '../core/search-modes.js'
import { fetchHistory } from '../platform/history-provider.js'
import { loadStoredFavorites, removeStoredFavoriteByKey, restoreStoredFavoriteRemoval } from '../platform/favorites-store.js'
import { loadSelectionData, saveSelectionData } from '../platform/selection-store.js'
import { fetchRecentlyClosed, flattenClosedSessions } from '../platform/sessions-provider.js'
import { openUrl } from '../platform/tabs.js'
import { writeClipboardText } from '../platform/clipboard.js'
import { allowsBrowsingDataPersistence, incognitoContextFromExtension } from '../platform/incognito-context.js'

const SEARCH_LIMIT = 100
const RESULTS_PER_PAGE = 6
const INPUT_UPDATE_DEBOUNCE_MS = 80
const FOCUS_RETRY_DELAYS_MS = [0, 50, 150, 300, 600, 1000]
const COPY_FEEDBACK_DURATION_MS = 1_200

/**
 * @typedef {'search'|'results'|'blurred'} FocusMode
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
 * Examples:
 * - "copySelected" represents y copy for the selected row.
 * - "removeSelectedFavorite" represents x remove in hidden favorites mode.
 * - "undoFavoriteRemoval" represents u undo when the popup session has a FavoriteRemovalUndo.
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
 * Examples:
 * - { previousPublicSearchMode: "recent", favoriteRemovalUndo: null } represents entering favorites from the default public mode with no removal to undo.
 * - { previousPublicSearchMode: "closed", favoriteRemovalUndo: { favorite: exampleFavorite, index: 1 } } represents entering from closed mode after removing a favorite from row 1.
 *
 * @typedef {object} FavoritesPanelState
 * @property {import('../core/search-modes.js').PublicSearchMode} previousPublicSearchMode Public mode to restore when leaving favorites.
 * @property {import('../core/favorites.js').FavoriteRemovalUndo} favoriteRemovalUndo One-level popup-session removal undo.
 */

export function resultNavigationCommandForKey(event) {
  const key = typeof event?.key === 'string' ? event.key.toLowerCase() : ''

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
      return 'moveNext'
    case 'k':
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

function modeIndicatorModelFromHeaderModel(model) {
  return {
    label: model.modeBadgeLabel,
    mode: model.mode,
    status: model.status,
    clickable: model.mode !== FAVORITES_SEARCH_MODE,
    modeSwitchHint: model.modeSwitchHint,
    statusText: model.statusText,
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
    this.deep = false
    this.loading = false
    this.results = []
    this.selectedIndex = 0
    this.pageIndex = 0
    this.focusMode = 'search'
    this.searchMode = 'recent'
    this.modeCache = null
    this.visibleRows = []
    this.copiedFeedback = null
    this.focusRequestId = 0
    this.inputResultsUpdateRequest = null
    this.selectionData = undefined
    this.previousPublicSearchMode = 'recent'
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

  async start() {
    this.bindEvents()
    this.searchMode = 'recent'
    this.deep = false
    this.modeCache = createModeCache()
    this.index = null
    this.renderModeIndicator()
    this.focusSearch()
    this.selectionData = await loadSelectionData({ chromeApi: this.chromeApi })
    await this.loadHistory({ deep: false })
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
        this.moveSelection(1)
      } else if (event.key === 'ArrowUp' || (event.ctrlKey && event.key.toLowerCase() === 'p')) {
        event.preventDefault()
        this.flushPendingInputResultsUpdate()
        this.moveSelection(-1)
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
      void this.switchSearchMode(cycleSearchMode(this.searchMode))
    })

    this.deepSearchButton.addEventListener('click', () => {
      void this.loadHistory({ deep: true })
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
   * preserving public-mode cycling through recent -> closed -> deep.
   *
   * Functional Examples:
   * - In favorites mode with previousPublicSearchMode "closed", handleSearchInputTab({ shiftKey: false }) should switch to "closed".
   * - In favorites mode with previousPublicSearchMode "recent", handleSearchInputTab({ shiftKey: true }) should switch to "recent"; Shift does not change hidden-mode exit target.
   * - In recent public mode, handleSearchInputTab({ shiftKey: false }) should switch to "closed".
   * - In closed public mode, handleSearchInputTab({ shiftKey: false }) should switch to "deep".
   * - In recent public mode, handleSearchInputTab({ shiftKey: true }) should switch to "deep".
   *
   * Template:
   * Follow SearchMode as a union:
   * - when active mode is hidden favorites, call exitFavoritesModeToPreviousPublicMode
   * - otherwise call switchSearchMode(cycleSearchMode(this.searchMode, { direction }))
   */
  async handleSearchInputTab({ shiftKey = false } = {}) {
    if (isHiddenSearchMode(this.searchMode)) {
      await this.exitFavoritesModeToPreviousPublicMode()
      return
    }

    await this.switchSearchMode(cycleSearchMode(this.searchMode, { direction: shiftKey ? -1 : 1 }))
  }

  async loadHistory({ deep }) {
    return this.activateSearchMode(deep ? 'deep' : 'recent')
  }

  async switchSearchMode(mode) {
    this.resetSelectionForModeSwitch()
    return this.activateSearchMode(mode)
  }

  /**
   * void -> Promise<import('../core/search-modes.js').SearchModeState>
   *
   * Enters or re-enters hidden favorites mode, remembers the current public mode when coming from
   * one, clears the command input, loads stored favorites into a searchable index, and shows all
   * favorites for an empty query.
   *
   * Functional Examples:
   * - When searchMode is "recent" and input.value is ":f", enterFavoritesMode() should set previousPublicSearchMode to "recent", clear input.value to "", load favorites, and set searchMode to "favorites".
   * - When searchMode is "closed" and input.value is ":favorite", enterFavoritesMode() should set previousPublicSearchMode to "closed", clear input.value to "", load favorites, and set searchMode to "favorites".
   * - When searchMode is already "favorites" and previousPublicSearchMode is "closed", enterFavoritesMode() should preserve previousPublicSearchMode as "closed".
   * - When favorites storage is empty, enterFavoritesMode() should show the empty favorites message with no result rows.
   *
   * Template:
   * Use FavoritesPanelState and hidden SearchMode:
   * - when the active searchMode is public, remember it in previousPublicSearchMode
   * - when the active searchMode is already hidden, preserve previousPublicSearchMode
   * - clear the input command text
   * - reset selection/page state
   * - call ensureFavoritesModeReady
   * - update and render results/header
   */
  async enterFavoritesMode() {
    if (!isHiddenSearchMode(this.searchMode)) {
      this.previousPublicSearchMode = hiddenSearchModeExitTarget(this.searchMode)
    }
    this.input.value = ''
    this.resetSelectionForModeSwitch()

    const state = await this.ensureFavoritesModeReady()
    this.updateResults()
    this.renderModeIndicator()

    return state
  }

  /**
   * void -> Promise<import('../core/search-modes.js').SearchModeState>
   *
   * Leaves hidden favorites mode by activating the remembered previous public search mode.
   *
   * Functional Examples:
   * - With previousPublicSearchMode "recent", exitFavoritesModeToPreviousPublicMode() should switch to "recent" and keep the current input query for public search.
   * - With previousPublicSearchMode "closed", exitFavoritesModeToPreviousPublicMode() should switch to "closed".
   * - With a missing or invalid previousPublicSearchMode, exitFavoritesModeToPreviousPublicMode() should switch to "recent".
   *
   * Template:
   * Use hiddenSearchModeExitTarget:
   * - compute the public target from previousPublicSearchMode
   * - reset favorites-specific selection/page state as needed
   * - call switchSearchMode(target)
   */
  async exitFavoritesModeToPreviousPublicMode() {
    const target = hiddenSearchModeExitTarget(this.previousPublicSearchMode)
    return this.switchSearchMode(target)
  }

  /**
   * SearchMode { createMissingState?: boolean, deep?: boolean, loadIndex: function } -> Promise<import('../core/search-modes.js').SearchModeState>
   *
   * Runs the shared popup-session cache transition for a search mode: select or create the cache
   * slot, reuse an already-ready index, otherwise mark loading and record either a ready index or a
   * mode-local error.
   *
   * Functional Examples:
   * - ensureCachedSearchModeReady("recent", { deep: false, loadIndex }) should load the recent public cache slot and set searchMode to "recent".
   * - ensureCachedSearchModeReady("deep", { deep: true, loadIndex }) should load the deep cache slot and set this.deep to true.
   * - ensureCachedSearchModeReady("favorites", { createMissingState: true, deep: false, loadIndex }) should create the hidden favorites slot before loading it.
   * - When loadIndex rejects, ensureCachedSearchModeReady(...) should store status "error", clear the active index, and set loading false.
   *
   * Template:
   * Follow ModeLoadStatus transitions:
   * - get or create the SearchModeState cache slot
   * - set active mode flags
   * - return early for ready state
   * - mark loading, call loadIndex, and write ready/error fields
   * - always clear this.loading before returning the state
   */
  async ensureCachedSearchModeReady(mode, { createMissingState = false, deep = false, loadIndex } = {}) {
    this.modeCache ??= createModeCache()
    let state = this.modeCache[mode]
    if (!state && createMissingState) {
      state = { mode, status: 'idle', index: null, error: null, loadedAt: null }
      this.modeCache[mode] = state
    }
    if (!state) throw new Error(`Unknown search mode: ${mode}`)

    this.searchMode = mode
    this.deep = deep

    if (state.status === 'ready' && state.index) {
      this.index = state.index
      this.loading = false
      return state
    }

    state.status = 'loading'
    state.index = null
    state.error = null
    state.loadedAt = null
    this.loading = true

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
      this.loading = false
    }

    return state
  }

  /**
   * void -> Promise<import('../core/search-modes.js').SearchModeState>
   *
   * Loads StoredFavorites from local extension storage, converts them to a HistoryIndex, and stores
   * the result in the hidden favorites mode cache slot.
   *
   * Functional Examples:
   * - With no stored favorites, ensureFavoritesModeReady() should create a ready favorites state whose index.entries is [].
   * - With [exampleFavorite], ensureFavoritesModeReady() should create a ready favorites state containing exampleFavorite as a searchable result.
   * - When chrome.storage.local fails, ensureFavoritesModeReady() should create an error favorites state without changing ready public mode caches.
   *
   * Template:
   * Compose ensureCachedSearchModeReady:
   * - create the hidden favorites cache slot if missing
   * - loadStoredFavorites and buildFavoritesIndex
   * - let the shared cache transition set ready/error and update this.index/loading
   */
  async ensureFavoritesModeReady() {
    return this.ensureCachedSearchModeReady(FAVORITES_SEARCH_MODE, {
      createMissingState: true,
      deep: false,
      loadIndex: async () => {
        const favorites = await loadStoredFavorites({ chromeApi: this.chromeApi })
        const loadedAt = this.clock()
        const index = buildFavoritesIndex(favorites, { now: loadedAt })
        return { index, loadedAt }
      },
    })
  }

  async reloadFavoritesModeResults() {
    this.modeCache ??= createModeCache()
    this.modeCache[FAVORITES_SEARCH_MODE] = { mode: FAVORITES_SEARCH_MODE, status: 'idle', index: null, error: null, loadedAt: null }

    const state = await this.ensureFavoritesModeReady()
    if (state.status === 'ready' && state.index) {
      this.updateResults()
    } else {
      this.results = []
      this.updateVisibleRows()
      this.renderResults()
    }

    this.renderModeIndicator()
    return state
  }

  async activateSearchMode(mode) {
    this.cancelPendingInputResultsUpdate()
    const ready = this.ensureSearchModeReady(mode)
    this.renderModeIndicator()
    const state = await ready

    if (state.status === 'ready' && state.index) {
      this.updateResults()
    } else {
      this.results = []
      this.renderResults()
    }

    this.updateVisibleRows()
    this.renderModeIndicator()
    return state
  }

  async ensureSearchModeReady(mode) {
    return this.ensureCachedSearchModeReady(mode, {
      deep: mode === 'deep',
      loadIndex: async () => {
        let rawEntries
        let loadedAt

        if (mode === 'closed') {
          const recentlyClosed = await fetchRecentlyClosed({ chromeApi: this.chromeApi })
          loadedAt = this.clock()
          rawEntries = flattenClosedSessions(recentlyClosed, { now: loadedAt })
        } else {
          const requestedAt = this.clock()
          rawEntries = await fetchHistory({ chromeApi: this.chromeApi, now: requestedAt, deep: mode === 'deep' })
          loadedAt = this.clock()
        }

        const index = buildHistoryIndex(rawEntries, { now: loadedAt })
        return { index, loadedAt }
      },
    })
  }

  resetSelectionForModeSwitch() {
    this.selectedIndex = 0
    this.pageIndex = 0
  }

  renderModeIndicator() {
    if (this.deepSearchButton) this.deepSearchButton.hidden = true

    const headerModel = this.renderSearchHeader()
    return modeIndicatorModelFromHeaderModel(headerModel)
  }

  renderSearchHeader() {
    const mode = this.activeSearchMode()
    const state = this.modeCache?.[mode] ?? null
    const model = mode === FAVORITES_SEARCH_MODE
      ? favoritesSearchHeaderModel(state)
      : searchHeaderModel(mode, state)

    const before = this.document.querySelector('#search-header-before')
    if (before) before.textContent = model.beforeMode

    const after = this.document.querySelector('#search-header-after')
    if (after) after.textContent = model.afterMode

    const hint = this.document.querySelector('#mode-switch-hint')
    if (hint) {
      hint.textContent = model.modeSwitchHint
      hint.hidden = !model.modeSwitchHint
      hint.setAttribute('aria-hidden', 'true')
    }

    const resultCount = this.document.querySelector('#result-count')
    if (resultCount) {
      resultCount.textContent = model.statusText
      resultCount.setAttribute('aria-label', model.statusText)
      resultCount.setAttribute('role', 'status')
      resultCount.setAttribute('aria-live', 'polite')
    }

    const searchHeader = this.document.querySelector('#search-header')
    if (searchHeader) {
      searchHeader.hidden = false
      searchHeader.setAttribute('aria-label', `${model.beforeMode} ${model.mode} ${model.afterMode}; ${model.statusText}`)
    }

    this.input?.setAttribute('aria-label', `${model.beforeMode} ${model.mode} ${model.afterMode}`)
    if (this.status) this.setStatus(model.statusText)

    this.renderModeIndicatorElement(modeIndicatorModelFromHeaderModel(model))

    return model
  }

  renderModeIndicatorElement(model) {
    const indicator = this.document.querySelector('#mode-indicator')
    if (!indicator) return

    const switchHint = model.clickable && model.modeSwitchHint
      ? `switch mode with ${model.modeSwitchHint}`
      : ''
    const ariaLabel = [model.label, model.statusText, switchHint].filter(Boolean).join('; ')

    indicator.hidden = false
    indicator.textContent = model.label
    indicator.dataset.mode = model.mode
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

  /**
   * void -> Promise<void>
   *
   * Removes the selected favorite result from local storage, records one popup-session undo, and
   * refreshes the hidden favorites result list immediately.
   *
   * Functional Examples:
   * - In favorites mode with selected row result key exampleFavorite.key, removeSelectedFavorite() should remove that key from storage, set favoriteRemovalUndo to { favorite: exampleFavorite, index: selectedIndex }, and refresh results.
   * - In favorites mode with selected row as the last favorite, removeSelectedFavorite() should show "Removed favorite — u undo" with no result rows.
   * - In favorites mode with no selected result row, removeSelectedFavorite() should leave storage and favoriteRemovalUndo unchanged.
   * - Outside favorites mode, removeSelectedFavorite() should leave storage and public-mode results unchanged.
   *
   * Template:
   * Use VisibleRow and FavoritesPanelState:
   * - branch on active hidden favorites mode
   * - get selectedVisibleRow and its result key
   * - call removeStoredFavoriteByKey(key)
   * - store result.undo in favoriteRemovalUndo
   * - reload/rebuild favorites index and render results
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
   *
   * Functional Examples:
   * - With favoriteRemovalUndo { favorite: exampleFavorite, index: 0 }, undoLastFavoriteRemoval() should restore exampleFavorite to storage, set favoriteRemovalUndo to null, and refresh favorites results.
   * - With visible "Removed favorite — u undo" feedback, undoLastFavoriteRemoval() should consume favoriteRemovalUndo and hide that feedback.
   * - With favoriteRemovalUndo null, undoLastFavoriteRemoval() should leave storage and visible rows unchanged.
   * - Outside favorites mode, undoLastFavoriteRemoval() should consume no undo and leave public-mode results unchanged.
   *
   * Template:
   * Follow FavoriteRemovalUndo variants:
   * - when favoriteRemovalUndo is null, no-op
   * - when present, call restoreStoredFavoriteRemoval(favoriteRemovalUndo)
   * - set favoriteRemovalUndo to result.undo (null)
   * - reload/rebuild favorites index and render results
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
    let currentIndex = this.index
    if (this.modeCache) {
      const activeModeState = this.modeCache[this.searchMode] ?? null
      currentIndex = activeModeState?.status === 'ready' ? activeModeState.index : null
    }

    this.index = currentIndex ?? null
    this.results = currentIndex
      ? searchHistory(currentIndex, this.input.value, {
        now: this.clock(),
        limit: SEARCH_LIMIT,
        selections: this.selectionData,
        emptyQuerySort: this.searchMode === 'closed' || this.searchMode === FAVORITES_SEARCH_MODE ? 'recency' : 'frecency',
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
    this.focusMode = 'results'
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

  /**
   * { newTab: boolean } -> Promise<void>
   *
   * Opens the selected visible row and, for persistable real rows in a non-incognito popup context,
   * records selection learning before closing the popup.
   *
   * Functional Examples:
   * - In a normal popup with a real history row selected, openSelected({ newTab: true }) should open the row in a new tab, record parsed selection learning, save selection data, refresh results, and close the popup.
   * - In an incognito popup with a real history row selected, openSelected({ newTab: false }) should open the row in the current tab, leave selectionData and chrome.storage.local unchanged, skip result refresh for learning, and close the popup.
   * - With a synthetic typed URL row selected, openSelected({ newTab: false }) should open the typed URL without recording selection learning regardless of incognito context.
   * - With no selected row URL, openSelected({ newTab: true }) should not open a tab, write storage, or close the popup.
   *
   * Template:
   * Compose row opening, optional selection learning, and IncognitoContext:
   * - selectedVisibleRow then rowOpenUrl; when no URL, return
   * - openUrl(url, { chromeApi, newTab }) as before
   * - get rowSelectionLearningKey(row); synthetic rows have no key and skip learning
   * - build IncognitoContext from chrome.extension.inIncognitoContext for the popup
   * - when browsing data persistence is allowed, recordSelection, saveSelectionData, and updateResults
   * - when persistence is not allowed, skip recordSelection and saveSelectionData
   * - leavePanelFocus
   */
  async openSelected({ newTab }) {
    const row = this.selectedVisibleRow()
    const url = rowOpenUrl(row)
    if (!url) return

    await openUrl(url, { chromeApi: this.chromeApi, newTab })

    const urlKey = rowSelectionLearningKey(row)
    const incognitoContext = incognitoContextFromExtension({ chromeApi: this.chromeApi })
    if (urlKey && allowsBrowsingDataPersistence(incognitoContext)) {
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

  activeSearchMode() {
    if (this.searchMode === 'recent' || this.searchMode === 'deep' || this.searchMode === 'closed' || this.searchMode === FAVORITES_SEARCH_MODE) return this.searchMode
    return this.deep ? 'deep' : 'recent'
  }

  renderLoading() {
    const mode = this.activeSearchMode()
    const modeState = this.modeCache?.[mode] ?? null
    const loadingState = modeState?.status === 'loading'
      ? modeState
      : { mode, status: 'loading', index: null, error: null, loadedAt: null }
    const model = modeIndicatorModel(mode, loadingState)
    const messages = {
      recent: 'Indexing recent browser history…',
      deep: 'Searching all available history. This can take a moment.',
      closed: 'Loading recently closed URLs…',
    }

    this.results = []
    this.visibleRows = []
    if (this.resultsList) this.resultsList.innerHTML = ''
    if (this.message) this.showMessage(messages[model.mode])
    if (this.deepSearchButton) this.deepSearchButton.hidden = true
    if (this.pagination) this.pagination.hidden = true
    if (this.pageStatus) this.pageStatus.textContent = 'Loading…'
    if (this.previousPageButton) this.previousPageButton.disabled = true
    if (this.nextPageButton) this.nextPageButton.disabled = true

    const originalModeCache = this.modeCache
    const hadOriginalModeState = Boolean(originalModeCache && Object.prototype.hasOwnProperty.call(originalModeCache, mode))
    const originalModeState = originalModeCache?.[mode]
    const needsTemporaryLoadingState = originalModeState?.status !== 'loading'

    if (needsTemporaryLoadingState) {
      this.modeCache ??= createModeCache()
      this.modeCache[mode] = loadingState
    }

    try {
      this.renderSearchHeader()
    } finally {
      if (needsTemporaryLoadingState) {
        if (originalModeCache) {
          if (hadOriginalModeState) {
            originalModeCache[mode] = originalModeState
          } else {
            delete originalModeCache[mode]
          }
        }
        this.modeCache = originalModeCache
      }
    }

    return model
  }

  renderResults() {
    const query = this.input.value.trim()
    const mode = this.activeSearchMode()
    const modeState = this.modeCache?.[mode] ?? null
    const messages = {
      recent: {
        empty: 'No recent history results yet.',
        noMatches: 'No matches in recent history.',
        error: 'Recent history unavailable.',
      },
      deep: {
        empty: 'No deep history results yet.',
        noMatches: 'No matches in deep history.',
        error: 'Deep history unavailable.',
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
    }[mode]

    const copiedMarker = (row) => row?.copied
      ? '<span class="result-copied-feedback">copied</span>'
      : ''

    const actionHintsHtml = (row, selected) => {
      const hints = selectedFavoriteRowActionHints(row, {
        selected,
        inFavoritesMode: mode === FAVORITES_SEARCH_MODE,
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
    if (modeState?.status === 'error') {
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
    const hasFavoriteRemovalUndo = mode === FAVORITES_SEARCH_MODE && Boolean(this.favoriteRemovalUndo)

    this.message.hidden = true
    this.resultsList.innerHTML = ''

    if (modeState?.status === 'error') {
      this.showMessage(messages.error)
    } else if (!hasRealRows && hasFavoriteRemovalUndo) {
      this.showMessage('Removed favorite — u undo')
    } else if (!hasRealRows) {
      this.showMessage(query ? messages.noMatches : messages.empty)
    }

    this.ensureSelectedVisible()
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

      const selected = visibleRowIndex === this.selectedIndex
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
    this.renderSearchHeader()
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
