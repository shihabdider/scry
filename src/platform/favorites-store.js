import {
  favoriteFromSaveTarget,
  removeFavoriteByKey,
  restoreRemovedFavorite,
  upsertFavoriteUrl,
} from '../core/favorites.js'

export const FAVORITES_STORAGE_KEY = 'scryFavorites'

/**
 * A FavoritesStorageSlot is an object:
 * - [FAVORITES_STORAGE_KEY]: StoredFavorites | undefined
 *
 * Interpretation:
 * Represents the chrome.storage.local shape used by Scry favorites. The value is local-only
 * extension storage shared by the popup and background service worker.
 *
 * Examples:
 * - {} represents a profile with no favorites stored yet.
 * - { scryFavorites: [] } represents an explicitly empty favorites list.
 * - { scryFavorites: [exampleFavorite, olderFavorite] } represents two locally stored favorites ordered newest first.
 *
 * @typedef {object} FavoritesStorageSlot
 * @property {import('../core/favorites.js').StoredFavorites | undefined} [scryFavorites] Stored favorites array.
 */

/**
 * A FavoriteStorageWrite is an object:
 * - [FAVORITES_STORAGE_KEY]: StoredFavorites
 *
 * Interpretation:
 * Represents the exact local storage write Scry performs after adding, removing, or undoing a
 * favorites removal.
 *
 * Examples:
 * - { scryFavorites: [] } clears stored favorites.
 * - { scryFavorites: [exampleFavorite] } persists a one-item favorites list.
 *
 * @typedef {object} FavoriteStorageWrite
 * @property {import('../core/favorites.js').StoredFavorites} scryFavorites Favorites list to write.
 */

/**
 * { chromeApi?: object } -> Promise<import('../core/favorites.js').StoredFavorites>
 *
 * Loads the local favorites list from chrome.storage.local, treating a missing or malformed storage
 * slot as an empty StoredFavorites list.
 *
 * Functional Examples:
 * - loadStoredFavorites({ chromeApi: storageWith({}) }) should resolve to [].
 * - loadStoredFavorites({ chromeApi: storageWith({ scryFavorites: [exampleFavorite] }) }) should resolve to [exampleFavorite].
 * - loadStoredFavorites({ chromeApi: storageWith({ scryFavorites: "not a list" }) }) should resolve to [].
 *
 * Template:
 * Follow FavoritesStorageSlot as optional data:
 * - read FAVORITES_STORAGE_KEY from chrome.storage.local
 * - when the value is an array, return it as StoredFavorites
 * - otherwise return []
 */
export async function loadStoredFavorites({ chromeApi = chrome } = {}) {
  const result = await chromeApi.storage.local.get(FAVORITES_STORAGE_KEY)
  const favorites = result?.[FAVORITES_STORAGE_KEY]

  return Array.isArray(favorites) ? favorites : []
}

/**
 * StoredFavorites { chromeApi?: object } -> Promise<void>
 *
 * Persists the complete local favorites list to chrome.storage.local under Scry's favorites key.
 *
 * Functional Examples:
 * - saveStoredFavorites([], { chromeApi }) should write { scryFavorites: [] } to chrome.storage.local.
 * - saveStoredFavorites([exampleFavorite], { chromeApi }) should write { scryFavorites: [exampleFavorite] } to chrome.storage.local.
 *
 * Template:
 * Use the compound FavoriteStorageWrite shape:
 * - build { [FAVORITES_STORAGE_KEY]: favorites }
 * - call chrome.storage.local.set with that object
 */
export async function saveStoredFavorites(favorites, { chromeApi = chrome } = {}) {
  await chromeApi.storage.local.set({ [FAVORITES_STORAGE_KEY]: favorites })
}

/**
 * FavoriteSaveTarget { chromeApi?: object, now?: number } -> Promise<import('../core/favorites.js').FavoriteUrl | null>
 *
 * Saves a URL-bearing target into local extension storage, updating duplicate favorites and moving
 * the saved URL to the top of StoredFavorites recency order.
 *
 * Functional Examples:
 * - saveFavoriteTarget(tabTarget, { chromeApi: storageWith({}), now: 2_000 }) should persist [favoriteFromSaveTarget(tabTarget, { now: 2_000 })] and resolve to that favorite.
 * - saveFavoriteTarget(refreshedTarget, { chromeApi: storageWith({ scryFavorites: [previousExampleFavorite, olderFavorite] }), now: 5_000 }) should preserve previousExampleFavorite.addedAt, refresh metadata/updatedAt, move it to index 0, and resolve to the refreshed favorite.
 * - saveFavoriteTarget(invalidTarget, { chromeApi: storageWith({ scryFavorites: [exampleFavorite] }), now: 6_000 }) should leave storage unchanged and resolve to null.
 *
 * Template:
 * Compose storage and pure favorites helpers:
 * - loadStoredFavorites
 * - favoriteFromSaveTarget(target, { now })
 * - when null, return null without writing
 * - upsertFavoriteUrl
 * - saveStoredFavorites
 */
export async function saveFavoriteTarget(target, { chromeApi = chrome, now = Date.now() } = {}) {
  const favorites = await loadStoredFavorites({ chromeApi })
  const favorite = favoriteFromSaveTarget(target, { now })
  if (!favorite) return null

  const nextFavorites = upsertFavoriteUrl(favorites, favorite)
  await saveStoredFavorites(nextFavorites, { chromeApi })
  return nextFavorites[0]
}

/**
 * string { chromeApi?: object } -> Promise<import('../core/favorites.js').FavoriteRemovalResult>
 *
 * Removes the selected favorite key from local extension storage and returns a one-level popup
 * session undo payload when removal succeeds.
 *
 * Functional Examples:
 * - removeStoredFavoriteByKey(exampleFavorite.key, { chromeApi: storageWith({ scryFavorites: [exampleFavorite] }) }) should persist [] and resolve to { favorites: [], undo: { favorite: exampleFavorite, index: 0 } }.
 * - removeStoredFavoriteByKey("missing", { chromeApi: storageWith({ scryFavorites: [exampleFavorite] }) }) should leave storage unchanged and resolve to { favorites: [exampleFavorite], undo: null }.
 * - removeStoredFavoriteByKey("missing", { chromeApi: storageWith({}) }) should resolve to { favorites: [], undo: null }.
 *
 * Template:
 * Compose storage and pure removal helpers:
 * - loadStoredFavorites
 * - removeFavoriteByKey(favorites, key)
 * - when undo is present, saveStoredFavorites(result.favorites)
 * - return the FavoriteRemovalResult
 */
export async function removeStoredFavoriteByKey(key, { chromeApi = chrome } = {}) {
  const favorites = await loadStoredFavorites({ chromeApi })
  const result = removeFavoriteByKey(favorites, key)

  if (result.undo) {
    await saveStoredFavorites(result.favorites, { chromeApi })
  }

  return result
}

/**
 * FavoriteRemovalUndo { chromeApi?: object } -> Promise<import('../core/favorites.js').FavoriteUndoResult>
 *
 * Restores the most recently removed favorite for the current popup session and consumes the undo
 * slot whether or not a restore occurs.
 *
 * Functional Examples:
 * - restoreStoredFavoriteRemoval(null, { chromeApi: storageWith({ scryFavorites: [] }) }) should leave storage unchanged and resolve to { favorites: [], undo: null }.
 * - restoreStoredFavoriteRemoval({ favorite: exampleFavorite, index: 0 }, { chromeApi: storageWith({ scryFavorites: [olderFavorite] }) }) should persist [exampleFavorite, olderFavorite] and resolve to { favorites: [exampleFavorite, olderFavorite], undo: null }.
 *
 * Template:
 * Compose storage and pure undo helpers:
 * - loadStoredFavorites
 * - restoreRemovedFavorite(favorites, undo)
 * - when undo is present, saveStoredFavorites(result.favorites)
 * - return the FavoriteUndoResult
 */
export async function restoreStoredFavoriteRemoval(undo, { chromeApi = chrome } = {}) {
  const favorites = await loadStoredFavorites({ chromeApi })
  const result = restoreRemovedFavorite(favorites, undo)

  if (undo) {
    await saveStoredFavorites(result.favorites, { chromeApi })
  }

  return result
}
