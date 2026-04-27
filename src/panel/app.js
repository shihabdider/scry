import { parseQuery } from '../core/query.js'
import { recordSelection } from '../core/selection-learning.js'
import { buildHistoryIndex, searchHistory } from '../core/search.js'
import { fetchHistory } from '../platform/history-provider.js'
import { loadSelectionData, saveSelectionData } from '../platform/selection-store.js'
import { openUrl } from '../platform/tabs.js'

const DEFAULT_LIMIT = 30

export class ScryPanelApp {
  constructor({ document, chromeApi = chrome, clock = () => Date.now() }) {
    this.document = document
    this.chromeApi = chromeApi
    this.clock = clock
    this.index = null
    this.deep = false
    this.loading = false
    this.results = []
    this.selectedIndex = 0
    this.selectionData = undefined

    this.input = document.querySelector('#search-input')
    this.status = document.querySelector('#status')
    this.message = document.querySelector('#message')
    this.resultsList = document.querySelector('#results')
    this.deepSearchButton = document.querySelector('#deep-search-button')
  }

  async start() {
    this.bindEvents()
    this.input.focus()
    this.setStatus('Loading history…')
    this.selectionData = await loadSelectionData({ chromeApi: this.chromeApi })
    await this.loadHistory({ deep: false })
  }

  bindEvents() {
    this.input.addEventListener('input', () => {
      this.selectedIndex = 0
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

  updateResults() {
    if (!this.index) return
    this.results = searchHistory(this.index, this.input.value, {
      now: this.clock(),
      limit: DEFAULT_LIMIT,
      selections: this.selectionData,
    })
    if (this.selectedIndex >= this.results.length) this.selectedIndex = Math.max(0, this.results.length - 1)
    this.renderResults()
  }

  moveSelection(delta) {
    if (!this.results.length) return
    this.selectedIndex = (this.selectedIndex + delta + this.results.length) % this.results.length
    this.renderResults()
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
  }

  renderLoading() {
    this.setStatus(this.deep ? 'Deep searching history…' : 'Loading history…')
    this.resultsList.innerHTML = ''
    this.showMessage(this.deep ? 'Searching all available history. This can take a moment.' : 'Indexing recent browser history…')
    this.deepSearchButton.hidden = true
  }

  renderResults() {
    const query = this.input.value.trim()
    this.message.hidden = true
    this.resultsList.innerHTML = ''

    if (!this.results.length) {
      this.showMessage(query ? (this.deep ? 'No matches in history.' : 'No matches in recent history.') : 'No history results yet.')
    }

    const fragment = this.document.createDocumentFragment()
    for (const [index, result] of this.results.entries()) {
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

    this.deepSearchButton.hidden = this.deep || !query || this.results.length > 0
    if (!this.deep && query && this.results.length === 0) {
      this.deepSearchButton.textContent = `Deep search all history for “${query}”`
    }
  }

  showMessage(text) {
    this.message.textContent = text
    this.message.hidden = false
  }

  setStatus(text) {
    this.status.textContent = text
  }
}
