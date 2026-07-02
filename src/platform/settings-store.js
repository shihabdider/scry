import { DEFAULT_SCRY_SETTINGS, SCRY_SETTINGS_STORAGE_KEY, normalizeScrySettings } from '../core/settings.js'

/**
 * @typedef {{ [key: string]: import('../core/settings.js').ScrySettings | undefined }} ScrySettingsStorageSlot
 */

export async function loadScrySettings({ chromeApi = chrome } = {}) {
  const result = await chromeApi.storage.local.get(SCRY_SETTINGS_STORAGE_KEY)
  return normalizeScrySettings(result?.[SCRY_SETTINGS_STORAGE_KEY])
}

export async function saveScrySettings(settings, { chromeApi = chrome } = {}) {
  const normalized = normalizeScrySettings(settings)
  await chromeApi.storage.local.set(scrySettingsStorageWrite(normalized))
  return normalized
}

export async function resetScrySettings({ chromeApi = chrome } = {}) {
  return saveScrySettings(DEFAULT_SCRY_SETTINGS, { chromeApi })
}

export function watchScrySettings(listener, { chromeApi = chrome } = {}) {
  const changesApi = chromeApi?.storage?.onChanged
  if (typeof changesApi?.addListener !== 'function') return () => {}

  const handleChange = (changes, areaName) => {
    if (areaName !== 'local') return
    if (!Object.hasOwn(changes ?? {}, SCRY_SETTINGS_STORAGE_KEY)) return

    listener(normalizeScrySettings(changes[SCRY_SETTINGS_STORAGE_KEY]?.newValue))
  }

  changesApi.addListener(handleChange)

  return () => {
    changesApi.removeListener?.(handleChange)
  }
}

export function scrySettingsStorageWrite(settings) {
  return {
    [SCRY_SETTINGS_STORAGE_KEY]: normalizeScrySettings(settings),
  }
}

export { SCRY_SETTINGS_STORAGE_KEY }
