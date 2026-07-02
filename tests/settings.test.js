import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_SCRY_SETTINGS,
  keyboardEventMatchesShortcut,
  normalizeScrySettings,
  normalizeShortcutChord,
  shortcutLabel,
} from '../src/core/settings.js'
import { resultNavigationCommandForSettings } from '../src/panel/app.js'
import { selectedFavoriteRowActionHintsForSettings, selectedRowActionHintsForSettings } from '../src/core/rows.js'
import { createPopupSessionSearchCache, searchSearchHeaderModelForSettings } from '../src/core/search-modes.js'

const resultRow = {
  kind: 'result',
  key: 'result:https://example.com/docs',
  result: {
    key: 'https://example.com/docs',
    url: 'https://example.com/docs',
    displayUrl: 'example.com/docs',
  },
}

test('normalizeShortcutChord canonicalizes modifiers, aliases, and plain keys', () => {
  assert.equal(normalizeShortcutChord('ctrl + q'), 'Ctrl+Q')
  assert.equal(normalizeShortcutChord('Control+q'), 'Ctrl+Q')
  assert.equal(normalizeShortcutChord('Shift+Tab'), 'Shift+Tab')
  assert.equal(normalizeShortcutChord('x'), 'x')
  assert.equal(normalizeShortcutChord('Command+Enter'), 'Command+Enter')
})

test('normalizeShortcutChord rejects empty, modifier-only, and unknown shortcuts', () => {
  assert.throws(() => normalizeShortcutChord(''), /empty/i)
  assert.throws(() => normalizeShortcutChord('Ctrl+Shift'), /non-modifier/i)
  assert.throws(() => normalizeShortcutChord('Ctrl+Banana'), /unknown/i)
})

test('keyboardEventMatchesShortcut compares normalized keys and exact modifiers', () => {
  assert.equal(keyboardEventMatchesShortcut({ key: 'q', ctrlKey: true }, 'Ctrl+Q'), true)
  assert.equal(keyboardEventMatchesShortcut({ key: 'q' }, 'Ctrl+Q'), false)
  assert.equal(keyboardEventMatchesShortcut({ key: 'Tab', shiftKey: true }, 'Shift+Tab'), true)
  assert.equal(keyboardEventMatchesShortcut({ key: 'Tab' }, 'Shift+Tab'), false)
  assert.equal(keyboardEventMatchesShortcut({ key: 'x' }, 'x'), true)
  assert.equal(keyboardEventMatchesShortcut({ key: 'x', altKey: true }, 'x'), false)
  assert.equal(keyboardEventMatchesShortcut({ key: 'q', ctrlKey: true }, 'Ctrl+Banana'), false)
})

test('normalizeScrySettings fills missing values and defaults malformed shortcuts', () => {
  assert.deepEqual(normalizeScrySettings(null), DEFAULT_SCRY_SETTINGS)

  const settings = normalizeScrySettings({
    version: 1,
    shortcuts: {
      switchMode: 'alt + m',
      copySelected: 'not a shortcut',
    },
  })

  assert.equal(settings.shortcuts.switchMode, 'Alt+M')
  assert.equal(settings.shortcuts.copySelected, 'Ctrl+Y')
  assert.equal(settings.shortcuts.nextPage, 'Ctrl+D')
  assert.equal(shortcutLabel(settings, 'switchMode'), 'Alt+M')
  assert.equal(shortcutLabel(settings, 'unknown'), '')
})

test('resultNavigationCommandForSettings uses customized shortcuts and disables replaced defaults', () => {
  const settings = normalizeScrySettings({
    version: 1,
    shortcuts: {
      nextPage: 'Alt+J',
      copySelected: 'c',
    },
  })

  assert.equal(resultNavigationCommandForSettings({ key: 'j', altKey: true }, settings), 'nextPage')
  assert.equal(resultNavigationCommandForSettings({ key: 'd', ctrlKey: true }, settings), 'ignore')
  assert.equal(resultNavigationCommandForSettings({ key: 'c' }, settings), 'copySelected')
  assert.equal(resultNavigationCommandForSettings({ key: 'ArrowDown' }, settings), 'moveNext')
})

test('row action hints use configured shortcut labels', () => {
  const settings = normalizeScrySettings({
    version: 1,
    shortcuts: {
      copySelected: 'Alt+C',
      editSelectedUrl: 'Alt+E',
      removeSelectedFavorite: 'r',
      undoFavoriteRemoval: 'Ctrl+Z',
    },
  })

  assert.deepEqual(selectedRowActionHintsForSettings(resultRow, { selected: true }, settings), [
    { action: 'copy', key: 'Alt+C', label: 'copy' },
    { action: 'edit-url', key: 'Alt+E', label: 'edit URL' },
  ])
  assert.deepEqual(selectedFavoriteRowActionHintsForSettings(resultRow, {
    selected: true,
    inFavoritesMode: true,
    canUndoFavoriteRemoval: true,
  }, settings), [
    { action: 'copy', key: 'Alt+C', label: 'copy' },
    { action: 'edit-url', key: 'Alt+E', label: 'edit URL' },
    { action: 'remove-favorite', key: 'r', label: 'remove' },
    { action: 'undo-remove-favorite', key: 'Ctrl+Z', label: 'undo' },
  ])
})

test('search header models use configured mode switch labels', () => {
  const cache = createPopupSessionSearchCache()
  const settings = normalizeScrySettings({ version: 1, shortcuts: { switchMode: 'Alt+M' } })

  assert.equal(searchSearchHeaderModelForSettings(cache, settings).modeSwitchHint, 'Alt+M')

  cache.activeMode = 'favorites'
  cache.modes.favorites = { mode: 'favorites', status: 'idle', index: null, error: null, loadedAt: null, loadingPromise: null }
  assert.equal(searchSearchHeaderModelForSettings(cache, settings).modeSwitchHint, 'Alt+M to return')
})
