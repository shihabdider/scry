const SIDE_PANEL_PATH = 'side-panel.html'
const openWindowIds = new Set()

async function configureSidePanel() {
  if (!chrome.sidePanel) return
  try {
    await chrome.sidePanel.setOptions({ path: SIDE_PANEL_PATH, enabled: true })
  } catch (error) {
    console.warn('Scry could not configure side panel options', error)
  }

  if (chrome.sidePanel.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
    } catch (error) {
      console.warn('Scry could not configure side panel action behavior', error)
    }
  }
}

async function getLastFocusedWindowId() {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (activeTab?.windowId != null) return activeTab.windowId

  const currentWindow = await chrome.windows.getLastFocused()
  return currentWindow.id
}

async function toggleSidePanel(windowId) {
  if (!chrome.sidePanel?.open) return
  const targetWindowId = windowId ?? (await getLastFocusedWindowId())

  if (openWindowIds.has(targetWindowId) && chrome.sidePanel.close) {
    try {
      await chrome.sidePanel.close({ windowId: targetWindowId })
      openWindowIds.delete(targetWindowId)
      return
    } catch (error) {
      console.warn('Scry could not close side panel; opening instead', error)
    }
  }

  await chrome.sidePanel.open({ windowId: targetWindowId })
  openWindowIds.add(targetWindowId)
}

chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanel()
})

chrome.runtime.onStartup?.addListener(() => {
  void configureSidePanel()
})

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-scry') void toggleSidePanel()
})

chrome.action.onClicked.addListener((tab) => {
  void toggleSidePanel(tab.windowId)
})

chrome.sidePanel?.onOpened?.addListener((info) => {
  openWindowIds.add(info.windowId)
})

chrome.sidePanel?.onClosed?.addListener((info) => {
  openWindowIds.delete(info.windowId)
})
