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
  assert.match(modeIndicator, /\baria-label="\[recent\]; Recent history not loaded"/i)
  assert.match(html, />\[recent\]<\/button>/i)

  assert.match(deepSearchButton, /^<button\b/i)
  assert.match(deepSearchButton, /\bhidden\b/i)
  assert.match(deepSearchButton, /\baria-hidden="true"/i)
})

test('popup footer documents mode switching, result actions, and non-closing result Escape', async () => {
  const html = await readFile('popup.html', 'utf8')
  const footerText = textForElementWithClass(html, 'footer', 'footer-hints')

  assert.match(footerText, /\btab\b.*\bmode\b/i)
  assert.match(footerText, /\bi\b.*\bsearch\b/i)
  assert.match(footerText, /\by\b.*\bcopy\b/i)
  assert.match(footerText, /\bc\b.*\b(change|edit)\b/i)
  assert.match(footerText, /\besc\b.*\b(result|row)\b/i)
  assert.match(footerText, /(stays open|stay open|not close|non-closing|keeps? .*open)/i)
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

function textForElementWithClass(source, tagName, className) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedClass = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`<${escapedTag}\\b[^>]*\\bclass="[^"]*\\b${escapedClass}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, 'i'))
  assert.ok(match, `expected .${className} ${tagName} markup`)
  return match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
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
