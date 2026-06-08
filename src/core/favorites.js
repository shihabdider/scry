import { buildHistoryIndex } from './search.js'
import { normalizeHistoryUrl } from './url.js'

/**
 * A FavoriteSource is one of:
 * - "tab"
 * - "page"
 * - "link"
 * - "image"
 * - "video"
 * - "audio"
 * - "frame"
 *
 * Interpretation:
 * Describes the local Chrome surface that supplied a URL-bearing favorite target. "tab" comes
 * from the unbound extension command; the other variants come from the context menu.
 *
 * Examples:
 * - "tab" represents saving the current active tab.
 * - "link" represents saving the URL behind a right-clicked link.
 * - "image" represents saving the URL of a right-clicked image.
 *
 * @typedef {'tab'|'page'|'link'|'image'|'video'|'audio'|'frame'} FavoriteSource
 */

/**
 * A FavoriteSaveTarget is an object:
 * - url: string
 * - title: string | undefined
 * - source: FavoriteSource
 *
 * Interpretation:
 * Represents a local, URL-bearing page or context-menu target before Scry normalizes it for
 * storage. The source records where the URL came from, while the title is best-effort metadata
 * from Chrome or the surrounding tab.
 *
 * Examples:
 * - { url: "https://example.com/docs", title: "Example docs", source: "tab" } saves the active tab.
 * - { url: "https://cdn.example.com/image.png", title: "Example page", source: "image" } saves an image URL with page title fallback.
 * - { url: "https://media.example.com/clip.mp4", title: "Demo clip", source: "video" } saves a video target.
 *
 * @typedef {object} FavoriteSaveTarget
 * @property {string} url URL supplied by the current tab or context menu.
 * @property {string | undefined} title Best-effort title from the tab/page/target.
 * @property {FavoriteSource} source Local Chrome surface that supplied this URL.
 */

/**
 * A FavoriteUrl is an object:
 * - key: string
 * - url: string
 * - displayUrl: string
 * - title: string
 * - addedAt: number
 * - updatedAt: number
 *
 * Interpretation:
 * Represents one locally saved favorite URL. The key is Scry's normalized URL key and is unique
 * within StoredFavorites; url is the normalized navigable URL; displayUrl is the user-facing URL
 * text; title is best-effort metadata; addedAt preserves the first save time; updatedAt records
 * the most recent save/update time and drives favorites recency ordering.
 *
 * Examples:
 * - { key: "https://example.com/docs", url: "https://example.com/docs", displayUrl: "example.com/docs", title: "Example docs", addedAt: 1_000, updatedAt: 1_000 } represents a URL saved once.
 * - { key: "https://example.com/docs", url: "https://example.com/docs", displayUrl: "example.com/docs", title: "Example docs updated", addedAt: 1_000, updatedAt: 5_000 } represents the same URL after a duplicate save refreshed metadata and moved it to the top.
 * - { key: "file:///Users/me/notes.html", url: "file:///Users/me/notes.html", displayUrl: "/Users/me/notes.html", title: "Local notes", addedAt: 2_000, updatedAt: 2_000 } represents a local file favorite when Chrome supplies one.
 *
 * @typedef {object} FavoriteUrl
 * @property {string} key Unique normalized URL key.
 * @property {string} url Normalized navigable URL.
 * @property {string} displayUrl Display URL used in search results.
 * @property {string} title Best-effort page/target title, falling back to displayUrl.
 * @property {number} addedAt Millisecond timestamp for the first save.
 * @property {number} updatedAt Millisecond timestamp for the latest save/update.
 */

/**
 * A StoredFavorites is a FavoriteUrl[].
 *
 * Interpretation:
 * Represents the complete local favorites list stored under Scry's chrome.storage.local key.
 * The array is ordered by local favorites recency: index 0 is the most recently added or updated
 * favorite, duplicate saves keep the original addedAt and move the refreshed favorite to index 0,
 * and all keys are unique.
 *
 * Examples:
 * - [] represents no saved favorites.
 * - [exampleFavorite] represents one saved favorite.
 * - [newerFavorite, olderFavorite] represents multiple favorites ordered newest first.
 *
 * @typedef {FavoriteUrl[]} StoredFavorites
 */

/**
 * A FavoriteRemovalUndo is one of:
 * - null
 * - { favorite: FavoriteUrl, index: number }
 *
 * Interpretation:
 * Represents one-level popup-session undo for favorites removal. null means there is no removal
 * to undo; a present value remembers the removed favorite and its previous list index so undo can
 * restore the same metadata near the same position during the current popup session.
 *
 * Examples:
 * - null represents no available undo.
 * - { favorite: exampleFavorite, index: 1 } represents a favorite removed from the second row.
 *
 * @typedef {{ favorite: FavoriteUrl, index: number } | null} FavoriteRemovalUndo
 */

/**
 * A FavoriteRemovalResult is an object:
 * - favorites: StoredFavorites
 * - undo: FavoriteRemovalUndo
 *
 * Interpretation:
 * Represents the pure result of trying to remove a favorite. favorites is the next stored list;
 * undo is present only when a favorite was actually removed.
 *
 * Examples:
 * - { favorites: [], undo: null } represents removing from an empty list.
 * - { favorites: [olderFavorite], undo: { favorite: newerFavorite, index: 0 } } represents removing the first favorite.
 *
 * @typedef {object} FavoriteRemovalResult
 * @property {StoredFavorites} favorites Next favorites list.
 * @property {FavoriteRemovalUndo} undo One-level undo payload for this popup session.
 */

/**
 * A FavoriteUndoResult is an object:
 * - favorites: StoredFavorites
 * - undo: null
 *
 * Interpretation:
 * Represents the pure result of trying to restore a removed favorite. undo is always consumed so
 * the popup keeps exactly one level of removal undo.
 *
 * Examples:
 * - { favorites: [], undo: null } represents undo with no saved removal.
 * - { favorites: [restoredFavorite, otherFavorite], undo: null } represents a restored removal.
 *
 * @typedef {object} FavoriteUndoResult
 * @property {StoredFavorites} favorites Next favorites list.
 * @property {null} undo Consumed undo slot.
 */

/**
 * FavoriteSaveTarget { now: number } -> FavoriteUrl | null
 *
 * Produces a normalized FavoriteUrl from a URL-bearing save target, or null when the target is not
 * eligible under Scry's existing URL normalization/opening rules.
 *
 * Functional Examples:
 * - favoriteFromSaveTarget({ url: "https://Example.com/docs/?utm_source=news#intro", title: "Example Docs", source: "tab" }, { now: 2_000 }) should produce { key: "https://example.com/docs", url: "https://example.com/docs", displayUrl: "example.com/docs", title: "Example Docs", addedAt: 2_000, updatedAt: 2_000 }.
 * - favoriteFromSaveTarget({ url: "https://cdn.example.com/image.png", title: "", source: "image" }, { now: 3_000 }) should produce a favorite whose title falls back to "cdn.example.com/image.png".
 * - favoriteFromSaveTarget({ url: "", title: "Missing URL", source: "page" }, { now: 4_000 }) should produce null.
 *
 * Template:
 * Use the FavoriteSaveTarget fields:
 * - normalize target.url with normalizeHistoryUrl
 * - when normalization is absent, produce null
 * - when normalization is present, combine normalized key/url/displayUrl with title fallback and now for addedAt/updatedAt
 */
export function favoriteFromSaveTarget(target, { now = Date.now() } = {}) {
  const normalized = normalizeHistoryUrl(target?.url)
  if (!normalized) return null

  const titleText = typeof target?.title === 'string' ? target.title.trim() : ''
  const title = titleText || normalized.displayUrl

  return {
    key: normalized.key,
    url: normalized.url,
    displayUrl: normalized.displayUrl,
    title,
    addedAt: now,
    updatedAt: now,
  }
}

/**
 * StoredFavorites FavoriteUrl -> StoredFavorites
 *
 * Produces the next favorites list after adding or refreshing one favorite, preserving unique keys
 * and moving the added/refreshed favorite to the top of local recency order.
 *
 * Functional Examples:
 * - upsertFavoriteUrl([], exampleFavorite) should produce [exampleFavorite].
 * - upsertFavoriteUrl([olderFavorite], newerFavorite) should produce [newerFavorite, olderFavorite] when the keys differ.
 * - upsertFavoriteUrl([olderFavorite, previousExampleFavorite], refreshedExampleFavorite) should produce [refreshedExampleFavoriteWithPreviousAddedAt, olderFavorite] when the example keys match.
 *
 * Template:
 * Follow the collection structure of StoredFavorites:
 * - for the empty list, return a singleton list
 * - for each existing favorite, branch on matching key vs different key
 * - preserve the matching favorite's addedAt, use the new favorite's metadata/updatedAt, and keep all non-matching favorites in order
 */
export function upsertFavoriteUrl(favorites, favorite) {
  const list = Array.isArray(favorites) ? favorites : []
  const existing = list.find((storedFavorite) => storedFavorite?.key === favorite.key)
  const nextFavorite = existing ? { ...favorite, addedAt: existing.addedAt } : favorite

  return [
    nextFavorite,
    ...list.filter((storedFavorite) => storedFavorite?.key !== favorite.key),
  ]
}

/**
 * StoredFavorites string -> FavoriteRemovalResult
 *
 * Produces the next favorites list and one-level undo payload after removing the favorite with the
 * selected normalized key.
 *
 * Functional Examples:
 * - removeFavoriteByKey([], "https://example.com/docs") should produce { favorites: [], undo: null }.
 * - removeFavoriteByKey([exampleFavorite], exampleFavorite.key) should produce { favorites: [], undo: { favorite: exampleFavorite, index: 0 } }.
 * - removeFavoriteByKey([newerFavorite, olderFavorite], olderFavorite.key) should produce { favorites: [newerFavorite], undo: { favorite: olderFavorite, index: 1 } }.
 * - removeFavoriteByKey([exampleFavorite], "https://missing.example/") should produce { favorites: [exampleFavorite], undo: null }.
 *
 * Template:
 * Follow the collection structure of StoredFavorites:
 * - if empty, produce unchanged favorites and null undo
 * - otherwise inspect each favorite.key
 * - when the selected key is found, remove that item and remember { favorite, index }
 * - when no key is found, produce unchanged favorites and null undo
 */
export function removeFavoriteByKey(favorites, key) {
  const list = Array.isArray(favorites) ? favorites : []
  const index = list.findIndex((favorite) => favorite?.key === key)

  if (index === -1) {
    return { favorites: list, undo: null }
  }

  return {
    favorites: [...list.slice(0, index), ...list.slice(index + 1)],
    undo: { favorite: list[index], index },
  }
}

/**
 * StoredFavorites FavoriteRemovalUndo -> FavoriteUndoResult
 *
 * Produces the next favorites list after consuming one popup-session favorites removal undo.
 *
 * Functional Examples:
 * - restoreRemovedFavorite([], null) should produce { favorites: [], undo: null }.
 * - restoreRemovedFavorite([olderFavorite], { favorite: newerFavorite, index: 0 }) should produce { favorites: [newerFavorite, olderFavorite], undo: null }.
 * - restoreRemovedFavorite([newerFavorite], { favorite: olderFavorite, index: 9 }) should produce { favorites: [newerFavorite, olderFavorite], undo: null } by clamping an out-of-range restore index to the end.
 *
 * Template:
 * Follow the FavoriteRemovalUndo variants:
 * - when undo is null, return unchanged favorites and null undo
 * - when undo is present, use undo.favorite and undo.index, then insert into the StoredFavorites collection while preserving unique keys
 */
export function restoreRemovedFavorite(favorites, undo) {
  const list = Array.isArray(favorites) ? favorites : []
  if (!undo) return { favorites: list, undo: null }

  const favorite = undo.favorite
  const dedupedFavorites = list.filter((storedFavorite) => storedFavorite?.key !== favorite.key)
  const requestedIndex = Number.isFinite(undo.index) ? Math.trunc(undo.index) : dedupedFavorites.length
  const restoreIndex = Math.min(Math.max(requestedIndex, 0), dedupedFavorites.length)

  return {
    favorites: [
      ...dedupedFavorites.slice(0, restoreIndex),
      favorite,
      ...dedupedFavorites.slice(restoreIndex),
    ],
    undo: null,
  }
}

/**
 * StoredFavorites -> object[]
 *
 * Produces history-like raw entries from stored favorites so Scry can reuse buildHistoryIndex and
 * searchHistory for favorites URL recall, with lastVisitTime based on favorite updatedAt.
 *
 * Functional Examples:
 * - favoritesToHistoryEntries([]) should produce [].
 * - favoritesToHistoryEntries([exampleFavorite]) should produce [{ url: exampleFavorite.url, title: exampleFavorite.title, visitCount: 1, lastVisitTime: exampleFavorite.updatedAt }].
 * - favoritesToHistoryEntries([newerFavorite, olderFavorite]) should produce two raw entries in the same order, each with visitCount 1 and lastVisitTime from updatedAt.
 *
 * Template:
 * Follow the collection structure of StoredFavorites:
 * - for each FavoriteUrl, access url, title, and updatedAt
 * - build a history-like entry for buildHistoryIndex
 */
export function favoritesToHistoryEntries(favorites) {
  const list = Array.isArray(favorites) ? favorites : []

  return list.map((favorite) => ({
    url: favorite.url,
    title: favorite.title,
    visitCount: 1,
    lastVisitTime: favorite.updatedAt,
  }))
}

/**
 * StoredFavorites { now: number } -> import('./search.js').HistoryIndex
 *
 * Produces a searchable favorites index by converting stored favorites into history-like entries
 * and passing them through Scry's existing history index builder.
 *
 * Functional Examples:
 * - buildFavoritesIndex([], { now: 10_000 }) should produce { builtAt: 10_000, entries: [] }.
 * - buildFavoritesIndex([exampleFavorite], { now: 10_000 }) should produce an index containing one entry with key exampleFavorite.key, title exampleFavorite.title, and lastVisitTime exampleFavorite.updatedAt.
 * - buildFavoritesIndex([newerFavorite, olderFavorite], { now: 10_000 }) should produce an index searchable by both favorites' URL fragments and titles.
 *
 * Template:
 * Compose helpers:
 * - call favoritesToHistoryEntries(favorites)
 * - call buildHistoryIndex(historyLikeEntries, { now })
 */
export function buildFavoritesIndex(favorites, { now = Date.now() } = {}) {
  return buildHistoryIndex(favoritesToHistoryEntries(favorites), { now })
}
