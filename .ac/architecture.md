# Architecture

## Project condition and conventions

Scry is a brownfield, dependency-light JavaScript Chrome MV3 extension. Search behavior is implemented as pure functions in `src/core`, with Node test coverage in `tests`. Browser adapters and popup rendering consume core results without owning ranking decisions. Existing public search functions and result shapes should remain stable.

## SearchRanking owner

`src/core/search.js` owns match eligibility, per-token evidence selection, aggregate ranking tuples, and debug explanations.

Stable surface:

- `buildHistoryIndex(rawEntries, options)` builds searchable entries.
- `searchHistory(index, query, options)` parses and searches history.
- `searchParsedHistory(index, parsedQuery, options)` searches an already parsed query.
- Existing result and debug fields remain compatible.

Dependencies:

- `src/core/query.js` continues to own query tokenization, quote parsing, and website-filter parsing.
- `src/core/url.js` continues to own segment construction and URL normalization.
- `src/core/selection-learning.js` continues to supply a bounded late ranking signal.

## Approved domain model

```ts
type MatchEvidence = {
  queryToken: string
  candidateToken: string
  field: 'host' | 'path' | 'title' | 'query'
  tier: 'exact' | 'prefix' | 'abbreviation' | 'substring'
  segmentOrder: number
}

type CoherenceEvidence = {
  matchedTokenCount: number
  adjacentPairCount: number
  tierSum: number
}

type RankEvidence = {
  tokenMatches: Array<MatchEvidence | null>
  sameField: CoherenceEvidence
  orderedUrl: CoherenceEvidence
  usageScore: number
  selectionBoost: number
}
```

A candidate derives one best `MatchEvidence` per query token, then derives aggregate coherence and late usage signals. These values remain internal ranking/debug evidence and do not change the public result shape.

## Ranking invariants

- Full query-token coverage outranks partial coverage.
- Better textual match tiers outrank weaker tiers before field location or coherence can dominate.
- Field priority breaks ties among evidence of comparable textual quality; it must not make a URL abbreviation stronger than a title exact or prefix match.
- Same-field and URL coherence distinguish candidates after textual fidelity is established.
- Usage and selection learning remain late tie-breakers and cannot override materially stronger text evidence.
- Numeric tokens retain exact/prefix-only behavior.
- Query-string evidence remains lower priority than equivalent host, path, or title evidence.

## Abbreviation constraints

Ordered abbreviation matching remains available only for two-to-four-character alphabetic query tokens against alphabetic host, path, or title segments; query-string segments are ineligible for abbreviation evidence. The match must begin with the candidate's first character, and its matched-character span may omit at most two characters. These rules preserve compact shortcuts such as `gh` to `github` while rejecting arbitrary subsequences deep inside long or mixed identifier tokens.

## Same-field coherence

Ranking may derive ordered coverage within each field from existing indexed segments. The best field-level ordered coverage and adjacency evidence are aggregate tie-breakers. This adds no storage and changes no public result contract.

## Brownfield preservation and regression harness

- Baseline evidence: `npm test` and `npm run check` pass before the change.
- Extend the current `matchTier`, segment matching, and lexicographic rank tuple seam rather than introducing a search library or new state.
- Add focused tests to `tests/scry-core.test.js` for accidental URL abbreviations, title direct matches, abbreviation bounds, and preserved `gh` behavior.

## Change-impact checks

- Changing abbreviation span policy should remain localized to matching and focused tests.
- Changing query syntax would cross into `src/core/query.js`, documentation, and UI and is outside this slice.
- Changing indexed segment shape or public search result shape would require architecture review before implementation.
- If realistic regression fixtures cannot preserve established URL recall examples, stop and revise the ranking contract instead of broadening the refactor.
