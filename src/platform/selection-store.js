import { normalizeSelectionData } from '../core/selection-learning.js'

export const SELECTION_STORAGE_KEY = 'scry.selectionData'

export async function loadSelectionData({ chromeApi = chrome } = {}) {
  const result = await chromeApi.storage.local.get(SELECTION_STORAGE_KEY)
  return normalizeSelectionData(result?.[SELECTION_STORAGE_KEY])
}

export async function saveSelectionData(data, { chromeApi = chrome } = {}) {
  await chromeApi.storage.local.set({ [SELECTION_STORAGE_KEY]: normalizeSelectionData(data) })
}
