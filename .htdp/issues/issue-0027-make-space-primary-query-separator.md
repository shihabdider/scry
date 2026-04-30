---
id: issue-0027
status: draft
type: feature
mode: AFK
source_prd: null
depends_on: []
remote:
  github: null
---

# Make space the primary query separator

## What to build

Make Scry's user-facing query syntax use spaces as the separator between remembered URL fragments instead of `*`. Users should be guided to type queries like `git skilift issues 13`, not `git*skilift*issues*13`. Update UI copy, examples, documentation, and tests so space-separated fragments are the primary path.

The current parser may continue to tolerate punctuation such as `*` as a separator for backward compatibility, but `*` should no longer be presented as the shortcut or required separator.

## Acceptance examples

- [ ] Given a history URL that previously matched `git*skilift*issues*13`, when the user searches `git skilift issues 13`, then Scry returns the same intended URL result.
- [ ] Given the popup search placeholder is visible, then it uses a space-separated example and does not present `*` as the separator key.
- [ ] Given README or product documentation shows example Scry queries, then those examples use spaces between fragments instead of `*`.
- [ ] Given automated query/search tests describe the recommended separator, then the primary examples use spaces.
- [ ] Given quoted exact matching exists, then spaces inside complete quotes keep their existing exact-phrase meaning and are not treated as ordinary token separators within that phrase.
- [ ] Given existing punctuation-tolerant tokenization remains cheaper and safer than rejecting `*`, then `*` may still work but is not documented as the separator.

## Data definition impact

No new persistent data is expected. Query tokenization should already model a query as ordered tokens and exact phrases; this issue may only require copy/test changes plus regression coverage for space-separated token input. If a separator concept exists in tests or docs, rename it away from star-specific language.

## HtDP entry note

Start by inspecting `src/core/query.js`, search tests, popup placeholder text, and README examples. The desired user behavior is a space-separated fragment query. Avoid expanding the query language or changing ranking unless tests show space-separated input is not already equivalent.

Preserve local-only behavior and the existing exact-quote feature. Do not add omnibox, content scripts, external search, or network calls.

## Verification

Run:

```bash
npm test
npm run check
```

Expected test coverage:

- Space-separated URL-fragment queries tokenize and search correctly.
- User-facing examples no longer rely on `*`.
- Existing exact-phrase tests still pass.
- Optional backward-compatibility test documents whether starred input remains tolerated.

Manual check after implementation: load Scry and search a known URL with spaces between remembered fragments.

## Blocked by

- None - can start immediately.

## HtDP iterations

- None yet.

## Out of scope

- Rejecting all punctuation separators.
- Redesigning ranking, highlighting, or exact-phrase semantics.
- Adding command syntax, web search, bookmarks, tabs, or non-history corpora.
