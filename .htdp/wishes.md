## Wish List

### Layer 2 (implement first)
- `normalizeWebsiteFilter(rawText)` in `src/core/query.js`
  Purpose: Normalize raw complete bracket contents into a WebsiteFilter with preserved rawText and lowercase matchText suitable for hostname/root matching.
  Depends on: none
- `queryKeyWithWebsiteFilters(tokens, websiteFilters)` in `src/core/query.js`
  Purpose: Build a deterministic selection-learning/debug key that preserves ordinary token identity while distinguishing bracket-filtered intents from unfiltered queries.
  Depends on: none
- `websiteNameCandidatesForHostname(hostname)` in `src/core/url.js`
  Purpose: Derive deterministic local lowercase website hostname/root-name match candidates, ignoring common leading `www`, without public-suffix data, network calls, or lookup tables.
  Depends on: none
- `collectWebsiteFilterEvidence(entry, websiteFilters)` in `src/core/search.js`
  Purpose: Determine which website filters match a normalized history entry and return per-filter candidate evidence for search debug data.
  Depends on: none
- `selectionIntentKeyParts(parsedQuery)` in `src/core/selection-learning.js`
  Purpose: Extract ordinary tokens and website filters from parsed query data for selection-learning storage and overlap checks.
  Depends on: none

### Layer 1
- `parseWebsiteFilters(query)` in `src/core/query.js`
  Purpose: Remove only complete bracketed website filter terms from query text while leaving incomplete brackets as ordinary forgiving search text.
  Depends on: normalizeWebsiteFilter
- `websiteNameCandidatesForUrl(url)` in `src/core/url.js`
  Purpose: Parse a URL locally and attach hostname/root-name website candidates used by bracketed website filters.
  Depends on: websiteNameCandidatesForHostname
- `entryMatchesWebsiteFilters(entry, websiteFilters)` in `src/core/search.js`
  Purpose: Return true only when an entry satisfies every bracketed website filter, with empty filters treated as no hard filter.
  Depends on: collectWebsiteFilterEvidence
- `selectionIntentKeysOverlap(currentParts, storedKey)` in `src/core/selection-learning.js`
  Purpose: Compare current query intent parts with a stored selection-learning key without allowing filtered and unfiltered intents to overlap accidentally.
  Depends on: none

### Layer 0 (implement last)
- `parseQuery(query)` in `src/core/query.js`
  Purpose: Compose exact-phrase parsing with website-filter parsing so ParsedQuery exposes unquotedTokens, exactPhrases, websiteFilters, and a distinct key while preserving unbracketed behavior.
  Depends on: parseWebsiteFilters, queryKeyWithWebsiteFilters
- `buildHistoryIndex(rawEntries, { now = Date.now() } = {})` in `src/core/search.js`
  Purpose: Populate each normalized history index entry with websiteName candidates alongside existing searchable segments.
  Depends on: websiteNameCandidatesForUrl
- `applyWebsiteFilters(entries, websiteFilters)` in `src/core/search.js`
  Purpose: Filter normalized history entries by all complete bracketed website filters before quote filtering, ordinary token ranking, pagination, and selection boosts.
  Depends on: entryMatchesWebsiteFilters
- `searchParsedHistory(index, parsedQuery, { now = Date.now(), limit = DEFAULT_LIMIT, selections, emptyQuerySort = 'frecency' } = {})` in `src/core/search.js`
  Purpose: Apply website filters as hard candidate filters, then preserve existing empty-query, token, and exact-phrase ranking within the filtered set.
  Depends on: applyWebsiteFilters
- `recordSelection(data, { query, tokens, urlKey, selectedAt = Date.now() })` in `src/core/selection-learning.js`
  Purpose: Store selection-learning aggregates under query keys that include website filters when present while preserving legacy token callers.
  Depends on: selectionIntentKeyParts, queryKeyWithWebsiteFilters
- `selectionBoost(data, tokens, urlKey, now = Date.now())` in `src/core/selection-learning.js`
  Purpose: Compute learned boosts using intent overlap that keeps website-filtered and unfiltered queries distinct.
  Depends on: selectionIntentKeysOverlap

## Data Definitions Created/Modified
- `src/core/query.js`: added `WebsiteFilter` and `QueryWebsiteFilterParse` typedefs; extended `ParsedQuery` with `websiteFilters` and a filter-aware `key` contract.
- `src/core/url.js`: added `WebsiteNameCandidates` typedef for local hostname/root-name match candidates.
- `src/core/search.js`: added `HistoryIndexEntry` typedef with `websiteName` candidates and `WebsiteFilterEvidence` debug datum.
- `src/core/selection-learning.js`: added `SelectionIntentKeyParts` typedef for token plus website-filter learning identity.
- `.htdp/DSL.json`: added stable vocabulary for website filters, website name candidates, and the local-only MV3 boundary.

## Assertion Changes Flagged
- None

## Assumptions / Interpretations
- I interpreted bracket filter matching as prefix matching against deterministic lowercase website candidates, because `[git]` must match `github.com`, `gitter.com`, and `gitopia.com`.
- I treated multiple website filters as conjunctive hard filters, because the requirement says one or more filters compose as hard filters.
- I kept implementation stubs mostly uncalled so existing unbracketed query behavior and current tests remain green until the implementer fills the wishes.

## Notes
- Verification run: `npm run check && npm test` passed with 215 tests.
- Stubs currently throw if called; existing production paths do not call them yet.
