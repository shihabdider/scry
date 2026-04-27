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
  const entries = []
  const oldestAllowed = now - CLOSED_SESSION_WINDOW_MS

  const appendTab = (tab, lastVisitTime) => {
    if (!tab || typeof tab.url !== 'string' || tab.url.length === 0) return
    entries.push({
      url: tab.url,
      title: tab.title,
      visitCount: 1,
      lastVisitTime,
    })
  }

  for (const record of recentlyClosed ?? []) {
    if (!record || typeof record.lastModified !== 'number' || !Number.isFinite(record.lastModified)) continue

    const lastVisitTime = record.lastModified * 1_000
    if (lastVisitTime < oldestAllowed || lastVisitTime > now) continue

    appendTab(record.tab, lastVisitTime)

    const windowTabs = record.window?.tabs
    if (!Array.isArray(windowTabs)) continue
    for (const tab of windowTabs) appendTab(tab, lastVisitTime)
  }

  return entries
}
