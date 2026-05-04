---
id: issue-0028
status: ready
type: feature
mode: AFK
source_prd: null
depends_on: []
remote:
  github: null
---

# Add website-name filter syntax

## What to build

Add bracketed website-name filters to Scry queries. A complete bracketed term such as `[git]` should act as a hard filter over each result's website root/name, so only URLs whose normalized hostname root matches the bracket text remain eligible. For example, `[git]` should match history results from `github.com`, `gitter.com`, and `gitopia.com`, regardless of path/title, while excluding non-matching hosts even if their path or title contains `git`.

The bracket filter should compose with the existing query language: ordinary unquoted terms still rank/filter within the website-filtered candidate set, and complete double-quoted phrases still behave as exact phrase filters. A query containing only a bracket filter should show matching websites ordered by the current mode's normal empty-query ordering.

## Acceptance examples

- [ ] Given history results from `github.com`, `gitter.com`, `gitopia.com`, and `example.com/git-notes`, when the query is `[git]`, then only the `github.com`, `gitter.com`, and `gitopia.com` results are returned.
- [ ] Given a result from `docs.github.com` or `www.github.com`, when the query is `[git]`, then it matches by the website root/name rather than requiring the first hostname label to equal the filter.
- [ ] Given a query `[git] issues 13`, then `[git]` is a hard website filter and `issues 13` continues to use existing token ranking within matching websites.
- [ ] Given a query `[git] "pull requests"`, then Scry requires both the website-name filter and the existing exact-phrase match.
- [ ] Given a query `git` without brackets, then existing unbracketed fuzzy/token search behavior is preserved and may still match host, path, title, or query-string fields as it does today.
- [ ] Given an incomplete bracket while typing, such as `[git`, then Scry treats it as ordinary unquoted search text rather than activating a partial website filter or showing a parse error.
- [ ] Given selection learning has boosted results for an unfiltered query, then a bracket-filtered query remains keyed distinctly enough that the filter does not collapse into the same learned intent.

## Data definition impact

Expected new or changed data definitions:

- `ParsedQuery` should distinguish ordinary unquoted tokens, exact phrases, and one or more complete website-name filters.
- A website-name filter should preserve the raw bracket text and a normalized lowercase match string.
- Normalized history/index entries should expose enough hostname/root-name data for local matching without external public-suffix downloads or network calls.
- Search debug/selection-learning keys may need to include website filters so filtered and unfiltered intents remain distinguishable.

## HtDP entry note

Implement this as one HtDP iteration and one commit. Start from `src/core/query.js`, `src/core/url.js`, `src/core/search.js`, and the core/panel tests that exercise live search. Parse only complete bracket pairs as website-name filters; incomplete brackets should remain forgiving during live typing. Apply website filters as hard candidate filters before ordinary token ranking, quote filtering, pagination, and selection learning boosts.

Interpret "website root" with a deterministic local hostname heuristic: normalize hostnames to lowercase, ignore common leading `www`, and match the site/root name portion or equivalent host-label candidates so `[git]` matches `github.com`, `gitter.com`, `gitopia.com`, and subdomains such as `docs.github.com`. Do not add host permissions, content scripts, external lookup tables, network calls, or a public-suffix dependency.

## Verification

Run:

```bash
npm test
npm run check
```

Expected test coverage:

- Query parser separates complete bracket filters from ordinary tokens and exact phrases.
- Incomplete brackets remain ordinary forgiving live-search text.
- Search filters by website root/name for `[git]`, including subdomain/common-`www` cases.
- Bracket filters compose with ordinary token ranking and quoted exact matching.
- Unbracketed queries retain existing behavior.
- Selection-learning keys/debug output do not erase the distinction between filtered and unfiltered queries.

Manual check after implementation: load Scry, search `[git]`, then `[git] issues`, and verify only matching website roots are shown while normal URL ranking still feels unchanged inside the filtered set.

## Blocked by

- None - can start immediately.

## HtDP iterations

- None yet. After implementation, record the single issue commit in the manifest and optionally reference it here.

## Out of scope

- Full public-suffix-list correctness for every country-code or private suffix.
- New search modes, web search, bookmarks, tabs, content scripts, options pages, host permissions, or external services.
- UI redesign beyond whatever copy/test updates are needed to document the query syntax.
- Rejecting existing punctuation-tolerant or unbracketed query behavior.
