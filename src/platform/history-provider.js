export const DEFAULT_HISTORY_DAYS = 90
export const DEFAULT_HISTORY_LIMIT = 10_000
export const DEEP_HISTORY_LIMIT = 100_000

export async function fetchHistory({ chromeApi = chrome, now = Date.now(), deep = false } = {}) {
  const startTime = deep ? 0 : now - DEFAULT_HISTORY_DAYS * 24 * 60 * 60 * 1000
  const maxResults = deep ? DEEP_HISTORY_LIMIT : DEFAULT_HISTORY_LIMIT
  return chromeApi.history.search({
    text: '',
    startTime,
    maxResults,
  })
}
