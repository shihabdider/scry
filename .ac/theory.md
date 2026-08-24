# Theory

## Purpose

Scry is a local-only Chrome MV3 popup command palette for recalling and opening browser-history URLs from remembered fragments.

## User and problem

A user often remembers meaningful words from a page title or URL without remembering the complete text. The search should tolerate concise fragments without letting accidental subsequences in opaque URL metadata dominate obvious human-readable matches.

The reported trigger is a history search for `atri hera`: unrelated Google Maps URLs ranked above visited YouTube pages titled with `Atrioc` and `Hera`. Typing the longer `atrioc hera` produced the intended pages, but requiring the complete word defeats forgiving recall.

## Product decision

The user approved a bounded software correction to matching and ranking. Preserve useful short abbreviations such as `gh` for `github`, while making direct exact and prefix evidence outrank accidental ordered-subsequence evidence.

## Smallest useful outcome

Searching `atri hera` ranks Atrioc/Hera title results above unrelated URLs whose opaque components only satisfy weak abbreviation matching.

Included capabilities:

- Constrain ordered abbreviations so they behave like compact abbreviations rather than unlimited-gap subsequences.
- Prefer direct textual quality before field location and URL coherence.
- Reward coherent query-token evidence within one human-readable field.
- Preserve established exact, prefix, abbreviation, substring, URL-order, usage, and selection-learning behavior where it does not conflict with the corrected intent.

Excluded capabilities:

- Query syntax changes.
- General typo correction, edit distance, or broad fuzzy search.
- UI, data-source, storage, permissions, or network changes.
- A broad search subsystem refactor.

## Validation

- A regression fixture analogous to the reported query ranks the intended title first.
- Existing `gh` to `github` abbreviation behavior remains covered.
- `npm test` and `npm run check` pass.
- Human smoke testing can confirm the original browser-history query after loading the updated extension.
