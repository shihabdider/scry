export const CLOSED_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * @typedef {object} ClosedSessionTab
 * @property {string | undefined} url Chrome tab URL, when available.
 * @property {string | undefined} title Chrome tab title, when available.
 * @property {number | undefined} lastModified Top-level closed-session timestamp in seconds.
 */

/**
 * @typedef {object} ClosedSessionWindow
 * @property {ClosedSessionTab[] | undefined} tabs Tabs contained by a recently closed window record.
 * @property {number | undefined} lastModified Top-level closed-session timestamp in seconds.
 */

/**
 * @typedef {object} ClosedSessionRecord
 * @property {ClosedSessionTab | undefined} tab Standalone recently closed tab record.
 * @property {ClosedSessionWindow | undefined} window Recently closed window record.
 * @property {number | undefined} lastModified Top-level closed-session timestamp in seconds.
 */

export async function fetchRecentlyClosed({ chromeApi = chrome } = {}) {
  return chromeApi.sessions.getRecentlyClosed()
}

export function flattenClosedSessions(recentlyClosed, { now = Date.now() } = {}) {
  throw new Error('not implemented: flattenClosedSessions')
}
