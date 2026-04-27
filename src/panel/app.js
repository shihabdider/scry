import { parseQuery } from '../core/query.js'
import { buildVisibleRows } from '../core/rows.js'
import { recordSelection } from '../core/selection-learning.js'
import { createTypedUrlCandidate } from '../core/url.js'
import { buildHistoryIndex, searchHistory } from '../core/search.js'
import { createModeCache, modeIndicatorModel } from '../core/search-modes.js'
import { fetchHistory } from '../platform/history-provider.js'
import { loadSelectionData, saveSelectionData } from '../platform/selection-store.js'
import { fetchRecentlyClosed, flattenClosedSessions } from '../platform/sessions-provider.js'
import { openUrl } from '../platform/tabs.js'

const SEARCH_LIMIT = 100
const RESULTS_PER_PAGE = 6
const FOCUS_RETRY_DELAYS_MS = [0, 50, 150, 300, 600, 1000]

export class ScryPanelApp {
  constructor({ document, chromeApi = chrome, clock = () => Date.now(), windowApi = globalThis.window } = {}) {
    this.document = document
    this.chromeApi = chromeApi
    this.clock = clock
    this.windowApi = windowApi
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
    this.focusSearch()
    this.setStatus('Loading history…')
    this.selectionData = await loadSelectionData({ chromeApi: this.chromeApi })
    await this.loadHistory({ deep: false })
  }

  bindEvents() {
    this.input.addEventListener('input', () => {
      this.selectedIndex = 0
      this.pageIndex = 0
      this.updateResults()
    })

    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || (event.ctrlKey && event.key.toLowerCase() === 'n')) {
        event.preventDefault()
        this.moveSelection(1)
      } else if (event.key === 'ArrowUp' || (event.ctrlKey && event.key.toLowerCase() === 'p')) {
        event.preventDefault()
        this.moveSelection(-1)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        void this.openSelected({ newTab: event.metaKey || event.ctrlKey })
      } else if (event.key === 'Escape') {
        event.preventDefault()
        this.focusResults()
      }
    })

    this.resultsList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-result-index]')
      if (!button) return
      this.selectedIndex = Number(button.dataset.resultIndex)
      void this.openSelected({ newTab: event.metaKey || event.ctrlKey })
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

  async loadHistory({ deep }) {
    this.loading = true
    this.deep = deep
    this.renderLoading()

    try {
      const rawHistory = await fetchHistory({ chromeApi: this.chromeApi, now: this.clock(), deep })
      this.index = buildHistoryIndex(rawHistory, { now: this.clock() })
      this.loading = false
      this.setStatus(deep ? `${this.index.entries.length} deep history URLs` : `${this.index.entries.length} recent history URLs`)
      this.updateResults()
    } catch (error) {
      this.loading = false
      console.error('Scry failed to load history', error)
      this.setStatus('History unavailable')
      this.showMessage('Could not load browser history. Check extension permissions.')
    }
  }

  async switchSearchMode(mode) {
    throw new Error('not implemented: switchSearchMode')
  }

  async ensureSearchModeReady(mode) {
    this.modeCache ??= createModeCache()
    const state = this.modeCache[mode]
    if (!state) throw new Error(`Unknown search mode: ${mode}`)

    this.searchMode = mode
    this.deep = mode === 'deep'

    if (state.status === 'ready' && state.index) {
      this.index = state.index
      this.loading = false
      return state
    }

    state.status = 'loading'
    state.error = null
    state.index = null
    state.loadedAt = null
    this.loading = true

    try {
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

  resetSelectionForModeSwitch() {
    this.selectedIndex = 0
    this.pageIndex = 0
  }

  renderModeIndicator() {
    const state = this.modeCache?.[this.searchMode] ?? null
    const model = modeIndicatorModel(this.searchMode, state)

    if (this.status) this.setStatus(model.statusText)
    if (this.deepSearchButton) this.deepSearchButton.hidden = true

    const indicator = this.document.querySelector('#mode-indicator')
    if (!indicator) return model

    indicator.hidden = false
    indicator.textContent = model.label
    indicator.dataset.mode = model.mode
    indicator.dataset.status = model.status
    indicator.dataset.clickable = String(model.clickable)
    indicator.disabled = !model.clickable
    indicator.title = model.statusText
    indicator.setAttribute('aria-disabled', model.clickable ? 'false' : 'true')
    indicator.setAttribute('aria-label', `${model.label}; ${model.statusText}`)

    return model
  }

  updateVisibleRows() {
    const typedUrlCandidate = createTypedUrlCandidate(this.input.value)
    this.visibleRows = buildVisibleRows({
      corpusResults: this.results,
      typedUrlCandidate,
      copiedFeedback: this.copiedFeedback,
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
    throw new Error('not implemented: copySelectedRow')
  }

  changeSelectedRowToSearch() {
    throw new Error('not implemented: changeSelectedRowToSearch')
  }

  updateResults() {
    if (!this.index) return
    this.results = searchHistory(this.index, this.input.value, {
      now: this.clock(),
      limit: SEARCH_LIMIT,
      selections: this.selectionData,
    })
    if (this.selectedIndex >= this.results.length) this.selectedIndex = Math.max(0, this.results.length - 1)
    this.ensureSelectedVisible()
    this.renderResults()
  }

  pageCount() {
    return Math.max(1, Math.ceil(this.results.length / RESULTS_PER_PAGE))
  }

  pageStart() {
    return this.pageIndex * RESULTS_PER_PAGE
  }

  clampPageIndex() {
    this.pageIndex = Math.min(Math.max(0, this.pageIndex), this.pageCount() - 1)
  }

  ensureSelectedVisible() {
    this.clampPageIndex()
    if (!this.results.length) return
    const start = this.pageStart()
    const end = start + RESULTS_PER_PAGE
    if (this.selectedIndex < start || this.selectedIndex >= end) {
      this.pageIndex = Math.floor(this.selectedIndex / RESULTS_PER_PAGE)
      this.clampPageIndex()
    }
  }

  moveSelection(delta) {
    if (!this.results.length) return
    this.selectedIndex = (this.selectedIndex + delta + this.results.length) % this.results.length
    this.ensureSelectedVisible()
    this.renderResults()
  }

  movePage(delta) {
    if (!this.results.length) return
    const nextPage = Math.min(Math.max(0, this.pageIndex + delta), this.pageCount() - 1)
    if (nextPage === this.pageIndex) return
    this.pageIndex = nextPage
    this.selectedIndex = this.pageStart()
    this.renderResults()
  }

  handlePanelKeydown(event) {
    if (event.target === this.input || this.focusMode !== 'results') return

    if (event.key === 'Escape') {
      event.preventDefault()
      this.leavePanelFocus()
    } else if (event.key.toLowerCase() === 'j') {
      event.preventDefault()
      this.moveSelection(1)
    } else if (event.key.toLowerCase() === 'k') {
      event.preventDefault()
      this.moveSelection(-1)
    } else if (event.key.toLowerCase() === 'l') {
      event.preventDefault()
      this.movePage(1)
    } else if (event.key.toLowerCase() === 'h') {
      event.preventDefault()
      this.movePage(-1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void this.openSelected({ newTab: event.metaKey || event.ctrlKey })
    }
  }

  focusSearch() {
    this.focusMode = 'search'
    const requestId = ++this.focusRequestId
    const focusInputAtEnd = () => {
      this.input.focus({ preventScroll: true })
      if (typeof this.input.setSelectionRange !== 'function') return

      const cursorPosition = this.input.value.length
      try {
        this.input.setSelectionRange(cursorPosition, cursorPosition)
      } catch {
        // Some input-like elements do not support text selection.
      }
    }

    focusInputAtEnd()
    for (const delay of FOCUS_RETRY_DELAYS_MS) {
      const timer = setTimeout(() => {
        if (this.focusMode !== 'search' || this.focusRequestId !== requestId) return
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
    const selected = this.resultsList.querySelector(`[data-result-index="${this.selectedIndex}"]`)
    if (selected) {
      selected.focus()
      return
    }
    this.resultsList.focus?.()
  }

  leavePanelFocus() {
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
    const result = this.results[this.selectedIndex]
    if (!result) return

    await openUrl(result.url, { chromeApi: this.chromeApi, newTab })

    this.selectionData = recordSelection(this.selectionData, {
      query: this.input.value,
      tokens: parseQuery(this.input.value).tokens,
      urlKey: result.key,
      selectedAt: this.clock(),
    })
    await saveSelectionData(this.selectionData, { chromeApi: this.chromeApi })
    this.updateResults()
    this.leavePanelFocus()
  }

  renderLoading() {
    this.setStatus(this.deep ? 'Deep searching history…' : 'Loading history…')
    this.resultsList.innerHTML = ''
    this.showMessage(this.deep ? 'Searching all available history. This can take a moment.' : 'Indexing recent browser history…')
    this.deepSearchButton.hidden = true
    if (this.pagination) this.pagination.hidden = true
  }

  renderResults() {
    const query = this.input.value.trim()
    this.message.hidden = true
    this.resultsList.innerHTML = ''

    if (!this.results.length) {
      this.showMessage(query ? (this.deep ? 'No matches in history.' : 'No matches in recent history.') : 'No history results yet.')
    }

    this.ensureSelectedVisible()
    const fragment = this.document.createDocumentFragment()
    const start = this.pageStart()
    const visibleResults = this.results.slice(start, start + RESULTS_PER_PAGE)
    for (const [offset, result] of visibleResults.entries()) {
      const index = start + offset
      const item = this.document.createElement('li')
      item.className = `result${index === this.selectedIndex ? ' selected' : ''}`

      const button = this.document.createElement('button')
      button.type = 'button'
      button.className = 'result-button'
      button.dataset.resultIndex = String(index)
      button.setAttribute('aria-current', index === this.selectedIndex ? 'true' : 'false')
      button.innerHTML = `
        <span class="result-url">${result.urlHtml}</span>
        <span class="result-title">${result.titleHtml}</span>
        <span class="result-meta">${result.visitsLabel} · ${result.lastVisitedLabel}</span>
      `

      item.append(button)
      fragment.append(item)
    }
    this.resultsList.append(fragment)
    if (this.focusMode === 'results') this.focusSelectedResult()

    this.renderPagination()

    this.deepSearchButton.hidden = this.deep || !query || this.results.length > 0
    if (!this.deep && query && this.results.length === 0) {
      this.deepSearchButton.textContent = `Deep search all history for “${query}”`
    }
  }

  renderPagination() {
    if (!this.pagination || !this.pageStatus) return
    const pageCount = this.pageCount()
    this.pagination.hidden = this.results.length === 0 || pageCount <= 1
    this.pageStatus.textContent = this.results.length ? `Page ${this.pageIndex + 1} of ${pageCount}` : 'No results'
    if (this.previousPageButton) this.previousPageButton.disabled = this.pageIndex === 0
    if (this.nextPageButton) this.nextPageButton.disabled = this.pageIndex >= pageCount - 1
  }

  showMessage(text) {
    this.message.textContent = text
    this.message.hidden = false
  }

  setStatus(text) {
    this.status.textContent = text
  }
}
