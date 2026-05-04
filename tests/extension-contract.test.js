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
  assert.equal(manifest.permissions.every((permission) => typeof permission === 'string'), true)
  assert.deepEqual([...manifest.permissions].sort(), ['history', 'sessions', 'storage', 'tabs'].sort())
  assert.equal('side_panel' in manifest, false)
  assert.equal('host_permissions' in manifest, false)
  assert.equal('content_scripts' in manifest, false)
  assert.equal('options_page' in manifest, false)
})

test('popup exposes explicit mode controls without a visible legacy deep-search fallback', async () => {
  const html = await readFile('popup.html', 'utf8')
  const modeIndicator = tagWithId(html, 'mode-indicator')
  const deepSearchButton = tagWithId(html, 'deep-search-button')

  assert.match(modeIndicator, /^<button\b/i)
  assert.match(modeIndicator, /\btype="button"/i)
  assert.doesNotMatch(modeIndicator, /\bhidden\b/i)
  assert.match(modeIndicator, /\bdata-mode="recent"/i)
  assert.match(modeIndicator, /\bdata-status="idle"/i)
  assert.match(modeIndicator, /\baria-label="recent; Recent history not loaded"/i)
  assert.match(html, />recent<\/button>/i)

  assert.match(deepSearchButton, /^<button\b/i)
  assert.match(deepSearchButton, /\bhidden\b/i)
  assert.match(deepSearchButton, /\baria-hidden="true"/i)
})

test('popup uses a compact search header row instead of the legacy standalone label', async () => {
  const html = await readFile('popup.html', 'utf8')
  const searchHeader = elementHtmlWithId(html, 'search-header')
  const searchInput = tagWithId(html, 'search-input')
  const brandStatus = tagWithId(html, 'status')

  assert.match(searchHeader, /\baria-label="Search recent history; Recent history not loaded"/i)
  assert.match(searchHeader, /id="search-header-before"[\s\S]*>\s*Search\s*</i)
  assert.match(searchHeader, /id="mode-indicator"[\s\S]*>\s*recent\s*<\/button>/i)
  assert.match(searchHeader, /id="search-header-after"[\s\S]*>\s*history\s*</i)
  assert.match(searchHeader, /id="mode-switch-hint"[\s\S]*>\s*Tab\/Shift\+Tab\s*</i)
  assert.match(searchHeader, /id="result-count"[\s\S]*\brole="status"[\s\S]*>\s*Recent history not loaded\s*</i)
  assert.match(searchInput, /\baria-label="Search recent history"/i)
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

test('README documents colon-delimited website-name filters composing with URL fragments', async () => {
  const readme = await readFile('README.md', 'utf8')

  assert.match(readme, /`git:`[^.]*filters[^.]*website names\/roots/i)
  assert.match(readme, /`git: issues 13`[^.]*ordinary URL-fragment query terms/i)
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
