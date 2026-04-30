import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const cssPath = 'src/panel/styles.css'

test('typed URL action row is distinct without becoming a card', async () => {
  const css = await readFile(cssPath, 'utf8')
  const actionRow = ruleFor(css, '.result-action.open-typed-url')
  const actionButton = ruleFor(css, '.open-typed-url-button')

  assert.ok(actionRow.includes('border-bottom-color'), 'typed URL row should use a subtle divider distinction')
  assert.match(actionButton, /background:\s*#(?:fafafa|f8f8f8|f7f7f7)\b/i, 'typed URL action should use only a very light neutral background')
  assertDensePadding(actionButton)
  assertNoModernCardChrome(`${actionRow}\n${actionButton}`)
})

test('copied feedback is styled as a small inline marker', async () => {
  const css = await readFile(cssPath, 'utf8')
  const marker = ruleFor(css, '.result-copied-feedback')

  assert.match(marker, /display:\s*inline-block\b/i)
  assertMaxPx(marker, 'font-size', 11)
  assert.match(marker, /line-height:\s*1(?:\.\d+)?\b/i)
  assert.match(marker, /margin-right:\s*[1-9]\d*px\b/i, 'inline marker should leave a small gap before row text')
  assert.doesNotMatch(marker, /position:\s*(?:fixed|absolute)\b/i, 'copied marker should stay inline/top-left in the dense row flow')
})

test('mode indicator keeps the sparse old-Google popup treatment', async () => {
  const css = await readFile(cssPath, 'utf8')
  const modeIndicator = ruleFor(css, '.mode-indicator')

  assert.match(modeIndicator, /background:\s*#fff\b/i)
  assert.match(modeIndicator, /border:\s*1px\s+solid\s+#[0-9a-f]{3,6}\b/i)
  assert.match(modeIndicator, /color:\s*#0000cc\b/i)
  assertMaxPx(modeIndicator, 'font-size', 11)
  assertNoModernCardChrome(modeIndicator)
})

test('search header row keeps sparse styling while right-aligning the mode status', async () => {
  const css = await readFile(cssPath, 'utf8')
  const searchHeader = ruleFor(css, '.search-header')
  const hint = ruleFor(css, '.mode-switch-hint')
  const count = ruleFor(css, '.result-count')

  assert.match(searchHeader, /display:\s*flex\b/i)
  assert.match(searchHeader, /align-items:\s*baseline\b/i)
  assertMaxPx(searchHeader, 'font-size', 12)
  assertMaxPx(hint, 'font-size', 11)
  assert.match(count, /margin-left:\s*auto\b/i)
  assert.match(count, /text-align:\s*right\b/i)
  assertMaxPx(count, 'font-size', 11)
  assertNoModernCardChrome(`${searchHeader}\n${hint}\n${count}`)
})

function ruleFor(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`(^|})\\s*${escapedSelector}\\s*\\{([^}]*)\\}`, 'm'))
  assert.ok(match, `expected CSS rule for ${selector}`)
  return match[2]
}

function assertDensePadding(ruleBody) {
  const match = ruleBody.match(/padding:\s*([^;]+)/i)
  assert.ok(match, 'expected typed URL action to set compact padding')

  const pixelValues = [...match[1].matchAll(/(\d+(?:\.\d+)?)px/g)].map(([, value]) => Number(value))
  assert.ok(pixelValues.length > 0, `expected px padding values, got ${match[1]}`)
  assert.equal(pixelValues.every((value) => value <= 6), true, `expected dense padding no larger than 6px, got ${match[1]}`)
}

function assertMaxPx(ruleBody, property, max) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = ruleBody.match(new RegExp(`${escapedProperty}:\\s*(\\d+(?:\\.\\d+)?)px\\b`, 'i'))
  assert.ok(match, `expected ${property} in px`)
  assert.ok(Number(match[1]) <= max, `expected ${property} <= ${max}px, got ${match[1]}px`)
}

function assertNoModernCardChrome(ruleBody) {
  assert.doesNotMatch(ruleBody, /box-shadow\s*:/i, 'should not add card-like shadows')
  assert.doesNotMatch(ruleBody, /border-radius:\s*(?!0\b)\d/i, 'should not add rounded card corners')
}
