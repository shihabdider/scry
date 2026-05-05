---
id: issue-0029
status: ready
type: feature
mode: AFK
source_prd: null
depends_on: [issue-0028]
remote:
  github: null
---

# Make site filter match local file URLs

## What to build

Extend Scry's colon website/site filter so local Chrome history entries with `file:` URLs can be selected by the same syntax. A query like `file:` should act as a hard site filter for local files and return matching `file:///...` history results, including paths with percent-encoded spaces or punctuation such as downloaded PDFs.

The behavior should compose with existing query language semantics: `file:` by itself shows local file results ordered by the active mode's normal empty-query ordering, while `file: precalculus` filters to local files first and then searches/ranks inside those file URLs/titles using ordinary tokens. Existing domain filters such as `git:` must continue to match website hostname/root-name candidates as they do today.

## Acceptance examples

- [ ] Given a history result with URL `file:///Users/user1/Downloads/books/Precalculus%20mathematics%20in%20a%20nutshell%20%20geometry,%20algebra,%20trigonometry%20(Simmons,%20George%20F.%20(George%20Finlay),%201925-)%20(z-library.sk,%201lib.sk,%20z-lib.sk).pdf`, when the query is `file:`, then the local file result is returned.
- [ ] Given a mix of `file:///...` and `https://...` history results, when the query is `file:`, then only `file:` results remain eligible.
- [ ] Given local file results, when the query is `file: precalculus`, then `file:` is a hard site filter and `precalculus` continues to use existing token ranking inside matching file URLs/titles.
- [ ] Given existing website filters like `git: issues`, then hostname/root matching for web URLs remains unchanged.
- [ ] Given typed URL/action rows or non-history invalid/hostless URLs, then the change must not add external permissions, content scripts, network calls, or non-local indexing.

## Data definition impact

Expected new or changed data definitions:

- `WebsiteNameCandidates` should represent local file URL candidates in addition to hostname-derived candidates.
- `websiteNameCandidatesForUrl` should preserve the existing hostname path while exposing a deterministic local `file` candidate for `file:` URLs.
- Search/filter evidence should continue to use the existing website-filter data shape so selection learning and debug output remain compatible.

## HtDP entry note

Implement this as one HtDP iteration and one commit. Start from `src/core/url.js` and the core tests around website-name candidates and website-filter search. Prefer extending the local candidate derivation over adding a new search mode or special-case search branch. Do not add host permissions, content scripts, external lookup tables, network calls, or a public-suffix dependency.

## Verification

Run:

```bash
npm test
npm run check
```

Expected test coverage:

- `websiteNameCandidatesForUrl` returns a `file` match candidate for `file:///...` URLs.
- `file:` website/site filtering returns local file history entries and excludes web URLs.
- `file:` composes with ordinary token search/ranking within local file results.
- Existing domain website filters still pass.

Manual check after implementation: load Scry, search `file:`, then `file: precalculus`, and verify local file history entries are shown while normal website filters still behave unchanged.

## Blocked by

- issue-0028 accepted website/site filter syntax.

## HtDP iterations

- None yet. After implementation, record the single issue commit in the manifest and optionally reference it here.

## Out of scope

- Full filesystem scanning or indexing outside Chrome history.
- New permissions, content scripts, host permissions, options pages, or network calls.
- A new local-file search mode distinct from the existing site filter syntax.
- Public suffix list or external hostname lookup changes.
