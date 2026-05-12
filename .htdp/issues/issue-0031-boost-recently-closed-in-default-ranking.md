---
id: issue-0031
status: ready
type: feature
mode: AFK
source_prd: null
depends_on:
  - issue-0030
remote:
  github: null
---

# Boost recently closed in default ranking

## What to build

Treat recently closed tabs/windows as an additive ranking signal in the default history search rather than a separate `closed` mode. Scry should fetch recently closed sessions locally, merge or annotate matching history entries for the popup-session index, and give those URLs an extra priority alongside existing recency, frequency, match-quality, and selection-learning signals.

## Acceptance examples

- [ ] Given a URL appears in Chrome's recently closed sessions, when it also matches the user's query in the default history corpus, then it receives an observable ranking boost over otherwise similar non-closed results.
- [ ] Given a recently closed URL is not present in the deep history response but has a valid URL in the sessions response, when the default corpus is built, then it can still appear as a local history result with the closed-session timestamp and title.
- [ ] Given query tokens, exact quotes, or website filters exclude a recently closed URL, when searching, then the closed boost does not bypass those hard matching rules.
- [ ] Given the sessions API is unavailable or returns malformed records, when default history search loads, then normal deep-history search still works without a fatal popup error.
- [ ] Given recently closed data has already been fetched in the popup session, when results refresh or the user types, then Scry reuses cached closed-session metadata instead of repeatedly calling the sessions API.

## Data definition impact

Expected addition of a transient `recentlyClosed`/closed-session metadata field or ranking component on normalized history/index entries and search-result debug output. The boost should compose with existing recency/frequency and selection-learning ranking without introducing persistent storage.

## HtDP entry note

Implement after `issue-0030` collapses Scry to one default deep-history corpus. Start from `src/platform/sessions-provider.js`, `src/core/search.js`, `src/panel/app.js`, and tests that currently cover the separate `closed` mode. The closed-session signal is a ranking priority, not a separate corpus selector. Preserve local-only behavior and keep Chrome `sessions`/`history` access within the existing extension boundary. This issue is intended to complete in one HtDP iteration and one commit.

## Verification

Run:

```bash
npm test
npm run check
```

Expected coverage:

- Core ranking shows a closed-session boost for matching results while preserving hard filters and quote matching.
- Corpus construction includes valid recently closed URLs missing from history.
- Sessions failures degrade gracefully to deep-history-only search.
- Panel/default search uses cached closed-session metadata rather than a separate mode.

Manual check: close a tab, open Scry, search for that URL/title, and confirm it is prioritized in the default result list without switching modes.

## Blocked by

- `issue-0030` must be accepted or explicitly waived so there is a single default corpus to rank.

## HtDP iterations

- None yet. After implementation, record the single issue commit in the manifest and optionally reference it here.

## Out of scope

- Reintroducing a separate recently closed mode or mode-cycling UI.
- Persisting recently closed metadata beyond the popup session.
- Changing Chrome permissions beyond existing local history/sessions needs.
