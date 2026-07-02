import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_SCRY_SETTINGS, SCRY_SETTINGS_STORAGE_KEY } from '../src/core/settings.js'
import { loadScrySettings, resetScrySettings, saveScrySettings, scrySettingsStorageWrite, watchScrySettings } from '../src/platform/settings-store.js'

function settingsChrome(slot = {}) {
  const getKeys = []
  const writes = []
  const listeners = []
  return {
    getKeys,
    writes,
    listeners,
    chromeApi: {
      storage: {
        local: {
          async get(key) {
            getKeys.push(key)
            return { [key]: slot[key] }
          },
          async set(value) {
            writes.push(value)
            Object.assign(slot, value)
          },
        },
        onChanged: {
          addListener(listener) {
            listeners.push(listener)
          },
          removeListener(listener) {
            const index = listeners.indexOf(listener)
            if (index >= 0) listeners.splice(index, 1)
          },
        },
      },
    },
  }
}

test('loadScrySettings reads local settings and defaults missing storage', async () => {
  const storage = settingsChrome({})

  assert.deepEqual(await loadScrySettings({ chromeApi: storage.chromeApi }), DEFAULT_SCRY_SETTINGS)
  assert.deepEqual(storage.getKeys, [SCRY_SETTINGS_STORAGE_KEY])
})

test('saveScrySettings writes normalized settings under the Scry settings key', async () => {
  const storage = settingsChrome({})

  const saved = await saveScrySettings({ version: 1, shortcuts: { switchMode: 'alt + m' } }, { chromeApi: storage.chromeApi })

  assert.equal(saved.shortcuts.switchMode, 'Alt+M')
  assert.deepEqual(storage.writes, [{ [SCRY_SETTINGS_STORAGE_KEY]: saved }])
})

test('resetScrySettings overwrites custom settings with defaults', async () => {
  const storage = settingsChrome({ [SCRY_SETTINGS_STORAGE_KEY]: { version: 1, shortcuts: { switchMode: 'Alt+M' } } })

  const reset = await resetScrySettings({ chromeApi: storage.chromeApi })

  assert.deepEqual(reset, DEFAULT_SCRY_SETTINGS)
  assert.deepEqual(storage.writes, [{ [SCRY_SETTINGS_STORAGE_KEY]: DEFAULT_SCRY_SETTINGS }])
})

test('scrySettingsStorageWrite normalizes the stored settings shape', () => {
  assert.deepEqual(scrySettingsStorageWrite({ version: 1, shortcuts: { copySelected: 'alt + c' } }), {
    [SCRY_SETTINGS_STORAGE_KEY]: {
      ...DEFAULT_SCRY_SETTINGS,
      shortcuts: {
        ...DEFAULT_SCRY_SETTINGS.shortcuts,
        copySelected: 'Alt+C',
      },
    },
  })
})

test('watchScrySettings reports local settings changes and ignores unrelated changes', () => {
  const storage = settingsChrome({})
  const observed = []

  const unwatch = watchScrySettings((settings) => observed.push(settings), { chromeApi: storage.chromeApi })

  storage.listeners[0]({ other: { newValue: 1 } }, 'local')
  storage.listeners[0]({ [SCRY_SETTINGS_STORAGE_KEY]: { newValue: { version: 1, shortcuts: { switchMode: 'Alt+M' } } } }, 'sync')
  storage.listeners[0]({ [SCRY_SETTINGS_STORAGE_KEY]: { newValue: { version: 1, shortcuts: { switchMode: 'Alt+M' } } } }, 'local')

  assert.equal(observed.length, 1)
  assert.equal(observed[0].shortcuts.switchMode, 'Alt+M')

  unwatch()
  assert.equal(storage.listeners.length, 0)
})
