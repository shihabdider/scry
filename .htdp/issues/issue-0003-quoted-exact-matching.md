---
id: issue-0003
status: draft
type: feature
mode: AFK
source_prd: null
depends_on: []
remote:
  github: null
---

# Add quoted exact phrase matching

## What to build

Extend Scry's query parsing and ranking so complete double-quoted phrases act as exact phrase filters. Every complete quoted phrase in the query must match contiguous normalized text in either the result display URL or title. Unquoted terms should continue to use today's lowercase token/fuzzy matching and ranking behavior inside the quoted filter set.

Quoted matching should preserve URL punctuation and use smart case only inside quoted phrases:

- all-lowercase quoted phrase -> case-insensitive phrase match;
- any uppercase letter in quoted phrase -> case-sensitive phrase match;
- whitespace is collapsed for matching;
- punctuation such as `.`, `/`, `-`, `_`, `?`, and `=` remains meaningful.

Only complete plain paired `"` delimit exact phrases. Incomplete quotes should behave like ordinary unquoted search text while the user is typing live search. Do not support escaping embedded quotes in this slice.

Quoted phrases are hard filters, then light ranking signals. URL phrase matches should rank above title-only phrase matches. Earlier match positions can break close ties. For quote-only queries, order by quoted-match quality first, then current frecency. For mixed quoted+unquoted queries, first require all quoted phrases, then let existing unquoted-token ranking drive most ordering with the quoted URL-over-title quality as a modest signal.

## Acceptance examples

- [ ] Given a result with display URL `github.com/mskilab-org/repo/issues/13`, when the query is `"mskilab-org/repo"`, then the result matches.
- [ ] Given a result with title containing `Pull requests`, when the query is `"pull requests"`, then the result matches even if whitespace in the title is irregular after normalization.
- [ ] Given a result containing `pull-requests`, when the query is `"pull requests"`, then the result does not match because punctuation is preserved.
- [ ] Given a result containing `MSKILAB-org/repo`, when the query is `"mskilab-org/repo"`, then the result matches because the quoted phrase is all lowercase and therefore case-insensitive.
- [ ] Given a result containing `mskilab-org/repo`, when the query is `"MSKILAB-org/repo"`, then the result does not match because uppercase in the quoted phrase makes it case-sensitive.
- [ ] Given a query with multiple quoted phrases, then a result appears only if every quoted phrase matches either display URL or title.
- [ ] Given an unfinished quote such as `"github.com/mskilab`, then Scry treats it like normal unquoted search text instead of activating exact filtering or showing a parse warning.
- [ ] Given a quote-only query where one result matches the phrase in the display URL and another matches only in the title, then the display-URL match ranks first when other signals are comparable.
- [ ] Given a quote-only query with multiple URL matches, then quoted-match quality and earlier phrase position sort before current frecency tie-breakers.
- [ ] Given a mixed query such as `github "mskilab-org/repo" issue`, then all results must satisfy the quoted phrase and unquoted tokens continue to rank results using existing Scry behavior.
- [ ] Given a query containing embedded quote characters or escape-looking syntax, then only plain paired quotes are treated as delimiters; no backslash escape feature is required.

## Data definition impact

Expected new or changed data definitions:

- Query parsing should distinguish ordinary unquoted tokens from complete quoted exact phrases.
- An exact phrase should carry its raw phrase text, whitespace-normalized match text, and smart-case/case-sensitive flag.
- Search/ranking should include quote-match evidence, such as matched field (`displayUrl` vs `title`) and position, without breaking existing result shape unless useful for debug output.

## HtDP entry note

Implement quoted exact matching as a core search/query vertical slice. Preserve current behavior for unquoted searches as much as possible. Quotes are a precision/narrowing tool, not a replacement for token recall. Incomplete quotes must remain forgiving during live typing. Punctuation preservation is important for URL section matching; do not normalize `-` and `/` away.

For matching, use the result's display URL and title, not browser history raw URL fragments. Every complete quoted phrase is required. If no unquoted tokens remain after parsing, return matching results ordered by quote quality then frecency.

## Verification

Run:

```bash
npm test
npm run check
```

Expected test coverage:

- Parser behavior for unquoted text, one quote, multiple quotes, incomplete quotes, and no escape support.
- Smart-case phrase matching.
- Whitespace collapse with punctuation preservation.
- Hard filtering for all quoted phrases.
- URL-over-title light ranking and quote-only fallback to frecency.
- Regression tests showing current unquoted search behavior is preserved.

Manual check after implementation: search with URL-section phrases such as `"mskilab-org/repo"`, title phrases such as `"pull requests"`, and incomplete quotes while typing to confirm live search remains usable.

## Blocked by

- None - can start immediately.

## HtDP iterations

- None yet.

## Out of scope

- Escaped quotes inside quoted phrases.
- Smart case for ordinary unquoted tokens.
- Exact full-field matching.
- Search modes or result actions.
