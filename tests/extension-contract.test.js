import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

test('manifest exposes a Chrome popup command palette for history and closed-session recall', async () => {
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'))

  assert.equal(manifest.manifest_version, 3)
  assert.equal('minimum_chrome_version' in manifest, false)
  assert.equal(manifest.action.default_popup, 'popup.html')
  assert.equal(manifest.commands._execute_action.suggested_key.default, 'Ctrl+K')
  assert.equal(manifest.commands._execute_action.suggested_key.mac, 'Command+K')
  assert.equal(manifest.commands['save-current-tab-as-favorite'].suggested_key.default, 'Alt+Shift+F')
  assert.equal(manifest.commands['save-current-tab-as-favorite'].suggested_key.mac, 'Alt+Shift+F')
  assert.equal(manifest.permissions.every((permission) => typeof permission === 'string'), true)
  assert.deepEqual([...manifest.permissions].sort(), ['contextMenus', 'history', 'sessions', 'storage', 'tabs'].sort())
  assert.equal('side_panel' in manifest, false)
  assert.equal('host_permissions' in manifest, false)
  assert.equal('content_scripts' in manifest, false)
  assert.equal('options_page' in manifest, false)
})

test('manifest references generated extension icon assets at Chrome sizes', async () => {
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'))
  const expectedIconPaths = {
    16: 'icons/scry-16.png',
    32: 'icons/scry-32.png',
    48: 'icons/scry-48.png',
    128: 'icons/scry-128.png',
  }

  for (const [label, iconMap] of [
    ['manifest.icons', manifest.icons],
    ['manifest.action.default_icon', manifest.action.default_icon],
  ]) {
    assert.deepEqual(iconMap, expectedIconPaths, `${label} should use the generated Scry icon assets`)

    for (const [size, path] of Object.entries(iconMap)) {
      const png = await readFile(path)
      const dimensions = pngInfo(png)
      const expectedSize = Number(size)

      assert.equal(dimensions.width, expectedSize, `${path} width`)
      assert.equal(dimensions.height, expectedSize, `${path} height`)
      assert.equal(dimensions.colorType, 6, `${path} should be RGBA`)
    }
  }
})

test('popup exposes a clickable history/closed corpus badge without a visible legacy deep-search fallback', async () => {
  const html = await readFile('popup.html', 'utf8')
  const modeIndicator = tagWithId(html, 'mode-indicator')
  const deepSearchButton = tagWithId(html, 'deep-search-button')

  assert.match(modeIndicator, /^<button\b/i)
  assert.match(modeIndicator, /\btype="button"/i)
  assert.doesNotMatch(modeIndicator, /\bhidden\b/i)
  assert.match(modeIndicator, /\bdata-mode="history"/i)
  assert.match(modeIndicator, /\bdata-corpus="history"/i)
  assert.match(modeIndicator, /\bdata-status="idle"/i)
  assert.match(modeIndicator, /\bdata-clickable="true"/i)
  assert.doesNotMatch(modeIndicator, /\sdisabled(?:\s|=|>)/i)
  assert.match(modeIndicator, /\baria-disabled="false"/i)
  assert.match(modeIndicator, /\baria-label="history; History not loaded; switch to recently closed with Tab"/i)
  assert.match(html, />history<\/button>/i)

  assert.match(deepSearchButton, /^<button\b/i)
  assert.match(deepSearchButton, /\bhidden\b/i)
  assert.match(deepSearchButton, /\baria-hidden="true"/i)
})

test('popup uses a compact search header row instead of the legacy standalone label', async () => {
  const html = await readFile('popup.html', 'utf8')
  const searchHeader = elementHtmlWithId(html, 'search-header')
  const searchInput = tagWithId(html, 'search-input')
  const brandStatus = tagWithId(html, 'status')

  assert.match(searchHeader, /\baria-label="Search history; History not loaded"/i)
  assert.match(searchHeader, /id="search-header-before"[\s\S]*>\s*Search\s*</i)
  assert.match(searchHeader, /id="mode-indicator"[\s\S]*>\s*history\s*<\/button>/i)
  assert.match(searchHeader, /id="search-header-after"[\s\S]*>\s*<\/span>/i)
  assert.match(searchHeader, /id="mode-switch-hint"[\s\S]*>\s*Tab \/ Shift\+Tab switches history ↔ closed\s*<\/span>/i)
  assert.match(searchHeader, /id="result-count"[\s\S]*\brole="status"[\s\S]*>\s*History not loaded\s*</i)
  assert.match(searchInput, /\baria-label="Search history"/i)
  assert.match(brandStatus, /\bhidden\b/i)
  assert.match(brandStatus, /\baria-hidden="true"/i)
  assert.doesNotMatch(html, />\s*Search browser history\s*</i)
})

test('popup omits the footer key-hint line and promotes space-separated search fragments', async () => {
  const html = await readFile('popup.html', 'utf8')
  const searchInput = tagWithId(html, 'search-input')
  const previousPageButton = elementHtmlWithId(html, 'previous-page-button')
  const nextPageButton = elementHtmlWithId(html, 'next-page-button')
  const placeholder = attributeValue(searchInput, 'placeholder')

  assert.doesNotMatch(html, /<footer\b[^>]*\bclass="[^"]*\bfooter-hints\b[^"]*"[^>]*>/i)
  for (const footerText of textForElements(html, 'footer')) {
    assert.doesNotMatch(footerText, /⌘K|\bEsc\b|j\/k|h\/l|\bEnter\b/i)
  }

  assert.match(previousPageButton, />\s*h\s+previous\s*<\/button>/i)
  assert.match(nextPageButton, />\s*l\s+next\s*<\/button>/i)
  assert.match(placeholder, /\bgit skilift issues 13\b/i)
  assert.doesNotMatch(placeholder, /\*/)
  assert.match(placeholder, /(?:\bi\b|\/).*search|search.*(?:\bi\b|\/)/i)
})

test('README product examples use space-separated URL fragments without starred syntax', async () => {
  const readme = await readFile('README.md', 'utf8')

  assert.match(readme, /```text\s+git skilift issues 13\s+```/i)
  assert.doesNotMatch(readme, /git\*skilift\*issues\*13/i)
})

test('README documents colon-delimited website-name and local file filters composing with URL fragments', async () => {
  const readme = await readFile('README.md', 'utf8')

  assert.match(readme, /`git:`[^.]*filters[^.]*website names\/roots/i)
  assert.match(readme, /`git:scry`[^.]*`git: scry`[^.]*ordinary URL-fragment query terms/i)
  assert.match(readme, /`file:`[^.]*filters[^.]*local `file:\/\/\/\.\.\.` history URLs/i)
  assert.match(readme, /`file:precalculus`[^.]*`file: precalculus`[^.]*ordinary URL-fragment query terms/i)
})

test('source does not include external network calls', async () => {
  const files = listFiles('.', (path) => path.endsWith('.js') || path.endsWith('.html'))
    .filter((path) => !path.startsWith('tests/'))
    .filter((path) => !path.startsWith('.ous/'))

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    assert.equal(/\bfetch\s*\(/.test(source), false, `${file} should not call fetch()`)
    assert.equal(/XMLHttpRequest/.test(source), false, `${file} should not use XMLHttpRequest`)
  }
})

function pngInfo(buffer) {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  assert.equal(buffer.subarray(0, 8).equals(pngSignature), true, 'expected PNG signature')
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR', 'expected PNG IHDR chunk')
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer.readUInt8(25),
  }
}

function tagWithId(source, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`<[a-z0-9-]+\\b[^>]*\\bid="${escapedId}"[^>]*>`, 'i'))
  assert.ok(match, `expected #${id} markup`)
  return match[0]
}

function elementHtmlWithId(source, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`<([a-z0-9-]+)\\b[^>]*\\bid="${escapedId}"[^>]*>[\\s\\S]*?<\\/\\1>`, 'i'))
  assert.ok(match, `expected #${id} element markup`)
  return match[0]
}

function attributeValue(tagSource, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = tagSource.match(new RegExp(`\\b${escapedName}="([^"]*)"`, 'i'))
  assert.ok(match, `expected ${name} attribute`)
  return match[1]
}

function textForElements(source, tagName) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = source.matchAll(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, 'gi'))
  return [...matches].map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function listFiles(root, predicate) {
  const result = []
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === '.git') continue
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) result.push(...listFiles(path, predicate))
    else if (predicate(path)) result.push(path.replace(/^\.\//, ''))
  }
  return result
}
