import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVisibleRows, isCopiedFeedbackVisible, rowEditableText, rowOpenUrl, rowSelectionLearningKey } from '../src/core/rows.js'

test('buildVisibleRows returns no rows for empty/default input', () => {
  assert.deepEqual(buildVisibleRows(), [])
  assert.deepEqual(buildVisibleRows({ corpusResults: [] }), [])
})

test('buildVisibleRows wraps real corpus results without changing their content', () => {
  const firstResult = {
    key: 'https://example.com/docs',
    url: 'https://example.com/docs?tab=readme',
    displayUrl: 'example.com/docs?tab=readme',
    title: 'Example docs',
    visitCount: 3,
    visitsLabel: '3 visits',
    lastVisitTime: 0,
    lastVisitedLabel: 'now',
    urlHtml: 'example.com/docs?tab=readme',
    titleHtml: 'Example docs',
    debug: {},
  }
  const secondResult = {
    key: 'https://scry.test/issues',
    url: 'https://scry.test/issues',
    displayUrl: 'scry.test/issues',
    title: 'Scry issues',
    visitCount: 1,
    visitsLabel: '1 visit',
    lastVisitTime: 0,
    lastVisitedLabel: 'now',
    urlHtml: 'scry.test/issues',
    titleHtml: 'Scry issues',
    debug: {},
  }

  const rows = buildVisibleRows({ corpusResults: [firstResult, secondResult] })

  assert.deepEqual(rows, [
    { kind: 'result', key: 'result:https://example.com/docs', result: firstResult, copied: false },
    { kind: 'result', key: 'result:https://scry.test/issues', result: secondResult, copied: false },
  ])
  assert.equal(rows[0].result, firstResult)
  assert.equal(rows[1].result, secondResult)
})

test('buildVisibleRows pins a synthetic typed URL row before real result rows', () => {
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const matchingCorpusResult = {
    key: 'https://typed.example/path',
    url: 'https://typed.example/path',
    displayUrl: 'typed.example/path',
    title: 'Visited typed URL',
    visitCount: 2,
    visitsLabel: '2 visits',
    lastVisitTime: 0,
    lastVisitedLabel: 'now',
    urlHtml: 'typed.example/path',
    titleHtml: 'Visited typed URL',
    debug: {},
  }

  const rows = buildVisibleRows({ corpusResults: [matchingCorpusResult], typedUrlCandidate })

  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    kind: 'open-typed-url',
    key: 'open-typed-url:https://typed.example/path',
    candidate: typedUrlCandidate,
    copied: false,
  })
  assert.equal(rows[0].candidate, typedUrlCandidate)
  assert.equal(rowOpenUrl(rows[0]), 'https://typed.example/path')
  assert.equal(rowSelectionLearningKey(rows[0]), null)
  assert.equal(rowEditableText(rows[0]), null)
  assert.deepEqual(rows[1], {
    kind: 'result',
    key: 'result:https://typed.example/path',
    result: matchingCorpusResult,
    copied: false,
  })
  assert.equal(rows[1].result, matchingCorpusResult)
})

test('buildVisibleRows includes copied feedback visibility per row key', () => {
  const typedUrlCandidate = {
    displayInput: 'typed.example/path',
    normalizedUrl: 'https://typed.example/path',
    key: 'https://typed.example/path',
  }
  const corpusResult = {
    key: 'https://example.com/docs',
    url: 'https://example.com/docs',
    displayUrl: 'example.com/docs',
    title: 'Example docs',
    visitCount: 3,
    visitsLabel: '3 visits',
    lastVisitTime: 0,
    lastVisitedLabel: 'now',
    urlHtml: 'example.com/docs',
    titleHtml: 'Example docs',
    debug: {},
  }

  const typedCopiedRows = buildVisibleRows({
    corpusResults: [corpusResult],
    typedUrlCandidate,
    copiedFeedback: { key: 'open-typed-url:https://typed.example/path', expiresAt: 9_999_999_999_999 },
  })
  assert.equal(typedCopiedRows[0].copied, true)
  assert.equal(typedCopiedRows[1].copied, false)

  const resultCopiedRows = buildVisibleRows({
    corpusResults: [corpusResult],
    typedUrlCandidate,
    copiedFeedback: { key: 'result:https://example.com/docs', expiresAt: 9_999_999_999_999 },
  })
  assert.equal(resultCopiedRows[0].copied, false)
  assert.equal(resultCopiedRows[1].copied, true)

  const expiredRows = buildVisibleRows({
    corpusResults: [corpusResult],
    typedUrlCandidate,
    copiedFeedback: { key: 'open-typed-url:https://typed.example/path', expiresAt: 1 },
  })
  assert.equal(expiredRows[0].copied, false)
  assert.equal(expiredRows[1].copied, false)
})

test('rowOpenUrl returns the real corpus result URL', () => {
  const row = {
    kind: 'result',
    key: 'result:https://example.com/docs',
    copied: false,
    result: {
      key: 'https://example.com/docs',
      url: 'https://example.com/docs?tab=readme',
      displayUrl: 'example.com/docs?tab=readme',
      title: 'Example docs',
      visitCount: 3,
      visitsLabel: '3 visits',
      lastVisitTime: 0,
      lastVisitedLabel: 'now',
      urlHtml: 'example.com/docs?tab=readme',
      titleHtml: 'Example docs',
      debug: {},
    },
  }

  assert.equal(rowOpenUrl(row), 'https://example.com/docs?tab=readme')
})

test('rowOpenUrl returns the synthetic typed URL candidate normalized URL', () => {
  const row = {
    kind: 'open-typed-url',
    key: 'open-typed-url:https://example.com/docs',
    copied: false,
    candidate: {
      displayInput: 'example.com/docs',
      normalizedUrl: 'https://example.com/docs',
      key: 'https://example.com/docs',
    },
  }

  assert.equal(rowOpenUrl(row), 'https://example.com/docs')
})

test('rowOpenUrl returns null for null or malformed rows', () => {
  const malformedRows = [
    null,
    undefined,
    {},
    { kind: 'unknown', url: 'https://example.com/ignore-me' },
    { kind: 'result' },
    { kind: 'result', result: null },
    { kind: 'result', result: {} },
    { kind: 'open-typed-url' },
    { kind: 'open-typed-url', candidate: null },
    { kind: 'open-typed-url', candidate: {} },
  ]

  for (const row of malformedRows) {
    assert.equal(rowOpenUrl(row), null)
  }
})

test('rowSelectionLearningKey returns the normalized real corpus result key', () => {
  const row = {
    kind: 'result',
    key: 'result:https://example.com/docs',
    copied: false,
    result: {
      key: 'https://example.com/docs',
      url: 'https://example.com/docs?tab=readme',
      displayUrl: 'example.com/docs?tab=readme',
      title: 'Example docs',
      visitCount: 3,
      visitsLabel: '3 visits',
      lastVisitTime: 0,
      lastVisitedLabel: 'now',
      urlHtml: 'example.com/docs?tab=readme',
      titleHtml: 'Example docs',
      debug: {},
    },
  }

  assert.equal(rowSelectionLearningKey(row), 'https://example.com/docs')
})

test('rowSelectionLearningKey returns null for synthetic typed URL rows', () => {
  const row = {
    kind: 'open-typed-url',
    key: 'open-typed-url:https://example.com/docs',
    copied: false,
    candidate: {
      displayInput: 'example.com/docs',
      normalizedUrl: 'https://example.com/docs',
      key: 'https://example.com/docs',
    },
  }

  assert.equal(rowSelectionLearningKey(row), null)
})

test('rowSelectionLearningKey returns null for null or malformed rows', () => {
  const malformedRows = [
    null,
    undefined,
    {},
    { kind: 'unknown', key: 'https://example.com/ignore-me' },
    { kind: 'result' },
    { kind: 'result', key: 'result:https://example.com/fallback' },
    { kind: 'result', result: null },
    { kind: 'result', result: {} },
    { kind: 'result', result: { key: '' } },
    { kind: 'result', result: { key: 42 } },
    { kind: 'open-typed-url' },
    { kind: 'open-typed-url', candidate: null },
    { kind: 'open-typed-url', candidate: { key: 'https://example.com/do-not-learn' } },
  ]

  for (const row of malformedRows) {
    assert.equal(rowSelectionLearningKey(row), null)
  }
})

test('rowEditableText returns the real corpus result display URL for the change action', () => {
  const row = {
    kind: 'result',
    key: 'result:https://example.com/docs',
    copied: false,
    result: {
      key: 'https://example.com/docs',
      url: 'https://example.com/docs?tab=readme#install',
      displayUrl: 'example.com/docs?tab=readme',
      title: 'Example docs',
      visitCount: 3,
      visitsLabel: '3 visits',
      lastVisitTime: 0,
      lastVisitedLabel: 'now',
      urlHtml: '<mark>example</mark>.com/docs?tab=readme',
      titleHtml: 'Example docs',
      debug: {},
    },
  }

  assert.equal(rowEditableText(row), 'example.com/docs?tab=readme')
})

test('rowEditableText returns null for synthetic typed URL rows', () => {
  const row = {
    kind: 'open-typed-url',
    key: 'open-typed-url:https://example.com/docs',
    copied: false,
    candidate: {
      displayInput: 'example.com/docs',
      normalizedUrl: 'https://example.com/docs',
      key: 'https://example.com/docs',
    },
  }

  assert.equal(rowEditableText(row), null)
})

test('rowEditableText returns null for null or malformed rows', () => {
  const malformedRows = [
    null,
    undefined,
    {},
    { kind: 'unknown', result: { displayUrl: 'example.com/ignore-me' } },
    { kind: 'result' },
    { kind: 'result', result: null },
    { kind: 'result', result: {} },
    { kind: 'result', result: { displayUrl: '' } },
    { kind: 'result', result: { displayUrl: 42 } },
    { kind: 'result', result: { urlHtml: '<mark>example</mark>.com/docs' } },
    { kind: 'open-typed-url' },
    { kind: 'open-typed-url', candidate: null },
    { kind: 'open-typed-url', candidate: { displayInput: 'example.com/do-not-change' } },
  ]

  for (const row of malformedRows) {
    assert.equal(rowEditableText(row), null)
  }
})

test('isCopiedFeedbackVisible returns true for a matching unexpired real result row key', () => {
  const row = {
    kind: 'result',
    key: 'result:https://example.com/docs',
    copied: false,
    result: {
      key: 'https://example.com/docs',
      url: 'https://example.com/docs',
      displayUrl: 'example.com/docs',
    },
  }

  assert.equal(
    isCopiedFeedbackVisible(row, { key: 'result:https://example.com/docs', expiresAt: 2_200 }, 1_000),
    true,
  )
})

test('isCopiedFeedbackVisible returns true for a matching unexpired synthetic typed URL row key', () => {
  const row = {
    kind: 'open-typed-url',
    key: 'open-typed-url:https://typed.example/path',
    copied: false,
    candidate: {
      displayInput: 'typed.example/path',
      normalizedUrl: 'https://typed.example/path',
      key: 'https://typed.example/path',
    },
  }

  assert.equal(
    isCopiedFeedbackVisible(row, { key: 'open-typed-url:https://typed.example/path', expiresAt: 2_200 }, 1_000),
    true,
  )
})

test('isCopiedFeedbackVisible returns false for mismatched or inner URL keys', () => {
  const realRow = {
    kind: 'result',
    key: 'result:https://example.com/docs',
    copied: false,
    result: { key: 'https://example.com/docs' },
  }
  const typedUrlRow = {
    kind: 'open-typed-url',
    key: 'open-typed-url:https://typed.example/path',
    copied: false,
    candidate: { key: 'https://typed.example/path' },
  }

  assert.equal(isCopiedFeedbackVisible(realRow, { key: 'result:https://example.com/other', expiresAt: 2_200 }, 1_000), false)
  assert.equal(isCopiedFeedbackVisible(realRow, { key: 'https://example.com/docs', expiresAt: 2_200 }, 1_000), false)
  assert.equal(isCopiedFeedbackVisible(typedUrlRow, { key: 'https://typed.example/path', expiresAt: 2_200 }, 1_000), false)
})

test('isCopiedFeedbackVisible returns false when feedback has expired', () => {
  const row = {
    kind: 'result',
    key: 'result:https://example.com/docs',
    copied: false,
    result: { key: 'https://example.com/docs' },
  }

  assert.equal(isCopiedFeedbackVisible(row, { key: row.key, expiresAt: 1_200 }, 1_200), false)
  assert.equal(isCopiedFeedbackVisible(row, { key: row.key, expiresAt: 1_200 }, 1_201), false)
})

test('isCopiedFeedbackVisible returns false for missing or malformed rows and feedback', () => {
  const row = {
    kind: 'result',
    key: 'result:https://example.com/docs',
    copied: false,
    result: { key: 'https://example.com/docs' },
  }
  const activeFeedback = { key: row.key, expiresAt: 2_200 }

  const cases = [
    [null, activeFeedback],
    [undefined, activeFeedback],
    [{}, activeFeedback],
    [{ kind: 'result', key: '', copied: false, result: { key: '' } }, { key: '', expiresAt: 2_200 }],
    [{ kind: 'result', key: 42, copied: false, result: { key: 42 } }, { key: 42, expiresAt: 2_200 }],
    [row, null],
    [row, undefined],
    [row, {}],
    [row, { key: row.key }],
    [row, { key: row.key, expiresAt: '2200' }],
  ]

  for (const [visibleRow, copiedFeedback] of cases) {
    assert.equal(isCopiedFeedbackVisible(visibleRow, copiedFeedback, 1_000), false)
  }
})
