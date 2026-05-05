# Iteration

anchor: 189ba291fd1cadec76e8959ad975fce75e725432
started: 2026-05-04T19:12:00Z
stubber-mode: data-definition-driven
workflow-mode: autonomous
language: JavaScript
transparent: true

## Source Artifacts

- PRD: none
- Issue: .htdp/issues/issue-0029-make-site-filter-match-local-file-urls.md
- Architecture review: none
- Project DSL: .htdp/DSL.json

## Problem

Extend Scry's existing colon website/site filter so local Chrome history entries whose URLs use the `file:` scheme can be found with `file:`. The filter should hard-limit candidates to local `file:///...` history entries and then compose with existing ordinary token search/ranking, exact phrases, mode ordering, selection learning, and debug evidence.

## Data Definition Plan

Use data-definition-driven stubbing because this JavaScript change is an additive model extension. Extend `WebsiteNameCandidates` / `websiteNameCandidatesForUrl` to represent scheme-derived local-file site candidates while preserving hostname-derived website candidates. Keep `WebsiteFilter`, parsed query data, search filtering, and selection-learning intent shapes unchanged so `file:` uses the same hard-filter pipeline as domain filters.

## Polya Ledger

### Knowns

- Existing colon syntax parses leading `site:` prefixes as website filters.
- `file:` currently parses as a website filter but local `file:///...` URLs have no hostname candidates, so they do not match.
- User specifically wants `file:` to match local file URLs in Chrome history, including percent-encoded downloaded PDF paths.
- `file:` should compose with ordinary query terms such as `file: precalculus`.
- Existing domain filters like `git:` must continue to work unchanged.

### Constraints

- Keep Scry local-only; no external network calls, host permissions, content scripts, options pages, public-suffix dependency, or filesystem crawling.
- Work only from Chrome history/local data already available to the popup.
- Preserve the existing colon website-filter query model and selection-learning distinction.
- Run `npm test` and `npm run check` after implementation.
- Complete exactly one issue-boundary commit for issue-0029.

### Unknowns That Matter

- [resolved] `file:` should mean Chrome history entries with URL protocol `file:`, not filesystem scanning or arbitrary local filename search outside history.

### Out of Scope

- Full filesystem indexing or scanning outside Chrome history.
- New search modes, permissions, host permissions, content scripts, options pages, or network calls.
- Public suffix/hostname lookup changes beyond preserving existing website candidates.
- Changing typed URL/action row behavior.

### Assumptions

- Representing local files as a `file` site candidate inside `WebsiteNameCandidates` is sufficient and safer than adding a special-case search branch.
- `file:` filter matching should continue using prefix semantics, so the normalized `file` filter matches a `file` candidate.
- Token search for file paths/titles is already handled by `buildSegments` from the URL pathname and title once the hard filter admits the file entry.

### Alternatives Considered

- Special-case `file:` in `applyWebsiteFilters` — rejected because it duplicates existing website-filter evidence and makes debug/selection behavior less uniform.
- Add a new local-file search mode — rejected as out of scope and unnecessary for one site-filter extension.
- Index filesystem paths outside Chrome history — rejected by the local-only/no-new-permissions boundary and the user's history-specific request.
- Chosen: extend URL candidate derivation so `file:` is just another local site candidate consumed by the existing filter pipeline.

### Decision Log

- 2026-05-04T19:12:00Z — user requested that site queries like `file:` match local `file:///...` history URLs; proceeding autonomously with the existing colon website-filter pipeline.

### Look Back

- Phase 1 modeled local `file:` URLs as scheme-derived `WebsiteNameCandidates` while keeping existing website-filter data and search evidence shapes.
- Phase 2 implemented `file` match candidates for `file:///...` history URLs and added core coverage for `file:`, `file: precalculus`, and unchanged web-domain filters.
- Phase 3 found no useful abstraction opportunity; the local-file candidate helper is intentionally small and separate from hostname derivation.
- Documentation pass updated README and contract coverage for `file:` site filters.
