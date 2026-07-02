import {
  DEFAULT_SCRY_SETTINGS,
  SCRY_SETTINGS_VERSION,
  SCRY_SHORTCUT_IDS,
  normalizeScrySettings,
  normalizeShortcutChord,
  shortcutLabel,
} from '../core/settings.js'
import { loadScrySettings, resetScrySettings, saveScrySettings } from '../platform/settings-store.js'

/**
 * @typedef {object} ShortcutSettingsField
 * @property {import('../core/settings.js').ScryShortcutId} id
 * @property {string} label
 * @property {string} value
 */

/**
 * @typedef {object} ShortcutSettingsViewModel
 * @property {ShortcutSettingsField[]} fields
 * @property {string} statusText
 */

export const SHORTCUT_FIELD_LABELS = Object.freeze({
  switchMode: 'Switch history / recently closed',
  moveNext: 'Move to next result',
  movePrevious: 'Move to previous result',
  copySelected: 'Copy selected URL',
  editSelectedUrl: 'Edit selected URL',
  nextPage: 'Next result page',
  previousPage: 'Previous result page',
  openSelected: 'Open selected result',
  leavePanelFocus: 'Close palette',
  removeSelectedFavorite: 'Remove selected favorite',
  undoFavoriteRemoval: 'Undo favorite removal',
})

export function shortcutSettingsViewModel(settings = DEFAULT_SCRY_SETTINGS) {
  const normalized = normalizeScrySettings(settings)

  return {
    fields: SCRY_SHORTCUT_IDS.map((id) => ({
      id,
      label: SHORTCUT_FIELD_LABELS[id] ?? id,
      value: shortcutLabel(normalized, id),
    })),
    statusText: '',
  }
}

function fieldForShortcut(form, id) {
  if (!form) return null
  const elements = form.elements
  const named = typeof elements?.namedItem === 'function'
    ? elements.namedItem(id)
    : elements?.[id]
  return named ?? form.querySelector?.(`[name="${id}"]`) ?? null
}

export function scrySettingsFromShortcutForm(form) {
  const shortcuts = {}

  for (const id of SCRY_SHORTCUT_IDS) {
    const field = fieldForShortcut(form, id)
    const rawValue = field?.value ?? DEFAULT_SCRY_SETTINGS.shortcuts[id]

    try {
      shortcuts[id] = normalizeShortcutChord(rawValue)
    } catch (error) {
      const label = SHORTCUT_FIELD_LABELS[id] ?? id
      const validationError = new Error(`Invalid shortcut for ${label}: ${error.message}`)
      validationError.shortcutId = id
      throw validationError
    }
  }

  return normalizeScrySettings({
    version: SCRY_SETTINGS_VERSION,
    shortcuts,
  })
}

export class ScryOptionsApp {
  constructor({ document, chromeApi = globalThis.chrome } = {}) {
    this.document = document
    this.chromeApi = chromeApi
    this.settings = DEFAULT_SCRY_SETTINGS
    this.shortcutIds = SCRY_SHORTCUT_IDS
    this.form = document?.querySelector?.('#shortcut-settings-form') ?? null
    this.resetButton = document?.querySelector?.('#reset-shortcuts-button') ?? null
    this.status = document?.querySelector?.('#settings-status') ?? null
  }

  async start() {
    this.bindEvents()

    try {
      this.settings = await loadScrySettings({ chromeApi: this.chromeApi })
      this.render()
      this.showStatus('')
    } catch (error) {
      this.settings = DEFAULT_SCRY_SETTINGS
      this.render()
      this.showStatus(`Could not load settings: ${error.message}`)
    }
  }

  bindEvents() {
    this.form?.addEventListener?.('submit', (event) => {
      event.preventDefault()
      void this.saveFromForm()
    })

    this.resetButton?.addEventListener?.('click', (event) => {
      event.preventDefault()
      void this.resetToDefaults()
    })
  }

  render() {
    const model = shortcutSettingsViewModel(this.settings)
    for (const field of model.fields) {
      const input = fieldForShortcut(this.form, field.id)
      if (!input) continue
      input.value = field.value
      input.setAttribute?.('aria-label', field.label)
    }
  }

  async saveFromForm() {
    try {
      const settings = scrySettingsFromShortcutForm(this.form)
      this.settings = await saveScrySettings(settings, { chromeApi: this.chromeApi })
      this.render()
      this.showStatus('Saved settings.')
    } catch (error) {
      this.showStatus(error.message)
    }
  }

  async resetToDefaults() {
    try {
      this.settings = await resetScrySettings({ chromeApi: this.chromeApi })
      this.render()
      this.showStatus('Restored default shortcuts.')
    } catch (error) {
      this.showStatus(`Could not reset settings: ${error.message}`)
    }
  }

  showStatus(text) {
    if (!this.status) return
    this.status.textContent = text
  }
}
