export async function openUrl(url, { chromeApi = chrome, newTab = false } = {}) {
  if (newTab) {
    await chromeApi.tabs.create({ url, active: true })
    return
  }

  const [activeTab] = await chromeApi.tabs.query({ active: true, lastFocusedWindow: true })
  if (activeTab?.id != null) {
    await chromeApi.tabs.update(activeTab.id, { url })
    return
  }

  await chromeApi.tabs.create({ url, active: true })
}
