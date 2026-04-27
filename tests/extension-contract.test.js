import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

test('manifest exposes a Chrome popup command palette for history-only recall', async () => {
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'))

  assert.equal(manifest.manifest_version, 3)
  assert.equal('minimum_chrome_version' in manifest, false)
  assert.equal(manifest.action.default_popup, 'popup.html')
  assert.equal(manifest.commands._execute_action.suggested_key.default, 'Ctrl+K')
  assert.equal(manifest.commands._execute_action.suggested_key.mac, 'Command+K')
  assert.deepEqual([...manifest.permissions].sort(), ['history', 'storage', 'tabs'].sort())
  assert.equal('side_panel' in manifest, false)
  assert.equal('host_permissions' in manifest, false)
  assert.equal('content_scripts' in manifest, false)
  assert.equal('options_page' in manifest, false)
})

test('action popup alignment investigation documents Chrome-controlled placement', async () => {
  const doc = await readFile('docs/action-popup-alignment.md', 'utf8')

  assert.match(doc, /Chrome action popup alignment is not controllable/i)
  assert.match(doc, /chrome\.action/i)
  assert.match(doc, /default_popup/i)
  assert.match(doc, /setPopup/i)
  assert.match(doc, /openPopup/i)
  assert.match(doc, /browser-controlled/i)
  assert.match(doc, /layout within the popup/i)
  assert.match(doc, /side panel/i)
  assert.match(doc, /non-chosen alternative/i)
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
