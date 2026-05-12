import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveResultRenderSelection,
  enterResultsModeSelection,
  isVisibleRowSelectedForRender,
  resultNavigationCommandForKey,
} from '../src/panel/app.js'

test('deriveResultRenderSelection exposes selected row visually in result-navigation mode', () => {
  assert.deepEqual(deriveResultRenderSelection({ focusMode: 'results', selectedIndex: 2 }), {
    focusMode: 'results',
    selectedIndex: 2,
    visualSelectedIndex: 2,
  })
})

test('deriveResultRenderSelection suppresses visual selection in input mode while preserving action target', () => {
  assert.deepEqual(deriveResultRenderSelection({ focusMode: 'search', selectedIndex: 0 }), {
    focusMode: 'search',
    selectedIndex: 0,
    visualSelectedIndex: null,
  })
})

test('deriveResultRenderSelection suppresses visual selection in blurred mode while preserving action target', () => {
  assert.deepEqual(deriveResultRenderSelection({ focusMode: 'blurred', selectedIndex: 5 }), {
    focusMode: 'blurred',
    selectedIndex: 5,
    visualSelectedIndex: null,
  })
})

test('isVisibleRowSelectedForRender returns true when the visible row index is the visual selected index', () => {
  assert.equal(isVisibleRowSelectedForRender(2, {
    focusMode: 'results',
    selectedIndex: 2,
    visualSelectedIndex: 2,
  }), true)
})

test('isVisibleRowSelectedForRender returns false for other visible rows', () => {
  assert.equal(isVisibleRowSelectedForRender(1, {
    focusMode: 'results',
    selectedIndex: 2,
    visualSelectedIndex: 2,
  }), false)
})

test('isVisibleRowSelectedForRender suppresses selected UI when there is no visual selected index', () => {
  assert.equal(isVisibleRowSelectedForRender(0, {
    focusMode: 'search',
    selectedIndex: 0,
    visualSelectedIndex: null,
  }), false)
})

test('enterResultsModeSelection returns null when there are no visible rows', () => {
  assert.equal(enterResultsModeSelection({ visibleRows: [] }), null)
})

test('enterResultsModeSelection selects the first visible real result row', () => {
  assert.deepEqual(enterResultsModeSelection({
    visibleRows: [
      { kind: 'result', key: 'result:first', result: { url: 'https://example.test/first' }, copied: false },
    ],
  }), {
    focusMode: 'results',
    selectedIndex: 0,
  })
})

test('enterResultsModeSelection selects the first visible row when a typed URL row is pinned before results', () => {
  assert.deepEqual(enterResultsModeSelection({
    visibleRows: [
      { kind: 'open-typed-url', key: 'open-typed-url:example.test', candidate: { normalizedUrl: 'https://example.test' }, copied: false },
      { kind: 'result', key: 'result:second', result: { url: 'https://example.test/second' }, copied: false },
    ],
  }), {
    focusMode: 'results',
    selectedIndex: 0,
  })
})

test('resultNavigationCommandForKey maps search-focus keys to focusSearch', () => {
  assert.equal(resultNavigationCommandForKey({ key: 'i' }), 'focusSearch')
  assert.equal(resultNavigationCommandForKey({ key: 'I' }), 'focusSearch')
  assert.equal(resultNavigationCommandForKey({ key: '/' }), 'focusSearch')
})

test('resultNavigationCommandForKey maps Escape to leavePanelFocus', () => {
  assert.equal(resultNavigationCommandForKey({ key: 'Escape' }), 'leavePanelFocus')
})

test('resultNavigationCommandForKey keeps selected-row commands distinct', () => {
  assert.equal(resultNavigationCommandForKey({ key: 'y' }), 'copySelected')
  assert.equal(resultNavigationCommandForKey({ key: 'c' }), 'editSelectedUrl')
  assert.equal(resultNavigationCommandForKey({ key: 'j' }), 'moveNext')
  assert.equal(resultNavigationCommandForKey({ key: 'k' }), 'movePrevious')
  assert.equal(resultNavigationCommandForKey({ key: 'l' }), 'nextPage')
  assert.equal(resultNavigationCommandForKey({ key: 'h' }), 'previousPage')
  assert.equal(resultNavigationCommandForKey({ key: 'Enter' }), 'openSelected')
})

test('resultNavigationCommandForKey ignores normal typing, unknown keys, and missing keys', () => {
  assert.equal(resultNavigationCommandForKey({ key: 'a' }), 'ignore')
  assert.equal(resultNavigationCommandForKey({ key: ' ' }), 'ignore')
  assert.equal(resultNavigationCommandForKey({ key: '/open' }), 'ignore')
  assert.equal(resultNavigationCommandForKey({}), 'ignore')
})
