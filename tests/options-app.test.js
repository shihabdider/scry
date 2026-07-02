import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_SCRY_SETTINGS, SCRY_SHORTCUT_IDS } from '../src/core/settings.js'
import { SHORTCUT_FIELD_LABELS, ScryOptionsApp, scrySettingsFromShortcutForm, shortcutSettingsViewModel } from '../src/options/app.js'
import { SCRY_SETTINGS_STORAGE_KEY } from '../src/platform/settings-store.js'

function shortcutForm(values = {}) {
  const elements = {}
  for (const id of SCRY_SHORTCUT_IDS) {
    elements[id] = {
      value: values[id] ?? DEFAULT_SCRY_SETTINGS.shortcuts[id],
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = String(value)
      },
    }
  }

  return {
    elements,
    listeners: {},
    addEventListener(type, listener) {
      this.listeners[type] = listener
    },
  }
}

function optionsDocument(form = shortcutForm()) {
  const resetButton = {
    listeners: {},
    addEventListener(type, listener) {
      this.listeners[type] = listener
    },
  }
  const status = { textContent: '' }

  return {
    form,
    resetButton,
    status,
    querySelector(selector) {
      if (selector === '#shortcut-settings-form') return form
      if (selector === '#reset-shortcuts-button') return resetButton
      if (selector === '#settings-status') return status
      return null
    },
  }
}

function optionsChrome(slot = {}) {
  const writes = []
  return {
    writes,
    chromeApi: {
      storage: {
        local: {
          async get(key) {
            return { [key]: slot[key] }
          },
          async set(value) {
            writes.push(value)
            Object.assign(slot, value)
          },
        },
      },
    },
  }
}

test('shortcutSettingsViewModel lists every shortcut field with normalized labels', () => {
  const model = shortcutSettingsViewModel({ version: 1, shortcuts: { switchMode: 'alt + m' } })

  assert.deepEqual(model.fields.map((field) => field.id), SCRY_SHORTCUT_IDS)
  assert.equal(model.fields.find((field) => field.id === 'switchMode')?.label, SHORTCUT_FIELD_LABELS.switchMode)
  assert.equal(model.fields.find((field) => field.id === 'switchMode')?.value, 'Alt+M')
  assert.equal(model.fields.find((field) => field.id === 'copySelected')?.value, 'Ctrl+Y')
})

test('scrySettingsFromShortcutForm converts form values into normalized settings', () => {
  const form = shortcutForm({ switchMode: 'alt + m', copySelected: 'c' })
  const settings = scrySettingsFromShortcutForm(form)

  assert.equal(settings.shortcuts.switchMode, 'Alt+M')
  assert.equal(settings.shortcuts.copySelected, 'c')
  assert.equal(settings.shortcuts.nextPage, 'Ctrl+D')
})

test('scrySettingsFromShortcutForm reports invalid shortcut fields', () => {
  const form = shortcutForm({ copySelected: 'Ctrl+Banana' })

  assert.throws(() => scrySettingsFromShortcutForm(form), (error) => {
    assert.equal(error.shortcutId, 'copySelected')
    assert.match(error.message, /Copy selected URL/i)
    return true
  })
})

test('ScryOptionsApp loads, saves, and resets local settings', async () => {
  const form = shortcutForm()
  const document = optionsDocument(form)
  const storage = optionsChrome({ [SCRY_SETTINGS_STORAGE_KEY]: { version: 1, shortcuts: { switchMode: 'Alt+M' } } })
  const app = new ScryOptionsApp({ document, chromeApi: storage.chromeApi })

  await app.start()
  assert.equal(form.elements.switchMode.value, 'Alt+M')

  form.elements.copySelected.value = 'Alt+C'
  await app.saveFromForm()
  assert.equal(storage.writes.at(-1)[SCRY_SETTINGS_STORAGE_KEY].shortcuts.copySelected, 'Alt+C')
  assert.equal(document.status.textContent, 'Saved settings.')

  await app.resetToDefaults()
  assert.deepEqual(storage.writes.at(-1), { [SCRY_SETTINGS_STORAGE_KEY]: DEFAULT_SCRY_SETTINGS })
  assert.equal(form.elements.switchMode.value, 'Ctrl+Q')
  assert.equal(document.status.textContent, 'Restored default shortcuts.')
})
