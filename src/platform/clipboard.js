export async function writeClipboardText(text, { navigatorApi = globalThis.navigator } = {}) {
  const writeText = navigatorApi?.clipboard?.writeText
  if (typeof writeText !== 'function') {
    throw new Error('Clipboard API unavailable: navigator.clipboard.writeText is not available')
  }

  return writeText.call(navigatorApi.clipboard, text)
}
