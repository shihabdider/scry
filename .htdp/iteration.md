# Iteration

anchor: 49f9b86f4fe7fc8e49d0cafc595adcd9c1776040
started: 2026-05-04T16:53:25Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript
transparent: true

## Source Artifacts

- PRD: none
- Issue: .htdp/issues/issue-0028-add-website-name-filter-syntax.md
- Architecture review: none
- Project DSL: .htdp/DSL.json

## Problem

Add bracketed website-name filters to Scry query syntax. Complete bracketed terms such as `[git]` hard-filter results to matching website roots/names (for example `github.com`, `gitter.com`, `gitopia.com`, and relevant subdomains) while ordinary unquoted tokens and complete double-quoted phrases continue to compose with the filtered candidate set.

## Data Definition Plan

Use data-definition-driven stubbing because this is JavaScript and the data definition changes are JSDoc/model additions rather than compiler-enforced breakage. Extend `ParsedQuery` with a website-filter collection, introduce a small website-filter datum carrying raw and normalized text, and extend normalized/indexed history entries with local hostname/root-name match candidates. Keep existing token and exact-phrase models intact. Include website filters in query keys/debug data where needed so filtered and unfiltered selection-learning intents remain distinct.

## Polya Ledger

### Knowns

- Complete bracket syntax like `[git]` is the new hard website-name filter syntax.
- `[git]` should match host roots/names such as `github.com`, `gitter.com`, and `gitopia.com`.
- Matching should exclude non-matching hosts even if path/title contains the bracket text.
- Bracket filters compose with ordinary unquoted token ranking and quoted exact phrase filtering.
- Bracket-only queries should use the current mode's normal empty-query ordering inside the filtered candidate set.
- Incomplete brackets like `[git` must remain forgiving ordinary live-search text.
- Existing unbracketed query behavior must be preserved.

### Constraints

- Keep Scry local-only; no external network calls, host permissions, content scripts, options pages, or public-suffix dependency.
- Preserve the existing recent/closed/deep mode architecture, typed URL row, ranking, exact phrase semantics, and selection learning except for filtered query key distinction.
- Run `npm test` and `npm run check` after implementation.
- Complete exactly one issue-boundary commit for issue-0028.

### Unknowns That Matter

- [resolved] Website root matching will use the issue's deterministic local hostname heuristic, not full public-suffix-list correctness.
- [resolved] Multiple complete bracket filters, if present, should be treated as hard filters that all must match the same result host candidate set unless implementation evidence shows a safer narrower interpretation.

### Out of Scope

- Full public-suffix-list correctness, country-code/private suffix edge-case coverage, external lookup tables, or network calls.
- New search modes, web search, bookmarks, tabs, options pages, content scripts, host permissions, or UI redesign.
- Rejecting punctuation-tolerant or unbracketed query behavior.

### Assumptions

- Ignoring a leading `www` and matching against normalized hostname labels/root-name candidates is sufficient for the requested `git` examples.
- Complete bracket pairs can be removed from unquoted token text similarly to complete quoted phrases; incomplete brackets stay in unquoted text.
- Selection-learning keys should include bracket filters in a stable textual form such as `[git]` so learned intent for `git` differs from `[git]`.

### Alternatives Considered

- Full public suffix list — rejected because the issue explicitly forbids dependency/network expansion and only asks for a deterministic local heuristic.
- Treat brackets as ordinary tokens plus a ranking boost — rejected because acceptance requires a hard filter excluding path/title-only matches.
- Require exact hostname label equality for bracket text — rejected because `[git]` must match `github.com`, `gitter.com`, and `gitopia.com`, not only a literal `git` label.
- Chosen: add explicit website-filter query data and host-derived match candidates, applying filters before existing token/quote ranking.

### Decision Log

- 2026-05-04T16:53:25Z — user said `go`; proceeding autonomously from ready frontier issue-0028 with the local hostname heuristic recorded in the issue.

### Look Back

- Phase 1 added explicit website-filter, website-name candidate, search evidence, and selection-intent data definitions plus DSL entries.
- Phase 2 implemented bracket parsing, local hostname/root candidate matching, hard candidate filtering before ranking/quotes, and filter-distinct selection-learning keys/boosts.
- Phase 3 extracted shared website-filter normalization, reused website-filter parsing in selection learning, and factored ranked-entry comparison.
- Final docs pass added README coverage and a contract test for `[git] issues 13` syntax discovery.
- Symbolic verification passed: `npm test` (269 passing), `npm run check`, and HtDP `final_preverify`.
